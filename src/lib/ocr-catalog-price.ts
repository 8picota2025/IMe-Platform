/**
 * Precio de catálogo que el OCR de competencia puede copiar a un borrador.
 * Misma vigencia de oferta que `crear-pago` / `resolvePrecioPublico` (sin IVA).
 * No mezcla monedas: un hit COP no pisa una línea USD (ni al revés).
 */

export type OcrCatalogHit = {
  slug: string;
  nombre: string;
  precio: number | null;
  precio_oferta: number | null;
  precio_regular: number | null;
  moneda: string | null;
  oferta_inicio: string | null;
  oferta_fin: string | null;
};

export type OcrCatalogPrecio = {
  slug: string;
  nombre: string;
  precio: number;
  moneda: 'COP' | 'USD';
};

function asMoney(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizarMonedaCatalogo(value: unknown): 'COP' | 'USD' {
  return String(value ?? 'COP')
    .trim()
    .toUpperCase() === 'USD'
    ? 'USD'
    : 'COP';
}

/** Oferta solo si está dentro de [inicio, fin]; si no, precio / precio_regular. */
export function precioCatalogoVigente(hit: OcrCatalogHit, now = Date.now()): number {
  const oferta = asMoney(hit.precio_oferta);
  const regular = asMoney(hit.precio) ?? asMoney(hit.precio_regular) ?? 0;
  if (oferta == null) return regular;
  const inicioOk = !hit.oferta_inicio || new Date(hit.oferta_inicio).getTime() <= now;
  const finOk = !hit.oferta_fin || new Date(hit.oferta_fin).getTime() >= now;
  return inicioOk && finOk ? oferta : regular;
}

/**
 * Devuelve precio usable para mejorar una línea OCR, o null si la moneda del
 * catálogo no coincide con la del extracto (evita COP→USD / USD→COP).
 */
export function precioCatalogoParaOcr(
  hit: OcrCatalogHit,
  monedaExtracto: unknown,
  now = Date.now()
): OcrCatalogPrecio | null {
  const monedaHit = normalizarMonedaCatalogo(hit.moneda);
  const monedaLinea = normalizarMonedaCatalogo(monedaExtracto);
  if (monedaHit !== monedaLinea) return null;
  const precio = precioCatalogoVigente(hit, now);
  if (!(precio > 0)) return null;
  return {
    slug: hit.slug,
    nombre: hit.nombre,
    precio,
    moneda: monedaHit,
  };
}
