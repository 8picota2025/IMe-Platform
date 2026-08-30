/**
 * Sitemap SEO: prioridades, lastmod, hreflang y chunks (pages / products / knowledge).
 * Consumido desde astro.config.mjs en build estático.
 */
const SITE = 'https://i-me.com.co';

/** Fecha del build — Google recibe señal fresca en cada deploy. */
export const SITEMAP_BUILD_DATE = new Date();

const PATH_SEGMENT_PAIRS = [
  { es: 'nosotros', en: 'about' },
  { es: 'catalogo', en: 'catalog' },
  { es: 'contacto', en: 'contact' },
  { es: 'servicios', en: 'services' },
  { es: 'financiacion', en: 'financing' },
  { es: 'productos', en: 'products' },
  { es: 'conocimiento', en: 'knowledge' },
  { es: 'seguimiento', en: 'order-status' },
  { es: 'proyectos', en: 'projects' },
  { es: 'torres-laparoscopia', en: 'laparoscopy-towers' },
  { es: 'esterilizacion', en: 'sterilization' },
  { es: 'imagenologia', en: 'imaging' },
  { es: 'robotica-rehabilitacion', en: 'robotics-rehabilitation' },
  { es: 'caminadores-para-adultos', en: 'adult-walkers' },
  { es: 'sillas-de-ruedas', en: 'wheelchairs' },
  { es: 'monitores-biolight-uci', en: 'biolight-icu-monitors' },
  { es: 'alto-flujo-fisher-paykel', en: 'fisher-paykel-high-flow' },
  { es: 'camillas-medicas', en: 'medical-stretchers' },
  { es: 'ventiladores-mecanicos-uci', en: 'mechanical-ventilators-icu' },
  { es: 'desfibriladores-hospitalarios', en: 'hospital-defibrillators' },
  { es: 'fabricantes', en: 'manufacturers' },
  { es: 'familias', en: 'families' },
  { es: 'ciudades', en: 'cities' },
  { es: 'recursos', en: 'resources' },
  { es: 'cotizacion', en: 'quote' },
  { es: 'carrito', en: 'cart' },
  { es: 'cuenta', en: 'account' },
  { es: 'checkout', en: 'checkout' },
];

const LEGAL_SLUG_PAIRS = [
  { es: 'privacidad', en: 'privacy' },
  { es: 'habeas-data', en: 'data-authorization' },
  { es: 'cookies', en: 'cookies' },
  { es: 'terminos', en: 'terms' },
  { es: 'envios', en: 'shipping' },
  { es: 'devoluciones', en: 'returns' },
  { es: 'garantias', en: 'warranty' },
  { es: 'copyright', en: 'copyright' },
];

const PATH_SEGMENT_LOOKUP = new Map();
for (const pair of PATH_SEGMENT_PAIRS) {
  PATH_SEGMENT_LOOKUP.set(pair.es, pair);
  PATH_SEGMENT_LOOKUP.set(pair.en, pair);
}

const LEGAL_SLUG_LOOKUP = new Map();
for (const pair of LEGAL_SLUG_PAIRS) {
  LEGAL_SLUG_LOOKUP.set(pair.es, pair);
  LEGAL_SLUG_LOOKUP.set(pair.en, pair);
}

/** Landings y artículos SEO recientes — prioridad alta + changefreq weekly. */
const HIGH_PRIORITY_ES_PATHS = new Set([
  '/es/',
  '/es/monitores-biolight-uci/',
  '/es/alto-flujo-fisher-paykel/',
  '/es/camillas-medicas/',
  '/es/ventiladores-mecanicos-uci/',
  '/es/desfibriladores-hospitalarios/',
  '/es/caminadores-para-adultos/',
  '/es/sillas-de-ruedas/',
  '/es/torres-laparoscopia/',
  '/es/esterilizacion/',
  '/es/imagenologia/',
  '/es/robotica-rehabilitacion/',
  '/es/conocimiento/caminadores-para-adultos-guia-compra-colombia/',
  '/es/conocimiento/guia-monitores-multiparametricos-uci/',
  '/es/proyectos/',
  '/es/servicios/',
  '/es/catalogo/',
  '/es/nosotros/',
  '/es/contacto/',
  '/es/financiacion/',
]);

