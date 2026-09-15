import { describe, expect, it } from 'vitest';
import {
  buildStripeCheckoutLineItems,
  stripeLineItemsTotalCents,
} from './stripe-checkout-amounts';

describe('buildStripeCheckoutLineItems', () => {
  const items = [
    { nombre: 'Probe A', cantidad: 2, precio_unitario: 40, moneda: 'USD' },
    { nombre: 'Probe B', cantidad: 1, precio_unitario: 20, moneda: 'USD' },
  ];

  it('keeps itemized lines when catalog subtotal matches server total', () => {
    const lines = buildStripeCheckoutLineItems(items, 100, 'pedido-abc');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      nombre: 'Probe A',
      cantidad: 2,
      unit_amount_cents: 4000,
    });
    expect(lines[1]).toMatchObject({
      nombre: 'Probe B',
      cantidad: 1,
      unit_amount_cents: 2000,
    });
    expect(stripeLineItemsTotalCents(lines)).toBe(10000);
  });

  it('charges the discounted server total, not the undiscounted catalog subtotal', () => {
    // Catalog subtotal = 100; coupon brings pedido.total to 80.
    const lines = buildStripeCheckoutLineItems(items, 80, 'a1b2c3d4-xxxx');
    expect(stripeLineItemsTotalCents(lines)).toBe(8000);
    expect(stripeLineItemsTotalCents(lines)).not.toBe(10000);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.unit_amount_cents).toBe(8000);
    expect(lines[0]?.cantidad).toBe(1);
  });

  it('never charges more than a 100% coupon total of zero', () => {
    const lines = buildStripeCheckoutLineItems(items, 0, 'free-order');
    expect(stripeLineItemsTotalCents(lines)).toBe(0);
  });

  it('preserves a single product name when only one line is discounted', () => {
    const single = [{ nombre: 'Ultrasound gel', cantidad: 3, precio_unitario: 10, moneda: 'USD' }];
    const lines = buildStripeCheckoutLineItems(single, 24, 'ref-1');
    expect(lines).toEqual([
      {
        nombre: 'Ultrasound gel',
        cantidad: 1,
        unit_amount_cents: 2400,
        moneda: 'usd',
      },
    ]);
  });
});
