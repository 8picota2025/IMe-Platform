import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression: congreso-ocr must pass a real RateLimitAccion.
 * Passing 'ocr' made THRESHOLDS[accion] undefined and crashed every OCR
 * request with TypeError during destructuring (badge-scan flow unusable).
 */
describe('congreso-ocr rate-limit accion', () => {
  it('uses a known RateLimitAccion (cotizacion), not the invalid "ocr" key', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'supabase/functions/congreso-ocr/index.ts'),
      'utf8'
    );
    expect(src).toMatch(/checkRateLimit\([\s\S]*?'cotizacion'\s*\)/);
    expect(src).not.toMatch(/checkRateLimit\([\s\S]*?'ocr'\s*\)/);
  });

  it('rate-limit module lists cotizacion and fails closed without destructure crash', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'supabase/functions/_shared/rate-limit.ts'),
      'utf8'
    );
    expect(src).toMatch(/cotizacion:/);
    expect(src).toMatch(/accion desconocida/);
    expect(src).toMatch(/THRESHOLDS\[accion\]/);
  });
});
