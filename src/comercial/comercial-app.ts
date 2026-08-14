/**
 * Entrada del SPA comercial (`/comercial`). Enruta por hash entre catálogo,
 * cotizaciones, envíos, plantillas, integraciones y usuarios.
 */
import type { Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  state,
  esRolAdmin,
  esUsuarioComercial,
  resetSessionState,
  escapeHtml,
  toast,
  formatDate,
  callEdgeFunction,
  trackCommercialUsage,
  AUTH_EXPIRED_EVENT,
  type ComercialView,
} from './shared';
import {
  initAuthFlow,
  renderLoginPanel,
  renderNewPassword,
  getCurrentSession,
  signOut,
  startIdleWatch,
  clearRecoveryFlag,
  type IdleWatcher,
} from './auth';
import {
  renderCatalogoView,
  bindCatalogoView,
  clearSelection,
  type ProductoComercial,
} from './catalog-view';
import { openShareModal } from './share-modal';
import { bindCotizacionesView, quoteNavigationAllowed, renderCotizacionesView } from './quote-view';
import { writeQuotePrefill } from './quote-route';

const appElement = document.getElementById('comercial-app');
if (!appElement) throw new Error('comercial-app root missing');
const app = appElement;

let idleWatcher: IdleWatcher | null = null;
let unbindCurrentView: (() => void) | null = null;
let lastTrackedView: ComercialView | null = null;

let lastGoodHash = location.hash || '#/catalogo';

function parseView(hash: string): ComercialView {
  const top = hash.replace(/^#\/?/, '').split('?')[0]?.split('/')[0] ?? '';
  if (
    top === 'envios' ||
    top === 'plantillas' ||
    top === 'integraciones' ||
    top === 'usuarios' ||
    top === 'cotizaciones'
  ) {
    return top;
  }
  return 'catalogo';
}

function vistaPermitida(view: ComercialView): boolean {
  if (esRolAdmin(state.rol)) return true;
  return view === 'catalogo' || view === 'envios' || view === 'cotizaciones';
}

window.addEventListener('hashchange', () => {
  if (!quoteNavigationAllowed()) {
    history.replaceState(null, '', lastGoodHash || '#/catalogo');
    return;
  }
  state.view = parseView(location.hash);
  lastGoodHash = location.hash;
  void render();
});

setupServiceWorker();
setupPwaInstallBanner();
setupAuthGuards();
boot();

function setupAuthGuards(): void {
  window.addEventListener(AUTH_EXPIRED_EVENT, event => {
    const detail = (event as CustomEvent<{ reason?: string }>).detail;
    void forceLogin(detail?.reason || 'Sesión expirada. Vuelve a iniciar sesión.');
  });
  if (!supabase) return;
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      void forceLogin('Sesión cerrada. Inicia de nuevo para guardar cotizaciones.');
    }
  });
}

async function forceLogin(reason: string): Promise<void> {
  idleWatcher?.stop();
  idleWatcher = null;
  unbindCurrentView?.();
  unbindCurrentView = null;
  resetSessionState();
  clearSelection();
  toast(reason, 'error');
  renderLoginPanel(app, state.email || '', () => void bootAfterLogin());
}

/* ------------------------------------------------------------------ */
/* PWA: service worker + banner de instalación (Chrome/Edge/Android)  */
/* ------------------------------------------------------------------ */

function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  // En desarrollo el SW raíz antiguo interceptaba TODOS los GET (incluido
  // Supabase) y acababa en "Failed to fetch". Limpiamos y no registramos SW.
  if (import.meta.env.DEV) {
    void navigator.serviceWorker.getRegistrations().then(regs => {
      for (const reg of regs) void reg.unregister();
    });
    if ('caches' in window) {
      void caches.keys().then(keys => {
        for (const key of keys) void caches.delete(key);
      });
    }
    return;
  }

  void (async () => {
    // El SW público (`/service-worker.js`) no debe controlar /comercial/:
    // versiones viejas interceptaban cross-origin y rompían Auth/REST.
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const script =
        reg.active?.scriptURL ?? reg.waiting?.scriptURL ?? reg.installing?.scriptURL ?? '';
      if (script.endsWith('/service-worker.js')) {
        await reg.unregister();
      }
    }
    await navigator.serviceWorker
      .register('/comercial-sw.js', { scope: '/comercial/' })
      .catch(() => {
        // Sin service worker no hay shell offline, pero la app sigue funcionando online.
      });
  })();
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function setupPwaInstallBanner(): void {
  const banner = document.getElementById('comercial-pwa-banner');
  if (!banner) return;
  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    if (sessionStorage.getItem('comercial_pwa_dismissed') === '1') return;
    banner.hidden = false;
  });

  banner.querySelector('[data-pwa-install]')?.addEventListener('click', () => {
    trackCommercialUsage('pwa_install', {}, state.view);
    void deferredPrompt?.prompt().then(() => {
      banner.hidden = true;
    });
  });

  banner.querySelector('[data-pwa-dismiss]')?.addEventListener('click', () => {
    trackCommercialUsage('pwa_dismiss', {}, state.view);
    banner.hidden = true;
    sessionStorage.setItem('comercial_pwa_dismissed', '1');
  });

  window.addEventListener('appinstalled', () => {
    banner.hidden = true;
    deferredPrompt = null;
  });
}

