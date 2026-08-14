/**
 * CRUD cotizaciones en `/comercial`.
 * Writes van por PostgREST (mismo RLS ventas que `/admin`).
 * Edge `comercial-cotizacion` solo para PDF cuando esté desplegada.
 */
import {
  calcularTotalOfertado,
  COTIZACION_ESTADOS_ENVIADAS,
  COTIZACION_ESTADOS_PENDIENTES,
  normalizarMonedaOferta,
  ofertaCompleta,
  parseLineasOferta,
  quoteEditable,
  sanitizarLineasComercial,
  type CotizacionLineaOferta,
} from '../lib/cotizacion-oferta';
import {
  callEdgeFunction,
  ensureAuthSession,
  supabase,
  state,
  type EdgeFunctionResult,
} from './shared';

export interface QuotePublic {
  id: string;
  numero: string | null;
  estado: string;
  nombre: string;
  empresa: string | null;
  email: string;
  telefono: string;
  moneda: 'COP' | 'USD';
  validez_hasta: string | null;
  condiciones: string;
  productos: CotizacionLineaOferta[];
  precio_total_ofertado: number;
  updated_at: string | null;
  created_at: string | null;
  pdf_storage_path: string | null;
  pdf_revision: number;
  send_error: string | null;
  crm_sync_status: string | null;
  created_by: string | null;
  created_by_nombre: string | null;
  pedido_id: string | null;
  incompleta: boolean;
  origen: 'pwa' | 'web';
  editable: boolean;
}

export interface ProductHit {
  id: string;
  slug: string;
  sku: string | null;
  nombre_es: string;
}

export interface QuoteListResult {
  quotes: QuotePublic[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuoteSaveInput {
  id?: string;
  updated_at?: string | null;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  moneda: 'COP' | 'USD';
  validez_hasta: string | null;
  condiciones: string;
  productos: CotizacionLineaOferta[];
}

/** Columnas presentes en prod actual (OpenAPI). */
const DETAIL_CORE =
  'id,estado,nombre,empresa,email,telefono,moneda,mercado,validez_hasta,condiciones,productos,precio_total_ofertado,created_at,metadata,crm_sync_status,locale,pedido_id,campaign,landing_path,origen,tipo_solicitud';

/** Extras de migración PDF/numeración — se intentan si existen. */
const DETAIL_RICH =
  'id,numero,estado,nombre,empresa,email,telefono,moneda,mercado,validez_hasta,condiciones,productos,precio_total_ofertado,updated_at,created_at,pdf_storage_path,pdf_revision,send_error,metadata,crm_sync_status,created_by,locale,pedido_id,campaign,landing_path,origen,tipo_solicitud';

function missingSchema(message?: string | null, code?: string | null): boolean {
  if (code && /^(PGRST204|42703|42883)$/i.test(code)) return true;
  return /column .* does not exist|could not find the .* column|schema cache|42703|42883|PGRST204/i.test(
    message ?? ''
  );
}

function missingColumnName(message?: string | null): string | null {
  const m =
    message?.match(/Could not find the '([^']+)' column/i) ||
    message?.match(/column [^.]+\\.([a-z0-9_]+) does not exist/i) ||
    message?.match(/column "([^"]+)" does not exist/i);
  return m?.[1] ?? null;
}

function stripUnknownColumn<T extends Record<string, unknown>>(row: T, message?: string | null): T {
  const col = missingColumnName(message);
  if (!col || !(col in row)) {
    const {
      created_by: _c,
      numero: _n,
      updated_at: _u,
      pdf_storage_path: _p,
      pdf_revision: _r,
      send_error: _s,
      ...rest
    } = row as T & Record<string, unknown>;
    return rest as T;
  }
  const next = { ...row };
  delete next[col];
  return next;
}

