/**
 * Web Checkout de Wompi (Colombia / COP).
 * La misma firma que `WompiGateway.crearCheckout`:
 * SHA-256(reference + amount_in_cents + currency + integrity_secret).
 * Las llaves llegan por argumento: nunca se escriben en el código.
 */

export const WOMPI_CHECKOUT_BASE = 'https://checkout.wompi.co/p/';

export async function wompiIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  integritySecret: string
): Promise<string> {
  const data = `${reference}${amountInCents}${currency}${integritySecret}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export interface WompiCheckoutInput {
  publicKey: string;
  integritySecret: string;
  reference: string;
  /** Total a cobrar en la moneda indicada (COP con IVA incluido). */
  total: number;
  currency?: string;
  redirectUrl: string;
  email?: string;
  fullName?: string;
  phone?: string;
}

export async function buildWompiCheckoutUrl(
  input: WompiCheckoutInput
): Promise<{ ok: true; url: string; amountInCents: number } | { ok: false; error: string }> {
  const publicKey = input.publicKey.trim();
  const integritySecret = input.integritySecret.trim();
  if (!publicKey) {
    return { ok: false, error: 'BLOQUEANTE_BACKEND: WOMPI_PUBLIC_KEY no configurado' };
  }
  if (!integritySecret) {
    return { ok: false, error: 'BLOQUEANTE_BACKEND: WOMPI_INTEGRITY_SECRET no configurado' };
  }
  const reference = input.reference.trim();
  if (!reference) {
    return { ok: false, error: 'La cotización no tiene número para referenciar el pago Wompi.' };
  }
  if (!Number.isFinite(input.total) || input.total <= 0) {
    return { ok: false, error: 'Total inválido para el enlace Wompi.' };
  }
  const currency = (input.currency || 'COP').trim().toUpperCase();
  const amountInCents = Math.round(input.total * 100);
  const signature = await wompiIntegritySignature(
    reference,
    amountInCents,
    currency,
    integritySecret
  );
  const params = new URLSearchParams({
    'public-key': publicKey,
    currency,
    'amount-in-cents': String(amountInCents),
    reference,
    'signature:integrity': signature,
    'redirect-url': input.redirectUrl,
  });
  if (input.email != null) params.set('customer-data:email', input.email);
  if (input.fullName != null) params.set('customer-data:full-name', input.fullName);
  if (input.phone != null) params.set('customer-data:phone-number', input.phone);
  return {
    ok: true,
    url: `${WOMPI_CHECKOUT_BASE}?${params.toString()}`,
    amountInCents,
  };
}
