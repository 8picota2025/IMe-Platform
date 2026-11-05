/**
 * Plazo de entrega por producto.
 *
 * Fuente: atributos.plazo_entrega_es / atributos.plazo_entrega_en (frase completa,
 * p. ej. "Entrega en 5 a 7 días hábiles"). Si la clave falta, está vacía o no es texto,
 * el producto no tiene plazo propio y los textos siguen usando el fijo de i18n
 * (producto.plazo_entrega / carrito.entrega_plazo / 10 días hábiles).
 */
import type { Locale } from '../i18n/utils';

/** Tope de longitud: el plazo se pinta en una línea de ficha y en el carrito. */
const LONGITUD_MAX_PLAZO = 160;

export function plazoEntregaDesdeAtributos(atributos: unknown, locale: Locale): string | null {
  if (!atributos || typeof atributos !== 'object') return null;
  const valor = (atributos as Record<string, unknown>)[`plazo_entrega_${locale}`];
  if (typeof valor !== 'string') return null;
  const limpio = valor.replace(/\s+/g, ' ').trim();
  if (!limpio || limpio.length > LONGITUD_MAX_PLAZO) return null;
  return limpio;
}

/** Frase de entrega para párrafos (SEO, FAQ): el plazo del producto o el texto fijo. */
export function fraseEntrega(plazo: string | null | undefined, predeterminada: string): string {
  if (!plazo) return predeterminada;
  return /[.!?]$/.test(plazo) ? plazo : `${plazo}.`;
}

/** Plazo común a todos los productos. null si no hay ninguno o si difieren. */
export function plazoCompartido(
  productos: ReadonlyArray<{ plazo_entrega?: string | null }>
): string | null {
  if (productos.length === 0) return null;
  const plazos = new Set(productos.map(producto => producto.plazo_entrega ?? null));
  if (plazos.size !== 1) return null;
  const [unico] = plazos;
  return unico ?? null;
}

/**
 * Texto de entrega del resumen de carrito: plazos únicos de las líneas.
 * Las líneas sin plazo propio cuentan con el predeterminado.
 */
export function plazoEntregaCarrito(
  items: ReadonlyArray<{ plazo_entrega?: string | null }>,
  predeterminado: string
): string {
  const unicos = [...new Set(items.map(item => item.plazo_entrega || predeterminado))];
  return unicos.length > 0 ? unicos.join(' · ') : predeterminado;
}
