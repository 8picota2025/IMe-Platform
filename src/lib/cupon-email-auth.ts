/**
 * Coupons with a non-empty `emails_permitidos` allowlist must only apply when
 * the checkout caller has a verified Auth session email that matches
 * `cliente.email`. Matching the allowlist against the self-asserted body email
 * alone lets anyone open underpriced Wompi/Stripe checkouts by spoofing a
 * partner / hospital purchasing address.
 */

export function normalizeCheckoutEmail(email: string | null | undefined): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

/** True when the coupon has at least one non-empty allowlist entry. */
export function cuponTieneAllowlistEmail(emailsPermitidos: string[] | null | undefined): boolean {
  return (emailsPermitidos ?? []).some(rule => rule.trim().length > 0);
}

/**
 * Exclusive (allowlisted) coupons require a verified session email equal to
 * the checkout cliente email. Public coupons (empty allowlist) skip this gate.
 */
export function puedeUsarCuponAllowlist(
  emailCliente: string | null | undefined,
  emailSesionVerificado: string | null | undefined,
  emailsPermitidos: string[] | null | undefined
): boolean {
  if (!cuponTieneAllowlistEmail(emailsPermitidos)) return true;
  const cliente = normalizeCheckoutEmail(emailCliente);
  const sesion = normalizeCheckoutEmail(emailSesionVerificado);
  if (!cliente || !sesion || !cliente.includes('@') || !sesion.includes('@')) return false;
  return cliente === sesion;
}
