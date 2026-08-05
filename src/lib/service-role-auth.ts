/**
 * Mirror of supabase/functions/_shared/service-role-auth.ts for vitest CI.
 * Keep both in sync: service_role auth must be exact key match only.
 */

export function isExactServiceRoleToken(
  token: string,
  serviceKey: string | null | undefined
): boolean {
  return Boolean(serviceKey && token === serviceKey);
}

export function extractBearerToken(authHeader: string | null | undefined): string {
  return (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
}
