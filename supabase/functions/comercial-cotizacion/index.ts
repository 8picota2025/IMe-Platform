/**
 * CMS comercial: CRUD allowlist de cotizaciones sobre solicitudes_cotizacion.
 * Writes never go through PostgREST from /comercial.
 *
 * GET  /comercial-cotizacion                  list (?tab=pendientes|enviadas&equipo=1&q=&page=)
 * GET  /comercial-cotizacion?id=<uuid>        detail (allowlisted columns)
 * GET  /comercial-cotizacion?action=search&q= product typeahead (id,slug,sku,nombre_es)
 * GET  /comercial-cotizacion?action=pdf&id=   PDF base64 (stored or rendered)
 * POST /comercial-cotizacion                  save create/update
 * POST /comercial-cotizacion?action=duplicar  new row (duplicate-on-revise)
 * POST /comercial-cotizacion?action=validar-crm  admin validates → Twenty CRM
 * DELETE /comercial-cotizacion?id=            admin/owner delete quote
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import {
  badRequest,
  errorResponse,
  internalError,
  notFound,
  unauthorized,
} from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { withTelemetry } from '../_shared/telemetry.ts';
import { renderQuotePdf } from '../_shared/render-quote-pdf.ts';
import {
  buildQuoteAnnexes,
  loadQuotePdfFonts,
  loadQuotePdfLogo,
  loadQuotePdfWhatsappIcon,
} from '../_shared/quote-pdf-assets.ts';
import { bancoLineasCotizacion } from '../_shared/transferencia-bancaria.ts';
import { syncCotizacionOfertaWithTwenty } from '../_shared/twenty-crm.ts';
import {
  calcularTotalOfertado,
  COTIZACION_ESTADOS_ENVIADAS,
  COTIZACION_ESTADOS_PENDIENTES,
  normalizarMonedaOferta,
  ofertaCompleta,
  parseLineasOferta,
  quoteEditable,
  sanitizarLineasComercial,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';

const FN_NAME = 'comercial-cotizacion';
type ComercialRol = 'ventas' | 'admin' | 'owner';
const ALLOWED_ROLES = new Set<ComercialRol>(['ventas', 'admin', 'owner']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DETAIL_COLUMNS = [
  'id',
  'numero',
  'estado',
  'nombre',
  'empresa',
  'email',
  'telefono',
  'moneda',
  'mercado',
  'validez_hasta',
  'condiciones',
  'productos',
  'precio_total_ofertado',
  'updated_at',
  'created_at',
  'pdf_storage_path',
  'pdf_revision',
  'send_error',
  'metadata',
  'crm_sync_status',
  'created_by',
  'locale',
  'pedido_id',
  'campaign',
  'twenty_person_id',
  'twenty_company_id',
  'twenty_opportunity_id',
].join(',');

const DETAIL_COLUMNS_SAFE = [
  'id',
  'estado',
  'nombre',
  'empresa',
  'email',
  'telefono',
  'moneda',
  'mercado',
  'validez_hasta',
  'condiciones',
  'productos',
  'precio_total_ofertado',
  'created_at',
  'crm_sync_status',
  'metadata',
  'locale',
  'pedido_id',
  'twenty_person_id',
  'twenty_company_id',
  'twenty_opportunity_id',
].join(',');

function isMissingSchema(message?: string | null): boolean {
  return /does not exist|schema cache|42703|42883/i.test(message ?? '');
}

interface AdminProfileRow {
  user_id: string;
  email: string;
  rol: string;
  activo: boolean;
  nombre: string | null;
}

interface SaveBody {
  id?: string;
  nombre?: string;
  empresa?: string | null;
  email?: string;
  telefono?: string;
  moneda?: string;
  validez_hasta?: string | null;
  condiciones?: string | null;
  productos?: unknown;
  updated_at?: string | null;
  locale?: string;
}

type ServerSupabase = ReturnType<typeof getServerSupabase>;

function json(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function publicRow(
  row: CotizacionOfertaRow & {
    updated_at?: string | null;
    created_at?: string | null;
    crm_sync_status?: string | null;
    telefono?: string | null;
  },
  createdByNombre?: string | null
) {
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {};
  const lineas = parseLineasOferta(row.productos);
  const check = ofertaCompleta(lineas, row.condiciones);
  return {
    id: row.id,
    numero:
      row.numero ??
      (typeof metadata.numero_presupuesto === 'string' ? metadata.numero_presupuesto : null),
    estado: row.estado ?? 'nueva',
    nombre: row.nombre ?? '',
    empresa: row.empresa ?? null,
    email: row.email ?? '',
    telefono: row.telefono ?? '',
    moneda: normalizarMonedaOferta(row.moneda),
    mercado: row.mercado ?? (normalizarMonedaOferta(row.moneda) === 'USD' ? 'INTL' : 'CO'),
    validez_hasta: row.validez_hasta ?? null,
    condiciones: row.condiciones ?? '',
    productos: lineas,
    precio_total_ofertado: Number(row.precio_total_ofertado ?? calcularTotalOfertado(lineas)),
    updated_at: row.updated_at ?? row.created_at ?? null,
    created_at: row.created_at ?? null,
    pdf_storage_path:
      row.pdf_storage_path ??
      (typeof metadata.pdf_storage_path === 'string' ? metadata.pdf_storage_path : null),
    pdf_revision: row.pdf_revision ?? (Number(metadata.pdf_revision ?? 0) || 0),
    send_error:
      row.send_error ??
      (typeof metadata.quote_send_error === 'string' ? metadata.quote_send_error : null),
    crm_sync_status: row.crm_sync_status ?? null,
    created_by: row.created_by ?? null,
    created_by_nombre: createdByNombre ?? null,
    locale: row.locale === 'en' ? 'en' : 'es',
    pedido_id: row.pedido_id ?? null,
    incompleta: !check.ok,
    incompleta_error: check.ok ? null : check.error,
    origen: row.created_by ? 'pwa' : 'web',
    editable: quoteEditable(row.estado),
  };
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;

    const supabase = getServerSupabase();
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return unauthorized(origin);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return unauthorized(origin);

    const { data: profileData, error: profileError } = await supabase
      .from('admin_profiles')
      .select('user_id, email, rol, activo, nombre')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) return internalError(profileError.message, origin);

    const profile = profileData as AdminProfileRow | null;
    if (!profile || !profile.activo || !ALLOWED_ROLES.has(profile.rol as ComercialRol)) {
      return errorResponse(
        { code: 'FORBIDDEN', message: 'Tu usuario no tiene permiso para el CMS comercial.' },
        403,
        origin
      );
    }

    const url = new URL(req.url);
    try {
      if (req.method === 'GET') {
        const action = url.searchParams.get('action');
        if (action === 'search') return await handleSearch(supabase, url, origin);
        if (action === 'pdf') {
          const id = url.searchParams.get('id') ?? '';
          if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
          return await handlePdf(supabase, id, origin, url);
        }
        const id = url.searchParams.get('id');
        if (id) {
          if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
          return await handleGetDetail(supabase, id, origin);
        }
        return await handleGetList(supabase, profile, url, origin);
      }

      if (req.method === 'POST') {
        const limite = await checkRateLimit(
          supabase,
          `comercial-cotizacion:user:${profile.user_id}`,
          'comercial-share'
        );
        if (limite.limited) {
          return errorResponse(
            { code: 'RATE_LIMIT', message: 'Demasiadas operaciones. Espera un momento.' },
            429,
            origin
          );
        }
        const action = url.searchParams.get('action');
        if (action === 'duplicar') {
          const id = url.searchParams.get('id') ?? '';
          if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
          return await handleDuplicar(supabase, profile, id, origin);
        }
        if (action === 'validar-crm') {
          const id = url.searchParams.get('id') ?? '';
          if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
          return await handleValidarCrm(supabase, profile, id, origin);
        }
        return await handleSave(req, supabase, profile, origin);
      }

      if (req.method === 'DELETE') {
        const id = url.searchParams.get('id') ?? '';
        if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
        return await handleDelete(supabase, profile, id, origin);
      }

      return badRequest('Metodo no soportado', origin);
    } catch (err) {
      return internalError(
        err instanceof Error ? err.message : `${FN_NAME}: error desconocido`,
        origin
      );
    }
  })
);

async function nombresPorUsuario(
  supabase: ServerSupabase,
  ids: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase
    .from('admin_profiles')
    .select('user_id, nombre, email')
    .in('user_id', unique);
  for (const row of (data ?? []) as Array<{
    user_id: string;
    nombre: string | null;
    email: string;
  }>) {
    map.set(row.user_id, row.nombre?.trim() || row.email);
  }
  return map;
}

async function selectQuoteRow(
  supabase: ServerSupabase,
  id: string
): Promise<{ data: CotizacionOfertaRow | null; error: { message: string } | null }> {
  const full = await supabase
    .from('solicitudes_cotizacion')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (!full.error) return { data: (full.data as CotizacionOfertaRow | null) ?? null, error: null };
  if (!isMissingSchema(full.error.message)) return { data: null, error: full.error };
  const safe = await supabase
    .from('solicitudes_cotizacion')
    .select(DETAIL_COLUMNS_SAFE)
    .eq('id', id)
    .maybeSingle();
  if (safe.error) return { data: null, error: safe.error };
  return { data: (safe.data as CotizacionOfertaRow | null) ?? null, error: null };
}

async function ensureNumero(
  supabase: ServerSupabase,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('ensure_cotizacion_numero', { p_id: id });
  if (!error || isMissingSchema(error.message)) return { error: null };
  return { error: error.message };
}

async function handleGetList(
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  url: URL,
  origin: string | null
): Promise<Response> {
  const tab = url.searchParams.get('tab') === 'enviadas' ? 'enviadas' : 'pendientes';
  const equipo = url.searchParams.get('equipo') === '1';
  const q = cleanText(url.searchParams.get('q'), 80);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const estados =
    tab === 'enviadas' ? [...COTIZACION_ESTADOS_ENVIADAS] : [...COTIZACION_ESTADOS_PENDIENTES];

  let cols = DETAIL_COLUMNS;
  let useCreatedBy = !equipo;
  let useNumero = Boolean(q);
  let useUpdatedAt = true;
  let lastError = '';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let query = supabase
      .from('solicitudes_cotizacion')
      .select(cols, { count: 'exact' })
      .in('estado', estados)
      .order(useUpdatedAt ? 'updated_at' : 'created_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (useCreatedBy) query = query.eq('created_by', profile.user_id);
    if (q) {
      const safe = q.replace(/[%_,]/g, '');
      if (safe) {
        query = query.or(
          useNumero
            ? `numero.ilike.%${safe}%,nombre.ilike.%${safe}%,empresa.ilike.%${safe}%,email.ilike.%${safe}%`
            : `nombre.ilike.%${safe}%,empresa.ilike.%${safe}%,email.ilike.%${safe}%`
        );
      }
    }

    const { data, error, count } = await query;
    if (!error) {
      const rows = (data ?? []) as Array<
        CotizacionOfertaRow & { updated_at?: string; created_at?: string }
      >;
      const names = await nombresPorUsuario(
        supabase,
        rows.map(r => String(r.created_by ?? ''))
      );
      return json(
        {
          quotes: rows.map(row => publicRow(row, names.get(String(row.created_by ?? '')) ?? null)),
          page,
          pageSize,
          total: count ?? rows.length,
          tab,
          equipo,
        },
        origin
      );
    }
    lastError = error.message;
    if (!isMissingSchema(error.message)) return internalError(error.message, origin);
    cols = DETAIL_COLUMNS_SAFE;
    if (/created_by/.test(error.message)) useCreatedBy = false;
    if (/numero/.test(error.message)) useNumero = false;
    if (/updated_at/.test(error.message)) useUpdatedAt = false;
  }
  return internalError(lastError || 'list', origin);
}

async function handleGetDetail(
  supabase: ServerSupabase,
  id: string,
  origin: string | null
): Promise<Response> {
  const { data, error } = await selectQuoteRow(supabase, id);
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);
  const row = data as CotizacionOfertaRow & { updated_at?: string; created_at?: string };
  const names = await nombresPorUsuario(supabase, row.created_by ? [row.created_by] : []);
  return json({ quote: publicRow(row, names.get(String(row.created_by ?? '')) ?? null) }, origin);
}

async function handleSearch(
  supabase: ServerSupabase,
  url: URL,
  origin: string | null
): Promise<Response> {
  const q = cleanText(url.searchParams.get('q'), 80).replace(/[%_,]/g, '');
  if (q.length < 2) return json({ products: [] }, origin);
  const { data, error } = await supabase
    .from('productos')
    .select('id,slug,sku,nombre_es,precio,precio_oferta,precio_regular,moneda')
    .eq('activo', true)
    .or(`nombre_es.ilike.%${q}%,sku.ilike.%${q}%,slug.ilike.%${q}%`)
    .order('nombre_es', { ascending: true })
    .limit(20);
  if (error) return internalError(error.message, origin);
  return json({ products: data ?? [] }, origin);
}

async function handlePdf(
  supabase: ServerSupabase,
  id: string,
  origin: string | null,
  url: URL
): Promise<Response> {
  const { data, error } = await selectQuoteRow(supabase, id);
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);
  const row = data as CotizacionOfertaRow;

  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {};
  const fresh = url.searchParams.get('fresh') === '1';
  const storedPath =
    row.pdf_storage_path ??
    (typeof metadata.pdf_storage_path === 'string' ? metadata.pdf_storage_path : null);
  if (storedPath && !fresh) {
    const downloaded = await supabase.storage.from('cotizaciones-pdf').download(storedPath);
    if (!downloaded.error && downloaded.data) {
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      return json(
        {
          pdf_base64: base64(bytes),
          numero:
            row.numero ??
            (typeof metadata.numero_presupuesto === 'string'
              ? metadata.numero_presupuesto
              : id.slice(0, 8)),
          stored: true,
        },
        origin
      );
    }
  }

  await ensureNumero(supabase, id);
  const reloaded = await selectQuoteRow(supabase, id);
  const live = (reloaded.data ?? row) as CotizacionOfertaRow;
  const liveMeta =
    live.metadata && typeof live.metadata === 'object' && !Array.isArray(live.metadata)
      ? live.metadata
      : {};

  const lineas = sanitizarLineasComercial(live.productos, live.moneda);
  const check = ofertaCompleta(lineas, live.condiciones);
  if (!check.ok) {
    return errorResponse(
      { code: check.error, message: 'Completa la oferta para previsualizar el PDF.' },
      422,
      origin
    );
  }
  const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://i-me.com.co').replace(/\/+$/, '');
  const [annexes, logoBytes, whatsappIconBytes, fonts] = await Promise.all([
    buildQuoteAnnexes(supabase, lineas, siteUrl),
    loadQuotePdfLogo(siteUrl),
    loadQuotePdfWhatsappIcon(siteUrl),
    loadQuotePdfFonts(siteUrl),
  ]);
  const numero = String(
    live.numero ??
      (typeof liveMeta.numero_presupuesto === 'string' ? liveMeta.numero_presupuesto : 'BORRADOR')
  );
  const bytes = await renderQuotePdf({
    numero,
    clienteNombre: String(live.nombre ?? 'Cliente'),
    empresa: live.empresa,
    email: live.email,
    telefono: live.telefono,
    condiciones: String(live.condiciones ?? ''),
    validezHasta: live.validez_hasta ? String(live.validez_hasta) : null,
    moneda: normalizarMonedaOferta(live.moneda),
    total: calcularTotalOfertado(lineas),
    lineas,
    locale: live.locale === 'en' ? 'en' : 'es',
    annexes,
    logoBytes,
    whatsappIconBytes,
    fontRegularBytes: fonts.regular,
    fontBoldBytes: fonts.bold,
    bancoLineas: bancoLineasCotizacion(),
  });
  return json(
    {
      pdf_base64: base64(bytes),
      numero,
      stored: false,
    },
    origin
  );
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function handleSave(
  req: Request,
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  origin: string | null
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as SaveBody;
  const moneda = normalizarMonedaOferta(body.moneda);
  const productos = sanitizarLineasComercial(body.productos, moneda);
  const nombre = cleanText(body.nombre, 160);
  const email = cleanText(body.email, 200).toLowerCase();
  const telefono = cleanText(body.telefono, 40);
  const empresa = cleanText(body.empresa, 200) || null;
  const condiciones = cleanText(body.condiciones, 8000);
  const validez = cleanText(body.validez_hasta, 32) || null;
  const locale = body.locale === 'en' ? 'en' : 'es';

  if (!nombre)
    return errorResponse(
      { code: 'SIN_NOMBRE', message: 'Nombre del contacto requerido.' },
      422,
      origin
    );
  if (!EMAIL_RE.test(email)) {
    return errorResponse({ code: 'SIN_EMAIL', message: 'Email de cliente invalido.' }, 422, origin);
  }
  if (!telefono) {
    return errorResponse(
      { code: 'SIN_TELEFONO', message: 'Telefono del contacto requerido.' },
      422,
      origin
    );
  }

  const canon = {
    nombre,
    empresa,
    email,
    telefono,
    moneda,
    mercado: moneda === 'USD' ? 'INTL' : 'CO',
    productos,
    condiciones: condiciones || null,
    validez_hasta: validez,
    precio_total_ofertado: calcularTotalOfertado(productos),
    locale,
    leida: true,
  };

  const id = cleanText(body.id, 36);
  if (id) {
    if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
    let existing = await supabase
      .from('solicitudes_cotizacion')
      .select('id, estado, updated_at, created_by, numero, pedido_id')
      .eq('id', id)
      .maybeSingle();
    if (existing.error && isMissingSchema(existing.error.message)) {
      existing = await supabase
        .from('solicitudes_cotizacion')
        .select('id, estado, pedido_id')
        .eq('id', id)
        .maybeSingle();
    }
    if (existing.error) return internalError(existing.error.message, origin);
    if (!existing.data) return notFound(origin);
    const row = existing.data as {
      estado: string;
      updated_at?: string | null;
      pedido_id: string | null;
    };
    if (row.pedido_id || !quoteEditable(row.estado)) {
      return errorResponse(
        {
          code: 'COTIZACION_INMUTABLE',
          message: 'Esta cotizacion ya no se puede editar. Crea una revision.',
        },
        409,
        origin
      );
    }
    if (
      body.updated_at &&
      row.updated_at &&
      new Date(body.updated_at).getTime() !== new Date(row.updated_at).getTime()
    ) {
      return errorResponse(
        { code: 'CONCURRENT_UPDATE', message: 'Otro comercial guardo esta oferta. Recargar.' },
        409,
        origin
      );
    }
    const { error: updateError } = await supabase
      .from('solicitudes_cotizacion')
      .update(canon)
      .eq('id', id);
    if (updateError) return internalError(updateError.message, origin);
    const numbered = await ensureNumero(supabase, id);
    if (numbered.error) return internalError(numbered.error, origin);
    const detail = await selectQuoteRow(supabase, id);
    if (detail.error || !detail.data)
      return internalError(detail.error?.message ?? 'reload', origin);
    return json(
      { ok: true, quote: publicRow(detail.data as CotizacionOfertaRow, profile.nombre) },
      origin
    );
  }

  const insertFull = {
    ...canon,
    estado: 'nueva',
    consentimiento_datos: false,
    created_by: profile.user_id,
    landing_path: '/comercial',
    campaign: 'pwa-comercial',
  };
  let inserted = await supabase
    .from('solicitudes_cotizacion')
    .insert(insertFull)
    .select('id')
    .maybeSingle();
  if (inserted.error && isMissingSchema(inserted.error.message)) {
    const { created_by: _createdBy, ...rest } = insertFull;
    inserted = await supabase
      .from('solicitudes_cotizacion')
      .insert(rest)
      .select('id')
      .maybeSingle();
  }
  if (inserted.error || !inserted.data)
    return internalError(inserted.error?.message ?? 'insert', origin);
  const newId = String((inserted.data as { id: string }).id);
  const numbered = await ensureNumero(supabase, newId);
  if (numbered.error) return internalError(numbered.error, origin);
  const detail = await selectQuoteRow(supabase, newId);
  if (detail.error || !detail.data) return internalError(detail.error?.message ?? 'reload', origin);
  return json(
    { ok: true, quote: publicRow(detail.data as CotizacionOfertaRow, profile.nombre) },
    origin,
    201
  );
}

async function handleDuplicar(
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  id: string,
  origin: string | null
): Promise<Response> {
  const { data, error } = await selectQuoteRow(supabase, id);
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);
  const row = data as CotizacionOfertaRow;
  const moneda = normalizarMonedaOferta(row.moneda);
  const productos = sanitizarLineasComercial(row.productos, moneda);
  const insertFull = {
    nombre: row.nombre,
    empresa: row.empresa,
    email: row.email,
    telefono: row.telefono,
    moneda,
    mercado: moneda === 'USD' ? 'INTL' : 'CO',
    productos,
    condiciones: row.condiciones,
    validez_hasta: row.validez_hasta,
    precio_total_ofertado: calcularTotalOfertado(productos),
    locale: row.locale === 'en' ? 'en' : 'es',
    estado: 'nueva',
    consentimiento_datos: false,
    created_by: profile.user_id,
    landing_path: '/comercial',
    campaign: 'pwa-revision',
    metadata: { revisa_de: row.id, revisa_numero: row.numero ?? null },
    leida: true,
  };
  let inserted = await supabase
    .from('solicitudes_cotizacion')
    .insert(insertFull)
    .select('id')
    .maybeSingle();
  if (inserted.error && isMissingSchema(inserted.error.message)) {
    const { created_by: _createdBy, metadata: _meta, ...rest } = insertFull;
    inserted = await supabase
      .from('solicitudes_cotizacion')
      .insert(rest)
      .select('id')
      .maybeSingle();
  }
  if (inserted.error || !inserted.data)
    return internalError(inserted.error?.message ?? 'insert', origin);
  const newId = String((inserted.data as { id: string }).id);
  const numbered = await ensureNumero(supabase, newId);
  if (numbered.error) return internalError(numbered.error, origin);
  const detail = await selectQuoteRow(supabase, newId);
  if (detail.error || !detail.data) return internalError(detail.error?.message ?? 'reload', origin);
  return json(
    { ok: true, quote: publicRow(detail.data as CotizacionOfertaRow, profile.nombre) },
    origin,
    201
  );
}

function isAdminRole(rol: string): boolean {
  return rol === 'admin' || rol === 'owner';
}

async function handleDelete(
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  id: string,
  origin: string | null
): Promise<Response> {
  if (!isAdminRole(profile.rol)) {
    return errorResponse(
      { code: 'FORBIDDEN', message: 'Solo administradores pueden borrar presupuestos.' },
      403,
      origin
    );
  }
  const { data, error } = await selectQuoteRow(supabase, id);
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);
  const row = data as CotizacionOfertaRow;
  if (row.pedido_id || row.estado === 'convertida') {
    return errorResponse(
      { code: 'QUOTE_LOCKED', message: 'No se puede borrar un presupuesto convertido a pedido.' },
      409,
      origin
    );
  }
  const pdfPath =
    row.pdf_storage_path ??
    (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? typeof (row.metadata as Record<string, unknown>).pdf_storage_path === 'string'
        ? String((row.metadata as Record<string, unknown>).pdf_storage_path)
        : null
      : null);
  if (pdfPath) {
    await supabase.storage.from('cotizaciones-pdf').remove([pdfPath]);
  }
  const { error: delError } = await supabase.from('solicitudes_cotizacion').delete().eq('id', id);
  if (delError) return internalError(delError.message, origin);
  return json({ ok: true, deleted: id }, origin);
}

async function handleValidarCrm(
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  id: string,
  origin: string | null
): Promise<Response> {
  if (!isAdminRole(profile.rol)) {
    return errorResponse(
      { code: 'FORBIDDEN', message: 'Solo administradores pueden validar hacia el CRM.' },
      403,
      origin
    );
  }
  const { data, error } = await selectQuoteRow(supabase, id);
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);
  const row = data as CotizacionOfertaRow & {
    campaign?: string | null;
    telefono?: string | null;
    twenty_opportunity_id?: string | null;
  };
  const lineas = sanitizarLineasComercial(row.productos, row.moneda);
  const check = ofertaCompleta(lineas, row.condiciones);
  if (!check.ok) {
    return errorResponse(
      {
        code: check.error,
        message: 'Completa precios (sin pendientes) y condiciones antes de validar al CRM.',
      },
      422,
      origin
    );
  }
  if (lineas.some(l => l.precio_pendiente_validar)) {
    return errorResponse(
      {
        code: 'PRECIO_PENDIENTE',
        message: 'Hay líneas en Pendiente validar. Asigna precio antes de enviar al CRM.',
      },
      422,
      origin
    );
  }
  const total = calcularTotalOfertado(lineas);
  const numero =
    row.numero ??
    (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? String((row.metadata as Record<string, unknown>).numero_presupuesto ?? id.slice(0, 8))
      : id.slice(0, 8));
  const metaExisting =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const canalEnvio =
    typeof metaExisting.quote_send_channel === 'string'
      ? String(metaExisting.quote_send_channel)
      : null;
  const formalizarUrl =
    typeof metaExisting.formalizacion_url === 'string'
      ? String(metaExisting.formalizacion_url)
      : null;
  const twenty = await syncCotizacionOfertaWithTwenty({
    cotizacionId: id,
    numero: String(numero),
    nombre: String(row.nombre ?? ''),
    email: String(row.email ?? ''),
    telefono: String(row.telefono ?? ''),
    empresa: String(row.empresa ?? ''),
    moneda: normalizarMonedaOferta(row.moneda),
    total,
    validezHasta: row.validez_hasta ?? null,
    condiciones: row.condiciones ?? null,
    estado: row.estado ?? null,
    productos: lineas.map(l => ({
      nombre: l.nombre,
      slug: l.slug,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      subtotal: l.subtotal,
      moneda: l.moneda,
      notas: l.notas,
    })),
    campaign: String(row.campaign ?? 'pwa-comercial'),
    origen: 'comercial_presupuesto_validado',
    canalEnvio,
    formalizarUrl,
    validatedByEmail: profile.email,
    twentyOpportunityId: row.twenty_opportunity_id ?? null,
  });
  const crmSyncStatus = twenty.skipped ? 'skipped' : twenty.ok ? 'synced' : 'failed';
  const meta = { ...metaExisting };
  meta.crm_validated_at = new Date().toISOString();
  meta.crm_validated_by = profile.user_id;
  meta.crm_validated_by_email = profile.email;
  if (twenty.data?.opportunityId) {
    meta.competencia_opp_ref = twenty.data.opportunityId;
  }
  await supabase
    .from('solicitudes_cotizacion')
    .update({
      crm_sync_status: crmSyncStatus,
      crm_sync_error: twenty.ok || twenty.skipped ? null : (twenty.error ?? 'Twenty sync failed'),
      crm_sync_last_attempt_at: new Date().toISOString(),
      twenty_person_id: twenty.data?.personId ?? null,
      twenty_company_id: twenty.data?.companyId ?? null,
      twenty_opportunity_id: twenty.data?.opportunityId ?? null,
      metadata: meta,
    })
    .eq('id', id);

  // Sidecar actualizado en storage con opportunity id (foto ya nombrada con quoteId).
  if (twenty.ok && twenty.data?.opportunityId) {
    const fotoPath =
      typeof meta.competencia_foto_path === 'string' ? String(meta.competencia_foto_path) : '';
    if (fotoPath) {
      const sidecarPath = fotoPath.replace(/\.[^.]+$/, '') + '.json';
      const fotoName =
        typeof meta.competencia_foto_id === 'string'
          ? String(meta.competencia_foto_id)
          : fotoPath.split('/').pop() || 'competencia.jpg';
      const sidecar = {
        quote_id: id,
        numero: String(numero),
        twenty_opportunity_id: twenty.data.opportunityId,
        storage_path: fotoPath,
        crm_validated_at: meta.crm_validated_at,
        local_hint: `/home/shoky/0 IME/presupuestos comp/${fotoName}`,
      };
      await supabase.storage
        .from('presupuestos-competencia')
        .upload(sidecarPath, new TextEncoder().encode(JSON.stringify(sidecar, null, 2)), {
          contentType: 'application/json',
          upsert: true,
        });
    }
  }
  if (!twenty.ok && !twenty.skipped) {
    return errorResponse(
      {
        code: 'CRM_SYNC_FAILED',
        message: twenty.error ?? 'No se pudo sincronizar con Twenty CRM.',
      },
      502,
      origin
    );
  }
  return json(
    {
      ok: true,
      crm_sync_status: crmSyncStatus,
      twenty_opportunity_id: twenty.data?.opportunityId ?? null,
    },
    origin
  );
}
