-- CMS P0/P1 hardening: RLS shares, audit, last_login RPC, propuestas admin

-- 1) commercial_shares: solo admin/owner UPDATE desde cliente.
--    Edge comercial-share usa service_role (bypass RLS).
DROP POLICY IF EXISTS "commercial_shares_update" ON commercial_shares;
CREATE POLICY "commercial_shares_update_admin"
  ON commercial_shares FOR UPDATE
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin']))
  WITH CHECK (is_admin(ARRAY['owner', 'admin']));

-- 2) audit log: no insertar desde cliente (solo service_role / Edge)
DROP POLICY IF EXISTS "commercial_audit_log_insert_own" ON commercial_audit_log;

-- 3) last_login_at: RPC SECURITY DEFINER (ventas no puede UPDATE self vía RLS)
CREATE OR REPLACE FUNCTION public.touch_admin_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_profiles
  SET last_login_at = now()
  WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.touch_admin_last_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_admin_last_login() TO authenticated;

-- 4) articulos_propuestos: admins leen/moderan
DROP POLICY IF EXISTS "articulos_propuestos_admin_select" ON articulos_propuestos;
CREATE POLICY "articulos_propuestos_admin_select"
  ON articulos_propuestos FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin', 'catalogo']));

DROP POLICY IF EXISTS "articulos_propuestos_admin_update" ON articulos_propuestos;
CREATE POLICY "articulos_propuestos_admin_update"
  ON articulos_propuestos FOR UPDATE
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin', 'catalogo']))
  WITH CHECK (is_admin(ARRAY['owner', 'admin', 'catalogo']));

DROP POLICY IF EXISTS "articulos_propuestos_admin_delete" ON articulos_propuestos;
CREATE POLICY "articulos_propuestos_admin_delete"
  ON articulos_propuestos FOR DELETE
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin', 'catalogo']));
