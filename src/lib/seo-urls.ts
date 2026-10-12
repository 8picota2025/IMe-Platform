/**
 * URLs indexables para catálogo/familias — evita enlazar variantes con query params.
 */
import type { Locale } from '../i18n/utils';
import { listFamiliaSeoSlugs } from '../data/familia-seo';

const familyLandingSlugs = new Set(listFamiliaSeoSlugs());

export function catalogBasePath(locale: Locale): string {
  return locale === 'en' ? '/en/catalog/' : '/es/catalogo/';
}

export function familyLandingPath(locale: Locale, slug: string): string {
  return locale === 'en' ? `/en/families/${slug}/` : `/es/familias/${slug}/`;
}

/**
 * Enlace a una familia. Con landing SEO va a su URL limpia; sin landing va al catálogo base.
 * No se enlaza `?familia=<slug>`: el host lo redirige a `/familias/<slug>/` (ver `.htaccess`) y,
 * si esa landing no existe, el rastreador y el usuario acaban en un 404.
 */
export function familyCatalogHref(locale: Locale, slug: string): string {
  if (familyLandingSlugs.has(slug)) return familyLandingPath(locale, slug);
  return catalogBasePath(locale);
}

export function hasFamilyLanding(slug: string): boolean {
  return familyLandingSlugs.has(slug);
}
