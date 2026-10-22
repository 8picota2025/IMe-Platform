/**
 * Sitemap eligibility — pathname-based, no substring false positives.
 * Shared by astro.config.mjs and scripts/validate-seo.mjs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HTACCESS_PATH = join(dirname(fileURLToPath(import.meta.url)), '../public/.htaccess');

/**
 * Slugs que `.htaccess` responde con 410. El sitemap solo lista canónicas vivas.
 * @param {string} [htaccess]
 * @returns {Set<string>}
 */
export function goneProductSlugs(htaccess = readFileSync(HTACCESS_PATH, 'utf8')) {
  const slugs = new Set();
  const grouped =
    /^RewriteRule \^\(\?:es\/productos\|en\/products\)\/\(\?:([^)]*)\)\(\?:\/index\\\.html\|\/\?\)\$ - \[G,L\]$/;
  const bothLocales =
    /^RewriteRule \^\(\?:es\/productos\|en\/products\)\/([a-z0-9.-]+)\(\?:\/index\\\.html\|\/\?\)\$ - \[G,L\]$/;
  const oneLocale = /^RewriteRule \^(?:es\/productos|en\/products)\/([a-z0-9.-]+)\/\?\$ - \[G,L\]$/;
  for (const line of htaccess.split('\n')) {
    const group = line.match(grouped);
    if (group) {
      for (const slug of group[1].split('|')) if (slug) slugs.add(slug);
      continue;
    }
    const shared = line.match(bothLocales);
    if (shared?.[1]) {
      slugs.add(shared[1]);
      continue;
    }
    const single = line.match(oneLocale);
    if (single?.[1]) slugs.add(single[1]);
  }
  return slugs;
}

const GONE_PRODUCT_SLUGS = goneProductSlugs();

/**
 * Exact paths that must never appear in the sitemap.
 *
 * `/about/`, `/contact/` and `/privacy/` 301 to their /en/ counterparts
 * (see public/.htaccess) and stay out of the sitemap.
 */
export const NON_INDEXABLE_PATHS = new Set([
  '/',
  '/about/',
  '/admin/',
  '/contact/',
  '/privacy/',
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

/**
 * Rutas de producto heredadas que responden con redirección permanente.
 * El sitemap debe contener solo la URL canónica de destino, nunca la fuente
 * de un 301. Mantenerlas aquí hasta que el registro heredado se retire del
 * catálogo de origen.
 */
export const REDIRECT_ONLY_PRODUCT_PATHS = new Set([
  '/es/productos/lampara-quirurgica-ref-ainno-saikang/',
  '/en/products/lampara-quirurgica-ref-ainno-saikang/',
  // Mismo combo publicado con dos SKU (G-LTD-B10-* y GMD-LTD-B10-*).
  '/es/productos/combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100/',
  '/en/products/combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100/',
  '/es/productos/combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200/',
  '/en/products/combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200/',
  // Mismo sistema radiográfico publicado con dos slugs.
  '/es/productos/sistema-radiografico-3d-ref-wr-3d-angell/',
  '/en/products/sistema-radiografico-3d-ref-wr-3d-angell/',
]);

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
  if (REDIRECT_ONLY_PRODUCT_PATHS.has(normalized)) return false;
  if (NON_INDEXABLE_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return false;
  if (/^\/(?:es\/productos|en\/products)\/test(?:\/|$|-)/.test(pathname)) return false;
  if (/^\/(?:es\/productos|en\/products)\/g-[^/]+/.test(pathname)) return false;
  if (/^\/(?:es\/familias|en\/families)\/terapia-de-infusion\/?$/.test(pathname)) return false;
  if (/test-de-pasarela-de-pagos/.test(pathname)) return false;
  if (/\/lib\/analytics\/?$/.test(pathname)) return false;
  const productSlug = pathname.match(/^\/(?:es\/productos|en\/products)\/([^/]+)\/?$/)?.[1];
  if (productSlug && GONE_PRODUCT_SLUGS.has(productSlug)) return false;
  // Datasheets are not pages. Equitronic competitor assets must not re-enter any sitemap.
  if (/\.pdf$/i.test(pathname)) return false;
  if (/\/assets\/importados\/equitronic(?:\/|$)/i.test(pathname)) return false;

  return true;
}
