/**
 * Edge Function `whatsapp-webhook` — WhatsApp Cloud API (Meta).
 *
 * GET: verificación hub.mode / hub.verify_token / hub.challenge.
 * POST: inbound messages + statuses. Firma X-Hub-Signature-256 obligatoria
 * (`WHATSAPP_APP_SECRET`); sin secreto → 503. Idempotencia durable en
 * `whatsapp_inbound_events` (sin fallback memoria). Reply: ack Graph + wake
 * Ayuda Local (`IMEIA_AGENT_WEBHOOK_*`).
 *
 * Secretos: WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_TOKEN,
 * WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION.
 * Docs: docs/WHATSAPP_CLOUD_API.md
 */

import { handleCors } from '../_shared/cors.ts';
import { badRequest, serviceUnavailable, unauthorized } from '../_shared/errors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { trackEvent, withTelemetry } from '../_shared/telemetry.ts';
import { markWamidStatus, SupabaseWamidStore } from '../_shared/whatsapp-wamid-store.ts';
import {
  decideWhatsAppInbound,
  detectarLocaleWhatsApp,
  hasWhatsAppAppSecret,
  markWhatsAppMessageRead,
  parseWhatsAppWebhook,
  resolveWhatsAppGraphConfig,
  sendWhatsAppText,
  verifyWhatsAppChallenge,
  verifyWhatsAppSignature,
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
    // verify_jwt=false: App Secret HMAC is the only POST auth. Fail closed.
    if (!hasWhatsAppAppSecret(appSecret)) {
      console.error('[whatsapp-webhook] WHATSAPP_APP_SECRET ausente: POST rechazado');
      void trackEvent(
        FN_NAME,
        'webhook_rechazado',
        { motivo: 'secret_ausente' },
        { nivel: 'warn' }
      );
      return serviceUnavailable('WHATSAPP_APP_SECRET no configurado', origin);
    }
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

    let payload: unknown;
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return badRequest('JSON invalido', origin);
    }

    const parsed = parseWhatsAppWebhook(payload);
    let supabase: ReturnType<typeof getServerSupabase>;
    try {
      supabase = getServerSupabase();
    } catch (err) {
      console.error(
        '[whatsapp-webhook] Supabase no disponible (idempotencia requerida):',
        err instanceof Error ? err.message : err
      );
      void trackEvent(
        FN_NAME,
        'webhook_idempotencia_fallo',
        { motivo: 'supabase' },
        { nivel: 'warn' }
      );
      return serviceUnavailable('Idempotencia WhatsApp no disponible', origin);
    }
    const store = new SupabaseWamidStore(supabase);

    let decisions;
    try {
      decisions = await decideWhatsAppInbound(parsed, store, {
        ownWaId: IME_WHATSAPP_E164,
      });
    } catch (err) {
      // Do not fall back to in-memory claim: that re-processes DB-claimed wamids
      // and duplicates Graph ack + agent wake on Meta retries / partial failures.
      console.error(
        '[whatsapp-webhook] claim wamid falló:',
        err instanceof Error ? err.message : err
      );
      void trackEvent(
        FN_NAME,
        'webhook_idempotencia_fallo',
        { motivo: 'claim' },
        { nivel: 'warn' }
      );
      return serviceUnavailable('Idempotencia WhatsApp no disponible', origin);
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
      const limit = await checkRateLimit(supabase, `whatsapp:wa:${message.from}`, 'whatsapp');
      if (limit.limited) {
        await markWamidStatus(supabase, message.wamid, 'rate_limited', wamidExtra);
        ignored += 1;
        continue;
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
      await markWamidStatus(supabase, message.wamid, 'pending_agent', {
        ...wamidExtra,
        body: message.text,
      });

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
        console.error('[whatsapp-webhook] wake error:', err instanceof Error ? err.message : err);
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
