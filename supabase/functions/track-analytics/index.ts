/**
 * First-party marketing analytics.
 *
 * Public client sends non-PII events with anon Authorization; function writes
 * with service_role. Keep payload small and never store email/phone/name.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { withTelemetry } from '../_shared/telemetry.ts';

const FN_NAME = 'track-analytics';

type AnalyticsBody = Record<string, unknown>;

const PII_KEYS = new Set([
  'email',
  'telefono',
  'phone',
  'nombre',
  'name',
  'cliente',
  'address',
  'direccion',
  'documento',
  'nit',
]);

function cleanText(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
}

function cleanNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanInteger(value: unknown, min: number, max: number): number | null {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

function cleanProperties(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (PII_KEYS.has(normalizedKey)) continue;
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'string') out[key] = raw.slice(0, 500);
    else if (typeof raw === 'number' || typeof raw === 'boolean') out[key] = raw;
    else if (Array.isArray(raw))
      out[key] = raw.slice(0, 20).map(item => String(item).slice(0, 120));
  }
  return out;
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    const body = (await req.json().catch(() => ({}))) as AnalyticsBody;
    const eventName = cleanText(body['event_name'], 80);
    const sessionId = cleanText(body['session_id'], 80);
    if (!eventName || !sessionId)
      return badRequest('event_name y session_id son obligatorios', origin);

    const payload = {
      event_name: eventName,
      session_id: sessionId,
      page_path: cleanText(body['page_path'], 500),
      page_title: cleanText(body['page_title'], 300),
      referrer: cleanText(body['referrer'], 500),
      locale: cleanText(body['locale'], 12),
      device_type: cleanText(body['device_type'], 24),
      utm_source: cleanText(body['utm_source'], 120),
      utm_medium: cleanText(body['utm_medium'], 120),
      utm_campaign: cleanText(body['utm_campaign'], 160),
      utm_content: cleanText(body['utm_content'], 160),
      utm_term: cleanText(body['utm_term'], 160),
      duration_seconds: cleanInteger(body['duration_seconds'], 0, 24 * 60 * 60),
      scroll_depth: cleanInteger(body['scroll_depth'], 0, 100),
      value: cleanNumber(body['value']),
      item_count: cleanInteger(body['item_count'], 0, 9999),
      product_slug: cleanText(body['product_slug'], 220),
      search_term: cleanText(body['search_term'], 200),
      properties: cleanProperties(body['properties']),
    };

    const { error } = await getServerSupabase().from('analytics_eventos').insert(payload);
    if (error) return internalError(error.message, origin);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  })
);
