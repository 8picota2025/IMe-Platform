/**
 * B2B negotiated price lists must only apply when the checkout caller has a
 * verified session email that matches the cliente.email on the request.
 * Matching on the self-asserted email alone lets anyone open underpriced
 * Wompi/Stripe checkouts by spoofing a hospital purchasing email.
 */

export function normalizeCheckoutEmail(email: string | null | undefined): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

/** True only when a verified session email equals the checkout cliente email. */
export function puedeUsarListaPrecio(
  emailCliente: string | null | undefined,
  emailSesionVerificado: string | null | undefined
): boolean {
  const cliente = normalizeCheckoutEmail(emailCliente);
  const sesion = normalizeCheckoutEmail(emailSesionVerificado);
  if (!cliente || !sesion || !cliente.includes('@') || !sesion.includes('@')) return false;
  return cliente === sesion;
}