function asRow(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function mapQuoteRow(raw: unknown, createdByNombre?: string | null): QuotePublic {
  const row = asRow(raw);
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const lineas = parseLineasOferta(row.productos);
  const check = ofertaCompleta(lineas, String(row.condiciones ?? ''));
  const moneda = normalizarMonedaOferta(row.moneda);
  const createdBy = typeof row.created_by === 'string' ? row.created_by : null;
  const campaign = String(row.campaign ?? '');
  const landing = String(row.landing_path ?? '');
  const pwa = Boolean(createdBy) || campaign.startsWith('pwa') || landing.startsWith('/comercial');
  return {
    id: String(row.id ?? ''),
    numero:
      typeof row.numero === 'string' && row.numero
        ? row.numero
        : typeof metadata.numero_presupuesto === 'string'
          ? metadata.numero_presupuesto
          : null,
    estado: String(row.estado ?? 'nueva'),
    nombre: String(row.nombre ?? ''),
    empresa: typeof row.empresa === 'string' ? row.empresa : null,
    email: String(row.email ?? ''),
    telefono: String(row.telefono ?? ''),
    moneda,
    validez_hasta: typeof row.validez_hasta === 'string' ? row.validez_hasta : null,
    condiciones: String(row.condiciones ?? ''),
    productos: lineas,
    precio_total_ofertado: Number(row.precio_total_ofertado ?? calcularTotalOfertado(lineas)),
    updated_at:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : typeof row.created_at === 'string'
          ? row.created_at
          : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    pdf_storage_path:
      typeof row.pdf_storage_path === 'string'
        ? row.pdf_storage_path
        : typeof metadata.pdf_storage_path === 'string'
          ? metadata.pdf_storage_path
          : null,
    pdf_revision: Number(row.pdf_revision ?? metadata.pdf_revision ?? 0) || 0,
    send_error:
      typeof row.send_error === 'string'
        ? row.send_error
        : typeof metadata.quote_send_error === 'string'
          ? metadata.quote_send_error
          : null,
    crm_sync_status: typeof row.crm_sync_status === 'string' ? row.crm_sync_status : null,
    created_by: createdBy,
    created_by_nombre: createdByNombre ?? null,
    pedido_id: typeof row.pedido_id === 'string' ? row.pedido_id : null,
    incompleta: !check.ok,
    origen: pwa ? 'pwa' : 'web',
    editable: quoteEditable(String(row.estado ?? 'nueva')),
  };
}

function fail<T>(error: string, status = 0, code?: string): EdgeFunctionResult<T> {
  return { data: null, error, status, code };
}

function ok<T>(data: T, status = 200): EdgeFunctionResult<T> {
  return { data, error: null, status };
}

export async function listQuotes(
  query: Record<string, string>
): Promise<EdgeFunctionResult<QuoteListResult>> {
  return listQuotesRest(query);
}

export async function getQuote(id: string): Promise<EdgeFunctionResult<{ quote: QuotePublic }>> {
  return getQuoteRest(id);
}

export async function saveQuote(
  input: QuoteSaveInput
): Promise<EdgeFunctionResult<{ quote: QuotePublic }>> {
  return saveQuoteRest(input);
}

export async function duplicarQuote(
  id: string
): Promise<EdgeFunctionResult<{ quote: QuotePublic }>> {
  return duplicarQuoteRest(id);
}

export async function previewQuotePdf(
  id: string,
  snapshot?: {
    numero?: string | null;
    nombre: string;
    empresa?: string | null;
    email: string;
    telefono: string;
    condiciones: string;
    validez_hasta: string | null;
    moneda: 'COP' | 'USD';
    productos: CotizacionLineaOferta[];
  }
): Promise<EdgeFunctionResult<{ pdf_base64: string; numero: string }>> {
  const edge = await callEdgeFunction<{ pdf_base64: string; numero: string }>(
    'comercial-cotizacion',
    {
      method: 'GET',
      query: { action: 'pdf', id },
    }
  );
  if (!edge.error && edge.data?.pdf_base64) return edge;

  // Fallback sandbox: PDF local con plantilla Presupuesto (sin Edge).
  if (!snapshot) {
    return fail(
      edge.error ?? 'PDF no disponible.',
      edge.status || 404,
      edge.code ?? 'PDF_RENDER_FAILED'
    );
  }
  try {
    const { renderQuotePdf, bytesToBase64 } = await import('../lib/render-quote-pdf');
    const numero =
      snapshot.numero?.trim() ||
      `IME-Q-${new Date().getFullYear()}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    const lineas = sanitizarLineasComercial(snapshot.productos, snapshot.moneda);
    const bytes = await renderQuotePdf({
      numero,
      clienteNombre: snapshot.nombre,
      empresa: snapshot.empresa,
      email: snapshot.email,
      telefono: snapshot.telefono,
      condiciones: snapshot.condiciones,
      validezHasta: snapshot.validez_hasta,
      moneda: snapshot.moneda,
      total: calcularTotalOfertado(lineas),
      lineas,
      locale: 'es',
      nombreComercial: state.nombre || state.email || 'Equipo comercial I-ME',
      correoComercial: state.email || 'ventas@i-me.com.co',
      telefonoComercial: state.telefono || '',
    });
    return ok({ pdf_base64: bytesToBase64(bytes), numero });
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : 'No se pudo generar el PDF.',
      500,
      'PDF_RENDER_FAILED'
    );
  }
}

export async function searchProducts(q: string): Promise<ProductHit[]> {
  const term = q.trim();
  if (term.length < 2 || !supabase) return [];
  const safe = term.replace(/[%_,]/g, '');
  if (!safe) return [];
  const { data, error } = await supabase
    .from('productos')
    .select('id,slug,sku,nombre_es')
    .eq('activo', true)
    .or(`nombre_es.ilike.%${safe}%,sku.ilike.%${safe}%,slug.ilike.%${safe}%`)
    .order('nombre_es', { ascending: true })
    .limit(20);
  if (error) return [];
  return (data ?? []) as ProductHit[];
}

async function listQuotesRest(
  query: Record<string, string>
): Promise<EdgeFunctionResult<QuoteListResult>> {
  if (!supabase) return fail('Supabase no configurado.');
  const session = await ensureAuthSession();
  if (!session) return fail('Sesión expirada. Vuelve a iniciar sesión.', 401);
  const tab = query.tab === 'enviadas' ? 'enviadas' : 'pendientes';
  const q = (query.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const estados =
    tab === 'enviadas' ? [...COTIZACION_ESTADOS_ENVIADAS] : [...COTIZACION_ESTADOS_PENDIENTES];

  let cols = DETAIL_CORE;
  let useNumero = false;
  let lastError = 'No fue posible cargar cotizaciones.';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let req = supabase
      .from('solicitudes_cotizacion')
      .select(cols, { count: 'exact' })
      .in('estado', estados)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (q) {
      const safe = q.replace(/[%_,]/g, '');
      if (safe) {
        const fields = useNumero
          ? `numero.ilike.%${safe}%,nombre.ilike.%${safe}%,empresa.ilike.%${safe}%,email.ilike.%${safe}%`
          : `nombre.ilike.%${safe}%,empresa.ilike.%${safe}%,email.ilike.%${safe}%`;
        req = req.or(fields);
      }
    }
    const { data, error, count } = await req;
    if (!error) {
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const names = await nombresPorUsuario(rows.map(r => String(r.created_by ?? '')));
      return ok({
        quotes: rows.map(row => mapQuoteRow(row, names.get(String(row.created_by ?? '')) ?? null)),
        total: count ?? rows.length,
        page,
        pageSize,
      });
    }
    lastError = error.message;
    if (!missingSchema(error.message, error.code)) return fail(error.message, 500);
    if (/numero/.test(error.message)) useNumero = false;
    if (attempt === 0) {
      cols =
        'id,estado,nombre,empresa,email,telefono,moneda,mercado,validez_hasta,condiciones,productos,precio_total_ofertado,created_at,metadata,crm_sync_status,locale,pedido_id,campaign,landing_path';
      continue;
    }
    cols =
      'id,estado,nombre,empresa,email,telefono,moneda,productos,condiciones,metadata,created_at,campaign,landing_path';
  }
  return fail(lastError, 500);
}

async function getQuoteRest(id: string): Promise<EdgeFunctionResult<{ quote: QuotePublic }>> {
  if (!supabase) return fail('Supabase no configurado.');
  const session = await ensureAuthSession();
  if (!session) return fail('Sesión expirada. Vuelve a iniciar sesión.', 401);
  const row = await fetchQuoteRow(id);
  if ('error' in row) return fail(row.error, row.status);
  const names = await nombresPorUsuario(row.created_by ? [row.created_by] : []);
  return ok({ quote: mapQuoteRow(row, names.get(row.created_by ?? '') ?? null) });
}

async function fetchQuoteRow(
  id: string
): Promise<Record<string, unknown> | { error: string; status: number }> {
  if (!supabase) return { error: 'Supabase no configurado.', status: 0 };
  const colSets = [
    DETAIL_CORE,
    DETAIL_RICH,
    'id,estado,nombre,empresa,email,telefono,moneda,mercado,validez_hasta,condiciones,productos,precio_total_ofertado,created_at,metadata,crm_sync_status,locale,pedido_id,campaign,landing_path',
    'id,estado,nombre,empresa,email,telefono,moneda,productos,condiciones,metadata,created_at,campaign,landing_path',
  ];
  let lastError = 'No se pudo cargar la cotización.';
  for (const cols of colSets) {
    const { data, error } = await supabase
      .from('solicitudes_cotizacion')
      .select(cols)
      .eq('id', id)
      .maybeSingle();
    if (!error && data) return asRow(data);
    if (!error && !data) return { error: 'Cotización no encontrada.', status: 404 };
    if (error) {
      lastError = error.message;
      if (missingSchema(error.message, error.code)) continue;
      return { error: error.message, status: 500 };
    }
  }
  return { error: lastError, status: 500 };
}

async function saveQuoteRest(
  input: QuoteSaveInput
): Promise<EdgeFunctionResult<{ quote: QuotePublic }>> {
  if (!supabase) return fail('Supabase no configurado.');
  const session = await ensureAuthSession();
  if (!session) return fail('Sesión expirada. Vuelve a iniciar sesión.', 401);
  const moneda = normalizarMonedaOferta(input.moneda);
  const productos = sanitizarLineasComercial(input.productos, moneda);
  const nombre = input.nombre.trim();
  const email = input.email.trim().toLowerCase();
  const telefono = input.telefono.trim();
  if (!nombre) return fail('Nombre del contacto requerido.', 422, 'SIN_NOMBRE');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail('Email del cliente inválido.', 422, 'SIN_EMAIL');
  }
  if (!telefono) return fail('Teléfono del contacto requerido.', 422, 'SIN_TELEFONO');

  const canon: Record<string, unknown> = {
    nombre,
    empresa: input.empresa.trim() || null,
    email,
    telefono,
    moneda,
    mercado: moneda === 'USD' ? 'INTL' : 'CO',
    productos,
    condiciones: input.condiciones.trim() || null,
    validez_hasta: input.validez_hasta,
    precio_total_ofertado: calcularTotalOfertado(productos),
    locale: 'es',
    leida: true,
  };

  if (input.id) {
    const existing = await fetchQuoteRow(input.id);
    if ('error' in existing) return fail(existing.error, existing.status);
    const estado = String(existing.estado ?? 'nueva');
    if (existing.pedido_id || !quoteEditable(estado)) {
      return fail(
        'Esta cotización ya no se edita. Crea una revisión.',
        409,
        'COTIZACION_INMUTABLE'
      );
    }
    const { error } = await supabase
      .from('solicitudes_cotizacion')
      .update(canon)
      .eq('id', input.id);
    if (error) return fail(error.message, 500);
    return getQuoteRest(input.id);
  }

  // created_by aún no existe en prod (migración PDF pendiente). No lo enviamos.
  let payload: Record<string, unknown> = {
    ...canon,
    estado: 'nueva',
    consentimiento_datos: false,
    landing_path: '/comercial',
    campaign: 'pwa-comercial',
    origen: 'pwa',
    tipo_solicitud: 'cotizacion',
  };
  let inserted = await supabase
    .from('solicitudes_cotizacion')
    .insert(payload)
    .select('id')
    .maybeSingle();
  for (let attempt = 0; attempt < 4 && inserted.error; attempt += 1) {
    if (!missingSchema(inserted.error.message, inserted.error.code)) break;
    payload = stripUnknownColumn(payload, inserted.error.message);
    inserted = await supabase
      .from('solicitudes_cotizacion')
      .insert(payload)
      .select('id')
      .maybeSingle();
  }
  if (inserted.error || !inserted.data) {
    return fail(inserted.error?.message ?? 'No se pudo guardar la cotización.', 500);
  }
  const newId = String((inserted.data as { id: string }).id);
  return getQuoteRest(newId);
}

async function duplicarQuoteRest(id: string): Promise<EdgeFunctionResult<{ quote: QuotePublic }>> {
  const current = await getQuoteRest(id);
  if (current.error || !current.data?.quote) return current;
  const quote = current.data.quote;
  return saveQuoteRest({
    nombre: quote.nombre,
    empresa: quote.empresa ?? '',
    email: quote.email,
    telefono: quote.telefono,
    moneda: quote.moneda,
    validez_hasta: quote.validez_hasta,
    condiciones: quote.condiciones,
    productos: quote.productos,
  });
}

async function nombresPorUsuario(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!supabase || unique.length === 0) return map;
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
