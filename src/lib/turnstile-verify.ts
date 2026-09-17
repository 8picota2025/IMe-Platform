/**
 * Cloudflare Turnstile siteverify helper (Deno Edge + Vitest).
 * Never logs the token or secret. Fail-closed: missing secret/token is not success.
 */

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** Hard cap so Edge never hangs on a stuck siteverify fetch. */
export const SITEVERIFY_TIMEOUT_MS = 8_000;

export interface TurnstileResult {
  success: boolean;
  reason?: 'not_configured' | 'missing_token' | 'invalid' | 'error';
  /** Cloudflare `error-codes` or compact markers (`http_*`, `siteverify_timeout`). Never the token. */
  errorCodes?: string[];
}

interface TurnstileApiResponse {
  success?: boolean;
  'error-codes'?: string[];
}

export type TurnstileFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: URLSearchParams;
    signal: AbortSignal;
  }
) => Promise<Response>;

const BLOCKED_LOG_KEY = /token|secret|authorization|cookie|response/i;

export function sanitizeTurnstileLogMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(meta).filter(([key]) => !BLOCKED_LOG_KEY.test(key)));
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export interface VerifyTurnstileTokenParams {
  secret: string | undefined;
  token: string | undefined | null;
  remoteIp?: string | null;
  fetchImpl?: TurnstileFetch;
  timeoutMs?: number;
  log?: (message: string, meta: Record<string, unknown>) => void;
}

export async function verifyTurnstileToken(
  params: VerifyTurnstileTokenParams
): Promise<TurnstileResult> {
  const logFailure = (message: string, meta: Record<string, unknown>) => {
    params.log?.(message, sanitizeTurnstileLogMeta(meta));
  };

  if (!params.secret) {
    logFailure('Turnstile not configured', { reason: 'not_configured' });
    return { success: false, reason: 'not_configured' };
  }
  if (!params.token) {
    logFailure('Turnstile missing token', { reason: 'missing_token' });
    return { success: false, reason: 'missing_token' };
  }

  const timeoutMs = params.timeoutMs ?? SITEVERIFY_TIMEOUT_MS;
  const fetchImpl = params.fetchImpl ?? (globalThis.fetch as TurnstileFetch);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = new URLSearchParams({ secret: params.secret, response: params.token });
    if (params.remoteIp) body.set('remoteip', params.remoteIp);

    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const result: TurnstileResult = {
        success: false,
        reason: 'error',
        errorCodes: [`http_${res.status}`],
      };
      logFailure('Turnstile siteverify http error', {
        reason: result.reason,
        errorCodes: result.errorCodes ?? [],
      });
      return result;
    }

    const json = (await res.json()) as TurnstileApiResponse;
    if (json.success) return { success: true };

    const errorCodes = (json['error-codes'] ?? []).filter(
      (code): code is string => typeof code === 'string'
    );
    const result: TurnstileResult = {
      success: false,
      reason: 'invalid',
      ...(errorCodes.length > 0 ? { errorCodes: errorCodes.slice(0, 8) } : {}),
    };
    logFailure('Turnstile siteverify invalid', {
      reason: result.reason,
      errorCodes: result.errorCodes ?? [],
    });
    return result;
  } catch (err) {
    if (controller.signal.aborted || isAbortError(err)) {
      const result: TurnstileResult = {
        success: false,
        reason: 'error',
        errorCodes: ['siteverify_timeout'],
      };
      logFailure('Turnstile siteverify timeout', {
        reason: result.reason,
        errorCodes: result.errorCodes ?? [],
      });
      return result;
    }
    logFailure('Turnstile siteverify error', { reason: 'error' });
    return { success: false, reason: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
