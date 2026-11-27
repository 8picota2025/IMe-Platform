-- Integrador 2026-11-27: telemetría CMS → eventos_sistema
-- cotizacion_registrada al numerar; cotizacion_actualizada al costear.
-- Solo filas del CMS (landing_path=/comercial o campaign pwa-*).
-- Sin PII. Idempotente. No hace backfill. No dispara correo ni RFQ.
-- Revertir: DROP TRIGGER IF EXISTS trg_eventos_cms_cotizacion ON public.solicitudes_cotizacion;
--           DROP FUNCTION IF EXISTS public.emit_evento_cms_cotizacion(text, uuid, text, text, numeric, numeric, jsonb, text, text);
--           DROP FUNCTION IF EXISTS public.tg_eventos_cms_cotizacion();

CREATE OR REPLACE FUNCTION public.emit_evento_cms_cotizacion(
  p_op text,
  p_id uuid,
  p_numero_old text,
  p_numero_new text,
  p_precio_old numeric,
  p_precio_new numeric,
  p_productos jsonb,
  p_tipo_solicitud text,
  p_origen text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev text;
  n_prod integer;
  num_old text := nullif(btrim(coalesce(p_numero_old, '')), '');
  num_new text := nullif(btrim(coalesce(p_numero_new, '')), '');
BEGIN
  IF p_id IS NULL THEN
    RETURN 'skip';
  END IF;

  IF num_new IS NOT NULL AND (p_op = 'INSERT' OR num_old IS NULL) THEN
    ev := 'cotizacion_registrada';
  ELSIF p_op = 'UPDATE'
        AND p_precio_new IS NOT NULL
        AND p_precio_new IS DISTINCT FROM p_precio_old
        AND p_precio_new > 0 THEN
    ev := 'cotizacion_actualizada';
  ELSE
    RETURN 'skip';
  END IF;

  IF ev = 'cotizacion_registrada' AND EXISTS (
    SELECT 1 FROM public.eventos_sistema e
    WHERE e.evento = ev
      AND e.detalle->>'solicitud_id' = p_id::text
      AND coalesce(e.detalle->>'backfill', 'false') <> 'true'
  ) THEN
    RETURN 'skip_idempotente';
  END IF;

  IF ev = 'cotizacion_actualizada' AND EXISTS (
    SELECT 1 FROM public.eventos_sistema e
    WHERE e.evento = ev
      AND e.detalle->>'solicitud_id' = p_id::text
      AND e.detalle->>'precio_total_ofertado' = p_precio_new::text
  ) THEN
    RETURN 'skip_idempotente';
  END IF;

  n_prod := coalesce(jsonb_array_length(coalesce(p_productos, '[]'::jsonb)), 0);

  INSERT INTO public.eventos_sistema (fn, nivel, evento, detalle)
  VALUES (
    'comercial-cotizacion',
    'info',
    ev,
    jsonb_strip_nulls(jsonb_build_object(
      'productos_count', n_prod,
      'tipo_solicitud', p_tipo_solicitud,
      'numero', num_new,
      'solicitud_id', p_id,
      'origen', p_origen,
      'precio_total_ofertado', CASE WHEN ev = 'cotizacion_actualizada' THEN p_precio_new ELSE NULL END
    ))
  );

  RETURN ev;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_evento_cms_cotizacion(text, uuid, text, text, numeric, numeric, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_evento_cms_cotizacion(text, uuid, text, text, numeric, numeric, jsonb, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_eventos_cms_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  es_cms boolean;
  res text;
BEGIN
  es_cms := (
    coalesce(NEW.landing_path, '') = '/comercial'
    OR coalesce(NEW.campaign, '') LIKE 'pwa-%'
  );
  IF NOT es_cms THEN
    RETURN NEW;
  END IF;

  res := public.emit_evento_cms_cotizacion(
    TG_OP,
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.numero ELSE NULL END,
    NEW.numero,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.precio_total_ofertado ELSE NULL END,
    NEW.precio_total_ofertado,
    NEW.productos,
    NEW.tipo_solicitud,
    NEW.origen
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eventos_cms_cotizacion ON public.solicitudes_cotizacion;
CREATE TRIGGER trg_eventos_cms_cotizacion
  AFTER INSERT OR UPDATE OF numero, precio_total_ofertado, landing_path, campaign
  ON public.solicitudes_cotizacion
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_eventos_cms_cotizacion();
