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
  isOwnBusinessNumber,
  markWhatsAppMessageRead,
  parseWhatsAppWebhook,
  resolveWhatsAppGraphConfig,
  verifyWhatsAppChallenge,
  verifyWhatsAppSignature,
} from '../../../src/lib/whatsapp-cloud.ts';
import { IME_WHATSAPP_E164 } from '../../../src/lib/contacto-oficial.ts';
import { edgeWaitUntil, seguirTurnoWhatsApp } from '../_shared/whatsapp-dispatch.ts';
import { contactoEstaPausado, registrarEcoManual } from '../_shared/whatsapp-echo.ts';
import { auditWhatsAppDrop, ingestWhatsAppMessage } from '../_shared/whatsapp-ingest.ts';

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
    // A 200 is only returned after durable persistence. Meta retries a 503.
    let supabase: ReturnType<typeof getServerSupabase>;
    try {
      supabase = getServerSupabase();
    } catch {
      return jsonOk({ ok: false, error: 'storage_unavailable' }, 503);
    }

    const graph = resolveWhatsAppGraphConfig({
      WHATSAPP_TOKEN: Deno.env.get('WHATSAPP_TOKEN'),
      WHATSAPP_PHONE_NUMBER_ID: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),
      WHATSAPP_API_VERSION: Deno.env.get('WHATSAPP_API_VERSION'),
    });

    let queued = 0;
    let ignored = 0;
    let echoes = 0;
    const pendientes = new Set<string>();

    try {
      for (const ignoredEvent of parsed.ignored) {
        await auditWhatsAppDrop(supabase, ignoredEvent.reason, payload, ignoredEvent.wamid);
        ignored += 1;
      }
      for (const status of parsed.statuses) {
        await auditWhatsAppDrop(supabase, 'status_update', payload, status.wamid);
        ignored += 1;
      }
      for (const echo of parsed.echoes) {
        if (isOwnBusinessNumber(echo.waId, IME_WHATSAPP_E164)) {
          await auditWhatsAppDrop(supabase, 'own_number', payload, echo.wamid);
          ignored += 1;
          continue;
        }
        const result = await registrarEcoManual(supabase, { ...echo, raw: payload });
        if (result === 'duplicate') {
          await auditWhatsAppDrop(supabase, 'duplicate', payload, echo.wamid);
          ignored += 1;
        } else echoes += 1;
      }
      for (const message of parsed.texts) {
        let reason: string | null = message.isBot
          ? 'bot'
          : isOwnBusinessNumber(message.from, IME_WHATSAPP_E164)
            ? 'own_number'
            : null;
        if (!reason && !(await contactoEstaPausado(supabase, message.from))) {
          const limit = await checkRateLimit(supabase, `whatsapp:wa:${message.from}`, 'whatsapp');
          if (limit.limited) reason = 'rate_limited';
        }
        const result = await ingestWhatsAppMessage(supabase, message, payload, reason);
        if (result.status !== 'pending_agent') {
          ignored += 1;
          continue;
        }
        if (graph) void markWhatsAppMessageRead({ wamid: message.wamid, ...graph });
        pendientes.add(result.from_wa);
        queued += 1;
      }
    } catch {
      console.error('[whatsapp-webhook] persistence_failed; Meta must retry');
      return jsonOk({ ok: false, error: 'persistence_failed' }, 503);
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
      echoes,
      statuses: parsed.statuses.length,
    });
  })
);
