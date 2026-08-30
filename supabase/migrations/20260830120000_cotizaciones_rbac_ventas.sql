-- F-06: aislamiento horizontal de cotizaciones para rol ventas.
-- Supervisión owner/admin conserva bandeja completa; ventas solo filas propias.

ALTER TABLE solicitudes_cotizacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cotizaciones_admin_all" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_select_own" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_insert_public" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_update_own" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_supervisor_all" ON solicitudes_cotizacion;

CREATE POLICY "cotizaciones_ventas_insert_public"
  ON solicitudes_cotizacion FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "cotizaciones_ventas_select_own"
  ON solicitudes_cotizacion FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR public.is_admin(ARRAY['owner', 'admin'])
  );

CREATE POLICY "cotizaciones_ventas_update_own"
  ON solicitudes_cotizacion FOR UPDATE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR public.is_admin(ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR public.is_admin(ARRAY['owner', 'admin'])
  );

CREATE POLICY "cotizaciones_supervisor_all"
  ON solicitudes_cotizacion FOR DELETE
  TO authenticated
  USING (public.is_admin(ARRAY['owner', 'admin']));
