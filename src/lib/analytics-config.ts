/** Production GA4 web stream. Measurement IDs are public by design. */
export const GA4_MEASUREMENT_ID = 'G-YKKFCZHE2N';
export const ANALYTICS_COOKIE_DOMAIN = 'i-me.com.co';
export const SEARCH_CONSOLE_SITEMAP = 'https://i-me.com.co/sitemap-index.xml';
export const SEARCH_CONSOLE_HTML_FILE_RE = /^google[a-z0-9]+\.html$/i;

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function resolveGaId(
  envValue: string | undefined = import.meta.env['PUBLIC_GA_ID'] as string | undefined
): string {
  const fromEnv = trimEnv(envValue);
  if (fromEnv) return fromEnv;
  return import.meta.env.PROD ? GA4_MEASUREMENT_ID : '';
}

export function resolveAnalyticsDomain(
  envValue: string | undefined = import.meta.env['PUBLIC_ANALYTICS_DOMAIN'] as string | undefined
): string {
  return trimEnv(envValue) || ANALYTICS_COOKIE_DOMAIN;
}

export function resolveSearchConsoleVerification(
  envValue: string | undefined = import.meta.env['PUBLIC_SEARCH_CONSOLE_VERIFICATION'] as
    | string
    | undefined
): string {
  return trimEnv(envValue);
}

export function resolveSearchConsoleHtmlFile(
  envValue: string | undefined = import.meta.env['PUBLIC_SEARCH_CONSOLE_FILE'] as string | undefined
): string {
  const file = trimEnv(envValue);
  return SEARCH_CONSOLE_HTML_FILE_RE.test(file) ? file : '';
}
