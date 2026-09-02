import { describe, expect, it } from 'vitest';
import {
  formatMoneda,
  IVA_COLOMBIA_PCT,
  normalizarMoneda,
  precioConIvaColombia,
  resolvePrecioPublico,
  tienePrecioPublico,
} from './format';

describe('tienePrecioPublico', () => {
  it.each([12500000, 0.01])('acepta precio finito mayor que cero: %s', precio => {
    expect(tienePrecioPublico(precio)).toBe(true);
  });

  it.each([0, null, undefined, NaN, 'invalido'])('rechaza precio sin publicación: %s', precio => {
    expect(tienePrecioPublico(precio)).toBe(false);
  });
});

describe('resolvePrecioPublico', () => {
  it('convierte precio_regular neto a precio público con IVA incluido', () => {
    expect(IVA_COLOMBIA_PCT).toBe(19);
    expect(resolvePrecioPublico({ precio_regular: 1000000 })).toBe(1190000);
  });

  it.each([0, null, undefined, NaN, 'invalido'])(
    'devuelve null si precio_regular no es publicable: %s',
    precio_regular => {
      expect(resolvePrecioPublico({ precio_regular })).toBeNull();
    }
  );

  it('publica precio de oferta vigente con IVA incluido, igual que checkout', () => {
    expect(
      resolvePrecioPublico({
        precio_regular: 1000000,
        precio_oferta: 900000,
        oferta_inicio: '2020-01-01T00:00:00.000Z',
        oferta_fin: '2099-01-01T00:00:00.000Z',
      })
    ).toBe(1071000);
  });

  it('ignora oferta vencida y vuelve al precio regular con IVA incluido', () => {
    expect(
      resolvePrecioPublico({
        precio_regular: 1000000,
        precio_oferta: 900000,
        oferta_fin: '2020-01-01T00:00:00.000Z',
      })
    ).toBe(1190000);
  });
});

describe('precioConIvaColombia', () => {
  it.each([
    [100000, 119000],
    [1000000, 1190000],
    [49000000, 58310000],
    [3500, 4165],
  ])('calcula %i base como %i COP con IVA incluido', (base, esperado) => {
    expect(precioConIvaColombia(base)).toBe(esperado);
  });
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
