import { describe, expect, it } from 'vitest';

import {
  isCuponLineaPermitidaConExcluirOfertas,
  isProductoEnOfertaVigente,
} from './cupon-excluir-ofertas';

describe('isProductoEnOfertaVigente', () => {
  const now = Date.parse('2026-08-29T12:00:00.000Z');

  it('false when precio_oferta is null or non-positive', () => {
    expect(isProductoEnOfertaVigente({ precioOferta: null, nowMs: now })).toBe(false);
    expect(isProductoEnOfertaVigente({ precioOferta: 0, nowMs: now })).toBe(false);
    expect(isProductoEnOfertaVigente({ precioOferta: -10, nowMs: now })).toBe(false);
  });

  it('true when offer has no window bounds', () => {
    expect(isProductoEnOfertaVigente({ precioOferta: 90000, nowMs: now })).toBe(true);
  });

  it('respects oferta_inicio / oferta_fin window', () => {
    expect(
      isProductoEnOfertaVigente({
        precioOferta: 90000,
        ofertaInicio: '2026-08-01T00:00:00.000Z',
        ofertaFin: '2026-08-31T23:59:59.000Z',
        nowMs: now,
      })
    ).toBe(true);
    expect(
      isProductoEnOfertaVigente({
        precioOferta: 90000,
        ofertaInicio: '2026-09-01T00:00:00.000Z',
        nowMs: now,
      })
    ).toBe(false);
    expect(
      isProductoEnOfertaVigente({
        precioOferta: 90000,
        ofertaFin: '2026-08-01T00:00:00.000Z',
        nowMs: now,
      })
    ).toBe(false);
  });
});

describe('isCuponLineaPermitidaConExcluirOfertas', () => {
  it('blocks offer lines only when excluir_ofertas is set', () => {
    expect(isCuponLineaPermitidaConExcluirOfertas({ excluirOfertas: true, enOferta: true })).toBe(
      false
    );
    expect(isCuponLineaPermitidaConExcluirOfertas({ excluirOfertas: true, enOferta: false })).toBe(
      true
    );
    expect(isCuponLineaPermitidaConExcluirOfertas({ excluirOfertas: false, enOferta: true })).toBe(
      true
    );
  });
});