function withTrailingSlash(path) {
  const [baseAndQuery, hash = ''] = path.split('#', 2);
  const [base, query = ''] = baseAndQuery.split('?', 2);
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

function getLocalizedPath(path, targetLocale) {
  const stripped = path.replace(/^\/(es|en)/, '');
  if (!stripped || stripped === '/') return `/${targetLocale}/`;

  const segments = stripped.split('/').filter(Boolean);
  const first = segments[0];
  const pair = first ? PATH_SEGMENT_LOOKUP.get(first) : undefined;
  if (pair && first) segments[0] = pair[targetLocale];
  if (segments[0] === 'legal' && segments[1]) {
    const legalPair = LEGAL_SLUG_LOOKUP.get(segments[1]);
    if (legalPair) segments[1] = legalPair[targetLocale];
  }

  return withTrailingSlash(`/${targetLocale}/${segments.join('/')}`);
}

function pathnameFromUrl(url) {
  return new URL(url).pathname;
}

function esPathname(pathname) {
  if (pathname.startsWith('/es/') || pathname === '/es/') return pathname;
  return getLocalizedPath(pathname, 'es');
}

function isHighPriority(pathname) {
  return HIGH_PRIORITY_ES_PATHS.has(esPathname(pathname));
}

function hreflangLinks(pathname) {
  if (!/^\/(es|en)(\/|$)/.test(pathname)) return undefined;
  const esPath = getLocalizedPath(pathname, 'es');
  const enPath = getLocalizedPath(pathname, 'en');
  return [
    { url: `${SITE}${esPath}`, lang: 'es' },
    { url: `${SITE}${esPath}`, lang: 'es-CO' },
    { url: `${SITE}${enPath}`, lang: 'en' },
    { url: `${SITE}${esPath}`, lang: 'x-default' },
  ];
}

function priorityFor(pathname) {
  if (pathname === '/es/' || pathname === '/en/') return 1;
  if (isHighPriority(pathname)) return 0.9;
  if (/\/(?:es|en)\/(?:familias|families)\//.test(pathname)) return 0.85;
  if (/\/(?:es|en)\/(?:fabricantes|manufacturers)\//.test(pathname)) return 0.8;
  if (/\/(?:es|en)\/(?:conocimiento|knowledge)\//.test(pathname)) return 0.75;
  if (/\/(?:es|en)\/(?:productos|products)\//.test(pathname)) return 0.65;
  if (/\/(?:es|en)\/(?:ciudades|cities)\//.test(pathname)) return 0.5;
  if (/\/(?:es|en)\/legal\//.test(pathname)) return 0.4;
  return 0.7;
}

function changefreqFor(pathname) {
  if (pathname === '/es/' || pathname === '/en/') return 'weekly';
  if (isHighPriority(pathname)) return 'weekly';
  if (/\/(?:es|en)\/(?:conocimiento|knowledge)\//.test(pathname)) return 'weekly';
  if (/\/(?:es|en)\/(?:familias|families)\//.test(pathname)) return 'weekly';
  if (/\/(?:es|en)\/(?:productos|products)\//.test(pathname)) return 'monthly';
  if (/\/(?:es|en)\/legal\//.test(pathname)) return 'yearly';
  return 'monthly';
}

/** @param {import('@astrojs/sitemap').SitemapItem} item */
export function serializeSitemapItem(item) {
  const pathname = pathnameFromUrl(item.url);
  const links = hreflangLinks(pathname);
  return {
    ...item,
    lastmod: SITEMAP_BUILD_DATE.toISOString(),
    priority: priorityFor(pathname),
    changefreq: changefreqFor(pathname),
    ...(links ? { links } : {}),
  };
}

/** @param {import('@astrojs/sitemap').SitemapItem} item */
export function chunkProducts(item) {
  const pathname = pathnameFromUrl(item.url);
  if (/\/(?:productos|products)\//.test(pathname)) return serializeSitemapItem(item);
  return undefined;
}

/** @param {import('@astrojs/sitemap').SitemapItem} item */
export function chunkKnowledge(item) {
  const pathname = pathnameFromUrl(item.url);
  if (/\/(?:conocimiento|knowledge)\//.test(pathname)) return serializeSitemapItem(item);
  return undefined;
}

export const sitemapIntegrationOptions = {
  filter: undefined, // set in astro.config.mjs (needs isIndexableSitemapUrl)
  lastmod: SITEMAP_BUILD_DATE,
  entryLimit: 500,
  serialize: serializeSitemapItem,
  chunks: {
    products: chunkProducts,
    knowledge: chunkKnowledge,
  },
  namespaces: {
    news: false,
    xhtml: true,
    image: false,
    video: false,
  },
};
