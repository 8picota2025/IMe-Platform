/**
 * Auth admin para Edge Functions invocadas desde /admin (JWT) o service_role.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_ROLES = new Set(['owner', 'admin', 'ventas', 'operaciones']);

function isServiceRoleToken(token: string): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (serviceKey && token === serviceKey) return true;
  // Legacy JWT service_role (eyJ…) aunque el secret en Deno sea sb_secret_…
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export async function requireAdmin(
  supabase: SupabaseClient,
  authHeader: string | null,
  roles: Set<string> = DEFAULT_ROLES
): Promise<{ ok: true; userId: string | null; email: string | null } | { ok: false }> {
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false };

  if (isServiceRoleToken(token)) {
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
