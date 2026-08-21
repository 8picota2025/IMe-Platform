/**
 * Utilidades compartidas del SPA comercial (`/comercial`).
 *
 * Mantiene un único cliente Supabase, el estado mutable de sesión/rol y
 * helpers de UI (toast, escape, debounce) reutilizados por auth.ts,
 * catalog-view.ts, share-modal.ts y comercial-app.ts.
 */
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { isComercialUser, isCommercialAdmin } from '../lib/comercial-cms';

export const supabase = getSupabaseClient();
export { isSupabaseConfigured };

export const PUBLIC_SUPABASE_URL =
  (import.meta.env['PUBLIC_SUPABASE_URL'] as string | undefined) ?? '';
export const PUBLIC_SUPABASE_ANON_KEY =
  (import.meta.env['PUBLIC_SUPABASE_ANON_KEY'] as string | undefined) ?? '';

/** Disparado cuando la sesión JWT desaparece o no se puede refrescar. */
export const AUTH_EXPIRED_EVENT = 'ime-comercial-auth-expired';

export function notifyAuthExpired(reason = 'Sesión expirada. Vuelve a iniciar sesión.'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }));
}

/**
 * Devuelve sesión usable: getSession → refreshSession si hace falta.
 * Si no hay sesión, notifica AUTH_EXPIRED para que el shell vuelva al login.
 */
export async function ensureAuthSession(): Promise<{
  access_token: string;
  user: { id: string; email?: string | null };
} | null> {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    // Refrescar si faltan <2 min (OCR/PDF pueden superar el JWT restante).
    if (!expiresAtMs || expiresAtMs - Date.now() > 120_000) return session;
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session?.access_token) return refreshed.data.session;
    return session;
  }

  const { data, error } = await supabase.auth.refreshSession();
  if (data.session?.access_token) return data.session;

  notifyAuthExpired(
    error?.message
      ? `Sesión expirada (${error.message}). Vuelve a iniciar sesión.`
      : 'Sesión expirada. Vuelve a iniciar sesión.'
  );
  return null;
}

const COMMERCIAL_USAGE_SESSION_KEY = 'ime_comercial_usage_session_id';
export type CommercialUsageEvent =
  | 'login'
  | 'logout'
  | 'idle_logout'
  | 'view'
  | 'search'
  | 'filter'
  | 'product_selected'
  | 'share_modal_open'
  | 'share_submitted'
  | 'share_succeeded'
  | 'share_failed'
  | 'crm_retry'
  | 'pwa_install'
  | 'pwa_dismiss'
  | 'error';

type CommercialUsageValue = string | number | boolean;

