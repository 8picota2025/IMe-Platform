-- Allow ventas/admin to assign quote numbers on save (SECURITY DEFINER RPC).
-- claim_cotizacion_send stays service_role-only (send path).

GRANT EXECUTE ON FUNCTION ensure_cotizacion_numero(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION next_cotizacion_numero() TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE cotizacion_numero_seq TO authenticated;
