/**
 * Auth admin para Edge Functions invocadas desde /admin (JWT) o service_role.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractBearerToken, isExactServiceRoleToken } from './service-role-auth.ts';

const DEFAULT_ROLES = new Set(['owner', 'admin', 'ventas', 'operaciones']);

export async function requireAdmin(
  supabase: SupabaseClient,
  authHeader: string | null,
  roles: Set<string> = DEFAULT_ROLES
): Promise<{ ok: true; userId: string | null; email: string | null } | { ok: false }> {
  const token = extractBearerToken(authHeader);
  if (!token) return { ok: false };

  if (isExactServiceRoleToken(token)) {
    return { ok: true, userId: null, email: null };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) return { ok: false };

  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('rol, activo')
    .eq('user_id', user.id)
    .maybeSingle();
  const p = profile as { rol?: string; activo?: boolean } | null;
  if (!p?.activo || !roles.has(p.rol ?? '')) return { ok: false };
  return { ok: true, userId: user.id, email: user.email ?? null };
}