function boot(): void {
  void initAuthFlow({
    onRecovery: () => {
      renderNewPassword(app, () => {
        clearRecoveryFlag();
        void bootAfterLogin();
      });
    },
    onSessionReady: async session => {
      await handleSessionReady(session);
    },
  });
}

async function handleSessionReady(session: Session | null): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    app.innerHTML = configMissingHtml();
    return;
  }
  if (!session) {
    renderLoginPanel(app, '', () => void bootAfterLogin());
    return;
  }
  await bootAfterLogin();
}

async function bootAfterLogin(): Promise<void> {
  if (!supabase) return;
  const session = await getCurrentSession();
  if (!session) {
    renderLoginPanel(app, '', () => void bootAfterLogin());
    return;
  }
  state.email = session.user.email ?? '';
  state.userId = session.user.id;

  const { data: perfil } = await supabase
    .from('admin_profiles')
    .select('rol,activo,nombre,telefono')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const perfilRow = perfil as {
    rol?: string;
    activo?: boolean;
    nombre?: string;
    telefono?: string;
  } | null;
  const rol = String(perfilRow?.rol ?? '');
  const activo = perfilRow?.activo !== false;

  // Espejo de is_comercial_user() en SQL: solo ventas/admin/owner activos
  // pueden operar el CMS comercial (catalogo, gestion, lectura no aplican aqui).
  if (!esUsuarioComercial(rol, activo)) {
    toast('Tu cuenta no tiene acceso comercial activo. Contacta al administrador.', 'error');
    await signOut();
    resetSessionState();
    renderLoginPanel(app, session.user.email ?? '', () => void bootAfterLogin());
    return;
  }
  state.rol = rol;
  state.nombre = perfilRow?.nombre ?? '';
  state.telefono = perfilRow?.telefono ?? '';
  trackCommercialUsage('login', { source: 'session' }, state.view);
  void updateLastLogin(session.user.id);

  if (!idleWatcher) {
    idleWatcher = startIdleWatch(() => void handleIdleLogout());
  }

  state.view = parseView(location.hash);
  await render();
}

async function updateLastLogin(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('touch_admin_last_login');
  if (error) {
    // Fallback legacy: columna/RPC pueden no existir aún.
    const legacy = await supabase
      .from('admin_profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (legacy.error) {
      console.debug('[comercial] last_login_at no actualizado:', error.message);
    }
  }
}

async function handleIdleLogout(): Promise<void> {
  idleWatcher?.stop();
  idleWatcher = null;
  trackCommercialUsage('idle_logout', {}, state.view);
  await signOut();
  resetSessionState();
  clearSelection();
  toast('Sesión cerrada por inactividad.', 'info');
  renderLoginPanel(app, '', () => void bootAfterLogin());
}

/* ------------------------------------------------------------------ */
/* Render principal                                                    */
/* ------------------------------------------------------------------ */

