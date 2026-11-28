-- Auditoría de seguridad 2026-11-28 — endurecimiento NO destructivo (no borra datos).
--
-- H1 (alta, verificado en prod): `cotizaciones_insert_public` (INSERT TO anon,
-- authenticated WITH CHECK true) seguía activa: la migración 20261019120000
-- eliminó otra política con nombre distinto. Además las políticas
-- `cotizaciones_ventas_*` solo exigían created_by = auth.uid(), algo que cumple
-- cualquier usuario que se registre por OTP en /cuenta. Un no-staff podía crear
-- o editar una cotización con estado, precios y token de formalización propios.
-- La web pública registra cotizaciones vía Edge Function (service_role) y el CMS
-- comercial con usuarios `ventas`/`admin`/`owner`, así que nada legítimo depende
-- de esas rutas abiertas (comprobado: 0 cotizaciones creadas por no-staff).
--
-- Rollback: recrear las cuatro políticas con su definición anterior (ver
-- 20261019120000 y 20260705000000); no hay cambios de datos que revertir.

DROP POLICY IF EXISTS cotizaciones_insert_public ON public.solicitudes_cotizacion;

DROP POLICY IF EXISTS cotizaciones_ventas_insert_authenticated ON public.solicitudes_cotizacion;
CREATE POLICY cotizaciones_ventas_insert_authenticated ON public.solicitudes_cotizacion
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT public.is_comercial_user()) AND created_by = (SELECT auth.uid()))
    OR (SELECT public.is_admin(ARRAY['owner', 'admin']))
  );

DROP POLICY IF EXISTS cotizaciones_ventas_update_own ON public.solicitudes_cotizacion;
CREATE POLICY cotizaciones_ventas_update_own ON public.solicitudes_cotizacion
  FOR UPDATE TO authenticated
  USING (
    ((SELECT public.is_comercial_user()) AND created_by = (SELECT auth.uid()))
    OR (SELECT public.is_admin(ARRAY['owner', 'admin']))
  )
  WITH CHECK (
    ((SELECT public.is_comercial_user()) AND created_by = (SELECT auth.uid()))
    OR (SELECT public.is_admin(ARRAY['owner', 'admin']))
  );

DROP POLICY IF EXISTS cotizaciones_ventas_select_own ON public.solicitudes_cotizacion;
CREATE POLICY cotizaciones_ventas_select_own ON public.solicitudes_cotizacion
  FOR SELECT TO authenticated
  USING (
    ((SELECT public.is_comercial_user()) AND created_by = (SELECT auth.uid()))
    OR (SELECT public.is_admin(ARRAY['owner', 'admin']))
  );

-- Advisor 0028: funciones SECURITY DEFINER de administración ejecutables por
-- anon. Ya validan is_admin() dentro; se retira EXECUTE a anon como defensa en
-- profundidad. authenticated (CMS) conserva el permiso.
REVOKE EXECUTE ON FUNCTION public.merge_proveedores(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publicar_landing(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restaurar_version_landing(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_proveedores(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publicar_landing(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restaurar_version_landing(uuid, integer)
  TO authenticated, service_role;

-- Advisor 0011: search_path mutable (funciones SECURITY INVOKER). La extensión
-- vector vive en public, así que el comportamiento no cambia.
ALTER FUNCTION public._cotizacion_huella(public.solicitudes_cotizacion)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.match_productos(public.vector, integer, jsonb)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.producto_fuente_hash(public.productos)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.productos_invalidar_embedding()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_bloquear_envio_sin_aprobacion()
  SET search_path = public, pg_temp;
