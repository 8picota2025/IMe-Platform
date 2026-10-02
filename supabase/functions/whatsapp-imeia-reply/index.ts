import { getServerSupabase } from '../_shared/supabase-server.ts';
import { replyToWhatsAppBatch } from '../_shared/whatsapp-reply.ts';
import {
  resolveWhatsAppGraphConfig,
  timingSafeEqualString,
} from '../../../src/lib/whatsapp-cloud.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const secrets = [
    Deno.env.get('IMEIA_AGENT_WEBHOOK_KEY'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  ];
  if (!bearer || !secrets.some(secret => secret && timingSafeEqualString(bearer, secret)))
    return new Response(null, { status: 401 });
  const input = await req.json().catch(() => null);
  if (
    typeof input?.claim_token !== 'string' ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.claim_token) ||
    typeof input?.body !== 'string' ||
    !input.body.trim() ||
    input.body.length > 4096
  )
    return new Response(null, { status: 400 });
  const graph = resolveWhatsAppGraphConfig({
    WHATSAPP_TOKEN: Deno.env.get('WHATSAPP_TOKEN'),
    WHATSAPP_PHONE_NUMBER_ID: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
    WHATSAPP_API_VERSION: Deno.env.get('WHATSAPP_API_VERSION'),
  });
  if (!graph) return new Response(null, { status: 503 });
  try {
    const result = await replyToWhatsAppBatch(
      getServerSupabase(),
      graph,
      input.claim_token,
      input.body.trim()
    );
    return Response.json({ ok: result.ok }, { status: result.status });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
});
