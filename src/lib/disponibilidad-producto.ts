/**
 * Etiqueta de disponibilidad pública de una ficha de producto.
 *
 * Regla de negocio: «Disponible» solo se muestra cuando hay stock documentado
 * (número > 0). Sin stock documentado (null/undefined) nunca se afirma disponibilidad:
 * si no hay precio publicado o el modo es cotización/individualizado, se dice
 * «bajo cotización»; en el resto, «Consultar disponibilidad».
 */
import { t, type Locale } from '../i18n/utils';

export type NivelDisponibilidad =
  | 'no_disponible'
  | 'stock_documentado'
  | 'bajo_cotizacion'
  | 'consultar';

export interface EntradaDisponibilidad {
  disponible?: boolean | null | undefined;
  stock?: number | null | undefined;
  precio?: number | null | undefined;
  fulfillment_mode?: string | null | undefined;
}

const MODOS_COTIZACION = new Set(['cotizacion', 'individualizado']);

export function nivelDisponibilidad(entrada: EntradaDisponibilidad): NivelDisponibilidad {
  if (entrada.disponible === false || entrada.stock === 0) return 'no_disponible';
  if (typeof entrada.stock === 'number' && Number.isFinite(entrada.stock) && entrada.stock > 0) {
    return 'stock_documentado';
  }
  const sinPrecioPublico = !(typeof entrada.precio === 'number' && entrada.precio > 0);
  const modoCotizacion = MODOS_COTIZACION.has(entrada.fulfillment_mode ?? '');
  return sinPrecioPublico || modoCotizacion ? 'bajo_cotizacion' : 'consultar';
}

/** Texto completo, para la ficha (hero y bloque de disponibilidad). */
export function etiquetaDisponibilidad(
  entrada: EntradaDisponibilidad,
  locale: Locale,
  stockLimitado: (stock: number) => string
): string {
  switch (nivelDisponibilidad(entrada)) {
    case 'no_disponible':
      return t(locale, 'producto.ficha_no_disponible');
    case 'stock_documentado':
      return stockLimitado(Number(entrada.stock));
    case 'bajo_cotizacion':
      return t(locale, 'producto.ficha_bajo_cotizacion');
    case 'consultar':
      return t(locale, 'producto.cta_consultar_disponibilidad');
  }
}

/** Valor corto para tarjetas (la etiqueta «Disponibilidad» la pone el componente). */
export function valorCortoDisponibilidad(
  entrada: EntradaDisponibilidad,
  locale: Locale,
  stockLimitado: (stock: number) => string
): string {
  switch (nivelDisponibilidad(entrada)) {
    case 'no_disponible':
      return t(locale, 'producto.ficha_no_disponible');
    case 'stock_documentado':
      return stockLimitado(Number(entrada.stock));
    case 'bajo_cotizacion':
      return t(locale, 'producto.ficha_bajo_cotizacion_corto');
    case 'consultar':
      return t(locale, 'producto.ficha_consultar_corto');
  }
}
