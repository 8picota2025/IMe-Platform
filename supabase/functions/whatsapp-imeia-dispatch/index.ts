/**
 * Edge Function `whatsapp-imeia-dispatch`.
 *
 * La llama pg_cron cada minuto (ver docs/WHATSAPP_CLOUD_API.md).
 * Responde 202 y sigue en waitUntil: pg_net corta a los 5 s y un wake
 * puede tardar más. Auth: Bearer igual al token de whatsapp_dispatch_auth
 * o a SUPABASE_SERVICE_ROLE_KEY, comparado en tiempo constante.
 * verify_jwt = false, así que un JWT sin firma con role=service_role no vale.
 */

import { unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { despacharWhatsAppImeia, edgeWaitUntil } from '../_shared/whatsapp-dispatch.ts';
import {
  resolveWhatsAppGraphConfig,
  timingSafeEqualString,
} from '../../../src/lib/whatsapp-cloud.ts';

function bearerToken(req: Request): string {
  const auth = req.headers.get('Authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

function coincideSecreto(bearer: string, secreto: string): boolean {
  if (!bearer || !secreto) return false;
  return timingSafeEqualString(bearer, secreto);
}

async function tokenCron(): Promise<string> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('whatsapp_dispatch_auth')
    .select('token')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('[whatsapp-imeia-dispatch] no se pudo leer el token de cron');
    return '';
  }
  const token = data && typeof data.token === 'string' ? data.token : '';
  return token;
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

  const bearer = bearerToken(req);
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
  let permitido = coincideSecreto(bearer, service);
  if (!permitido) {
    try {
      permitido = coincideSecreto(bearer, await tokenCron());
    } catch (err) {
      console.error('[whatsapp-imeia-dispatch] auth', err instanceof Error ? err.message : 'error');
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  if (!permitido) return unauthorized(null);

  const trabajo = (async () => {
    const supabase = getServerSupabase();
    const graph = resolveWhatsAppGraphConfig({
      WHATSAPP_TOKEN: Deno.env.get('WHATSAPP_TOKEN'),
      WHATSAPP_PHONE_NUMBER_ID: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
      WHATSAPP_API_VERSION: Deno.env.get('WHATSAPP_API_VERSION'),
    });
    return despacharWhatsAppImeia({
      supabase,
      graph,
      wakeUrl: Deno.env.get('IMEIA_AGENT_WEBHOOK_URL')?.trim() ?? null,
      wakeKey: Deno.env.get('IMEIA_AGENT_WEBHOOK_KEY')?.trim() ?? null,
      wakes: true,
      holdings: true,
    });
  })().catch(err => {
    console.error('[whatsapp-imeia-dispatch]', err instanceof Error ? err.message : err);
    return { wakes: 0, holdings: 0 };
  });

  const waitUntil = edgeWaitUntil();
  if (waitUntil) {
    waitUntil(trabajo);
    return new Response(JSON.stringify({ ok: true, scheduled: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resultado = await trabajo;
  return new Response(JSON.stringify({ ok: true, ...resultado }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
