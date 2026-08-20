import { describe, expect, it } from 'vitest';
import { normalizeCheckoutEmail, puedeUsarListaPrecio } from './lista-precio-auth';

describe('puedeUsarListaPrecio', () => {
  it('denies price lists without a verified session', () => {
    expect(puedeUsarListaPrecio('compras@hospital.com', null)).toBe(false);
    expect(puedeUsarListaPrecio('compras@hospital.com', undefined)).toBe(false);
    expect(puedeUsarListaPrecio('compras@hospital.com', '')).toBe(false);
  });

  it('denies when session email does not match checkout email', () => {
    expect(puedeUsarListaPrecio('compras@hospital.com', 'atacante@evil.test')).toBe(false);
    expect(puedeUsarListaPrecio('compras@hospital.com', 'otro@hospital.com')).toBe(false);
  });

  it('allows only when verified session email matches (case/space insensitive)', () => {
    expect(puedeUsarListaPrecio('compras@hospital.com', 'compras@hospital.com')).toBe(true);
    expect(puedeUsarListaPrecio('Compras@Hospital.com', '  compras@hospital.com ')).toBe(true);
  });

  it('rejects malformed emails', () => {
    expect(puedeUsarListaPrecio('not-an-email', 'not-an-email')).toBe(false);
    expect(puedeUsarListaPrecio('', 'compras@hospital.com')).toBe(false);
  });
});

describe('normalizeCheckoutEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeCheckoutEmail('  A@B.COM ')).toBe('a@b.com');
  });
});
