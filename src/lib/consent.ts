/**
 * Consent Management mínimo (ADR-0012) — gate de consentimiento previo para
 * analítica no esencial (GA4/GTM/Clarity), per la política de cookies ya
 * publicada (`src/lib/legal.ts`, `kind: 'cookies'`, sección "Gestión y
 * retiro del consentimiento": "El panel deberá permitir aceptar, rechazar y
 * modificar preferencias, conservar prueba del consentimiento y no bloquear
 * la navegación esencial").
 *
 * No cubre publicidad/remarketing (Meta Pixel, LinkedIn Insight Tag, etc.):
 * esa categoría no está activa hoy y la política exige aprobación jurídica
 * + actualización expresa antes de activarla — fuera de alcance aquí.
 */

export const CONSENT_STORAGE_KEY = 'ime_consent';

/**
 * Debe coincidir con el campo `updated` de la política de cookies
 * (src/lib/legal.ts, kind: 'cookies'). Si la política cambia de forma
 * relevante para el consentimiento, subir esta versión invalida el
 * consentimiento guardado y se vuelve a pedir.
 */
export const CONSENT_POLICY_VERSION = '2026-06-12';

export interface ConsentCategories {
  necessary: true;
  analytics: boolean;
}

export type ConsentSource = 'accept_all' | 'reject_all' | 'custom';

export interface StoredConsent {
  categories: ConsentCategories;
  policyVersion: string;
  /** ISO timestamp — equivalente a `consentimiento_timestamp`. */
  decidedAt: string;
  source: ConsentSource;
}

function isStoredConsent(value: unknown): value is StoredConsent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const categories = v.categories as Record<string, unknown> | undefined;
  return (
    typeof v.policyVersion === 'string' &&
    typeof v.decidedAt === 'string' &&
    typeof v.source === 'string' &&
    !!categories &&
    typeof categories.analytics === 'boolean'
  );
}

/** null = sin decisión vigente (falta decidir, o la política cambió). */
export function readStoredConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredConsent(parsed)) return null;
    if (parsed.policyVersion !== CONSENT_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredConsent(analytics: boolean, source: ConsentSource): StoredConsent {
  const consent: StoredConsent = {
    categories: { necessary: true, analytics },
    policyVersion: CONSENT_POLICY_VERSION,
    decidedAt: new Date().toISOString(),
    source,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    } catch {
      // localStorage no disponible (modo privado, cuota, etc.): la decisión
      // no persiste entre sesiones, pero applyConsentModeUpdate() igual
      // respeta la elección para la carga/sesión actual.
    }
  }
  return consent;
}

export function hasAnalyticsConsent(): boolean {
  return readStoredConsent()?.categories.analytics === true;
}

/**
 * gtag.js sólo reconoce comandos que llegan a `dataLayer` como objeto
 * `arguments`; un array (`dataLayer.push([...])`, o un `gtag` escrito como
 * `(...args) => dataLayer.push(args)`) se ignora en silencio. Verificado en
 * navegador: con arrays, GA4 no enviaba ningún hit — tampoco en producción
 * antes de ADR-0012 — y Consent Mode no registraba ni `default` ni `update`.
 * No se asigna a `window.gtag` hasta que hay consentimiento: analytics.ts usa
 * `window.gtag?.()` y encolaría eventos que luego se duplicarían con
 * `replayPageViewToGtag()`.
 */
const pushGtagCommand = function () {
  window.dataLayer = window.dataLayer ?? [];
  // eslint-disable-next-line prefer-rest-params -- gtag.js exige `arguments`, ver arriba
  window.dataLayer.push(arguments);
} as (...command: unknown[]) => void;

/**
 * Google Consent Mode v2 — señal "default" antes de cargar cualquier tag.
 * Debe llamarse lo antes posible en <head>, antes del snippet de GTM/gtag.
 * No depende de que exista GTM: si nunca se carga, sólo se acumula en un
 * array en memoria (dataLayer).
 */
