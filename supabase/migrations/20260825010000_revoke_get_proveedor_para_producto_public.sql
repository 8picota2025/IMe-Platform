-- get_proveedor_para_producto is SECURITY DEFINER and returns supplier
-- webhook_url + api_config (auth headers). Postgres defaults EXECUTE to PUBLIC,
-- so anon/authenticated could call it via PostgREST with the public anon key
-- and bypass RLS on proveedores.
-- Mirror reservar_presupuesto_llm: Edge-only (service_role).

REVOKE ALL ON FUNCTION public.get_proveedor_para_producto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_proveedor_para_producto(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_proveedor_para_producto(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_proveedor_para_producto(uuid) TO service_role;
