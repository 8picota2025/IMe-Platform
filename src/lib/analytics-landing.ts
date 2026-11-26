/**
 * First URL of the browser session, stored locally before any analytics tag.
 * GA4 uses it as page_location on the first hit so the landing page is not "(not set)"
 * when consent is granted after the visitor has already moved to another URL.
 * Nothing is sent to Google until the existing consent gate loads the tag.
 */

const LANDING_KEY = 'ime_analytics_landing';

/**
 * GA4 partía landingPage entre `/es` y `/es/`. Las rutas HTML llevan barra final.
 * Un archivo (`/llms.txt`, imágenes) no se toca.
 */
export function canonicalPublicUrl(href: string): string {
  try {
    const url = new URL(href, 'https://i-me.com.co');
    if (!/\.[a-z0-9]{1,8}$/i.test(url.pathname) && !url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`;
    }
    return url.toString();
  } catch {
    return href;
  }
}

export interface AnalyticsLanding {
  page_location: string;
  page_referrer: string;
  page_title: string;
}

export function rememberAnalyticsLanding(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window === 'undefined'
    ? null
    : window.sessionStorage,
  page: AnalyticsLanding | null = typeof window === 'undefined'
    ? null
    : {
        page_location: window.location.href,
        page_referrer: document.referrer,
        page_title: document.title,
      }
): void {
  if (!storage || !page?.page_location) return;
  try {
    if (storage.getItem(LANDING_KEY)) return;
    storage.setItem(
      LANDING_KEY,
      JSON.stringify({ ...page, page_location: canonicalPublicUrl(page.page_location) })
    );
  } catch {
    // sessionStorage can be blocked. The live URL is still sent after consent.
  }
}

export function readAnalyticsLanding(
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined'
    ? null
    : window.sessionStorage
): AnalyticsLanding | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LANDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AnalyticsLanding>;
    if (typeof parsed.page_location !== 'string' || !parsed.page_location) return null;
    return {
      page_location: parsed.page_location,
      page_referrer: typeof parsed.page_referrer === 'string' ? parsed.page_referrer : '',
      page_title: typeof parsed.page_title === 'string' ? parsed.page_title : '',
    };
  } catch {
    return null;
  }
}
