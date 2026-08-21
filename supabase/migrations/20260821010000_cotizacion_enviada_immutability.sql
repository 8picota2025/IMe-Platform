-- Sent quotes (estado=enviada) are immutable commercial offers.
-- Design: docs/commercial-dropshipping-plan.md — duplicate-on-revise;
-- illegal: enviada → nueva|en_revision|respondida.
-- formalizar-cotizacion reads live productos/precio_total_ofertado, so PostgREST
-- updates from ventas must not be able to rewrite prices after the client link ships.

CREATE OR REPLACE FUNCTION enforce_cotizacion_enviada_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado = 'enviada' AND NEW.estado IN ('nueva', 'en_revision', 'respondida') THEN
    RAISE EXCEPTION
      'COTIZACION_ENVIADA_INMUTABLE: no se puede revertir enviada a %. Crea una nueva revision.',
      NEW.estado
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.estado = 'enviada' THEN
    IF NEW.productos IS DISTINCT FROM OLD.productos
      OR NEW.condiciones IS DISTINCT FROM OLD.condiciones
      OR NEW.moneda IS DISTINCT FROM OLD.moneda
      OR NEW.mercado IS DISTINCT FROM OLD.mercado
      OR NEW.validez_hasta IS DISTINCT FROM OLD.validez_hasta
      OR COALESCE(NEW.impuestos_incluidos, false) IS DISTINCT FROM COALESCE(OLD.impuestos_incluidos, false)
    THEN
      RAISE EXCEPTION
        'COTIZACION_ENVIADA_INMUTABLE: la oferta comercial no se puede editar tras el envio. Crea una nueva revision.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Allow precio_total sync only when claiming convertida (formalizar).
    IF NEW.precio_total_ofertado IS DISTINCT FROM OLD.precio_total_ofertado
      AND NEW.estado IS DISTINCT FROM 'convertida'
    THEN
      RAISE EXCEPTION
        'COTIZACION_ENVIADA_INMUTABLE: precio_total_ofertado bloqueado tras el envio.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF OLD.estado = 'convertida' THEN
    IF NEW.estado IS DISTINCT FROM 'convertida' THEN
      RAISE EXCEPTION
        'COTIZACION_CONVERTIDA_INMUTABLE: no se puede cambiar el estado de una cotizacion convertida.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.productos IS DISTINCT FROM OLD.productos
      OR NEW.precio_total_ofertado IS DISTINCT FROM OLD.precio_total_ofertado
      OR NEW.condiciones IS DISTINCT FROM OLD.condiciones
      OR NEW.moneda IS DISTINCT FROM OLD.moneda
      OR NEW.mercado IS DISTINCT FROM OLD.mercado
      OR NEW.validez_hasta IS DISTINCT FROM OLD.validez_hasta
      OR COALESCE(NEW.impuestos_incluidos, false) IS DISTINCT FROM COALESCE(OLD.impuestos_incluidos, false)
    THEN
      RAISE EXCEPTION
        'COTIZACION_CONVERTIDA_INMUTABLE: la oferta comercial no se puede editar tras convertir.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizacion_enviada_immutability ON solicitudes_cotizacion;
CREATE TRIGGER trg_cotizacion_enviada_immutability
  BEFORE UPDATE ON solicitudes_cotizacion
  FOR EACH ROW
  EXECUTE FUNCTION enforce_cotizacion_enviada_immutability();
