/**
 * Stripe Checkout Session ids (cs_…) are required to call
 * GET /v1/checkout/sessions/{id}. Pedidos keep referencia_pasarela = pedido.id
 * (client_reference_id) for webhook lookup, so the session id must live in
 * metadata for success-page reconciliation via consultar-pedido.
 */

export const STRIPE_CHECKOUT_SESSION_META_KEY = 'stripe_checkout_session_id';

const STRIPE_SESSION_ID_RE = /^cs_[a-zA-Z0-9]+$/;

export function isStripeCheckoutSessionId(value: unknown): value is string {
  return typeof value === 'string' && STRIPE_SESSION_ID_RE.test(value);
}

export function extractStripeCheckoutSessionId(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  const value = metadata[STRIPE_CHECKOUT_SESSION_META_KEY];
  return isStripeCheckoutSessionId(value) ? value : null;
}

export function withStripeCheckoutSessionId(
  metadata: Record<string, unknown> | null | undefined,
  sessionId: string | null | undefined
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  if (isStripeCheckoutSessionId(sessionId)) {
    next[STRIPE_CHECKOUT_SESSION_META_KEY] = sessionId;
  }
  return next;
}

/**
 * Resolve the provider reference used by success-page reconciliation.
 * Wompi verifies by pedido reference; Stripe needs the Checkout Session id.
 */
export function resolvePaymentReconcileTarget(args: {
  proveedorPago: string | null | undefined;
  referenciaPasarela: string;
  metadata?: Record<string, unknown> | null;
}): { provider: 'wompi' | 'stripe'; reference: string } | null {
  if (args.proveedorPago === 'wompi') {
    return { provider: 'wompi', reference: args.referenciaPasarela };
  }
  if (args.proveedorPago === 'stripe') {
    const sessionId = extractStripeCheckoutSessionId(args.metadata);
    if (!sessionId) return null;
    return { provider: 'stripe', reference: sessionId };
  }
  return null;
}

/**
 * Terminal gateway states safe to apply from consultar-pedido reconciliation.
 * Excludes error_verificacion so transient Stripe API blips do not stick the
 * pedido (see webhook ACK recovery path).
 */
export function isPaymentReconcileTerminalEstado(estado: string): boolean {
  return (
    estado === 'pagado' ||
    estado === 'rechazado' ||
    estado === 'expirado' ||
    estado === 'cancelado' ||
    estado === 'reembolsado'
  );
}
