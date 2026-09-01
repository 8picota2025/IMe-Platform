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

/** Enlace a familia con landing SEO; si no existe, filtro de catálogo (noindex vía redirect en host). */
export function familyCatalogHref(locale: Locale, slug: string): string {
  if (familyLandingSlugs.has(slug)) return familyLandingPath(locale, slug);
  return `${catalogBasePath(locale)}?familia=${encodeURIComponent(slug)}`;
}

export function hasFamilyLanding(slug: string): boolean {
  return familyLandingSlugs.has(slug);
}
