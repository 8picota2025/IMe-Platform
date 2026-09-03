import { describe, expect, it } from 'vitest';
import { resolveCheckoutEnvioTotal } from './checkout-envio';

describe('resolveCheckoutEnvioTotal', () => {
  it('skips zone shipping for locked quote checkouts (parity with formalizar)', () => {
    expect(
      resolveCheckoutEnvioTotal({
        mercado: 'CO',
        preciosLockedCotizacion: true,
        tarifaZona: 25_000,
      })
    ).toBe(0);
  });

  it('applies zone shipping for open CO carts', () => {
    expect(
      resolveCheckoutEnvioTotal({
        mercado: 'CO',
        preciosLockedCotizacion: false,
        tarifaZona: 25_000,
      })
    ).toBe(25_000);
  });

  it('skips shipping for INTL markets', () => {
    expect(
      resolveCheckoutEnvioTotal({
        mercado: 'INTL',
        preciosLockedCotizacion: false,
        tarifaZona: 25_000,
      })
    ).toBe(0);
  });
});
