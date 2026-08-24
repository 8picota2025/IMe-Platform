/**
 * Helpers de oferta comercial sobre solicitudes_cotizacion.
 * Usados por CMS (admin), formalizar (front) y Edge Functions (crear-pago, enviar, convertir).
 */

export type CotizacionEstadoOferta =
  | 'nueva'
  | 'en_revision'
  | 'respondida'
  | 'enviada'
  | 'convertida'
  | 'expirada';

export interface CotizacionLineaOferta {
  slug: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  moneda: string;
  /** Precio aún no validado: no entra al sumatorio ni bloquea oferta. */
  precio_pendiente_validar?: boolean;
  notas?: string;
}

export interface CotizacionOfertaRow {
  id: string;
  nombre?: string | null;
  empresa?: string | null;
  email?: string | null;
  telefono?: string | null;
  productos?: unknown;
  condiciones?: string | null;
  validez_hasta?: string | null;
  precio_total_ofertado?: number | string | null;
  estado?: string | null;
  formalizacion_token_hash?: string | null;
  formalizacion_token_expira_at?: string | null;
  pedido_id?: string | null;
  locale?: string | null;
  mercado?: string | null;
  moneda?: string | null;
  metadata?: Record<string, unknown> | null;
  numero?: string | null;
  pdf_storage_path?: string | null;
  pdf_sha256?: string | null;
  pdf_revision?: number | null;
  send_claimed_at?: string | null;
  send_error?: string | null;
  created_by?: string | null;
  lead_comercial_id?: string | null;
  campaign?: string | null;
  landing_path?: string | null;
  referrer?: string | null;
  analytics_session_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}

const ESTADOS_FORMALIZABLES = new Set(['enviada', 'respondida']);

/**
 * Online checkout (crear-pago / convertir) must mark the quote `convertida`
 * only after `gateway.crearCheckout` succeeds. Claiming earlier leaves
 * COTIZACION_YA_CONVERTIDA + pedido `error_verificacion` with no checkout_url
 * when Wompi/Stripe blips — permanent stuck formalization.
 */
export function shouldClaimCotizacionAfterCheckout(checkoutOk: boolean): boolean {
  return checkoutOk === true;
}

export function parseLineasOferta(productos: unknown): CotizacionLineaOferta[] {
  if (!Array.isArray(productos)) return [];
  const out: CotizacionLineaOferta[] = [];
  for (const raw of productos) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const slug = String(row.slug ?? '').trim();
    const nombreRaw = String(row.nombre ?? '').trim();
    const nombre = nombreRaw || slug;
    const cantidad = Number(row.cantidad ?? 0);
    const precio = Number(row.precio_unitario ?? 0);
    const moneda = String(row.moneda ?? 'COP').trim() || 'COP';
    const pendiente =
      row.precio_pendiente_validar === true ||
      String(row.precio_estado ?? '')
        .trim()
        .toLowerCase() === 'pendiente_validar';
    // Solicitudes libres (chat, formulario abierto) llegan sin slug de catalogo.
    if (!nombre || !Number.isFinite(cantidad) || cantidad < 1) continue;
    const precioOk = !pendiente && Number.isFinite(precio) && precio > 0 ? precio : 0;
    const subtotalRaw = Number(row.subtotal);
    const subtotal = pendiente
      ? 0
      : Number.isFinite(subtotalRaw) && subtotalRaw > 0
        ? subtotalRaw
        : Math.round(precioOk * cantidad * 100) / 100;
    const linea: CotizacionLineaOferta = {
      slug,
      nombre: nombre || slug,
      cantidad: Math.floor(cantidad),
      precio_unitario: precioOk,
      subtotal,
      moneda,
    };
    if (pendiente) linea.precio_pendiente_validar = true;
    if (typeof row.notas === 'string' && row.notas.trim()) {
      linea.notas = row.notas.trim();
    }
    out.push(linea);
  }
  return out;
}

export function calcularTotalOfertado(lineas: CotizacionLineaOferta[]): number {
  return (
    Math.round(
      lineas.reduce((acc, l) => {
        if (l.precio_pendiente_validar) return acc;
        return acc + l.precio_unitario * l.cantidad;
      }, 0) * 100
    ) / 100
  );
}

