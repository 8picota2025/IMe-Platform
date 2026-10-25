/**
 * Ingesta y consulta de inteligencia de precios.
 *
 * Auth:
 * - JWT de un admin CMS (owner, admin, ventas, operaciones, catálogo)
 * - service_role
 * - header `x-ime-price-ingest-key` o Bearer igual a PRICE_INTEL_INGEST_KEY
 *   (n8n, Hermes, scrapers). El secreto vive solo en la Edge Function.
 *
 * Los costos no salen de aquí hacia el sitio público: sin clave o sesión, 401.
 */
import { requireAdmin } from '../_shared/admin-auth.ts';
import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import {
  buildComparisons,
  emptyAssumptions,
  entryFromRow,
  parsePriceBatch,
  sanitizeIlike,
  selectBestPrice,
  type LandingAssumptions,
  type PriceEntry,
} from '../../../src/lib/price-intelligence.ts';

const ROLES = new Set(['owner', 'admin', 'ventas', 'operaciones', 'catalogo']);

function timingSafeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (!a.length || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function ingestAuthorized(req: Request): boolean {
  const expected = Deno.env.get('PRICE_INTEL_INGEST_KEY')?.trim() ?? '';
  if (!expected) return false;
  const header = req.headers.get('x-ime-price-ingest-key')?.trim() ?? '';
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return timingSafeEqual(header, expected) || timingSafeEqual(bearer, expected);
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assumptionsFrom(value: unknown): LandingAssumptions {
  if (!value || typeof value !== 'object') return emptyAssumptions();
  const row = value as Record<string, unknown>;
  return {
    trm: numberOrNull(row['trm']),
    freightPct: numberOrNull(row['freightPct']),
    dutyPct: numberOrNull(row['dutyPct']),
    marginPct: numberOrNull(row['marginPct']),
    stampPct: numberOrNull(row['stampPct']),
    applyStamp: row['applyStamp'] === true,
  };
}

function rowsOf(data: unknown): PriceEntry[] {
  if (!Array.isArray(data)) return [];
  return data
    .map(item =>
      item && typeof item === 'object' ? entryFromRow(item as Record<string, unknown>) : null
    )
    .filter((item): item is PriceEntry => item != null);
}

Deno.serve(async req => {
  const cors = handleCors(req);
  if (cors) return cors;
  const origin = req.headers.get('origin');

  try {
    const supabase = getServerSupabase();
    const admin = await requireAdmin(supabase, req.headers.get('authorization'), ROLES);
    if (!admin.ok && !ingestAuthorized(req)) return unauthorized(origin);

    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      const parsed = await req.json().catch(() => null);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return badRequest('El cuerpo debe ser un objeto JSON.', origin);
      }
      body = parsed as Record<string, unknown>;
    } else if (req.method !== 'GET') {
      return errorResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Usa GET o POST.' }, 405, origin);
    }

    const action = String(body['action'] ?? (req.method === 'GET' ? 'search' : '')).trim();
    const assumptions = assumptionsFrom(body['assumptions']);
    const q = sanitizeIlike(String(body['q'] ?? url.searchParams.get('q') ?? ''));
    const sourceType = String(
      body['source_type'] ?? url.searchParams.get('source_type') ?? ''
    ).trim();
    const currency = String(body['currency'] ?? url.searchParams.get('currency') ?? '')
      .trim()
      .toUpperCase();
    const invima = sanitizeIlike(
      String(body['invima_status'] ?? url.searchParams.get('invima_status') ?? '')
    );

    if (action === 'upsert' || action === 'batch') {
      const payload = action === 'upsert' ? (body['row'] ?? body) : body;
      const parsed = parsePriceBatch(payload);
      if (!parsed.ok) return badRequest(parsed.error, origin);
      const { data, error } = await supabase
        .from('market_price_entries')
        .upsert(parsed.rows, { onConflict: 'external_key' })
        .select(
          'id, external_key, equipment_name, model, source_type, currency, unit_cost_original'
        );
      if (error) return badRequest(error.message, origin);
      return json(
        { ok: true, upserted: data?.length ?? parsed.rows.length, rows: data ?? [] },
        200,
        origin
      );
    }

    if (action !== 'search' && action !== 'best' && action !== 'compare') {
      return badRequest('Acción no reconocida. Usa search, best, compare, upsert o batch.', origin);
    }

    let query = supabase
      .from('market_price_entries')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(action === 'search' ? 80 : 500);
    if (q) {
      query = query.or(
        `equipment_name.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%,supplier_or_source_name.ilike.%${q}%,category.ilike.%${q}%`
      );
    }
    if (sourceType) query = query.eq('source_type', sourceType);
    if (currency) query = query.eq('currency', currency);
    if (invima) query = query.ilike('invima_status', `%${invima}%`);

    const { data, error } = await query;
    if (error) return badRequest(error.message, origin);
    const entries = rowsOf(data);

    if (action === 'best') {
      const qty = numberOrNull(body['qty'] ?? url.searchParams.get('qty')) ?? 1;
      return json({ ok: true, ...selectBestPrice(entries, { qty, assumptions }) }, 200, origin);
    }
    if (action === 'compare') {
      return json({ ok: true, comparisons: buildComparisons(entries, assumptions) }, 200, origin);
    }
    return json({ ok: true, rows: entries }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error';
    return internalError(message, origin);
  }
});
