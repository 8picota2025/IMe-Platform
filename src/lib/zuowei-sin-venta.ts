/**
 * Las 9 fichas Zuowei publicadas en el catálogo (PR #242).
 * Sin registro sanitario INVIMA: no se venden. La plantilla sigue `disponible`.
 */
const ZUOWEI_SKUS = new Set([
  'ZW568',
  'ZW598',
  'ZW518',
  'ZW302',
  'ZW365D-2',
  'ZW366S',
  'ZW186',
  'ZW501',
  'ZW502',
]);

const ZUOWEI_SLUG = /zuowei-zw(?:568|598|518|302|365d-2|366s|186|501|502)$/;

export function esFichaZuowei(producto: {
  sku?: string | null | undefined;
  slug?: string | null | undefined;
}): boolean {
  const sku = producto.sku?.trim().toUpperCase() ?? '';
  if (ZUOWEI_SKUS.has(sku)) return true;
  return ZUOWEI_SLUG.test((producto.slug ?? '').toLowerCase());
}

/** `disponible === false` en estas fichas: no hay checkout ni cotización de venta. */
export function fichaZuoweiSinVenta(producto: {
  sku?: string | null | undefined;
  slug?: string | null | undefined;
  disponible?: boolean | null | undefined;
}): boolean {
  return producto.disponible === false && esFichaZuowei(producto);
}

export function specMencionaInvima(item: {
  clave?: string;
  valor?: string;
  grupo?: string | null;
}): boolean {
  return /invima/i.test(`${item.grupo ?? ''} ${item.clave ?? ''} ${item.valor ?? ''}`);
}

const NOTA_ES = 'Producto sin registro sanitario INVIMA en Colombia; no disponible para venta.';
const NOTA_EN =
  'This product has no INVIMA health registration in Colombia; not available for sale.';

/** Quita la promesa de precio y deja la nota de no venta si aún no está. */
export function textoSinPromesaDeVenta(texto: string, nota: string): string {
  const limpio = texto
    .replace(/Precio bajo cotización\.?/g, nota)
    .replace(/Price on request\.?/g, nota)
    .replace(/[^\n]*INVIMA en tr[aá]mite[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!limpio) return nota;
  if (limpio.includes(nota) || limpio.includes(NOTA_ES) || limpio.includes(NOTA_EN)) return limpio;
  return `${limpio}\n\n${nota}`;
}
