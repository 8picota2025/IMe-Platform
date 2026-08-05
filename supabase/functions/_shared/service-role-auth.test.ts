import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractBearerToken, isExactServiceRoleToken } from './service-role-auth.ts';

Deno.test('isExactServiceRoleToken: acepta coincidencia exacta', () => {
  assertEquals(isExactServiceRoleToken('sb_secret_live_abc', 'sb_secret_live_abc'), true);
});

Deno.test('isExactServiceRoleToken: rechaza JWT falsificado con role=service_role', () => {
  const forged =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJyb2xlIjoic2VydmljZV9yb2xlIiwicmVmIjoibm5mYnVjd2lhc3VnZ3lmb3l5ZG8ifQ.' +
    'forgedsig';
  assertEquals(isExactServiceRoleToken(forged, 'sb_secret_live_abc'), false);
});

Deno.test('extractBearerToken: quita prefijo Bearer', () => {
  assertEquals(extractBearerToken('Bearer abc'), 'abc');
  assertEquals(extractBearerToken(null), '');
});
