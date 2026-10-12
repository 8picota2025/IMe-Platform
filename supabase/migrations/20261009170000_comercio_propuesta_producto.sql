-- Propuestas de producto nuevo desde fichas PDF (agente Hermes `contenidos`).
--
-- `proponer_producto` sigue el mismo flujo que `proponer_ficha`: el agente
-- solo crea la fila pendiente; una persona del CMS (catalogo, operaciones,
-- ventas, admin, owner) la aplica (crea el producto INACTIVO) o la rechaza.
-- El resto de la función es idéntica a 20260929010000_comercio_aprobacion_admin.

CREATE OR REPLACE FUNCTION public.comercio_confirmaciones_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  es_aprobador boolean := public.is_admin(ARRAY['owner', 'admin']);
  es_cms boolean := public.is_admin(ARRAY['catalogo', 'operaciones', 'ventas']);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'pendiente' OR NEW.aprobada_por IS NOT NULL OR NEW.aprobada_en IS NOT NULL THEN
      RAISE EXCEPTION 'Una confirmación se crea pendiente y sin aprobación';
    END IF;
    RETURN NEW;
  END IF;

  -- Lo aprobado no puede cambiar después: qué, sobre qué y hasta cuándo.
  IF NEW.herramienta IS DISTINCT FROM OLD.herramienta
     OR NEW.entidad IS DISTINCT FROM OLD.entidad
     OR NEW.entidad_id IS DISTINCT FROM OLD.entidad_id
     OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.creada_en IS DISTINCT FROM OLD.creada_en
     OR NEW.vence_en IS DISTINCT FROM OLD.vence_en THEN
    RAISE EXCEPTION 'El contenido de una confirmación es inmutable';
  END IF;

  IF NEW.estado = OLD.estado THEN
    IF NEW.aprobada_por IS DISTINCT FROM OLD.aprobada_por
       OR NEW.aprobada_en IS DISTINCT FROM OLD.aprobada_en THEN
      RAISE EXCEPTION 'La aprobación solo se fija al aprobar';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.estado = 'vencida' AND OLD.estado IN ('pendiente', 'aprobada') THEN
    NEW.aprobada_por := OLD.aprobada_por;
    NEW.aprobada_en := OLD.aprobada_en;
    RETURN NEW;
  END IF;

  IF OLD.herramienta IN ('proponer_ficha', 'proponer_producto') THEN
    IF OLD.estado = 'pendiente' AND NEW.estado IN ('confirmada', 'rechazada') AND es_cms THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Transición no permitida para propuesta de ficha';
  END IF;

  IF OLD.estado = 'pendiente' AND NEW.estado = 'aprobada' THEN
    IF NOT es_aprobador THEN
      RAISE EXCEPTION 'Solo un owner o admin con sesión puede aprobar';
    END IF;
    IF now() >= OLD.vence_en THEN
      RAISE EXCEPTION 'La confirmación venció';
    END IF;
    NEW.aprobada_por := auth.uid();
    NEW.aprobada_en := now();
    RETURN NEW;
  END IF;

  IF OLD.estado IN ('pendiente', 'aprobada') AND NEW.estado = 'rechazada' THEN
    IF NOT es_aprobador THEN
      RAISE EXCEPTION 'Solo un owner o admin con sesión puede rechazar';
    END IF;
    NEW.aprobada_por := OLD.aprobada_por;
    NEW.aprobada_en := OLD.aprobada_en;
    RETURN NEW;
  END IF;

  IF OLD.estado = 'aprobada' AND NEW.estado = 'confirmada' THEN
    NEW.aprobada_por := OLD.aprobada_por;
    NEW.aprobada_en := OLD.aprobada_en;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transición % → % no permitida', OLD.estado, NEW.estado;
END;
$$;

REVOKE ALL ON FUNCTION public.comercio_confirmaciones_guard() FROM PUBLIC, anon, authenticated;
