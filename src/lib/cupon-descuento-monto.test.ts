import { describe, expect, it } from 'vitest';

import { calcularMontoDescuentoCupon } from './cupon-descuento-monto';

describe('calcularMontoDescuentoCupon', () => {
  it('porcentaje applies only to eligible base', () => {
    expect(
      calcularMontoDescuentoCupon({
        tipo: 'porcentaje',
        valor: 10,
        baseElegible: 100_000,
        unidadesElegibles: 1,
      })
    ).toBe(10_000);
  });

  it('monto_producto multiplies by eligible units and caps at base', () => {
    expect(
      calcularMontoDescuentoCupon({
        tipo: 'monto_producto',
        valor: 5_000,
        baseElegible: 50_000,
        unidadesElegibles: 3,
      })
    ).toBe(15_000);
    expect(
      calcularMontoDescuentoCupon({
        tipo: 'monto_producto',
        valor: 50_000,
        baseElegible: 40_000,
        unidadesElegibles: 2,
      })
    ).toBe(40_000);
  });

  it('monto_carrito caps at baseElegible (not full cart subtotal)', () => {
    // Cart: excluded MRI 20_000_000 + eligible gauze 50_000; coupon $5M off.
    // Bug: Math.min(subtotal, valor) = 5_000_000; fix: min(baseElegible, valor) = 50_000.
    expect(
      calcularMontoDescuentoCupon({
        tipo: 'monto_carrito',
        valor: 5_000_000,
        baseElegible: 50_000,
        unidadesElegibles: 1,
      })
    ).toBe(50_000);
  });

  it('monto_carrito equals valor when entire cart is eligible', () => {
    expect(
      calcularMontoDescuentoCupon({
        tipo: 'monto_carrito',
        valor: 100_000,
        baseElegible: 2_000_000,
        unidadesElegibles: 2,
      })
    ).toBe(100_000);
  });
});
