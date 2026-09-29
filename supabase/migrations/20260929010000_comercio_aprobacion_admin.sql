-- Aprobación humana verificable para las acciones sensibles del agente MCP.
--
-- Antes, `confirmar_*` aceptaba el `rol` que declaraba quien llamaba a la
-- herramienta. Ahora una confirmación solo pasa a `aprobada` si lo hace un
-- usuario owner/admin activo con sesión en Supabase (auth.uid()); el trigger
-- lo impone también frente a la service role, así que ni el MCP ni otro agente
-- con acceso SQL pueden auto-aprobarse. El MCP solo ejecuta filas `aprobada`.
--
-- Flujo: pendiente → aprobada (owner/admin en el CMS) → confirmada (MCP ejecuta)
--        pendiente|aprobada → rechazada (owner/admin) | vencida
-- Las propuestas de ficha (`proponer_ficha`) mantienen su flujo: cualquier
-- perfil del CMS las aplica (confirmada) o rechaza directamente.

ALTER TABLE public.comercio_confirmaciones
  ADD COLUMN IF NOT EXISTS aprobada_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprobada_en timestamptz;

ALTER TABLE public.comercio_confirmaciones
  DROP CONSTRAINT IF EXISTS comercio_confirmaciones_estado_check;
ALTER TABLE public.comercio_confirmaciones
  ADD CONSTRAINT comercio_confirmaciones_estado_check
  CHECK (estado IN ('pendiente', 'aprobada', 'confirmada', 'rechazada', 'vencida'));

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

  IF OLD.herramienta = 'proponer_ficha' THEN
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

DROP TRIGGER IF EXISTS comercio_confirmaciones_guard ON public.comercio_confirmaciones;
CREATE TRIGGER comercio_confirmaciones_guard
  BEFORE INSERT OR UPDATE ON public.comercio_confirmaciones
  FOR EACH ROW EXECUTE FUNCTION public.comercio_confirmaciones_guard();

CREATE INDEX IF NOT EXISTS idx_comercio_confirmaciones_aprobacion
  ON public.comercio_confirmaciones (creada_en DESC)
  WHERE estado IN ('pendiente', 'aprobada');
