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
}

const ESTADOS_FORMALIZABLES = new Set(['enviada', 'respondida']);

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
    // Solicitudes libres (chat, formulario abierto) llegan sin slug de catalogo.
    if (!nombre || !Number.isFinite(cantidad) || cantidad < 1) continue;
    const precioOk = Number.isFinite(precio) && precio > 0 ? precio : 0;
    const subtotalRaw = Number(row.subtotal);
    const subtotal =
      Number.isFinite(subtotalRaw) && subtotalRaw > 0
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
    if (typeof row.notas === 'string' && row.notas.trim()) {
      linea.notas = row.notas.trim();
    }
    out.push(linea);
  }
  return out;
}

export function calcularTotalOfertado(lineas: CotizacionLineaOferta[]): number {
  return Math.round(lineas.reduce((acc, l) => acc + l.precio_unitario * l.cantidad, 0) * 100) / 100;
}

export function ofertaCompleta(
  lineas: CotizacionLineaOferta[],
  condiciones: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (lineas.length === 0) return { ok: false, error: 'OFERTA_SIN_LINEAS' };
  if (lineas.some(l => !(l.precio_unitario > 0))) {
    return { ok: false, error: 'OFERTA_SIN_PRECIO' };
  }
  if (!String(condiciones ?? '').trim()) {
    return { ok: false, error: 'OFERTA_SIN_CONDICIONES' };
  }
  return { ok: true };
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
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback Node (vitest)
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(token).digest('hex');
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
