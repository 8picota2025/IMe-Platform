-- Fix F4.2 oversell: expired-but-activa reservas were ignored by stock_reservado_activo
-- (so a second checkout could reserve the same unit) while consumir_stock_reservas_pedido
-- still decremented every activa row on pay → double fulfillment / inventory corruption.
--
-- Also: reservar_stock now expires overdue rows for the product under the same FOR UPDATE
-- lock before computing disponible, so zombies cannot overlap a fresh hold.

CREATE OR REPLACE FUNCTION reservar_stock(
  p_producto_id UUID,
  p_cantidad INT,
  p_pedido_id UUID,
  p_ttl_minutes INT DEFAULT 30,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  ok BOOLEAN,
  reserva_id UUID,
  disponible_restante INT,
  motivo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INT;
  v_gestionar BOOLEAN;
  v_disponible INT;
  v_reserva_id UUID;
  v_ttl INT;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0, 'cantidad_invalida';
    RETURN;
  END IF;

  v_ttl := GREATEST(COALESCE(p_ttl_minutes, 30), 5);

  SELECT stock, gestionar_stock
    INTO v_stock, v_gestionar
  FROM productos
  WHERE id = p_producto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0, 'producto_no_encontrado';
    RETURN;
  END IF;

  -- Expire overdue holds for this SKU while we hold the product row lock.
  UPDATE stock_reservas
  SET estado = 'expirada', updated_at = NOW()
  WHERE producto_id = p_producto_id
    AND estado = 'activa'
    AND expires_at <= NOW();

  IF v_stock IS NULL AND COALESCE(v_gestionar, false) = false THEN
    RETURN QUERY SELECT true, NULL::UUID, NULL::INT, 'sin_gestion_stock';
    RETURN;
  END IF;

  v_disponible := GREATEST(COALESCE(v_stock, 0) - stock_reservado_activo(p_producto_id), 0);
  IF v_disponible < p_cantidad THEN
    RETURN QUERY SELECT false, NULL::UUID, v_disponible, 'stock_insuficiente';
    RETURN;
  END IF;

  INSERT INTO stock_reservas (producto_id, pedido_id, cantidad, estado, expires_at, correlation_id)
  VALUES (
    p_producto_id,
    p_pedido_id,
    p_cantidad,
    'activa',
    NOW() + make_interval(mins => v_ttl),
    p_correlation_id
  )
  RETURNING id INTO v_reserva_id;

  RETURN QUERY SELECT true, v_reserva_id, v_disponible - p_cantidad, 'reservado';
END;
$$;

REVOKE ALL ON FUNCTION reservar_stock(UUID, INT, UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reservar_stock(UUID, INT, UUID, INT, TEXT) TO service_role;

/**
 * Consume only when physical stock still covers this hold after other non-expired
 * activas. Expired-but-still-activa rows may win if nobody else holds the unit;
 * they lose cleanly (marked expirada, no decrement) if another live hold exists.
 */
CREATE OR REPLACE FUNCTION consumir_stock_reservas_pedido(p_pedido_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_count INT := 0;
  v_stock INT;
  v_gestionar BOOLEAN;
  v_otros INT;
  v_disponible INT;
BEGIN
  FOR r IN
    SELECT id, producto_id, cantidad
    FROM stock_reservas
    WHERE pedido_id = p_pedido_id
      AND estado = 'activa'
    FOR UPDATE
  LOOP
    SELECT stock, gestionar_stock
      INTO v_stock, v_gestionar
    FROM productos
    WHERE id = r.producto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      UPDATE stock_reservas
      SET estado = 'expirada', updated_at = NOW()
      WHERE id = r.id;
      CONTINUE;
    END IF;

    IF v_stock IS NULL AND COALESCE(v_gestionar, false) = false THEN
      UPDATE stock_reservas
      SET estado = 'consumida', updated_at = NOW()
      WHERE id = r.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(cantidad), 0)::INT
      INTO v_otros
    FROM stock_reservas
    WHERE producto_id = r.producto_id
      AND estado = 'activa'
      AND id <> r.id
      AND expires_at > NOW();

    v_disponible := GREATEST(COALESCE(v_stock, 0) - v_otros, 0);
    IF v_disponible < r.cantidad THEN
      -- Another live hold owns the unit (or stock already gone). Do not oversell.
      UPDATE stock_reservas
      SET estado = 'expirada', updated_at = NOW()
      WHERE id = r.id;
      CONTINUE;
    END IF;

    UPDATE productos
    SET stock = CASE
      WHEN stock IS NULL THEN NULL
      ELSE GREATEST(stock - r.cantidad, 0)
    END,
    updated_at = NOW()
    WHERE id = r.producto_id;

    UPDATE stock_reservas
    SET estado = 'consumida', updated_at = NOW()
    WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION consumir_stock_reservas_pedido(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consumir_stock_reservas_pedido(UUID) TO service_role;
