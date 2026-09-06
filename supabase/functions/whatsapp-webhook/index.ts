/**
 * Edge Function `whatsapp-webhook` — WhatsApp Cloud API (Meta).
 *
 * GET: verificación hub.mode / hub.verify_token / hub.challenge.
 * POST: inbound messages + statuses. Firma X-Hub-Signature-256 si
 * WHATSAPP_APP_SECRET está configurado. Reply IMEIA (catálogo + guardrails,
 * sin SOUL Hermes) vía Graph API `/{phone-number-id}/messages`.
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
import { composeImeiaWhatsAppReply } from '../_shared/whatsapp-imeia.ts';
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

      const locale = detectarLocaleWhatsApp(message.text);
      const reply = await composeImeiaWhatsAppReply({
        mensaje: message.text,
        locale,
        supabase,
      });

      if (!graph) {
        console.warn('[whatsapp-webhook] WHATSAPP_TOKEN/PHONE_NUMBER_ID ausentes: no se envía');
        if (supabase) {
          await markWamidStatus(supabase, message.wamid, 'send_failed', wamidExtra);
        }
        continue;
      }

      const sent = await sendWhatsAppText({
        to: message.from,
        body: reply.texto,
        token: graph.token,
        phoneNumberId: graph.phoneNumberId,
        apiVersion: graph.apiVersion,
      });

      if (supabase) {
        await markWamidStatus(
          supabase,
          message.wamid,
          sent.ok ? 'replied' : 'send_failed',
          wamidExtra
        );
      }

      if (sent.ok) {
        replied += 1;
      } else {
        console.error('[whatsapp-webhook] Graph send falló:', sent.error);
        void trackEvent(
          FN_NAME,
          'whatsapp_send_failed',
          { status: sent.status ?? 0 },
          { nivel: 'warn' }
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
