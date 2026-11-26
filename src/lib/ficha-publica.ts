/**
 * Fichas que el sitio responde con 410 o 301 no deben emitir Product.
 * La lista sale de public/.htaccess (la misma que usa el sitemap).
 */
import {
  goneProductSlugs,
  REDIRECT_ONLY_PRODUCT_PATHS,
} from '../../scripts/sitemap-indexability.mjs';
import type { Locale } from '../i18n/utils';

const RETIRADAS = goneProductSlugs();

export function fichaSinSchemaProducto(locale: Locale, slug: string): boolean {
  if (RETIRADAS.has(slug)) return true;
  const prefix = locale === 'en' ? '/en/products/' : '/es/productos/';
  return REDIRECT_ONLY_PRODUCT_PATHS.has(`${prefix}${slug}/`);
}
