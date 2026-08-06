-- Datos fiscales, logísticos y documentación comercial de la oferta.
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS nit TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS responsable_iva BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS direccion_envio TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS direccion_facturacion TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS adjuntos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Documentos de oferta: privados, solo accesibles a roles comerciales autorizados.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('cotizaciones-adjuntos', 'cotizaciones-adjuntos', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cotizaciones_adjuntos_ventas_select" ON storage.objects;
CREATE POLICY "cotizaciones_adjuntos_ventas_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cotizaciones-adjuntos'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );

DROP POLICY IF EXISTS "cotizaciones_adjuntos_ventas_insert" ON storage.objects;
CREATE POLICY "cotizaciones_adjuntos_ventas_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cotizaciones-adjuntos'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );

DROP POLICY IF EXISTS "cotizaciones_adjuntos_ventas_delete" ON storage.objects;
CREATE POLICY "cotizaciones_adjuntos_ventas_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cotizaciones-adjuntos'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );
