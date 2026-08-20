/**
 * Limited coupons (`limite_uso_total`) must reserve a use slot atomically
 * before a discounted checkout is created. A plain read of `cupones.usos`
 * then later `usos + 1` lets N parallel `crear-pago` calls all pass the
 * limit check and open N underpriced Wompi/Stripe sessions.
 *
 * Pattern: CAS claim (`UPDATE … SET usos = usos+1 WHERE usos = expected`)
 * before `crearCheckout`; release the claim if checkout fails.
 */

export type CuponClaimDecision = 'claim_before_checkout' | 'burn_after_checkout' | 'skip';

export function decideCuponClaimMode(args: {
  hasCupon: boolean;
  limiteUsoTotal: number | null | undefined;
}): CuponClaimDecision {
  if (!args.hasCupon) return 'skip';
  if (args.limiteUsoTotal !== null && args.limiteUsoTotal !== undefined) {
    return 'claim_before_checkout';
  }
  return 'burn_after_checkout';
}

/** Next usos value after a successful CAS claim from `usosActual`. */
export function nextCuponUsos(usosActual: number): number {
  return Math.max(0, Math.floor(usosActual)) + 1;
}

/**
 * Whether a CAS claim attempt may proceed given the row we just read.
 * Caller must still execute UPDATE … WHERE usos = usosActual.
 */
export function canAttemptCuponClaim(args: {
  usosActual: number;
  limiteUsoTotal: number;
}): boolean {
  const usos = Math.max(0, Math.floor(args.usosActual));
  const limite = Math.floor(args.limiteUsoTotal);
  if (!Number.isFinite(limite) || limite < 0) return false;
  return usos < limite;
}