function commercialUsageSessionId(): string {
  try {
    const existing = sessionStorage.getItem(COMMERCIAL_USAGE_SESSION_KEY);
    if (existing) return existing;
    const created =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(COMMERCIAL_USAGE_SESSION_KEY, created);
    return created;
  } catch {
    return `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Envía un evento de uso autenticado, sin PII y sin bloquear la interfaz. */
export function trackCommercialUsage(
  eventName: CommercialUsageEvent,
  metadata: Record<string, CommercialUsageValue> = {},
  view?: ComercialView
): void {
  if (!supabase || !PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) return;
  void (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/comercial-usage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: PUBLIC_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_name: eventName,
        session_id: commercialUsageSessionId(),
        view,
        metadata,
      }),
      keepalive: true,
    }).catch(() => undefined);
  })();
}

export type ComercialView =
  | 'catalogo'
  | 'cotizaciones'
  | 'envios'
  | 'plantillas'
  | 'integraciones'
  | 'usuarios';

export interface ComercialState {
  view: ComercialView;
  email: string;
  rol: string;
  userId: string;
  /** admin_profiles.nombre — usado como "nombre_comercial" en plantillas de mensaje. */
  nombre: string;
  /** admin_profiles.telefono — usado como "telefono_comercial" en plantillas de mensaje. */
  telefono: string;
}

/**
 * Roles con acceso a vistas administrativas (plantillas, integraciones,
 * usuarios, envíos de todo el equipo). Espejo de `is_admin(['owner','admin'])`
 * en `supabase/schema.sql`, vía el helper compartido `isCommercialAdmin`.
 */
export function esRolAdmin(rol: string): boolean {
  return isCommercialAdmin(rol, true);
}

/** Espejo de `is_comercial_user()` en SQL: ventas/admin/owner activos. */
export function esUsuarioComercial(rol: string, activo: boolean): boolean {
  return isComercialUser(rol, activo);
}

export const state: ComercialState = {
  view: 'catalogo',
  email: '',
  rol: '',
  userId: '',
  nombre: '',
  telefono: '',
};

/** Reinicia el estado de sesión (usado en logout / expiración por inactividad). */
export function resetSessionState(): void {
  state.email = '';
  state.rol = '';
  state.userId = '';
  state.nombre = '';
  state.telefono = '';
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export type ToastVariant = 'info' | 'success' | 'error';

export function toast(message: string, variant: ToastVariant = 'info'): void {
  const node = document.createElement('div');
  node.className = `comercial-toast comercial-toast--${variant}`;
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => {
    node.classList.add('comercial-toast--out');
    window.setTimeout(() => node.remove(), 220);
  }, 4200);
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number
): (...args: A) => void {
  let timer: number | undefined;
  return (...args: A) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), waitMs);
  };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function text(value: unknown): string {
  return typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : String(value);
}

export function hashParams(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}

/** Actualiza la query del hash actual sin disparar `hashchange` (usa replaceState). */
export function replaceHashQuery(params: URLSearchParams): void {
  const base = location.hash.split('?')[0] || '#/catalogo';
  const query = params.toString();
  const next = query ? `${base}?${query}` : base;
  history.replaceState(null, '', next);
}

export interface EdgeFunctionResult<T> {
  data: T | null;
  error: string | null;
  status: number;
  code?: string;
}

/** Forma de error devuelta por las Edge Functions (ver `_shared/errors.ts`): `{ error: { code, message } }`. */
interface EdgeErrorPayload {
  error?: { code?: string; message?: string } | string;
}

function extractEdgeError(
  payload: unknown,
  status: number,
  name: string
): {
  message: string;
  code?: string;
} {
  const body = payload as EdgeErrorPayload | null;
  const code = typeof body?.error === 'object' && body.error?.code ? body.error.code : undefined;
  if (typeof body?.error === 'string') {
    return code ? { message: body.error, code } : { message: body.error };
  }
  if (body?.error?.message) {
    return code ? { message: body.error.message, code } : { message: body.error.message };
  }
  return code
    ? { message: `Error ${status} al llamar ${name}.`, code }
    : { message: `Error ${status} al llamar ${name}.` };
}

/**
 * Invoca una Supabase Edge Function vía fetch directo a
 * `${PUBLIC_SUPABASE_URL}/functions/v1/<name>`, adjuntando el bearer token
 * de la sesión activa (Authorization) y el apikey anónimo requeridos por el
 * gateway de Supabase. Nunca se usan claves privilegiadas en el navegador.
 */
export async function callEdgeFunction<T = unknown>(
  name: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    query?: Record<string, string>;
  } = {}
): Promise<EdgeFunctionResult<T>> {
  if (!supabase) {
    return { data: null, error: 'Supabase no configurado.', status: 0 };
  }
  const session = await ensureAuthSession();
  if (!session) {
    return { data: null, error: 'Sesión expirada. Vuelve a iniciar sesión.', status: 401 };
  }
  const method = options.method ?? 'POST';
  const query = options.query ? `?${new URLSearchParams(options.query).toString()}` : '';
  const url = `${PUBLIC_SUPABASE_URL}/functions/v1/${name}${query}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: PUBLIC_SUPABASE_ANON_KEY,
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(options.body ?? {}) }),
    });
    const status = response.status;
    let payload: unknown = null;
    const raw = await response.text();
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
    }
    if (status === 401) {
      notifyAuthExpired();
    }
    if (!response.ok) {
      const extracted = extractEdgeError(payload, status, name);
      // Gateway 404/NOT_FOUND: message top-level, no { error: { message } }.
      if (
        status === 404 &&
        payload &&
        typeof payload === 'object' &&
        typeof (payload as { message?: unknown }).message === 'string'
      ) {
        return {
          data: null,
          error: String((payload as { message: string }).message),
          status,
          code: 'NOT_FOUND',
        };
      }
      return extracted.code
        ? { data: null, error: extracted.message, status, code: extracted.code }
        : { data: null, error: extracted.message, status };
    }
    return { data: payload as T, error: null, status };
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Error de red.';
    const origin = typeof location !== 'undefined' ? location.origin : '';
    const message = /failed to fetch|networkerror|load failed/i.test(raw)
      ? `No se pudo contactar el backend (${origin || 'sin origin'}). Prueba https://i-me.com.co/comercial/ o http://127.0.0.1:44334/comercial/ y recarga sin caché.`
      : raw;
    return { data: null, error: message, status: 0 };
  }
}

export function skeletonCards(count: number): string {
  return Array.from({ length: count })
    .map(
      () => `
      <article class="comercial-card comercial-card--skeleton" aria-hidden="true">
        <div class="comercial-skel comercial-skel--img"></div>
        <div class="comercial-skel comercial-skel--line"></div>
        <div class="comercial-skel comercial-skel--line comercial-skel--short"></div>
      </article>`
    )
    .join('');
}
