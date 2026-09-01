/**
 * Utilidades de formateo de datos para UI.
 */

import type { Locale } from '../i18n/utils';

/** Precio público: número finito estrictamente mayor que cero. */
export function tienePrecioPublico(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

/** Tasa confirmada para precios públicos en Colombia. */
export const IVA_COLOMBIA_PCT = 19;

/**
 * Convierte precio base COP a venta con IVA incluido.
 * COP se publica sin decimales: normaliza a pesos enteros y redondea IVA.
 */
export function precioConIvaColombia(precioBase: number): number | null {
  if (!tienePrecioPublico(precioBase)) return null;
  const baseEnPesos = Math.round(precioBase);
  return baseEnPesos + Math.round((baseEnPesos * IVA_COLOMBIA_PCT) / 100);
}

/** Precio público: campo base `precio_regular` de BD más IVA incluido. */
export function resolvePrecioPublico(row: unknown): number | null {
  if (!row || typeof row !== 'object') return null;
  const raw = (row as { precio_regular?: unknown }).precio_regular;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return precioConIvaColombia(n);
}

/** Normaliza moneda ISO 4217 almacenada; COP es fallback comercial de I-ME. */
export function normalizarMoneda(moneda: unknown): string {
  const codigo = typeof moneda === 'string' ? moneda.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(codigo) ? codigo : 'COP';
}

/**
 * Formatea un número como moneda COP o USD.
 * Nunca inventa precios — devuelve null si el valor es null.
 */
export function formatMoneda(
  valor: number | null | undefined,
  moneda: string | null | undefined = 'COP',
  locale: Locale = 'es'
): string | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) return null;
  const monedaNormalizada = normalizarMoneda(moneda);
  const localeCode = locale === 'en' ? 'en-US' : 'es-CO';
  try {
    return new Intl.NumberFormat(localeCode, {
      style: 'currency',
      currency: monedaNormalizada,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor);
  } catch {
    return `${monedaNormalizada} ${valor.toLocaleString()}`;
  }
}

/**
 * Formatea una fecha ISO a formato legible.
 */
export function formatFecha(iso: string, locale: Locale = 'es'): string {
  const localeCode = locale === 'en' ? 'en-US' : 'es-CO';
  try {
    return new Intl.DateTimeFormat(localeCode, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Trunca texto a maxLength caracteres con ellipsis.
 */
export function truncar(texto: string, maxLength: number): string {
  if (texto.length <= maxLength) return texto;
  return texto.slice(0, maxLength - 1) + '…';
}

/**
 * Convierte un string a slug URL-safe.
 */
export function toSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