async function render(): Promise<void> {
  if (!supabase) {
    app.innerHTML = configMissingHtml();
    return;
  }
  if (!vistaPermitida(state.view)) state.view = 'catalogo';

  unbindCurrentView?.();
  unbindCurrentView = null;

  const view = await routeView();
  app.innerHTML = shellHtml(view.title, view.body);
  if (lastTrackedView !== state.view) {
    lastTrackedView = state.view;
    trackCommercialUsage('view', {}, state.view);
  }
  bindShell();

  const viewBody = app.querySelector<HTMLElement>('[data-view-body]');
  if (state.view === 'catalogo' && viewBody) {
    unbindCurrentView = bindCatalogoView(viewBody, {
      onShare: openShareModal,
      onQuote: productos => {
        writeQuotePrefill(productos.map(p => ({ slug: p.slug, nombre: p.nombre_es, cantidad: 1 })));
        location.hash = '#/cotizaciones/nueva';
      },
    });
  }
  if (state.view === 'cotizaciones' && viewBody) {
    unbindCurrentView = bindCotizacionesView(viewBody);
  }
  app.querySelector('[data-view-retry]')?.addEventListener('click', () => void render());
  app.querySelectorAll<HTMLButtonElement>('[data-retry-crm]').forEach(btn => {
    btn.addEventListener('click', () => void retryCrmSync(btn));
  });
  app.querySelectorAll<HTMLButtonElement>('[data-resend-share]').forEach(btn => {
    btn.addEventListener('click', () => void resendFailedShare(btn));
  });
  app.querySelector<HTMLFormElement>('[data-envios-search]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const q = String(new FormData(form).get('q') ?? '').trim();
    location.hash = enviosHash(1, q);
  });
}

async function retryCrmSync(btn: HTMLButtonElement): Promise<void> {
  const id = btn.getAttribute('data-id');
  if (!id) return;
  btn.disabled = true;
  btn.textContent = 'Reintentando…';
  const { error } = await callEdgeFunction('comercial-share', {
    method: 'POST',
    query: { action: 'retry', id },
  });
  if (error) {
    trackCommercialUsage('crm_retry', { result: 'failed' }, state.view);
    toast(error, 'error');
    btn.disabled = false;
    btn.textContent = 'Reintentar CRM';
    return;
  }
  toast('Sincronización con Twenty reintentada.', 'success');
  trackCommercialUsage('crm_retry', { result: 'succeeded' }, state.view);
  await render();
}

/**
 * Reenvío real tras fallo: abre modal con productos + datos del envío fallido.
 * Backend libera idempotency_key de filas failed al crear de nuevo.
 */
async function resendFailedShare(btn: HTMLButtonElement): Promise<void> {
  const id = btn.getAttribute('data-id');
  if (!id || !supabase) return;
  btn.disabled = true;
  btn.textContent = 'Preparando…';
  const { data, error } = await supabase
    .from('commercial_shares')
    .select(
      'id,recipient_name,medical_center_name,recipient_email,recipient_phone,phone_country_code,channel,message,status'
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    toast(error?.message ?? 'Envío no encontrado', 'error');
    btn.disabled = false;
    btn.textContent = 'Reenviar';
    return;
  }
  const share = data as {
    recipient_name: string;
    medical_center_name: string | null;
    recipient_email: string | null;
    recipient_phone: string | null;
    phone_country_code: string | null;
    channel: 'email' | 'whatsapp';
    message: string | null;
  };
  const { data: products } = await supabase
    .from('commercial_share_products')
    .select('product_id, product_name_snapshot, product_slug_snapshot, product_sku_snapshot')
    .eq('commercial_share_id', id);
  const productRows = (products ?? []) as Array<{
    product_id: string;
    product_name_snapshot: string;
    product_slug_snapshot: string | null;
    product_sku_snapshot: string | null;
  }>;
  if (productRows.length === 0) {
    toast('El envío no tiene productos asociados.', 'error');
    btn.disabled = false;
    btn.textContent = 'Reenviar';
    return;
  }
  const productos: ProductoComercial[] = productRows.map(p => ({
    id: p.product_id,
    slug: p.product_slug_snapshot ?? p.product_id,
    sku: p.product_sku_snapshot,
    nombre_es: p.product_name_snapshot,
    descripcion_corta_es: null,
    imagen_principal: null,
    familia_id: null,
    tipo_id: null,
    tipo_comercial: 'equipo',
    disponible: true,
  }));
  btn.disabled = false;
  btn.textContent = 'Reenviar';
  openShareModal(productos, {
    recipientName: share.recipient_name,
    medicalCenterName: share.medical_center_name ?? undefined,
    channel: share.channel,
    recipientEmail: share.recipient_email ?? undefined,
    recipientPhone: share.recipient_phone ?? undefined,
    phoneCountryCode: share.phone_country_code ?? undefined,
    message: share.message ?? undefined,
  });
}