export function applyDefaultConsentMode(): void {
  if (typeof window === 'undefined') return;
  pushGtagCommand('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });
}

export function applyConsentModeUpdate(analytics: boolean): void {
  if (typeof window === 'undefined') return;
  pushGtagCommand('consent', 'update', {
    analytics_storage: analytics ? 'granted' : 'denied',
  });
}

export interface AnalyticsIds {
  gtmId: string;
  gaId: string;
  clarityId: string;
  analyticsDomain: string;
}

let analyticsScriptsLoaded = false;

/**
 * Inyecta GTM/GA4/Clarity en el DOM. Sólo debe llamarse cuando ya existe
 * consentimiento de analítica (hasAnalyticsConsent() === true) — ya sea al
 * cargar la página (consentimiento previo guardado) o al aceptar en el
 * banner (sin recargar). Idempotente: una segunda llamada no duplica tags.
 * Devuelve true sólo si esta llamada fue la que cargó los tags.
 */
export function loadAnalyticsScripts(ids: AnalyticsIds): boolean {
  if (typeof window === 'undefined' || analyticsScriptsLoaded) return false;
  analyticsScriptsLoaded = true;

  if (ids.gtmId) {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      'gtm.start': Date.now(),
      event: 'gtm.js',
      data_domain: ids.analyticsDomain,
    });
    const first = document.getElementsByTagName('script')[0];
    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${ids.gtmId}`;
    first?.parentNode?.insertBefore(gtmScript, first);
  }

  if (ids.gaId) {
    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${ids.gaId}`;
    document.head.appendChild(gaScript);
    window.gtag = window.gtag || pushGtagCommand;
    window.gtag('js', new Date());
    window.gtag('config', ids.gaId, {
      send_page_view: false,
      cookie_domain: ids.analyticsDomain === 'auto' ? 'auto' : ids.analyticsDomain,
    });
  }

  if (ids.clarityId) {
    type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };
    const w = window as Window & { clarity?: ClarityFn };
    if (!w.clarity) {
      const clarityFn: ClarityFn = (...args: unknown[]) => {
        clarityFn.q = clarityFn.q || [];
        clarityFn.q.push(args);
      };
      w.clarity = clarityFn;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.clarity.ms/tag/' + ids.clarityId;
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  }

  return true;
}

/**
 * Retiro del consentimiento con los tags ya cargados: los silencia antes de
 * recargar. Sin esto, verificado en navegador, entre el clic en "Rechazar" y
 * la recarga GA4 todavía enviaba hits (`scroll`, y `session_engaged` como
 * ping de Consent Mode con gcs=G100) y Clarity subía la grabación pendiente
 * (~35 KB). `ga-disable-<id>` es el opt-out oficial de gtag.js.
 * `clarity('stop')` corta la grabación dejando sólo su aviso de fin de
 * sesión (~300 bytes, sin contenido de la página); `clarity('consent',
 * false)` NO se usa: dispara justamente esa subida de ~35 KB. Las cookies de
 * Clarity las borra clearAnalyticsCookies().
 */
export function silenceLoadedAnalytics(ids: Pick<AnalyticsIds, 'gaId'>): void {
  if (typeof window === 'undefined') return;
  if (ids.gaId) (window as unknown as Record<string, unknown>)[`ga-disable-${ids.gaId}`] = true;
  window.clarity?.('stop');
}

export function analyticsScriptsAreLoaded(): boolean {
  return analyticsScriptsLoaded;
}

/** Cookies de primera parte que dejan GA4/gtag (_ga, _ga_<id>, _gid, _gat, _gcl_*) y Clarity (_clck, _clsk). */
const ANALYTICS_COOKIE_RE = /^(?:_ga|_gid|_gat|_gcl_|_clck$|_clsk$)/;

/** El host y cada dominio padre con al menos dos etiquetas: a.b.c.co → a.b.c.co, b.c.co, c.co. */
function cookieDomainCandidates(hostname: string): string[] {
  const labels = hostname.split('.');
  const domains: string[] = [];
  for (let i = 0; i < labels.length - 1; i++) {
    domains.push(labels.slice(i).join('.'));
  }
  return domains;
}

/**
 * Retiro del consentimiento (ADR-0012): borra las cookies de analítica ya
 * puestas. No se sabe con qué atributo `domain` las escribió cada tag
 * (GA usa el dominio registrable, Clarity el host), así que se expiran en
 * todas las variantes posibles; las que no existen se ignoran.
 * Devuelve los nombres de cookie expirados.
 */
export function clearAnalyticsCookies(): string[] {
  if (typeof document === 'undefined') return [];
  const names = document.cookie
    .split(';')
    .map(part => part.split('=')[0]?.trim() ?? '')
    .filter(name => ANALYTICS_COOKIE_RE.test(name));
  const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  const domains = cookieDomainCandidates(window.location.hostname);
  for (const name of names) {
    document.cookie = `${name}=; ${expired}`;
    for (const domain of domains) {
      document.cookie = `${name}=; ${expired}; domain=${domain}`;
      document.cookie = `${name}=; ${expired}; domain=.${domain}`;
    }
  }
  return names;
}
