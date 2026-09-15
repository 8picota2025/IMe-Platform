-- F4.2: reservas de inventario atómicas + auditoría de cambios sensibles.
-- Rollback: DROP FUNCTION / DROP TABLE en orden inverso (documentado al final).

-- ── stock_reservas ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_reservas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  pedido_id       UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  estado          TEXT NOT NULL DEFAULT 'activa'
                  CHECK (estado IN ('activa', 'consumida', 'liberada', 'expirada')),
  expires_at      TIMESTAMPTZ NOT NULL,
  correlation_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservas_producto_activa
  ON stock_reservas (producto_id)
  WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS idx_stock_reservas_pedido
  ON stock_reservas (pedido_id)
  WHERE pedido_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_reservas_expires
  ON stock_reservas (expires_at)
  WHERE estado = 'activa';

DROP TRIGGER IF EXISTS set_stock_reservas_updated_at ON stock_reservas;
CREATE TRIGGER set_stock_reservas_updated_at
  BEFORE UPDATE ON stock_reservas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE stock_reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_reservas_admin_select" ON stock_reservas;
CREATE POLICY "stock_reservas_admin_select"
  ON stock_reservas FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'catalogo']));

-- Escritura solo service_role (Edge Functions). Sin policy INSERT/UPDATE para authenticated.

-- Unidades reservadas activas no expiradas
CREATE OR REPLACE FUNCTION stock_reservado_activo(p_producto_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cantidad), 0)::INT
  FROM stock_reservas
  WHERE producto_id = p_producto_id
    AND estado = 'activa'
    AND expires_at > NOW();
$$;

-- Stock disponible = físico - reservado (NULL físico = sin cupo numérico)
CREATE OR REPLACE FUNCTION stock_disponible_producto(p_producto_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_stock INT;
  v_gestionar BOOLEAN;
BEGIN
  SELECT stock, gestionar_stock INTO v_stock, v_gestionar
  FROM productos
  WHERE id = p_producto_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Sin gestión de cantidad: no hay tope numérico (representado como NULL → usamos -1 sentinel en callers TS).
  IF v_stock IS NULL AND COALESCE(v_gestionar, false) = false THEN
    RETURN NULL;
  END IF;

  RETURN GREATEST(COALESCE(v_stock, 0) - stock_reservado_activo(p_producto_id), 0);
END;
$$;

/**
 * Reserva atómica. Bloquea fila de producto.
 * Si el producto no gestiona stock numérico, no inserta filas y retorna ok.
 */
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

CREATE OR REPLACE FUNCTION liberar_stock_reservas_pedido(p_pedido_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE stock_reservas
  SET estado = 'liberada', updated_at = NOW()
  WHERE pedido_id = p_pedido_id
    AND estado = 'activa';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION liberar_stock_reservas_pedido(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION liberar_stock_reservas_pedido(UUID) TO service_role;

/**
 * Convierte reservas activas del pedido en consumo definitivo (decrementa stock).
 * Idempotente: solo toca filas 'activa'.
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
BEGIN
  FOR r IN
    SELECT id, producto_id, cantidad
    FROM stock_reservas
    WHERE pedido_id = p_pedido_id
      AND estado = 'activa'
    FOR UPDATE
  LOOP
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

CREATE OR REPLACE FUNCTION liberar_stock_reservas_expiradas()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE stock_reservas
  SET estado = 'expirada', updated_at = NOW()
  WHERE estado = 'activa'
    AND expires_at <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION liberar_stock_reservas_expiradas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION liberar_stock_reservas_expiradas() TO service_role;

-- ── auditoria_catalogo (precio/stock/disponible) ─────────────
CREATE TABLE IF NOT EXISTS auditoria_catalogo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID NOT NULL DEFAULT auth.uid(),
  entidad       TEXT NOT NULL,
  entidad_id    TEXT NOT NULL,
  campo         TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo   TEXT,
  correlation_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_catalogo_entidad
  ON auditoria_catalogo (entidad, entidad_id, created_at DESC);

ALTER TABLE auditoria_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_catalogo_admin_select" ON auditoria_catalogo;
CREATE POLICY "auditoria_catalogo_admin_select"
  ON auditoria_catalogo FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'catalogo', 'owner', 'admin']));

DROP POLICY IF EXISTS "auditoria_catalogo_admin_insert" ON auditoria_catalogo;
CREATE POLICY "auditoria_catalogo_admin_insert"
  ON auditoria_catalogo FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(ARRAY['ventas', 'operaciones', 'catalogo', 'owner', 'admin'])
    AND actor_id = auth.uid()
  );

-- Sin UPDATE/DELETE policies → inmutable para roles normales.

-- Rollback (manual):
-- DROP POLICY IF EXISTS "auditoria_catalogo_admin_insert" ON auditoria_catalogo;
-- DROP POLICY IF EXISTS "auditoria_catalogo_admin_select" ON auditoria_catalogo;
-- DROP TABLE IF EXISTS auditoria_catalogo;
-- DROP FUNCTION IF EXISTS liberar_stock_reservas_expiradas();
-- DROP FUNCTION IF EXISTS consumir_stock_reservas_pedido(UUID);
-- DROP FUNCTION IF EXISTS liberar_stock_reservas_pedido(UUID);
-- DROP FUNCTION IF EXISTS reservar_stock(UUID, INT, UUID, INT, TEXT);
-- DROP FUNCTION IF EXISTS stock_disponible_producto(UUID);
-- DROP FUNCTION IF EXISTS stock_reservado_activo(UUID);
-- DROP TABLE IF EXISTS stock_reservas;
