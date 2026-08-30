import { describe, expect, it } from 'vitest';
import { formatMoneda, normalizarMoneda, resolvePrecioPublico, tienePrecioPublico } from './format';

describe('tienePrecioPublico', () => {
  it.each([12500000, 0.01])('acepta precio finito mayor que cero: %s', precio => {
    expect(tienePrecioPublico(precio)).toBe(true);
  });

  it.each([0, null, undefined, NaN, 'invalido'])('rechaza precio sin publicación: %s', precio => {
    expect(tienePrecioPublico(precio)).toBe(false);
  });
});

describe('resolvePrecioPublico', () => {
  it('usa precio_regular cuando es finito y mayor que cero', () => {
    expect(resolvePrecioPublico({ precio_regular: 1200000 })).toBe(1200000);
  });

  it.each([0, null, undefined, NaN, 'invalido'])(
    'devuelve null si precio_regular no es publicable: %s',
    precio_regular => {
      expect(resolvePrecioPublico({ precio_regular })).toBeNull();
    }
  );
});

describe('formatMoneda', () => {
  it('rechaza importes no finitos sin alterar el uso genérico para totales cero', () => {
    expect(formatMoneda(0, 'COP', 'es')).toContain('0');
    expect(formatMoneda(NaN)).toBeNull();
  });

  it('normaliza moneda inválida a COP', () => {
    expect(normalizarMoneda('COP$')).toBe('COP');
    expect(formatMoneda(1000, 'COP$', 'es')).toBe(formatMoneda(1000, 'COP', 'es'));
  });
});
