import { describe, expect, it } from 'vitest';
import { catalogBasePath, familyCatalogHref, familyLandingPath } from './seo-urls';

describe('seo-urls', () => {
  it('apunta familias con landing SEO a URL limpia', () => {
    expect(familyCatalogHref('es', 'monitores')).toBe('/es/familias/monitores/');
    expect(familyCatalogHref('en', 'monitores')).toBe('/en/families/monitores/');
  });

  it('sin landing enlaza al catálogo base y nunca a ?familia= (el host lo redirige a una landing inexistente)', () => {
    expect(familyCatalogHref('es', 'familia-inexistente-test')).toBe('/es/catalogo/');
    expect(familyCatalogHref('en', 'familia-inexistente-test')).toBe('/en/catalog/');
  });

  it('expone rutas base y landing', () => {
    expect(catalogBasePath('es')).toBe('/es/catalogo/');
    expect(familyLandingPath('en', 'cardiologia')).toBe('/en/families/cardiologia/');
  });
});
