/**
 * Client Turnstile contract for the IMEIA widget.
 * Visible checkbox (`appearance: always`) from chat open — not a late fallback
 * after `interaction-only` fails.
 *
 * Size: never `flexible` on this widget. Cloudflare flexible requires min 300px
 * and often renders as an empty grey box in narrow Android Chrome / WebView
 * chat panels. Use `normal` (300×65) when the container fits it, `compact`
 * (150×140) when it does not.
 */

export const ASESOR_TURNSTILE_APPEARANCE = 'always' as const;
export const ASESOR_TURNSTILE_THEME = 'light' as const;
export const ASESOR_TURNSTILE_EXECUTION = 'render' as const;
export const ASESOR_TURNSTILE_NORMAL_MIN_WIDTH_PX = 300;
export const ASESOR_TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Wait for auto-solve after the widget iframe exists. Do not stall send for 45s. */
export const ASESOR_TURNSTILE_TOKEN_WAIT_MS = 8_000;
/** Used only when the caller explicitly remounts after a consumed token. */
export const ASESOR_TURNSTILE_RETRY_WAIT_MS = 8_000;
export const ASESOR_TURNSTILE_SCRIPT_WAIT_MS = 12_000;
export const ASESOR_TURNSTILE_IFRAME_WAIT_MS = 4_000;

export type AsesorTurnstileSize = 'normal' | 'compact';

export interface AsesorTurnstileHandlers {
  callback: (token: string) => void;
  'error-callback': (codigo: unknown) => void;
  'expired-callback': () => void;
}

export interface AsesorTurnstileRenderOptions extends AsesorTurnstileHandlers {
  sitekey: string;
  size: AsesorTurnstileSize;
  appearance: typeof ASESOR_TURNSTILE_APPEARANCE;
  theme: typeof ASESOR_TURNSTILE_THEME;
  execution: typeof ASESOR_TURNSTILE_EXECUTION;
  retry: 'auto';
  'refresh-expired': 'auto';
  [key: string]: unknown;
}

export function resolveAsesorTurnstileSize(containerWidthPx: number): AsesorTurnstileSize {
  if (containerWidthPx > 0 && containerWidthPx < ASESOR_TURNSTILE_NORMAL_MIN_WIDTH_PX) {
    return 'compact';
  }
  return 'normal';
}

export function turnstileMinHeightPx(size: AsesorTurnstileSize): number {
  return size === 'compact' ? 140 : 65;
}

export function buildAsesorTurnstileRenderOptions(
  sitekey: string,
  handlers: AsesorTurnstileHandlers,
  options?: { size?: AsesorTurnstileSize; language?: string }
): AsesorTurnstileRenderOptions {
  const size = options?.size ?? 'normal';
  return {
    sitekey,
    size,
    appearance: ASESOR_TURNSTILE_APPEARANCE,
    theme: ASESOR_TURNSTILE_THEME,
    execution: ASESOR_TURNSTILE_EXECUTION,
    retry: 'auto',
    'refresh-expired': 'auto',
    ...(options?.language ? { language: options.language } : {}),
    ...handlers,
  };
}

export function shouldMarkTurnstilePending(params: {
  siteKeyPresent: boolean;
  tokenReady: boolean;
}): boolean {
  return params.siteKeyPresent && !params.tokenReady;
}

export function containerHasTurnstileIframe(
  container: { querySelector: (selector: string) => unknown } | null | undefined
): boolean {
  return Boolean(container?.querySelector('iframe'));
}

/** Cloudflare client-side codes that will not recover with retry:auto. */
const UNRECOVERABLE_TURNSTILE_CODES = new Set(['110100', '110110', '110200', '110500', '110510']);

export function isUnrecoverableTurnstileError(code: unknown): boolean {
  const normalized = String(code ?? '')
    .trim()
    .replace(/[^0-9]/g, '');
  return UNRECOVERABLE_TURNSTILE_CODES.has(normalized);
}

export function mapAsesorTurnstileClientFailure(reason: {
  scriptFailed?: boolean;
  iframeMissing?: boolean;
  unrecoverableError?: boolean;
  tokenMissing?: boolean;
}): 'verificacion' | null {
  if (
    reason.scriptFailed ||
    reason.iframeMissing ||
    reason.unrecoverableError ||
    reason.tokenMissing
  ) {
    return 'verificacion';
  }
  return null;
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
  /** Default false: auto-reset of a never-clicked widget paints the grey empty box on mobile. */
  retryWithReset?: boolean;
  iframeReady?: () => boolean;
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

    if (params.iframeReady && !params.iframeReady()) {
      params.setPending(true);
      return undefined;
    }

    let token = await params.waitForToken(waitMs);
    if (token) {
      params.setPending(false);
      return token;
    }

    if (params.retryWithReset && widgetId !== null) {
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
