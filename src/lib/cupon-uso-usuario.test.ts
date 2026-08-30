import { describe, expect, it } from 'vitest';

import { isWithinPerUserCuponLimit, needsPerUserCuponClaim } from './cupon-uso-usuario';

describe('cupon-uso-usuario', () => {
  it('requires a claim only when limite_uso_por_usuario is set', () => {
    expect(needsPerUserCuponClaim(1)).toBe(true);
    expect(needsPerUserCuponClaim(0)).toBe(true);
    expect(needsPerUserCuponClaim(5)).toBe(true);
    expect(needsPerUserCuponClaim(null)).toBe(false);
    expect(needsPerUserCuponClaim(undefined)).toBe(false);
  });

  it('accepts post-insert counts at or under the per-user limit', () => {
    expect(
      isWithinPerUserCuponLimit({ usoCountAfterClaim: 1, limiteUsoPorUsuario: 1 })
    ).toBe(true);
    expect(
      isWithinPerUserCuponLimit({ usoCountAfterClaim: 2, limiteUsoPorUsuario: 2 })
    ).toBe(true);
    expect(
      isWithinPerUserCuponLimit({ usoCountAfterClaim: 1, limiteUsoPorUsuario: 3 })
    ).toBe(true);
  });

  it('rejects when the post-insert count exceeds the limit (race losers)', () => {
    expect(
      isWithinPerUserCuponLimit({ usoCountAfterClaim: 2, limiteUsoPorUsuario: 1 })
    ).toBe(false);
    expect(
      isWithinPerUserCuponLimit({ usoCountAfterClaim: 3, limiteUsoPorUsuario: 2 })
    ).toBe(false);
  });

  it('rejects non-finite or negative limits', () => {
    expect(
      isWithinPerUserCuponLimit({ usoCountAfterClaim: 0, limiteUsoPorUsuario: -1 })
    ).toBe(false);
    expect(
      isWithinPerUserCuponLimit({
        usoCountAfterClaim: 0,
        limiteUsoPorUsuario: Number.NaN,
      })
    ).toBe(false);
  });
});
