import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SITEVERIFY_TIMEOUT_MS,
  SITEVERIFY_URL,
  sanitizeTurnstileLogMeta,
  verifyTurnstileToken,
  type TurnstileFetch,
} from './turnstile-verify';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('verifyTurnstileToken', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('falla cerrado sin secreto y sin llamar a siteverify', async () => {
    const fetchImpl = vi.fn<TurnstileFetch>();
    const log = vi.fn();
    await expect(
      verifyTurnstileToken({ secret: undefined, token: 'tok', fetchImpl, log })
    ).resolves.toEqual({ success: false, reason: 'not_configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Turnstile not configured', { reason: 'not_configured' });
  });

  it('falla cerrado sin token y sin llamar a siteverify', async () => {
    const fetchImpl = vi.fn<TurnstileFetch>();
    const started = Date.now();
    const result = await verifyTurnstileToken({
      secret: 'test-secret',
      token: undefined,
      fetchImpl,
    });
    expect(result).toEqual({ success: false, reason: 'missing_token' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(Date.now() - started).toBeLessThan(50);
  });

  it('acepta siteverify success', async () => {
    const fetchImpl: TurnstileFetch = async () => jsonResponse({ success: true });
    await expect(
      verifyTurnstileToken({ secret: 'test-secret', token: 'tok', fetchImpl })
    ).resolves.toEqual({ success: true });
  });

  it('mapea error-codes de Cloudflare como invalid', async () => {
    const fetchImpl: TurnstileFetch = async () =>
      jsonResponse({
        success: false,
        'error-codes': ['invalid-input-response', 'timeout-or-duplicate'],
      });
    await expect(
      verifyTurnstileToken({ secret: 'test-secret', token: 'garbage', fetchImpl })
    ).resolves.toEqual({
      success: false,
      reason: 'invalid',
      errorCodes: ['invalid-input-response', 'timeout-or-duplicate'],
    });
  });

  it('aborta siteverify colgado y devuelve siteverify_timeout', async () => {
    const fetchImpl: TurnstileFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });

    const log = vi.fn();
    const result = await verifyTurnstileToken({
      secret: 'test-secret',
      token: 'tok',
      fetchImpl,
      timeoutMs: 20,
      log,
    });

    expect(result).toEqual({
      success: false,
      reason: 'error',
      errorCodes: ['siteverify_timeout'],
    });
    expect(log).toHaveBeenCalledWith('Turnstile siteverify timeout', {
      reason: 'error',
      errorCodes: ['siteverify_timeout'],
    });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('test-secret');
    expect(logged).not.toContain('tok');
  });

  it('usa el timeout por defecto de 8s', () => {
    expect(SITEVERIFY_TIMEOUT_MS).toBe(8_000);
    expect(SITEVERIFY_URL).toContain('siteverify');
  });

  it('no incluye token ni secret en metadatos de log', () => {
    expect(
      sanitizeTurnstileLogMeta({
        reason: 'error',
        token: 'leak-me',
        secret: 'also-leak',
        errorCodes: ['siteverify_timeout'],
      })
    ).toEqual({ reason: 'error', errorCodes: ['siteverify_timeout'] });
  });
});
