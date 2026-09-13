/**
 * Sitemap eligibility — pathname-based, no substring false positives.
 * Shared by astro.config.mjs and scripts/validate-seo.mjs.
 */

/** Exact paths that must never appear in the sitemap. */
export const NON_INDEXABLE_PATHS = new Set([
  '/',
  '/admin/',
  '/comercial/',
  '/congreso/',
  '/mkt/',
  '/es/carrito/',
  '/es/checkout/',
  '/es/cotizacion/',
  '/es/cotizacion/formalizar/',
  '/es/cuenta/',
  '/es/conocimiento/publicar/',
  '/es/seguimiento/',
  '/en/account/',
  '/en/cart/',
  '/en/checkout/',
  '/en/knowledge/publish/',
  '/en/order-status/',
  '/en/quote/',
  '/en/quote/formalize/',
  '/pagoswompi/',
]);

/**
 * Prefix trees (with or without trailing slash).
 * Match: pathname === prefix || pathname.startsWith(prefix + '/')
 * after normalizing trailing slash on the prefix root.
 */
export const NON_INDEXABLE_PREFIXES = [
  '/admin',
  '/comercial',
  '/mkt',
  '/congreso',
  '/77',
  '/1old',
  '/blog',
  '/es/pago',
  '/en/payment',
  '/es/carrito',
  '/es/checkout',
  '/es/cotizacion',
  '/es/cuenta',
  '/es/seguimiento',
  '/es/conocimiento/publicar',
  '/en/cart',
  '/en/checkout',
  '/en/quote',
  '/en/account',
  '/en/order-status',
  '/en/knowledge/publish',
  '/pagoswompi',
];

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function matchesPrefix(pathname, prefix) {
  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) || '/' : pathname;
  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return (
    normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`)
  );
}

/**
 * @param {string} page Absolute URL or path accepted by @astrojs/sitemap filter.
 * @returns {boolean} true if the URL may appear in the sitemap.
 */
export function isIndexableSitemapUrl(page) {
  let pathname;
  try {
    pathname = new URL(page, 'https://i-me.com.co').pathname;
  } catch {
    return false;
  }

  const normalized = normalizePathname(pathname);

  if (NON_INDEXABLE_PATHS.has(normalized)) return false;
  if (NON_INDEXABLE_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return false;
  if (/^\/(?:es\/productos|en\/products)\/test(?:\/|$|-)/.test(pathname)) return false;
  if (/test-de-pasarela-de-pagos/.test(pathname)) return false;

  return true;
}
