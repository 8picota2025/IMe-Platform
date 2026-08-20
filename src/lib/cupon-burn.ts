/**
 * Coupon consumption must happen only after the payment gateway successfully
 * creates a checkout session.
 *
 * Burning earlier permanently consumes single-use / per-user limited coupons
 * when crearCheckout fails (missing keys, upstream 5xx, network), leaving the
 * pedido in error_verificacion with no usable checkout_url and blocking retries
 * with CUPON_AGOTADO / CUPON_LIMITE_USUARIO.
 */

export type CuponBurnDecision = 'burn' | 'skip';

export function decideCuponBurn(args: {
  hasCupon: boolean;
  checkoutOk: boolean;
}): CuponBurnDecision {
  if (!args.hasCupon) return 'skip';
  if (!args.checkoutOk) return 'skip';
  return 'burn';
}
