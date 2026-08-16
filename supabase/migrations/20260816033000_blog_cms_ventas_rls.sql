-- Blog CMS: ventas puede editar articulos + subir imagenes al bucket articulos.
-- catalogo/owner/admin ya podian (is_admin incluye owner/admin siempre).

-- articulos CRUD
DROP POLICY IF EXISTS "articulos_admin_all" ON articulos;
CREATE POLICY "articulos_admin_all"
  ON articulos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo', 'ventas']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'ventas']));

-- propuestas: ventas tambien modera
DROP POLICY IF EXISTS "articulos_propuestos_admin_select" ON articulos_propuestos;
CREATE POLICY "articulos_propuestos_admin_select"
  ON articulos_propuestos FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin', 'catalogo', 'ventas']));

DROP POLICY IF EXISTS "articulos_propuestos_admin_update" ON articulos_propuestos;
CREATE POLICY "articulos_propuestos_admin_update"
  ON articulos_propuestos FOR UPDATE
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin', 'catalogo', 'ventas']))
  WITH CHECK (is_admin(ARRAY['owner', 'admin', 'catalogo', 'ventas']));

DROP POLICY IF EXISTS "articulos_propuestos_admin_delete" ON articulos_propuestos;
CREATE POLICY "articulos_propuestos_admin_delete"
  ON articulos_propuestos FOR DELETE
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin', 'catalogo', 'ventas']));

-- Storage: separar articulos (catalogo+ventas) de productos/fichas (solo catalogo)
DROP POLICY IF EXISTS "storage_cms_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_cms_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_cms_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_articulos_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_articulos_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_articulos_delete" ON storage.objects;

CREATE POLICY "storage_cms_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('productos', 'fichas')
    AND is_admin(ARRAY['catalogo'])
  );

CREATE POLICY "storage_cms_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('productos', 'fichas')
    AND is_admin(ARRAY['catalogo'])
  )
  WITH CHECK (
    bucket_id IN ('productos', 'fichas')
    AND is_admin(ARRAY['catalogo'])
  );

CREATE POLICY "storage_cms_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('productos', 'fichas')
    AND is_admin(ARRAY['catalogo'])
  );

CREATE POLICY "storage_articulos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'articulos'
    AND is_admin(ARRAY['catalogo', 'ventas'])
  );

CREATE POLICY "storage_articulos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'articulos'
    AND is_admin(ARRAY['catalogo', 'ventas'])
  )
  WITH CHECK (
    bucket_id = 'articulos'
    AND is_admin(ARRAY['catalogo', 'ventas'])
  );

CREATE POLICY "storage_articulos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'articulos'
    AND is_admin(ARRAY['catalogo', 'ventas'])
  );
