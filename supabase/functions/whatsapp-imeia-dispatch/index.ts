/**
 * Edge Function `whatsapp-imeia-dispatch`.
 *
 * La llama pg_cron cada minuto (ver docs/WHATSAPP_CLOUD_API.md).
 * Reclama lotes en silencio, despierta al agente una vez por remitente
 * y envía el mensaje de espera si el pendiente ya superó un minuto.
 * Auth: Bearer service_role. verify_jwt = true.
 */

import { unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { despacharWhatsAppImeia } from '../_shared/whatsapp-dispatch.ts';
import { resolveWhatsAppGraphConfig } from '../../../src/lib/whatsapp-cloud.ts';

function jwtRole(bearer: string): string | null {
  try {
    const part = bearer.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: string };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function authorized(req: Request): boolean {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!bearer) return false;
  if (service && bearer === service) return true;
  return jwtRole(bearer) === 'service_role';
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'Metodo no soportado' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!authorized(req)) return unauthorized(null);

  try {
    const supabase = getServerSupabase();
    const graph = resolveWhatsAppGraphConfig({
      WHATSAPP_TOKEN: Deno.env.get('WHATSAPP_TOKEN'),
      WHATSAPP_PHONE_NUMBER_ID: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
      WHATSAPP_API_VERSION: Deno.env.get('WHATSAPP_API_VERSION'),
    });
    const resultado = await despacharWhatsAppImeia({
      supabase,
      graph,
      wakeUrl: Deno.env.get('IMEIA_AGENT_WEBHOOK_URL')?.trim() ?? null,
      wakeKey: Deno.env.get('IMEIA_AGENT_WEBHOOK_KEY')?.trim() ?? null,
      wakes: true,
      holdings: true,
    });
    return new Response(JSON.stringify({ ok: true, ...resultado }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[whatsapp-imeia-dispatch]', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
