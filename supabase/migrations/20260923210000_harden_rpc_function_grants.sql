-- Endurecimiento de funciones expuestas vía /rest/v1/rpc (avisos de seguridad
-- de Supabase, 2026-09-23). Por los privilegios por defecto del esquema
-- public, TODAS las funciones quedaban ejecutables por anon y authenticated,
-- incluidas funciones SECURITY DEFINER que ignoran RLS: cualquiera con la
-- clave pública podía reservar/consumir/liberar stock, crear contactos CRM,
-- consumir presupuesto LLM, marcar cotizaciones como enviadas o leer los
-- datos de contacto/webhook/api_config de proveedores.
--
-- Inventario de llamadores verificado antes de escribir esto (repo + BD):
-- - Edge Functions: todas usan getServerSupabase() → service_role.
-- - Navegador (anon): sólo las 4 búsquedas del asesor (src/lib/asesor.ts).
-- - App comercial (authenticated): ensure_cotizacion_numero
--   (src/comercial/quote-api.ts) y touch_admin_last_login
--   (src/comercial/comercial-app.ts).
-- - Políticas RLS: is_admin / is_comercial_user, sólo en políticas TO
--   authenticated; ninguna política de anon/public las usa.
-- - Ninguna columna DEFAULT, vista, política ni función SECURITY INVOKER usa
--   las funciones que se cierran. Las llamadas anidadas desde otras funciones
--   SECURITY DEFINER corren como su dueño y no dependen de estos grants, y
--   los triggers no comprueban EXECUTE al dispararse.

-- ── 1. Sólo service_role (Edge Functions) ────────────────────────────────
REVOKE ALL ON FUNCTION public.claim_cotizacion_send(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consumir_stock_reservas_pedido(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_upsert_contact(uuid, uuid, text, text, text, text, text, boolean, timestamp with time zone, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_proveedor_para_producto(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liberar_stock_reservas_expiradas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liberar_stock_reservas_pedido(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_cotizacion_numero() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_presupuesto_llm(text, numeric, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reservar_stock(uuid, integer, uuid, integer, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_cotizacion_send(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consumir_stock_reservas_pedido(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_upsert_contact(uuid, uuid, text, text, text, text, text, boolean, timestamp with time zone, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_proveedor_para_producto(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.liberar_stock_reservas_expiradas() TO service_role;
GRANT EXECUTE ON FUNCTION public.liberar_stock_reservas_pedido(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_cotizacion_numero() TO service_role;
GRANT EXECUTE ON FUNCTION public.reservar_presupuesto_llm(text, numeric, numeric, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reservar_stock(uuid, integer, uuid, integer, text) TO service_role;

-- ── 2. Funciones de trigger: nadie las llama por RPC ────────────────────
REVOKE ALL ON FUNCTION public.crm_link_cotizacion_to_lead() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_link_pedido_to_cotizacion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_reflect_opportunity_on_lead() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_sync_from_cotizacion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_sync_from_lead_comercial() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_sync_from_pedido() FROM PUBLIC, anon, authenticated;

-- ── 3. Sólo usuarios con sesión (políticas RLS y app comercial) ─────────
-- is_admin / is_comercial_user sólo informan del rol del propio llamador;
-- las políticas TO authenticated las necesitan. anon no las usa.
REVOKE ALL ON FUNCTION public.is_admin(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_comercial_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_admin_last_login() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_cotizacion_numero(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_comercial_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_admin_last_login() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_cotizacion_numero(uuid) TO authenticated, service_role;

-- ensure_cotizacion_numero no comprobaba quién la llamaba: cualquier usuario
-- (antes incluso anon) con el UUID de una cotización le asignaba número. La
-- usan las Edge Functions (service_role) y la app comercial (ventas/admin/
-- owner). Mismo cuerpo que antes más la comprobación.
CREATE OR REPLACE FUNCTION public.ensure_cotizacion_numero(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_num TEXT;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR is_comercial_user()) THEN
    RAISE EXCEPTION 'ensure_cotizacion_numero: requiere rol comercial'
      USING ERRCODE = '42501';
  END IF;

  SELECT numero INTO current_num
  FROM solicitudes_cotizacion
  WHERE id = p_id
  FOR UPDATE;

  IF current_num IS NOT NULL AND btrim(current_num) <> '' THEN
    RETURN current_num;
  END IF;

  UPDATE solicitudes_cotizacion
  SET numero = next_cotizacion_numero()
  WHERE id = p_id AND (numero IS NULL OR btrim(numero) = '')
  RETURNING numero INTO current_num;

  RETURN current_num;
END;
$function$;

-- ── 4. search_path fijo (aviso function_search_path_mutable) ────────────
ALTER FUNCTION public.get_proveedor_para_producto(uuid) SET search_path = public;
ALTER FUNCTION public.update_productos_tsv() SET search_path = public;
ALTER FUNCTION public.trigger_set_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at_producto_claims_evidencia() SET search_path = public;
ALTER FUNCTION public.set_updated_at_whatsapp_opt_ins() SET search_path = public;

-- ── Se mantienen públicas a propósito ───────────────────────────────────
-- match_productos, buscar_productos_keyword, match_articulos,
-- buscar_articulos_keyword: el asesor las llama desde el navegador y sólo
-- devuelven productos activos / artículos publicados (datos públicos).
-- rls_auto_enable: función de event trigger gestionada por Supabase; no es
-- invocable por RPC y no se toca.
