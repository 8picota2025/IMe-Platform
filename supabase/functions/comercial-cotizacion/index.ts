/**
 * CMS comercial: CRUD allowlist de cotizaciones sobre solicitudes_cotizacion.
 * Writes never go through PostgREST from /comercial.
 *
 * GET  /comercial-cotizacion                  list (?tab=pendientes|enviadas&equipo=1&q=&page=)
 * GET  /comercial-cotizacion?id=<uuid>        detail (allowlisted columns)
 * GET  /comercial-cotizacion?action=search&q= product typeahead (id,slug,sku,nombre_es)
 * GET  /comercial-cotizacion?action=pdf&id=   PDF base64 (stored or rendered)
 * POST /comercial-cotizacion                  save create/update (ignora `estado`)
 * POST /comercial-cotizacion?action=duplicar  new row (duplicate-on-revise)
 * POST /comercial-cotizacion?action=validar-crm  admin validates → Twenty CRM
 * POST /comercial-cotizacion?action=cambiar-estado  {estado, motivo} sin avisar al cliente
 * POST /comercial-cotizacion?action=archivar  {motivo} soft delete (archived_at)
 * POST /comercial-cotizacion?action=desarchivar {motivo}
 * DELETE /comercial-cotizacion?id=            admin/owner: archiva, no borra la fila
 * GET  ...&incluir_archivadas=1 | &solo_archivadas=1
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
import { asesorDeUsuario } from '../_shared/asesor.ts';
import { renderQuotePdf } from '../_shared/render-quote-pdf.ts';
import {
  buildQuoteAnnexes,
  loadQuotePdfFonts,
  loadQuotePdfLogo,
  loadQuotePdfWhatsappIcon,
} from '../_shared/quote-pdf-assets.ts';
import { bancoLineasCotizacion } from '../_shared/transferencia-bancaria.ts';
import {
  cuentaRecaudoValida,
  lineasMedioPagoCotizacion,
  normalizarCondicionPago,
  normalizarCuentaRecaudo,
} from '../../../src/lib/cotizacion-recaudo.ts';
import { syncCotizacionOfertaWithTwenty } from '../_shared/twenty-crm.ts';
import {
  calcularTotalOfertado,
  normalizarMonedaOferta,
  ofertaCompleta,
  parseLineasOferta,
  quoteEditable,
  sanitizarLineasComercial,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';
import {
  estadosDeBandeja,
  planArchivo,
  planCambioEstado,
  planDesarchivo,
  proyectarGuardadoCotizacion,
  resolverFiltroArchivo,
  type FilaEstadoCotizacion,
  type PlanOk,
} from '../../../src/lib/cotizacion-estado.ts';

const FN_NAME = 'comercial-cotizacion';
type ComercialRol = 'ventas' | 'admin' | 'owner';
const ALLOWED_ROLES = new Set<ComercialRol>(['ventas', 'admin', 'owner']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DETAIL_COLUMNS_BASE = [
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
  'impuestos_incluidos',
  'twenty_person_id',
  'twenty_company_id',
  'twenty_opportunity_id',
  'notas_internas',
  'archived_at',
  'archived_by',
  'archived_reason',
].join(',');

const DETAIL_COLUMNS = `${DETAIL_COLUMNS_BASE},condicion_pago,cuenta_recaudo`;

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

function omitMissingColumn(
  payload: Record<string, unknown>,
  message: string
): Record<string, unknown> | null {
  const missing =
    message.match(/'([a-z0-9_]+)'/i)?.[1] || message.match(/column [^.\s]+\.([a-z0-9_]+)/i)?.[1];
  if (!missing || !(missing in payload)) return null;
  const next = { ...payload };
  delete next[missing];
  return next;
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
  /** "Precios incluyen IVA": habilita pedir factura electrónica al formalizar. */
  impuestos_incluidos?: boolean | null;
  cuenta_recaudo?: string | null;
  condicion_pago?: string | null;
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
    impuestos_incluidos: row.impuestos_incluidos ?? null,
    cuenta_recaudo: normalizarCuentaRecaudo(row.cuenta_recaudo),
    condicion_pago: normalizarCondicionPago(row.condicion_pago),
    incompleta: !check.ok,
    incompleta_error: check.ok ? null : check.error,
    origen: row.created_by ? 'pwa' : 'web',
    editable: quoteEditable(row.estado),
    archived_at: row.archived_at ?? null,
    archived_by: row.archived_by ?? null,
    archived_reason: row.archived_reason ?? null,
    archivada: Boolean(row.archived_at),
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
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        const action =
          url.searchParams.get('action') || (typeof body.action === 'string' ? body.action : '');
        if (action === 'duplicar') {
          const id = url.searchParams.get('id') || cleanText(body.id, 36);
          if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
          return await handleDuplicar(supabase, profile, id, origin);
        }
        if (action === 'validar-crm') {
          const id = url.searchParams.get('id') || cleanText(body.id, 36);
          if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
          return await handleValidarCrm(supabase, profile, id, origin);
        }
        if (action === 'cambiar-estado' || action === 'archivar' || action === 'desarchivar') {
          const id = url.searchParams.get('id') || cleanText(body.id, 36);
          if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
          return await handleAccionAdmin(supabase, profile, action, id, body, origin);
        }
        return await handleSave(body, supabase, profile, origin);
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
  const rich = await supabase
    .from('solicitudes_cotizacion')
    .select(DETAIL_COLUMNS_BASE)
    .eq('id', id)
    .maybeSingle();
  if (!rich.error) return { data: (rich.data as CotizacionOfertaRow | null) ?? null, error: null };
  if (!isMissingSchema(rich.error.message)) return { data: null, error: rich.error };
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
  const tabParam = url.searchParams.get('tab');
  const tab =
    tabParam === 'enviadas' ||
    tabParam === 'cerradas' ||
    tabParam === 'expiradas' ||
    tabParam === 'todas'
      ? tabParam
      : 'pendientes';
  const equipo = url.searchParams.get('equipo') === '1';
  const q = cleanText(url.searchParams.get('q'), 80);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const estados = estadosDeBandeja(tab);
  const archivo = resolverFiltroArchivo({
    incluir_archivadas: url.searchParams.get('incluir_archivadas'),
    solo_archivadas: url.searchParams.get('solo_archivadas'),
    archivadas: url.searchParams.get('archivadas'),
  });

  let cols = DETAIL_COLUMNS;
  let useCreatedBy = !equipo;
  let useNumero = Boolean(q);
  let useUpdatedAt = true;
  let filtrarArchivo = archivo !== 'todas';
  let lastError = '';

  for (let attempt = 0; attempt < 6; attempt += 1) {
    let query = supabase.from('solicitudes_cotizacion').select(cols, { count: 'exact' });
    if (estados) query = query.in('estado', [...estados]);
    if (filtrarArchivo && archivo === 'solo_archivadas') {
      query = query.not('archived_at', 'is', null);
    } else if (filtrarArchivo) {
      query = query.is('archived_at', null);
    }
    query = query
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
          archivo,
        },
        origin
      );
    }
    lastError = error.message;
    if (!isMissingSchema(error.message)) return internalError(error.message, origin);
    if (/archived_at|archived_by|archived_reason|notas_internas/.test(error.message)) {
      filtrarArchivo = false;
      cols = cols.replace(/,notas_internas|,archived_at|,archived_by|,archived_reason/g, '');
    } else if (/,condicion_pago|,cuenta_recaudo/.test(cols)) {
      cols = cols.replace(/,condicion_pago|,cuenta_recaudo/g, '');
    } else {
      cols = DETAIL_COLUMNS_SAFE;
    }
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
  const asesor = await asesorDeUsuario(supabase, live.created_by);
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
    nombreComercial: asesor.nombre,
    correoComercial: asesor.correo,
    telefonoComercial: asesor.telefono,
    annexes,
    logoBytes,
    whatsappIconBytes,
    fontRegularBytes: fonts.regular,
    fontBoldBytes: fonts.bold,
    condicionPago: normalizarCondicionPago(live.condicion_pago),
    bancoLineas: lineasMedioPagoCotizacion(live.cuenta_recaudo, bancoLineasCotizacion()),
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
  raw: Record<string, unknown>,
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  origin: string | null
): Promise<Response> {
  const body = raw as SaveBody;
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

  const canon: Record<string, unknown> = {
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
  // Solo se escribe si llega explícito: omitirlo conserva el valor existente (NULL = sin declarar).
  if (typeof body.impuestos_incluidos === 'boolean') {
    canon.impuestos_incluidos = body.impuestos_incluidos;
  }
  if (body.cuenta_recaudo !== undefined) {
    if (!cuentaRecaudoValida(body.cuenta_recaudo)) {
      return errorResponse(
        { code: 'CUENTA_RECAUDO_INVALIDA', message: 'Cuenta de recaudo no reconocida.' },
        422,
        origin
      );
    }
    canon.cuenta_recaudo = normalizarCuentaRecaudo(body.cuenta_recaudo);
  }
  if (body.condicion_pago !== undefined) {
    canon.condicion_pago = normalizarCondicionPago(body.condicion_pago);
  }
  // `estado` del body no entra: proyectarGuardadoCotizacion lo descarta.
  // Cambiar estado sin avisar al cliente es POST ?action=cambiar-estado.
  const writable = proyectarGuardadoCotizacion(canon);

  const id = cleanText(body.id, 36);
  if (id) {
    if (!UUID_RE.test(id)) return badRequest('id invalido', origin);
    let existing = await supabase
      .from('solicitudes_cotizacion')
      .select('id, estado, updated_at, created_by, numero, pedido_id, archived_at')
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
      archived_at?: string | null;
    };
    if (row.archived_at) {
      return errorResponse(
        {
          code: 'COTIZACION_ARCHIVADA',
          message: 'La cotizacion esta archivada. Desarchivala antes de editarla.',
        },
        409,
        origin
      );
    }
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
    let updatePayload: Record<string, unknown> = { ...writable };
    let updateError = (
      await supabase.from('solicitudes_cotizacion').update(updatePayload).eq('id', id)
    ).error;
    for (
      let attempt = 0;
      attempt < 4 && updateError && isMissingSchema(updateError.message);
      attempt += 1
    ) {
      const missing = updateError.message.match(/'([a-z0-9_]+)'/i)?.[1];
      if (!missing || !(missing in updatePayload)) break;
      delete updatePayload[missing];
      updatePayload = { ...updatePayload };
      updateError = (
        await supabase.from('solicitudes_cotizacion').update(updatePayload).eq('id', id)
      ).error;
    }
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
    ...writable,
    estado: 'nueva',
    consentimiento_datos: false,
    created_by: profile.user_id,
    landing_path: '/comercial',
    campaign: 'pwa-comercial',
  };
  let insertPayload: Record<string, unknown> = { ...insertFull };
  let inserted = await supabase
    .from('solicitudes_cotizacion')
    .insert(insertPayload)
    .select('id')
    .maybeSingle();
  for (
    let attempt = 0;
    attempt < 4 && inserted.error && isMissingSchema(inserted.error.message);
    attempt += 1
  ) {
    const next = omitMissingColumn(insertPayload, inserted.error.message);
    if (!next) break;
    insertPayload = next;
    inserted = await supabase
      .from('solicitudes_cotizacion')
      .insert(insertPayload)
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
    impuestos_incluidos: row.impuestos_incluidos ?? null,
    cuenta_recaudo: row.cuenta_recaudo ?? null,
    condicion_pago: row.condicion_pago ?? null,
    leida: true,
  };
  let insertPayload: Record<string, unknown> = { ...insertFull };
  let inserted = await supabase
    .from('solicitudes_cotizacion')
    .insert(insertPayload)
    .select('id')
    .maybeSingle();
  for (
    let attempt = 0;
    attempt < 4 && inserted.error && isMissingSchema(inserted.error.message);
    attempt += 1
  ) {
    const next = omitMissingColumn(insertPayload, inserted.error.message);
    if (!next) break;
    insertPayload = next;
    inserted = await supabase
      .from('solicitudes_cotizacion')
      .insert(insertPayload)
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

const FILA_ACCION =
  'id, estado, pedido_id, notas_internas, archived_at, archived_by, archived_reason';

function esMigracionPendiente(message: string): boolean {
  return /solicitudes_cotizacion_estado_check|archived_at|archived_by|archived_reason/i.test(
    message
  );
}

async function cargarFilaAccion(
  supabase: ServerSupabase,
  id: string
): Promise<{ fila: FilaEstadoCotizacion | null; error: string | null; missing: boolean }> {
  const full = await supabase
    .from('solicitudes_cotizacion')
    .select(FILA_ACCION)
    .eq('id', id)
    .maybeSingle();
  if (!full.error) {
    return {
      fila: (full.data as FilaEstadoCotizacion | null) ?? null,
      error: null,
      missing: false,
    };
  }
  if (!isMissingSchema(full.error.message))
    return { fila: null, error: full.error.message, missing: false };
  const safe = await supabase
    .from('solicitudes_cotizacion')
    .select('id, estado, pedido_id, notas_internas')
    .eq('id', id)
    .maybeSingle();
  if (safe.error) return { fila: null, error: safe.error.message, missing: false };
  return {
    fila: (safe.data as FilaEstadoCotizacion | null) ?? null,
    error: null,
    missing: true,
  };
}

async function aplicarPlan(
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  id: string,
  plan: PlanOk,
  anterior: FilaEstadoCotizacion,
  origin: string | null
): Promise<Response> {
  const { error: updateError } = await supabase
    .from('solicitudes_cotizacion')
    .update(plan.patch)
    .eq('id', id);
  if (updateError) {
    if (esMigracionPendiente(updateError.message)) {
      return errorResponse(
        {
          code: 'MIGRACION_PENDIENTE',
          message:
            'Falta aplicar la migracion de estado/archivo (perdida, declinada, archived_at). No se cambio la cotizacion.',
          details: updateError.message,
        },
        409,
        origin
      );
    }
    return internalError(updateError.message, origin);
  }
  const { data: audit, error: auditError } = await supabase
    .from('comercio_actuaciones')
    .insert({
      actor: profile.email,
      rol: profile.rol,
      herramienta: plan.auditoria.herramienta,
      entidad: 'solicitudes_cotizacion',
      entidad_id: id,
      antes: plan.auditoria.antes,
      despues: { ...plan.auditoria.despues, user_id: profile.user_id },
      motivo: plan.auditoria.motivo,
    })
    .select('id, en')
    .single();
  if (auditError || !audit) {
    await supabase
      .from('solicitudes_cotizacion')
      .update({
        estado: anterior.estado ?? 'nueva',
        notas_internas: anterior.notas_internas ?? null,
        archived_at: anterior.archived_at ?? null,
        archived_by: anterior.archived_by ?? null,
        archived_reason: anterior.archived_reason ?? null,
      })
      .eq('id', id);
    return internalError(
      auditError?.message ?? 'No se pudo auditar; se revirtio el cambio.',
      origin
    );
  }
  const detail = await selectQuoteRow(supabase, id);
  const quote =
    detail.data && !detail.error
      ? publicRow(detail.data as CotizacionOfertaRow, profile.nombre)
      : null;
  return json(
    {
      ok: true,
      envio_cliente: false,
      id,
      estado_anterior: plan.auditoria.antes.estado ?? null,
      estado: plan.auditoria.despues.estado ?? null,
      motivo: plan.auditoria.motivo,
      actor: profile.email,
      auditoria: {
        id: (audit as { id: string }).id,
        en: (audit as { en: string }).en,
        actor: profile.email,
        rol: profile.rol,
        motivo: plan.auditoria.motivo,
        antes: plan.auditoria.antes,
        despues: plan.auditoria.despues,
      },
      quote,
    },
    origin
  );
}

async function handleAccionAdmin(
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  action: 'cambiar-estado' | 'archivar' | 'desarchivar',
  id: string,
  body: Record<string, unknown>,
  origin: string | null
): Promise<Response> {
  const cargada = await cargarFilaAccion(supabase, id);
  if (cargada.error) return internalError(cargada.error, origin);
  if (!cargada.fila) return notFound(origin);
  const ctx = {
    motivo: String(body.motivo ?? ''),
    actor: profile.email,
    archivedBy: profile.user_id,
  };
  const plan =
    action === 'cambiar-estado'
      ? planCambioEstado(cargada.fila, body.estado, ctx)
      : action === 'archivar'
        ? planArchivo(cargada.fila, ctx)
        : planDesarchivo(cargada.fila, ctx);
  if (!plan.ok) {
    return errorResponse({ code: plan.code, message: plan.error }, plan.status, origin);
  }
  if (cargada.missing && action !== 'cambiar-estado') {
    return errorResponse(
      {
        code: 'MIGRACION_PENDIENTE',
        message:
          'Falta aplicar la migracion de archivo (archived_at, archived_by, archived_reason).',
      },
      409,
      origin
    );
  }
  return aplicarPlan(supabase, profile, id, plan, cargada.fila, origin);
}

async function handleDelete(
  supabase: ServerSupabase,
  profile: AdminProfileRow,
  id: string,
  origin: string | null
): Promise<Response> {
  if (!isAdminRole(profile.rol)) {
    return errorResponse(
      {
        code: 'FORBIDDEN',
        message: 'Solo administradores pueden archivar presupuestos por DELETE.',
      },
      403,
      origin
    );
  }
  // Nunca borra la fila ni el PDF. El motivo queda en la auditoría.
  return handleAccionAdmin(
    supabase,
    profile,
    'archivar',
    id,
    { motivo: 'Archivado desde DELETE del CMS (no se elimina la fila ni el PDF).' },
    origin
  );
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
