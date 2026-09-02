-- Fix F-06 RBAC regression (20260830120000_cotizaciones_rbac_ventas.sql):
-- 1) cotizaciones_ventas_insert_public used WITH CHECK (true) for anon+authenticated,
--    reopening forged formalizable-quote minting (same class as cotizaciones_insert_public).
-- 2) cotizaciones_ventas_update_own allowed ANY authenticated user to UPDATE rows they
--    created_by — including escalating estado to enviada and setting token/precios —
--    then calling formalizar-cotizacion / crear-pago locked path for underpriced checkout.
--
-- Legitimate public web submissions use registrar-cotizacion (service_role, bypasses RLS).
-- Admin/comercial drafts insert+update with authenticated JWT + admin_profiles.

DROP POLICY IF EXISTS "cotizaciones_ventas_insert_public" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_insert_public" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_update_own" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_select_own" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_supervisor_all" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_admin_all" ON solicitudes_cotizacion;

-- No anon INSERT. Staff may insert drafts only (never a live formalizable offer).
CREATE POLICY "cotizaciones_ventas_insert"
  ON solicitudes_cotizacion FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(ARRAY['ventas'])
    AND estado = 'nueva'
    AND formalizacion_token_hash IS NULL
    AND formalizacion_token_expira_at IS NULL
    AND oferta_enviada_at IS NULL
    AND pedido_id IS NULL
  );

-- Horizontal isolation: ventas sees/edits own rows; owner/admin supervise all.
CREATE POLICY "cotizaciones_ventas_select_own"
  ON solicitudes_cotizacion FOR SELECT
  TO authenticated
  USING (
    public.is_admin(ARRAY['owner', 'admin'])
    OR (public.is_admin(ARRAY['ventas']) AND created_by = (SELECT auth.uid()))
  );

CREATE POLICY "cotizaciones_ventas_update_own"
  ON solicitudes_cotizacion FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(ARRAY['owner', 'admin'])
    OR (public.is_admin(ARRAY['ventas']) AND created_by = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_admin(ARRAY['owner', 'admin'])
    OR (public.is_admin(ARRAY['ventas']) AND created_by = (SELECT auth.uid()))
  );

CREATE POLICY "cotizaciones_supervisor_all"
  ON solicitudes_cotizacion FOR DELETE
  TO authenticated
  USING (public.is_admin(ARRAY['owner', 'admin']));
