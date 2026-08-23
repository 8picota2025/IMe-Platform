import { describe, expect, it } from 'vitest';
import {
  assertSafeImageUrl,
  hostAllowed,
  isBridgeAuthorized,
  resolveAllowedImageHosts,
} from '../../scripts/lib/ocr-bridge-security.mjs';

describe('ocr-bridge-security', () => {
  it('rejects requests when OCR_BRIDGE_SECRET is empty (fail closed)', () => {
    expect(isBridgeAuthorized('', 'Bearer anything')).toBe(false);
    expect(isBridgeAuthorized('   ', 'Bearer anything')).toBe(false);
    expect(isBridgeAuthorized('s3cret', '')).toBe(false);
    expect(isBridgeAuthorized('s3cret', 'Bearer wrong')).toBe(false);
    expect(isBridgeAuthorized('s3cret', 'Bearer s3cret')).toBe(true);
  });

  it('allowlists only https Supabase Storage URLs', () => {
    const hosts = resolveAllowedImageHosts('https://abcd1234.supabase.co', '');
    expect(hostAllowed('abcd1234.supabase.co', hosts)).toBe(true);
    expect(hostAllowed('evil.supabase.co.attacker.com', hosts)).toBe(false);

    const ok = assertSafeImageUrl(
      'https://abcd1234.supabase.co/storage/v1/object/sign/presupuestos-competencia/x.jpg?token=abc',
      hosts
    );
    expect(ok.ok).toBe(true);

    expect(
      assertSafeImageUrl('http://abcd1234.supabase.co/storage/v1/object/sign/x', hosts).ok
    ).toBe(false);
    expect(assertSafeImageUrl('https://127.0.0.1:11434/api/tags', hosts).ok).toBe(false);
    expect(assertSafeImageUrl('https://abcd1234.supabase.co/rest/v1/pedidos', hosts).ok).toBe(
      false
    );
    expect(
      assertSafeImageUrl('https://user:pass@abcd1234.supabase.co/storage/v1/object/sign/x', hosts)
        .ok
    ).toBe(false);
  });
});
