import { describe, expect, it } from 'vitest';
import {
  cuponTieneAllowlistEmail,
  normalizeCheckoutEmail,
  puedeUsarCuponAllowlist,
} from './cupon-email-auth';

describe('cuponTieneAllowlistEmail', () => {
  it('is false for empty / blank allowlists (public coupons)', () => {
    expect(cuponTieneAllowlistEmail(null)).toBe(false);
    expect(cuponTieneAllowlistEmail(undefined)).toBe(false);
    expect(cuponTieneAllowlistEmail([])).toBe(false);
    expect(cuponTieneAllowlistEmail(['', '  '])).toBe(false);
  });

  it('is true when any real entry exists', () => {
    expect(cuponTieneAllowlistEmail(['compras@hospital.com'])).toBe(true);
    expect(cuponTieneAllowlistEmail(['', '*@hospital.com'])).toBe(true);
  });
});

describe('puedeUsarCuponAllowlist', () => {
  it('allows public coupons without a session', () => {
    expect(puedeUsarCuponAllowlist('a@b.com', null, [])).toBe(true);
    expect(puedeUsarCuponAllowlist('a@b.com', null, null)).toBe(true);
  });

  it('denies allowlisted coupons without a verified session', () => {
    expect(puedeUsarCuponAllowlist('compras@hospital.com', null, ['compras@hospital.com'])).toBe(
      false
    );
    expect(puedeUsarCuponAllowlist('compras@hospital.com', '', ['compras@hospital.com'])).toBe(
      false
    );
  });

  it('denies when session email does not match checkout email', () => {
    expect(
      puedeUsarCuponAllowlist('compras@hospital.com', 'atacante@evil.test', [
        'compras@hospital.com',
      ])
    ).toBe(false);
  });

  it('allows only when verified session email matches checkout email', () => {
    expect(
      puedeUsarCuponAllowlist('compras@hospital.com', 'compras@hospital.com', [
        'compras@hospital.com',
      ])
    ).toBe(true);
    expect(
      puedeUsarCuponAllowlist('Compras@Hospital.com', '  compras@hospital.com ', [
        'compras@hospital.com',
      ])
    ).toBe(true);
  });
});

describe('normalizeCheckoutEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeCheckoutEmail('  A@B.COM ')).toBe('a@b.com');
  });
});