async function routeView(): Promise<{ title: string; body: string }> {
  if (state.view === 'cotizaciones')
    return { title: 'Cotizaciones', body: await renderCotizacionesView() };
  if (state.view === 'envios') return { title: 'Envíos', body: await enviosView() };
  if (state.view === 'plantillas') return { title: 'Plantillas', body: await plantillasView() };
  if (state.view === 'integraciones')
    return { title: 'Integraciones', body: await integracionesView() };
  if (state.view === 'usuarios') return { title: 'Usuarios CMS', body: await usuariosView() };
  return { title: 'Catálogo comercial', body: await renderCatalogoView() };
}

function configMissingHtml(): string {
  return `
    <div class="comercial-auth">
      <div class="comercial-auth__panel comercial-form">
        <h1>Configuración pendiente</h1>
        <p>Configura <code>PUBLIC_SUPABASE_URL</code> y <code>PUBLIC_SUPABASE_ANON_KEY</code> para usar el portal comercial.</p>
      </div>
    </div>`;
}

function shellHtml(title: string, body: string): string {
  const links: Array<[ComercialView, string]> = [
    ['catalogo', 'Catálogo'],
    ['cotizaciones', 'Cotizaciones'],
    ['envios', 'Envíos'],
  ];
  if (esRolAdmin(state.rol)) {
    links.push(
      ['plantillas', 'Plantillas'],
      ['integraciones', 'Integraciones'],
      ['usuarios', 'Usuarios CMS']
    );
  }
  return `
    <div class="comercial-shell">
      <a class="comercial-skip-link" href="#comercial-main">Saltar al contenido</a>
      <aside class="comercial-sidebar">
        <div class="comercial-sidebar__brand">
          <span class="comercial-sidebar__mark">I·ME</span>
          <span>Comercial</span>
        </div>
        <nav class="comercial-sidebar__nav" aria-label="Navegación comercial">
          ${links
            .map(
              ([view, label]) =>
                `<a class="comercial-nav-link${state.view === view ? ' comercial-nav-link--active' : ''}" href="#/${view}"${state.view === view ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`
            )
            .join('')}
        </nav>
        <button class="comercial-button comercial-button--ghost comercial-sidebar__logout" type="button" data-logout>
          Salir
        </button>
      </aside>
      <div class="comercial-content">
        <header class="comercial-topbar">
          <h1>${escapeHtml(title)}</h1>
          <span class="comercial-topbar__meta">${escapeHtml(state.email)} · ${escapeHtml(state.rol)}</span>
        </header>
        <main id="comercial-main" class="comercial-view" data-view-body tabindex="-1">${body}</main>
      </div>
    </div>`;
}

function bindShell(): void {
  app.querySelector('[data-logout]')?.addEventListener('click', async () => {
    trackCommercialUsage('logout', {}, state.view);
    idleWatcher?.stop();
    idleWatcher = null;
    await signOut();
    resetSessionState();
    clearSelection();
    renderLoginPanel(app, '', () => void bootAfterLogin());
  });
}

/* ------------------------------------------------------------------ */
/* Vistas secundarias                                                  */
/* ------------------------------------------------------------------ */

function panel(title: string, contentHtml: string): string {
  return `<section class="comercial-panel"><div class="comercial-panel__head"><h2>${escapeHtml(title)}</h2></div>${contentHtml}</section>`;
}

function fallbackState(message: string, detail?: string): string {
  return `
    <div class="comercial-state comercial-state--empty">
      <p>${escapeHtml(message)}</p>
      ${detail ? `<p class="comercial-help">${escapeHtml(detail)}</p>` : ''}
      <button class="comercial-button comercial-button--ghost" type="button" data-view-retry>Reintentar</button>
    </div>`;
}

/**
 * Insignias inline para tablas (envíos/plantillas/usuarios). Usan el
 * modificador `--status-*` en vez de `--ok`/`--warn` "a secas" porque esos
 * últimos están posicionados en absoluto para las tarjetas de producto
 * (ver `.comercial-card__media .comercial-badge--warn` en comercial.css).
 * Solo estados que el backend escribe hoy; opened/delivered/read no tienen
 * webhooks — se muestran como Enviado si aparecen filas legacy.
 */
function statusBadge(status: string): string {
  const normalized =
    status === 'opened' || status === 'delivered' || status === 'read' ? 'sent' : status;
  const kind: 'ok' | 'error' | 'warn' =
    normalized === 'sent' || normalized === 'prepared' || normalized === 'queued'
      ? 'ok'
      : normalized === 'failed'
        ? 'error'
        : 'warn';
  const labels: Record<string, string> = {
    draft: 'Borrador',
    prepared: 'Preparado (WhatsApp)',
    queued: 'En cola',
    sent: 'Enviado',
    failed: 'Fallido',
  };
  return `<span class="comercial-badge comercial-badge--status-${kind}">${escapeHtml(labels[normalized] ?? normalized)}</span>`;
}

function crmBadge(status: string): string {
  const kind: 'ok' | 'error' | 'warn' | 'muted' =
    status === 'synced'
      ? 'ok'
      : status === 'failed'
        ? 'error'
        : status === 'skipped'
          ? 'muted'
          : 'warn';
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    synced: 'Sincronizado',
    failed: 'Falló',
    skipped: 'Omitido (sin config.)',
  };
  return `<span class="comercial-badge comercial-badge--status-${kind}">${escapeHtml(labels[status] ?? status)}</span>`;
}

