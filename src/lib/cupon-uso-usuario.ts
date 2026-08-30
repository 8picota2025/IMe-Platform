/**
 * Per-email coupon limits (`limite_uso_por_usuario`) cannot rely on a
 * read-then-act count of `cupon_usos`. N parallel `crear-pago` calls all see
 * count < limite, then each open a discounted Wompi/Stripe checkout.
 *
 * Pattern: insert the `cupon_usos` row first, then re-count. If the post-insert
 * count exceeds the limit, delete this pedido's row and reject — at most
 * `limite` concurrent claims survive.
 */

/** Whether crear-pago must claim+verify a per-email slot before checkout. */
export function needsPerUserCuponClaim(
  limiteUsoPorUsuario: number | null | undefined
): boolean {
  return limiteUsoPorUsuario !== null && limiteUsoPorUsuario !== undefined;
}

/**
 * After inserting this request's `cupon_usos` row, is the email still within
 * the configured per-user limit? (`count` includes the row just inserted.)
 */
export function isWithinPerUserCuponLimit(args: {
  usoCountAfterClaim: number;
  limiteUsoPorUsuario: number;
}): boolean {
  const count = Math.max(0, Math.floor(args.usoCountAfterClaim));
  const limite = Math.floor(args.limiteUsoPorUsuario);
  if (!Number.isFinite(limite) || limite < 0) return false;
  return count <= limite;
}