export function normalizarMonedaOferta(value: unknown): 'COP' | 'USD' {
  return String(value ?? 'COP')
    .trim()
    .toUpperCase() === 'USD'
    ? 'USD'
    : 'COP';
}

/** Precio de catálogo usable en presupuesto (precio actual → oferta → regular). */
export function resolveCatalogUnitPrice(row: {
  precio?: number | null;
  precio_oferta?: number | null;
  precio_regular?: number | null;
}): number {
  for (const raw of [row.precio, row.precio_oferta, row.precio_regular]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function asUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/** Recompute subtotals + one currency. Does not require prices/condiciones. */
export function canonizarLineasOferta(
  lineas: CotizacionLineaOferta[],
  headerMoneda: unknown
):
  | { ok: true; lineas: CotizacionLineaOferta[]; total: number; moneda: 'COP' | 'USD' }
  | { ok: false; error: 'OFERTA_MONEDA_MIXTA' } {
  const moneda = normalizarMonedaOferta(headerMoneda);
  const mixed = lineas.some(l => normalizarMonedaOferta(l.moneda) !== moneda);
  if (mixed) return { ok: false, error: 'OFERTA_MONEDA_MIXTA' };
  const normalized: CotizacionLineaOferta[] = lineas.map(l => {
    const cantidad = Math.floor(l.cantidad);
    const pendiente = Boolean(l.precio_pendiente_validar);
    const precio = pendiente ? 0 : l.precio_unitario;
    const linea: CotizacionLineaOferta = {
      slug: l.slug,
      nombre: l.nombre,
      cantidad,
      precio_unitario: precio,
      subtotal: pendiente ? 0 : Math.round(precio * cantidad * 100) / 100,
      moneda,
    };
    if (pendiente) linea.precio_pendiente_validar = true;
    if (l.notas) linea.notas = l.notas;
    return linea;
  });
  return {
    ok: true,
    lineas: normalized,
    total: calcularTotalOfertado(normalized),
    moneda,
  };
}

/** Canonical lines + total for save/PDF/email/Formalizar. Recomputes subtotals. */
export function normalizarOferta(
  lineas: CotizacionLineaOferta[],
  condiciones: string | null | undefined,
  headerMoneda: unknown
):
  | { ok: true; lineas: CotizacionLineaOferta[]; total: number; moneda: 'COP' | 'USD' }
  | { ok: false; error: string } {
  if (lineas.length === 0) return { ok: false, error: 'OFERTA_SIN_LINEAS' };
  if (lineas.some(l => !l.precio_pendiente_validar && !(l.precio_unitario > 0))) {
    return { ok: false, error: 'OFERTA_SIN_PRECIO' };
  }
  if (!String(condiciones ?? '').trim()) {
    return { ok: false, error: 'OFERTA_SIN_CONDICIONES' };
  }
  return canonizarLineasOferta(lineas, headerMoneda);
}

export function formatQuoteNumero(year: number, seq: number): string {
  return `IME-Q-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * Número corto para el PDF (boceto `N°: 1030`).
 * `IME-Q-2026-000042` → `42`. Si no matchea, devuelve el valor limpio.
 */
export function displayQuoteNumero(numero: string | null | undefined): string {
  const raw = String(numero ?? '').trim();
  if (!raw) return '—';
  const m = /^IME-Q-\d{4}-(\d+)$/i.exec(raw);
  if (m?.[1]) {
    const n = Number.parseInt(m[1], 10);
    return Number.isFinite(n) ? String(n) : m[1];
  }
  return raw;
}

export function resultadoPlantillaInactiva(
  clave: string,
  failOnInactive: boolean
): { ok: boolean; detalle: string } {
  if (failOnInactive) {
    return { ok: false, detalle: `TEMPLATE_INACTIVE: plantilla ${clave} desactivada` };
  }
  return { ok: true, detalle: `plantilla ${clave} desactivada` };
}

export function ofertaCompleta(
  lineas: CotizacionLineaOferta[],
  condiciones: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  const r = normalizarOferta(lineas, condiciones, lineas[0]?.moneda ?? 'COP');
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export const COTIZACION_ESTADOS_PENDIENTES = ['nueva', 'en_revision', 'respondida'] as const;
export const COTIZACION_ESTADOS_ENVIADAS = ['enviada', 'convertida'] as const;

export function quoteEditable(estado: string | null | undefined): boolean {
  const value = String(estado ?? 'nueva');
  return value === 'nueva' || value === 'en_revision' || value === 'respondida';
}

/** Drop cost/unknown keys. Recompute subtotals. Force header currency. */
export function sanitizarLineasComercial(
  productos: unknown,
  headerMoneda: unknown
): CotizacionLineaOferta[] {
  const moneda = normalizarMonedaOferta(headerMoneda);
  return parseLineasOferta(productos).map(l => {
    const cantidad = Math.floor(l.cantidad);
    const pendiente = Boolean(l.precio_pendiente_validar);
    const precio = pendiente ? 0 : l.precio_unitario;
    const linea: CotizacionLineaOferta = {
      slug: l.slug,
      nombre: l.nombre,
      cantidad,
      precio_unitario: precio,
      subtotal: pendiente ? 0 : Math.round(precio * cantidad * 100) / 100,
      moneda,
    };
    if (pendiente) linea.precio_pendiente_validar = true;
    if (l.notas) linea.notas = l.notas;
    return linea;
  });
}

export function formatQuoteMoney(value: number, currency = 'COP'): string {
  const moneda = currency === 'USD' ? 'USD' : 'COP';
  const amount = Number.isFinite(value) ? value : 0;
  const digits = moneda === 'COP' ? 0 : 2;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(amount);
}

export function ofertaIncompleta(
  lineas: CotizacionLineaOferta[],
  condiciones: string | null | undefined
): boolean {
  return !ofertaCompleta(lineas, condiciones).ok;
}

export function tokenExpirado(expiraAt: string | null | undefined, now = new Date()): boolean {
  if (!expiraAt) return true;
  const t = Date.parse(expiraAt);
  if (!Number.isFinite(t)) return true;
  return t < now.getTime();
}

export function puedeFormalizar(row: CotizacionOfertaRow, now = new Date()): boolean {
  const estado = String(row.estado ?? '');
  if (!ESTADOS_FORMALIZABLES.has(estado)) return false;
  if (row.pedido_id) return false;
  if (tokenExpirado(row.formalizacion_token_expira_at, now)) return false;
  if (!row.formalizacion_token_hash) return false;
  return ofertaCompleta(parseLineasOferta(row.productos), row.condiciones).ok;
}

export function splitNombreApellido(nombreCompleto: string): { nombre: string; apellido: string } {
  const parts = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: 'Cliente', apellido: 'I-ME' };
  if (parts.length === 1) return { nombre: parts[0]!, apellido: 'Cliente' };
  return { nombre: parts[0]!, apellido: parts.slice(1).join(' ') };
}

export function formalizarPath(locale: string, id: string, token: string): string {
  const loc = locale === 'en' ? 'en' : 'es';
  const base = loc === 'en' ? `/${loc}/quote/formalize` : `/${loc}/cotizacion/formalizar`;
  return `${base}?id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`;
}

/** Hex sha256 — Web Crypto (browser/Deno) o Node crypto. */
export async function hashTokenSha256(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  return hashBytesSha256(data);
}

export async function hashBytesSha256(data: BufferSource): Promise<string> {
  const bytes = asUint8Array(data);
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const digestInput = new Uint8Array(bytes.byteLength);
    digestInput.set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', digestInput);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}

export function generarTokenFormalizacion(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function expiryFromValidez(
  validezHasta: string | null | undefined,
  defaultDays = 14,
  now = new Date()
): string {
  if (validezHasta) {
    const end = Date.parse(`${validezHasta}T23:59:59.999Z`);
    if (Number.isFinite(end) && end > now.getTime()) {
      return new Date(end).toISOString();
    }
  }
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() + defaultDays);
  return d.toISOString();
}

export async function verificarTokenFormalizacion(
  row: CotizacionOfertaRow,
  token: string,
  now = new Date()
): Promise<boolean> {
  if (!token || !row.formalizacion_token_hash) return false;
  if (
    !puedeFormalizar(row, now) &&
    String(row.estado) !== 'enviada' &&
    String(row.estado) !== 'respondida'
  ) {
    return false;
  }
  if (tokenExpirado(row.formalizacion_token_expira_at, now)) return false;
  if (row.pedido_id) return false;
  const hash = await hashTokenSha256(token);
  return hash === row.formalizacion_token_hash;
}
