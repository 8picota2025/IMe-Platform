import es from './es.json';
import en from './en.json';

export type Locale = 'es' | 'en';

const translations: Record<Locale, typeof es> = { es, en };

/**
 * Extracts locale from an Astro URL object or pathname string.
 * Routes: /es/..., /en/...
 */
export function getLocale(url: URL | string): Locale {
  const pathname = typeof url === 'string' ? url : url.pathname;
  if (pathname.startsWith('/en')) return 'en';
  return 'es';
}

/**
 * Typed translation helper.
 * Usage: t(locale, 'nav.catalogo')
 */
export function t(locale: Locale, key: string): string {
  const dict = translations[locale] ?? translations.es;
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = dict;
  for (const part of parts) {
    if (value == null || typeof value !== 'object') return key;
    value = (value as Record<string, unknown>)[part];
  }
  if (typeof value === 'string') return value;
  return key;
}

/**
 * Segmentos de ruta cuyo nombre difiere entre idiomas.
 * Solo se traduce el primer segmento del path (sección); slugs de
 * entidades (productos, etc.) se mantienen igual en ambos idiomas.
 */
const PATH_SEGMENT_PAIRS: Array<{ es: string; en: string }> = [
  { es: 'catalogo', en: 'catalog' },
  { es: 'contacto', en: 'contact' },
  { es: 'servicios', en: 'services' },
  { es: 'financiacion', en: 'financing' },
  { es: 'productos', en: 'products' },
  { es: 'conocimiento', en: 'knowledge' },
  { es: 'seguimiento', en: 'order-status' },
];

const LEGAL_SLUG_PAIRS: Array<{ es: string; en: string }> = [
  { es: 'privacidad', en: 'privacy' },
  { es: 'habeas-data', en: 'data-authorization' },
  { es: 'cookies', en: 'cookies' },
  { es: 'terminos', en: 'terms' },
  { es: 'envios', en: 'shipping' },
  { es: 'devoluciones', en: 'returns' },
  { es: 'garantias', en: 'warranty' },
  { es: 'copyright', en: 'copyright' },
];

const PATH_SEGMENT_LOOKUP = new Map<string, { es: string; en: string }>();
for (const pair of PATH_SEGMENT_PAIRS) {
  PATH_SEGMENT_LOOKUP.set(pair.es, pair);
  PATH_SEGMENT_LOOKUP.set(pair.en, pair);
}

const LEGAL_SLUG_LOOKUP = new Map<string, { es: string; en: string }>();
for (const pair of LEGAL_SLUG_PAIRS) {
  LEGAL_SLUG_LOOKUP.set(pair.es, pair);
  LEGAL_SLUG_LOOKUP.set(pair.en, pair);
}

/**
 * Returns the localized path for a given path + locale.
 * Strips the current locale prefix, translates the section segment
 * if needed (e.g. /catalogo <-> /catalog), and adds the target locale.
 */
export function getLocalizedPath(path: string, targetLocale: Locale): string {
  const stripped = path.replace(/^\/(es|en)/, '');
  if (!stripped || stripped === '/') return `/${targetLocale}`;

  const segments = stripped.split('/').filter(Boolean);
  const first = segments[0];
  const pair = first ? PATH_SEGMENT_LOOKUP.get(first) : undefined;
  if (pair && first) segments[0] = pair[targetLocale];
  if (segments[0] === 'legal' && segments[1]) {
    const legalPair = LEGAL_SLUG_LOOKUP.get(segments[1]);
    if (legalPair) segments[1] = legalPair[targetLocale];
  }

  return `/${targetLocale}/${segments.join('/')}`;
}

/**
 * Returns alternate link objects for hreflang.
 * currentPath should be the full pathname like /es/catalogo
 */
export function getAlternateLinks(
  currentPath: string
): Array<{ locale: Locale | 'x-default'; hreflang: string; href: string }> {
  const base = 'https://i-me.com.co';
  const esPath = getLocalizedPath(currentPath, 'es');
  const enPath = getLocalizedPath(currentPath, 'en');

  return [
    { locale: 'es', hreflang: 'es', href: `${base}${esPath}` },
    { locale: 'es', hreflang: 'es-CO', href: `${base}${esPath}` },
    { locale: 'en', hreflang: 'en', href: `${base}${enPath}` },
    { locale: 'x-default', hreflang: 'x-default', href: `${base}${esPath}` },
  ];
}

/**
 * Maps a localized entity slug to the correct path segment for the current locale.
 * For now, slugs are the same in both locales (English slugs may be added in F2).
 */
export function normalizeLocalizedSlug(
  entity: { slug: string; slug_en?: string },
  locale: Locale
): string {
  if (locale === 'en' && entity.slug_en) return entity.slug_en;
  return entity.slug;
}
