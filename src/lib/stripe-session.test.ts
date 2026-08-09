import { describe, expect, it } from 'vitest';

import {
  STRIPE_CHECKOUT_SESSION_META_KEY,
  extractStripeCheckoutSessionId,
  isPaymentReconcileTerminalEstado,
  isStripeCheckoutSessionId,
  resolvePaymentReconcileTarget,
  withStripeCheckoutSessionId,
} from './stripe-session';

describe('stripe-session', () => {
  it('accepts Stripe Checkout Session ids only', () => {
    expect(isStripeCheckoutSessionId('cs_test_abc123')).toBe(true);
    expect(isStripeCheckoutSessionId('cs_live_9A8B7C')).toBe(true);
    expect(isStripeCheckoutSessionId('pedido-uuid')).toBe(false);
    expect(isStripeCheckoutSessionId('pi_123')).toBe(false);
    expect(isStripeCheckoutSessionId('')).toBe(false);
    expect(isStripeCheckoutSessionId(null)).toBe(false);
  });

  it('extracts session id from pedido metadata', () => {
    expect(
      extractStripeCheckoutSessionId({
        [STRIPE_CHECKOUT_SESSION_META_KEY]: 'cs_test_abc123',
        origen: 'carrito',
      })
    ).toBe('cs_test_abc123');
    expect(extractStripeCheckoutSessionId({ foo: 'bar' })).toBeNull();
    expect(extractStripeCheckoutSessionId(null)).toBeNull();
  });

  it('merges session id into metadata without dropping prior keys', () => {
    expect(
      withStripeCheckoutSessionId({ locale: 'en', origen: 'carrito' }, 'cs_test_abc123')
    ).toEqual({
      locale: 'en',
      origen: 'carrito',
      [STRIPE_CHECKOUT_SESSION_META_KEY]: 'cs_test_abc123',
    });
    expect(withStripeCheckoutSessionId({ locale: 'en' }, 'not-a-session')).toEqual({
      locale: 'en',
    });
  });

  it('resolves Wompi reconcile by pedido reference and Stripe by session id', () => {
    expect(
      resolvePaymentReconcileTarget({
        proveedorPago: 'wompi',
        referenciaPasarela: 'pedido-1',
        metadata: {},
      })
    ).toEqual({ provider: 'wompi', reference: 'pedido-1' });

    expect(
      resolvePaymentReconcileTarget({
        proveedorPago: 'stripe',
        referenciaPasarela: 'pedido-1',
        metadata: { [STRIPE_CHECKOUT_SESSION_META_KEY]: 'cs_test_abc123' },
      })
    ).toEqual({ provider: 'stripe', reference: 'cs_test_abc123' });

    expect(
      resolvePaymentReconcileTarget({
        proveedorPago: 'stripe',
        referenciaPasarela: 'pedido-1',
        metadata: {},
      })
    ).toBeNull();

    expect(
      resolvePaymentReconcileTarget({
        proveedorPago: 'transferencia',
        referenciaPasarela: 'pedido-1',
      })
    ).toBeNull();
  });

  it('treats only terminal payment states as reconcile-safe', () => {
    expect(isPaymentReconcileTerminalEstado('pagado')).toBe(true);
    expect(isPaymentReconcileTerminalEstado('expirado')).toBe(true);
    expect(isPaymentReconcileTerminalEstado('rechazado')).toBe(true);
    expect(isPaymentReconcileTerminalEstado('pendiente')).toBe(false);
    expect(isPaymentReconcileTerminalEstado('error_verificacion')).toBe(false);
  });
});