interface ShareRowView {
  id: string;
  user_id: string;
  recipient_name: string;
  medical_center_name: string | null;
  channel: 'email' | 'whatsapp';
  status: string;
  crm_sync_status: string;
  created_at: string;
  sent_at: string | null;
}

/** Tabla de envíos comerciales (`commercial_shares`) con insignias de estado y reintento CRM. */
function sharesTable(rows: ShareRowView[], showUser: boolean): string {
  return `
    <div class="comercial-table-wrap">
      <table class="comercial-table">
        <thead>
          <tr>
            <th>Destinatario</th>
            <th>Centro médico</th>
            <th>Canal</th>
            <th>Estado</th>
            <th>CRM</th>
            <th>Fecha</th>
            ${showUser ? '<th>Comercial</th>' : ''}
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              row => `
            <tr>
              <td>${escapeHtml(row.recipient_name)}</td>
              <td>${escapeHtml(row.medical_center_name ?? '—')}</td>
              <td>${row.channel === 'email' ? 'Email' : 'WhatsApp'}</td>
              <td>${statusBadge(row.status)}</td>
              <td>${crmBadge(row.crm_sync_status)}</td>
              <td>${escapeHtml(formatDate(row.created_at))}</td>
              ${showUser ? `<td>${escapeHtml(row.user_id.slice(0, 8))}…</td>` : ''}
              <td>
                ${
                  row.status === 'failed'
                    ? `<button class="comercial-button comercial-button--primary comercial-button--sm" type="button" data-resend-share data-id="${escapeHtml(row.id)}">Reenviar</button>`
                    : ''
                }
                ${
                  row.crm_sync_status === 'failed'
                    ? `<button class="comercial-button comercial-button--ghost comercial-button--sm" type="button" data-retry-crm data-id="${escapeHtml(row.id)}">Reintentar CRM</button>`
                    : ''
                }
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

async function enviosView(): Promise<string> {
  const params = hashQuery();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const pageSize = 20;
  const q = (params.get('q') ?? '').trim();
  const isAdmin = esRolAdmin(state.rol);

  const query: Record<string, string> = {
    page: String(page),
    pageSize: String(pageSize),
  };
  if (q) query['q'] = q;

  const { data, error } = await callEdgeFunction<{
    shares: ShareRowView[];
    page: number;
    pageSize: number;
    total: number;
  }>('comercial-share', { method: 'GET', query });

  if (error) {
    return panel('Envíos', fallbackState('No fue posible cargar el historial de envíos.', error));
  }

  const rows = data?.shares ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const title = isAdmin ? `Envíos del equipo (${total})` : `Mis envíos (${total})`;

  const searchForm = `
    <form class="comercial-toolbar" data-envios-search style="display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;align-items:center">
      <input class="comercial-input" type="search" name="q" value="${escapeHtml(q)}" placeholder="Buscar destinatario, centro, email o teléfono" style="flex:1;min-width:200px" />
      <button class="comercial-button" type="submit">Buscar</button>
      ${q ? `<a class="comercial-button comercial-button--ghost" href="#/envios">Limpiar</a>` : ''}
    </form>`;

  if (rows.length === 0) {
    return panel(
      title,
      `${searchForm}<div class="comercial-state comercial-state--empty"><p>${q ? 'Sin resultados para esa búsqueda.' : 'Todavía no se han enviado catálogos.'}</p></div>`
    );
  }

  const pager =
    totalPages > 1
      ? `<nav class="comercial-pager" style="display:flex;gap:8px;padding:12px 16px;align-items:center" aria-label="Paginación envíos">
          ${page > 1 ? `<a class="comercial-button comercial-button--ghost" href="${escapeHtml(enviosHash(page - 1, q))}">Anterior</a>` : ''}
          <span class="comercial-help">Página ${page} / ${totalPages}</span>
          ${page < totalPages ? `<a class="comercial-button comercial-button--ghost" href="${escapeHtml(enviosHash(page + 1, q))}">Siguiente</a>` : ''}
        </nav>`
      : '';

  return panel(title, `${searchForm}${sharesTable(rows, isAdmin)}${pager}`);
}

function hashQuery(): URLSearchParams {
  const raw = location.hash.includes('?')
    ? location.hash.slice(location.hash.indexOf('?') + 1)
    : '';
  return new URLSearchParams(raw);
}

function enviosHash(page: number, q: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `#/envios?${qs}` : '#/envios';
}

interface PlantillaRow {
  id: string;
  name: string;
  channel: 'email' | 'whatsapp';
  subject: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

async function plantillasView(): Promise<string> {
  if (!supabase) return panel('Plantillas', fallbackState('Supabase no configurado.'));
  const { data, error } = await supabase
    .from('commercial_message_templates')
    .select('id,name,channel,subject,is_default,is_active,created_at')
    .order('channel', { ascending: true })
    .order('is_default', { ascending: false });
  if (error) {
    return panel(
      'Plantillas',
      fallbackState('No fue posible cargar las plantillas de mensaje.', error.message)
    );
  }
  const rows = (data ?? []) as PlantillaRow[];
  if (rows.length === 0) {
    return panel(
      'Plantillas',
      `<div class="comercial-state comercial-state--empty"><p>No hay plantillas registradas.</p></div>`
    );
  }
  return panel(
    `Plantillas de mensaje (${rows.length})`,
    `
    <p class="comercial-help">La edición de plantillas todavía se gestiona directamente en la base de datos (tabla <code>commercial_message_templates</code>) — aún no hay una pantalla de edición en el CMS. Aquí puedes consultar cuáles están activas y cuál es la predeterminada por canal.</p>
    <div class="comercial-table-wrap">
      <table class="comercial-table">
        <thead><tr><th>Nombre</th><th>Canal</th><th>Asunto</th><th>Predeterminada</th><th>Activa</th><th>Creada</th></tr></thead>
        <tbody>
          ${rows
            .map(
              row => `
            <tr>
              <td>${escapeHtml(row.name)}</td>
              <td>${row.channel === 'email' ? 'Email' : 'WhatsApp'}</td>
              <td>${escapeHtml(row.subject ?? '—')}</td>
              <td>${row.is_default ? '<span class="comercial-badge comercial-badge--status-ok">Sí</span>' : '—'}</td>
              <td>${row.is_active ? '<span class="comercial-badge comercial-badge--status-ok">Activa</span>' : '<span class="comercial-badge comercial-badge--status-muted">Inactiva</span>'}</td>
              <td>${escapeHtml(formatDate(row.created_at))}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`
  );
}

async function integracionesView(): Promise<string> {
  if (!supabase) return panel('Integraciones', fallbackState('Supabase no configurado.'));

  type StatusPayload = {
    twenty?: {
      configured?: boolean;
      connectivity?: string;
      detail?: string;
      whatsappMode?: string;
    };
    queue?: { pending?: number; failed?: number };
  };
  const { data: statusData } = await callEdgeFunction<StatusPayload>('comercial-share', {
    method: 'GET',
    query: { action: 'status' },
  });

  const { data, error } = await supabase
    .from('commercial_shares')
    .select('id,recipient_name,crm_sync_status,created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    return panel(
      'Integraciones',
      fallbackState('No fue posible calcular el estado de sincronización.', error.message)
    );
  }
  const rows = (data ?? []) as Array<{
    id: string;
    recipient_name: string;
    crm_sync_status: string;
    created_at: string;
  }>;
  const counts = { synced: 0, pending: 0, failed: 0, skipped: 0 } as Record<string, number>;
  for (const row of rows) counts[row.crm_sync_status] = (counts[row.crm_sync_status] ?? 0) + 1;
  const fallidos = rows.filter(r => r.crm_sync_status === 'failed').slice(0, 20);

  const twenty = statusData?.twenty;
  const connectivityLabel =
    twenty?.connectivity === 'ok'
      ? 'Conectado'
      : twenty?.connectivity === 'error'
        ? 'Error de conectividad'
        : twenty?.configured
          ? 'Configurado (sin prueba)'
          : 'No configurado';
  const connectivityClass =
    twenty?.connectivity === 'ok' ? 'ok' : twenty?.connectivity === 'error' ? 'error' : 'muted';

  return panel(
    'Integraciones — Twenty CRM',
    `
    <div class="comercial-integration-card">
      <p class="comercial-help">
        Cada envío de catálogo sincroniza contacto + nota en Twenty CRM de forma automática (best-effort).
        Los secretos nunca se muestran aquí.
      </p>
      <div class="comercial-stat-grid">
        <div class="comercial-stat"><strong class="comercial-badge comercial-badge--status-${connectivityClass}">${escapeHtml(connectivityLabel)}</strong><span>Twenty CRM</span></div>
        <div class="comercial-stat"><strong>${escapeHtml(twenty?.whatsappMode ?? 'link')}</strong><span>Modo WhatsApp</span></div>
        <div class="comercial-stat"><strong>${statusData?.queue?.pending ?? counts['pending'] ?? 0}</strong><span>Cola pendiente</span></div>
        <div class="comercial-stat"><strong>${statusData?.queue?.failed ?? counts['failed'] ?? 0}</strong><span>Fallidos</span></div>
      </div>
      <div class="comercial-stat-grid">
        <div class="comercial-stat"><strong>${counts['synced'] ?? 0}</strong><span>Sincronizados (muestra)</span></div>
        <div class="comercial-stat"><strong>${counts['skipped'] ?? 0}</strong><span>Omitidos</span></div>
      </div>
      ${twenty?.detail ? `<p class="comercial-help" role="alert">${escapeHtml(twenty.detail)}</p>` : ''}
      <button class="comercial-button comercial-button--ghost" type="button" data-view-retry>Actualizar</button>
    </div>
    ${
      fallidos.length > 0
        ? `
      <h3 class="comercial-subheading">Sincronizaciones fallidas recientes</h3>
      <div class="comercial-table-wrap">
        <table class="comercial-table">
          <thead><tr><th>Destinatario</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            ${fallidos
              .map(
                row => `
              <tr>
                <td>${escapeHtml(row.recipient_name)}</td>
                <td>${escapeHtml(formatDate(row.created_at))}</td>
                <td><button class="comercial-button comercial-button--ghost comercial-button--sm" type="button" data-retry-crm data-id="${escapeHtml(row.id)}">Reintentar</button></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
        : ''
    }`
  );
}

interface UsuarioRow {
  user_id: string;
  email: string;
  nombre: string | null;
  rol: string;
  activo: boolean;
  last_login_at: string | null;
}

async function usuariosView(): Promise<string> {
  if (!supabase) return panel('Usuarios CMS', fallbackState('Supabase no configurado.'));
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('user_id,email,nombre,rol,activo,last_login_at')
    .in('rol', ['ventas', 'admin', 'owner'])
    .order('rol', { ascending: true })
    .order('email', { ascending: true });
  if (error) {
    return panel(
      'Usuarios CMS',
      `<div class="comercial-state comercial-state--empty">
        <p>No fue posible listar los usuarios desde aquí (permisos insuficientes).</p>
        <p class="comercial-help">Gestiona usuarios comerciales en <a href="/admin#/usuarios">/admin#/usuarios</a>.</p>
      </div>`
    );
  }
  const rows = (data ?? []) as UsuarioRow[];
  return panel(
    `Usuarios comerciales (${rows.length})`,
    `
    <div class="comercial-table-wrap">
      <table class="comercial-table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Último acceso</th></tr></thead>
        <tbody>
          ${rows
            .map(
              row => `
            <tr>
              <td>${escapeHtml(row.nombre ?? '—')}</td>
              <td>${escapeHtml(row.email)}</td>
              <td>${escapeHtml(row.rol)}</td>
              <td>${row.activo ? '<span class="comercial-badge comercial-badge--status-ok">Activo</span>' : '<span class="comercial-badge comercial-badge--status-muted">Inactivo</span>'}</td>
              <td>${row.last_login_at ? escapeHtml(formatDate(row.last_login_at)) : '—'}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <p class="comercial-help">Para crear o editar usuarios comerciales, usa <a href="/admin#/usuarios">/admin#/usuarios</a>.</p>`
  );
}
