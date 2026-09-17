/**
 * Verificación server-side de Cloudflare Turnstile.
 * Sin TURNSTILE_SECRET_KEY configurado, falla cerrado (not_configured):
 * el caller debe responder sin consumir presupuesto LLM.
 *
 * siteverify never hangs: AbortSignal timeout maps to
 * `{ success: false, reason: 'error', errorCodes: ['siteverify_timeout'] }`.
 */

import { verifyTurnstileToken, type TurnstileResult } from '../../../src/lib/turnstile-verify.ts';

export type { TurnstileResult };

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string | null
): Promise<TurnstileResult> {
  const result = await verifyTurnstileToken({
    secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
    token,
    remoteIp,
  });
  if (!result.success) {
    console.warn(
      JSON.stringify({
        msg: 'turnstile_verify_failed',
        reason: result.reason ?? 'unknown',
        errorCodes: result.errorCodes ?? [],
      })
    );
  }
  return result;
}
