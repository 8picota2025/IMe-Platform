/**
 * Edge Function `whatsapp-webhook` — WhatsApp Cloud API (Meta).
 *
 * GET: verificación hub.mode / hub.verify_token / hub.challenge.
 * POST: inbound messages + statuses. Firma X-Hub-Signature-256 si
 * WHATSAPP_APP_SECRET está configurado. Guarda el texto y deja el wake
 * (y el mensaje de espera, si pasa un minuto) a un despacho por remitente.
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
  markWhatsAppMessageRead,
  parseWhatsAppWebhook,
  resolveWhatsAppGraphConfig,
  verifyWhatsAppChallenge,
  verifyWhatsAppSignature,
  type WamidClaimStore,
} from '../../../src/lib/whatsapp-cloud.ts';
import { IME_WHATSAPP_E164 } from '../../../src/lib/contacto-oficial.ts';
import { edgeWaitUntil, seguirTurnoWhatsApp } from '../_shared/whatsapp-dispatch.ts';

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

    let queued = 0;
    let ignored = 0;
    const pendientes = new Set<string>();

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

      // El agente (fuera de esta función) lee los pending_agent y responde.
      // Aquí no se envía espera ni se despierta: una ráfaga sería N wakes.
      if (!supabase) {
        ignored += 1;
        continue;
      }
      await markWamidStatus(supabase, message.wamid, 'pending_agent', {
        ...wamidExtra,
        body: message.text,
      });
      pendientes.add(message.from);
      queued += 1;
    }

    if (supabase && pendientes.size > 0) {
      const seguimiento = seguirTurnoWhatsApp({
        supabase,
        graph,
        wakeUrl: Deno.env.get('IMEIA_AGENT_WEBHOOK_URL')?.trim() ?? null,
        wakeKey: Deno.env.get('IMEIA_AGENT_WEBHOOK_KEY')?.trim() ?? null,
        froms: [...pendientes],
      });
      const seguimientoSeguro = seguimiento.catch(err =>
        console.error('[whatsapp-webhook] seguimiento:', err instanceof Error ? err.message : err)
      );
      const waitUntil = edgeWaitUntil();
      if (waitUntil) waitUntil(seguimientoSeguro);
      else {
        console.warn('[whatsapp-webhook] sin EdgeRuntime.waitUntil; el cron despacha el turno');
        void seguimientoSeguro;
      }
      void trackEvent(FN_NAME, 'whatsapp_turno_encolado', { remitentes: pendientes.size });
    }

    return jsonOk({
      ok: true,
      queued,
      replied: 0,
      ignored,
      statuses: parsed.statuses.length,
    });
  })
);
