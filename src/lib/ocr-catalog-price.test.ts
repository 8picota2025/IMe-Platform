import { describe, expect, it } from 'vitest';
import {
  precioCatalogoParaOcr,
  precioCatalogoVigente,
  type OcrCatalogHit,
} from './ocr-catalog-price.ts';

const BASE: OcrCatalogHit = {
  slug: 'monitor-demo',
  nombre: 'Monitor Demo',
  precio: 500_000,
  precio_oferta: 100_000,
  precio_regular: 500_000,
  moneda: 'COP',
  oferta_inicio: '2020-01-01T00:00:00.000Z',
  oferta_fin: '2099-01-01T00:00:00.000Z',
};

describe('precioCatalogoVigente', () => {
  it('usa precio_oferta vigente', () => {
    expect(precioCatalogoVigente(BASE)).toBe(100_000);
  });

  it('ignora precio_oferta expirada y cae a precio regular', () => {
    const hit = { ...BASE, oferta_fin: '2020-01-01T00:00:00.000Z' };
    expect(precioCatalogoVigente(hit, Date.parse('2026-10-25T00:00:00.000Z'))).toBe(500_000);
  });

  it('ignora precio_oferta aún no iniciada', () => {
    const hit = {
      ...BASE,
      oferta_inicio: '2090-01-01T00:00:00.000Z',
      oferta_fin: '2099-01-01T00:00:00.000Z',
    };
    expect(precioCatalogoVigente(hit, Date.parse('2026-10-25T00:00:00.000Z'))).toBe(500_000);
  });
});

describe('precioCatalogoParaOcr', () => {
  it('acepta hit COP cuando el extracto es COP', () => {
    const r = precioCatalogoParaOcr(BASE, 'COP');
    expect(r).toEqual({
      slug: 'monitor-demo',
      nombre: 'Monitor Demo',
      precio: 100_000,
      moneda: 'COP',
    });
  });

  it('rechaza hit COP cuando el extracto es USD (no inyecta magnitudes COP en USD)', () => {
    expect(precioCatalogoParaOcr(BASE, 'USD')).toBeNull();
  });

  it('con oferta expirada y moneda OK devuelve regular', () => {
    const hit = { ...BASE, oferta_fin: '2020-06-01T00:00:00.000Z' };
    const r = precioCatalogoParaOcr(hit, 'COP', Date.parse('2026-10-25T00:00:00.000Z'));
    expect(r?.precio).toBe(500_000);
  });
});
