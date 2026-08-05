/**
 * Auth service_role para Edge Functions.
 *
 * Solo acepta igualdad exacta con SUPABASE_SERVICE_ROLE_KEY.
 * Nunca decodificar un JWT y confiar en `role === 'service_role'` sin verificar
 * firma: con verify_jwt=false (claves sb_secret_*) eso es bypass público.
 */

export function isExactServiceRoleToken(
  token: string,
  serviceKey: string | null | undefined = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
): boolean {
  return Boolean(serviceKey && token === serviceKey);
}

export function extractBearerToken(authHeader: string | null | undefined): string {
  return (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
}
