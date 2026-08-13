/**
 * Captura telemetría autenticada y sin PII del portal /comercial.
 * El user_id se deriva del JWT; el cliente nunca puede elegirlo.
 */
import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { withTelemetry } from '../_shared/telemetry.ts';

const FN_NAME = 'comercial-usage';
const EVENTS = new Set([
  'login',
  'logout',
  'idle_logout',
  'view',
  'search',
  'filter',
  'product_selected',
  'share_modal_open',
  'share_submitted',
  'share_succeeded',
  'share_failed',
  'crm_retry',
  'pwa_install',
  'pwa_dismiss',
  'error',
]);
const ROLES = new Set(['ventas', 'admin', 'owner']);
const META_KEYS = new Set([
  'view',
  'channel',
  'result_count',
  'products_count',
  'product_slug',
  'status',
  'result',
  'crm_sync_status',
  'filter',
  'source',
  'error_code',
  'query_length',
]);

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
}

function cleanMetadata(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!META_KEYS.has(key)) continue;
    if (typeof raw === 'string') {
      const clean = raw.trim().slice(0, 220);
      if (clean) output[key] = clean;
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      output[key] = Math.max(0, Math.min(1000000, Math.round(raw)));
    } else if (typeof raw === 'boolean') {
      output[key] = raw;
    }
  }
  return output;
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const cors = handleCors(req);
    if (cors) return cors;
    if (req.method !== 'POST') return badRequest('POST only', origin);

    const auth = req.headers.get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return unauthorized(origin);

    const supabase = getServerSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return unauthorized(origin);

    const { data: profile, error: profileError } = await supabase
      .from('admin_profiles')
      .select('rol,activo')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (profileError) return internalError(profileError.message, origin);
    if (!profile || profile.activo === false || !ROLES.has(String(profile.rol))) {
      return unauthorized(origin);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const eventName = cleanText(body.event_name, 40);
    const sessionId = cleanText(body.session_id, 128);
    if (!eventName || !EVENTS.has(eventName) || !sessionId) {
      return badRequest('event_name o session_id invalido', origin);
    }

    const view = cleanText(body.view, 40);
    const metadata = cleanMetadata(body.metadata);
    const { error } = await supabase.from('commercial_usage_events').insert({
      user_id: authData.user.id,
      session_id: sessionId,
      event_name: eventName,
      view,
      metadata,
    });
    if (error) return internalError(error.message, origin);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  })
);
