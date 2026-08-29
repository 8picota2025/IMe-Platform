import { describe, expect, it } from 'vitest';
import { isValidArticuloSlug, sanitizeArticuloSlug, slugifyArticulo } from './articulo-slug';

describe('articulo-slug', () => {
  it('slugifyArticulo normaliza acentos y espacios', () => {
    expect(slugifyArticulo('Guía Biomédica 2025')).toBe('guia-biomedica-2025');
  });

  it('sanitizeArticuloSlug extrae segmento de URL pegada', () => {
    expect(sanitizeArticuloSlug('https://i-me.com.co/es/conocimiento/')).toBe('conocimiento');
    expect(
      sanitizeArticuloSlug(
        'https://i-me.com.co/es/conocimiento/guia-actualizada-distribuidores-importacion-y-regulacion-2025-biomedicos/'
      )
    ).toBe('guia-actualizada-distribuidores-importacion-y-regulacion-2025-biomedicos');
  });

  it('isValidArticuloSlug rechaza URLs y slugs vacíos', () => {
    expect(isValidArticuloSlug('guia-biomedica')).toBe(true);
    expect(isValidArticuloSlug('https://i-me.com.co/es/conocimiento/')).toBe(false);
    expect(isValidArticuloSlug('conocimiento')).toBe(false);
    expect(isValidArticuloSlug('')).toBe(false);
  });
});
