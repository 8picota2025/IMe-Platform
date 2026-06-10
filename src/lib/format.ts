/**
 * Utilidades de formateo de datos para UI.
 */

import type { Locale } from '../i18n/utils'

/**
 * Formatea un número como moneda COP o USD.
 * Nunca inventa precios — devuelve null si el valor es null.
 */
export function formatMoneda(
  valor: number | null,
  moneda = 'COP',
  locale: Locale = 'es'
): string | null {
  if (valor === null || valor === undefined) return null
  const localeCode = locale === 'en' ? 'en-US' : 'es-CO'
  try {
    return new Intl.NumberFormat(localeCode, {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor)
  } catch {
    return `${moneda} ${valor.toLocaleString()}`
  }
}

/**
 * Formatea una fecha ISO a formato legible.
 */
export function formatFecha(iso: string, locale: Locale = 'es'): string {
  const localeCode = locale === 'en' ? 'en-US' : 'es-CO'
  try {
    return new Intl.DateTimeFormat(localeCode, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/**
 * Trunca texto a maxLength caracteres con ellipsis.
 */
export function truncar(texto: string, maxLength: number): string {
  if (texto.length <= maxLength) return texto
  return texto.slice(0, maxLength - 1) + '…'
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
    .replace(/^-|-$/g, '')
}
