import { describe, expect, it } from 'vitest';

import { canAttemptCuponClaim, decideCuponClaimMode, nextCuponUsos } from './cupon-claim';

describe('cupon-claim', () => {
  it('claims before checkout only when limite_uso_total is set', () => {
    expect(decideCuponClaimMode({ hasCupon: true, limiteUsoTotal: 1 })).toBe(
      'claim_before_checkout'
    );
    expect(decideCuponClaimMode({ hasCupon: true, limiteUsoTotal: 10 })).toBe(
      'claim_before_checkout'
    );
    expect(decideCuponClaimMode({ hasCupon: true, limiteUsoTotal: 0 })).toBe(
      'claim_before_checkout'
    );
    expect(decideCuponClaimMode({ hasCupon: true, limiteUsoTotal: null })).toBe(
      'burn_after_checkout'
    );
    expect(decideCuponClaimMode({ hasCupon: false, limiteUsoTotal: 1 })).toBe('skip');
  });

  it('blocks claim attempts at or past the limit', () => {
    expect(canAttemptCuponClaim({ usosActual: 0, limiteUsoTotal: 1 })).toBe(true);
    expect(canAttemptCuponClaim({ usosActual: 0, limiteUsoTotal: 2 })).toBe(true);
    expect(canAttemptCuponClaim({ usosActual: 1, limiteUsoTotal: 1 })).toBe(false);
    expect(canAttemptCuponClaim({ usosActual: 2, limiteUsoTotal: 2 })).toBe(false);
    expect(canAttemptCuponClaim({ usosActual: 5, limiteUsoTotal: 3 })).toBe(false);
  });

  it('computes the CAS target usos value', () => {
    expect(nextCuponUsos(0)).toBe(1);
    expect(nextCuponUsos(3)).toBe(4);
    expect(nextCuponUsos(-1)).toBe(1);
  });
});
