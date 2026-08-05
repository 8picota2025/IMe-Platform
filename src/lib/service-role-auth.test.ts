import { describe, expect, it } from 'vitest';
import { extractBearerToken, isExactServiceRoleToken } from './service-role-auth';

describe('isExactServiceRoleToken', () => {
  it('accepts exact sb_secret or JWT service key match', () => {
    expect(isExactServiceRoleToken('sb_secret_live_abc', 'sb_secret_live_abc')).toBe(true);
    expect(
      isExactServiceRoleToken(
        'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig',
        'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig'
      )
    ).toBe(true);
  });

  it('rejects forged JWT that only claims role=service_role', () => {
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJyb2xlIjoic2VydmljZV9yb2xlIiwicmVmIjoibm5mYnVjd2lhc3VnZ3lmb3l5ZG8ifQ.' +
      'forgedsig';
    expect(isExactServiceRoleToken(forged, 'sb_secret_live_abc')).toBe(false);
    expect(isExactServiceRoleToken(forged, 'eyJreal.service.role')).toBe(false);
  });

  it('rejects empty or mismatched tokens', () => {
    expect(isExactServiceRoleToken('', 'sb_secret_live_abc')).toBe(false);
    expect(isExactServiceRoleToken('sb_secret_live_abc', '')).toBe(false);
    expect(isExactServiceRoleToken('sb_secret_live_abc', null)).toBe(false);
    expect(isExactServiceRoleToken('other', 'sb_secret_live_abc')).toBe(false);
  });
});

describe('extractBearerToken', () => {
  it('strips Bearer prefix case-insensitively', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken('abc')).toBe('abc');
    expect(extractBearerToken(null)).toBe('');
  });
});
