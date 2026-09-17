/**
 * Client Turnstile contract for the IMEIA widget.
 * Visible checkbox (`appearance: always`) from chat open — not a late fallback
 * after `interaction-only` fails.
 */

export const ASESOR_TURNSTILE_APPEARANCE = 'always' as const;
export const ASESOR_TURNSTILE_SIZE = 'flexible' as const;
export const ASESOR_TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** First wait for a token after render / send. */
export const ASESOR_TURNSTILE_TOKEN_WAIT_MS = 45_000;
/** Second wait after reset if the first token never arrived or expired. */
export const ASESOR_TURNSTILE_RETRY_WAIT_MS = 20_000;

export interface AsesorTurnstileHandlers {
  callback: (token: string) => void;
  'error-callback': (codigo: unknown) => void;
  'expired-callback': () => void;
}

export interface AsesorTurnstileRenderOptions extends AsesorTurnstileHandlers {
  sitekey: string;
  size: typeof ASESOR_TURNSTILE_SIZE;
  appearance: typeof ASESOR_TURNSTILE_APPEARANCE;
  retry: 'auto';
  'refresh-expired': 'auto';
  [key: string]: unknown;
}

export function buildAsesorTurnstileRenderOptions(
  sitekey: string,
  handlers: AsesorTurnstileHandlers
): AsesorTurnstileRenderOptions {
  return {
    sitekey,
    size: ASESOR_TURNSTILE_SIZE,
    appearance: ASESOR_TURNSTILE_APPEARANCE,
    retry: 'auto',
    'refresh-expired': 'auto',
    ...handlers,
  };
}

export function shouldMarkTurnstilePending(params: {
  siteKeyPresent: boolean;
  tokenReady: boolean;
}): boolean {
  return params.siteKeyPresent && !params.tokenReady;
}

export interface ObtainAsesorTurnstileTokenParams {
  siteKey: string | undefined;
  hasContainer: boolean;
  cachedToken: string | undefined;
  loadScript: () => Promise<void>;
  ensureWidget: () => Promise<string | null>;
  waitForToken: (timeoutMs: number) => Promise<string | undefined>;
  resetWidget: (widgetId: string) => void;
  setPending: (pending: boolean) => void;
  waitMs?: number;
  retryWaitMs?: number;
}

/**
 * Obtain a Turnstile token from an already-visible widget.
 * Does not switch appearance modes; the checkbox is rendered with `always`.
 */
export async function obtainAsesorTurnstileToken(
  params: ObtainAsesorTurnstileTokenParams
): Promise<string | undefined> {
  const waitMs = params.waitMs ?? ASESOR_TURNSTILE_TOKEN_WAIT_MS;
  const retryWaitMs = params.retryWaitMs ?? ASESOR_TURNSTILE_RETRY_WAIT_MS;

  if (!params.siteKey || !params.hasContainer) return undefined;

  try {
    params.setPending(true);
    await params.loadScript();
    const widgetId = await params.ensureWidget();

    if (params.cachedToken) {
      params.setPending(false);
      return params.cachedToken;
    }

    let token = await params.waitForToken(waitMs);
    if (token) {
      params.setPending(false);
      return token;
    }

    if (widgetId !== null) {
      params.resetWidget(widgetId);
      token = await params.waitForToken(retryWaitMs);
    }

    params.setPending(!token);
    return token;
  } catch {
    params.setPending(true);
    return undefined;
  }
}
