export type AnalyticsEventName =
  | 'page_view'
  | 'search'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'quote_submit'
  | 'whatsapp_click'
  | 'tel_click'
  | 'imeia_open'
  | 'pdf_download';

export interface AnalyticsConfig {
  dataDomain: string;
  gaEnabled: boolean;
  gtmEnabled: boolean;
  clarityEnabled: boolean;
}

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsDetail {
  name: AnalyticsEventName;
  params?: AnalyticsParams;
}

const ANALYTICS_EVENT = 'ime:analytics';
const SEARCH_SELECTOR = '#catalogo-buscar';

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __imeAnalyticsConfig?: AnalyticsConfig;
    __imeAnalyticsInstalled?: boolean;
    __imeAnalyticsLastPage?: string;
    __imeAnalyticsLastSearch?: string;
    __imeAnalyticsPurchases?: string[];
    __imeAnalyticsSearchTimer?: number;
  }
}

function normalizeParams(params: AnalyticsParams = {}): AnalyticsParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  ) as AnalyticsParams;
}

function pushDataLayer(name: AnalyticsEventName, params: AnalyticsParams): void {
  if (typeof window === 'undefined') return;
  const payload = normalizeParams(params);
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: name, ...payload });
  window.gtag?.('event', name, payload);
}

export function emitAnalyticsEvent(name: AnalyticsEventName, params: AnalyticsParams = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AnalyticsDetail>(ANALYTICS_EVENT, {
      detail: { name, params: normalizeParams(params) },
    })
  );
}

export function trackPageView(): void {
  if (typeof window === 'undefined') return;
  const pathname = window.location.pathname;
  const search = window.location.search;
  const pageKey = `${pathname}${search}`;
  if (window.__imeAnalyticsLastPage === pageKey) return;
  window.__imeAnalyticsLastPage = pageKey;
  emitAnalyticsEvent('page_view', {
    page_location: window.location.href,
    page_path: pathname,
    page_search: search,
    page_title: document.title,
    data_domain: window.__imeAnalyticsConfig?.dataDomain ?? window.location.hostname,
  });
}

function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
}

function handleClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.closest('#asesor-trigger')) {
    emitAnalyticsEvent('imeia_open', {
      page_path: window.location.pathname,
    });
  }

  const anchor = closestAnchor(target);
  if (!anchor) return;

  const href = anchor.href;
  if (!href) return;

  if (href.startsWith('tel:')) {
    emitAnalyticsEvent('tel_click', {
      href,
      text: anchor.textContent?.trim() ?? '',
    });
    return;
  }

  if (/https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href)) {
    emitAnalyticsEvent('whatsapp_click', {
      href,
      text: anchor.textContent?.trim() ?? '',
    });
    return;
  }

  if (/\.pdf(?:[?#]|$)/i.test(href)) {
    emitAnalyticsEvent('pdf_download', {
      href,
      text: anchor.textContent?.trim() ?? '',
    });
  }
}

function handleSearchInput(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.matches(SEARCH_SELECTOR) === false) return;
  const query = input.value.trim();
  if (window.__imeAnalyticsSearchTimer) {
    window.clearTimeout(window.__imeAnalyticsSearchTimer);
  }
  window.__imeAnalyticsSearchTimer = window.setTimeout(() => {
    if (query.length < 2 || window.__imeAnalyticsLastSearch === query) return;
    window.__imeAnalyticsLastSearch = query;
    emitAnalyticsEvent('search', {
      search_term: query,
      page_path: window.location.pathname,
    });
  }, 450);
}

export function installAnalytics(config: AnalyticsConfig): void {
  if (typeof window === 'undefined') return;
  window.__imeAnalyticsConfig = config;
  if (window.__imeAnalyticsInstalled) return;
  window.__imeAnalyticsInstalled = true;

  window.addEventListener(ANALYTICS_EVENT, event => {
    const detail = (event as CustomEvent<AnalyticsDetail>).detail;
    if (!detail?.name) return;
    pushDataLayer(detail.name, detail.params ?? {});
  });

  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('input', handleSearchInput, { capture: true });
  document.addEventListener('search', handleSearchInput, { capture: true });
}
