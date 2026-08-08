import { describe, expect, it } from 'vitest';
import { decideCuponBurn } from './cupon-burn';

describe('decideCuponBurn', () => {
  it('burns only after a successful checkout when a coupon was applied', () => {
    expect(decideCuponBurn({ hasCupon: true, checkoutOk: true })).toBe('burn');
  });

  it('does not burn when crearCheckout fails (GATEWAY_ERROR path)', () => {
    expect(decideCuponBurn({ hasCupon: true, checkoutOk: false })).toBe('skip');
  });

  it('skips when no coupon was applied', () => {
    expect(decideCuponBurn({ hasCupon: false, checkoutOk: true })).toBe('skip');
    expect(decideCuponBurn({ hasCupon: false, checkoutOk: false })).toBe('skip');
  });
});
