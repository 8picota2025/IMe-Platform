export type AnalyticsEventName =
  | 'page_view'
  | 'session_engaged'
  | 'scroll_depth'
  | 'search'
  | 'cta_clicked'
  | 'outbound_click'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'quote_submit'
  | 'quote_open'
  | 'whatsapp_click'
  | 'tel_click'
  | 'imeia_open'
  | 'product_view'
  | 'quick_view'
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
const SUPABASE_URL = (import.meta.env['PUBLIC_SUPABASE_URL'] as string | undefined)?.trim() ?? '';
const SUPABASE_ANON_KEY =
  (import.meta.env['PUBLIC_SUPABASE_ANON_KEY'] as string | undefined)?.trim() ?? '';
const FIRST_PARTY_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/track-analytics` : '';
const SESSION_KEY = 'ime_analytics_session_id';
const CAMPAIGN_KEY = 'ime_analytics_campaign';
const SCROLL_THRESHOLDS = [25, 50, 75, 90];
const PII_KEYS = new Set([
  'email',
  'telefono',
  'phone',
  'nombre',
  'name',
  'cliente',
  'address',
  'direccion',
  'documento',
  'nit',
]);

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __imeAnalyticsConfig?: AnalyticsConfig;
    __imeAnalyticsInstalled?: boolean;
    __imeAnalyticsLastPage?: string;
    __imeAnalyticsLastSearch?: string;
    __imeAnalyticsLastEngagementPage?: string;
    __imeAnalyticsMaxScrollDepth?: number;
    __imeAnalyticsPurchases?: string[];
    __imeAnalyticsSearchTimer?: number;
    __imeAnalyticsScrollDepths?: number[];
    __imeAnalyticsPageStartedAt?: number;
  }
}

function normalizeParams(params: AnalyticsParams = {}): AnalyticsParams {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) => value !== undefined && !PII_KEYS.has(key.toLowerCase())
    )
  ) as AnalyticsParams;
}

function analyticsSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return 'session-storage-unavailable';
  }
}

function captureCampaign(): AnalyticsParams {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const campaign: AnalyticsParams = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = params.get(key);
    if (value) campaign[key] = value.slice(0, 160);
  }
  try {
    if (Object.keys(campaign).length > 0) {
      window.sessionStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign));
      return campaign;
    }
    const stored = window.sessionStorage.getItem(CAMPAIGN_KEY);
    return stored ? (JSON.parse(stored) as AnalyticsParams) : {};
  } catch {
    return campaign;
  }
}

function deviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1100) return 'tablet';
  return 'desktop';
}

function cleanText(value: unknown, max = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim().slice(0, max);
  return clean || undefined;
}

function numberParam(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstPartyPayload(
  name: AnalyticsEventName,
  params: AnalyticsParams
): Record<string, unknown> {
  const campaign = captureCampaign();
  const known = new Set([
    'page_location',
    'page_path',
    'page_title',
    'page_referrer',
    'duration_seconds',
    'scroll_depth',
    'value',
    'item_count',
    'product_slug',
    'item_id',
    'search_term',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ]);
  const properties = Object.fromEntries(
    Object.entries(params).filter(([key]) => !known.has(key) && !PII_KEYS.has(key.toLowerCase()))
  );
  return {
    event_name: name,
    session_id: analyticsSessionId(),
    page_path: cleanText(params['page_path']) ?? window.location.pathname,
    page_title: cleanText(params['page_title'], 300) ?? document.title,
    referrer: cleanText(params['page_referrer']) ?? cleanText(document.referrer),
    locale: document.documentElement.lang || undefined,
    device_type: deviceType(),
    utm_source: cleanText(params['utm_source'], 120) ?? cleanText(campaign['utm_source'], 120),
    utm_medium: cleanText(params['utm_medium'], 120) ?? cleanText(campaign['utm_medium'], 120),
    utm_campaign:
      cleanText(params['utm_campaign'], 160) ?? cleanText(campaign['utm_campaign'], 160),
    utm_content: cleanText(params['utm_content'], 160) ?? cleanText(campaign['utm_content'], 160),
    utm_term: cleanText(params['utm_term'], 160) ?? cleanText(campaign['utm_term'], 160),
    duration_seconds: numberParam(params['duration_seconds']),
    scroll_depth: numberParam(params['scroll_depth']),
    value: numberParam(params['value']),
    item_count: numberParam(params['item_count']),
    product_slug: cleanText(params['product_slug']) ?? cleanText(params['item_id']),
    search_term: cleanText(params['search_term'], 200),
    properties,
  };
}

function sendFirstPartyEvent(name: AnalyticsEventName, params: AnalyticsParams): void {
  if (!FIRST_PARTY_ENDPOINT || !SUPABASE_ANON_KEY || typeof window === 'undefined') return;
  const payload = firstPartyPayload(name, params);
  window
    .fetch(FIRST_PARTY_ENDPOINT, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    })
    .catch(() => undefined);
}

function pushDataLayer(name: AnalyticsEventName, params: AnalyticsParams): void {
  if (typeof window === 'undefined') return;
  const payload = normalizeParams(params);
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: name, ...payload });
  window.gtag?.('event', name, payload);
  if (window.__imeAnalyticsConfig?.clarityEnabled) {
    window.clarity?.('event', name);
  }
  sendFirstPartyEvent(name, payload);
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
  sendEngagement();
  window.__imeAnalyticsLastPage = pageKey;
  delete window.__imeAnalyticsLastEngagementPage;
  window.__imeAnalyticsMaxScrollDepth = 0;
  window.__imeAnalyticsScrollDepths = [];
  window.__imeAnalyticsPageStartedAt = Date.now();
  const campaign = captureCampaign();
  emitAnalyticsEvent('page_view', {
    page_location: window.location.href,
    page_path: pathname,
    page_search: search,
    page_referrer: document.referrer,
    page_title: document.title,
    data_domain: window.__imeAnalyticsConfig?.dataDomain ?? window.location.hostname,
    ...campaign,
  });
  const productSlug = pathname.match(/\/(?:es\/productos|en\/products)\/([^/?#]+)/)?.[1];
  if (productSlug) {
    emitAnalyticsEvent('product_view', {
      product_slug: decodeURIComponent(productSlug),
      page_path: pathname,
      page_title: document.title,
    });
  }
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

  const quoteButton = target.closest<HTMLElement>('[data-add-cotizacion]');
  if (quoteButton) {
    emitAnalyticsEvent('quote_open', {
      product_slug: quoteButton.dataset['addCotizacion'] ?? '',
      page_path: window.location.pathname,
    });
  }

  const quickViewButton = target.closest<HTMLElement>('[data-quick-view]');
  if (quickViewButton) {
    const card = quickViewButton.closest<HTMLElement>('[data-producto-slug]');
    emitAnalyticsEvent('quick_view', {
      product_slug: card?.dataset['productoSlug'] ?? '',
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
      origin: anchor.dataset['commercialOrigin'],
    });
    return;
  }

  if (/\.pdf(?:[?#]|$)/i.test(href)) {
    emitAnalyticsEvent('pdf_download', {
      href,
      text: anchor.textContent?.trim() ?? '',
    });
    return;
  }

  const url = new URL(href, window.location.href);
  const text = anchor.textContent?.trim() ?? '';
  const isContactCta =
    /\/(?:es\/contacto|en\/contact)\/?$/i.test(url.pathname) ||
    /\b(cotizar|cotizacion|quote|contact|asesor)/i.test(text);
  if (isContactCta) {
    emitAnalyticsEvent('cta_clicked', {
      href: url.pathname,
      text,
      page_path: window.location.pathname,
    });
    return;
  }

  if (url.origin !== window.location.origin) {
    emitAnalyticsEvent('outbound_click', {
      href: url.href,
      text,
      page_path: window.location.pathname,
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

function currentScrollDepth(): number {
  if (typeof window === 'undefined') return 0;
  const doc = document.documentElement;
  const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
  return Math.min(100, Math.round((window.scrollY / scrollable) * 100));
}

function handleScroll(): void {
  const depth = currentScrollDepth();
  window.__imeAnalyticsMaxScrollDepth = Math.max(window.__imeAnalyticsMaxScrollDepth ?? 0, depth);
  const sent = window.__imeAnalyticsScrollDepths ?? [];
  for (const threshold of SCROLL_THRESHOLDS) {
    if (depth >= threshold && !sent.includes(threshold)) {
      sent.push(threshold);
      emitAnalyticsEvent('scroll_depth', {
        scroll_depth: threshold,
        page_path: window.location.pathname,
      });
    }
  }
  window.__imeAnalyticsScrollDepths = sent;
}

function sendEngagement(): void {
  if (typeof window === 'undefined') return;
  const pageKey = window.__imeAnalyticsLastPage;
  const startedAt = window.__imeAnalyticsPageStartedAt;
  if (!pageKey || !startedAt || window.__imeAnalyticsLastEngagementPage === pageKey) return;
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  if (durationSeconds < 3) return;
  window.__imeAnalyticsLastEngagementPage = pageKey;
  emitAnalyticsEvent('session_engaged', {
    duration_seconds: durationSeconds,
    scroll_depth: window.__imeAnalyticsMaxScrollDepth ?? currentScrollDepth(),
    page_path: window.location.pathname,
    page_title: document.title,
  });
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
  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendEngagement();
  });
  window.addEventListener('pagehide', sendEngagement);
  document.addEventListener('astro:before-swap', sendEngagement);
}
