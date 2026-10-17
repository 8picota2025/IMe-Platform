/**
 * Idioma de salida de una cotización.
 * `es` = solo castellano (COP nacional).
 * `es-en` = castellano e inglés (INTL, USD, locale en, o texto libre en inglés).
 */

export type IdiomaCotizacion = 'es' | 'es-en';

const PALABRAS_EN = [
  ' the ',
  ' and ',
  ' for ',
  ' with ',
  ' delivery ',
  ' payment ',
  ' quote ',
  ' price ',
  ' warranty ',
  ' shipping ',
  ' until ',
  ' bank ',
  ' quotation ',
];

const PALABRAS_ES = [
  ' el ',
  ' la ',
  ' los ',
  ' las ',
  ' para ',
  ' con ',
  ' entrega ',
  ' garantia ',
  ' precio ',
  ' validez ',
  ' pago ',
  ' cotizacion ',
];

function normalizarTexto(value: string): string {
  return ` ${value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')} `;
}

/** Heurística corta: el texto libre del usuario está en inglés y no en castellano. */
export function textoPareceIngles(texto: string | null | undefined): boolean {
  const plano = normalizarTexto(String(texto ?? ''));
  if (plano.trim().length < 12) return false;
  let ingles = 0;
  let castellano = 0;
  for (const palabra of PALABRAS_EN) if (plano.includes(palabra)) ingles += 1;
  for (const palabra of PALABRAS_ES) if (plano.includes(palabra)) castellano += 1;
  return ingles >= 2 && ingles > castellano;
}

export function normalizarIdiomaGuardado(value: unknown): IdiomaCotizacion | null {
  const crudo = String(value ?? '')
    .trim()
    .toLowerCase();
  if (crudo === 'es-en' || crudo === 'en' || crudo === 'bilingual' || crudo === 'es_en') {
    return 'es-en';
  }
  if (crudo === 'es') return 'es';
  return null;
}

/**
 * COP nacional sale siempre en castellano.
 * USD, mercado INTL, `idioma: es-en`, `locale: en` o texto libre en inglés → es-en.
 */
export function resolverIdiomaCotizacion(input: {
  moneda?: string | null | undefined;
  mercado?: string | null | undefined;
  locale?: string | null | undefined;
  idioma?: string | null | undefined;
  texto?: string | null | undefined;
}): IdiomaCotizacion {
  const moneda =
    String(input.moneda ?? 'COP')
      .trim()
      .toUpperCase() === 'USD'
      ? 'USD'
      : 'COP';
  const mercadoExplicito = String(input.mercado ?? '')
    .trim()
    .toUpperCase();
  const mercado = mercadoExplicito === 'INTL' || moneda === 'USD' ? 'INTL' : 'CO';
  if (moneda === 'COP' && mercado !== 'INTL') return 'es';
  const idioma = normalizarIdiomaGuardado(input.idioma);
  const locale = String(input.locale ?? '')
    .trim()
    .toLowerCase();
  if (
    idioma === 'es-en' ||
    locale === 'en' ||
    mercado === 'INTL' ||
    textoPareceIngles(input.texto)
  ) {
    return 'es-en';
  }
  return 'es';
}

export function etiquetaBilingue(
  castellano: string,
  ingles: string,
  idioma: 'es' | 'en' | IdiomaCotizacion
): string {
  if (idioma === 'en') return ingles;
  if (idioma === 'es-en') {
    const misma =
      castellano.trim().toLocaleLowerCase('es') === ingles.trim().toLocaleLowerCase('es');
    return misma ? castellano : `${castellano} / ${ingles}`;
  }
  return castellano;
}
