/**
 * Verificación server-side de Cloudflare Turnstile.
 * Sin TURNSTILE_SECRET_KEY configurado, falla cerrado (not_configured):
 * el caller debe responder sin consumir presupuesto LLM.
 */

export interface TurnstileResult {
  success: boolean
  reason?: 'not_configured' | 'missing_token' | 'invalid' | 'error'
}

interface TurnstileApiResponse {
  success?: boolean
  'error-codes'?: string[]
}

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string | null
): Promise<TurnstileResult> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) return { success: false, reason: 'not_configured' }
  if (!token) return { success: false, reason: 'missing_token' }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) return { success: false, reason: 'error' }

    const json = (await res.json()) as TurnstileApiResponse
    return json.success ? { success: true } : { success: false, reason: 'invalid' }
  } catch {
    return { success: false, reason: 'error' }
  }
}
