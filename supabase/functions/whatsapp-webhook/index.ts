/**
 * Edge Function `whatsapp-webhook` — WhatsApp Cloud API (Meta).
 *
 * GET: verificación hub.mode / hub.verify_token / hub.challenge.
 * POST: inbound messages + statuses. Firma X-Hub-Signature-256 si
 * WHATSAPP_APP_SECRET está configurado. Reply IMEIA (catálogo + guardrails,
 * ack + wake a Ayuda Local; respuesta completa fuera de Edge `/{phone-number-id}/messages`.
 *
 * Secretos: WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_TOKEN,
 * WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION.
 * Docs: docs/WHATSAPP_CLOUD_API.md
 */

import { handleCors } from '../_shared/cors.ts';
import { badRequest, unauthorized } from '../_shared/errors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { trackEvent, withTelemetry } from '../_shared/telemetry.ts';
import {
  markWamidStatus,
  memoryWamidStoreFallback,
  SupabaseWamidStore,
} from '../_shared/whatsapp-wamid-store.ts';
import {
  decideWhatsAppInbound,
  detectarLocaleWhatsApp,
  markWhatsAppMessageRead,
  parseWhatsAppWebhook,
  resolveWhatsAppGraphConfig,
  sendWhatsAppText,
  verifyWhatsAppChallenge,
  verifyWhatsAppSignature,
  type WamidClaimStore,
} from '../../../src/lib/whatsapp-cloud.ts';
import { IME_WHATSAPP_E164 } from '../../../src/lib/contacto-oficial.ts';

const FN_NAME = 'whatsapp-webhook';

function textResponse(body: string, status = 200, contentType = 'text/plain'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': `${contentType}; charset=utf-8` },
  });
}

function jsonOk(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function readChallengeParams(url: URL) {
  return {
    mode: url.searchParams.get('hub.mode'),
    token: url.searchParams.get('hub.verify_token'),
    challenge: url.searchParams.get('hub.challenge'),
  };
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;

    if (req.method === 'GET') {
      const expectedToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')?.trim() ?? '';
      const verified = verifyWhatsAppChallenge({
        ...readChallengeParams(new URL(req.url)),
        expectedToken,
      });
      if (!verified.ok) {
        void trackEvent(
          FN_NAME,
          'webhook_verify_rechazado',
          { motivo: 'token' },
          { nivel: 'warn' }
        );
        return unauthorized(origin);
      }
      return textResponse(verified.challenge);
    }

    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    const rawBody = await req.text();
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')?.trim() ?? '';
    if (appSecret) {
      const signature = req.headers.get('x-hub-signature-256');
      const valid = await verifyWhatsAppSignature(rawBody, signature, appSecret);
      if (!valid) {
        void trackEvent(
          FN_NAME,
          'webhook_rechazado',
          { motivo: 'firma_invalida' },
          { nivel: 'warn' }
        );
        return unauthorized(origin);
      }
    } else {
      console.warn('[whatsapp-webhook] WHATSAPP_APP_SECRET no configurado: se omite firma');
    }

    let payload: unknown;
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return badRequest('JSON invalido', origin);
    }

    const parsed = parseWhatsAppWebhook(payload);
    let store: WamidClaimStore = memoryWamidStoreFallback();
    let supabase: ReturnType<typeof getServerSupabase> | null = null;
    try {
      supabase = getServerSupabase();
      store = new SupabaseWamidStore(supabase);
    } catch (err) {
      console.warn(
        '[whatsapp-webhook] Supabase no disponible; idempotencia en memoria:',
        err instanceof Error ? err.message : err
      );
    }

    let decisions;
    try {
      decisions = await decideWhatsAppInbound(parsed, store, {
        ownWaId: IME_WHATSAPP_E164,
      });
    } catch (err) {
      console.warn(
        '[whatsapp-webhook] idempotencia persistente falló; memoria:',
        err instanceof Error ? err.message : err
      );
      store = memoryWamidStoreFallback();
      decisions = await decideWhatsAppInbound(parsed, store, {
        ownWaId: IME_WHATSAPP_E164,
      });
    }

    const graph = resolveWhatsAppGraphConfig({
      WHATSAPP_TOKEN: Deno.env.get('WHATSAPP_TOKEN'),
      WHATSAPP_PHONE_NUMBER_ID: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
      WHATSAPP_API_VERSION: Deno.env.get('WHATSAPP_API_VERSION'),
    });

    let replied = 0;
    let ignored = 0;

    for (const decision of decisions) {
      if (decision.action === 'ignore') {
        ignored += 1;
        continue;
      }

      const message = decision.message;
      const wamidExtra: { fromWa?: string; phoneNumberId?: string } = { fromWa: message.from };
      if (message.phoneNumberId) wamidExtra.phoneNumberId = message.phoneNumberId;
      if (supabase) {
        const limit = await checkRateLimit(supabase, `whatsapp:wa:${message.from}`, 'whatsapp');
        if (limit.limited) {
          await markWamidStatus(supabase, message.wamid, 'rate_limited', wamidExtra);
          ignored += 1;
          continue;
        }
      }

      if (graph) {
        void markWhatsAppMessageRead({
          wamid: message.wamid,
          token: graph.token,
          phoneNumberId: graph.phoneNumberId,
          apiVersion: graph.apiVersion,
        });
      }

      // Brain = Ayuda Local (Cursor/Grok) via wake webhook — not Hermes / Edge LLM.
      const locale = detectarLocaleWhatsApp(message.text);
      if (supabase) {
        await markWamidStatus(supabase, message.wamid, 'pending_agent', wamidExtra);
      }

      if (graph) {
        const ackEs = 'Un momento, reviso su consulta…';
        const ackEn = 'One moment — checking your question…';
        void sendWhatsAppText({
          to: message.from,
          body: locale === 'en' ? ackEn : ackEs,
          token: graph.token,
          phoneNumberId: graph.phoneNumberId,
          apiVersion: graph.apiVersion,
        });
      }

      const wakeUrl = Deno.env.get('IMEIA_AGENT_WEBHOOK_URL')?.trim();
      const wakeKey = Deno.env.get('IMEIA_AGENT_WEBHOOK_KEY')?.trim();
      if (!wakeUrl || !wakeKey) {
        console.warn('[whatsapp-webhook] IMEIA_AGENT_WEBHOOK_URL/KEY ausentes: no wake');
        void trackEvent(FN_NAME, 'whatsapp_wake_missing', {}, { nivel: 'warn' });
        ignored += 1;
        continue;
      }

      try {
        const wakeRes = await fetch(wakeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${wakeKey}`,
            'X-Webhook-Key': wakeKey,
          },
          body: JSON.stringify({
            source: 'whatsapp-cloud',
            channel: 'imeia',
            from: message.from,
            text: message.text,
            wamid: message.wamid,
            phone_number_id: message.phoneNumberId ?? graph?.phoneNumberId ?? null,
            locale,
            received_at: new Date().toISOString(),
          }),
        });
        if (!wakeRes.ok) {
          console.error('[whatsapp-webhook] wake HTTP', wakeRes.status);
          void trackEvent(
            FN_NAME,
            'whatsapp_wake_failed',
            { status: wakeRes.status },
            { nivel: 'warn' }
          );
        } else {
          replied += 1; // queued for agent reply
        }
      } catch (err) {
        console.error(
          '[whatsapp-webhook] wake error:',
          err instanceof Error ? err.message : err
        );
      }
    }

    return jsonOk({
      ok: true,
      replied,
      ignored,
      statuses: parsed.statuses.length,
    });
  })
);
