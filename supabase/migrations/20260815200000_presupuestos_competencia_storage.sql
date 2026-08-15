-- Fotos de presupuestos competencia (OCR comercial) → storage privado.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'presupuestos-competencia',
    'presupuestos-competencia',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  )
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "presupuestos_comp_ventas_select" ON storage.objects;
CREATE POLICY "presupuestos_comp_ventas_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'presupuestos-competencia'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );

DROP POLICY IF EXISTS "presupuestos_comp_ventas_insert" ON storage.objects;
CREATE POLICY "presupuestos_comp_ventas_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'presupuestos-competencia'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );

DROP POLICY IF EXISTS "presupuestos_comp_service_all" ON storage.objects;
CREATE POLICY "presupuestos_comp_service_all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'presupuestos-competencia')
  WITH CHECK (bucket_id = 'presupuestos-competencia');
