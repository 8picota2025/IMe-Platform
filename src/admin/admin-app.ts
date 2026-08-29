import { sanitizeArticuloSlug, isValidArticuloSlug } from '../lib/articulo-slug';
import { renderMarkdown } from '../lib/markdown';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import {
  normalizeNumeroDocumento,
  validateClienteFiscal,
  type ClienteFiscalProfile,
  type TipoDocumentoFiscal,
  type TipoPersonaFiscal,
} from '../lib/fiscal';
import { verificarNitCampo, esFuenteDianContribuyente } from '../lib/nit-dian';
import {
  planificarAutoasignacionTipos,
  mensajeBloqueoEliminarFamilia,
  mensajeBloqueoEliminarTipo,
  validarFamiliaYTipoProducto,
  validarTipoEditable,
  validarFamiliaEditable,
  type FamiliaRow,
  type TipoRow,
  type ProductoTaxonomiaRow,
} from './taxonomia-logic';
import {
  GA4_MEASUREMENT_ID,
  SEARCH_CONSOLE_SITEMAP,
  resolveGaId,
  resolveSearchConsoleHtmlFile,
  resolveSearchConsoleVerification,
} from '../lib/analytics-config';
import {
  buildAtributosPayload,
  buildIngestUserPrompt,
  deriveEnrichedFields,
  inferFamiliaSugerida,
  inferTipoSugerido,
  productPdfPublicPath,
  productPdfStoragePath,
  revisableStringsFromDraft,
} from '../lib/pdf-ingest-enrich';
import type { CotizacionLineaOferta } from '../lib/cotizacion-oferta';
import { bindQuoteCatalogSearch, bindQuoteProductIngest } from '../lib/quote-line-tools';

const OLLAMA_URL = (import.meta.env['PUBLIC_OLLAMA_URL'] as string | undefined) ?? '';
const OLLAMA_INGEST_MODEL = 'qwen3:1.7b';
const OLLAMA_EMBED_MODEL = 'mxbai-embed-large';
const PUBLIC_GA_ID = resolveGaId();
const PUBLIC_GTM_ID = (import.meta.env['PUBLIC_GTM_ID'] as string | undefined)?.trim() ?? '';
const PUBLIC_CLARITY_ID =
  (import.meta.env['PUBLIC_CLARITY_ID'] as string | undefined)?.trim() ?? '';
const PUBLIC_SEARCH_CONSOLE_VERIFICATION = resolveSearchConsoleVerification();
const PUBLIC_SEARCH_CONSOLE_FILE = resolveSearchConsoleHtmlFile();

type View =
  | 'dashboard'
  | 'crm'
  | 'productos'
  | 'producto'
  | 'taxonomia'
  | 'cotizaciones'
  | 'cotizacion'
  | 'clientes'
  | 'cliente'
  | 'pedidos'
  | 'pedido'
  | 'facturas'
  | 'factura'
  | 'cupones'
  | 'cupon'
  | 'reportes'
  | 'marketing'
  | 'proveedores'
  | 'proveedor-productos'
  | 'fulfillments'
  | 'usuarios'
  | 'plantillas'
  | 'listas'
  | 'lista'
  | 'envios'
  | 'resenas'
  | 'conocimiento'
  | 'propuestas'
  | 'ingesta'
  | 'asesor';

type Row = Record<string, unknown>;

interface CommercialUsageSummary {
  available: boolean;
  events: number;
  activeUsers: number;
  sessions: number;
  logins: number;
  catalogViews: number;
  enviosViews: number;
  searches: number;
  filters: number;
  shareOpens: number;
  shareSubmitted: number;
  shareSucceeded: number;
  shareFailed: number;
  shares: number;
  whatsapp: number;
  email: number;
  crmSynced: number;
  topViews: Array<[string, number]>;
}

function emptyCommercialUsageSummary(available = false): CommercialUsageSummary {
  return {
    available,
    events: 0,
    activeUsers: 0,
    sessions: 0,
    logins: 0,
    catalogViews: 0,
    enviosViews: 0,
    searches: 0,
    filters: 0,
    shareOpens: 0,
    shareSubmitted: 0,
    shareSucceeded: 0,
    shareFailed: 0,
    shares: 0,
    whatsapp: 0,
    email: 0,
    crmSynced: 0,
    topViews: [],
  };
}

async function commercialUsageSummary(days = 30): Promise<CommercialUsageSummary> {
  if (!supabase) return emptyCommercialUsageSummary();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [usageResult, sharesResult] = await Promise.all([
    supabase
      .from('commercial_usage_events')
      .select('event_name,user_id,session_id,view,created_at')
      .gte('created_at', since)
      .limit(10000),
    supabase
      .from('commercial_shares')
      .select('user_id,channel,crm_sync_status,created_at')
      .gte('created_at', since)
      .limit(5000),
  ]);
  if (usageResult.error) return emptyCommercialUsageSummary(false);

  const usage = (usageResult.data ?? []) as Row[];
  const shares = sharesResult.error ? [] : ((sharesResult.data ?? []) as Row[]);
  const summary = emptyCommercialUsageSummary(true);
  summary.events = usage.length;
  summary.activeUsers = new Set(usage.map(row => text(row.user_id)).filter(Boolean)).size;
  summary.sessions = new Set(usage.map(row => text(row.session_id)).filter(Boolean)).size;
  summary.logins = usage.filter(row => text(row.event_name) === 'login').length;
  summary.catalogViews = usage.filter(
    row => text(row.event_name) === 'view' && text(row.view) === 'catalogo'
  ).length;
  summary.enviosViews = usage.filter(
    row => text(row.event_name) === 'view' && text(row.view) === 'envios'
  ).length;
  summary.searches = usage.filter(row => text(row.event_name) === 'search').length;
  summary.filters = usage.filter(row => text(row.event_name) === 'filter').length;
  summary.shareOpens = usage.filter(row => text(row.event_name) === 'share_modal_open').length;
  summary.shareSubmitted = usage.filter(row => text(row.event_name) === 'share_submitted').length;
  summary.shareSucceeded = usage.filter(row => text(row.event_name) === 'share_succeeded').length;
  summary.shareFailed = usage.filter(row => text(row.event_name) === 'share_failed').length;
  summary.shares = shares.length;
  summary.whatsapp = shares.filter(row => text(row.channel) === 'whatsapp').length;
  summary.email = shares.filter(row => text(row.channel) === 'email').length;
  summary.crmSynced = shares.filter(row => text(row.crm_sync_status) === 'synced').length;
  const viewCounts = new Map<string, number>();
  for (const row of usage.filter(item => text(item.event_name) === 'view')) {
    const view = text(row.view) || 'sin vista';
    viewCounts.set(view, (viewCounts.get(view) ?? 0) + 1);
  }
  summary.topViews = Array.from(viewCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return summary;
}
type ProductoDraft = {
  id: string | undefined;
  slug: string;
  sku: string;
  gtin: string;
  nombre_es: string;
  nombre_en: string;
  descripcion_corta_es: string;
  descripcion_corta_en: string;
  descripcion_larga_es: string;
  descripcion_larga_en: string;
  familia_id: string;
  tipo_id: string;
  especificaciones: unknown[];
  aplicaciones_es: string[];
  aplicaciones_en: string[];
  imagen_principal: string;
  ficha_pdf: string;
  atributos: Row;
  peso_kg: number | null;
  dimensiones_cm: Row;
  tipo_comercial: 'consumible' | 'equipo';
  fulfillment_mode: 'dropship' | 'cotizacion' | 'individualizado';
  precio: number | null;
  precio_regular: number | null;
  precio_oferta: number | null;
  dian_codigo: string;
  tarifa_iva_pct: number | null;
  retencion_fuente_pct: number | null;
  retencion_iva_pct: number | null;
  retencion_ica_pct: number | null;
  oferta_inicio: string;
  oferta_fin: string;
  moneda: string;
  stock: number | null;
  gestionar_stock: boolean;
  stock_estado: 'instock' | 'outofstock' | 'onbackorder';
  backorder_policy: 'no' | 'notify' | 'yes';
  destacado: boolean;
  nuevo: boolean;
  activo: boolean;
  /** Escenario A: disponibilidad en tiempo real (independiente de `activo`). */
  disponible: boolean;
  excluido_iva: boolean;
  orden: number;
};

type ArticuloDraft = {
  id: string | undefined;
  slug: string;
  titulo_es: string;
  titulo_en: string;
  cuerpo_es: string;
  cuerpo_en: string;
  imagen: string;
  publicado: boolean;
  autor_tipo: string;
  autor_nombre: string;
  autor_empresa: string;
  autor_bio_corta: string;
};

interface CampoRevisable {
  valor: string;
  origen: string;
  confianza: number;
  requiere_revision: boolean;
}

interface EspecRevisable extends CampoRevisable {
  clave: string;
  grupo: string;
}

let ingestFamilias: Row[] = [];
let ingestTipos: Row[] = [];
let lastIngestPdfFile: File | null = null;
const INGEST_PDF_MAX_BYTES = 25 * 1024 * 1024;
const INGEST_PDF_MAX_CHARS = 60_000;
/** Tope imágenes producto (LCP / storage). PDFs usan INGEST_PDF_MAX_BYTES. */
const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const appElement = document.getElementById('admin-app');
const supabase = getSupabaseClient();

if (!appElement) throw new Error('admin-app root missing');
const app = appElement;

const state = {
  view: parseView(location.hash),
  recordId: new URLSearchParams(location.hash.split('?')[1] ?? '').get('id'),
  email: '',
  rol: '' as string,
};

/** Vistas visibles por rol (owner/admin ven todo; RLS es la barrera real en DB). */
const VISTAS_POR_ROL: Record<string, Set<View>> = {
  catalogo: new Set<View>([
    'dashboard',
    'productos',
    'producto',
    'taxonomia',
    'ingesta',
    'conocimiento',
    'propuestas',
  ]),
  ventas: new Set<View>([
    'dashboard',
    'crm',
    'clientes',
    'cliente',
    'cotizaciones',
    'cotizacion',
    'pedidos',
    'pedido',
    'facturas',
    'factura',
    'cupones',
    'cupon',
    'listas',
    'lista',
    'resenas',
    'plantillas',
    'reportes',
    'marketing',
    'asesor',
    'conocimiento',
    'propuestas',
  ]),
  operaciones: new Set<View>([
    'dashboard',
    'crm',
    'pedidos',
    'pedido',
    'facturas',
    'factura',
    'proveedores',
    'proveedor-productos',
    'fulfillments',
    'envios',
    'plantillas',
    'reportes',
  ]),
  lectura: new Set<View>(['dashboard', 'reportes', 'marketing']),
};

function vistaPermitida(view: View): boolean {
  if (!state.rol || state.rol === 'owner' || state.rol === 'admin') return true;
  const permitidas = VISTAS_POR_ROL[state.rol];
  return permitidas ? permitidas.has(view) : true;
}

function rolesQuePuedenVer(view: View): string[] {
  const roles = ['owner', 'admin'];
  for (const [rol, vistas] of Object.entries(VISTAS_POR_ROL)) {
    if (vistas.has(view)) roles.push(rol);
  }
  return roles;
}

function accesoDenegadoView(view: View): { title: string; body: string } {
  const roles = rolesQuePuedenVer(view).join(', ');
  return {
    title: 'Acceso restringido',
    body: `
      <div class="admin-alert">
        Tu rol actual (<strong>${escapeHtml(state.rol || 'sin rol')}</strong>) no incluye
        <code>#/${escapeHtml(view)}</code>.
        Roles con acceso: <strong>${escapeHtml(roles)}</strong>.
        El menú lateral muestra todas las funciones; las bloqueadas quedan atenuadas.
        Pide a un owner/admin que ajuste tu perfil en Usuarios CMS si necesitas acceso.
      </div>
      <p class="admin-help"><a class="admin-button admin-button--ghost" href="#/dashboard">Volver al dashboard</a></p>
    `,
  };
}

window.addEventListener('hashchange', () => {
  state.view = parseView(location.hash);
  state.recordId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('id');
  void render();
});

// Flag: prevents render() from overwriting renderNewPassword() after getSession() resolves
let recoveryHandled = false;

supabase?.auth.onAuthStateChange((event: AuthChangeEvent) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryHandled = true;
    history.replaceState(null, '', location.pathname);
    renderNewPassword();
  }
});

void initializeAuth();

function hashParams(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}

function recoveryParams() {
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.substring(1));
  return {
    code: search.get('code'),
    searchType: search.get('type'),
    hashType: hash.get('type'),
    hasAccessToken: hash.has('access_token'),
  };
}

function isRecoveryFlow(): boolean {
  const params = recoveryParams();
  return Boolean(
    params.code ||
    params.searchType === 'recovery' ||
    params.hashType === 'recovery' ||
    params.hasAccessToken
  );
}

function adminAuthRedirectUrl(): string {
  return new URL(location.pathname, window.location.origin).toString();
}

function clearRecoveryState() {
  recoveryHandled = false;
}

async function initializeAuth() {
  if (!supabase) {
    await render();
    return;
  }

  const params = recoveryParams();
  if (!isRecoveryFlow()) {
    await render();
    return;
  }

  // Clear only the local session before recovery so the reset link always
  // exchanges into the intended recovery session for this browser tab.
  await supabase.auth.signOut({ scope: 'local' });

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      history.replaceState(null, '', location.pathname);
      renderLoginPanel();
      toast(error.message);
      return;
    }

    recoveryHandled = true;
    history.replaceState(null, '', location.pathname);
    renderNewPassword();
    return;
  }

  await render();
}

function parseView(hash: string): View {
  const raw = hash.replace(/^#\/?/, '').split('?')[0];
  if (
    raw === 'productos' ||
    raw === 'crm' ||
    raw === 'producto' ||
    raw === 'taxonomia' ||
    raw === 'cotizaciones' ||
    raw === 'cotizacion' ||
    raw === 'clientes' ||
    raw === 'cliente' ||
    raw === 'pedidos' ||
    raw === 'pedido' ||
    raw === 'facturas' ||
    raw === 'factura' ||
    raw === 'cupones' ||
    raw === 'cupon' ||
    raw === 'reportes' ||
    raw === 'marketing' ||
    raw === 'proveedores' ||
    raw === 'proveedor-productos' ||
    raw === 'fulfillments' ||
    raw === 'usuarios' ||
    raw === 'plantillas' ||
    raw === 'listas' ||
    raw === 'lista' ||
    raw === 'envios' ||
    raw === 'resenas' ||
    raw === 'conocimiento' ||
    raw === 'blog' ||
    raw === 'propuestas' ||
    raw === 'ingesta' ||
    raw === 'asesor'
  ) {
    return raw === 'blog' ? 'conocimiento' : raw;
  }
  return 'dashboard';
}

async function render() {
  if (!isSupabaseConfigured() || !supabase) {
    app.innerHTML = shellHtml(
      'Configuracion pendiente',
      `<div class="admin-alert">Configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY para usar el admin. Sin esas variables no se abre sesion ni se escriben datos.</div>`
    );
    bindShell();
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // onAuthStateChange already showed renderNewPassword() — do not overwrite it
  if (recoveryHandled) return;

  // Implicit flow (older Supabase projects): token arrives in hash with type=recovery
  const recovery = recoveryParams();
  if ((recovery.searchType === 'recovery' || recovery.hashType === 'recovery') && session) {
    history.replaceState(null, '', location.pathname);
    renderNewPassword();
    return;
  }

  if (!session) {
    if (isRecoveryFlow()) return;
    renderLogin();
    return;
  }
  state.email = session.user.email ?? 'admin';
  if (!state.rol) {
    const { data: perfil } = await supabase!
      .from('admin_profiles')
      .select('rol')
      .eq('user_id', session.user.id)
      .maybeSingle();
    state.rol = String((perfil as Row | null)?.rol ?? '');
  }

  const view = await routeView();
  app.innerHTML = shellHtml(view.title, view.body);
  bindShell();
  bindView();
}

function renderLogin() {
  clearRecoveryState();
  renderLoginPanel();
}

function renderLoginPanel(prefillEmail = '') {
  if (!isRecoveryFlow()) clearRecoveryState();

  app.innerHTML = `
    <section class="admin-login">
      <form class="admin-login__panel admin-form" data-login>
        <div>
          <h1>I-ME Admin</h1>
          <p>Back-office privado para catalogo, cotizaciones, pedidos e ingesta documental.</p>
        </div>
        <label class="admin-field">Email
          <input name="email" type="email" autocomplete="email" required value="${escapeHtml(prefillEmail)}" />
        </label>
        <label class="admin-field">Contrasena
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="admin-button" type="submit">Entrar</button>
        <button class="admin-button admin-button--ghost" type="button" data-show-reset>¿Olvidaste tu contrasena?</button>
        <p class="admin-help">El usuario admin se crea manualmente en Supabase Auth. No hay registro publico.</p>
      </form>
    </section>`;
  const form = app.querySelector<HTMLFormElement>('[data-login]');

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    const { error } = await supabase!.auth.signInWithPassword({ email, password });

    if (error) {
      toast(error.message);
      return;
    }
    clearRecoveryState();
    location.hash = '#/dashboard';
    await render();
  });
  app.querySelector('[data-show-reset]')?.addEventListener('click', () => {
    const emailInput = form?.querySelector<HTMLInputElement>('input[name="email"]');
    renderPasswordReset(emailInput?.value ?? '');
  });
}

function renderPasswordReset(prefillEmail = '') {
  app.innerHTML = `
    <section class="admin-login">
      <form class="admin-login__panel admin-form" data-reset-form>
        <div>
          <h1>Restablecer contrasena</h1>
          <p>Introduce tu email de administrador y te enviaremos un enlace de restablecimiento.</p>
        </div>
        <label class="admin-field">Email
          <input name="email" type="email" autocomplete="email" required value="${escapeHtml(prefillEmail)}" />
        </label>
        <button class="admin-button" type="submit" data-reset-btn>Enviar enlace</button>
        <button class="admin-button admin-button--ghost" type="button" data-back-login>Volver al acceso</button>
        <p class="admin-help">Si el email tiene una cuenta de administrador recibiras el enlace en unos segundos. Revisa tambien la carpeta de spam.</p>
      </form>
    </section>`;
  const form = app.querySelector<HTMLFormElement>('[data-reset-form]');
  const btn = form?.querySelector<HTMLButtonElement>('[data-reset-btn]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = String(new FormData(form).get('email') ?? '');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando…';
    }
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: adminAuthRedirectUrl(),
    });
    if (error) {
      toast(error.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Enviar enlace';
      }
      return;
    }
    app.innerHTML = `
      <section class="admin-login">
        <div class="admin-login__panel admin-form">
          <div>
            <h1>Enlace enviado</h1>
            <p>Si <strong>${escapeHtml(email)}</strong> tiene una cuenta de administrador, recibiras el enlace para restablecer tu contrasena.</p>
            <p class="admin-help">Revisa tambien la carpeta de spam.</p>
          </div>
          <button class="admin-button admin-button--ghost" type="button" data-back-login>Volver al acceso</button>
        </div>
      </section>`;
    app
      .querySelector('[data-back-login]')
      ?.addEventListener('click', () => renderLoginPanel(email));
  });
  app
    .querySelector('[data-back-login]')
    ?.addEventListener('click', () => renderLoginPanel(prefillEmail));
}

function renderNewPassword() {
  app.innerHTML = `
    <section class="admin-login">
      <form class="admin-login__panel admin-form" data-new-password-form>
        <div>
          <h1>Nueva contrasena</h1>
          <p>Elige una nueva contrasena segura para tu cuenta de administrador.</p>
        </div>
        <label class="admin-field">Nueva contrasena
          <input name="password" type="password" autocomplete="new-password" required minlength="8" />
        </label>
        <label class="admin-field">Confirmar contrasena
          <input name="confirm" type="password" autocomplete="new-password" required minlength="8" />
        </label>
        <button class="admin-button" type="submit" data-save-btn>Guardar contrasena</button>
      </form>
    </section>`;
  const form = app.querySelector<HTMLFormElement>('[data-new-password-form]');
  const btn = form?.querySelector<HTMLButtonElement>('[data-save-btn]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');
    if (password !== confirm) {
      toast('Las contrasenas no coinciden');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando…';
    }
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) {
      toast(error.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Guardar contrasena';
      }
      return;
    }
    toast('Contrasena actualizada correctamente.');
    clearRecoveryState();
    await supabase!.auth.signOut();
    renderLoginPanel();
  });
}

async function routeView(): Promise<{ title: string; body: string }> {
  if (!vistaPermitida(state.view)) return accesoDenegadoView(state.view);
  if (state.view === 'crm') return { title: 'CRM', body: await crmView() };
  if (state.view === 'productos') return { title: 'Productos', body: await productosView() };
  if (state.view === 'producto') return { title: 'Producto', body: await productoFormView() };
  if (state.view === 'taxonomia') return { title: 'Taxonomia', body: await taxonomiaView() };
  if (state.view === 'cotizaciones')
    return { title: 'Presupuestos', body: await cotizacionesView() };
  if (state.view === 'cotizacion')
    return { title: 'Presupuesto', body: await cotizacionDetailView() };
  if (state.view === 'clientes') return { title: 'Clientes', body: await clientesView() };
  if (state.view === 'cliente') return { title: 'Cliente', body: await clienteDetailView() };
  if (state.view === 'pedidos') return { title: 'Pedidos', body: await pedidosView() };
  if (state.view === 'pedido') return { title: 'Pedido', body: await pedidoDetailView() };
  if (state.view === 'facturas') return { title: 'Facturas', body: await facturasView() };
  if (state.view === 'factura') return { title: 'Factura', body: await facturaDetailView() };
  if (state.view === 'cupones') return { title: 'Cupones', body: await cuponesView() };
  if (state.view === 'cupon') return { title: 'Cupon', body: await cuponFormView() };
  if (state.view === 'reportes') return { title: 'Reportes', body: await reportesView() };
  if (state.view === 'marketing') return { title: 'Marketing', body: await marketingView() };
  if (state.view === 'proveedores') return { title: 'Proveedores', body: await proveedoresView() };
  if (state.view === 'proveedor-productos')
    return { title: 'Productos del proveedor', body: await proveedorProductosView() };
  if (state.view === 'fulfillments')
    return { title: 'Transportistas / tracking', body: await fulfillmentsView() };
  if (state.view === 'usuarios') return { title: 'Usuarios CMS', body: await usuariosView() };
  if (state.view === 'plantillas')
    return { title: 'Plantillas de email', body: await plantillasView() };
  if (state.view === 'listas') return { title: 'Listas de precio', body: await listasView() };
  if (state.view === 'lista') return { title: 'Lista de precio', body: await listaDetailView() };
  if (state.view === 'envios') return { title: 'Tarifas de envío', body: await enviosView() };
  if (state.view === 'resenas') return { title: 'Resenas', body: await resenasView() };
  if (state.view === 'conocimiento')
    return { title: 'Blog / Conocimiento', body: await conocimientoView() };
  if (state.view === 'propuestas')
    return { title: 'Propuestas de articulos', body: await propuestasView() };
  if (state.view === 'ingesta') return { title: 'Ingesta PDF', body: await ingestaView() };
  if (state.view === 'asesor') return { title: 'Asesor', body: await asesorView() };
  return { title: 'Dashboard', body: await dashboardView() };
}

function shellHtml(title: string, body: string): string {
  type NavGroup = { label: string; items: Array<[View, string]> };
  const groups: NavGroup[] = [
    {
      label: 'Inicio',
      items: [['dashboard', 'Dashboard']],
    },
    {
      label: 'Catálogo',
      items: [
        ['productos', 'Productos'],
        ['taxonomia', 'Taxonomia'],
        ['ingesta', 'Ingesta PDF'],
      ],
    },
    {
      label: 'Comercial',
      items: [
        ['crm', 'CRM'],
        ['clientes', 'Clientes'],
        ['cotizaciones', 'Presupuestos'],
        ['pedidos', 'Pedidos'],
        ['facturas', 'Facturas'],
        ['cupones', 'Cupones'],
        ['listas', 'Listas de precio'],
        ['resenas', 'Resenas'],
        ['asesor', 'Asesor'],
      ],
    },
    {
      label: 'Operaciones',
      items: [
        ['proveedores', 'Proveedores'],
        ['fulfillments', 'Transportistas'],
        ['envios', 'Tarifas envío'],
      ],
    },
    {
      label: 'Contenido',
      items: [
        ['conocimiento', 'Blog'],
        ['propuestas', 'Propuestas blog'],
      ],
    },
    {
      label: 'Sistema',
      items: [
        ['usuarios', 'Usuarios CMS'],
        ['plantillas', 'Emails'],
        ['reportes', 'Reportes'],
        ['marketing', 'Marketing'],
      ],
    },
  ];

  const rolLabel = state.rol ? `Rol: ${state.rol}` : 'Rol: sin perfil';
  const navHtml = groups
    .map(group => {
      const links = group.items
        .map(([view, label]) => {
          const locked = !vistaPermitida(view);
          const current =
            state.view === view ||
            (view === 'conocimiento' && state.view === 'conocimiento') ||
            (view === 'productos' && state.view === 'producto') ||
            (view === 'cotizaciones' && state.view === 'cotizacion') ||
            (view === 'clientes' && state.view === 'cliente') ||
            (view === 'pedidos' && state.view === 'pedido') ||
            (view === 'facturas' && state.view === 'factura') ||
            (view === 'cupones' && state.view === 'cupon') ||
            (view === 'listas' && state.view === 'lista') ||
            (view === 'proveedores' && state.view === 'proveedor-productos');
          return `<a href="#/${view}" class="${locked ? 'is-locked' : ''}" ${
            current ? 'aria-current="page"' : ''
          } title="${escapeHtml(
            locked ? `Requiere rol: ${rolesQuePuedenVer(view).join(', ')}` : label
          )}">${escapeHtml(label)}${
            locked ? '<span class="admin-nav__lock" aria-hidden="true">rol</span>' : ''
          }</a>`;
        })
        .join('');
      return `<div class="admin-nav__group"><div class="admin-nav__label">${escapeHtml(
        group.label
      )}</div>${links}</div>`;
    })
    .join('');

  return `
    <section class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand"><strong>I-ME</strong><span>Biomedical commerce admin</span></div>
        <nav class="admin-nav" aria-label="Admin">
          ${navHtml}
        </nav>
        <button class="admin-button admin-button--sidebar" data-logout type="button">Salir</button>
      </aside>
      <section class="admin-main">
        <header class="admin-topbar">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <p class="admin-meta">${escapeHtml(state.email || 'Sesion privada')} · ${escapeHtml(rolLabel)}</p>
          </div>
          <div class="admin-toolbar">
            <button class="admin-button admin-button--ghost" data-publish type="button">Publicar cambios</button>
          </div>
        </header>
        ${body}
      </section>
    </section>`;
}

function bindShell() {
  app.querySelector('[data-logout]')?.addEventListener('click', async () => {
    state.rol = '';
    await supabase?.auth.signOut();
    location.hash = '#/dashboard';
    await render();
  });
  app.querySelector('[data-publish]')?.addEventListener('click', async () => {
    await triggerRebuild();
  });
}

function bindView() {
  bindProductFilters();
  bindProductList();
  bindProductForm();
  bindProductExcelTools();
  bindEntityExcelTools();
  bindTaxonomy();
  bindReasignacion();
  bindSimpleTables();
  bindCotizaciones();
  bindCrm();
  bindClientes();
  bindCupones();
  bindPedidoOperaciones();
  bindPedidoMasivo();
  bindFacturas();
  bindNitDian();
  bindIngest();
  bindArticulos();
  bindProviderFilters();
  bindProveedorProductos();
  bindFulfillments();
  bindUsuarios();
  bindPlantillas();
  bindListasPrecio();
  bindEnvios();
  bindResenas();
  bindPropuestas();
  bindAsesorPanel();
}

async function plantillasView(): Promise<string> {
  const { data, error } = await supabase!.from('email_templates').select('*').order('clave');
  if (error)
    return `<p class="admin-help">Error cargando plantillas: ${escapeHtml(error.message)}</p>`;
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    return '<p class="admin-help">Sin plantillas. Aplica el schema.sql para crear las plantillas por defecto.</p>';
  }
  const cards = rows
    .map(
      row => `
      <form class="admin-panel" data-plantilla-form data-clave="${escapeHtml(text(row.clave))}" style="margin-bottom:16px">
        <div class="admin-panel__head">
          <div>
            <h3>${escapeHtml(text(row.clave))}</h3>
            <p class="admin-meta">${escapeHtml(text(row.descripcion))}</p>
          </div>
          <label><input name="activo" type="checkbox" ${row.activo ? 'checked' : ''} /> Activa</label>
        </div>
        <div class="admin-panel__body" style="padding:16px;display:grid;gap:12px">
          <label>Asunto
            <input name="asunto" type="text" value="${escapeHtml(text(row.asunto))}" required />
          </label>
          <label>HTML
            <textarea name="html" rows="8" required>${escapeHtml(text(row.html))}</textarea>
          </label>
          <button class="admin-button" type="submit">Guardar</button>
        </div>
      </form>`
    )
    .join('');
  return `
    <p class="admin-help">
      Variables disponibles segun plantilla: {{referencia}}, {{cliente_nombre}}, {{cliente_email}},
      {{empresa}}, {{telefono}}, {{mensaje}}, {{total}}, {{moneda}}, {{items_html}}, {{fecha}},
      {{estado_label}}, {{tracking_html}}. Desactivar una plantilla suprime ese envio.
    </p>
    ${cards}`;
}

async function listasView(): Promise<string> {
  const { data, error } = await supabase!
    .from('listas_precio')
    .select('*, lista_precio_items(count), clientes(count)')
    .order('nombre');
  if (error) return `<p class="admin-help">Error: ${escapeHtml(error.message)}</p>`;
  const rows = (data ?? []) as Row[];
  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Listas de precio B2B</h2></div>
      <div class="admin-panel__body" style="padding:16px">
        ${
          rows.length === 0
            ? '<p class="admin-help">Sin listas. Crea la primera abajo.</p>'
            : table(
                ['Nombre', 'Descuento %', 'Precios especificos', 'Clientes', 'Activa', ''],
                rows.map(row => {
                  const items = Array.isArray(row.lista_precio_items)
                    ? (row.lista_precio_items as Row[])[0]
                    : null;
                  const clientesCount = Array.isArray(row.clientes)
                    ? (row.clientes as Row[])[0]
                    : null;
                  return [
                    escapeHtml(text(row.nombre)),
                    escapeHtml(text(row.descuento_pct)),
                    escapeHtml(text(items?.count ?? 0)),
                    escapeHtml(text(clientesCount?.count ?? 0)),
                    row.activo ? 'Si' : 'No',
                    `<a class="admin-button admin-button--ghost" href="#/lista?id=${encodeURIComponent(text(row.id))}">Gestionar</a>`,
                  ];
                })
              )
        }
        <form data-lista-create class="admin-form" style="margin-top:12px">
          <div class="admin-form__grid">
            <label>Nombre <input name="nombre" type="text" required /></label>
            <label>Descuento % global <input name="descuento_pct" type="number" min="0" max="90" step="0.1" value="0" /></label>
            <label>Descripcion <input name="descripcion" type="text" /></label>
          </div>
          <button class="admin-button" type="submit">Crear lista</button>
          <p class="admin-help">El descuento global aplica a todo el catalogo; los precios especificos por producto (en Gestionar) tienen prioridad. Se aplica server-side en el checkout segun el email del cliente.</p>
        </form>
      </div>
    </section>`;
}

async function listaDetailView(): Promise<string> {
  const row = state.recordId ? await getRow('listas_precio', state.recordId) : null;
  if (!row) return notFoundPanel('Lista no encontrada', '#/listas');
  const [itemsRes, clientesRes] = await Promise.all([
    supabase!
      .from('lista_precio_items')
      .select('*, productos(slug, nombre_es, precio)')
      .eq('lista_id', text(row.id)),
    supabase!
      .from('clientes')
      .select('id, email, institucion')
      .eq('lista_precio_id', text(row.id))
      .order('email'),
  ]);
  const items = (itemsRes.data ?? []) as Row[];
  const clientesAsignados = (clientesRes.data ?? []) as Row[];
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <div>
          <h2>${escapeHtml(text(row.nombre))}</h2>
          <p class="admin-meta">${escapeHtml(text(row.descripcion))}</p>
        </div>
        <a class="admin-button admin-button--ghost" href="#/listas">Volver</a>
      </div>
      <div class="admin-panel__body" style="padding:16px;display:grid;gap:20px">
        <form data-lista-edit class="admin-form">
          <input type="hidden" name="id" value="${escapeHtml(text(row.id))}" />
          <div class="admin-form__grid">
            <label>Nombre <input name="nombre" type="text" value="${escapeHtml(text(row.nombre))}" required /></label>
            <label>Descuento % <input name="descuento_pct" type="number" min="0" max="90" step="0.1" value="${escapeHtml(text(row.descuento_pct))}" /></label>
            <label><input name="activo" type="checkbox" ${row.activo ? 'checked' : ''} /> Activa</label>
          </div>
          <button class="admin-button" type="submit">Guardar</button>
        </form>

        <div>
          <h3>Precios especificos por producto</h3>
          ${
            items.length === 0
              ? '<p class="admin-help">Sin precios especificos; aplica solo el descuento global.</p>'
              : table(
                  ['Producto', 'Precio publico', 'Precio lista', ''],
                  items.map(item => {
                    const producto =
                      item.productos && typeof item.productos === 'object'
                        ? (item.productos as Row)
                        : {};
                    return [
                      escapeHtml(text(producto.slug)),
                      escapeHtml(text(producto.precio)) || '—',
                      escapeHtml(text(item.precio)),
                      `<button class="admin-button admin-button--danger" data-lista-item-del="${escapeHtml(text(item.id))}" type="button">Quitar</button>`,
                    ];
                  })
                )
          }
          <form data-lista-item-add class="admin-form" style="margin-top:8px">
            <div class="admin-form__grid">
              <label>Slug del producto <input name="slug" type="text" required placeholder="ej: monitor-signos-x" /></label>
              <label>Precio (COP) <input name="precio" type="number" min="1" step="0.01" required /></label>
            </div>
            <button class="admin-button" type="submit">Agregar precio</button>
          </form>
        </div>

        <div>
          <h3>Clientes asignados</h3>
          ${
            clientesAsignados.length === 0
              ? '<p class="admin-help">Sin clientes asignados.</p>'
              : table(
                  ['Email', 'Institucion', ''],
                  clientesAsignados.map(c => [
                    escapeHtml(text(c.email)),
                    escapeHtml(text(c.institucion)) || '—',
                    `<button class="admin-button admin-button--danger" data-lista-cliente-del="${escapeHtml(text(c.id))}" type="button">Desasignar</button>`,
                  ])
                )
          }
          <form data-lista-cliente-add class="admin-form" style="margin-top:8px">
            <label>Email del cliente <input name="email" type="email" required /></label>
            <button class="admin-button" type="submit">Asignar cliente</button>
            <p class="admin-help">El cliente debe existir (haber comprado o cotizado antes).</p>
          </form>
        </div>
      </div>
    </section>`;
}

async function enviosView(): Promise<string> {
  const { data, error } = await supabase!.from('tarifas_envio').select('*').order('zona');
  if (error) return `<p class="admin-help">Error: ${escapeHtml(error.message)}</p>`;
  const rows = (data ?? []) as Row[];
  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Tarifas de envío por zona (mercado CO)</h2></div>
      <div class="admin-help" style="padding:0 16px">
        Costos de checkout por departamento. Guías/tracking del transportista: menú <strong>Transportistas</strong>.
      </div>
      <div class="admin-panel__body" style="padding:16px">
        ${
          rows.length === 0
            ? '<p class="admin-help">Sin tarifas: el checkout cobra envio 0. Crea una zona con departamentos vacios como tarifa por defecto nacional.</p>'
            : table(
                ['Zona', 'Departamentos', 'Tarifa COP', 'Gratis desde', 'Activa', ''],
                rows.map(row => [
                  escapeHtml(text(row.zona)),
                  escapeHtml(
                    (Array.isArray(row.departamentos) ? row.departamentos : []).join(', ')
                  ) || '<em>por defecto</em>',
                  Number(row.tarifa ?? 0).toLocaleString('es-CO'),
                  row.gratis_desde === null
                    ? '—'
                    : Number(row.gratis_desde).toLocaleString('es-CO'),
                  row.activo ? 'Si' : 'No',
                  `<button class="admin-button admin-button--ghost" data-envio-toggle="${escapeHtml(text(row.id))}" data-envio-activo="${row.activo ? '1' : ''}" type="button">${row.activo ? 'Desactivar' : 'Activar'}</button>
                   <button class="admin-button admin-button--danger" data-envio-del="${escapeHtml(text(row.id))}" type="button">Eliminar</button>`,
                ])
              )
        }
        <form data-envio-create class="admin-form" style="margin-top:12px">
          <div class="admin-form__grid">
            <label>Zona <input name="zona" type="text" required placeholder="ej: Zona 1 - Andina" /></label>
            <label>Departamentos (coma) <input name="departamentos" type="text" placeholder="Cundinamarca, Antioquia (vacio = por defecto)" /></label>
            <label>Tarifa COP <input name="tarifa" type="number" min="0" step="1" required /></label>
            <label>Gratis desde COP <input name="gratis_desde" type="number" min="0" step="1" placeholder="opcional" /></label>
          </div>
          <button class="admin-button" type="submit">Crear zona</button>
          <p class="admin-help">El envio se calcula server-side en el checkout segun el departamento de la direccion. "Gratis desde" compara contra subtotal - descuento.</p>
        </form>
      </div>
    </section>`;
}

async function resenasView(): Promise<string> {
  const { data, error } = await supabase!
    .from('resenas')
    .select('*, productos(slug, nombre_es)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return `<p class="admin-help">Error: ${escapeHtml(error.message)}</p>`;
  const rows = (data ?? []) as Row[];
  const pendientes = rows.filter(r => r.aprobada !== true);
  const aprobadas = rows.filter(r => r.aprobada === true);
  const fila = (r: Row) => {
    const producto = r.productos && typeof r.productos === 'object' ? (r.productos as Row) : {};
    const comentario = text(r.comentario);
    const comentarioCorto = comentario.length > 200 ? `${comentario.slice(0, 200)}…` : comentario;
    const comentarioCell =
      comentario.length > 200
        ? `<details><summary title="${escapeHtml(comentario)}">${escapeHtml(comentarioCorto)}</summary><p style="white-space:pre-wrap;max-width:36rem">${escapeHtml(comentario)}</p></details>`
        : escapeHtml(comentario) || '—';
    return [
      formatCell(r.created_at),
      escapeHtml(text(producto.slug)) || '—',
      escapeHtml(text(r.nombre)),
      '★'.repeat(Number(r.rating) || 0),
      comentarioCell,
      `${
        r.aprobada === true
          ? `<button class="admin-button admin-button--ghost" data-resena-toggle="${escapeHtml(text(r.id))}" data-resena-aprobada="1" type="button">Retirar</button>`
          : `<button class="admin-button" data-resena-toggle="${escapeHtml(text(r.id))}" type="button">Aprobar</button>`
      }
       <button class="admin-button admin-button--danger" data-resena-del="${escapeHtml(text(r.id))}" type="button">Eliminar</button>`,
    ];
  };
  const headers = ['Fecha', 'Producto', 'Autor', 'Rating', 'Comentario', 'Acciones'];
  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Pendientes de moderacion (${pendientes.length})</h2></div>
      ${
        pendientes.length === 0
          ? '<p class="admin-help" style="padding:16px">Sin resenas pendientes.</p>'
          : table(headers, pendientes.map(fila))
      }
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Publicadas (${aprobadas.length})</h2></div>
      ${
        aprobadas.length === 0
          ? '<p class="admin-help" style="padding:16px">Sin resenas publicadas.</p>'
          : table(headers, aprobadas.map(fila))
      }
    </section>`;
}

function bindResenas() {
  app.querySelectorAll<HTMLButtonElement>('[data-resena-toggle]').forEach(button => {
    button.addEventListener('click', async () => {
      const { error } = await supabase!
        .from('resenas')
        .update({ aprobada: !button.dataset['resenaAprobada'] })
        .eq('id', button.dataset['resenaToggle'] ?? '');
      if (error) toast(error.message);
      else await render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-resena-del]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Eliminar esta resena definitivamente?')) return;
      const { error } = await supabase!
        .from('resenas')
        .delete()
        .eq('id', button.dataset['resenaDel'] ?? '');
      if (error) toast(error.message);
      else await render();
    });
  });
}

async function propuestasView(): Promise<string> {
  const { data, error } = await supabase!
    .from('articulos_propuestos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    return `<p class="admin-help" style="padding:16px">Error: ${escapeHtml(error.message)}. Si la tabla no tiene políticas RLS de admin, aplica migración 20260801240000.</p>`;
  }
  const rows = (data ?? []) as Row[];
  const pendientes = rows.filter(r => text(r.estado) === 'pendiente');
  const resueltas = rows.filter(r => text(r.estado) !== 'pendiente');
  const fila = (r: Row) => [
    formatCell(r.created_at),
    escapeHtml(text(r.autor_tipo)),
    escapeHtml(text(r.autor_nombre)),
    escapeHtml(text(r.autor_email)),
    escapeHtml(text(r.titulo)).slice(0, 80),
    escapeHtml(text(r.resumen) || text(r.cuerpo_md)).slice(0, 160),
    escapeHtml(text(r.estado)),
    text(r.estado) === 'pendiente'
      ? `<button class="admin-button" type="button" data-propuesta-aprobar="${escapeHtml(text(r.id))}">Aprobar→artículo</button>
         <button class="admin-button admin-button--danger" type="button" data-propuesta-rechazar="${escapeHtml(text(r.id))}">Rechazar</button>`
      : escapeHtml(text(r.motivo_rechazo) || '—'),
  ];
  const headers = ['Fecha', 'Tipo', 'Autor', 'Email', 'Título', 'Resumen', 'Estado', 'Acciones'];
  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Pendientes (${pendientes.length})</h2></div>
      <div class="admin-help" style="padding:0 16px 12px">Propuestas públicas de /es/conocimiento/publicar/. Aprobar crea borrador en Conocimiento.</div>
      ${
        pendientes.length === 0
          ? '<p class="admin-help" style="padding:16px">Sin propuestas pendientes.</p>'
          : table(headers, pendientes.map(fila))
      }
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Historial (${resueltas.length})</h2></div>
      ${
        resueltas.length === 0
          ? '<p class="admin-help" style="padding:16px">Sin historial.</p>'
          : table(headers, resueltas.map(fila))
      }
    </section>`;
}

function bindPropuestas() {
  app.querySelectorAll<HTMLButtonElement>('[data-propuesta-aprobar]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['propuestaAprobar'];
      if (!id) return;
      button.disabled = true;
      const propuesta = await getRow('articulos_propuestos', id);
      if (!propuesta) {
        toast('Propuesta no encontrada');
        button.disabled = false;
        return;
      }
      const titulo = text(propuesta.titulo);
      const slug = await uniqueArticuloSlug(slugify(titulo));
      const autorTipo = text(propuesta.autor_tipo) === 'fabricante' ? 'fabricante' : 'cliente';
      const { data: inserted, error: insertError } = await supabase!
        .from('articulos')
        .insert({
          slug,
          titulo_es: titulo,
          cuerpo_es: text(propuesta.cuerpo_md) || text(propuesta.resumen),
          publicado: false,
          autor_tipo: autorTipo,
          autor_nombre: text(propuesta.autor_nombre),
          autor_empresa: text(propuesta.autor_empresa) || null,
        })
        .select('id')
        .single();
      if (insertError) {
        toast(insertError.message);
        button.disabled = false;
        return;
      }
      const { error: updateError } = await supabase!
        .from('articulos_propuestos')
        .update({ estado: 'aprobado', motivo_rechazo: null })
        .eq('id', id);
      if (updateError) {
        toast(updateError.message);
        button.disabled = false;
        return;
      }
      toast('Propuesta aprobada: borrador creado en Conocimiento');
      location.hash = `#/conocimiento?id=${encodeURIComponent(text(inserted?.id))}`;
      await render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-propuesta-rechazar]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['propuestaRechazar'];
      if (!id) return;
      const motivo = prompt('Motivo del rechazo (opcional):') ?? '';
      const { error } = await supabase!
        .from('articulos_propuestos')
        .update({ estado: 'rechazado', motivo_rechazo: motivo.trim().slice(0, 500) || null })
        .eq('id', id);
      if (error) toast(error.message);
      else {
        toast('Propuesta rechazada');
        await render();
      }
    });
  });
}

function bindEnvios() {
  app
    .querySelector<HTMLFormElement>('[data-envio-create]')
    ?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const gratisRaw = String(data.get('gratis_desde') ?? '').trim();
      const { error } = await supabase!.from('tarifas_envio').insert({
        zona: String(data.get('zona') ?? '').trim(),
        departamentos: String(data.get('departamentos') ?? '')
          .split(',')
          .map(d => d.trim())
          .filter(Boolean),
        tarifa: Number(data.get('tarifa') ?? 0),
        gratis_desde: gratisRaw ? Number(gratisRaw) : null,
      });
      if (error) toast(error.message);
      else {
        toast('Zona creada');
        await render();
      }
    });

  app.querySelectorAll<HTMLButtonElement>('[data-envio-toggle]').forEach(button => {
    button.addEventListener('click', async () => {
      const { error } = await supabase!
        .from('tarifas_envio')
        .update({ activo: !button.dataset['envioActivo'] })
        .eq('id', button.dataset['envioToggle'] ?? '');
      if (error) toast(error.message);
      else await render();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-envio-del]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Eliminar esta zona de envio?')) return;
      const { error } = await supabase!
        .from('tarifas_envio')
        .delete()
        .eq('id', button.dataset['envioDel'] ?? '');
      if (error) toast(error.message);
      else await render();
    });
  });
}

function bindListasPrecio() {
  app
    .querySelector<HTMLFormElement>('[data-lista-create]')
    ?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const { error } = await supabase!.from('listas_precio').insert({
        nombre: String(data.get('nombre') ?? '').trim(),
        descripcion: String(data.get('descripcion') ?? '').trim(),
        descuento_pct: Number(data.get('descuento_pct') ?? 0),
      });
      if (error) toast(error.message);
      else {
        toast('Lista creada');
        await render();
      }
    });

  app
    .querySelector<HTMLFormElement>('[data-lista-edit]')
    ?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const activo =
        form.elements.namedItem('activo') instanceof HTMLInputElement &&
        (form.elements.namedItem('activo') as HTMLInputElement).checked;
      const { error } = await supabase!
        .from('listas_precio')
        .update({
          nombre: String(data.get('nombre') ?? '').trim(),
          descuento_pct: Number(data.get('descuento_pct') ?? 0),
          activo,
        })
        .eq('id', String(data.get('id') ?? ''));
      if (error) toast(error.message);
      else toast('Lista guardada');
    });

  app
    .querySelector<HTMLFormElement>('[data-lista-item-add]')
    ?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const slug = String(data.get('slug') ?? '').trim();
      const { data: producto } = await supabase!
        .from('productos')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (!producto) {
        toast(`Producto no encontrado: ${slug}`);
        return;
      }
      const { error } = await supabase!.from('lista_precio_items').upsert(
        {
          lista_id: state.recordId,
          producto_id: (producto as Row).id,
          precio: Number(data.get('precio') ?? 0),
        },
        { onConflict: 'lista_id,producto_id' }
      );
      if (error) toast(error.message);
      else {
        toast('Precio agregado');
        await render();
      }
    });

  app.querySelectorAll<HTMLButtonElement>('[data-lista-item-del]').forEach(button => {
    button.addEventListener('click', async () => {
      const { error } = await supabase!
        .from('lista_precio_items')
        .delete()
        .eq('id', button.dataset['listaItemDel'] ?? '');
      if (error) toast(error.message);
      else await render();
    });
  });

  app
    .querySelector<HTMLFormElement>('[data-lista-cliente-add]')
    ?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const email = String(new FormData(form).get('email') ?? '')
        .trim()
        .toLowerCase();
      const { data: clienteRow, error: findError } = await supabase!
        .from('clientes')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (findError || !clienteRow) {
        toast(`Cliente no encontrado: ${email}`);
        return;
      }
      const { error } = await supabase!
        .from('clientes')
        .update({ lista_precio_id: state.recordId })
        .eq('id', (clienteRow as Row).id);
      if (error) toast(error.message);
      else {
        toast('Cliente asignado');
        await render();
      }
    });

  app.querySelectorAll<HTMLButtonElement>('[data-lista-cliente-del]').forEach(button => {
    button.addEventListener('click', async () => {
      const { error } = await supabase!
        .from('clientes')
        .update({ lista_precio_id: null })
        .eq('id', button.dataset['listaClienteDel'] ?? '');
      if (error) toast(error.message);
      else await render();
    });
  });
}

function bindPlantillas() {
  app.querySelectorAll<HTMLFormElement>('[data-plantilla-form]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const clave = form.dataset['clave'] ?? '';
      const data = new FormData(form);
      const activo =
        form.elements.namedItem('activo') instanceof HTMLInputElement &&
        (form.elements.namedItem('activo') as HTMLInputElement).checked;
      const { error } = await supabase!
        .from('email_templates')
        .update({
          asunto: String(data.get('asunto') ?? '').trim(),
          html: String(data.get('html') ?? '').trim(),
          activo,
          updated_at: new Date().toISOString(),
        })
        .eq('clave', clave);
      if (error) toast(error.message);
      else toast(`Plantilla ${clave} guardada`);
    });
  });
}

const CRM_ETAPAS: Array<[string, string]> = [
  ['nuevo', 'Nuevo'],
  ['contactado', 'Contactado'],
  ['calificacion', 'Calificacion'],
  ['reunion', 'Reunion'],
  ['demo', 'Demo / visita'],
  ['cotizando', 'Cotizando'],
  ['negociacion', 'Negociacion'],
  ['checkout_pendiente', 'Checkout pendiente'],
  ['ganado', 'Ganado'],
  ['perdido', 'Perdido'],
  ['nutrir', 'Nutrir despues'],
  ['posventa', 'Posventa'],
];

const CRM_STAGE_VALUES = new Set(CRM_ETAPAS.map(([id]) => id));
const CRM_CLOSED_STAGES = new Set(['ganado', 'perdido', 'posventa']);
const CRM_PRIORITIES = new Set(['P1', 'P2', 'P3']);

interface TwentyMemberOption {
  id: string;
  email: string;
  name: string;
}

async function callCrmTwenty<T = unknown>(
  action: string,
  options: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {}
): Promise<{ ok: boolean; data?: T; error?: string; skipped?: boolean }> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado.' };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: 'Sesión expirada.' };
  const base = import.meta.env['PUBLIC_SUPABASE_URL'] as string | undefined;
  const anon = import.meta.env['PUBLIC_SUPABASE_ANON_KEY'] as string | undefined;
  if (!base || !anon) return { ok: false, error: 'Supabase URL no configurada.' };
  const method = options.method ?? (action === 'status' || action === 'members' ? 'GET' : 'POST');
  const url = `${base}/functions/v1/crm-twenty?action=${encodeURIComponent(action)}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(options.body ?? {}) }),
    });
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const errObj = payload.error;
      const message =
        typeof errObj === 'object' && errObj && 'message' in errObj
          ? String((errObj as { message: string }).message)
          : typeof payload.error === 'string'
            ? payload.error
            : `Error ${res.status} en crm-twenty`;
      return { ok: false, error: message };
    }
    if (payload.skipped) {
      return { ok: false, skipped: true, error: String(payload.error ?? 'Twenty no configurado') };
    }
    return { ok: Boolean(payload.ok ?? true), data: payload as T };
  } catch {
    return { ok: false, error: 'No se pudo contactar crm-twenty.' };
  }
}

async function loadTwentyMembers(): Promise<TwentyMemberOption[]> {
  const res = await callCrmTwenty<{ members: TwentyMemberOption[] }>('members', { method: 'GET' });
  if (!res.ok || !res.data?.members) return [];
  return res.data.members;
}

async function crmView(): Promise<string> {
  const params = hashParams();
  const etapa = params.get('etapa') ?? '';
  const prioridad = params.get('prioridad') ?? '';
  const seguimiento = params.get('seguimiento') ?? '';
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const twentyMembers = await loadTwentyMembers();
  const [opportunitiesRes, contactsRes, accountsRes, activitiesRes] = await Promise.all([
    supabase!
      .from('crm_opportunities')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(250),
    supabase!.from('crm_contacts').select('*').order('updated_at', { ascending: false }).limit(250),
    supabase!.from('crm_accounts').select('*').order('updated_at', { ascending: false }).limit(250),
    supabase!
      .from('crm_activities')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(120),
  ]);

  if (opportunitiesRes.error) {
    return `
      <section class="admin-panel">
        <div class="admin-panel__head"><h2>CRM no inicializado</h2></div>
        <div class="admin-panel__body">
          <div class="admin-alert">Aplica la migracion <code>20260723040818_crm_normalizado_flujos.sql</code>. Error: ${escapeHtml(opportunitiesRes.error.message)}</div>
        </div>
      </section>`;
  }
  if (contactsRes.error) toast(contactsRes.error.message);
  if (accountsRes.error) toast(accountsRes.error.message);
  if (activitiesRes.error) toast(activitiesRes.error.message);

  const contacts = ((contactsRes.data ?? []) as Row[]).reduce<Map<string, Row>>((acc, row) => {
    acc.set(text(row.id), row);
    return acc;
  }, new Map());
  const accounts = ((accountsRes.data ?? []) as Row[]).reduce<Map<string, Row>>((acc, row) => {
    acc.set(text(row.id), row);
    return acc;
  }, new Map());

  const allOpportunities = ((opportunitiesRes.data ?? []) as Row[]).filter(row => {
    if (etapa && text(row.etapa) !== etapa) return false;
    if (prioridad && text(row.prioridad) !== prioridad) return false;
    const closed = CRM_CLOSED_STAGES.has(text(row.etapa));
    const nextAction = text(row.next_action_at);
    if (seguimiento === 'vencido' && (closed || !nextAction || new Date(nextAction) > new Date())) {
      return false;
    }
    if (seguimiento === 'sin_fecha' && (closed || nextAction)) return false;
    if (!q) return true;
    const contact = contacts.get(text(row.contact_id));
    const account = accounts.get(text(row.account_id));
    const haystack = [
      row.titulo,
      row.origen,
      row.source_table,
      contact?.nombre,
      contact?.email_norm,
      contact?.telefono_e164,
      account?.nombre,
      account?.tax_id,
      row.prioridad,
      row.motivo_perdida,
      row.next_action_note,
      (row.metadata as Row | null)?.campaign,
      (row.metadata as Row | null)?.utm_campaign,
    ]
      .map(value => text(value).toLowerCase())
      .join(' ');
    return haystack.includes(q);
  });

  const openOpportunities = allOpportunities.filter(row => !CRM_CLOSED_STAGES.has(text(row.etapa)));
  const totalOpen = openOpportunities.reduce(
    (acc, row) => acc + Number(row.valor_estimado ?? 0),
    0
  );
  const weightedOpen = openOpportunities.reduce(
    (acc, row) => acc + Number(row.valor_estimado ?? 0) * (Number(row.probabilidad ?? 0) / 100),
    0
  );
  const dueNow = openOpportunities.filter(row => {
    const next = text(row.next_action_at);
    return next ? new Date(next).getTime() <= Date.now() : false;
  });
  const won = allOpportunities.filter(row => text(row.etapa) === 'ganado');
  const p1Open = openOpportunities.filter(row => text(row.prioridad) === 'P1');
  const withoutNextAction = openOpportunities.filter(row => !text(row.next_action_at));
  const marginOpen = openOpportunities.reduce(
    (acc, row) => acc + Number(row.margen_estimado ?? 0),
    0
  );

  const stages = CRM_ETAPAS.map(([stage, label]) => {
    const stageRows = allOpportunities.filter(row => text(row.etapa) === stage);
    const stageValue = stageRows.reduce((acc, row) => acc + Number(row.valor_estimado ?? 0), 0);
    return `
      <section class="crm-stage">
        <div class="crm-stage__head">
          <strong>${escapeHtml(label)}</strong>
          <span>${stageRows.length} · ${escapeHtml(crmMoney(stageValue))}</span>
        </div>
        <div class="crm-stage__body">
          ${
            stageRows.length
              ? stageRows
                  .map(row => crmOpportunityCard(row, contacts, accounts, twentyMembers))
                  .join('')
              : '<p class="admin-help">Sin oportunidades.</p>'
          }
        </div>
      </section>`;
  }).join('');

  const visibleContactIds = new Set(allOpportunities.map(row => text(row.contact_id)));
  const contactRows = Array.from(contacts.values())
    .filter(row => visibleContactIds.has(text(row.id)) || !q)
    .slice(0, 80);
  const activities = ((activitiesRes.data ?? []) as Row[]).filter(row => {
    if (!q) return true;
    const opportunity = allOpportunities.find(opp => text(opp.id) === text(row.opportunity_id));
    const contact = contacts.get(text(row.contact_id));
    return Boolean(
      opportunity ||
      text(row.summary).toLowerCase().includes(q) ||
      text(contact?.email_norm).toLowerCase().includes(q)
    );
  });

  return `
    <form class="admin-filters" data-crm-filter>
      ${field('q', 'Buscar', q, false, 'search')}
      ${selectStatic('etapa', 'Etapa', etapa, [['', 'Todas'], ...CRM_ETAPAS])}
      ${selectStatic('prioridad', 'Prioridad', prioridad, [
        ['', 'Todas'],
        ['P1', 'P1 · 0–3 meses'],
        ['P2', 'P2 · 4–12 meses'],
        ['P3', 'P3 · Exploracion'],
      ])}
      ${selectStatic('seguimiento', 'Seguimiento', seguimiento, [
        ['', 'Todos'],
        ['vencido', 'Vencido'],
        ['sin_fecha', 'Sin proxima accion'],
      ])}
      <button class="admin-button" type="submit">Filtrar</button>
      <a class="admin-button admin-button--ghost" href="#/crm">Limpiar</a>
    </form>
    <section class="admin-grid">
      ${metric('Oportunidades', allOpportunities.length)}
      ${metric('Abiertas', openOpportunities.length)}
      ${metric('Seguimiento vencido', dueNow.length)}
      ${metric('P1 abiertas', p1Open.length)}
      ${metric('Sin proxima accion', withoutNextAction.length)}
      ${metric('Ganadas', won.length)}
      ${marketingMetric('Pipeline abierto', crmMoney(totalOpen))}
      ${marketingMetric('Pipeline ponderado', crmMoney(weightedOpen))}
      ${marketingMetric('Margen estimado', crmMoney(marginOpen))}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head">
        <div>
          <h2>Pipeline normalizado</h2>
          <p class="admin-meta">Formularios, cotizaciones y ventas ecommerce alimentan estas oportunidades.</p>
        </div>
        <div class="admin-toolbar">
          <button class="admin-button admin-button--ghost" type="button" data-crm-repair-twenty>Reparar enlaces Twenty</button>
          <a class="admin-button admin-button--ghost" href="https://crm.i-me.com.co" target="_blank" rel="noopener noreferrer">Abrir Twenty</a>
          <a class="admin-button admin-button--ghost" href="#/cotizaciones">Presupuestos</a>
          <a class="admin-button admin-button--ghost" href="#/pedidos">Pedidos</a>
        </div>
      </div>
      <div class="crm-board">${stages}</div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Contactos explotables (${contactRows.length})</h2></div>
      ${table(
        [
          'Nombre',
          'Email normalizado',
          'Telefono',
          'Cuenta',
          'Twenty',
          'Ultima actividad',
          'Fuente',
        ],
        contactRows.map(row => {
          const account = accounts.get(text(row.account_id));
          const twentyPerson = text(row.twenty_person_id);
          const twentyCompany = text(account?.twenty_company_id);
          const twentyBadge =
            twentyPerson && twentyCompany ? 'Enlazado' : twentyPerson ? 'Persona' : 'Pendiente';
          return [
            escapeHtml(text(row.nombre)) || '—',
            escapeHtml(text(row.email_norm)) || '—',
            escapeHtml(text(row.telefono_e164)) || '—',
            escapeHtml(text(account?.nombre)) || '—',
            `<span class="admin-badge ${twentyBadge === 'Enlazado' ? 'admin-badge--info' : 'admin-badge--warn'}">${escapeHtml(twentyBadge)}</span>`,
            text(row.last_activity_at) ? formatDate(text(row.last_activity_at)) : '—',
            escapeHtml(text(row.first_source)) || '—',
          ];
        })
      )}
      ${
        contactRows.some(row => {
          const account = accounts.get(text(row.account_id));
          return (
            text(row.twenty_person_id) && text(account?.nombre) && !text(account?.twenty_company_id)
          );
        })
          ? `<div class="admin-toolbar" style="margin-top:1rem">
              <button class="admin-button admin-button--ghost" type="button" data-crm-link-all-contacts>
                Enlazar contactos pendientes a cuenta Twenty
              </button>
            </div>`
          : ''
      }
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Actividad CRM</h2></div>
      ${table(
        ['Fecha', 'Evento', 'Canal', 'Resumen', 'Origen'],
        activities
          .slice(0, 80)
          .map(row => [
            text(row.occurred_at) ? formatDate(text(row.occurred_at)) : '—',
            escapeHtml(text(row.event_type)),
            escapeHtml(text(row.channel)) || '—',
            escapeHtml(text(row.summary)) || '—',
            crmSourceLink(row),
          ])
      )}
    </section>`;
}

function crmOpportunityCard(
  row: Row,
  contacts: Map<string, Row>,
  accounts: Map<string, Row>,
  twentyMembers: TwentyMemberOption[]
): string {
  const id = text(row.id);
  const contact = contacts.get(text(row.contact_id));
  const account = accounts.get(text(row.account_id));
  const etapa = text(row.etapa) || 'nuevo';
  const nextAction = text(row.next_action_at);
  const lastContact = text(row.last_contact_at);
  const due = nextAction ? new Date(nextAction).getTime() <= Date.now() : false;
  const priority = text(row.prioridad);
  const twentyOpp = text(row.twenty_opportunity_id);
  const twentyLinked = Boolean(
    twentyOpp && text(row.twenty_person_id) && text(row.twenty_company_id)
  );
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Row)
      : {};
  const campaign = text(metadata.campaign || metadata.utm_campaign);
  const title =
    text(row.titulo) || text(account?.nombre) || text(contact?.email_norm) || id.slice(0, 8);
  const memberOptions = twentyMembers.length
    ? twentyMembers
        .map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name || m.email)}</option>`)
        .join('')
    : '';
  return `
    <form class="crm-card" data-crm-opportunity-form="${escapeHtml(id)}" data-crm-account="${escapeHtml(text(row.account_id))}" data-crm-contact="${escapeHtml(text(row.contact_id))}">
      <div class="crm-card__top">
        <strong>${escapeHtml(title)}</strong>
        <span class="admin-badge ${due ? 'admin-badge--warn' : 'admin-badge--info'}">${escapeHtml(priority || crmStageLabel(etapa))}</span>
      </div>
      <p class="admin-meta">${escapeHtml(text(account?.nombre) || 'Sin cuenta')} · ${escapeHtml(text(contact?.email_norm) || text(contact?.telefono_e164) || 'Sin contacto')}</p>
      <p class="admin-meta">
        Twenty:
        <span class="admin-badge ${twentyLinked ? 'admin-badge--info' : 'admin-badge--warn'}">${twentyLinked ? 'Sincronizado' : twentyOpp ? 'Parcial' : 'Pendiente'}</span>
        ${twentyOpp ? `<span class="admin-meta">· ${escapeHtml(twentyOpp.slice(0, 8))}…</span>` : ''}
      </p>
      ${campaign ? `<p class="admin-meta">Campaña: ${escapeHtml(campaign)}${text(metadata.horizonte) ? ` · ${escapeHtml(text(metadata.horizonte))}` : ''}</p>` : ''}
      <div class="crm-card__numbers">
        <span>${escapeHtml(crmMoney(Number(row.valor_estimado ?? 0), text(row.moneda) || 'COP'))}</span>
        <span>${Number(row.probabilidad ?? 0)}%</span>
        <span>${text(row.updated_at) ? formatDate(text(row.updated_at)) : '—'}</span>
      </div>
      <label class="admin-field">Etapa
        <select name="etapa">
          ${CRM_ETAPAS.map(
            ([stage, label]) =>
              `<option value="${escapeHtml(stage)}" ${stage === etapa ? 'selected' : ''}>${escapeHtml(label)}</option>`
          ).join('')}
        </select>
      </label>
      <div class="crm-card__fields">
        <label class="admin-field">Prioridad
          <select name="prioridad">
            <option value="">Sin prioridad</option>
            ${['P1', 'P2', 'P3'].map(value => `<option value="${value}" ${value === priority ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </label>
        <label class="admin-field">Valor estimado
          <input name="valor_estimado" type="number" min="0" step="1" value="${escapeHtml(text(row.valor_estimado))}" />
        </label>
        <label class="admin-field">Margen estimado
          <input name="margen_estimado" type="number" min="0" step="1" value="${escapeHtml(text(row.margen_estimado))}" />
        </label>
        <label class="admin-field">Margen %
          <input name="margen_pct" type="number" min="0" max="100" step="0.01" value="${escapeHtml(text(row.margen_pct))}" />
        </label>
        <label class="admin-field">Ultimo contacto
          <input name="last_contact_at" type="datetime-local" value="${escapeHtml(crmDatetimeLocal(lastContact))}" />
        </label>
        <label class="admin-field">Proxima accion
          <input name="next_action_at" type="datetime-local" value="${escapeHtml(crmDatetimeLocal(nextAction))}" />
        </label>
      </div>
      <label class="admin-field">Siguiente paso
        <textarea name="next_action_note" rows="2" maxlength="500">${escapeHtml(text(row.next_action_note))}</textarea>
      </label>
      <label class="admin-field">Motivo de perdida
        <input name="motivo_perdida" type="text" maxlength="500" value="${escapeHtml(text(row.motivo_perdida))}" />
      </label>
      ${
        memberOptions
          ? `<label class="admin-field">Reasignar comercial (Twenty)
          <select name="twenty_owner_id" data-crm-reassign-owner>
            <option value="">Sin cambio</option>
            ${memberOptions}
          </select>
        </label>`
          : ''
      }
      <button class="admin-button" type="submit">Guardar y sync Twenty</button>
      ${
        contact && account && (!text(contact.twenty_person_id) || !text(account.twenty_company_id))
          ? `<button class="admin-button admin-button--ghost" type="button" data-crm-link-contact="${escapeHtml(text(contact.id))}" data-crm-link-account="${escapeHtml(text(account.id))}">Enlazar contacto ↔ cuenta Twenty</button>`
          : ''
      }
      <div class="admin-toolbar crm-card__actions">
        ${crmSourceLink(row)}
        ${text(contact?.email_norm) ? `<a class="admin-button admin-button--ghost" href="mailto:${escapeHtml(text(contact?.email_norm))}">Email</a>` : ''}
        ${text(contact?.telefono_e164) ? `<a class="admin-button admin-button--ghost" href="https://wa.me/${escapeHtml(text(contact?.telefono_e164).replace(/\\D/g, ''))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}
      </div>
    </form>`;
}

function bindCrm() {
  app.querySelector<HTMLFormElement>('[data-crm-filter]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const params = new URLSearchParams();
    const q = String(data.get('q') ?? '').trim();
    const etapa = String(data.get('etapa') ?? '').trim();
    const prioridad = String(data.get('prioridad') ?? '').trim();
    const seguimiento = String(data.get('seguimiento') ?? '').trim();
    if (q) params.set('q', q);
    if (etapa) params.set('etapa', etapa);
    if (prioridad) params.set('prioridad', prioridad);
    if (seguimiento) params.set('seguimiento', seguimiento);
    location.hash = `#/crm${params.toString() ? `?${params.toString()}` : ''}`;
  });

  app
    .querySelector<HTMLButtonElement>('[data-crm-repair-twenty]')
    ?.addEventListener('click', async () => {
      const btn = app.querySelector<HTMLButtonElement>('[data-crm-repair-twenty]');
      if (btn) btn.disabled = true;
      const res = await callCrmTwenty<{ data?: { linked?: number; scanned?: number } }>(
        'repair-links',
        {
          body: { limit: 100 },
        }
      );
      if (res.skipped) toast('Twenty no configurado en Edge secrets.');
      else if (!res.ok) toast(res.error ?? 'Reparación falló');
      else {
        const stats = res.data?.data;
        toast(`Twenty: ${stats?.linked ?? 0}/${stats?.scanned ?? 0} contactos enlazados`);
        await render();
      }
      if (btn) btn.disabled = false;
    });

  app
    .querySelector<HTMLButtonElement>('[data-crm-link-all-contacts]')
    ?.addEventListener('click', async () => {
      const btn = app.querySelector<HTMLButtonElement>('[data-crm-link-all-contacts]');
      if (btn) btn.disabled = true;
      let linked = 0;
      let failed = 0;
      const buttons = app.querySelectorAll<HTMLButtonElement>('[data-crm-link-contact]');
      for (const linkBtn of buttons) {
        const crmContactId = linkBtn.dataset['crmLinkContact'] ?? '';
        const crmAccountId = linkBtn.dataset['crmLinkAccount'] ?? '';
        if (!crmContactId || !crmAccountId) continue;
        const res = await callCrmTwenty('link', { body: { crmContactId, crmAccountId } });
        if (res.ok) linked += 1;
        else failed += 1;
      }
      toast(`Enlaces Twenty: ${linked} OK${failed ? `, ${failed} fallos` : ''}`);
      if (btn) btn.disabled = false;
      await render();
    });

  app.querySelectorAll<HTMLButtonElement>('[data-crm-link-contact]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const crmContactId = btn.dataset['crmLinkContact'] ?? '';
      const crmAccountId = btn.dataset['crmLinkAccount'] ?? '';
      if (!crmContactId || !crmAccountId) return;
      btn.disabled = true;
      const res = await callCrmTwenty('link', { body: { crmContactId, crmAccountId } });
      if (res.skipped) toast('Twenty no configurado.');
      else if (!res.ok) toast(res.error ?? 'Enlace falló');
      else {
        toast('Contacto enlazado a cuenta Twenty');
        await render();
      }
      btn.disabled = false;
    });
  });

  app.querySelectorAll<HTMLFormElement>('[data-crm-opportunity-form]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const id = form.dataset['crmOpportunityForm'] ?? '';
      const data = new FormData(form);
      const etapa = String(data.get('etapa') ?? 'nuevo');
      const prioridad = String(data.get('prioridad') ?? '');
      const motivoPerdida = String(data.get('motivo_perdida') ?? '').trim();
      const twentyOwnerId = String(data.get('twenty_owner_id') ?? '').trim();
      if (!id || !CRM_STAGE_VALUES.has(etapa)) return;
      if (prioridad && !CRM_PRIORITIES.has(prioridad)) return;
      if (etapa === 'perdido' && !motivoPerdida) {
        toast('Motivo de perdida requerido.');
        form.querySelector<HTMLInputElement>('[name="motivo_perdida"]')?.focus();
        return;
      }
      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submit) submit.disabled = true;
      const now = new Date().toISOString();
      const nextActionAt = crmInputIso(data.get('next_action_at'));
      const lastContactAt = crmInputIso(data.get('last_contact_at'));
      const valorEstimado = numberOrNull(data.get('valor_estimado'));
      const { error } = await supabase!
        .from('crm_opportunities')
        .update({
          etapa,
          probabilidad: crmProbabilityForStage(etapa),
          closed_at: CRM_CLOSED_STAGES.has(etapa) ? now : null,
          prioridad: prioridad || null,
          valor_estimado: valorEstimado,
          margen_estimado: numberOrNull(data.get('margen_estimado')),
          margen_pct: numberOrNull(data.get('margen_pct')),
          motivo_perdida: etapa === 'perdido' ? motivoPerdida : null,
          last_contact_at: lastContactAt,
          next_action_at: nextActionAt,
          next_action_note: emptyToNull(data.get('next_action_note')),
          updated_at: now,
        })
        .eq('id', id);
      if (error) {
        toast(error.message);
        if (submit) submit.disabled = false;
        return;
      }
      await supabase!.from('crm_activities').insert({
        event_type: `oportunidad_actualizada_${Date.now()}`,
        channel: 'admin',
        source_table: 'crm_opportunities',
        source_id: id,
        account_id: form.dataset['crmAccount'] || null,
        contact_id: form.dataset['crmContact'] || null,
        opportunity_id: id,
        summary: `Oportunidad actualizada: ${crmStageLabel(etapa)}`,
        metadata: {
          etapa,
          prioridad: prioridad || null,
          next_action_at: nextActionAt,
          last_contact_at: lastContactAt,
          motivo_perdida: etapa === 'perdido' ? motivoPerdida : null,
        },
      });

      const sync = await callCrmTwenty<{ twenty?: { stage?: string } }>('sync-opportunity', {
        body: {
          crmOpportunityId: id,
          etapa,
          valor_estimado: valorEstimado,
          next_action_at: nextActionAt,
          next_action_note: emptyToNull(data.get('next_action_note')),
          ...(twentyOwnerId
            ? { newOwnerId: twentyOwnerId, reason: 'Reasignación desde admin CRM' }
            : {}),
        },
      });

      if (sync.skipped) toast('CRM guardado. Twenty no configurado en Edge.');
      else if (!sync.ok) toast(`CRM guardado. Twenty: ${sync.error ?? 'sync falló'}`);
      else toast(`Oportunidad actualizada y sincronizada (${sync.data?.twenty?.stage ?? etapa})`);
      await render();
    });
  });
}

function crmStageLabel(value: string): string {
  return CRM_ETAPAS.find(([id]) => id === value)?.[1] ?? value;
}

function crmProbabilityForStage(value: string): number {
  if (value === 'ganado' || value === 'posventa') return 100;
  if (value === 'checkout_pendiente') return 80;
  if (value === 'negociacion') return 70;
  if (value === 'cotizando') return 55;
  if (value === 'demo') return 45;
  if (value === 'reunion') return 40;
  if (value === 'calificacion') return 30;
  if (value === 'contactado') return 20;
  if (value === 'nutrir') return 10;
  if (value === 'perdido') return 0;
  return 10;
}

function crmMoney(value: number, currency = 'COP'): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return `${safe.toLocaleString('es-CO')} ${currency || 'COP'}`;
}

function crmDatetimeLocal(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function crmInputIso(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function crmSourceLink(row: Row): string {
  const sourceTable = text(row.source_table);
  const sourceId = text(row.source_id);
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Row)
      : {};
  const quoteId = text(metadata.cotizacion_id);
  const orderId = text(metadata.pedido_id);
  if (orderId) {
    return `<a class="admin-button admin-button--ghost" href="#/pedido?id=${encodeURIComponent(orderId)}">Pedido</a>`;
  }
  if (quoteId) {
    return `<a class="admin-button admin-button--ghost" href="#/cotizacion?id=${encodeURIComponent(quoteId)}">Cotizacion</a>`;
  }
  if (!sourceId) return escapeHtml(sourceTable) || '—';
  if (sourceTable === 'solicitudes_cotizacion') {
    return `<a class="admin-button admin-button--ghost" href="#/cotizacion?id=${encodeURIComponent(sourceId)}">Cotizacion</a>`;
  }
  if (sourceTable === 'pedidos') {
    return `<a class="admin-button admin-button--ghost" href="#/pedido?id=${encodeURIComponent(sourceId)}">Pedido</a>`;
  }
  if (sourceTable === 'leads_comerciales') {
    return '<span class="admin-badge admin-badge--info">Lead consultivo</span>';
  }
  return escapeHtml(sourceTable || sourceId);
}

function bindUsuarios() {
  const form = app.querySelector<HTMLFormElement>('[data-admin-user-form]');
  if (!form) return;
  const status = form.querySelector<HTMLElement>('[data-admin-user-status]');
  const submit = form.querySelector<HTMLButtonElement>('[data-admin-user-submit]');
  const resetButton = form.querySelector<HTMLButtonElement>('[data-admin-user-reset-form]');

  const setUserForm = (params: {
    email: string;
    rol: string;
    activo: boolean;
    focusPassword?: boolean;
  }) => {
    const emailInput = form.elements.namedItem('email') as HTMLInputElement | null;
    const roleSelect = form.elements.namedItem('rol') as HTMLSelectElement | null;
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null;
    const passwordConfirmInput = form.elements.namedItem(
      'passwordConfirm'
    ) as HTMLInputElement | null;
    const activoInput = form.elements.namedItem('activo') as HTMLInputElement | null;
    const sendInviteInput = form.elements.namedItem('sendInvite') as HTMLInputElement | null;
    if (emailInput) emailInput.value = params.email;
    if (roleSelect) roleSelect.value = params.rol || 'lectura';
    if (passwordInput) passwordInput.value = '';
    if (passwordConfirmInput) passwordConfirmInput.value = '';
    if (activoInput) activoInput.checked = params.activo;
    if (sendInviteInput) sendInviteInput.checked = false;
    if (status) {
      status.textContent = params.focusPassword
        ? `Escribe nueva contraseña para ${params.email} y guarda para cambiarla.`
        : `Editando ${params.email}. Guarda para aplicar cambios.`;
    }
    if (params.focusPassword) passwordInput?.focus();
    else emailInput?.focus();
  };

  resetButton?.addEventListener('click', () => {
    form.reset();
    const activoInput = form.elements.namedItem('activo') as HTMLInputElement | null;
    const sendInviteInput = form.elements.namedItem('sendInvite') as HTMLInputElement | null;
    if (activoInput) activoInput.checked = true;
    if (sendInviteInput) sendInviteInput.checked = true;
    if (status) status.textContent = '';
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '').trim();
    const passwordConfirm = String(data.get('passwordConfirm') ?? '').trim();
    const rol = String(data.get('rol') ?? 'lectura');
    const activo =
      form.elements.namedItem('activo') instanceof HTMLInputElement &&
      (form.elements.namedItem('activo') as HTMLInputElement).checked;
    const sendInvite =
      form.elements.namedItem('sendInvite') instanceof HTMLInputElement &&
      (form.elements.namedItem('sendInvite') as HTMLInputElement).checked;

    if (!email) {
      toast('Email requerido');
      return;
    }
    if (password && password !== passwordConfirm) {
      toast('Las contraseñas no coinciden.');
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Sincronizando…';
    }
    if (status) status.textContent = 'Creando usuario Auth y perfil CMS...';

    const { data: result, error } = await supabase!.functions.invoke('admin-users', {
      body: {
        action: 'upsert',
        email,
        rol,
        activo,
        password: password || undefined,
        sendInvite,
      },
    });

    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Guardar acceso';
    }

    if (error) {
      const message = error.message || 'No se pudo sincronizar el usuario.';
      if (status) status.textContent = message;
      toast(message);
      return;
    }

    const createdEmail = text((result as Row | null)?.user && ((result as Row).user as Row).email);
    toast(`Usuario sincronizado: ${createdEmail || email}`);
    location.hash = '#/usuarios';
    await render();
  });

  app.querySelectorAll<HTMLButtonElement>('[data-admin-user-edit]').forEach(button => {
    button.addEventListener('click', () => {
      setUserForm({
        email: button.getAttribute('data-admin-user-edit') ?? '',
        rol: button.getAttribute('data-admin-user-rol') ?? 'lectura',
        activo: button.getAttribute('data-admin-user-activo') === '1',
      });
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-admin-user-password]').forEach(button => {
    button.addEventListener('click', () => {
      setUserForm({
        email: button.getAttribute('data-admin-user-password') ?? '',
        rol: button.getAttribute('data-admin-user-rol') ?? 'lectura',
        activo: button.getAttribute('data-admin-user-activo') === '1',
        focusPassword: true,
      });
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-admin-user-toggle]').forEach(button => {
    button.addEventListener('click', async () => {
      const email = button.getAttribute('data-admin-user-toggle') ?? '';
      const rol = button.getAttribute('data-admin-user-rol') ?? 'lectura';
      const activo = button.getAttribute('data-admin-user-activo') !== '1';
      button.disabled = true;
      button.textContent = activo ? 'Activando…' : 'Desactivando…';
      const { error } = await supabase!.functions.invoke('admin-users', {
        body: {
          action: 'upsert',
          email,
          rol,
          activo,
          sendInvite: false,
        },
      });
      if (error) {
        button.disabled = false;
        button.textContent = activo ? 'Activar' : 'Desactivar';
        toast(error.message || 'No se pudo actualizar el usuario.');
        return;
      }
      toast(`${activo ? 'Activado' : 'Desactivado'}: ${email}`);
      await render();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-admin-user-delete]').forEach(button => {
    button.addEventListener('click', async () => {
      const email = button.getAttribute('data-admin-user-delete') ?? '';
      const userId = button.getAttribute('data-admin-user-id') ?? '';
      if (
        !window.confirm(
          `Eliminar ${email} del CMS y de Supabase Auth? Esta acción no cierra JWT ya emitidos hasta que expiren.`
        )
      ) {
        return;
      }
      button.disabled = true;
      button.textContent = 'Eliminando…';
      const { error } = await supabase!.functions.invoke('admin-users', {
        body: {
          action: 'delete',
          user_id: userId,
          email,
        },
      });
      if (error) {
        button.disabled = false;
        button.textContent = 'Eliminar';
        toast(error.message || 'No se pudo eliminar el usuario.');
        return;
      }
      toast(`Usuario eliminado: ${email}`);
      await render();
    });
  });
}

async function dashboardView(): Promise<string> {
  const [
    productos,
    productosActivos,
    productosBorrador,
    productosDropship,
    productosDisponibles,
    cotizaciones,
    oportunidades,
    oportunidadesNuevas,
    oportunidadesCotizando,
    pedidos,
    clientes,
    cupones,
    fulfillmentsError,
    productosRows,
  ] = await Promise.all([
    count('productos'),
    count('productos', { activo: true }),
    count('productos', { activo: false }),
    count('productos', { fulfillment_mode: 'dropship' }),
    count('productos', { disponible: true }),
    count('solicitudes_cotizacion', { leida: false }),
    count('crm_opportunities'),
    count('crm_opportunities', { etapa: 'nuevo' }),
    count('crm_opportunities', { etapa: 'cotizando' }),
    count('pedidos', { leida: false }),
    count('clientes'),
    count('cupones', { activo: true }),
    count('fulfillments', { estado: 'error' }),
    selectRows(
      'productos',
      'id,nombre_es,tipo_id,imagen_principal,ficha_pdf,especificaciones',
      'nombre_es',
      500
    ),
  ]);
  const withoutProvider = await productosDropshipSinProveedor();
  const commercialUsage = await commercialUsageSummary(30);
  const productosSinTipo = productosRows.filter(row => !text(row.tipo_id)).length;
  const productosNoDisponibles = Math.max(0, productos - productosDisponibles);
  const productosSinImagen = productosRows.filter(row => !text(row.imagen_principal)).length;
  const productosSinPdf = productosRows.filter(row => !text(row.ficha_pdf)).length;
  const productosSinSpecs = productosRows.filter(row => {
    const specs = row.especificaciones;
    return !Array.isArray(specs) || specs.length === 0;
  }).length;
  const productosConFaltantes = productosRows
    .filter(
      row =>
        !text(row.imagen_principal) ||
        !text(row.ficha_pdf) ||
        !Array.isArray(row.especificaciones) ||
        row.especificaciones.length === 0
    )
    .slice(0, 12);
  const publishHistory = await publishLogPanel();
  return `
    ${withoutProvider > 0 ? `<div class="admin-alert">${withoutProvider} productos dropship no tienen proveedor asignado.</div>` : ''}
    <section class="admin-grid">
      ${metric('Total productos', productos)}
      ${metric('Productos activos', productosActivos)}
      ${metric('Borradores', productosBorrador)}
      ${metric('Clientes', clientes)}
      ${metric('Oportunidades CRM', oportunidades)}
      ${metric('CRM nuevos', oportunidadesNuevas)}
      ${metric('CRM cotizando', oportunidadesCotizando)}
      ${metric('Presupuestos sin leer', cotizaciones)}
      ${metric('Pedidos sin leer', pedidos)}
      ${metric('Cupones activos', cupones)}
      ${metric('Dropship', productosDropship)}
      ${metric('Disponibles', productosDisponibles)}
      ${metric('No disponibles', productosNoDisponibles)}
      ${metric('Sin tipo', productosSinTipo)}
      ${metric('Sin imagen', productosSinImagen)}
      ${metric('Sin PDF', productosSinPdf)}
      ${metric('Sin specs', productosSinSpecs)}
      ${metric('Dropship sin proveedor', withoutProvider)}
      ${metric('Fulfillments con error', fulfillmentsError)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Uso portal comercial · últimos 30 días</h2>
        ${commercialUsage.available ? '' : '<span class="admin-help">Migración pendiente</span>'}
      </div>
      ${
        commercialUsage.available
          ? `<div class="admin-grid" style="padding:16px">
              ${metric('Comerciales activos', commercialUsage.activeUsers)}
              ${metric('Sesiones portal', commercialUsage.sessions)}
              ${metric('Vistas catálogo', commercialUsage.catalogViews)}
              ${metric('Búsquedas', commercialUsage.searches)}
              ${metric('Envíos catálogo', commercialUsage.shares)}
              ${metric('Envíos exitosos', commercialUsage.shareSucceeded)}
              ${marketingMetric('WhatsApp / email', `${commercialUsage.whatsapp} / ${commercialUsage.email}`)}
              ${metric('CRM sincronizado', commercialUsage.crmSynced)}
            </div>
            <p class="admin-help" style="padding:0 16px 16px;margin:0">Incluye actividad autenticada del equipo, búsquedas, filtros y envíos desde <code>/comercial/</code>. No almacena datos del destinatario.</p>`
          : '<p class="admin-help" style="padding:16px">Aplica la migración <code>commercial_usage_report</code> para activar este bloque.</p>'
      }
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Salud operativa</h2></div>
      <div class="admin-health">
        <div class="admin-health__item">
          <strong>Inventario</strong>
          <p>${productosDisponibles} productos disponibles y ${productosNoDisponibles} temporalmente no disponibles.</p>
        </div>
        <div class="admin-health__item">
          <strong>Catálogo</strong>
          <p>${productosActivos} publicados, ${productosBorrador} borradores y ${productosSinSpecs} productos sin especificaciones.</p>
        </div>
        <div class="admin-health__item">
          <strong>Fulfillment</strong>
          <p>${productosDropship} productos con modalidad dropship, ${withoutProvider} sin proveedor asignado.</p>
        </div>
      </div>
    </section>
    ${
      productosConFaltantes.length
        ? `<section class="admin-panel">
            <div class="admin-panel__head"><h2>Productos para completar</h2></div>
            <div style="padding:16px">
              <p class="admin-help">Prioriza estos productos para completar imagen, PDF o especificaciones.</p>
              <ul class="admin-list">
                ${productosConFaltantes
                  .map(row => {
                    const faltantes = [
                      !text(row.imagen_principal) ? 'imagen' : null,
                      !text(row.ficha_pdf) ? 'PDF' : null,
                      !Array.isArray(row.especificaciones) || row.especificaciones.length === 0
                        ? 'specs'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(', ');
                    return `<li><strong>${escapeHtml(text(row.nombre_es) || text(row.id))}</strong> <span class="admin-help">(${escapeHtml(faltantes)})</span></li>`;
                  })
                  .join('')}
              </ul>
            </div>
          </section>`
        : ''
    }
    ${publishHistory}
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Accesos</h2></div>
      <div class="admin-grid" style="padding:16px">
        <a class="admin-button" href="#/producto">Crear producto</a>
        <a class="admin-button" href="#/ingesta">Ingesta PDF</a>
        <a class="admin-button admin-button--ghost" href="#/taxonomia">Taxonomia</a>
        <a class="admin-button admin-button--ghost" href="#/clientes">Clientes</a>
        <a class="admin-button admin-button--ghost" href="#/crm">CRM</a>
        <a class="admin-button admin-button--ghost" href="#/cupones">Cupones</a>
          <a class="admin-button admin-button--ghost" href="#/cotizaciones">Presupuestos</a>
        <a class="admin-button admin-button--ghost" href="#/usuarios">Usuarios CMS</a>
        <a class="admin-button admin-button--ghost" href="#/reportes">Reportes</a>
        <a class="admin-button admin-button--ghost" href="#/marketing">Marketing</a>
      </div>
    </section>`;
}

type AdminUserRow = {
  user_id: string;
  email: string;
  rol: string;
  activo: boolean;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  synced: boolean;
};

const ADMIN_ROLES: Array<[string, string]> = [
  ['lectura', 'Lectura'],
  ['ventas', 'Ventas'],
  ['catalogo', 'Catálogo'],
  ['operaciones', 'Operaciones'],
  ['admin', 'Admin'],
  ['owner', 'Owner'],
];

async function usuariosView(): Promise<string> {
  const { data, error } = await supabase!.functions.invoke('admin-users', {
    body: { action: 'list' },
  });
  if (error) toast(error.message);
  const users = (((data as { users?: AdminUserRow[] } | null)?.users ?? []) as AdminUserRow[]).sort(
    (a, b) => a.email.localeCompare(b.email)
  );

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Crear o sincronizar acceso CMS</h2>
      </div>
      <form class="admin-form" data-admin-user-form style="padding:16px">
        <div class="admin-alert">Este formulario crea o actualiza el usuario en Supabase Auth y sincroniza su perfil en <code>admin_profiles</code>. Sin usuario Auth no puede iniciar sesión, aunque exista un perfil CMS.</div>
        <div class="admin-editor__cols">
          ${field('email', 'Email', '', true, 'email')}
          ${selectStatic('rol', 'Rol', 'lectura', ADMIN_ROLES)}
        </div>
        <label class="admin-field">Contraseña inicial opcional
          <input name="password" type="password" autocomplete="new-password" minlength="8" />
          <small>Si la dejas vacía se enviará invitación por email cuando el proveedor SMTP de Supabase esté disponible.</small>
        </label>
        <label class="admin-field">Confirmar contraseña
          <input name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" />
        </label>
        <label class="admin-field"><span><input name="sendInvite" type="checkbox" checked /> Enviar invitación si no escribo contraseña</span></label>
        <label class="admin-field"><span><input name="activo" type="checkbox" checked /> Perfil activo</span></label>
        <button class="admin-button" type="submit" data-admin-user-submit>Guardar acceso</button>
        <button class="admin-button admin-button--ghost" type="button" data-admin-user-reset-form>Limpiar formulario</button>
        <p class="admin-help" data-admin-user-status></p>
      </form>
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Usuarios sincronizados (${users.length})</h2></div>
      ${table(
        ['Email', 'Rol', 'Activo', 'Auth', 'Confirmado', 'Último acceso', 'Acciones'],
        users.map(user => [
          user.email,
          user.rol,
          user.activo ? 'Sí' : 'No',
          user.synced ? 'Sincronizado' : 'Falta Auth',
          user.confirmed_at ? formatDate(user.confirmed_at) : 'Pendiente',
          user.last_sign_in_at ? formatDate(user.last_sign_in_at) : '—',
          adminUserActions(user),
        ])
      )}
    </section>`;
}

function adminUserActions(user: AdminUserRow): string {
  const email = escapeHtml(user.email);
  const userId = escapeHtml(user.user_id);
  const role = escapeHtml(user.rol);
  const active = user.activo ? '1' : '0';
  return `
    <div class="admin-row-actions">
      <button class="admin-button admin-button--ghost" type="button" data-admin-user-edit="${email}" data-admin-user-id="${userId}" data-admin-user-rol="${role}" data-admin-user-activo="${active}">Editar</button>
      <button class="admin-button admin-button--ghost" type="button" data-admin-user-password="${email}" data-admin-user-rol="${role}" data-admin-user-activo="${active}">Cambiar contraseña</button>
      <button class="admin-button admin-button--ghost" type="button" data-admin-user-toggle="${email}" data-admin-user-rol="${role}" data-admin-user-activo="${active}">${user.activo ? 'Desactivar' : 'Activar'}</button>
      <button class="admin-button admin-button--danger" type="button" data-admin-user-delete="${email}" data-admin-user-id="${userId}">Eliminar</button>
    </div>`;
}

function metric(label: string, value: number): string {
  return `<article class="admin-card"><strong>${escapeHtml(label)}</strong><span>${value}</span></article>`;
}

function marketingMetric(label: string, value: string): string {
  return `<article class="admin-card admin-card--marketing"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></article>`;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}m ${rest}s`;
}

const PRODUCTOS_PAGE_SIZE = 20;

type ProductListColumnType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'image'
  | 'gallery'
  | 'link'
  | 'json'
  | 'list'
  | 'computed';

type ProductListColumn = {
  key: string;
  label: string;
  type: ProductListColumnType;
  sortable?: boolean;
  options?: Array<[string, string]>;
};

const PRODUCT_SORT_FIELDS = new Set([
  'nombre_es',
  'nombre_en',
  'slug',
  'sku',
  'gtin',
  'familia_id',
  'tipo_id',
  'tipo_comercial',
  'fulfillment_mode',
  'precio',
  'precio_regular',
  'precio_oferta',
  'dian_codigo',
  'tarifa_iva_pct',
  'retencion_fuente_pct',
  'retencion_iva_pct',
  'retencion_ica_pct',
  'moneda',
  'stock',
  'gestionar_stock',
  'stock_estado',
  'backorder_policy',
  'disponible',
  'excluido_iva',
  'activo',
  'destacado',
  'nuevo',
  'ficha_pdf',
  'peso_kg',
  'orden',
  'created_at',
  'updated_at',
]);

const PRODUCT_LIST_COLUMNS: ProductListColumn[] = [
  { key: 'imagen_principal', label: 'Foto / acciones', type: 'image' },
  { key: 'galeria', label: 'Galería', type: 'gallery' },
  { key: 'nombre_es', label: 'Nombre ES', type: 'text', sortable: true },
  { key: 'nombre_en', label: 'Nombre EN', type: 'text', sortable: true },
  { key: 'slug', label: 'Slug', type: 'text', sortable: true },
  { key: 'sku', label: 'SKU', type: 'text', sortable: true },
  { key: 'fabricante_distribuidor', label: 'Fabricante / distribuidor', type: 'computed' },
  { key: 'gtin', label: 'GTIN', type: 'text', sortable: true },
  { key: 'familia_id', label: 'Familia', type: 'select', sortable: true },
  { key: 'tipo_id', label: 'Tipo', type: 'select', sortable: true },
  {
    key: 'tipo_comercial',
    label: 'Tipo comercial',
    type: 'select',
    sortable: true,
    options: [
      ['equipo', 'Equipo'],
      ['consumible', 'Consumible'],
    ],
  },
  {
    key: 'fulfillment_mode',
    label: 'Fulfillment',
    type: 'select',
    sortable: true,
    options: [
      ['cotizacion', 'Cotizacion'],
      ['dropship', 'Dropship'],
      ['individualizado', 'Individualizado'],
    ],
  },
  { key: 'precio', label: 'Precio', type: 'number', sortable: true },
  { key: 'precio_regular', label: 'Precio regular', type: 'number', sortable: true },
  { key: 'precio_oferta', label: 'Precio oferta', type: 'number', sortable: true },
  { key: 'dian_codigo', label: 'DIAN', type: 'text', sortable: true },
  { key: 'tarifa_iva_pct', label: 'IVA %', type: 'number', sortable: true },
  { key: 'retencion_fuente_pct', label: 'Retefuente %', type: 'number', sortable: true },
  { key: 'retencion_iva_pct', label: 'ReteIVA %', type: 'number', sortable: true },
  { key: 'retencion_ica_pct', label: 'ReteICA %', type: 'number', sortable: true },
  { key: 'moneda', label: 'Moneda', type: 'text', sortable: true },
  { key: 'stock', label: 'Stock', type: 'number', sortable: true },
  { key: 'gestionar_stock', label: 'Gestionar stock', type: 'boolean', sortable: true },
  {
    key: 'stock_estado',
    label: 'Estado stock',
    type: 'select',
    sortable: true,
    options: [
      ['instock', 'En stock'],
      ['outofstock', 'Agotado'],
      ['onbackorder', 'Bajo pedido'],
    ],
  },
  {
    key: 'backorder_policy',
    label: 'Backorders',
    type: 'select',
    sortable: true,
    options: [
      ['no', 'No permitir'],
      ['notify', 'Permitir avisando'],
      ['yes', 'Permitir'],
    ],
  },
  { key: 'disponible', label: 'Disponible', type: 'boolean', sortable: true },
  { key: 'excluido_iva', label: 'Excluido IVA', type: 'boolean', sortable: true },
  { key: 'activo', label: 'Activo', type: 'boolean', sortable: true },
  { key: 'destacado', label: 'Destacado', type: 'boolean', sortable: true },
  { key: 'nuevo', label: 'Nuevo', type: 'boolean', sortable: true },
  { key: 'ficha_pdf', label: 'Ficha PDF', type: 'link', sortable: true },
  { key: 'descripcion_corta_es', label: 'Desc. corta ES', type: 'textarea' },
  { key: 'descripcion_corta_en', label: 'Desc. corta EN', type: 'textarea' },
  { key: 'descripcion_larga_es', label: 'Desc. larga ES', type: 'textarea' },
  { key: 'descripcion_larga_en', label: 'Desc. larga EN', type: 'textarea' },
  { key: 'especificaciones', label: 'Especificaciones JSON', type: 'json' },
  { key: 'aplicaciones_es', label: 'Aplicaciones ES', type: 'list' },
  { key: 'aplicaciones_en', label: 'Aplicaciones EN', type: 'list' },
  { key: 'atributos', label: 'Atributos JSON', type: 'json' },
  { key: 'peso_kg', label: 'Peso kg', type: 'number', sortable: true },
  { key: 'dimensiones_cm', label: 'Dimensiones JSON', type: 'json' },
  { key: 'orden', label: 'Orden', type: 'number', sortable: true },
];

function productosLink(overrides: Record<string, string>): string {
  const params = hashParams();
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  return `#/productos${qs ? `?${qs}` : ''}`;
}

function productSortLink(field: string, currentSort: string, currentDir: string): string {
  const direction = currentSort === field && currentDir !== 'desc' ? 'desc' : 'asc';
  return productosLink({ sort: field, dir: direction, ordenar: '' });
}

function productSortIndicator(field: string, currentSort: string, currentDir: string): string {
  if (field !== currentSort) return '';
  return currentDir === 'desc' ? ' ↓' : ' ↑';
}

async function productosView(): Promise<string> {
  const params = hashParams();
  const q = (params.get('q') ?? '').trim();
  const familiaId = params.get('familia_id') ?? '';
  const tipoId = params.get('tipo_id') ?? '';
  const activo = params.get('activo') ?? '';
  const tipoComercial = params.get('tipo_comercial') ?? '';
  const disponible = params.get('disponible') ?? '';
  const incorporadoDesde = params.get('incorporado_desde') ?? '';
  const incorporadoHasta = params.get('incorporado_hasta') ?? '';
  const ordenar = params.get('ordenar') ?? 'interno';
  const sort = params.get('sort') ?? '';
  const dir = params.get('dir') === 'desc' ? 'desc' : 'asc';
  const page = Math.max(1, numberOrZero(params.get('page')) || 1);

  const [familias, tipos] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
  ]);
  const familiasPorId = new Map(familias.map(f => [text(f.id), text(f.nombre_es)]));
  const tiposParaSelect = tipos.map(
    (t): Row => ({
      ...t,
      nombre_es: `${familiasPorId.get(text(t.familia_id)) ?? 'Sin familia'} / ${text(t.nombre_es)}`,
    })
  );

  let query = supabase!.from('productos').select('*', { count: 'exact' });
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '');
    if (safeQ) query = query.or(`nombre_es.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`);
  }
  if (familiaId) query = query.eq('familia_id', familiaId);
  if (tipoId) query = query.eq('tipo_id', tipoId);
  if (activo === '1') query = query.eq('activo', true);
  if (activo === '0') query = query.eq('activo', false);
  if (tipoComercial) query = query.eq('tipo_comercial', tipoComercial);
  if (disponible === '1') query = query.eq('disponible', true);
  if (disponible === '0') query = query.eq('disponible', false);
  if (incorporadoDesde) query = query.gte('created_at', `${incorporadoDesde}T00:00:00`);
  if (incorporadoHasta) query = query.lte('created_at', `${incorporadoHasta}T23:59:59.999`);

  if (sort && PRODUCT_SORT_FIELDS.has(sort)) {
    query = query.order(sort, { ascending: dir !== 'desc', nullsFirst: false });
    if (sort !== 'nombre_es') query = query.order('nombre_es', { ascending: true });
  } else if (ordenar === 'alfabetico_asc') {
    query = query.order('nombre_es', { ascending: true }).order('orden', { ascending: true });
  } else if (ordenar === 'alfabetico_desc') {
    query = query.order('nombre_es', { ascending: false }).order('orden', { ascending: true });
  } else if (ordenar === 'recientes') {
    query = query.order('created_at', { ascending: false }).order('nombre_es', { ascending: true });
  } else if (ordenar === 'antiguos') {
    query = query.order('created_at', { ascending: true }).order('nombre_es', { ascending: true });
  } else {
    query = query.order('orden', { ascending: true }).order('nombre_es', { ascending: true });
  }

  const from = (page - 1) * PRODUCTOS_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PRODUCTOS_PAGE_SIZE - 1);
  if (error) toast(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PRODUCTOS_PAGE_SIZE));

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Catalogo (${total})</h2>
        <div class="admin-toolbar">
          <a class="admin-button" href="#/producto">Nuevo producto</a>
          <button class="admin-button admin-button--ghost" type="button" data-products-export-xlsx>Exportar Excel</button>
          <button class="admin-button admin-button--ghost" type="button" data-products-template-xlsx>Plantilla Excel</button>
        </div>
      </div>
      <form class="admin-filters" data-productos-filter>
        ${field('q', 'Buscar por nombre o slug', q, false, 'search')}
        ${selectStatic('familia_id', 'Familia', familiaId, [
          ['', 'Todas las familias'],
          ...familias.map((f): [string, string] => [text(f.id), text(f.nombre_es)]),
        ])}
        ${selectStatic('tipo_id', 'Tipo', tipoId, [
          ['', 'Todos los tipos'],
          ...tiposParaSelect.map((t): [string, string] => [text(t.id), text(t.nombre_es)]),
        ])}
        ${selectStatic('activo', 'Estado', activo, [
          ['', 'Todos'],
          ['1', 'Activo'],
          ['0', 'Borrador'],
        ])}
        ${selectStatic('tipo_comercial', 'Tipo comercial', tipoComercial, [
          ['', 'Todos'],
          ['equipo', 'Equipo'],
          ['consumible', 'Consumible'],
        ])}
        ${selectStatic('disponible', 'Disponibilidad', disponible, [
          ['', 'Todos'],
          ['1', 'Disponible'],
          ['0', 'Temporalmente no disponible'],
        ])}
        ${field('incorporado_desde', 'Fecha incorporación desde', incorporadoDesde, false, 'date')}
        ${field('incorporado_hasta', 'Fecha incorporación hasta', incorporadoHasta, false, 'date')}
        ${selectStatic('ordenar', 'Ordenar', ordenar, [
          ['interno', 'Orden interno'],
          ['alfabetico_asc', 'A-Z'],
          ['alfabetico_desc', 'Z-A'],
          ['recientes', 'Más recientes'],
          ['antiguos', 'Más antiguos'],
        ])}
        <button class="admin-button" type="submit">Filtrar</button>
        <a class="admin-button admin-button--ghost" href="#/productos">Limpiar</a>
      </form>
      <form class="admin-panel admin-form" data-products-import-form>
        <div class="admin-panel__head">
          <h2>Carga masiva</h2>
          <button class="admin-button" type="submit">Importar Excel</button>
        </div>
        <div class="admin-upload-box">
          <div>
            <strong>Sube un archivo .xlsx con una fila por producto</strong>
            <p>Usa la plantilla para respetar columnas y tipos. El importador hace upsert por <code>slug</code> y puede crear taxonomía faltante si lo marcas.</p>
          </div>
          <label class="admin-button admin-button--ghost">
            Seleccionar archivo
            <input data-products-import-file type="file" accept=".xlsx,.xls" hidden />
          </label>
        </div>
        <label class="admin-field" style="max-width: 380px">
          <span><input data-products-import-create-taxonomy type="checkbox" checked /> Crear familia/tipo faltante</span>
        </label>
        <p class="admin-help" data-products-import-status>Sin archivo seleccionado.</p>
      </form>
      ${table(
        PRODUCT_LIST_COLUMNS.map(column =>
          column.sortable
            ? `<a class="admin-sort-link" href="${productSortLink(column.key, sort, dir)}">${escapeHtml(column.label)}${productSortIndicator(column.key, sort, dir)}</a>`
            : escapeHtml(column.label)
        ),
        rows.map(row => [
          ...PRODUCT_LIST_COLUMNS.map(column =>
            productListCell(row, column, familias, tiposParaSelect)
          ),
        ]),
        'admin-products-table'
      )}
      <div class="admin-pagination">
        <span class="admin-meta">Pagina ${page} de ${totalPages}</span>
        <div class="admin-toolbar">
          <a class="admin-button admin-button--ghost" href="${productosLink({ page: page > 2 ? String(page - 1) : '' })}" ${page <= 1 ? 'aria-disabled="true" tabindex="-1" style="pointer-events:none;opacity:.5"' : ''}>Anterior</a>
          <a class="admin-button admin-button--ghost" href="${productosLink({ page: String(page + 1) })}" ${page >= totalPages ? 'aria-disabled="true" tabindex="-1" style="pointer-events:none;opacity:.5"' : ''}>Siguiente</a>
        </div>
      </div>
    </section>`;
}

async function productoFormView(): Promise<string> {
  const [familias, tipos, producto] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
    state.recordId ? getRow('productos', state.recordId) : Promise.resolve(null),
  ]);
  const draft = productDraft(producto);
  return `
    <form class="admin-panel admin-form" data-product-form>
      <input type="hidden" name="id" value="${escapeHtml(draft.id ?? '')}" />
      <div class="admin-panel__head">
        <h2>${draft.id ? 'Editar producto' : 'Crear producto'}</h2>
        <div class="admin-toolbar">
          <button class="admin-button" type="submit">Guardar borrador</button>
          ${draft.id ? '<button class="admin-button admin-button--danger" data-delete-product type="button">Eliminar</button>' : ''}
        </div>
      </div>
      <div class="admin-editor">
        <div class="admin-form">
          <div class="admin-editor__cols">
            ${field('nombre_es', 'Nombre ES', draft.nombre_es, true)}
            ${field('nombre_en', 'Nombre EN', draft.nombre_en)}
            ${field('slug', 'Slug', draft.slug, true)}
            ${field('sku', 'SKU', draft.sku)}
            ${field('gtin', 'GTIN / codigo externo', draft.gtin)}
            ${select('familia_id', 'Familia', draft.familia_id, familias, 'nombre_es')}
            ${select('tipo_id', 'Tipo', draft.tipo_id, tipos, 'nombre_es', true)}
            ${selectStatic('tipo_comercial', 'Tipo comercial', draft.tipo_comercial, [
              ['equipo', 'Equipo'],
              ['consumible', 'Consumible'],
            ])}
            ${selectStatic('fulfillment_mode', 'Fulfillment', draft.fulfillment_mode, [
              ['cotizacion', 'Cotizacion'],
              ['dropship', 'Dropship'],
              ['individualizado', 'Individualizado'],
            ])}
            ${field('precio', 'Precio actual COP', draft.precio?.toString() ?? '', false, 'number')}
            ${field('precio_regular', 'Precio regular COP', draft.precio_regular?.toString() ?? '', false, 'number')}
            ${field('precio_oferta', 'Precio oferta COP', draft.precio_oferta?.toString() ?? '', false, 'number')}
            ${field('oferta_inicio', 'Inicio oferta', draft.oferta_inicio, false, 'datetime-local')}
            ${field('oferta_fin', 'Fin oferta', draft.oferta_fin, false, 'datetime-local')}
            ${field('stock', 'Stock', draft.stock?.toString() ?? '', false, 'number')}
            ${field('dian_codigo', 'Codigo DIAN / UNSPSC', draft.dian_codigo ?? '')}
            ${field('tarifa_iva_pct', 'IVA %', draft.tarifa_iva_pct?.toString() ?? '', false, 'number')}
            ${field('retencion_fuente_pct', 'Retefuente %', draft.retencion_fuente_pct?.toString() ?? '', false, 'number')}
            ${field('retencion_iva_pct', 'ReteIVA %', draft.retencion_iva_pct?.toString() ?? '', false, 'number')}
            ${field('retencion_ica_pct', 'ReteICA %', draft.retencion_ica_pct?.toString() ?? '', false, 'number')}
            ${selectStatic('stock_estado', 'Estado stock', draft.stock_estado, [
              ['instock', 'En stock'],
              ['outofstock', 'Agotado'],
              ['onbackorder', 'Bajo pedido'],
            ])}
            ${selectStatic('backorder_policy', 'Backorders', draft.backorder_policy, [
              ['no', 'No permitir'],
              ['notify', 'Permitir avisando'],
              ['yes', 'Permitir'],
            ])}
            ${field('peso_kg', 'Peso kg', draft.peso_kg?.toString() ?? '', false, 'number')}
            ${field('orden', 'Orden', String(draft.orden), false, 'number')}
          </div>
          ${textarea('atributos', 'Atributos JSON', JSON.stringify(draft.atributos, null, 2))}
          ${textarea('dimensiones_cm', 'Dimensiones cm JSON', JSON.stringify(draft.dimensiones_cm, null, 2))}
          ${textarea('descripcion_corta_es', 'Descripcion corta ES', draft.descripcion_corta_es)}
          ${textarea('descripcion_corta_en', 'Descripcion corta EN', draft.descripcion_corta_en)}
          ${textarea('descripcion_larga_es', 'Descripcion larga ES', draft.descripcion_larga_es)}
          ${textarea('descripcion_larga_en', 'Descripcion larga EN', draft.descripcion_larga_en)}
          ${renderSpecEditor(draft.especificaciones)}
          ${textarea('aplicaciones_es', 'Aplicaciones ES (una por linea)', draft.aplicaciones_es.join('\n'))}
          ${textarea('aplicaciones_en', 'Aplicaciones EN (una por linea)', draft.aplicaciones_en.join('\n'))}
        </div>
        <aside class="admin-form">
          ${field('imagen_principal', 'URL imagen principal', draft.imagen_principal)}
          ${upload('productos', 'imagen_principal', 'Subir imagen')}
          ${field('ficha_pdf', 'URL ficha PDF', draft.ficha_pdf)}
          ${upload('fichas', 'ficha_pdf', 'Subir PDF')}
          ${checkbox('gestionar_stock', 'Gestionar stock automaticamente', draft.gestionar_stock)}
          ${checkbox('destacado', 'Destacado', draft.destacado)}
          ${checkbox('nuevo', 'Nuevo', draft.nuevo)}
          ${checkbox('activo', 'Activo / publicado en sitio estatico', draft.activo)}
          ${checkbox('disponible', 'Disponible (Escenario A)', draft.disponible)}
          ${checkbox('excluido_iva', 'Excluir de IVA', draft.excluido_iva)}
          <div class="admin-help">Desmarcar "Disponible" saca el producto del carrito y de crear-pago en tiempo real (sin rebuild), aunque siga "Activo" para SEO/landing. Usalo para roturas de stock del proveedor.</div>
          <div class="admin-help">Los porcentajes fiscales se usan en checkout CO para IVA y retenciones automaticas. Si se dejan vacios, la Edge Function usa defaults del entorno si existen.</div>
          <div class="admin-alert">Guardar desde ingesta siempre debe quedar como borrador hasta revision humana. Publicar cambios dispara rebuild separado.</div>
        </aside>
      </div>
    </form>`;
}

async function taxonomiaView(): Promise<string> {
  const [familias, tipos, productos] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
    selectRows('productos', 'id,nombre_es,slug,familia_id,tipo_id', 'nombre_es', 500),
  ]);
  const familiasPorId = new Map(familias.map(f => [text(f.id), text(f.nombre_es)]));
  const familiasSlugPorId = new Map(familias.map(f => [text(f.id), text(f.slug)]));
  const conteoPorTipo = new Map<string, number>();
  const productosSinTipo: Row[] = [];
  const productosSinFamilia: Row[] = [];
  for (const producto of productos) {
    const tipoId = text(producto.tipo_id);
    if (!tipoId) {
      productosSinTipo.push(producto);
    } else {
      conteoPorTipo.set(tipoId, (conteoPorTipo.get(tipoId) ?? 0) + 1);
    }
    if (!text(producto.familia_id)) {
      productosSinFamilia.push(producto);
    }
  }
  const tiposSinProductos = tipos.filter(t => (conteoPorTipo.get(text(t.id)) ?? 0) === 0);
  const tiposParaSelect = tipos.map(t => ({
    ...t,
    nombre_es: `${familiasPorId.get(text(t.familia_id)) ?? 'Sin familia'} / ${text(t.nombre_es)}`,
  }));
  return `
    <section class="admin-taxonomy-grid">
      <form class="admin-panel admin-form admin-taxonomy-panel" data-simple-form data-table="familias" data-fields="slug,nombre_es,nombre_en,descripcion_es,descripcion_en,orden,activo">
        <div class="admin-panel__head"><h2>Familias</h2><button class="admin-button" type="submit">Crear familia</button></div>
        <div class="admin-taxonomy-list admin-taxonomy-list--familias">
          ${field('slug', 'Slug', '', true)}
          ${field('nombre_es', 'Nombre ES', '', true)}
          ${field('nombre_en', 'Nombre EN')}
          ${textarea('descripcion_es', 'Descripcion ES')}
          ${textarea('descripcion_en', 'Descripcion EN')}
          ${field('orden', 'Orden', '0', false, 'number')}
          ${checkbox('activo', 'Activa', true)}
        </div>
        ${table(
          ['Slug', 'Nombre', 'Estado', 'Acciones'],
          familias.map(r => [
            text(r.slug),
            text(r.nombre_es),
            status(r.activo),
            [
              `<button class="admin-button admin-button--ghost" type="button" data-edit-familia="${escapeHtml(text(r.id))}">Editar</button>`,
              `<button class="admin-button admin-button--danger" type="button" data-delete-familia="${escapeHtml(text(r.id))}">Eliminar</button>`,
            ].join(' '),
          ])
        )}
      </form>
      <form class="admin-panel admin-form admin-taxonomy-panel" data-familia-edit-form>
        <div class="admin-panel__head"><h2>Editar familia</h2><button class="admin-button" type="submit">Guardar cambios</button></div>
        <div class="admin-taxonomy-list">
          ${select('familia_id', 'Familia a editar', '', familias, 'nombre_es', true)}
          ${field('slug', 'Slug', '', true)}
          ${field('nombre_es', 'Nombre ES', '', true)}
          ${field('nombre_en', 'Nombre EN')}
          ${textarea('descripcion_es', 'Descripcion ES')}
          ${textarea('descripcion_en', 'Descripcion EN')}
          ${field('orden', 'Orden', '0', false, 'number')}
          ${checkbox('activo', 'Activa', true)}
        </div>
        <p class="admin-help">Selecciona una familia, precarga sus campos y guarda los cambios.</p>
      </form>
      <form class="admin-panel admin-form admin-taxonomy-panel" data-type-edit-form>
        <div class="admin-panel__head"><h2>Editar tipo</h2><button class="admin-button" type="submit">Guardar cambios</button></div>
        <div class="admin-taxonomy-list">
          ${select('tipo_id', 'Tipo a editar', '', tipos, 'nombre_es', true)}
          ${select('familia_id', 'Familia', '', familias, 'nombre_es', true)}
          ${field('slug', 'Slug', '', true)}
          ${field('nombre_es', 'Nombre ES', '', true)}
          ${field('nombre_en', 'Nombre EN')}
          ${field('orden', 'Orden', '0', false, 'number')}
          ${checkbox('activo', 'Activo', true)}
        </div>
        <p class="admin-help">Selecciona un tipo, precarga sus campos y guarda los cambios.</p>
      </form>
      <form class="admin-panel admin-form admin-taxonomy-panel" data-simple-form data-table="tipos" data-fields="familia_id,slug,nombre_es,nombre_en,orden,activo">
        <div class="admin-panel__head"><h2>Tipos</h2><button class="admin-button" type="submit">Crear tipo</button></div>
        <div class="admin-taxonomy-list">
          ${select('familia_id', 'Familia', '', familias, 'nombre_es')}
          ${field('slug', 'Slug', '', true)}
          ${field('nombre_es', 'Nombre ES', '', true)}
          ${field('nombre_en', 'Nombre EN')}
          ${field('orden', 'Orden', '0', false, 'number')}
          ${checkbox('activo', 'Activo', true)}
        </div>
        ${table(
          ['Slug', 'Nombre', 'Productos', 'Estado', 'Acciones'],
          tipos.map(r => [
            text(r.slug),
            text(r.nombre_es),
            String(conteoPorTipo.get(text(r.id)) ?? 0),
            status(r.activo),
            [
              `<button class="admin-button admin-button--ghost" type="button" data-edit-tipo="${escapeHtml(text(r.id))}">Editar</button>`,
              `<button class="admin-button admin-button--danger" type="button" data-delete-tipo="${escapeHtml(text(r.id))}">Eliminar</button>`,
            ].join(' '),
          ])
        )}
      </form>
    </section>
    ${
      tiposSinProductos.length
        ? `<section class="admin-panel">
            <div class="admin-panel__head"><h2>Limpieza de tipos sin productos (${tiposSinProductos.length})</h2><button class="admin-button admin-button--danger" type="button" data-delete-empty-tipos>Eliminar todos</button></div>
            <div style="padding:16px">
              <p class="admin-help">Estos tipos no tienen productos asignados y se pueden eliminar en bloque sin afectar el catálogo.</p>
              <ul class="admin-list">
                ${tiposSinProductos
                  .map(
                    tipo =>
                      `<li><strong>${escapeHtml(text(tipo.nombre_es))}</strong> <span class="admin-help">(${escapeHtml(
                        familiasPorId.get(text(tipo.familia_id)) ??
                          familiasSlugPorId.get(text(tipo.familia_id)) ??
                          'Sin familia'
                      )})</span></li>`
                  )
                  .join('')}
              </ul>
            </div>
          </section>`
        : ''
    }
    <section class="admin-panel admin-taxonomy-unassigned">
      <div class="admin-panel__head">
        <h2>Productos sin tipo asignado (${productosSinTipo.length})</h2>
        <button class="admin-button" type="button" data-autoasignar-tipos>Autoasignar tipos faltantes</button>
      </div>
      ${
        productosSinTipo.length === 0
          ? '<p class="admin-help admin-taxonomy-empty">Todos los productos tienen tipo asignado.</p>'
          : productosSinTipo
              .map(
                p => `
        <form class="admin-taxonomy-assign" data-reasignar-form>
          <input type="hidden" name="producto_id" value="${escapeHtml(text(p.id))}" />
          <div class="admin-taxonomy-product">
            <span>Producto</span>
            <strong>${escapeHtml(text(p.nombre_es))}</strong>
            <small>${escapeHtml(text(p.slug))}</small>
          </div>
          <div class="admin-taxonomy-assign__fields">
            ${select('familia_id', 'Familia', text(p.familia_id), familias, 'nombre_es', true)}
            ${select('tipo_id', 'Tipo', '', tiposParaSelect, 'nombre_es', true)}
          </div>
          <button class="admin-button" type="submit">Reasignar</button>
        </form>`
              )
              .join('')
      }
    </section>
    <section class="admin-panel admin-taxonomy-unassigned">
      <div class="admin-panel__head"><h2>Productos sin familia (${productosSinFamilia.length})</h2></div>
      ${
        productosSinFamilia.length === 0
          ? '<p class="admin-help admin-taxonomy-empty">Todos los productos tienen familia asignada.</p>'
          : productosSinFamilia
              .map(
                p => `
        <form class="admin-taxonomy-assign" data-reasignar-form>
          <input type="hidden" name="producto_id" value="${escapeHtml(text(p.id))}" />
          <div class="admin-taxonomy-product">
            <span>Producto</span>
            <strong>${escapeHtml(text(p.nombre_es))}</strong>
            <small>${escapeHtml(text(p.slug))}</small>
          </div>
          <div class="admin-taxonomy-assign__fields">
            ${select('familia_id', 'Familia', '', familias, 'nombre_es', true)}
            ${select('tipo_id', 'Tipo', text(p.tipo_id), tiposParaSelect, 'nombre_es', true)}
          </div>
          <button class="admin-button" type="submit">Reasignar</button>
        </form>`
              )
              .join('')
      }
    </section>`;
}

const COTIZACION_ESTADOS: Array<[string, string]> = [
  ['nueva', 'Nueva'],
  ['en_revision', 'En revision'],
  ['respondida', 'Respondida'],
  ['enviada', 'Enviada'],
  ['convertida', 'Convertida'],
  ['expirada', 'Expirada'],
];

function cotizacionEstadoLabel(estado: string): string {
  return COTIZACION_ESTADOS.find(([value]) => value === estado)?.[1] ?? estado;
}

function timestampCorto(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 16);
}

function appendNotaInterna(base: string, linea: string): string {
  const trimmed = linea.trim();
  if (!trimmed) return base.trim();
  const actual = base.trim();
  return actual ? `${actual}\n${trimmed}` : trimmed;
}

function parseNotasInternas(valor: string): string[] {
  return valor
    .split(/\r?\n+/)
    .map(linea => linea.trim())
    .filter(Boolean);
}

function cotizacionResumenTexto(row: Row): string {
  const nombre = text(row.nombre) || 'Sin nombre';
  const empresa = text(row.empresa) || 'Sin empresa';
  const email = text(row.email) || 'Sin email';
  const estado = cotizacionEstadoLabel(text(row.estado) || 'nueva');
  return [
    `Cotizacion: ${nombre}`,
    `Empresa: ${empresa}`,
    `Email: ${email}`,
    `Estado: ${estado}`,
    `Fecha: ${text(row.created_at) || '—'}`,
  ].join(' | ');
}

async function actualizarSeguimientoCotizacion(
  id: string,
  estado: string,
  opciones: { nota?: string; notas?: string } = {}
): Promise<boolean> {
  const before = await getRow('solicitudes_cotizacion', id);
  const estadoAnterior = text(before?.estado) || 'nueva';
  const baseNotas =
    opciones.notas !== undefined ? opciones.notas.trim() : text(before?.notas_internas);
  const historial = appendNotaInterna(
    baseNotas,
    `[${timestampCorto()}] Estado: ${cotizacionEstadoLabel(estadoAnterior)} -> ${cotizacionEstadoLabel(
      estado
    )}${opciones.nota ? ` | ${opciones.nota}` : ''}`
  );
  const { error } = await supabase!
    .from('solicitudes_cotizacion')
    .update({
      estado,
      notas_internas: historial || null,
      leida: true,
    })
    .eq('id', id);
  if (error) {
    toast(error.message);
    return false;
  }
  return true;
}

async function actualizarSeguimientoFulfillment(
  id: string,
  estado: string,
  nota?: string
): Promise<boolean> {
  const before = await getRow('fulfillments', id);
  const notasPrevias = text(before?.notas);
  const cambios: Row = { estado };
  const ahora = new Date().toISOString();
  if (estado === 'notificado' && !before?.notificado_at) cambios.notificado_at = ahora;
  if (estado === 'enviado') {
    cambios.enviado_at = before?.enviado_at ? before.enviado_at : ahora;
  }
  if (estado === 'entregado') {
    cambios.entregado_at = before?.entregado_at ? before.entregado_at : ahora;
  }
  cambios.notas = appendNotaInterna(
    notasPrevias,
    `[${timestampCorto()}] Estado: ${text(before?.estado) || 'pendiente'} -> ${estado}${nota ? ` | ${nota}` : ''}`
  );
  const { error } = await supabase!.from('fulfillments').update(cambios).eq('id', id);
  if (error) {
    toast(error.message);
    return false;
  }
  return true;
}

async function cotizacionesView(): Promise<string> {
  const rows = await selectRows('solicitudes_cotizacion', '*', 'created_at', 100, false);
  const csvPayload = escapeHtml(JSON.stringify(rows));
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <div>
          <h2>Presupuestos (${rows.length})</h2>
          <p class="admin-help">Solicitudes web y ofertas formales. Crea un presupuesto, importa ficha PDF, previsualiza y envía por email o WhatsApp sin salir de admin.</p>
        </div>
        <div class="admin-toolbar">
          <button class="admin-button" type="button" data-cotizacion-nuevo>Nuevo presupuesto</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizaciones-select-all>Seleccionar todo</button>
          <button class="admin-button admin-button--ghost" type="button" data-csv="${csvPayload}" data-filename="presupuestos.csv">Exportar CSV</button>
          <span class="admin-meta">Seleccionadas: <strong data-cotizaciones-selected-count>0</strong></span>
          <button class="admin-button admin-button--danger" type="button" data-bulk-cotizacion-delete>Eliminar seleccionadas</button>
        </div>
      </div>
      ${table(
        [
          '',
          'Numero',
          'Fecha',
          'Nombre',
          'Empresa',
          'Email',
          'Estado',
          'Moneda',
          'Total ofertado',
          'Enviada',
          'Acciones',
        ],
        rows.map(row => {
          const moneda = normalizarMonedaCotizacion(row.moneda);
          const total =
            row.precio_total_ofertado != null && row.precio_total_ofertado !== ''
              ? crmMoney(Number(row.precio_total_ofertado), moneda)
              : '—';
          return [
            `<input type="checkbox" data-cotizacion-select value="${escapeHtml(text(row.id))}" aria-label="Seleccionar cotizacion" />`,
            escapeHtml(text(row.numero)) || '—',
            formatCell(row.created_at),
            escapeHtml(text(row.nombre)),
            escapeHtml(text(row.empresa)) || '—',
            escapeHtml(text(row.email)),
            escapeHtml(cotizacionEstadoLabel(text(row.estado) || 'nueva')),
            escapeHtml(moneda),
            escapeHtml(total),
            row.oferta_enviada_at ? formatCell(row.oferta_enviada_at) : '—',
            [
              `<a class="admin-button admin-button--ghost" href="#/cotizacion?id=${escapeHtml(text(row.id))}">Ver</a>`,
              row.leida === false
                ? `<button class="admin-button admin-button--ghost" data-table="solicitudes_cotizacion" data-mark-read="${escapeHtml(text(row.id))}" type="button">Marcar leida</button>`
                : '',
            ]
              .filter(Boolean)
              .join(' '),
          ];
        })
      )}
    </section>`;
}

function cotizacionLineasEditorHtml(
  productos: unknown[],
  monedaDefault = 'COP',
  readOnly = false
): string {
  const lineas = Array.isArray(productos) ? productos : [];
  const monedaCabecera = monedaDefault === 'USD' ? 'USD' : 'COP';
  const priceStep = monedaCabecera === 'USD' ? '0.01' : '1';
  const disabled = readOnly ? 'disabled' : '';
  const catalogTools = readOnly
    ? ''
    : `
    <div class="cotizacion-catalog-tools" data-cotizacion-catalog-tools style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">
      <label class="admin-field" style="position:relative;min-width:280px;max-width:420px;margin:0">
        <span>Buscar en catálogo</span>
        <input type="search" data-cotizacion-catalog-search autocomplete="off" placeholder="Mínimo 2 caracteres" />
        <ul data-cotizacion-catalog-suggest hidden class="quote-ingest-suggest"></ul>
      </label>
      <button class="admin-button admin-button--ghost" type="button" data-cotizacion-ingest-pdf>Importar ficha PDF → producto</button>
      <input type="file" accept="application/pdf,.pdf" data-cotizacion-ingest-file hidden />
    </div>`;
  const rows = lineas.map(raw => {
    const item = raw && typeof raw === 'object' ? (raw as Row) : {};
    const slug = text(item.slug);
    const nombre = text(item.nombre) || slug;
    const cantidad = Number(item.cantidad ?? 1) || 1;
    const precio = Number(item.precio_unitario ?? 0) || 0;
    const moneda = monedaCabecera;
    return `
      <tr data-cotizacion-linea>
        <td>
          <input class="admin-inline-input" type="text" data-linea-nombre value="${escapeHtml(nombre)}" placeholder="Nombre del producto" aria-label="Nombre del producto" required ${disabled} />
          <input class="admin-inline-input" type="text" data-linea-slug value="${escapeHtml(slug)}" placeholder="SKU o referencia (opcional)" aria-label="SKU o referencia" ${disabled} />
          <input type="hidden" data-linea-moneda value="${escapeHtml(moneda)}" />
        </td>
        <td><input class="admin-inline-input" type="number" min="1" step="1" data-linea-cantidad value="${cantidad}" ${disabled} /></td>
        <td><input class="admin-inline-input" type="number" min="0" step="${priceStep}" data-linea-precio value="${precio}" ${disabled} /></td>
        <td data-linea-subtotal>${crmMoney(precio * cantidad, moneda)}</td>
        <td><button class="admin-button admin-button--ghost" type="button" data-linea-eliminar aria-label="Eliminar ${escapeHtml(nombre || 'producto')}" ${disabled}>Eliminar</button></td>
      </tr>`;
  });
  return `
    ${catalogTools}
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Producto / referencia</th><th>Cantidad</th><th>Precio unitario (${escapeHtml(monedaCabecera)})</th><th>Subtotal</th><th>Acciones</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
    <button class="admin-button admin-button--ghost" type="button" data-cotizacion-linea-agregar ${disabled}>Añadir producto</button>
    <p class="admin-meta" style="margin-top:8px">Total ofertado: <strong data-cotizacion-total-ofertado>—</strong></p>`;
}

function cotizacionLineaFromOfertaHtml(line: CotizacionLineaOferta, moneda: 'COP' | 'USD'): string {
  const step = moneda === 'USD' ? '0.01' : '1';
  const cantidad = Math.max(1, line.cantidad || 1);
  const precio = line.precio_pendiente_validar ? 0 : Number(line.precio_unitario) || 0;
  const subtotal = line.precio_pendiente_validar ? 0 : line.subtotal || precio * cantidad;
  return `<tr data-cotizacion-linea>
    <td>
      <input class="admin-inline-input" type="text" data-linea-nombre value="${escapeHtml(line.nombre)}" placeholder="Nombre del producto" aria-label="Nombre del producto" required />
      <input class="admin-inline-input" type="text" data-linea-slug value="${escapeHtml(line.slug)}" placeholder="SKU o referencia (opcional)" aria-label="SKU o referencia" />
      <input type="hidden" data-linea-moneda value="${escapeHtml(moneda)}" />
    </td>
    <td><input class="admin-inline-input" type="number" min="1" step="1" data-linea-cantidad value="${cantidad}" aria-label="Cantidad" /></td>
    <td><input class="admin-inline-input" type="number" min="0" step="${step}" data-linea-precio value="${precio}" aria-label="Precio unitario" /></td>
    <td data-linea-subtotal>${crmMoney(subtotal, moneda)}</td>
    <td><button class="admin-button admin-button--ghost" type="button" data-linea-eliminar aria-label="Eliminar ${escapeHtml(line.nombre || 'producto')}">Eliminar</button></td>
  </tr>`;
}

function cotizacionLineaNuevaHtml(moneda: 'COP' | 'USD'): string {
  const step = moneda === 'USD' ? '0.01' : '1';
  return `<tr data-cotizacion-linea>
    <td>
      <input class="admin-inline-input" type="text" data-linea-nombre value="" placeholder="Nombre del producto" aria-label="Nombre del producto" required />
      <input class="admin-inline-input" type="text" data-linea-slug value="" placeholder="SKU o referencia (opcional)" aria-label="SKU o referencia" />
      <input type="hidden" data-linea-moneda value="${moneda}" />
    </td>
    <td><input class="admin-inline-input" type="number" min="1" step="1" data-linea-cantidad value="1" aria-label="Cantidad" /></td>
    <td><input class="admin-inline-input" type="number" min="0" step="${step}" data-linea-precio value="0" aria-label="Precio unitario" /></td>
    <td data-linea-subtotal>${crmMoney(0, moneda)}</td>
    <td><button class="admin-button admin-button--ghost" type="button" data-linea-eliminar aria-label="Eliminar producto">Eliminar</button></td>
  </tr>`;
}

function normalizarMonedaCotizacion(value: unknown): 'COP' | 'USD' {
  return String(value ?? 'COP')
    .trim()
    .toUpperCase() === 'USD'
    ? 'USD'
    : 'COP';
}

function aplicarMonedaOfertaDom(moneda: 'COP' | 'USD') {
  const step = moneda === 'USD' ? '0.01' : '1';
  app.querySelectorAll<HTMLInputElement>('[data-linea-moneda]').forEach(input => {
    input.value = moneda;
  });
  app.querySelectorAll<HTMLInputElement>('[data-linea-precio]').forEach(input => {
    input.step = step;
  });
  const head = app.querySelector('.admin-table thead th:nth-child(3)');
  if (head) head.textContent = `Precio unitario (${moneda})`;
  syncCotizacionTotalesDom();
}

async function cotizacionDetailView(): Promise<string> {
  const row = state.recordId ? await getRow('solicitudes_cotizacion', state.recordId) : null;
  if (!row) return notFoundPanel('Cotizacion no encontrada', '#/cotizaciones');
  const productos = Array.isArray(row.productos) ? row.productos : [];
  const adjuntos = Array.isArray(row.adjuntos) ? row.adjuntos : [];
  const notasInternas = parseNotasInternas(text(row.notas_internas));
  const resumen = cotizacionResumenTexto(row);
  const estado = text(row.estado) || 'nueva';
  const convertida = estado === 'convertida' || Boolean(row.pedido_id);
  const moneda = normalizarMonedaCotizacion(row.moneda);
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <div>
          <h2>Presupuesto de ${escapeHtml(text(row.nombre))}</h2>
          <p class="admin-meta">${escapeHtml(text(row.empresa) || 'Sin empresa')} · ${escapeHtml(
            text(row.email)
          )} · ${escapeHtml(cotizacionEstadoLabel(estado))} · ${escapeHtml(moneda)}</p>
        </div>
        <div class="admin-toolbar">
          ${
            row.leida === false
              ? `<button class="admin-button admin-button--ghost" data-table="solicitudes_cotizacion" data-mark-read="${escapeHtml(text(row.id))}" type="button">Marcar leida</button>`
              : '<span class="admin-badge admin-badge--ok">Leida</span>'
          }
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-copy-summary>Copiar resumen</button>
          <a class="admin-button admin-button--ghost" href="mailto:${escapeHtml(text(row.email))}">Responder email</a>
          <a class="admin-button admin-button--ghost" href="#/cotizaciones">Volver</a>
        </div>
      </div>
      <div class="cotizacion-workflow">
        <div class="cotizacion-workflow__summary" data-cotizacion-summary hidden>${escapeHtml(resumen)}</div>
        <div class="cotizacion-workflow__chips">
          ${
            text(row.numero)
              ? `<span class="admin-badge admin-badge--info">${escapeHtml(text(row.numero))}</span>`
              : ''
          }
          <span class="admin-badge admin-badge--info">${escapeHtml(text(row.empresa) || 'Sin empresa')}</span>
          <span class="admin-badge">${escapeHtml(text(row.created_at))}</span>
          <span class="admin-badge ${row.leida ? 'admin-badge--ok' : 'admin-badge--warn'}">${row.leida ? 'Leida' : 'Sin leer'}</span>
          ${
            row.oferta_enviada_at
              ? `<span class="admin-badge admin-badge--ok">Enviada ${escapeHtml(formatCell(row.oferta_enviada_at))}</span>`
              : ''
          }
          ${
            row.pedido_id
              ? `<a class="admin-badge admin-badge--ok" href="#/pedido?id=${escapeHtml(text(row.pedido_id))}">Pedido vinculado</a>`
              : ''
          }
        </div>
        <div class="admin-toolbar cotizacion-workflow__actions">
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-quick-estado="nueva" ${convertida ? 'disabled' : ''}>Volver a nueva</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-quick-estado="en_revision" ${convertida ? 'disabled' : ''}>Enviar a revision</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-quick-estado="respondida" ${convertida ? 'disabled' : ''}>Marcar respondida</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-preview ${convertida ? 'disabled' : ''}>Vista previa PDF</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-enviar-whatsapp ${convertida ? 'disabled' : ''}>WhatsApp</button>
          <button class="admin-button" type="button" data-cotizacion-enviar ${convertida ? 'disabled' : ''}>Enviar email</button>
        </div>
      </div>
      <div style="padding:0 16px 16px">
        <h3>Oferta comercial</h3>
        ${
          text(row.send_error)
            ? `<p class="admin-help">Ultimo error de envio: ${escapeHtml(text(row.send_error))}</p>`
            : ''
        }
        <p class="admin-help">Edita los datos de la solicitud, los productos, precios y condiciones. La oferta guardada es la que recibirá el cliente al formalizar.</p>
        <form class="admin-form" data-cotizacion-oferta-form>
          <input type="hidden" name="id" value="${escapeHtml(text(row.id))}" />
          <div class="admin-editor__cols">
            <label class="admin-field"><span>Nombre del contacto</span>
              <input name="nombre" type="text" value="${escapeHtml(text(row.nombre))}" autocomplete="name" ${convertida ? 'disabled' : ''} />
            </label>
            <label class="admin-field"><span>Empresa</span>
              <input name="empresa" type="text" value="${escapeHtml(text(row.empresa))}" autocomplete="organization" ${convertida ? 'disabled' : ''} />
            </label>
            <label class="admin-field"><span>Email</span>
              <input name="email" type="email" value="${escapeHtml(text(row.email))}" autocomplete="email" ${convertida ? 'disabled' : ''} />
            </label>
            <label class="admin-field"><span>Teléfono</span>
              <input name="telefono" type="tel" value="${escapeHtml(text(row.telefono))}" autocomplete="tel" ${convertida ? 'disabled' : ''} />
            </label>
            <label class="admin-field"><span>NIT / identificación fiscal</span>
              <input name="nit" type="text" value="${escapeHtml(text(row.nit))}" ${convertida ? 'disabled' : ''} />
            </label>
            <label class="admin-field"><span>IVA</span>
              <label class="admin-check"><input name="responsable_iva" type="checkbox" ${row.responsable_iva ? 'checked' : ''} ${convertida ? 'disabled' : ''} /> Responsable de IVA</label>
            </label>
            <label class="admin-field"><span>Tratamiento tributario de la oferta</span>
              <label class="admin-check"><input name="impuestos_incluidos" type="checkbox" ${row.impuestos_incluidos ? 'checked' : ''} ${convertida ? 'disabled' : ''} /> Los precios ofrecidos ya incluyen IVA cuando aplica</label>
            </label>
            <label class="admin-field"><span>Moneda de la oferta</span>
              <select name="moneda" data-cotizacion-moneda ${convertida ? 'disabled' : ''}>
                <option value="COP" ${moneda === 'COP' ? 'selected' : ''}>COP — Pesos colombianos</option>
                <option value="USD" ${moneda === 'USD' ? 'selected' : ''}>USD — Dolares</option>
              </select>
            </label>
            <label class="admin-field"><span>Validez hasta</span>
              <input name="validez_hasta" type="date" value="${escapeHtml(text(row.validez_hasta).slice(0, 10))}" ${convertida ? 'disabled' : ''} />
            </label>
          </div>
          ${cotizacionLineasEditorHtml(productos, moneda, convertida)}
          <label class="admin-field" style="margin-top:12px"><span>Mensaje o necesidad del solicitante</span>
            <textarea name="mensaje" rows="4" placeholder="Necesidad, especificaciones o contexto" ${convertida ? 'disabled' : ''}>${escapeHtml(text(row.mensaje))}</textarea>
          </label>
          <div class="admin-editor__cols">
            <label class="admin-field"><span>Dirección postal de envío</span>
              <textarea name="direccion_envio" rows="3" ${convertida ? 'disabled' : ''}>${escapeHtml(text(row.direccion_envio))}</textarea>
            </label>
            <label class="admin-field"><span>Dirección de facturación</span>
              <textarea name="direccion_facturacion" rows="3" ${convertida ? 'disabled' : ''}>${escapeHtml(text(row.direccion_facturacion))}</textarea>
            </label>
          </div>
          <label class="admin-field" style="margin-top:12px"><span>Adjuntos para el correo al cliente (PDF, Office o imagen; máx. 25 MB en total)</span>
            <input type="file" data-cotizacion-adjuntos multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp" ${convertida ? 'disabled' : ''} />
            <span class="admin-help" data-cotizacion-adjuntos-estado>${
              adjuntos.length
                ? `Adjuntos guardados: ${escapeHtml(
                    adjuntos
                      .map(item => text((item as Row).nombre))
                      .filter(Boolean)
                      .join(', ')
                  )}`
                : 'Sin adjuntos.'
            }</span>
            <input type="hidden" data-cotizacion-adjuntos-actuales value="${escapeHtml(JSON.stringify(adjuntos))}" />
          </label>
          <label class="admin-field" style="margin-top:12px"><span>Observaciones / condiciones de configuracion</span>
            <textarea name="condiciones" rows="5" placeholder="Configuracion especifica, plazo de entrega, forma de pago, validez, exclusiones..." ${convertida ? 'disabled' : ''}>${escapeHtml(
              text(row.condiciones)
            )}</textarea>
          </label>
          ${convertida ? '' : '<button class="admin-button" type="submit">Guardar oferta</button>'}
        </form>
      </div>
      <div style="padding:0 16px 16px">
        <h3>Mensaje del solicitante</h3>
        <p class="admin-help">${escapeHtml(text(row.mensaje)) || 'Sin mensaje.'}</p>
      </div>
      <div style="padding:0 16px 16px">
        <h3>Historial interno</h3>
        ${
          notasInternas.length === 0
            ? '<p class="admin-help">Sin historial interno. Usa los botones rápidos o las notas para registrar seguimiento.</p>'
            : `<div class="cotizacion-feed">${notasInternas
                .slice()
                .reverse()
                .map(
                  linea => `<article class="cotizacion-feed__item">${escapeHtml(linea)}</article>`
                )
                .join('')}</div>`
        }
      </div>
      <div style="padding:0 16px 16px">
        <h3>Notas internas</h3>
        <div class="admin-toolbar cotizacion-nota-templates">
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-nota-template="Cliente contactado. Se comparte avance comercial y siguiente paso.">Contactado</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-nota-template="Cotizacion revisada. Falta confirmar volumen o especificaciones finales.">En revisión</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-nota-template="Cotizacion respondida. Enviar seguimiento en 24-48 horas.">Respondida</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-nota-template="Cotizacion escalada a equipo tecnico/comercial para validacion.">Escalar</button>
        </div>
        <form class="admin-form" data-cotizacion-estado-form style="margin-top:12px">
          <input type="hidden" name="id" value="${escapeHtml(text(row.id))}" />
          <div class="admin-editor__cols">
            ${selectStatic('estado', 'Estado', estado, COTIZACION_ESTADOS)}
          </div>
          <textarea name="notas_internas" rows="4" placeholder="Notas internas" data-cotizacion-nota-input>${escapeHtml(
            text(row.notas_internas)
          )}</textarea>
          <button class="admin-button" type="submit">Guardar seguimiento</button>
        </form>
      </div>
      <div style="padding:0 16px 16px">
        <h3>Consentimiento de datos</h3>
        <p class="admin-help">${
          row.consentimiento_datos
            ? `Aceptado el ${formatCell(row.consentimiento_timestamp)}`
            : 'No aceptado / no registrado'
        }</p>
      </div>
      <div data-cotizacion-modal-slot></div>
    </section>`;
}

async function clientesView(): Promise<string> {
  const params = hashParams();
  const q = (params.get('q') ?? '').trim();
  const tipo = params.get('tipo_cliente') ?? '';
  let query = supabase!
    .from('clientes')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '');
    if (safeQ)
      query = query.or(
        `email.ilike.%${safeQ}%,nombre.ilike.%${safeQ}%,apellido.ilike.%${safeQ}%,institucion.ilike.%${safeQ}%`
      );
  }
  if (tipo) query = query.eq('tipo_cliente', tipo);
  const { data, error } = await query;
  if (error) toast(error.message);
  const rows = (data ?? []) as unknown as Row[];
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Clientes (${rows.length})</h2>
        <div class="admin-toolbar">
          <button class="admin-button" data-new-cliente type="button">Nuevo cliente</button>
          <button class="admin-button admin-button--ghost" type="button" data-entity-export-xlsx="clientes">Exportar Excel</button>
          <button class="admin-button admin-button--ghost" type="button" data-entity-template-xlsx="clientes">Plantilla Excel</button>
        </div>
      </div>
      <form class="admin-filters" data-clientes-filter>
        ${field('q', 'Buscar cliente', q, false, 'search')}
        ${selectStatic('tipo_cliente', 'Tipo', tipo, [
          ['', 'Todos'],
          ['b2b', 'B2B'],
          ['b2c', 'B2C'],
          ['mixto', 'Mixto'],
        ])}
        <button class="admin-button" type="submit">Filtrar</button>
        <a class="admin-button admin-button--ghost" href="#/clientes">Limpiar</a>
      </form>
      ${entityImportForm('clientes', 'clientes', 'Upsert por email. No incluyas columnas de métricas si no quieres sobrescribirlas.')}
      ${table(
        ['Cliente', 'Email', 'Telefono', 'Tipo', 'Pedidos', 'Total gastado', 'Acciones'],
        rows.map(row => [
          [text(row.nombre), text(row.apellido)].filter(Boolean).join(' ') ||
            text(row.institucion) ||
            '—',
          text(row.email),
          text(row.telefono),
          text(row.tipo_cliente).toUpperCase(),
          text(row.total_pedidos),
          `${text(row.total_gastado)} COP`,
          `<a class="admin-button admin-button--ghost" href="#/cliente?id=${encodeURIComponent(text(row.id))}">Ver</a>`,
        ])
      )}
    </section>`;
}

async function clienteDetailView(): Promise<string> {
  const cliente = state.recordId ? await getRow('clientes', state.recordId) : null;
  const [direcciones, pedidos, cotizaciones] = cliente
    ? await Promise.all([
        selectRowsWhere(
          'cliente_direcciones',
          '*',
          'created_at',
          { cliente_id: text(cliente.id) },
          50,
          false
        ),
        selectRowsWhere('pedidos', '*', 'created_at', { cliente_id: text(cliente.id) }, 50, false),
        selectRowsWhere(
          'solicitudes_cotizacion',
          '*',
          'created_at',
          { email: text(cliente.email) },
          50,
          false
        ),
      ])
    : [[], [], []];

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>${cliente ? 'Ficha de cliente' : 'Nuevo cliente'}</h2>
        <a class="admin-button admin-button--ghost" href="#/clientes">Volver</a>
      </div>
      <form class="admin-form" data-cliente-form style="padding:16px">
        <input type="hidden" name="id" value="${escapeHtml(text(cliente?.id))}" />
        <div class="admin-editor__cols">
          ${field('email', 'Email', text(cliente?.email), true, 'email')}
          ${selectStatic('tipo_cliente', 'Tipo cliente', text(cliente?.tipo_cliente) || 'b2b', [
            ['b2b', 'B2B'],
            ['b2c', 'B2C'],
            ['mixto', 'Mixto'],
          ])}
          ${field('nombre', 'Nombre', text(cliente?.nombre))}
          ${field('apellido', 'Apellido', text(cliente?.apellido))}
          ${field('telefono', 'Telefono', text(cliente?.telefono))}
          ${field('institucion', 'Institucion / empresa', text(cliente?.institucion))}
          ${field('documento_tipo', 'Tipo documento (legado)', text(cliente?.documento_tipo))}
          ${field('documento_numero', 'Numero documento (legado)', text(cliente?.documento_numero))}
        </div>
        <h3 style="margin:16px 0 8px">Datos fiscales DIAN</h3>
        <p class="admin-help">Estos campos alimentan Siigo/DIAN. NIT sin espacios (ej. 9014419082).</p>
        <div class="admin-editor__cols">
          ${selectStatic(
            'tipo_documento',
            'Tipo documento FE',
            text(cliente?.tipo_documento) || '',
            [
              ['', '—'],
              ['NIT', 'NIT'],
              ['CC', 'CC'],
              ['CE', 'CE'],
              ['PP', 'Pasaporte'],
              ['OTRO', 'Otro'],
            ]
          )}
          ${field('numero_documento', 'Numero documento FE', text(cliente?.numero_documento))}
        </div>
        <div class="admin-toolbar" style="margin:0 0 12px">
          <button class="admin-button admin-button--ghost" type="button" data-nit-verificar="cliente">
            Verificar NIT
          </button>
          <button class="admin-button admin-button--ghost" type="button" data-nit-importar-dian="cliente">
            Importar datos DIAN
          </button>
          <span class="admin-meta" data-nit-status="cliente"></span>
        </div>
        <div class="admin-editor__cols">
          ${selectStatic('tipo_persona', 'Tipo persona', text(cliente?.tipo_persona) || '', [
            ['', '—'],
            ['natural', 'Natural'],
            ['juridica', 'Juridica'],
          ])}
          ${field('razon_social', 'Razon social', text(cliente?.razon_social))}
          ${field('email_facturacion', 'Email facturacion', text(cliente?.email_facturacion), false, 'email')}
          ${field('dir_fact_direccion', 'Direccion facturacion', text((cliente?.direccion_facturacion as Row | null)?.direccion))}
          ${field('dir_fact_ciudad', 'Ciudad', text((cliente?.direccion_facturacion as Row | null)?.ciudad))}
          ${field('dir_fact_departamento', 'Departamento', text((cliente?.direccion_facturacion as Row | null)?.departamento))}
        </div>
        ${checkbox('responsable_iva', 'Responsable de IVA', Boolean(cliente?.responsable_iva))}
        ${checkbox('agente_retencion', 'Agente de retencion', Boolean(cliente?.agente_retencion))}
        ${checkbox('agente_reteica', 'Agente reteICA', Boolean(cliente?.agente_reteica))}
        ${textarea('notas', 'Notas internas', text(cliente?.notas))}
        ${checkbox('consentimiento_datos', 'Consentimiento datos registrado', Boolean(cliente?.consentimiento_datos))}
        <button class="admin-button" type="submit">Guardar cliente</button>
      </form>
    </section>
    ${
      cliente
        ? `
      <section class="admin-panel">
        <div class="admin-panel__head"><h2>Direcciones</h2></div>
        ${table(
          ['Tipo', 'Nombre', 'Ciudad', 'Direccion', 'Principal'],
          direcciones.map(row => [
            text(row.tipo),
            text(row.nombre),
            [text(row.ciudad), text(row.departamento), text(row.pais)].filter(Boolean).join(', '),
            text(row.direccion),
            formatCell(row.principal),
          ])
        )}
        <form class="admin-form" data-direccion-form style="padding:16px">
          <input type="hidden" name="cliente_id" value="${escapeHtml(text(cliente.id))}" />
          <div class="admin-editor__cols">
            ${selectStatic('tipo', 'Tipo', 'facturacion', [
              ['facturacion', 'Facturacion'],
              ['envio', 'Envio'],
              ['legal', 'Legal'],
            ])}
            ${field('nombre', 'Nombre contacto')}
            ${field('telefono', 'Telefono')}
            ${field('pais', 'Pais', 'CO')}
            ${field('departamento', 'Departamento')}
            ${field('ciudad', 'Ciudad')}
            ${field('direccion', 'Direccion', '', true)}
            ${field('codigo_postal', 'Codigo postal')}
          </div>
          ${checkbox('principal', 'Principal', false)}
          <button class="admin-button" type="submit">Agregar direccion</button>
        </form>
      </section>
      <section class="admin-panel">
        <div class="admin-panel__head"><h2>Actividad comercial</h2></div>
        ${table(
          ['Fecha', 'Tipo', 'Estado', 'Total', 'Acciones'],
          [
            ...pedidos.map(row => [
              formatCell(row.created_at),
              'Pedido',
              formatCell(row.estado),
              `${text(row.total)} ${text(row.moneda)}`,
              `<a class="admin-button admin-button--ghost" href="#/pedido?id=${encodeURIComponent(text(row.id))}">Ver</a>`,
            ]),
            ...cotizaciones.map(row => [
              formatCell(row.created_at),
              'Cotizacion',
              formatCell(row.estado),
              '—',
              `<a class="admin-button admin-button--ghost" href="#/cotizacion?id=${encodeURIComponent(text(row.id))}">Ver</a>`,
            ]),
          ]
        )}
      </section>`
        : ''
    }`;
}

const PEDIDO_ESTADOS: Array<[string, string]> = [
  ['pendiente', 'Pendiente'],
  ['pendiente_validacion', 'Pendiente validacion transferencia'],
  ['pagado', 'Pagado'],
  ['procesando', 'Procesando'],
  ['preparando', 'Preparando'],
  ['enviado', 'Enviado'],
  ['entregado', 'Entregado'],
  ['retrasado', 'Retrasado (rotura de stock post-pago)'],
  ['rechazado', 'Rechazado'],
  ['expirado', 'Expirado'],
  ['cancelado', 'Cancelado'],
  ['reembolsado', 'Reembolsado'],
  ['error_verificacion', 'Error de verificacion'],
];

function pedidoEstadoLabel(estado: string): string {
  return PEDIDO_ESTADOS.find(([value]) => value === estado)?.[1] ?? estado;
}

function pedidoResumenTexto(row: Row): string {
  const referencia = text(row.referencia_pasarela) || text(row.id).slice(0, 8);
  const cliente = row.cliente && typeof row.cliente === 'object' ? (row.cliente as Row) : {};
  const clienteLabel =
    [text(cliente.nombre), text(cliente.apellido)].filter(Boolean).join(' ') ||
    text(cliente.institucion) ||
    text(cliente.email) ||
    'Cliente sin nombre';
  const total = `${text(row.total)} ${text(row.moneda)}`.trim();
  return [
    `Pedido ${referencia}`,
    `Estado: ${pedidoEstadoLabel(text(row.estado))}`,
    `Total: ${total}`,
    `Cliente: ${clienteLabel}`,
    `Mercado: ${text(row.mercado)}`,
  ].join(' | ');
}

const FACTURA_ESTADOS: Array<[string, string]> = [
  ['', 'Todos'],
  ['pendiente_pago', 'Pendiente pago'],
  ['pendiente_envio', 'Pendiente envio'],
  ['emitida', 'Emitida'],
  ['rechazada', 'Rechazada'],
  ['error', 'Error'],
  ['anulada', 'Anulada'],
];

async function facturasView(): Promise<string> {
  const params = hashParams();
  const q = (params.get('q') ?? '').trim();
  const estado = params.get('estado') ?? '';
  let query = supabase!
    .from('facturas_electronicas')
    .select(
      'id,pedido_id,estado,numero_factura,cufe,error,proveedor,created_at,updated_at,pedidos(id,referencia_pasarela,total,moneda,facturacion_electronica_estado,cliente,estado)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (estado) query = query.eq('estado', estado);
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '');
    if (safeQ) {
      query = query.or(
        `numero_factura.ilike.%${safeQ}%,cufe.ilike.%${safeQ}%,error.ilike.%${safeQ}%`
      );
    }
  }
  const { data, error, count } = await query;
  if (error) toast(error.message);
  const rows = (data ?? []) as Row[];
  const total = count ?? rows.length;

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Facturas electronicas (${total})</h2>
        <p class="admin-meta">Siigo / DIAN — corrige NIT en el pedido y reemite</p>
      </div>
      <form class="admin-filters" data-facturas-filter>
        ${field('q', 'Buscar numero / CUFE / error', q, false, 'search')}
        ${selectStatic('estado', 'Estado', estado, FACTURA_ESTADOS)}
        <button class="admin-button" type="submit">Filtrar</button>
      </form>
      ${table(
        ['Fecha', 'Pedido', 'Cliente', 'Estado', 'Numero', 'Error', 'Acciones'],
        rows.map(row => {
          const pedido = row.pedidos && typeof row.pedidos === 'object' ? (row.pedidos as Row) : {};
          const cliente =
            pedido.cliente && typeof pedido.cliente === 'object' ? (pedido.cliente as Row) : {};
          const clienteLabel =
            [text(cliente.nombre), text(cliente.apellido)].filter(Boolean).join(' ') ||
            text(cliente.institucion) ||
            text(cliente.email) ||
            '—';
          const ref = text(pedido.referencia_pasarela) || text(row.pedido_id).slice(0, 8);
          return [
            formatCell(row.created_at),
            escapeHtml(ref),
            escapeHtml(clienteLabel),
            escapeHtml(text(row.estado)),
            escapeHtml(text(row.numero_factura)) || '—',
            escapeHtml(text(row.error)).slice(0, 80) || '—',
            `<a class="admin-button admin-button--ghost" href="#/factura?id=${encodeURIComponent(text(row.id))}">Ver</a>
             <a class="admin-button admin-button--ghost" href="#/pedido?id=${encodeURIComponent(text(row.pedido_id))}">Pedido</a>`,
          ];
        })
      )}
    </section>`;
}

async function facturaDetailView(): Promise<string> {
  const id = state.recordId;
  if (!id) return notFoundPanel('Factura no encontrada', '#/facturas');
  const { data, error } = await supabase!
    .from('facturas_electronicas')
    .select(
      '*, pedidos(id,referencia_pasarela,total,moneda,estado,facturacion_electronica_estado,facturacion_electronica_solicitada,cliente,metadata,cliente_id)'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) return `<p class="admin-help">Error: ${escapeHtml(error.message)}</p>`;
  if (!data) return notFoundPanel('Factura no encontrada', '#/facturas');
  const row = data as Row;
  const pedido = row.pedidos && typeof row.pedidos === 'object' ? (row.pedidos as Row) : {};
  const meta =
    pedido.metadata && typeof pedido.metadata === 'object' ? (pedido.metadata as Row) : {};
  const draft =
    meta.dian_draft && typeof meta.dian_draft === 'object' ? (meta.dian_draft as Row) : {};
  const draftCliente =
    draft.cliente && typeof draft.cliente === 'object' ? (draft.cliente as Row) : {};

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <div>
          <h2>Factura ${escapeHtml(text(row.numero_factura) || text(row.id).slice(0, 8))}</h2>
          <p class="admin-meta">${escapeHtml(text(row.estado))} · ${escapeHtml(text(row.proveedor))}</p>
        </div>
        <div class="admin-toolbar">
          <a class="admin-button admin-button--ghost" href="#/facturas">Volver</a>
          <a class="admin-button" href="#/pedido?id=${encodeURIComponent(text(row.pedido_id))}">Abrir pedido / editar NIT</a>
          <button class="admin-button admin-button--ghost" type="button" data-factura-reemitir="${escapeHtml(text(row.pedido_id))}">
            Reemitir DIAN
          </button>
        </div>
      </div>
      <div style="padding:16px">
        ${table(
          ['Campo', 'Valor'],
          [
            ['Estado', escapeHtml(text(row.estado))],
            ['Numero', escapeHtml(text(row.numero_factura)) || '—'],
            ['CUFE', escapeHtml(text(row.cufe)) || '—'],
            ['Error', escapeHtml(text(row.error)) || '—'],
            [
              'Pedido total',
              `${escapeHtml(text(pedido.total))} ${escapeHtml(text(pedido.moneda))}`,
            ],
            ['Pedido estado', escapeHtml(text(pedido.estado))],
            ['NIT en borrador', escapeHtml(text(draftCliente.numero_documento)) || '—'],
            ['Razon social', escapeHtml(text(draftCliente.razon_social)) || '—'],
            ['Creada', formatCell(row.created_at)],
            ['Actualizada', formatCell(row.updated_at)],
          ]
        )}
      </div>
      <div style="padding:0 16px 16px">
        <h3>Payload / respuesta</h3>
        <pre class="admin-help" style="white-space:pre-wrap;max-height:320px;overflow:auto">${escapeHtml(
          JSON.stringify({ payload: row.payload, respuesta: row.respuesta }, null, 2)
        )}</pre>
      </div>
    </section>`;
}

async function pedidosView(): Promise<string> {
  const params = hashParams();
  const q = (params.get('q') ?? '').trim();
  const estado = params.get('estado') ?? '';
  const mercado = params.get('mercado') ?? '';
  const leida = params.get('leida') ?? '';
  let query = supabase!
    .from('pedidos')
    .select('id,created_at,cliente,total,moneda,mercado,estado,referencia_pasarela,leida', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .limit(200);
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '');
    if (safeQ) {
      query = query.or(
        `referencia_pasarela.ilike.%${safeQ}%,checkout_url.ilike.%${safeQ}%,moneda.ilike.%${safeQ}%`
      );
    }
  }
  if (estado) query = query.eq('estado', estado);
  if (mercado) query = query.eq('mercado', mercado);
  if (leida === '1') query = query.eq('leida', true);
  if (leida === '0') query = query.eq('leida', false);
  const { data, error, count } = await query;
  if (error) toast(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const csvPayload = escapeHtml(JSON.stringify(rows));
  const total = count ?? rows.length;

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Pedidos (${total})</h2>
        <div class="admin-toolbar">
          <button class="admin-button admin-button--ghost" type="button" data-pedidos-select-all>Seleccionar todo</button>
          <button class="admin-button admin-button--ghost" type="button" data-csv="${csvPayload}" data-filename="pedidos.csv">Exportar CSV</button>
          <button class="admin-button admin-button--ghost" type="button" data-entity-export-xlsx="pedidos">Exportar Excel</button>
          <button class="admin-button admin-button--ghost" type="button" data-entity-template-xlsx="pedidos">Plantilla Excel</button>
          <button class="admin-button" type="button" data-bulk-pedido-read>Marcar leidos</button>
          <button class="admin-button" type="button" data-bulk-pedido-estado="procesando">Procesar</button>
          <button class="admin-button" type="button" data-bulk-pedido-estado="enviado">Enviar</button>
        </div>
      </div>
      <form class="admin-filters" data-pedidos-filter>
        ${field('q', 'Buscar referencia', q, false, 'search')}
        ${selectStatic('estado', 'Estado', estado, [['', 'Todos'], ...PEDIDO_ESTADOS])}
        ${selectStatic('mercado', 'Mercado', mercado, [
          ['', 'Todos'],
          ['CO', 'CO'],
          ['INTL', 'INTL'],
        ])}
        ${selectStatic('leida', 'Leído', leida, [
          ['', 'Todos'],
          ['1', 'Sí'],
          ['0', 'No'],
        ])}
        <button class="admin-button" type="submit">Filtrar</button>
        <a class="admin-button admin-button--ghost" href="#/pedidos">Limpiar</a>
      </form>
      ${entityImportForm('pedidos', 'pedidos', 'Actualiza por id o referencia_pasarela. Las columnas JSON deben conservar JSON válido.')}
      <div class="admin-panel__head">
        <p class="admin-meta">Seleccionados: <strong data-pedidos-selected-count>0</strong></p>
        <span class="admin-help">Las acciones masivas actualizan estados y registran timeline interno por pedido.</span>
      </div>
      ${table(
        [
          'Sel',
          'Fecha',
          'Cliente',
          'Total',
          'Mercado',
          'Estado',
          'Leida',
          'Referencia',
          'Acciones',
        ],
        rows.map(row => {
          const cliente =
            row.cliente && typeof row.cliente === 'object' ? (row.cliente as Row) : {};
          const clienteLabel =
            [text(cliente.nombre), text(cliente.apellido)].filter(Boolean).join(' ') ||
            text(cliente.institucion) ||
            text(cliente.email) ||
            '—';
          return [
            `<input type="checkbox" data-pedido-select value="${escapeHtml(text(row.id))}" aria-label="Seleccionar pedido ${escapeHtml(text(row.referencia_pasarela) || text(row.id))}" />`,
            formatCell(row.created_at),
            clienteLabel,
            `${text(row.total)} ${text(row.moneda)}`,
            text(row.mercado),
            status(row.estado),
            formatCell(row.leida),
            escapeHtml(text(row.referencia_pasarela)) || '—',
            `<a class="admin-button admin-button--ghost" href="#/pedido?id=${encodeURIComponent(text(row.id))}">Ver</a>`,
          ];
        })
      )}
    </section>`;
}

async function pedidoDetailView(): Promise<string> {
  const row = state.recordId ? await getRow('pedidos', state.recordId) : null;
  if (!row) return notFoundPanel('Pedido no encontrado', '#/pedidos');
  const cliente = row.cliente && typeof row.cliente === 'object' ? (row.cliente as Row) : {};
  const items = Array.isArray(row.items) ? row.items : [];
  const clienteNombre =
    [text(cliente.nombre), text(cliente.apellido)].filter(Boolean).join(' ') ||
    text(cliente.institucion) ||
    text(cliente.email) ||
    'Cliente sin nombre';
  const clienteEmail = text(cliente.email);
  const referenciaPedido = text(row.referencia_pasarela) || text(row.id).slice(0, 8);
  const resumenPedido = pedidoResumenTexto(row);

  const referencia = text(row.referencia_pasarela);
  const [
    eventosResult,
    fulfillmentsResult,
    notasResult,
    timelineResult,
    facturaResult,
    reembolsosResult,
  ] = await Promise.all([
    referencia
      ? supabase!
          .from('eventos_pago')
          .select('*')
          .eq('referencia_pasarela', referencia)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Row[] }),
    supabase!
      .from('fulfillments')
      .select('*, proveedores(nombre)')
      .eq('pedido_id', text(row.id))
      .order('created_at', { ascending: false }),
    supabase!
      .from('pedido_notas')
      .select('*')
      .eq('pedido_id', text(row.id))
      .order('created_at', { ascending: false }),
    supabase!
      .from('pedido_eventos')
      .select('*')
      .eq('pedido_id', text(row.id))
      .order('created_at', { ascending: false }),
    supabase!.from('facturas_electronicas').select('*').eq('pedido_id', text(row.id)).maybeSingle(),
    supabase!
      .from('reembolsos')
      .select('*')
      .eq('pedido_id', text(row.id))
      .order('created_at', { ascending: false }),
  ]);
  const eventos = (eventosResult.data ?? []) as Row[];
  const reembolsos = (reembolsosResult.data ?? []) as Row[];
  const fulfillments = (fulfillmentsResult.data ?? []) as Row[];
  const notas = (notasResult.data ?? []) as Row[];
  const timeline = (timelineResult.data ?? []) as Row[];
  const factura = (facturaResult.data ?? null) as Row | null;
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Row)
      : {};
  const fiscalMeta =
    metadata.fiscal && typeof metadata.fiscal === 'object' ? (metadata.fiscal as Row) : {};
  const draftMeta =
    metadata.dian_draft && typeof metadata.dian_draft === 'object'
      ? (metadata.dian_draft as Row)
      : {};
  const draftCliente =
    draftMeta.cliente && typeof draftMeta.cliente === 'object' ? (draftMeta.cliente as Row) : {};
  const draftDir =
    draftCliente.direccion && typeof draftCliente.direccion === 'object'
      ? (draftCliente.direccion as Row)
      : {};
  const fiscalDir =
    fiscalMeta.direccion_facturacion && typeof fiscalMeta.direccion_facturacion === 'object'
      ? (fiscalMeta.direccion_facturacion as Row)
      : {};
  const fiscalTipoDoc =
    text(fiscalMeta.tipo_documento) || text(draftCliente.tipo_documento) || 'NIT';
  const fiscalNumero =
    text(fiscalMeta.numero_documento) || text(draftCliente.numero_documento) || '';
  const fiscalPersona =
    text(fiscalMeta.tipo_persona) || text(draftCliente.tipo_persona) || 'juridica';
  const fiscalRazon =
    text(fiscalMeta.razon_social) ||
    text(draftCliente.razon_social) ||
    text(cliente.institucion) ||
    '';
  const fiscalEmail =
    text(fiscalMeta.email_facturacion) || text(draftCliente.email) || text(cliente.email) || '';
  const fiscalDireccion = text(fiscalDir.direccion) || text(draftDir.direccion) || '';
  const fiscalCiudad = text(fiscalDir.ciudad) || text(draftDir.ciudad) || '';
  const fiscalDepto = text(fiscalDir.departamento) || text(draftDir.departamento) || '';
  const fiscalResponsableIva =
    fiscalMeta.responsable_iva === true || draftCliente.responsable_iva === true;
  const feed = [
    ...timeline.map(evento => ({
      kind: 'timeline',
      createdAt: text(evento.created_at),
      title: `${pedidoEstadoLabel(text(evento.de_estado))} → ${pedidoEstadoLabel(text(evento.a_estado))}`,
      meta: [text(evento.tipo), text(evento.actor_email)].filter(Boolean).join(' · '),
      body:
        evento.metadata && typeof evento.metadata === 'object'
          ? JSON.stringify(evento.metadata)
          : 'Cambio de estado registrado desde el panel.',
      badge: 'Estado',
    })),
    ...notas.map(nota => ({
      kind: 'nota',
      createdAt: text(nota.created_at),
      title:
        text(nota.tipo) === 'cliente'
          ? 'Nota para cliente'
          : text(nota.tipo) === 'sistema'
            ? 'Nota de sistema'
            : 'Nota interna',
      meta: [text(nota.autor_email), text(nota.tipo)].filter(Boolean).join(' · '),
      body: text(nota.nota),
      badge: 'Nota',
    })),
    ...eventos.map(evento => ({
      kind: 'pago',
      createdAt: text(evento.created_at),
      title: `${text(evento.proveedor_pago)} · ${text(evento.event_id)}`,
      meta: formatCell(evento.procesado),
      body: text(evento.referencia_pasarela)
        ? `Referencia ${text(evento.referencia_pasarela)}`
        : 'Evento de pago recibido.',
      badge: 'Pago',
    })),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <div>
          <h2>Pedido ${escapeHtml(referenciaPedido)}</h2>
          <p class="admin-meta">${escapeHtml(clienteNombre)} · ${escapeHtml(text(row.mercado))} · ${escapeHtml(
            pedidoEstadoLabel(text(row.estado))
          )}</p>
        </div>
        <div class="admin-toolbar">
          ${
            row.leida === false
              ? `<button class="admin-button admin-button--ghost" data-table="pedidos" data-mark-read="${escapeHtml(text(row.id))}" type="button">Marcar leida</button>`
              : '<span class="admin-badge admin-badge--ok">Leida</span>'
          }
          <button class="admin-button admin-button--ghost" type="button" data-pedido-copy-summary>Copiar resumen</button>
          ${
            text(row.checkout_url)
              ? `<a class="admin-button admin-button--ghost" href="${escapeHtml(text(row.checkout_url))}" target="_blank" rel="noopener noreferrer">Abrir checkout</a>`
              : ''
          }
          ${
            clienteEmail
              ? `<a class="admin-button admin-button--ghost" href="mailto:${escapeHtml(clienteEmail)}">Escribir al cliente</a>`
              : ''
          }
          <a class="admin-button admin-button--ghost" href="#/pedidos">Volver</a>
        </div>
      </div>
      <div class="admin-panel__body">
        <div class="pedido-workflow">
          <div class="pedido-workflow__summary" data-pedido-summary hidden>${escapeHtml(resumenPedido)}</div>
          <div class="pedido-workflow__meta">
            <span class="admin-badge admin-badge--info">${escapeHtml(text(row.proveedor_pago))}</span>
            <span class="admin-badge">${escapeHtml(text(row.mercado))}</span>
            <span class="admin-badge ${row.leida ? 'admin-badge--ok' : 'admin-badge--warn'}">${
              row.leida ? 'Leida' : 'Sin leer'
            }</span>
          </div>
          <div class="admin-toolbar pedido-workflow__actions">
            ${
              text(row.proveedor_pago) === 'transferencia' &&
              text(row.estado) === 'pendiente_validacion'
                ? `<button class="admin-button" type="button" data-pedido-validar-transferencia="${escapeHtml(text(row.id))}">Validar transferencia</button>
                   <button class="admin-button admin-button--danger" type="button" data-pedido-rechazar-transferencia="${escapeHtml(text(row.id))}">Rechazar comprobante</button>`
                : ''
            }
            <button class="admin-button admin-button--ghost" type="button" data-pedido-quick-estado="procesando">Procesar</button>
            <button class="admin-button admin-button--ghost" type="button" data-pedido-quick-estado="preparando">Preparar</button>
            <button class="admin-button admin-button--ghost" type="button" data-pedido-quick-estado="enviado">Enviar</button>
            <button class="admin-button admin-button--ghost" type="button" data-pedido-quick-estado="entregado">Entregar</button>
            <button class="admin-button admin-button--ghost" type="button" data-pedido-quick-estado="retrasado">Marcar retrasado</button>
            <button class="admin-button admin-button--danger" type="button" data-pedido-quick-estado="cancelado">Cancelar</button>
            <button class="admin-button admin-button--danger" type="button" data-pedido-quick-estado="reembolsado">Reembolsar</button>
          </div>
        </div>
        <div style="padding:16px 16px 0">
          <h3>Resumen operativo</h3>
        </div>
        <div style="padding:16px">
        ${table(
          ['Campo', 'Valor'],
          [
            ['Fecha', formatCell(row.created_at)],
            ['Subtotal', escapeHtml(text(row.subtotal))],
            ['Base gravable', escapeHtml(text(row.subtotal_sin_impuestos)) || '—'],
            ['Descuento', escapeHtml(text(row.descuento_total))],
            ['Impuestos', escapeHtml(text(row.impuesto_total))],
            ['Retenciones', escapeHtml(text(row.retencion_total)) || '—'],
            ['Envio', escapeHtml(text(row.envio_total))],
            ['Total', `${escapeHtml(text(row.total))} ${escapeHtml(text(row.moneda))}`],
            ['Cupon', escapeHtml(text(row.cupon_codigo)) || '—'],
            ['Factura electronica', escapeHtml(text(row.facturacion_electronica_estado)) || '—'],
            ['Numero factura', factura ? escapeHtml(text(factura.numero_factura)) || '—' : '—'],
            ['CUFE', factura ? escapeHtml(text(factura.cufe)) || '—' : '—'],
            [
              'Error factura',
              factura && text(factura.error)
                ? `<span class="admin-badge admin-badge--danger">${escapeHtml(text(factura.error))}</span>`
                : '—',
            ],
            ['Mercado', escapeHtml(text(row.mercado))],
            ['Pasarela', escapeHtml(text(row.proveedor_pago))],
            ['Referencia', escapeHtml(text(row.referencia_pasarela)) || '—'],
            ['Checkout URL', escapeHtml(text(row.checkout_url)) || '—'],
            [
              'Comprobante',
              text(row.comprobante_pago_path)
                ? `${escapeHtml(text(row.comprobante_pago_nombre) || 'archivo')} · ${formatCell(row.comprobante_subido_at)}`
                : '—',
            ],
            ['Pago validado', formatCell(row.pago_validado_at) || '—'],
          ]
        )}
      </div>
      ${
        text(row.comprobante_pago_path)
          ? `<div style="padding:0 16px 16px">
        <h3>Comprobante de transferencia</h3>
        <p class="admin-help">Archivo: ${escapeHtml(text(row.comprobante_pago_nombre) || text(row.comprobante_pago_path))}</p>
        <div class="admin-toolbar">
          <button class="admin-button" type="button" data-pedido-ver-comprobante="${escapeHtml(text(row.comprobante_pago_path))}">Ver / descargar comprobante</button>
        </div>
      </div>`
          : ''
      }
      </div>
      <div style="padding:0 16px 16px">
        <h3>Facturacion electronica (DIAN)</h3>
        <p class="admin-help">
          Corrige NIT/direccion aqui si Siigo rechazo el formato. Guarda y reemite.
          NIT sin espacios (ej. <code>9014419082</code>).
        </p>
        <form class="admin-form" data-pedido-fiscal-form>
          <input type="hidden" name="pedido_id" value="${escapeHtml(text(row.id))}" />
          <div class="admin-editor__cols">
            ${selectStatic('tipo_documento', 'Tipo documento', fiscalTipoDoc, [
              ['NIT', 'NIT'],
              ['CC', 'CC'],
              ['CE', 'CE'],
              ['PP', 'Pasaporte'],
            ])}
            ${field('numero_documento', 'Numero documento', fiscalNumero, true)}
          </div>
          <div class="admin-toolbar" style="margin:0 0 12px">
            <button class="admin-button admin-button--ghost" type="button" data-nit-verificar="pedido">
              Verificar NIT
            </button>
            <button class="admin-button admin-button--ghost" type="button" data-nit-importar-dian="pedido">
              Importar datos DIAN
            </button>
            <span class="admin-meta" data-nit-status="pedido"></span>
          </div>
          <div class="admin-editor__cols">
            ${selectStatic('tipo_persona', 'Tipo persona', fiscalPersona, [
              ['juridica', 'Juridica'],
              ['natural', 'Natural'],
            ])}
            ${field('razon_social', 'Razon social', fiscalRazon, true)}
            ${field('email_facturacion', 'Email facturacion', fiscalEmail, true, 'email')}
            ${field('direccion', 'Direccion fisica', fiscalDireccion, true)}
            ${field('ciudad', 'Ciudad', fiscalCiudad, true)}
            ${field('departamento', 'Departamento', fiscalDepto)}
          </div>
          ${checkbox('responsable_iva', 'Responsable de IVA', fiscalResponsableIva)}
          ${checkbox(
            'solicitar_factura_electronica',
            'Factura electronica solicitada',
            row.facturacion_electronica_solicitada !== false
          )}
          <div class="admin-toolbar" style="margin-top:12px">
            <button class="admin-button" type="submit">Guardar datos fiscales</button>
            <button class="admin-button admin-button--ghost" type="button" data-pedido-reemitir-dian>
              Reemitir factura DIAN
            </button>
            ${
              factura
                ? `<a class="admin-button admin-button--ghost" href="#/factura?id=${encodeURIComponent(text(factura.id) || text(row.id))}">Ver ficha factura</a>`
                : ''
            }
          </div>
        </form>
      </div>
      <div style="padding:0 16px 16px">
        <h3>Cliente</h3>
        <div class="admin-flow-grid">
          <div>${jsonObjectTable(cliente)}</div>
          <div class="admin-cards-stack">
            <div class="admin-workcard">
              <strong>Acciones del cliente</strong>
              <p>Contacta, revisa direccion y valida el contexto del pedido sin salir de la ficha.</p>
              <div class="admin-toolbar">
                ${
                  text(row.cliente_id)
                    ? `<a class="admin-button admin-button--ghost" href="#/cliente?id=${encodeURIComponent(text(row.cliente_id))}">Ver cliente</a>`
                    : ''
                }
                ${
                  clienteEmail
                    ? `<button class="admin-button admin-button--ghost" type="button" data-copy-text="${escapeHtml(
                        clienteEmail
                      )}">Copiar email</button>`
                    : ''
                }
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style="padding:0 16px 16px">
        <h3>Items</h3>
        ${jsonRowsTable(items)}
      </div>
      <div style="padding:0 16px 16px">
        <h3>Fulfillments / proveedores</h3>
        ${
          fulfillments.length === 0
            ? '<p class="admin-help">Sin fulfillments asociados aun.</p>'
            : table(
                ['Proveedor', 'Estado', 'Notificado', 'Notas', 'Acciones'],
                fulfillments.map(f => {
                  const proveedor =
                    f.proveedores && typeof f.proveedores === 'object'
                      ? (f.proveedores as Row)
                      : {};
                  return [
                    escapeHtml(text(proveedor.nombre)) || '—',
                    formatCell(f.estado),
                    formatCell(f.notificado_at),
                    escapeHtml(text(f.notas)) || escapeHtml(text(f.error_detalle)) || '—',
                    `<button class="admin-button admin-button--ghost" data-resend-notification="${escapeHtml(text(f.id))}" type="button">Reenviar</button>`,
                  ];
                })
              )
        }
      </div>
      <div style="padding:0 16px 16px">
        <h3>Eventos de pago</h3>
        ${
          eventos.length === 0
            ? '<p class="admin-help">Sin eventos registrados aun (esperando webhook del proveedor de pago).</p>'
            : table(
                ['Fecha', 'Proveedor', 'Event ID', 'Procesado'],
                eventos.map(e => [
                  formatCell(e.created_at),
                  escapeHtml(text(e.proveedor_pago)),
                  escapeHtml(text(e.event_id)),
                  formatCell(e.procesado),
                ])
              )
        }
      </div>
      <div style="padding:0 16px 16px">
        <h3>Reembolsos</h3>
        ${
          reembolsos.length === 0
            ? '<p class="admin-help">Sin reembolsos registrados.</p>'
            : table(
                [
                  'Fecha',
                  'Monto',
                  'Motivo',
                  'Metodo',
                  'Estado',
                  'Nota credito DIAN',
                  'Ref. externa',
                ],
                reembolsos.map(r => [
                  formatCell(r.created_at),
                  escapeHtml(text(r.monto)),
                  escapeHtml(text(r.motivo)),
                  escapeHtml(text(r.metodo)),
                  escapeHtml(text(r.estado)),
                  r.nota_credito_dian ? 'Si' : 'No',
                  escapeHtml(text(r.referencia_externa)) || '—',
                ])
              )
        }
        <form data-reembolso-form class="admin-form" style="margin-top:12px">
          <input type="hidden" name="pedido_id" value="${escapeHtml(text(row.id))}" />
          <div class="admin-form__grid">
            <label>Monto (COP)
              <input name="monto" type="number" min="1" step="0.01" max="${escapeHtml(text(row.total))}" required />
            </label>
            <label>Metodo
              <select name="metodo">
                <option value="pasarela">Pasarela</option>
                <option value="transferencia">Transferencia</option>
                <option value="nota_credito">Nota credito</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label>Referencia externa
              <input name="referencia_externa" type="text" placeholder="ID en Wompi/banco" />
            </label>
          </div>
          <label>Motivo
            <input name="motivo" type="text" required placeholder="Motivo del reembolso" />
          </label>
          <label><input name="nota_credito_dian" type="checkbox" /> Requiere nota credito DIAN</label>
          <button class="admin-button" type="submit">Registrar reembolso</button>
          <p class="admin-help">El reembolso en la pasarela se ejecuta desde su dashboard; aqui queda la trazabilidad. Si el monto cubre el total, se ofrecera marcar el pedido como reembolsado (envia email al cliente).</p>
        </form>
      </div>
      <div style="padding:0 16px 16px">
        <div class="admin-panel__head" style="padding-left:0;padding-right:0;border-bottom:0">
          <h3>Timeline unificado</h3>
          <span class="admin-meta">Estado, notas y eventos de pago en una sola vista</span>
        </div>
        ${
          feed.length === 0
            ? '<p class="admin-help">Sin eventos aun.</p>'
            : `<div class="pedido-feed">${feed
                .map(item => {
                  const clase =
                    item.kind === 'pago'
                      ? 'pedido-feed__item pedido-feed__item--pago'
                      : item.kind === 'nota'
                        ? 'pedido-feed__item pedido-feed__item--nota'
                        : 'pedido-feed__item pedido-feed__item--estado';
                  return `
                    <article class="${clase}">
                      <div class="pedido-feed__top">
                        <span class="admin-badge admin-badge--info">${escapeHtml(item.badge)}</span>
                        <time>${formatCell(item.createdAt)}</time>
                      </div>
                      <h4>${escapeHtml(item.title)}</h4>
                      ${item.meta ? `<p class="pedido-feed__meta">${escapeHtml(item.meta)}</p>` : ''}
                      <p>${escapeHtml(item.body)}</p>
                    </article>`;
                })
                .join('')}</div>`
        }
      </div>
      <div style="padding:0 16px 16px">
        <h3>Notas</h3>
        ${
          notas.length === 0
            ? '<p class="admin-help">Sin notas.</p>'
            : table(
                ['Fecha', 'Tipo', 'Autor', 'Nota'],
                notas.map(n => [
                  formatCell(n.created_at),
                  escapeHtml(text(n.tipo)),
                  escapeHtml(text(n.autor_email)) || '—',
                  escapeHtml(text(n.nota)),
                ])
              )
        }
        <div class="admin-toolbar pedido-nota-templates">
          <button class="admin-button admin-button--ghost" type="button" data-pedido-nota-template="Cliente contactado. Seguimiento en curso.">Contactado</button>
          <button class="admin-button admin-button--ghost" type="button" data-pedido-nota-template="Pago validado. Preparar despacho o fulfillment.">Pago validado</button>
          <button class="admin-button admin-button--ghost" type="button" data-pedido-nota-template="Pendiente por inventario. Revisar disponibilidad con proveedor.">Pendiente stock</button>
          <button class="admin-button admin-button--ghost" type="button" data-pedido-nota-template="Despacho programado. Esperando confirmacion final de transporte.">Despacho programado</button>
        </div>
        <form class="admin-form" data-pedido-nota-form style="margin-top:12px">
          <input type="hidden" name="pedido_id" value="${escapeHtml(text(row.id))}" />
          ${selectStatic('tipo', 'Tipo de nota', 'interna', [
            ['interna', 'Interna'],
            ['cliente', 'Visible para cliente (futuro portal)'],
            ['sistema', 'Sistema'],
          ])}
          <textarea name="nota" rows="4" placeholder="Nueva nota" data-pedido-nota-input></textarea>
          <button class="admin-button" type="submit">Agregar nota</button>
        </form>
      </div>
      <div style="padding:0 16px 16px">
        <h3>Consentimiento de datos</h3>
        <p class="admin-help">${
          row.consentimiento_datos
            ? `Aceptado el ${formatCell(row.consentimiento_timestamp)}`
            : 'No aceptado / no registrado'
        }</p>
      </div>
      <form class="admin-form" data-pedido-estado-form style="padding:0 16px 16px">
        <input type="hidden" name="id" value="${escapeHtml(text(row.id))}" />
        <div class="admin-alert">Cambiar el estado aqui es manual y no envia notificaciones de pago al proveedor. Usalo para correcciones administrativas y para reflejar el seguimiento (envio, entrega, retrasos).</div>
        <div class="admin-alert">"Retrasado" = Escenario A: el pedido ya estaba pagado cuando el producto quedo sin disponibilidad. Implica contactar al cliente manualmente.</div>
        <div class="admin-editor__cols">
          ${selectStatic('estado', 'Estado', text(row.estado), PEDIDO_ESTADOS)}
        </div>
        <button class="admin-button" type="submit">Cambiar estado</button>
      </form>
    </section>`;
}

const CUPON_TIPOS: Array<[string, string]> = [
  ['porcentaje', 'Porcentaje'],
  ['monto_carrito', 'Monto fijo carrito'],
  ['monto_producto', 'Monto fijo producto'],
];

async function cuponesView(): Promise<string> {
  const rows = await selectRows('cupones', '*', 'created_at', 100, false);
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Cupones (${rows.length})</h2>
        <a class="admin-button" href="#/cupon">Nuevo cupon</a>
      </div>
      ${table(
        ['Codigo', 'Tipo', 'Valor', 'Usos', 'Vigencia', 'Estado', 'Acciones'],
        rows.map(row => [
          text(row.codigo),
          text(row.tipo_descuento),
          `${text(row.valor)} ${text(row.tipo_descuento) === 'porcentaje' ? '%' : text(row.moneda)}`,
          `${text(row.usos)}${row.limite_uso_total ? ` / ${text(row.limite_uso_total)}` : ''}`,
          [formatCell(row.empieza_at), formatCell(row.expira_at)].join(' → '),
          status(row.activo),
          `<a class="admin-button admin-button--ghost" href="#/cupon?id=${encodeURIComponent(text(row.id))}">Editar</a>`,
        ])
      )}
    </section>`;
}

async function cuponFormView(): Promise<string> {
  const row = state.recordId ? await getRow('cupones', state.recordId) : null;
  const tipo = text(row?.tipo_descuento) || 'porcentaje';
  const valorAttrs =
    tipo === 'porcentaje' ? 'min="0" max="100" step="0.01"' : 'min="0" step="0.01"';
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>${row ? 'Editar cupon' : 'Nuevo cupon'}</h2>
        <a class="admin-button admin-button--ghost" href="#/cupones">Volver</a>
      </div>
      <form class="admin-form" data-cupon-form style="padding:16px">
        <input type="hidden" name="id" value="${escapeHtml(text(row?.id))}" />
        <div class="admin-editor__cols">
          ${field('codigo', 'Codigo', text(row?.codigo), true)}
          ${selectStatic('tipo_descuento', 'Tipo descuento', tipo, CUPON_TIPOS)}
          ${field('valor', 'Valor (% max 100 si porcentaje)', text(row?.valor), true, 'number', valorAttrs)}
          ${field('moneda', 'Moneda', text(row?.moneda) || 'COP', true)}
          ${field('monto_minimo', 'Monto minimo', text(row?.monto_minimo), false, 'number')}
          ${field('monto_maximo', 'Monto maximo', text(row?.monto_maximo), false, 'number')}
          ${field('limite_uso_total', 'Limite uso total', text(row?.limite_uso_total), false, 'number')}
          ${field('limite_uso_por_usuario', 'Limite por usuario/email', text(row?.limite_uso_por_usuario), false, 'number')}
          ${field('empieza_at', 'Empieza', datetimeLocal(row?.empieza_at), false, 'datetime-local')}
          ${field('expira_at', 'Expira', datetimeLocal(row?.expira_at), false, 'datetime-local')}
        </div>
        ${textarea('productos_incluidos', 'Productos incluidos (slugs, uno por linea)', stringArray(row?.productos_incluidos).join('\n'))}
        ${textarea('productos_excluidos', 'Productos excluidos (slugs, uno por linea)', stringArray(row?.productos_excluidos).join('\n'))}
        ${textarea('familias_incluidas', 'Familias incluidas (slugs, una por linea)', stringArray(row?.familias_incluidas).join('\n'))}
        ${textarea('familias_excluidas', 'Familias excluidas (slugs, una por linea)', stringArray(row?.familias_excluidas).join('\n'))}
        ${textarea('emails_permitidos', 'Emails permitidos (uno por linea, soporta * como convencion documental)', stringArray(row?.emails_permitidos).join('\n'))}
        ${textarea('descripcion', 'Descripcion interna', text(row?.descripcion))}
        <div class="admin-editor__cols">
          ${checkbox('activo', 'Activo', row ? Boolean(row.activo) : true)}
          ${checkbox('uso_individual', 'Uso individual (no combinable)', Boolean(row?.uso_individual))}
          ${checkbox('excluir_ofertas', 'Excluir productos en oferta', Boolean(row?.excluir_ofertas))}
          ${checkbox('envio_gratis', 'Envio gratis', Boolean(row?.envio_gratis))}
        </div>
        <button class="admin-button" type="submit">Guardar cupon</button>
      </form>
    </section>`;
}

async function reportesView(): Promise<string> {
  const [pedidos, cotizaciones, productos, fulfillments, cupones, carritos] = await Promise.all([
    selectRows('pedidos', '*', 'created_at', 500, false),
    selectRows('solicitudes_cotizacion', '*', 'created_at', 500, false),
    selectRows(
      'productos',
      'id,nombre_es,slug,stock,stock_estado,disponible,tipo_comercial,fulfillment_mode',
      'nombre_es',
      500
    ),
    selectRows('fulfillments', '*', 'created_at', 500, false),
    selectRows('cupones', '*', 'created_at', 200, false),
    selectRows('carritos_abandonados', 'estado,subtotal,created_at', 'created_at', 500, false),
  ]);
  const ESTADOS_VENTA = ['pagado', 'procesando', 'enviado', 'entregado'];
  const pedidosPagados = pedidos.filter(p => ESTADOS_VENTA.includes(text(p.estado)));
  const ventas = pedidosPagados.reduce((acc, p) => acc + Number(p.total ?? 0), 0);
  const pedidosPorEstado = groupCount(pedidos, 'estado');
  const cotizacionesPorEstado = groupCount(cotizaciones, 'estado');
  const productosCriticos = productos.filter(
    p => p.disponible === false || text(p.stock_estado) !== 'instock'
  );

  // Ventas por mes (ultimos 12)
  const porMes = new Map<string, { total: number; pedidos: number }>();
  for (const p of pedidosPagados) {
    const mes = text(p.created_at).slice(0, 7);
    if (!mes) continue;
    const acc = porMes.get(mes) ?? { total: 0, pedidos: 0 };
    acc.total += Number(p.total ?? 0);
    acc.pedidos += 1;
    porMes.set(mes, acc);
  }
  const meses = Array.from(porMes.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12);
  const maxMes = Math.max(1, ...meses.map(([, v]) => v.total));

  // Top productos por unidades e ingresos (desde items de pedidos pagados)
  const porProducto = new Map<string, { unidades: number; ingresos: number }>();
  for (const p of pedidosPagados) {
    for (const item of Array.isArray(p.items) ? (p.items as Row[]) : []) {
      const nombre = text(item.nombre) || text(item.slug) || 'desconocido';
      const acc = porProducto.get(nombre) ?? { unidades: 0, ingresos: 0 };
      acc.unidades += Number(item.cantidad ?? 0);
      acc.ingresos += Number(item.precio_unitario ?? 0) * Number(item.cantidad ?? 0);
      porProducto.set(nombre, acc);
    }
  }
  const topProductos = Array.from(porProducto.entries())
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .slice(0, 10);

  const ticketPromedio = pedidosPagados.length > 0 ? ventas / pedidosPagados.length : 0;
  const conversionPct =
    cotizaciones.length > 0 ? (pedidosPagados.length / cotizaciones.length) * 100 : 0;
  const carritosActivos = carritos.filter(c => text(c.estado) === 'activo').length;
  const carritosRecuperados = carritos.filter(c => text(c.estado) === 'convertido').length;

  return `
    <section class="admin-grid">
      ${metric('Ventas reconocidas COP', Math.round(ventas))}
      ${metric('Ticket promedio COP', Math.round(ticketPromedio))}
      ${metric('Pedidos pagados', pedidosPagados.length)}
      ${metric('Cotizaciones', cotizaciones.length)}
      ${metric('Conversion cot./venta %', Math.round(conversionPct * 10) / 10)}
      ${metric('Carritos abandonados', carritosActivos)}
      ${metric('Carritos recuperados', carritosRecuperados)}
      ${metric('Productos criticos', productosCriticos.length)}
      ${metric('Fulfillments error', fulfillments.filter(f => text(f.estado) === 'error').length)}
      ${metric('Cupones activos', cupones.filter(c => c.activo === true).length)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Ventas por mes (ultimos 12)</h2></div>
      ${
        meses.length === 0
          ? '<p class="admin-help" style="padding:16px">Sin ventas registradas.</p>'
          : table(
              ['Mes', 'Pedidos', 'Total COP', ''],
              meses.map(([mes, v]) => [
                mes,
                String(v.pedidos),
                Math.round(v.total).toLocaleString('es-CO'),
                `<div style="background:var(--border);border-radius:4px;height:10px;min-width:120px"><div style="width:${Math.round((v.total / maxMes) * 100)}%;background:var(--ink,#333);height:10px;border-radius:4px"></div></div>`,
              ])
            )
      }
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Top productos (por ingresos)</h2></div>
      ${
        topProductos.length === 0
          ? '<p class="admin-help" style="padding:16px">Sin datos de items.</p>'
          : table(
              ['Producto', 'Unidades', 'Ingresos COP'],
              topProductos.map(([nombre, v]) => [
                escapeHtml(nombre),
                String(v.unidades),
                Math.round(v.ingresos).toLocaleString('es-CO'),
              ])
            )
      }
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Pedidos por estado</h2></div>
      ${table(
        ['Estado', 'Cantidad'],
        Array.from(pedidosPorEstado.entries()).map(([k, v]) => [k || 'sin_estado', String(v)])
      )}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Cotizaciones por estado</h2></div>
      ${table(
        ['Estado', 'Cantidad'],
        Array.from(cotizacionesPorEstado.entries()).map(([k, v]) => [k || 'sin_estado', String(v)])
      )}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Productos con riesgo operativo</h2></div>
      ${table(
        ['Producto', 'Tipo', 'Fulfillment', 'Stock', 'Estado', 'Disponible'],
        productosCriticos.map(p => [
          text(p.nombre_es),
          text(p.tipo_comercial),
          text(p.fulfillment_mode),
          text(p.stock),
          text(p.stock_estado),
          formatCell(p.disponible),
        ])
      )}
    </section>`;
}

async function marketingView(): Promise<string> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase!
    .from('analytics_eventos')
    .select('*')
    .gte('ts', since)
    .order('ts', { ascending: false })
    .limit(5000);
  if (error) {
    return `
      <section class="admin-panel">
        <div class="admin-panel__head"><h2>Analitica no disponible</h2></div>
        <div class="admin-panel__body" style="padding:16px">
          <div class="admin-alert">Aplica la migracion <code>marketing_analytics</code> para crear <code>analytics_eventos</code>. Error: ${escapeHtml(error.message)}</div>
        </div>
      </section>`;
  }

  const eventos = ((data ?? []) as Row[]).filter(row => text(row.ts) >= since);
  const sesiones = new Set(eventos.map(row => text(row.session_id)).filter(Boolean));
  const pageViews = eventos.filter(row => text(row.event_name) === 'page_view');
  const engaged = eventos.filter(row => text(row.event_name) === 'session_engaged');
  const conversions = eventos.filter(row =>
    ['quote_submit', 'whatsapp_click', 'begin_checkout', 'purchase'].includes(text(row.event_name))
  );
  const avgDuration =
    engaged.length > 0
      ? engaged.reduce((acc, row) => acc + Number(row.duration_seconds ?? 0), 0) / engaged.length
      : 0;
  const avgScroll =
    engaged.length > 0
      ? engaged.reduce((acc, row) => acc + Number(row.scroll_depth ?? 0), 0) / engaged.length
      : 0;
  const conversionRate = sesiones.size > 0 ? (conversions.length / sesiones.size) * 100 : 0;

  const funnelEvents = [
    'page_view',
    'product_view',
    'quick_view',
    'quote_open',
    'quote_submit',
    'whatsapp_click',
    'add_to_cart',
    'begin_checkout',
    'purchase',
  ];
  const funnel = funnelEvents.map(name => {
    const total = eventos.filter(row => text(row.event_name) === name).length;
    const pct = pageViews.length > 0 ? (total / pageViews.length) * 100 : 0;
    return [name, String(total), `${pct.toFixed(1)}%`];
  });

  const pages = new Map<string, { views: number; sessions: Set<string> }>();
  for (const row of pageViews) {
    const path = text(row.page_path) || '(sin ruta)';
    const acc = pages.get(path) ?? { views: 0, sessions: new Set<string>() };
    acc.views += 1;
    const sessionId = text(row.session_id);
    if (sessionId) acc.sessions.add(sessionId);
    pages.set(path, acc);
  }
  const topPages = Array.from(pages.entries())
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 12);

  const sources = new Map<string, { sessions: Set<string>; events: number }>();
  for (const row of eventos) {
    const source = text(row.utm_source) || 'directo';
    const medium = text(row.utm_medium) || 'none';
    const key = `${source} / ${medium}`;
    const acc = sources.get(key) ?? { sessions: new Set<string>(), events: 0 };
    acc.events += 1;
    const sessionId = text(row.session_id);
    if (sessionId) acc.sessions.add(sessionId);
    sources.set(key, acc);
  }
  const sourceRows = Array.from(sources.entries())
    .sort((a, b) => b[1].sessions.size - a[1].sessions.size)
    .slice(0, 12);

  const productViews = new Map<string, number>();
  for (const row of eventos.filter(item => text(item.event_name) === 'product_view')) {
    const slug = text(row.product_slug) || '(sin slug)';
    productViews.set(slug, (productViews.get(slug) ?? 0) + 1);
  }
  const topProducts = Array.from(productViews.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const ctas = new Map<string, number>();
  for (const row of eventos.filter(item => text(item.event_name) === 'cta_clicked')) {
    const props =
      row.properties && typeof row.properties === 'object' ? (row.properties as Row) : {};
    const label = text(props.text) || text(props.href) || '(sin etiqueta)';
    ctas.set(label, (ctas.get(label) ?? 0) + 1);
  }
  const topCtas = Array.from(ctas.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const commercialUsage = await commercialUsageSummary(30);

  return `
    <section class="admin-grid">
      ${marketingMetric('Visitas pagina', pageViews.length.toLocaleString('es-CO'))}
      ${marketingMetric('Sesiones', sesiones.size.toLocaleString('es-CO'))}
      ${marketingMetric('Permanencia media', formatDuration(avgDuration))}
      ${marketingMetric('Scroll medio', `${avgScroll.toFixed(0)}%`)}
      ${marketingMetric('Conversiones', conversions.length.toLocaleString('es-CO'))}
      ${marketingMetric('Conv. por sesion', `${conversionRate.toFixed(1)}%`)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Reporte de uso · /comercial/ · 30 días</h2>
        ${commercialUsage.available ? '' : '<span class="admin-help">Migración pendiente</span>'}
      </div>
      ${
        commercialUsage.available
          ? `<div class="admin-grid" style="padding:16px">
              ${marketingMetric('Comerciales activos', commercialUsage.activeUsers.toLocaleString('es-CO'))}
              ${marketingMetric('Sesiones', commercialUsage.sessions.toLocaleString('es-CO'))}
              ${marketingMetric('Inicios de sesión', commercialUsage.logins.toLocaleString('es-CO'))}
              ${marketingMetric('Vistas catálogo', commercialUsage.catalogViews.toLocaleString('es-CO'))}
              ${marketingMetric('Vistas envíos', commercialUsage.enviosViews.toLocaleString('es-CO'))}
              ${marketingMetric('Búsquedas / filtros', `${commercialUsage.searches} / ${commercialUsage.filters}`)}
              ${marketingMetric('Modal envío', commercialUsage.shareOpens.toLocaleString('es-CO'))}
              ${marketingMetric('Envíos OK / error', `${commercialUsage.shareSucceeded} / ${commercialUsage.shareFailed}`)}
            </div>
            <div style="padding:0 16px 16px">
              <h3>Vistas del portal</h3>
              ${table(
                ['Vista', 'Aperturas'],
                commercialUsage.topViews.map(([view, total]) => [escapeHtml(view), String(total)])
              )}
            </div>`
          : '<p class="admin-help" style="padding:16px">Aplica la migración <code>commercial_usage_report</code> para activar el reporte. El envío semanal lo incorpora automáticamente cuando la tabla esté disponible.</p>'
      }
    </section>
    <section class="admin-panel admin-analytics-status">
      <div class="admin-panel__head"><h2>Stack de medicion</h2></div>
      <div class="admin-health">
        <div class="admin-health__item">
          <strong>Google Analytics 4</strong>
          <p>${PUBLIC_GA_ID ? `Activo (${PUBLIC_GA_ID}). Eventos y pageviews se envian con gtag.` : 'Pendiente: definir PUBLIC_GA_ID.'}</p>
        </div>
        <div class="admin-health__item">
          <strong>Google Search Console</strong>
          <p>
            Sitemap ${SEARCH_CONSOLE_SITEMAP}.
            ${
              PUBLIC_SEARCH_CONSOLE_VERIFICATION
                ? 'Meta google-site-verification activa.'
                : PUBLIC_SEARCH_CONSOLE_FILE
                  ? `Archivo HTML ${PUBLIC_SEARCH_CONSOLE_FILE} en dist.`
                  : `Verificar propiedad https://i-me.com.co/ con Google Analytics (${GA4_MEASUREMENT_ID} en head). Luego vincular GSC en GA4 Admin → Product links → Search Console y enviar el sitemap.`
            }
          </p>
        </div>
        <div class="admin-health__item">
          <strong>Google Tag Manager</strong>
          <p>${PUBLIC_GTM_ID ? 'Activo por PUBLIC_GTM_ID. dataLayer recibe todos los eventos.' : 'Pendiente: definir PUBLIC_GTM_ID si se usara contenedor.'}</p>
        </div>
        <div class="admin-health__item">
          <strong>Heatmap / grabaciones</strong>
          <p>${PUBLIC_CLARITY_ID ? 'Microsoft Clarity activo. Heatmaps y session replay se revisan en Clarity; aqui se resume permanencia y scroll first-party.' : 'Pendiente: definir PUBLIC_CLARITY_ID para heatmaps y session replay.'}</p>
        </div>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Funnel marketing 30 dias</h2></div>
      ${table(['Evento', 'Total', '% sobre pageviews'], funnel)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Paginas con mas visitas</h2></div>
      ${table(
        ['Pagina', 'Vistas', 'Sesiones'],
        topPages.map(([path, stats]) => [
          escapeHtml(path),
          String(stats.views),
          String(stats.sessions.size),
        ])
      )}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Fuentes UTM</h2></div>
      ${table(
        ['Fuente / medio', 'Sesiones', 'Eventos'],
        sourceRows.map(([source, stats]) => [
          escapeHtml(source),
          String(stats.sessions.size),
          String(stats.events),
        ])
      )}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Productos mas vistos</h2></div>
      ${table(
        ['Producto', 'Vistas'],
        topProducts.map(([slug, total]) => [escapeHtml(slug), String(total)])
      )}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>CTAs mas pulsados</h2></div>
      ${table(
        ['CTA', 'Clicks'],
        topCtas.map(([label, total]) => [escapeHtml(label), String(total)])
      )}
    </section>`;
}

function notFoundPanel(message: string, backHref: string): string {
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>${escapeHtml(message)}</h2>
        <a class="admin-button admin-button--ghost" href="${escapeHtml(backHref)}">Volver</a>
      </div>
    </section>`;
}

function jsonObjectTable(obj: Row): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '<p class="admin-help">Sin datos.</p>';
  return table(
    ['Campo', 'Valor'],
    keys.map(key => [escapeHtml(key), formatCell(obj[key])])
  );
}

function jsonRowsTable(items: unknown[]): string {
  if (items.length === 0) return '<p class="admin-help">Sin elementos.</p>';
  const objectItems = items.map(item =>
    item && typeof item === 'object' ? (item as Row) : { valor: item }
  );
  const keys = Array.from(new Set(objectItems.flatMap(item => Object.keys(item))));
  return table(
    keys,
    objectItems.map(item => keys.map(key => formatCell(item[key])))
  );
}

async function proveedoresView(): Promise<string> {
  const params = hashParams();
  const q = (params.get('q') ?? '').trim();
  const activo = params.get('activo') ?? '';
  const incorporadoDesde = params.get('incorporado_desde') ?? '';
  const incorporadoHasta = params.get('incorporado_hasta') ?? '';
  const ordenar = params.get('ordenar') ?? 'alfabetico_asc';

  const [rows, asignaciones] = await Promise.all([
    selectProveedores({
      q,
      activo,
      incorporado_desde: incorporadoDesde,
      incorporado_hasta: incorporadoHasta,
      ordenar,
    }),
    selectRows('proveedor_producto', 'proveedor_id', 'prioridad', 1000),
  ]);
  const conteos = new Map<string, number>();
  for (const row of asignaciones) {
    const id = text(row.proveedor_id);
    conteos.set(id, (conteos.get(id) ?? 0) + 1);
  }
  return `
    <section class="admin-panel admin-form">
      <div class="admin-panel__head">
        <h2>Proveedores</h2>
        <div class="admin-toolbar">
          <button class="admin-button admin-button--ghost" type="button" data-entity-export-xlsx="proveedores">Exportar Excel</button>
          <button class="admin-button admin-button--ghost" type="button" data-entity-template-xlsx="proveedores">Plantilla Excel</button>
        </div>
      </div>
      <form class="admin-filters" data-proveedores-filter>
        ${field('q', 'Buscar por nombre o slug', q, false, 'search')}
        ${selectStatic('activo', 'Estado', activo, [
          ['', 'Todos'],
          ['1', 'Activo'],
          ['0', 'Inactivo'],
        ])}
        ${field('incorporado_desde', 'Fecha incorporación desde', incorporadoDesde, false, 'date')}
        ${field('incorporado_hasta', 'Fecha incorporación hasta', incorporadoHasta, false, 'date')}
        ${selectStatic('ordenar', 'Ordenar', ordenar, [
          ['alfabetico_asc', 'A-Z'],
          ['alfabetico_desc', 'Z-A'],
          ['recientes', 'Más recientes'],
          ['antiguos', 'Más antiguos'],
        ])}
        <button class="admin-button" type="submit">Filtrar</button>
        <a class="admin-button admin-button--ghost" href="#/proveedores">Limpiar</a>
      </form>
      ${entityImportForm('proveedores', 'proveedores', 'Upsert por slug. api_config debe conservar JSON válido.')}
      <form class="admin-panel admin-form" data-simple-form data-table="proveedores" data-fields="slug,nombre,contacto_email,contacto_whatsapp,canal,webhook_url,notas,activo">
        <div class="admin-panel__head"><h2>Crear proveedor</h2><button class="admin-button" type="submit">Guardar</button></div>
        <div style="padding:16px" class="admin-editor__cols">
          ${field('slug', 'Slug', '', true)}
          ${field('nombre', 'Nombre', '', true)}
          ${field('contacto_email', 'Email')}
          ${field('contacto_whatsapp', 'WhatsApp')}
          ${selectStatic('canal', 'Canal', 'email', [
            ['email', 'Email'],
            ['whatsapp', 'WhatsApp'],
            ['webhook', 'Webhook'],
            ['api', 'API'],
            ['manual', 'Manual'],
          ])}
          ${field('webhook_url', 'Webhook URL')}
          ${textarea('notas', 'Notas')}
          ${checkbox('activo', 'Activo', true)}
        </div>
      </form>
      ${table(
        ['Nombre', 'Canal', 'Estado', 'Productos asignados', 'Acciones'],
        rows.map(r => [
          text(r.nombre),
          text(r.canal),
          status(r.activo),
          String(conteos.get(text(r.id)) ?? 0),
          `<a class="admin-button admin-button--ghost" href="#/proveedor-productos?id=${encodeURIComponent(text(r.id))}">Productos</a>`,
        ])
      )}
    </section>`;
}

async function proveedorProductosView(): Promise<string> {
  const proveedorId = state.recordId;
  if (!proveedorId) {
    return `<section class="admin-panel"><div style="padding:16px" class="admin-alert">Selecciona un proveedor desde la lista de Proveedores.</div></section>`;
  }
  const [proveedor, asignaciones, productos] = await Promise.all([
    getRow('proveedores', proveedorId),
    selectProveedorProductos(proveedorId),
    selectRows('productos', 'id,nombre_es,slug,fulfillment_mode', 'nombre_es', 500),
  ]);
  if (!proveedor) {
    return `<section class="admin-panel"><div style="padding:16px" class="admin-alert">Proveedor no encontrado.</div></section>`;
  }
  const asignados = new Set(asignaciones.map(row => text(row.producto_id)));
  const disponibles = productos.filter(p => !asignados.has(text(p.id)));
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Productos de ${escapeHtml(text(proveedor.nombre))}</h2>
        <a class="admin-button admin-button--ghost" href="#/proveedores">Volver a proveedores</a>
      </div>
      <div style="padding:16px" class="admin-alert">precio_costo es CONFIDENCIAL: nunca se expone en APIs publicas ni en el sitio.</div>
      ${table(
        ['Producto', 'Fulfillment', 'Precio costo', 'Moneda', 'Prioridad', 'Activo', 'Acciones'],
        asignaciones.map(row => {
          const producto =
            row.productos && typeof row.productos === 'object' ? (row.productos as Row) : {};
          return [
            text(producto.nombre_es) || text(row.producto_id),
            text(producto.fulfillment_mode),
            text(row.precio_costo),
            text(row.moneda_costo),
            text(row.prioridad),
            status(row.activo),
            `<button class="admin-button admin-button--ghost admin-button--danger" data-remove-pp="${escapeHtml(text(row.id))}" type="button">Quitar</button>`,
          ];
        })
      )}
      <form class="admin-form" data-pp-form style="padding:16px">
        <input type="hidden" name="proveedor_id" value="${escapeHtml(proveedorId)}" />
        <div class="admin-editor__cols">
          ${select('producto_id', 'Producto', '', disponibles, 'nombre_es', true)}
          ${field('precio_costo', 'Precio costo', '', true, 'number')}
          ${field('moneda_costo', 'Moneda', 'COP', true)}
          ${field('prioridad', 'Prioridad (1 = preferente)', '1', true, 'number')}
          ${checkbox('activo', 'Activo', true)}
        </div>
        <button class="admin-button" type="submit">Asignar producto</button>
      </form>
    </section>`;
}

async function selectProveedorProductos(proveedorId: string): Promise<Row[]> {
  const { data, error } = await supabase!
    .from('proveedor_producto')
    .select('*, productos(nombre_es, slug, fulfillment_mode)')
    .eq('proveedor_id', proveedorId)
    .order('prioridad');
  if (error) {
    toast(error.message);
    return [];
  }
  return (data ?? []) as unknown as Row[];
}

const FULFILLMENT_ESTADOS: Array<[string, string]> = [
  ['pendiente', 'Pendiente'],
  ['notificado', 'Notificado'],
  ['preparando', 'Preparando'],
  ['enviado', 'Enviado'],
  ['entregado', 'Entregado'],
  ['cancelado', 'Cancelado'],
  ['error', 'Error'],
];

async function fulfillmentsView(): Promise<string> {
  const params = hashParams();
  const estado = params.get('estado') ?? '';
  const proveedorId = params.get('proveedor_id') ?? '';
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') ?? '';

  const [pendientes, notificados, enviados, entregados, conError, proveedores] = await Promise.all([
    count('fulfillments', { estado: 'pendiente' }),
    count('fulfillments', { estado: 'notificado' }),
    count('fulfillments', { estado: 'enviado' }),
    count('fulfillments', { estado: 'entregado' }),
    count('fulfillments', { estado: 'error' }),
    selectRows('proveedores', 'id, nombre', 'nombre', 200),
  ]);

  let query = supabase!
    .from('fulfillments')
    .select('*, pedidos(cliente, total, moneda), proveedores(nombre)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (estado) query = query.eq('estado', estado);
  if (proveedorId) query = query.eq('proveedor_id', proveedorId);
  if (desde) query = query.gte('created_at', desde);
  if (hasta) query = query.lte('created_at', `${hasta}T23:59:59`);
  const { data, error } = await query;
  if (error) toast(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return `
    <section class="admin-grid">
      ${metric('Pendientes', pendientes)}
      ${metric('Notificados', notificados)}
      ${metric('Enviados', enviados)}
      ${metric('Entregados', entregados)}
      ${metric('Con error', conError)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Transportistas / tracking</h2></div>
      <div class="admin-help" style="padding:0 16px 12px">
        Seguimiento de despachos dropship: estado, número de guía y URL del transportista. No es el menú de tarifas por zona (ver <strong>Tarifas envío</strong>).
      </div>
      <form class="admin-filters" data-fulfillments-filter>
        ${selectStatic('estado', 'Estado', estado, [['', 'Todos'], ...FULFILLMENT_ESTADOS])}
        ${selectStatic('proveedor_id', 'Proveedor', proveedorId, [
          ['', 'Todos'],
          ...proveedores.map((p): [string, string] => [text(p.id), text(p.nombre)]),
        ])}
        ${field('desde', 'Desde', desde, false, 'date')}
        ${field('hasta', 'Hasta', hasta, false, 'date')}
        <button class="admin-button" type="submit">Filtrar</button>
        <a class="admin-button admin-button--ghost" href="#/fulfillments">Limpiar</a>
      </form>
      ${
        rows.length === 0
          ? '<p class="admin-help" style="padding:16px">Sin registros.</p>'
          : rows
              .map(row => {
                const pedido =
                  row.pedidos && typeof row.pedidos === 'object' ? (row.pedidos as Row) : {};
                const proveedor =
                  row.proveedores && typeof row.proveedores === 'object'
                    ? (row.proveedores as Row)
                    : {};
                const resumen = [
                  `Pedido: ${text(pedido.cliente) || 'Sin cliente'} — ${text(pedido.total)} ${text(
                    pedido.moneda
                  )}`,
                  `Proveedor: ${text(proveedor.nombre) || 'Sin asignar'}`,
                  `Estado: ${text(row.estado)}`,
                  `Tracking: ${text(row.tracking_number) || '—'}`,
                ].join(' | ');
                return `
              <form class="admin-form" data-fulfillment-form style="padding:16px;border-top:1px solid var(--admin-line)">
                <input type="hidden" name="id" value="${escapeHtml(text(row.id))}" />
                <div class="fulfillment-workflow">
                  <div class="fulfillment-workflow__summary" data-fulfillment-summary hidden>${escapeHtml(resumen)}</div>
                  <div class="admin-campo-revisable__head">
                    <span>Pedido: ${formatCell(pedido.cliente)} — ${escapeHtml(text(pedido.total))} ${escapeHtml(text(pedido.moneda))}</span>
                    <span>Proveedor: ${escapeHtml(text(proveedor.nombre) || 'Sin asignar')}</span>
                    <span>Creado: ${formatCell(row.created_at)}</span>
                    ${row.error_detalle ? `<span class="admin-badge admin-badge--warn">Error: ${escapeHtml(text(row.error_detalle))}</span>` : ''}
                  </div>
                  <div class="fulfillment-workflow__chips">
                    <span class="admin-badge admin-badge--info">${escapeHtml(text(row.estado))}</span>
                    ${row.notificado_at ? `<span class="admin-badge">Notif. ${formatCell(row.notificado_at)}</span>` : ''}
                    ${row.enviado_at ? `<span class="admin-badge">Enviado ${formatCell(row.enviado_at)}</span>` : ''}
                    ${row.entregado_at ? `<span class="admin-badge">Entregado ${formatCell(row.entregado_at)}</span>` : ''}
                  </div>
                  <div class="admin-toolbar fulfillment-workflow__actions">
                    <button class="admin-button admin-button--ghost" type="button" data-fulfillment-quick-estado="notificado">Notificar</button>
                    <button class="admin-button admin-button--ghost" type="button" data-fulfillment-quick-estado="preparando">Preparar</button>
                    <button class="admin-button admin-button--ghost" type="button" data-fulfillment-quick-estado="enviado">Enviar</button>
                    <button class="admin-button admin-button--ghost" type="button" data-fulfillment-quick-estado="entregado">Entregar</button>
                    <button class="admin-button admin-button--ghost" type="button" data-fulfillment-quick-estado="cancelado">Cancelar</button>
                    <button class="admin-button admin-button--danger" type="button" data-fulfillment-quick-estado="error">Marcar error</button>
                    ${
                      text(row.tracking_url)
                        ? `<a class="admin-button admin-button--ghost" href="${escapeHtml(text(row.tracking_url))}" target="_blank" rel="noopener noreferrer">Abrir tracking</a>`
                        : ''
                    }
                    <button class="admin-button admin-button--ghost" type="button" data-fulfillment-copy-summary>Copiar resumen</button>
                  </div>
                </div>
                <div class="admin-editor__cols">
                  ${selectStatic('estado', 'Estado', text(row.estado), FULFILLMENT_ESTADOS)}
                  ${field('tracking_number', 'Numero de tracking', text(row.tracking_number))}
                  ${field('tracking_url', 'URL de tracking', text(row.tracking_url))}
                </div>
                ${textarea('notas', 'Notas', text(row.notas))}
                <div class="admin-toolbar">
                  <button class="admin-button" type="submit">Guardar</button>
                  <button class="admin-button admin-button--ghost" data-resend-notification="${escapeHtml(text(row.id))}" type="button">Reenviar notificacion al proveedor</button>
                </div>
              </form>`;
              })
              .join('')
      }
    </section>`;
}

async function conocimientoView(): Promise<string> {
  const articulos = await selectRows('articulos', '*', 'created_at', 200, false);
  const articulo = state.recordId ? await getRow('articulos', state.recordId) : null;
  const draft = articleDraft(articulo);

  return `
    <section class="admin-panel admin-panel--conocimiento-list">
      <div class="admin-panel__head">
        <h2>Articulos del blog</h2>
        <a class="admin-button" href="#/conocimiento">${draft.id ? 'Nuevo articulo' : 'Ir al formulario'}</a>
      </div>
      <div class="admin-help" style="padding:0 16px 12px">
        Editor CMS del blog publico (<code>/es/conocimiento/</code>). Markdown + vista previa. Guardar borrador o publicar y pulsar <strong>Publicar cambios</strong> para rebuild.
      </div>
      <div style="padding:0 16px 12px">
        <label class="admin-field">Buscar
          <input type="search" data-article-filter placeholder="Slug, titulo ES/EN…" autocomplete="off" />
        </label>
      </div>
      ${
        articulos.length
          ? `<div class="admin-table-wrap"><table class="admin-table" data-article-table><thead><tr><th>Estado</th><th>Slug</th><th>Titulo ES</th><th>Titulo EN</th><th>Actualizado</th><th>Acciones</th></tr></thead><tbody>${articulos
              .map(row => {
                const published = Boolean(row.publicado);
                const slug = text(row.slug);
                const tituloEs = text(row.titulo_es);
                const tituloEn = text(row.titulo_en);
                const haystack = `${slug} ${tituloEs} ${tituloEn}`.toLowerCase();
                return `<tr data-article-row data-filter-text="${escapeHtml(haystack)}">
                    <td>${published ? '<span class="admin-badge admin-badge--ok">Publicado</span>' : '<span class="admin-badge admin-badge--warn">Borrador</span>'}</td>
                    <td>${escapeHtml(slug)}</td>
                    <td>${escapeHtml(tituloEs)}</td>
                    <td>${escapeHtml(tituloEn || '—')}</td>
                    <td>${escapeHtml(text(row.updated_at) || text(row.created_at))}</td>
                    <td>
                      <a class="admin-button admin-button--ghost" href="#/conocimiento?id=${encodeURIComponent(text(row.id))}">Editar</a>
                      ${
                        published
                          ? `<a class="admin-button admin-button--ghost" href="/es/conocimiento/${encodeURIComponent(slug)}/" target="_blank" rel="noreferrer noopener">Ver</a>`
                          : `<span class="admin-help" title="Publica el articulo para verlo en el sitio">Borrador</span>`
                      }
                    </td>
                  </tr>`;
              })
              .join('')}</tbody></table></div>`
          : '<div style="padding:16px"><div class="admin-alert">Aún no hay artículos. Crea el primero con el formulario de abajo.</div></div>'
      }
    </section>
    <section class="admin-panel admin-panel--conocimiento-form" id="article-editor">
      <div class="admin-panel__head">
        <h2>${draft.id ? 'Editar articulo' : 'Nuevo articulo'}</h2>
        ${draft.id ? `<a class="admin-button admin-button--ghost" href="#/conocimiento">Limpiar</a>` : ''}
      </div>
      <form class="admin-form" data-article-form style="padding:16px">
        <input type="hidden" name="id" value="${escapeHtml(draft.id ?? '')}" />
        <div class="admin-article-toprow">
          ${field('slug', 'Slug', draft.slug, true)}
          ${field('titulo_es', 'Titulo ES', draft.titulo_es, true)}
          ${field('titulo_en', 'Titulo EN', draft.titulo_en)}
        </div>
        <div class="admin-article-toprow">
          ${selectStatic('autor_tipo', 'Tipo de autor', draft.autor_tipo, [
            ['ime', 'I-ME'],
            ['cliente', 'Cliente'],
            ['fabricante', 'Fabricante'],
          ])}
          ${field('autor_nombre', 'Nombre autor', draft.autor_nombre)}
          ${field('autor_empresa', 'Empresa autor', draft.autor_empresa)}
        </div>
        ${field('autor_bio_corta', 'Bio corta autor', draft.autor_bio_corta)}
        <div class="admin-upload-box">
          <div class="admin-upload-box__info">
            <div class="admin-help">Imagen principal del artículo</div>
            <input type="hidden" name="imagen" value="${escapeHtml(draft.imagen ?? '')}" />
            <div class="admin-preview-box" data-image-preview style="${draft.imagen ? '' : 'display:none;'}">
              ${draft.imagen ? `<img src="${escapeHtml(draft.imagen)}" alt="Preview" style="max-width:100%; max-height:150px; border-radius:8px;" />` : ''}
            </div>
          </div>
          ${upload('articulos', 'imagen', 'Subir imagen')}
        </div>
        <div class="admin-markdown-grid">
          <div>
            ${markdownEditor('cuerpo_es', 'Cuerpo ES (Markdown)', draft.cuerpo_es)}
            <div class="admin-help" style="margin-top:8px">Vista previa ES</div>
            <div class="admin-markdown-preview" data-article-preview-es>${renderMarkdown(draft.cuerpo_es || '')}</div>
          </div>
          <div>
            ${markdownEditor('cuerpo_en', 'Cuerpo EN (Markdown)', draft.cuerpo_en)}
            <div class="admin-help" style="margin-top:8px">Vista previa EN</div>
            <div class="admin-markdown-preview" data-article-preview-en>${renderMarkdown(draft.cuerpo_en || '')}</div>
          </div>
        </div>
        ${checkbox('publicado', 'Publicado (visible en sitio tras rebuild)', draft.publicado)}
        <div class="admin-toolbar">
          <button class="admin-button" type="submit">Guardar articulo</button>
          ${draft.id ? '<button class="admin-button admin-button--danger" data-article-delete type="button">Eliminar articulo</button>' : ''}
        </div>
        <div class="admin-alert">El contenido vive en <code>articulos</code>. Solo filas publicadas salen en el sitio. Tras publicar, usa <strong>Publicar cambios</strong> en la barra superior si el rebuild no arranca solo.</div>
      </form>
    </section>`;
}

async function ingestaView(): Promise<string> {
  const [familias, tipos] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
  ]);
  ingestFamilias = familias;
  ingestTipos = tipos;
  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>PDF a borrador revisable</h2></div>
      <form class="admin-form" data-ingest-form style="padding:16px">
        <div class="admin-upload-box">
          <div>
            <strong>Ingesta desde el dispositivo</strong>
            <p>Selecciona una ficha PDF local. Se subira al bucket de fichas y se usara como fuente del borrador.</p>
          </div>
          <button class="admin-button admin-button--ghost" data-ingest-upload-pdf type="button">Seleccionar PDF</button>
        </div>
        <div data-ingest-upload-status class="admin-help"></div>
        ${field('pdf_url', 'URL de PDF en Storage')}
        ${textarea('pdf_text', 'Texto extraido del PDF')}
        <button class="admin-button" type="submit">Extraer borrador</button>
        <div class="admin-alert">La IA solo propone. Revise cada campo, marque "Revisado" en los campos marcados y complete los datos comerciales antes de crear el producto.</div>
      </form>
    </section>
    <div data-ingest-review></div>`;
}

const TIPOS_USO_LLM: Array<[string, string]> = [
  ['chat', 'Chat (Asesor)'],
  ['embedding', 'Embeddings'],
  ['ingesta', 'Ingesta PDF'],
];

const MODOS_ASESOR: Array<[string, string]> = [
  ['rag', 'RAG (normal)'],
  ['keyword_degradado', 'Degradado (palabra clave)'],
  ['sin_resultados', 'Sin resultados'],
];

function periodoActualCliente(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sumField(rows: Row[], key: string): number {
  return rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0);
}

async function asesorView(): Promise<string> {
  const periodo = periodoActualCliente();
  const [{ data: llmData, error: llmError }, { data: asesorData, error: asesorError }] =
    await Promise.all([
      supabase!.from('llm_uso').select('*').eq('periodo_yyyy_mm', periodo),
      supabase!.from('asesor_uso').select('*').eq('periodo_yyyy_mm', periodo),
    ]);
  if (llmError) toast(llmError.message);
  if (asesorError) toast(asesorError.message);
  const llmRows = (llmData ?? []) as unknown as Row[];
  const asesorRows = (asesorData ?? []) as unknown as Row[];

  const costeTotal = sumField(llmRows, 'coste_estimado');
  const conversaciones = asesorRows.length;
  const handoffs = asesorRows.filter(r => r.hubo_handoff === true).length;
  const latencias = asesorRows
    .map(r => Number(r.latencia_ms ?? 0))
    .filter(v => Number.isFinite(v) && v > 0);
  const latenciaPromedio = latencias.length
    ? Math.round(latencias.reduce((acc, v) => acc + v, 0) / latencias.length)
    : 0;

  return `
    <div class="admin-alert">Periodo actual: ${escapeHtml(periodo)}. El limite mensual (BUDGET_MENSUAL_USD) se controla en las Edge Functions; aqui solo se muestra el gasto registrado.</div>
    <section class="admin-grid">
      ${metric('Conversaciones', conversaciones)}
      ${metric('Con handoff', handoffs)}
      ${metric('Latencia media (ms)', latenciaPromedio)}
      ${metric('Gasto LLM ($ est.)', Number(costeTotal.toFixed(4)))}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Uso LLM por tipo (${escapeHtml(periodo)})</h2></div>
      ${table(
        ['Tipo', 'Tokens entrada', 'Tokens salida', 'Coste estimado ($)'],
        TIPOS_USO_LLM.map(([tipo, label]) => {
          const filas = llmRows.filter(r => text(r.tipo) === tipo);
          return [
            label,
            String(sumField(filas, 'input_tokens')),
            String(sumField(filas, 'output_tokens')),
            sumField(filas, 'coste_estimado').toFixed(4),
          ];
        })
      )}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Conversaciones por modo (${escapeHtml(periodo)})</h2></div>
      ${table(
        ['Modo', 'Conversaciones'],
        MODOS_ASESOR.map(([modo, label]) => [
          label,
          String(asesorRows.filter(r => text(r.modo) === modo).length),
        ])
      )}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Reindexar catalogo (embeddings Asesor)</h2></div>
      <div style="padding:16px" class="admin-form">
        <div class="admin-alert">Reindexar recalcula el embedding de todos los productos activos. <strong>Ollama local</strong>: coste $0, requiere Ollama corriendo en localhost. <strong>Via Edge Function</strong>: consume presupuesto LLM nube.</div>
        <div class="admin-toolbar">
          <button class="admin-button admin-button--ghost" data-asesor-estimar type="button">Estimar coste (nube)</button>
          <button class="admin-button admin-button--ghost" data-asesor-reindexar type="button">Reindexar (nube)</button>
          <button class="admin-button" data-asesor-reindexar-ollama type="button">Reindexar productos (Ollama)</button>
          <button class="admin-button" data-asesor-reindexar-articulos type="button">Reindexar artículos (Ollama)</button>
        </div>
        <div data-asesor-reindex-result></div>
      </div>
    </section>`;
}

function bindAsesorPanel() {
  const resultado = app.querySelector<HTMLElement>('[data-asesor-reindex-result]');
  if (!resultado) return;

  app.querySelector('[data-asesor-estimar]')?.addEventListener('click', async () => {
    resultado.innerHTML = '<p class="admin-help">Estimando coste...</p>';
    const { data, error } = await supabase!.functions.invoke('generar-embeddings', {
      body: { todos: true, estimar: true },
    });
    if (error) {
      resultado.innerHTML = `<div class="admin-alert">${escapeHtml(error.message)}</div>`;
      return;
    }
    const json = data as Row;
    resultado.innerHTML = `
      <div class="admin-alert">
        Productos a procesar: ${escapeHtml(text(json['productos_a_procesar']))} ·
        Tokens estimados: ${escapeHtml(text(json['tokens_estimados']))} ·
        Coste estimado: $${escapeHtml(text(json['coste_estimado']))} (${escapeHtml(text(json['proveedor']))}/${escapeHtml(text(json['modelo']))})
      </div>`;
  });

  app.querySelector('[data-asesor-reindexar]')?.addEventListener('click', async () => {
    if (!confirm('Reindexar todo el catalogo activo? Esto consume presupuesto LLM.')) return;
    resultado.innerHTML = '<p class="admin-help">Reindexando catalogo, esto puede tardar...</p>';
    const { data, error } = await supabase!.functions.invoke('generar-embeddings', {
      body: { todos: true },
    });
    if (error) {
      resultado.innerHTML = `<div class="admin-alert">${escapeHtml(error.message)}</div>`;
      return;
    }
    const json = data as Row;
    const errores = Array.isArray(json['errores']) ? json['errores'] : [];
    resultado.innerHTML = `
      <div class="admin-alert">
        Procesados: ${escapeHtml(text(json['procesados']))} ·
        Omitidos: ${escapeHtml(text(json['omitidos']))} ·
        Coste estimado: $${escapeHtml(text(json['coste_estimado']))}
      </div>
      ${errores.length ? jsonRowsTable(errores) : ''}`;
  });

  app.querySelector('[data-asesor-reindexar-ollama]')?.addEventListener('click', async () => {
    if (
      !confirm(
        'Reindexar todo el catalogo con Ollama local (mxbai-embed-large)? Asegurate de que Ollama este corriendo.'
      )
    )
      return;
    resultado.innerHTML =
      '<p class="admin-help">Generando embeddings de productos con Ollama local, esto puede tardar...</p>';
    try {
      const stats = await reindexarConOllamaLocal();
      resultado.innerHTML = `<div class="admin-alert">Procesados: ${stats.procesados} · Errores: ${stats.errores} · Coste: $0 (Ollama local)</div>`;
    } catch (err) {
      resultado.innerHTML = `<div class="admin-alert">Error: ${escapeHtml(err instanceof Error ? err.message : String(err))}</div>`;
    }
  });

  app.querySelector('[data-asesor-reindexar-articulos]')?.addEventListener('click', async () => {
    if (
      !confirm(
        'Reindexar artículos publicados con Ollama local? Asegurate de que Ollama este corriendo.'
      )
    )
      return;
    resultado.innerHTML =
      '<p class="admin-help">Generando embeddings de artículos con Ollama local...</p>';
    try {
      const stats = await reindexarArticulosConOllama();
      resultado.innerHTML = `<div class="admin-alert">Artículos procesados: ${stats.procesados} · Errores: ${stats.errores} · Coste: $0</div>`;
    } catch (err) {
      resultado.innerHTML = `<div class="admin-alert">Error: ${escapeHtml(err instanceof Error ? err.message : String(err))}</div>`;
    }
  });
}

function bindProductFilters() {
  const form = app.querySelector<HTMLFormElement>('[data-productos-filter]');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const key of [
      'q',
      'familia_id',
      'tipo_id',
      'activo',
      'tipo_comercial',
      'disponible',
      'incorporado_desde',
      'incorporado_hasta',
      'ordenar',
    ]) {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    location.hash = `#/productos${qs ? `?${qs}` : ''}`;
  });
}

function bindProviderFilters() {
  const form = app.querySelector<HTMLFormElement>('[data-proveedores-filter]');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ['q', 'activo', 'incorporado_desde', 'incorporado_hasta', 'ordenar']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    location.hash = `#/proveedores${qs ? `?${qs}` : ''}`;
  });
}

function bindProductList() {
  app.querySelectorAll<HTMLButtonElement>('[data-product-row-save]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['productRowSave'];
      if (!id) return;
      try {
        button.disabled = true;
        button.textContent = 'Guardando...';
        const payload = productInlinePayload(id);
        const errorValidacion =
          validarFamiliaYTipoProducto(payload) ?? validarPreciosProducto(payload);
        if (errorValidacion) {
          toast(errorValidacion);
          return;
        }
        const { error } = await supabase!.from('productos').update(payload).eq('id', id);
        if (error) throw error;
        if (payload['activo']) await generarEmbeddingProducto(id);
        toast('Producto actualizado');
        await render();
      } catch (error) {
        toast(error instanceof Error ? error.message : 'No se pudo guardar el producto');
      } finally {
        button.disabled = false;
        button.textContent = 'Guardar';
      }
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-product-row-upload]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['productRowUpload'];
      if (!id) return;
      await uploadProductRowImage(id);
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-product-row-gallery-upload]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['productRowGalleryUpload'];
      if (!id) return;
      await uploadProductRowGallery(id);
    });
  });
  app.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', async () => {
      const tableName = button.getAttribute('data-table');
      const id = button.getAttribute('data-delete');
      if (!tableName || !id || !confirm('Eliminar registro?')) return;
      const { error } = await supabase!.from(tableName).delete().eq('id', id);
      if (error) toast(error.message);
      await render();
    });
  });
}

function productInlinePayload(productId: string): Row {
  const fields = Array.from(
    app.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[data-product-id="${CSS.escape(productId)}"][data-product-field]`
    )
  );
  const get = (key: string): string => {
    const field = fields.find(element => element.dataset['productField'] === key);
    if (!field) return '';
    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      return field.checked ? 'true' : 'false';
    }
    return field.value;
  };
  const bool = (key: string, fallback = false) => parseExcelBoolean(get(key), fallback);
  const num = (key: string) => parseExcelNumber(get(key));
  return removeUndefined({
    nombre_es: get('nombre_es').trim(),
    nombre_en: emptyStringToNull(get('nombre_en')),
    slug: slugify(get('slug')) || get('slug').trim(),
    sku: emptyStringToNull(get('sku')),
    gtin: emptyStringToNull(get('gtin')),
    familia_id: emptyStringToNull(get('familia_id')),
    tipo_id: emptyStringToNull(get('tipo_id')),
    tipo_comercial: get('tipo_comercial') === 'consumible' ? 'consumible' : 'equipo',
    fulfillment_mode: ['dropship', 'individualizado'].includes(get('fulfillment_mode'))
      ? get('fulfillment_mode')
      : 'cotizacion',
    precio: num('precio'),
    precio_regular: num('precio_regular'),
    precio_oferta: num('precio_oferta'),
    dian_codigo: emptyStringToNull(get('dian_codigo')),
    tarifa_iva_pct: num('tarifa_iva_pct'),
    retencion_fuente_pct: num('retencion_fuente_pct'),
    retencion_iva_pct: num('retencion_iva_pct'),
    retencion_ica_pct: num('retencion_ica_pct'),
    moneda: get('moneda').trim() || 'COP',
    stock: num('stock'),
    gestionar_stock: bool('gestionar_stock'),
    stock_estado: ['outofstock', 'onbackorder'].includes(get('stock_estado'))
      ? get('stock_estado')
      : 'instock',
    backorder_policy: ['notify', 'yes'].includes(get('backorder_policy'))
      ? get('backorder_policy')
      : 'no',
    disponible: bool('disponible', true),
    disponible_actualizado_at: new Date().toISOString(),
    excluido_iva: bool('excluido_iva'),
    activo: bool('activo'),
    destacado: bool('destacado'),
    nuevo: bool('nuevo'),
    ficha_pdf: emptyStringToNull(get('ficha_pdf')),
    descripcion_corta_es: emptyStringToNull(get('descripcion_corta_es')),
    descripcion_corta_en: emptyStringToNull(get('descripcion_corta_en')),
    descripcion_larga_es: emptyStringToNull(get('descripcion_larga_es')),
    descripcion_larga_en: emptyStringToNull(get('descripcion_larga_en')),
    especificaciones: parseExcelJsonList(get('especificaciones')),
    aplicaciones_es: parseExcelList(get('aplicaciones_es')),
    aplicaciones_en: parseExcelList(get('aplicaciones_en')),
    galeria: parseExcelList(get('galeria')),
    atributos: parseExcelJsonObject(get('atributos')),
    peso_kg: num('peso_kg'),
    dimensiones_cm: parseExcelJsonObject(get('dimensiones_cm')),
    orden: parseExcelInteger(get('orden'), 0),
  });
}

async function uploadProductRowImage(productId: string) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      toast('Imagen supera 2 MB. Comprime antes de subir.');
      return;
    }
    const path = `${productId}/${Date.now()}-${slugify(file.name)}`;
    const options = file.type ? { contentType: file.type, upsert: false } : { upsert: false };
    const { error } = await supabase!.storage.from('productos').upload(path, file, options);
    if (error) {
      toast(error.message);
      return;
    }
    const publicUrl = supabase!.storage.from('productos').getPublicUrl(path).data.publicUrl;
    const { error: updateError } = await supabase!
      .from('productos')
      .update({ imagen_principal: publicUrl })
      .eq('id', productId);
    if (updateError) {
      toast(updateError.message);
      return;
    }
    toast('Imagen actualizada');
    await render();
  });
  input.click();
}

async function uploadProductRowGallery(productId: string) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    const oversized = files.find(f => f.size > PRODUCT_IMAGE_MAX_BYTES);
    if (oversized) {
      toast(`"${oversized.name}" supera 2 MB. Comprime antes de subir.`);
      return;
    }
    const current = await getRow('productos', productId);
    const existingGallery = stringArray(current?.galeria);
    const uploadedUrls: string[] = [];
    for (const [index, file] of files.entries()) {
      const path = `${productId}/galeria/${Date.now()}-${index}-${slugify(file.name)}`;
      const options = file.type ? { contentType: file.type, upsert: false } : { upsert: false };
      const { error } = await supabase!.storage.from('productos').upload(path, file, options);
      if (error) {
        toast(error.message);
        return;
      }
      uploadedUrls.push(supabase!.storage.from('productos').getPublicUrl(path).data.publicUrl);
    }
    const nextGallery = [...new Set([...existingGallery, ...uploadedUrls])];
    const payload: Row = { galeria: nextGallery };
    if (!text(current?.imagen_principal) && uploadedUrls[0])
      payload.imagen_principal = uploadedUrls[0];
    const { error: updateError } = await supabase!
      .from('productos')
      .update(payload)
      .eq('id', productId);
    if (updateError) {
      toast(updateError.message);
      return;
    }
    toast(`Galería actualizada: ${uploadedUrls.length} imagen(es) agregadas`);
    await render();
  });
  input.click();
}

function bindProductForm() {
  const form = app.querySelector<HTMLFormElement>('[data-product-form]');
  if (!form) return;
  form.addEventListener('input', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== 'nombre_es') return;
    const slug = form.elements.namedItem('slug');
    if (slug instanceof HTMLInputElement && !slug.value) slug.value = slugify(target.value);
    if (target.closest('[data-spec-row]')) syncSpecJson(form);
  });
  form.querySelectorAll<HTMLButtonElement>('[data-add-spec]').forEach(button => {
    button.addEventListener('click', () => {
      form.querySelector('[data-spec-rows]')?.insertAdjacentHTML('beforeend', specEditorRow({}));
      syncSpecJson(form);
    });
  });
  form.querySelectorAll<HTMLButtonElement>('[data-spec-fill-sample]').forEach(button => {
    button.addEventListener('click', () => {
      const rows = form.querySelector<HTMLElement>('[data-spec-rows]');
      if (!rows) return;
      rows.innerHTML = specEditorRow({});
      syncSpecJson(form);
    });
  });
  form.addEventListener('click', event => {
    const target = event.target;
    const removeButton =
      target instanceof HTMLElement ? target.closest<HTMLElement>('[data-remove-row]') : null;
    if (removeButton) {
      removeButton.closest('[data-spec-row]')?.remove();
      if (!form.querySelector('[data-spec-row]')) {
        form.querySelector('[data-spec-rows]')?.insertAdjacentHTML('beforeend', specEditorRow({}));
      }
      syncSpecJson(form);
    }
  });
  syncSpecJson(form);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = productPayload(form);
    const errorValidacion = validarFamiliaYTipoProducto(payload) ?? validarPreciosProducto(payload);
    if (errorValidacion) {
      toast(errorValidacion);
      return;
    }
    const id = String(new FormData(form).get('id') ?? '');
    if (id) {
      const { error } = await supabase!.from('productos').update(payload).eq('id', id);
      if (error) {
        toast(error.message);
        return;
      }
      if (payload['activo']) await generarEmbeddingProducto(id);
      toast('Producto guardado');
      location.hash = '#/productos';
      return;
    }
    const { data, error } = await supabase!.from('productos').insert(payload).select('id').single();
    if (error) {
      toast(error.message);
      return;
    }
    if (payload['activo']) await generarEmbeddingProducto(text((data as Row).id));
    toast('Producto guardado');
    location.hash = '#/productos';
  });
  form.querySelector('[data-delete-product]')?.addEventListener('click', async () => {
    const id = String(new FormData(form).get('id') ?? '');
    if (!id || !confirm('Eliminar producto?')) return;
    const { error } = await supabase!.from('productos').delete().eq('id', id);
    if (error) toast(error.message);
    location.hash = '#/productos';
  });
  form.querySelectorAll<HTMLButtonElement>('[data-upload]').forEach(button => {
    button.addEventListener('click', async () => uploadFile(button, form));
  });
}

function bindReasignacion() {
  app.querySelectorAll<HTMLFormElement>('[data-reasignar-form]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const productoId = String(data.get('producto_id') ?? '');
      const payload: Row = {
        familia_id: emptyToNull(data.get('familia_id')),
        tipo_id: emptyToNull(data.get('tipo_id')),
      };
      const errorValidacion = validarFamiliaYTipoProducto(payload);
      if (errorValidacion) {
        toast(errorValidacion);
        return;
      }
      const { error } = await supabase!.from('productos').update(payload).eq('id', productoId);
      if (error) {
        toast(error.message);
        return;
      }
      toast('Producto reasignado');
      await render();
    });
  });
}

function bindTaxonomy() {
  app.querySelectorAll<HTMLFormElement>('[data-simple-form]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const tableName = form.dataset['table'];
      const fields = form.dataset['fields']?.split(',') ?? [];
      if (!tableName) return;
      const data = new FormData(form);
      const payload: Row = {};
      for (const fieldName of fields) {
        const element = form.elements.namedItem(fieldName);
        if (element instanceof HTMLInputElement && element.type === 'checkbox') {
          payload[fieldName] = element.checked;
        } else if (fieldName === 'orden') {
          payload[fieldName] = numberOrZero(data.get(fieldName));
        } else {
          payload[fieldName] = emptyToNull(data.get(fieldName));
        }
      }
      const { error } = await supabase!.from(tableName).insert(payload);
      if (error) {
        toast(error.message);
        return;
      }
      toast('Registro creado');
      await render();
    });
  });

  const autoasignarButton = app.querySelector<HTMLButtonElement>('[data-autoasignar-tipos]');
  autoasignarButton?.addEventListener('click', async () => {
    autoasignarButton.disabled = true;
    try {
      const [familiasRows, tiposRows, productosRows] = await Promise.all([
        selectRows('familias', 'id,slug,nombre_es,nombre_en', 'orden', 200),
        selectRows('tipos', 'id,familia_id,nombre_es', 'orden', 300),
        selectRows('productos', 'id,familia_id,tipo_id', 'nombre_es', 500),
      ]);
      const familias: FamiliaRow[] = familiasRows.map(f => ({
        id: text(f.id),
        slug: text(f.slug),
        nombre_es: text(f.nombre_es),
        nombre_en: emptyStringToNull(text(f.nombre_en)),
      }));
      const tipos: TipoRow[] = tiposRows.map(t => ({
        id: text(t.id),
        familia_id: text(t.familia_id),
        nombre_es: text(t.nombre_es),
      }));
      const productos: ProductoTaxonomiaRow[] = productosRows.map(p => ({
        id: text(p.id),
        familia_id: emptyStringToNull(text(p.familia_id)),
        tipo_id: emptyStringToNull(text(p.tipo_id)),
      }));
      const plan = planificarAutoasignacionTipos(productos, tipos, familias);
      if (plan.actualizacionesDirectas.length === 0 && plan.tiposACrear.length === 0) {
        toast('No hay productos pendientes.');
        return;
      }

      let productosActualizados = 0;
      let tiposCreados = 0;

      for (const entrada of plan.tiposACrear) {
        const { data, error } = await supabase!
          .from('tipos')
          .insert(entrada.tipo)
          .select('id')
          .single();
        if (error) {
          toast(error.message);
          await render();
          return;
        }
        tiposCreados += 1;
        const nuevoTipoId = text((data as Row).id);
        const { error: updateError } = await supabase!
          .from('productos')
          .update({ tipo_id: nuevoTipoId })
          .in('id', entrada.productoIds);
        if (updateError) {
          toast(updateError.message);
          await render();
          return;
        }
        productosActualizados += entrada.productoIds.length;
      }

      for (const entrada of plan.actualizacionesDirectas) {
        const { error } = await supabase!
          .from('productos')
          .update({ tipo_id: entrada.tipoId })
          .in('id', entrada.productoIds);
        if (error) {
          toast(error.message);
          await render();
          return;
        }
        productosActualizados += entrada.productoIds.length;
      }

      toast(`${productosActualizados} productos actualizados, ${tiposCreados} tipos creados.`);
      await render();
    } finally {
      autoasignarButton.disabled = false;
    }
  });

  app.querySelectorAll<HTMLButtonElement>('[data-edit-tipo]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['editTipo'];
      if (!id) return;
      const tipo = await getRow('tipos', id);
      if (!tipo) {
        toast('Tipo no encontrado');
        return;
      }
      const form = app.querySelector<HTMLFormElement>('[data-type-edit-form]');
      if (!form) return;
      setFormValue(form, 'tipo_id', text(tipo.id));
      setFormValue(form, 'familia_id', text(tipo.familia_id));
      setFormValue(form, 'slug', text(tipo.slug));
      setFormValue(form, 'nombre_es', text(tipo.nombre_es));
      setFormValue(form, 'nombre_en', text(tipo.nombre_en));
      setFormValue(form, 'orden', text(tipo.orden));
      setCheckboxValue(form, 'activo', tipo.activo !== false);
      toast('Tipo cargado para edición');
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-edit-familia]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['editFamilia'];
      if (!id) return;
      const familia = await getRow('familias', id);
      if (!familia) {
        toast('Familia no encontrada');
        return;
      }
      const form = app.querySelector<HTMLFormElement>('[data-familia-edit-form]');
      if (!form) return;
      setFormValue(form, 'familia_id', text(familia.id));
      setFormValue(form, 'slug', text(familia.slug));
      setFormValue(form, 'nombre_es', text(familia.nombre_es));
      setFormValue(form, 'nombre_en', text(familia.nombre_en));
      setFormValue(form, 'descripcion_es', text(familia.descripcion_es));
      setFormValue(form, 'descripcion_en', text(familia.descripcion_en));
      setFormValue(form, 'orden', text(familia.orden));
      setCheckboxValue(form, 'activo', familia.activo !== false);
      toast('Familia cargada para edición');
    });
  });

  app
    .querySelector<HTMLFormElement>('[data-familia-edit-form]')
    ?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const id = String(data.get('familia_id') ?? '');
      if (!id) {
        toast('Selecciona una familia para editar');
        return;
      }
      const payload: Row = {
        slug: emptyToNull(data.get('slug')),
        nombre_es: emptyToNull(data.get('nombre_es')),
        nombre_en: emptyToNull(data.get('nombre_en')),
        descripcion_es: emptyToNull(data.get('descripcion_es')),
        descripcion_en: emptyToNull(data.get('descripcion_en')),
        orden: numberOrZero(data.get('orden')),
        activo: data.get('activo') === 'on',
      };
      const error = validarFamiliaEditable(payload);
      if (error) {
        toast(error);
        return;
      }
      const { error: updateError } = await supabase!.from('familias').update(payload).eq('id', id);
      if (updateError) {
        toast(updateError.message);
        return;
      }
      toast('Familia actualizada');
      await render();
    });

  app
    .querySelector<HTMLFormElement>('[data-type-edit-form]')
    ?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const id = String(data.get('tipo_id') ?? '');
      if (!id) {
        toast('Selecciona un tipo para editar');
        return;
      }
      const payload: Row = {
        familia_id: emptyToNull(data.get('familia_id')),
        slug: emptyToNull(data.get('slug')),
        nombre_es: emptyToNull(data.get('nombre_es')),
        nombre_en: emptyToNull(data.get('nombre_en')),
        orden: numberOrZero(data.get('orden')),
        activo: data.get('activo') === 'on',
      };
      const error = validarTipoEditable(payload);
      if (error) {
        toast(error);
        return;
      }
      const { error: updateError } = await supabase!.from('tipos').update(payload).eq('id', id);
      if (updateError) {
        toast(updateError.message);
        return;
      }
      toast('Tipo actualizado');
      await render();
    });

  app.querySelectorAll<HTMLButtonElement>('[data-delete-familia]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['deleteFamilia'];
      if (!id) return;
      button.disabled = true;
      try {
        const [tiposDependientes, productosDependientes] = await Promise.all([
          selectRowsWhere('tipos', 'id', 'orden', { familia_id: id }, 1000),
          selectRowsWhere('productos', 'id', 'nombre_es', { familia_id: id }, 1000),
        ]);
        const bloqueo = mensajeBloqueoEliminarFamilia(
          tiposDependientes.length,
          productosDependientes.length
        );
        if (bloqueo) {
          toast(bloqueo);
          return;
        }
        if (!confirm('Eliminar familia?')) return;
        const { error } = await supabase!.from('familias').delete().eq('id', id);
        if (error) toast(error.message);
        await render();
      } finally {
        button.disabled = false;
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-delete-tipo]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['deleteTipo'];
      if (!id) return;
      button.disabled = true;
      try {
        const productosDependientes = await selectRowsWhere(
          'productos',
          'id',
          'nombre_es',
          { tipo_id: id },
          1000
        );
        const bloqueo = mensajeBloqueoEliminarTipo(productosDependientes.length);
        if (bloqueo) {
          toast(bloqueo);
          return;
        }
        if (!confirm('Eliminar tipo?')) return;
        const { error } = await supabase!.from('tipos').delete().eq('id', id);
        if (error) toast(error.message);
        await render();
      } finally {
        button.disabled = false;
      }
    });
  });

  app
    .querySelector<HTMLButtonElement>('[data-delete-empty-tipos]')
    ?.addEventListener('click', async () => {
      const tiposRows = await selectRows('tipos', 'id,nombre_es', 'orden', 300);
      const productosRows = await selectRows('productos', 'id,tipo_id', 'nombre_es', 500);
      const conteo = new Map<string, number>();
      for (const producto of productosRows) {
        const tipoId = text(producto.tipo_id);
        if (!tipoId) continue;
        conteo.set(tipoId, (conteo.get(tipoId) ?? 0) + 1);
      }
      const tiposSinProductos = tiposRows.filter(tipo => (conteo.get(text(tipo.id)) ?? 0) === 0);
      if (tiposSinProductos.length === 0) {
        toast('No hay tipos sin productos');
        return;
      }
      if (
        !confirm(
          `Eliminar ${tiposSinProductos.length} tipos sin productos? Esta acción no se puede deshacer.`
        )
      ) {
        return;
      }
      for (const tipo of tiposSinProductos) {
        const { error } = await supabase!.from('tipos').delete().eq('id', text(tipo.id));
        if (error) {
          toast(error.message);
          return;
        }
      }
      toast(`Eliminados ${tiposSinProductos.length} tipos sin productos`);
      await render();
    });
}

function bindFulfillments() {
  app.querySelectorAll<HTMLFormElement>('[data-fulfillment-form]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const id = String(data.get('id') ?? '');
      const estado = String(data.get('estado') ?? 'pendiente');
      const tracking_number = emptyToNull(data.get('tracking_number'));
      const tracking_url = emptyToNull(data.get('tracking_url'));
      const notas = emptyToNull(data.get('notas'));
      const before = await getRow('fulfillments', id);
      const cambios: Row = {
        estado,
        tracking_number,
        tracking_url,
        notas: appendNotaInterna(
          notas ?? text(before?.notas),
          `[${timestampCorto()}] Estado: ${text(before?.estado) || 'pendiente'} -> ${estado}`
        ),
      };
      const { error } = await supabase!.from('fulfillments').update(cambios).eq('id', id);
      if (error) {
        toast(error.message);
        return;
      }
      toast('Fulfillment actualizado');
      await render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-fulfillment-quick-estado]').forEach(button => {
    button.addEventListener('click', async () => {
      const row = button.closest<HTMLFormElement>('[data-fulfillment-form]');
      const id = row?.querySelector<HTMLInputElement>('input[name="id"]')?.value ?? '';
      const estado = button.dataset['fulfillmentQuickEstado'] ?? '';
      if (!id || !estado) return;
      const ok = await actualizarSeguimientoFulfillment(id, estado);
      if (ok) toast(`Fulfillment actualizado a ${estado}.`);
      await render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-fulfillment-copy-summary]').forEach(button => {
    button.addEventListener('click', async () => {
      const summary =
        button
          .closest<HTMLFormElement>('[data-fulfillment-form]')
          ?.querySelector<HTMLElement>('[data-fulfillment-summary]')
          ?.textContent?.trim() ?? '';
      if (!summary) return;
      try {
        await navigator.clipboard.writeText(summary);
        toast('Copiado al portapapeles.');
      } catch {
        toast('No se pudo copiar el texto.');
      }
    });
  });
  const filterForm = app.querySelector<HTMLFormElement>('[data-fulfillments-filter]');
  filterForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(filterForm);
    const params = new URLSearchParams();
    for (const key of ['estado', 'proveedor_id', 'desde', 'hasta']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    location.hash = `#/fulfillments${qs ? `?${qs}` : ''}`;
  });
  app.querySelectorAll<HTMLButtonElement>('[data-resend-notification]').forEach(button => {
    button.addEventListener('click', async () => {
      const fulfillmentId = button.dataset['resendNotification'];
      if (!fulfillmentId) return;
      const { error } = await supabase!.functions.invoke('notificar-proveedor', {
        body: { fulfillment_id: fulfillmentId },
      });
      toast(error ? error.message : 'Notificacion enviada al proveedor.');
    });
  });
}

function bindArticulos() {
  const form = app.querySelector<HTMLFormElement>('[data-article-form]');
  if (!form) return;

  const filterInput = app.querySelector<HTMLInputElement>('[data-article-filter]');
  filterInput?.addEventListener('input', () => {
    const q = filterInput.value.trim().toLowerCase();
    app.querySelectorAll<HTMLTableRowElement>('[data-article-row]').forEach(row => {
      const hay = row.getAttribute('data-filter-text') || '';
      row.hidden = Boolean(q) && !hay.includes(q);
    });
  });

  if (state.recordId) {
    app.querySelector('#article-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('input', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== 'titulo_es') return;
    const slug = form.elements.namedItem('slug');
    if (slug instanceof HTMLInputElement && !slug.value) slug.value = slugify(target.value);
  });

  form.querySelectorAll<HTMLButtonElement>('[data-upload]').forEach(button => {
    button.addEventListener('click', async () => uploadFile(button, form));
  });

  bindMarkdownToolbars(form);

  const previewEs = form.querySelector<HTMLElement>('[data-article-preview-es]');
  const previewEn = form.querySelector<HTMLElement>('[data-article-preview-en]');
  const syncPreview = () => {
    const cuerpoEs = form.elements.namedItem('cuerpo_es');
    const cuerpoEn = form.elements.namedItem('cuerpo_en');
    if (previewEs && cuerpoEs instanceof HTMLTextAreaElement) {
      previewEs.innerHTML = renderMarkdown(cuerpoEs.value || '');
    }
    if (previewEn && cuerpoEn instanceof HTMLTextAreaElement) {
      previewEn.innerHTML = renderMarkdown(cuerpoEn.value || '');
    }
  };
  form.addEventListener('input', syncPreview);
  syncPreview();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = String(data.get('id') ?? '');
    const rawSlug = String(data.get('slug') ?? '').trim();
    const tituloEs = String(data.get('titulo_es') ?? '').trim();
    const slug = sanitizeArticuloSlug(rawSlug) || slugify(tituloEs);
    const autorTipoRaw = String(data.get('autor_tipo') ?? 'ime').trim();
    const autorTipo =
      autorTipoRaw === 'cliente' || autorTipoRaw === 'fabricante' ? autorTipoRaw : 'ime';
    const payload: Row = {
      slug,
      titulo_es: tituloEs,
      titulo_en: emptyToNull(data.get('titulo_en')),
      cuerpo_es: emptyToNull(data.get('cuerpo_es')),
      cuerpo_en: emptyToNull(data.get('cuerpo_en')),
      imagen: emptyToNull(data.get('imagen')),
      autor_tipo: autorTipo,
      autor_nombre: emptyToNull(data.get('autor_nombre')) || 'Equipo I-ME',
      autor_empresa: emptyToNull(data.get('autor_empresa')),
      autor_bio_corta: emptyToNull(data.get('autor_bio_corta')),
      publicado:
        form.elements.namedItem('publicado') instanceof HTMLInputElement &&
        (form.elements.namedItem('publicado') as HTMLInputElement).checked,
    };

    if (!slug || !tituloEs) {
      toast('Completa slug y titulo ES');
      return;
    }
    if (!isValidArticuloSlug(slug)) {
      toast('Slug invalido: usa solo letras, numeros y guiones (sin URLs)');
      return;
    }

    if (id) {
      payload.slug = await uniqueArticuloSlug(slug, id);
      const { error } = await supabase!.from('articulos').update(payload).eq('id', id);
      if (error) {
        toast(error.message);
        return;
      }
      if (payload['publicado'] === true) await triggerRebuild();
      toast(
        payload['publicado'] === true
          ? 'Articulo guardado y publicacion solicitada'
          : 'Articulo guardado como borrador'
      );
      location.hash = `#/conocimiento?id=${encodeURIComponent(id)}`;
      await render();
      return;
    }

    payload.slug = await uniqueArticuloSlug(slug);
    const { data: inserted, error } = await supabase!
      .from('articulos')
      .insert(payload)
      .select('id')
      .single();
    if (error) {
      toast(error.message);
      return;
    }
    const insertedId = text(inserted?.id);
    if (payload['publicado'] === true) await triggerRebuild();
    toast(
      payload['publicado'] === true
        ? 'Articulo creado y publicacion solicitada'
        : 'Articulo creado como borrador'
    );
    location.hash = `#/conocimiento?id=${encodeURIComponent(insertedId)}`;
    await render();
  });

  form.querySelector('[data-article-delete]')?.addEventListener('click', async () => {
    const id = String(new FormData(form).get('id') ?? '');
    if (!id || !confirm('Eliminar articulo?')) return;
    const { error } = await supabase!.from('articulos').delete().eq('id', id);
    if (error) {
      toast(error.message);
      return;
    }
    toast('Articulo eliminado');
    location.hash = '#/conocimiento';
    await render();
  });
}

function bindMarkdownToolbars(form: HTMLFormElement) {
  form.querySelectorAll<HTMLElement>('[data-md-editor]').forEach(editor => {
    const textarea = editor.querySelector<HTMLTextAreaElement>('[data-md-body]');
    if (!textarea) return;
    editor.querySelectorAll<HTMLButtonElement>('[data-md-cmd]').forEach(button => {
      button.addEventListener('click', () => {
        applyMarkdownCommand(textarea, button.dataset.mdCmd || '');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });
}

function applyMarkdownCommand(textarea: HTMLTextAreaElement, cmd: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  const wrap = (before: string, after: string, placeholder: string) => {
    const body = selected || placeholder;
    const next = value.slice(0, start) + before + body + after + value.slice(end);
    textarea.value = next;
    const selStart = start + before.length;
    textarea.focus();
    textarea.setSelectionRange(selStart, selStart + body.length);
  };

  const prefixLines = (prefix: string) => {
    const block = selected || 'item';
    const lined = block
      .split('\n')
      .map(line => (line.trim() ? `${prefix}${line.replace(/^\s*[-*>]\s*/, '')}` : line))
      .join('\n');
    const next = value.slice(0, start) + lined + value.slice(end);
    textarea.value = next;
    textarea.focus();
    textarea.setSelectionRange(start, start + lined.length);
  };

  switch (cmd) {
    case 'h2':
      wrap('\n## ', '\n', 'Titulo');
      break;
    case 'h3':
      wrap('\n### ', '\n', 'Subtitulo');
      break;
    case 'bold':
      wrap('**', '**', 'negrita');
      break;
    case 'italic':
      wrap('_', '_', 'cursiva');
      break;
    case 'link':
      wrap('[', '](https://i-me.com.co/es/)', 'texto del enlace');
      break;
    case 'ul':
      prefixLines('- ');
      break;
    case 'quote':
      prefixLines('> ');
      break;
    case 'hr': {
      const snippet = '\n\n---\n\n';
      textarea.value = value.slice(0, start) + snippet + value.slice(end);
      const pos = start + snippet.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
      break;
    }
    case 'pdp':
      wrap('[', '](/es/productos/slug-del-producto/)', 'Nombre producto');
      break;
    default:
      break;
  }
}

function bindProveedorProductos() {
  const form = app.querySelector<HTMLFormElement>('[data-pp-form]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const productoId = String(data.get('producto_id') ?? '');
    if (!productoId) {
      toast('Selecciona un producto');
      return;
    }
    const payload: Row = {
      proveedor_id: String(data.get('proveedor_id') ?? ''),
      producto_id: productoId,
      precio_costo: numberOrZero(data.get('precio_costo')),
      moneda_costo: emptyToNull(data.get('moneda_costo')) ?? 'COP',
      prioridad: numberOrZero(data.get('prioridad')) || 1,
      activo:
        form.elements.namedItem('activo') instanceof HTMLInputElement
          ? (form.elements.namedItem('activo') as HTMLInputElement).checked
          : true,
    };
    const { error } = await supabase!.from('proveedor_producto').insert(payload);
    if (error) {
      toast(error.message);
      return;
    }
    toast('Producto asignado');
    await render();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-remove-pp]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['removePp'];
      if (!id || !confirm('Quitar esta asignacion?')) return;
      const { error } = await supabase!.from('proveedor_producto').delete().eq('id', id);
      if (error) toast(error.message);
      await render();
    });
  });
}

async function actualizarEstadoPedido(id: string, estado: string): Promise<boolean> {
  const before = await getRow('pedidos', id);
  const estadoAnterior = text(before?.estado);
  if (estadoAnterior === estado) {
    toast(`El pedido ya esta ${pedidoEstadoLabel(estado)}.`);
    return true;
  }
  const { error } = await supabase!.from('pedidos').update({ estado }).eq('id', id);
  if (error) {
    toast(error.message);
    return false;
  }
  await registrarEventoPedido(id, {
    tipo: 'estado_actualizado',
    de_estado: estadoAnterior || null,
    a_estado: estado,
    metadata: { source: 'admin' },
  });
  void notificarClienteEstado(id, estado, estadoAnterior || undefined);
  return true;
}

const ESTADOS_NOTIFICABLES = new Set([
  'pendiente',
  'pendiente_validacion',
  'pagado',
  'procesando',
  'preparando',
  'enviado',
  'entregado',
  'retrasado',
  'rechazado',
  'expirado',
  'cancelado',
  'reembolsado',
  'error_verificacion',
]);

async function notificarClienteEstado(
  pedidoId: string,
  estado: string,
  estadoAnterior?: string
): Promise<void> {
  if (!ESTADOS_NOTIFICABLES.has(estado)) return;
  try {
    const { data, error } = await supabase!.functions.invoke('notificar-cliente', {
      body: { pedido_id: pedidoId, a_estado: estado, de_estado: estadoAnterior },
    });
    const result = data as { ok?: boolean; detalle?: string } | null;
    if (error || !result?.ok) {
      toast(`Email al cliente no enviado: ${error?.message ?? result?.detalle ?? 'error'}`);
    } else {
      toast('Email de cambio de estado enviado al cliente');
    }
  } catch {
    toast('Email al cliente no enviado (error de red)');
  }
}

async function registrarEventoPedido(
  id: string,
  payload: {
    tipo: string;
    de_estado?: string | null;
    a_estado?: string | null;
    metadata?: Row['metadata'];
  }
): Promise<void> {
  const {
    data: { user },
  } = await supabase!.auth.getUser();
  await supabase!.from('pedido_eventos').insert({
    pedido_id: id,
    actor_id: user?.id ?? null,
    actor_email: user?.email ?? state.email,
    tipo: String(payload.tipo ?? 'admin'),
    de_estado: payload.de_estado ?? null,
    a_estado: payload.a_estado ?? null,
    metadata: payload.metadata ?? {},
  });
}

function bindSimpleTables() {
  app.querySelectorAll<HTMLButtonElement>('[data-mark-read]').forEach(button => {
    button.addEventListener('click', async () => {
      const tableName = button.dataset['table'];
      const id = button.dataset['markRead'];
      if (!tableName || !id) return;
      const { error } = await supabase!.from(tableName).update({ leida: true }).eq('id', id);
      if (error) toast(error.message);
      await render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-csv]').forEach(button => {
    button.addEventListener('click', () => {
      const raw = button.dataset['csv'];
      if (!raw) return;
      downloadCsv(button.dataset['filename'] ?? 'export.csv', JSON.parse(raw) as Row[]);
    });
  });

  const pedidoForm = app.querySelector<HTMLFormElement>('[data-pedido-estado-form]');
  pedidoForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(pedidoForm);
    const id = String(data.get('id') ?? '');
    const estado = String(data.get('estado') ?? '');
    if (!id || !estado) return;
    if (
      estado === 'retrasado' &&
      !confirm(
        'Marcar como "retrasado" implica que un pedido ya pagado no podra cumplirse a tiempo (Escenario A). Recuerda contactar al cliente manualmente. Continuar?'
      )
    ) {
      return;
    }
    const ok = await actualizarEstadoPedido(id, estado);
    if (ok) toast('Estado actualizado.');
    await render();
  });
}

function bindEntityExcelTools() {
  app.querySelectorAll<HTMLButtonElement>('[data-entity-export-xlsx]').forEach(button => {
    button.addEventListener('click', async () => {
      const entity = getExcelEntity(button.dataset['entityExportXlsx']);
      if (!entity) return;
      const originalText = button.textContent ?? 'Exportar Excel';
      try {
        button.disabled = true;
        button.textContent = 'Exportando...';
        await exportEntityExcel(entity);
        toast('Excel exportado');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'No se pudo exportar a Excel');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-entity-template-xlsx]').forEach(button => {
    button.addEventListener('click', () => {
      const entity = getExcelEntity(button.dataset['entityTemplateXlsx']);
      if (!entity) return;
      try {
        downloadWorkbook(
          buildEntityTemplateWorkbook(entity),
          `${entity}-plantilla-${new Date().toISOString().slice(0, 10)}.xlsx`
        );
        toast('Plantilla descargada');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'No se pudo descargar la plantilla');
      }
    });
  });

  app.querySelectorAll<HTMLFormElement>('[data-entity-import-form]').forEach(form => {
    const entity = getExcelEntity(form.dataset['entityImportForm']);
    const fileInput = form.querySelector<HTMLInputElement>('[data-entity-import-file]');
    const statusEl = form.querySelector<HTMLElement>('[data-entity-import-status]');
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (statusEl) {
        statusEl.textContent = file
          ? `Archivo seleccionado: ${file.name}`
          : 'Sin archivo seleccionado.';
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const file = fileInput?.files?.[0];
      if (!entity || !file) {
        toast('Selecciona un archivo Excel.');
        return;
      }
      try {
        if (statusEl) statusEl.textContent = 'Leyendo Excel...';
        const result = await importEntityExcel(entity, file);
        if (statusEl) {
          statusEl.innerHTML = `<strong>Importación completada.</strong> ${result.processed} filas procesadas, ${result.skipped} omitidas.`;
        }
        toast(`Importación ${entity}: ${result.processed} filas`);
        await render();
      } catch (error) {
        const message = formatImportError(error);
        if (statusEl) {
          statusEl.innerHTML = `<span class="admin-import-error">Error al importar:</span> ${escapeHtml(message)}`;
        }
        toast(message);
      }
    });
  });
}

function leerLineasOfertaDesdeDom(): Array<{
  slug: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  moneda: string;
}> {
  return Array.from(app.querySelectorAll<HTMLElement>('[data-cotizacion-linea]')).map(row => {
    const slug = row.querySelector<HTMLInputElement>('[data-linea-slug]')?.value ?? '';
    const nombre = row.querySelector<HTMLInputElement>('[data-linea-nombre]')?.value ?? slug;
    const moneda = row.querySelector<HTMLInputElement>('[data-linea-moneda]')?.value || 'COP';
    const cantidad = Math.max(
      1,
      Math.floor(Number(row.querySelector<HTMLInputElement>('[data-linea-cantidad]')?.value ?? 1))
    );
    const precio = Math.max(
      0,
      Number(row.querySelector<HTMLInputElement>('[data-linea-precio]')?.value ?? 0)
    );
    return {
      slug,
      nombre,
      cantidad,
      precio_unitario: precio,
      subtotal: Math.round(precio * cantidad * 100) / 100,
      moneda,
    };
  });
}

function syncCotizacionTotalesDom() {
  const monedaSelect = app.querySelector<HTMLSelectElement>('[data-cotizacion-moneda]');
  const monedaCabecera = normalizarMonedaCotizacion(monedaSelect?.value);
  const lineas = leerLineasOfertaDesdeDom().map(l => ({ ...l, moneda: monedaCabecera }));
  let total = 0;
  app.querySelectorAll<HTMLElement>('[data-cotizacion-linea]').forEach((row, index) => {
    const linea = lineas[index];
    if (!linea) return;
    const monedaInput = row.querySelector<HTMLInputElement>('[data-linea-moneda]');
    if (monedaInput) monedaInput.value = monedaCabecera;
    total += linea.subtotal;
    const cell = row.querySelector<HTMLElement>('[data-linea-subtotal]');
    if (cell) cell.textContent = crmMoney(linea.subtotal, monedaCabecera);
  });
  const totalEl = app.querySelector<HTMLElement>('[data-cotizacion-total-ofertado]');
  if (totalEl) totalEl.textContent = crmMoney(total, monedaCabecera);
}

type CotizacionAdjunto = { path: string; nombre: string; tipo: string; size: number };
const COTIZACION_ADJUNTO_MAX_BYTES = 25 * 1024 * 1024;
const COTIZACION_ADJUNTO_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'jpg',
  'jpeg',
  'png',
  'webp',
]);

function adjuntosCotizacionActuales(): CotizacionAdjunto[] {
  const raw = app.querySelector<HTMLInputElement>('[data-cotizacion-adjuntos-actuales]')?.value;
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          item => item && typeof item.path === 'string' && typeof item.nombre === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

async function guardarAdjuntosCotizacion(id: string): Promise<CotizacionAdjunto[] | null> {
  const input = app.querySelector<HTMLInputElement>('[data-cotizacion-adjuntos]');
  const status = app.querySelector<HTMLElement>('[data-cotizacion-adjuntos-estado]');
  const actuales = adjuntosCotizacionActuales();
  const files = Array.from(input?.files ?? []);
  if (!files.length) return actuales;
  const total =
    actuales.reduce((sum, item) => sum + Number(item.size || 0), 0) +
    files.reduce((sum, file) => sum + file.size, 0);
  if (total > COTIZACION_ADJUNTO_MAX_BYTES) {
    toast('Los adjuntos no pueden superar 25 MB en total.');
    return null;
  }
  const nuevos: CotizacionAdjunto[] = [];
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!COTIZACION_ADJUNTO_EXTENSIONS.has(extension)) {
      toast(`Formato no permitido: ${file.name}`);
      return null;
    }
    const nombre = file.name.replace(/[\\/]/g, '_').slice(0, 160);
    const path = `${id}/${crypto.randomUUID()}-${nombre}`;
    if (status) status.textContent = `Subiendo ${nombre}...`;
    const { error } = await supabase!.storage.from('cotizaciones-adjuntos').upload(path, file, {
      upsert: false,
      ...(file.type ? { contentType: file.type } : {}),
    });
    if (error) {
      toast(`No se pudo subir ${nombre}: ${error.message}`);
      return null;
    }
    nuevos.push({ path, nombre, tipo: file.type, size: file.size });
  }
  const resultado = [...actuales, ...nuevos];
  if (status)
    status.textContent = `Adjuntos guardados: ${resultado.map(item => item.nombre).join(', ')}`;
  return resultado;
}

function bindCotizaciones() {
  app
    .querySelector<HTMLButtonElement>('[data-cotizacion-nuevo]')
    ?.addEventListener('click', async () => {
      if (!supabase) return;
      const btn = app.querySelector<HTMLButtonElement>('[data-cotizacion-nuevo]');
      if (btn) btn.disabled = true;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const today = new Date();
      const validez = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      let payload: Record<string, unknown> = {
        nombre: 'Nuevo contacto',
        email: 'cliente@ejemplo.com',
        telefono: '',
        empresa: null,
        mensaje: 'Presupuesto creado desde admin.',
        productos: [],
        condiciones: '',
        moneda: 'COP',
        mercado: 'CO',
        estado: 'nueva',
        leida: true,
        consentimiento_datos: false,
        locale: 'es',
        origen: 'admin',
        tipo_solicitud: 'cotizacion',
        validez_hasta: validez,
        precio_total_ofertado: 0,
        ...(userId ? { created_by: userId } : {}),
      };
      let inserted = await supabase
        .from('solicitudes_cotizacion')
        .insert(payload)
        .select('id')
        .maybeSingle();
      // Compatibilidad con esquemas legacy: quitar columnas desconocidas y reintentar.
      for (let attempt = 0; attempt < 5 && inserted.error; attempt += 1) {
        const msg = inserted.error.message || '';
        if (!/column|schema cache|Could not find/i.test(msg)) break;
        const match = msg.match(/['"]([a-zA-Z0-9_]+)['"]/);
        if (match?.[1] && match[1] in payload) {
          const next = { ...payload };
          delete next[match[1]];
          payload = next;
        } else {
          break;
        }
        inserted = await supabase
          .from('solicitudes_cotizacion')
          .insert(payload)
          .select('id')
          .maybeSingle();
      }
      if (btn) btn.disabled = false;
      if (inserted.error || !inserted.data) {
        toast(inserted.error?.message ?? 'No se pudo crear el presupuesto.');
        return;
      }
      const id = text((inserted.data as Row).id);
      toast('Presupuesto creado. Completa productos, precios y envía.');
      location.hash = `#/cotizacion?id=${encodeURIComponent(id)}`;
    });

  app.querySelectorAll<HTMLButtonElement>('[data-cotizacion-quick-estado]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = state.recordId;
      const estado = button.dataset['cotizacionQuickEstado'] ?? '';
      if (!id || !estado) return;
      const ok = await actualizarSeguimientoCotizacion(id, estado, {
        nota: `Actualizado desde acciones rápidas a ${cotizacionEstadoLabel(estado)}.`,
      });
      if (ok) toast(`Cotizacion actualizada a ${cotizacionEstadoLabel(estado)}.`);
      await render();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-cotizacion-nota-template]').forEach(button => {
    button.addEventListener('click', () => {
      const target = app.querySelector<HTMLTextAreaElement>('[data-cotizacion-nota-input]');
      const value = button.dataset['cotizacionNotaTemplate'] ?? '';
      if (!target || !value) return;
      target.value = value;
      target.focus();
      target.setSelectionRange(value.length, value.length);
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-cotizacion-copy-summary]').forEach(button => {
    button.addEventListener('click', async () => {
      const summary =
        app.querySelector<HTMLElement>('[data-cotizacion-summary]')?.textContent?.trim() ?? '';
      if (!summary) return;
      try {
        await navigator.clipboard.writeText(summary);
        toast('Copiado al portapapeles.');
      } catch {
        toast('No se pudo copiar el texto.');
      }
    });
  });

  const cotizacionForm = app.querySelector<HTMLFormElement>('[data-cotizacion-estado-form]');
  cotizacionForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(cotizacionForm);
    const id = String(data.get('id') ?? '');
    const estado = String(data.get('estado') ?? '');
    const notas = String(data.get('notas_internas') ?? '');
    if (!id || !estado) return;
    const ok = await actualizarSeguimientoCotizacion(id, estado, { notas });
    if (ok) toast('Seguimiento actualizado.');
    await render();
  });

  const bindLineaOferta = (row: HTMLElement) => {
    row
      .querySelectorAll<HTMLInputElement>('[data-linea-cantidad], [data-linea-precio]')
      .forEach(input => input.addEventListener('input', syncCotizacionTotalesDom));
    row.querySelector<HTMLButtonElement>('[data-linea-eliminar]')?.addEventListener('click', () => {
      row.remove();
      syncCotizacionTotalesDom();
    });
  };
  app.querySelectorAll<HTMLElement>('[data-cotizacion-linea]').forEach(bindLineaOferta);
  app
    .querySelector<HTMLButtonElement>('[data-cotizacion-linea-agregar]')
    ?.addEventListener('click', () => {
      const moneda = normalizarMonedaCotizacion(
        app.querySelector<HTMLSelectElement>('[data-cotizacion-moneda]')?.value
      );
      const body = app.querySelector<HTMLTableSectionElement>('.admin-table tbody');
      if (!body) return;
      body.insertAdjacentHTML('beforeend', cotizacionLineaNuevaHtml(moneda));
      const lineaNueva = body.lastElementChild;
      if (!(lineaNueva instanceof HTMLElement)) return;
      bindLineaOferta(lineaNueva);
      lineaNueva.querySelector<HTMLInputElement>('[data-linea-nombre]')?.focus();
      syncCotizacionTotalesDom();
    });
  app
    .querySelector<HTMLSelectElement>('[data-cotizacion-moneda]')
    ?.addEventListener('change', event => {
      const moneda = normalizarMonedaCotizacion((event.target as HTMLSelectElement).value);
      aplicarMonedaOfertaDom(moneda);
    });
  syncCotizacionTotalesDom();

  const appendAdminQuoteLine = (line: CotizacionLineaOferta) => {
    const moneda = normalizarMonedaCotizacion(
      app.querySelector<HTMLSelectElement>('[data-cotizacion-moneda]')?.value
    );
    const body = app.querySelector<HTMLTableSectionElement>(
      '[data-cotizacion-oferta-form] .admin-table tbody'
    );
    if (!body) return;
    body.insertAdjacentHTML('beforeend', cotizacionLineaFromOfertaHtml(line, moneda));
    const lineaNueva = body.lastElementChild;
    if (lineaNueva instanceof HTMLElement) bindLineaOferta(lineaNueva);
    syncCotizacionTotalesDom();
  };

  if (supabase) {
    bindQuoteCatalogSearch({
      root: app,
      supabase,
      escapeHtml,
      toast,
      getMoneda: () =>
        normalizarMonedaCotizacion(
          app.querySelector<HTMLSelectElement>('[data-cotizacion-moneda]')?.value
        ),
      onAddLine: appendAdminQuoteLine,
      searchInput: app.querySelector<HTMLInputElement>('[data-cotizacion-catalog-search]'),
      suggestList: app.querySelector<HTMLElement>('[data-cotizacion-catalog-suggest]'),
    });
    bindQuoteProductIngest({
      root: app,
      supabase,
      escapeHtml,
      toast,
      getMoneda: () =>
        normalizarMonedaCotizacion(
          app.querySelector<HTMLSelectElement>('[data-cotizacion-moneda]')?.value
        ),
      onAddLine: appendAdminQuoteLine,
      trigger: app.querySelector<HTMLElement>('[data-cotizacion-ingest-pdf]'),
      fileInput: app.querySelector<HTMLInputElement>('[data-cotizacion-ingest-file]'),
      modalSlot: app.querySelector<HTMLElement>('[data-cotizacion-modal-slot]'),
    });
  }

  const ofertaForm = app.querySelector<HTMLFormElement>('[data-cotizacion-oferta-form]');
  ofertaForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(ofertaForm);
    const id = String(data.get('id') ?? '');
    if (!id) return;
    const moneda = normalizarMonedaCotizacion(data.get('moneda'));
    aplicarMonedaOfertaDom(moneda);
    const lineas = leerLineasOfertaDesdeDom()
      .filter(l => l.slug || l.nombre)
      .map(l => ({ ...l, moneda }));
    if (lineas.length === 0) {
      toast('No hay lineas de producto.');
      return;
    }
    if (lineas.some(l => !(l.precio_unitario > 0))) {
      toast('Todas las lineas necesitan precio unitario > 0.');
      return;
    }
    const condiciones = String(data.get('condiciones') ?? '').trim();
    if (!condiciones) {
      toast('Completa las condiciones de la cotizacion.');
      return;
    }
    const validez = String(data.get('validez_hasta') ?? '').trim() || null;
    const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);
    const mercado = moneda === 'USD' ? 'INTL' : 'CO';
    const adjuntos = await guardarAdjuntosCotizacion(id);
    if (!adjuntos) return;
    const { error } = await supabase!
      .from('solicitudes_cotizacion')
      .update({
        nombre: emptyToNull(data.get('nombre')),
        empresa: emptyToNull(data.get('empresa')),
        email: emptyToNull(data.get('email')),
        telefono: emptyToNull(data.get('telefono')),
        mensaje: emptyToNull(data.get('mensaje')),
        nit: emptyToNull(data.get('nit')),
        responsable_iva: data.get('responsable_iva') === 'on',
        impuestos_incluidos: data.get('impuestos_incluidos') === 'on',
        direccion_envio: emptyToNull(data.get('direccion_envio')),
        direccion_facturacion: emptyToNull(data.get('direccion_facturacion')),
        adjuntos,
        productos: lineas,
        condiciones,
        validez_hasta: validez,
        precio_total_ofertado: total,
        moneda,
        mercado,
        leida: true,
      })
      .eq('id', id);
    if (error) {
      toast(error.message);
      return;
    }
    toast(`Oferta guardada en ${moneda}.`);
    await render();
  });

  const COTIZACION_ERROR_MENSAJES: Record<string, string> = {
    OFERTA_SIN_LINEAS: 'La cotizacion no tiene lineas de producto validas. Revisa el detalle.',
    OFERTA_SIN_PRECIO:
      'Falta el precio unitario en alguna linea. Completalo y pulsa "Guardar oferta" antes de enviar.',
    OFERTA_SIN_CONDICIONES:
      'Faltan las observaciones/condiciones. Completalas y pulsa "Guardar oferta" antes de enviar.',
    OFERTA_MONEDA_MIXTA: 'Hay lineas en COP y USD. Unifica la moneda de la oferta antes de enviar.',
    SIN_EMAIL: 'La cotizacion no tiene email de cliente.',
    COTIZACION_YA_CONVERTIDA: 'Esta cotizacion ya se convirtio en pedido.',
    EMAIL_FALLIDO: 'Email no salio. Cotizacion no marcada enviada. Reintenta el envio.',
    TEMPLATE_INACTIVE:
      'La plantilla de oferta esta desactivada. Activala en email_templates y reintenta.',
    PDF_RENDER_FAILED: 'No se pudo generar o guardar el PDF. Reintenta el envio.',
    SEND_IN_FLIGHT: 'Hay un envio en curso. Espera unos segundos y reintenta.',
    NUMERO_CONFLICT: 'Conflicto al asignar numero. Reintenta.',
    UNAUTHORIZED: 'Tu sesion no tiene permisos para esta accion. Vuelve a iniciar sesion.',
  };

  async function invokeCotizacionFn(
    name: string,
    body: Record<string, unknown>
  ): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
    const { data, error } = await supabase!.functions.invoke(name, { body });
    if (error) {
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        try {
          const json = (await context.json()) as {
            error?: { message?: string; code?: string };
          };
          const code = json?.error?.code ?? '';
          if (code && COTIZACION_ERROR_MENSAJES[code]) {
            return { ok: false, message: COTIZACION_ERROR_MENSAJES[code]! };
          }
          if (json?.error?.message) return { ok: false, message: json.error.message };
        } catch {
          /* ignore */
        }
      }
      return { ok: false, message: error.message };
    }
    const json = (data ?? {}) as Record<string, unknown>;
    if (json.ok === false || (json.error && !json.ok)) {
      const err = json.error as { message?: string; code?: string } | string | undefined;
      if (err && typeof err === 'object' && err.code && COTIZACION_ERROR_MENSAJES[err.code]) {
        return { ok: false, message: COTIZACION_ERROR_MENSAJES[err.code]! };
      }
      const message =
        typeof err === 'string' ? err : err?.message || 'La operacion no se pudo completar.';
      return { ok: false, message };
    }
    return { ok: true, data: json };
  }

  async function validarOfertaDomParaEnvio(): Promise<
    | {
        ok: true;
        id: string;
        lineasConMoneda: ReturnType<typeof leerLineasOfertaDesdeDom>;
        condicionesDom: string;
        validezDom: string;
        moneda: 'COP' | 'USD';
        mercado: 'CO' | 'INTL';
        datosOferta: FormData;
      }
    | { ok: false }
  > {
    const id = state.recordId;
    if (!id || !ofertaForm) return { ok: false };
    const datosOferta = new FormData(ofertaForm);
    const lineasDom = leerLineasOfertaDesdeDom().filter(l => l.slug || l.nombre);
    const condicionesDom =
      app.querySelector<HTMLTextAreaElement>('[data-cotizacion-oferta-form] [name="condiciones"]')
        ?.value ?? '';
    if (lineasDom.length === 0) {
      toast(COTIZACION_ERROR_MENSAJES['OFERTA_SIN_LINEAS']!);
      return { ok: false };
    }
    if (lineasDom.some(l => !(l.precio_unitario > 0))) {
      toast(COTIZACION_ERROR_MENSAJES['OFERTA_SIN_PRECIO']!);
      return { ok: false };
    }
    if (!condicionesDom.trim()) {
      toast(COTIZACION_ERROR_MENSAJES['OFERTA_SIN_CONDICIONES']!);
      return { ok: false };
    }
    const validezDom =
      app.querySelector<HTMLInputElement>('[data-cotizacion-oferta-form] [name="validez_hasta"]')
        ?.value ?? '';
    const moneda = normalizarMonedaCotizacion(
      app.querySelector<HTMLSelectElement>('[data-cotizacion-moneda]')?.value
    );
    aplicarMonedaOfertaDom(moneda);
    const lineasConMoneda = lineasDom.map(l => ({ ...l, moneda }));
    const mercado = moneda === 'USD' ? 'INTL' : 'CO';
    return {
      ok: true,
      id,
      lineasConMoneda,
      condicionesDom: condicionesDom.trim(),
      validezDom,
      moneda,
      mercado,
      datosOferta,
    };
  }

  async function persistirOfertaAntesDeEnviar(
    payload: Extract<Awaited<ReturnType<typeof validarOfertaDomParaEnvio>>, { ok: true }>
  ): Promise<boolean> {
    const totalDom = payload.lineasConMoneda.reduce((acc, l) => acc + l.subtotal, 0);
    const adjuntos = await guardarAdjuntosCotizacion(payload.id);
    if (!adjuntos) return false;
    const { error: saveError } = await supabase!
      .from('solicitudes_cotizacion')
      .update({
        nombre: emptyToNull(payload.datosOferta.get('nombre')),
        empresa: emptyToNull(payload.datosOferta.get('empresa')),
        email: emptyToNull(payload.datosOferta.get('email')),
        telefono: emptyToNull(payload.datosOferta.get('telefono')),
        mensaje: emptyToNull(payload.datosOferta.get('mensaje')),
        nit: emptyToNull(payload.datosOferta.get('nit')),
        responsable_iva: payload.datosOferta.get('responsable_iva') === 'on',
        impuestos_incluidos: payload.datosOferta.get('impuestos_incluidos') === 'on',
        direccion_envio: emptyToNull(payload.datosOferta.get('direccion_envio')),
        direccion_facturacion: emptyToNull(payload.datosOferta.get('direccion_facturacion')),
        adjuntos,
        productos: payload.lineasConMoneda,
        condiciones: payload.condicionesDom,
        validez_hasta: payload.validezDom.trim() || null,
        precio_total_ofertado: totalDom,
        moneda: payload.moneda,
        mercado: payload.mercado,
        leida: true,
      })
      .eq('id', payload.id);
    if (saveError) {
      toast(`No se pudo guardar la oferta antes de enviar: ${saveError.message}`);
      return false;
    }
    return true;
  }

  const openWhatsAppUrlAdmin = (url: string) => {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) window.location.assign(url);
  };

  async function enviarCotizacionCanal(canal: 'email' | 'whatsapp'): Promise<void> {
    const validated = await validarOfertaDomParaEnvio();
    if (!validated.ok) return;
    const telefono = String(validated.datosOferta.get('telefono') ?? '').trim();
    const email = String(validated.datosOferta.get('email') ?? '').trim();
    if (canal === 'whatsapp' && !telefono) {
      toast('La cotizacion no tiene telefono para WhatsApp.');
      return;
    }
    if (canal === 'email' && !email) {
      toast(COTIZACION_ERROR_MENSAJES['SIN_EMAIL']!);
      return;
    }
    const destino = canal === 'whatsapp' ? telefono : email;
    const confirmMsg =
      canal === 'whatsapp'
        ? `¿Enviar presupuesto por WhatsApp a ${destino}?`
        : '¿Enviar oferta formal al email del solicitante?';
    if (!confirm(confirmMsg)) return;
    const emailBtn = app.querySelector<HTMLButtonElement>('[data-cotizacion-enviar]');
    const waBtn = app.querySelector<HTMLButtonElement>('[data-cotizacion-enviar-whatsapp]');
    const activeBtn = canal === 'whatsapp' ? waBtn : emailBtn;
    if (emailBtn) emailBtn.disabled = true;
    if (waBtn) waBtn.disabled = true;
    if (activeBtn) {
      activeBtn.textContent = canal === 'whatsapp' ? 'Abriendo WhatsApp…' : 'Enviando email…';
    }
    const saved = await persistirOfertaAntesDeEnviar(validated);
    if (!saved) {
      if (emailBtn) emailBtn.disabled = false;
      if (waBtn) waBtn.disabled = false;
      if (emailBtn) emailBtn.textContent = 'Enviar email';
      if (waBtn) waBtn.textContent = 'WhatsApp';
      return;
    }
    const result = await invokeCotizacionFn('enviar-cotizacion', {
      cotizacion_id: validated.id,
      canal,
      productos: validated.lineasConMoneda,
      condiciones: validated.condicionesDom,
      validez_hasta: validated.validezDom.trim() || null,
      moneda: validated.moneda,
      mercado: validated.mercado,
    });
    if (emailBtn) {
      emailBtn.disabled = false;
      emailBtn.textContent = 'Enviar email';
    }
    if (waBtn) {
      waBtn.disabled = false;
      waBtn.textContent = 'WhatsApp';
    }
    if (!result.ok) {
      toast(result.message);
      return;
    }
    if (canal === 'whatsapp' && typeof result.data.whatsapp_url === 'string') {
      openWhatsAppUrlAdmin(result.data.whatsapp_url);
    }
    toast(
      result.data.numero
        ? `Cotizacion ${String(result.data.numero)} enviada (${canal === 'whatsapp' ? 'WhatsApp' : 'email'}).`
        : `Cotizacion enviada (${canal === 'whatsapp' ? 'WhatsApp' : 'email'}).`
    );
    await render();
  }

  async function previewCotizacionPdfAdmin(): Promise<void> {
    const validated = await validarOfertaDomParaEnvio();
    if (!validated.ok) return;
    const saved = await persistirOfertaAntesDeEnviar(validated);
    if (!saved) return;
    const slot = app.querySelector<HTMLElement>('[data-cotizacion-modal-slot]');
    if (!slot) return;
    slot.innerHTML = `<div class="quote-ingest-overlay" data-quote-ingest-overlay role="presentation"><div class="quote-ingest-modal quote-ingest-modal--wide" role="dialog" aria-modal="true"><header class="quote-ingest-modal__head"><h2>Vista previa · Presupuesto</h2><button type="button" class="quote-ingest-modal__close" data-quote-ingest-close aria-label="Cerrar">✕</button></header><div class="quote-ingest-modal__body" data-cotizacion-pdf-body><p class="quote-ingest-help">Generando PDF…</p></div></div></div>`;
    const close = () => slot.replaceChildren();
    slot.querySelectorAll('[data-quote-ingest-close]').forEach(btn => {
      btn.addEventListener('click', close);
    });
    slot.querySelector('[data-quote-ingest-overlay]')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) close();
    });
    const body = slot.querySelector<HTMLElement>('[data-cotizacion-pdf-body]');
    const {
      data: { session },
    } = await supabase!.auth.getSession();
    const token = session?.access_token;
    if (!token || !body) {
      close();
      toast('Sesion expirada.');
      return;
    }
    const url = new URL(
      `${import.meta.env['PUBLIC_SUPABASE_URL']}/functions/v1/comercial-cotizacion`
    );
    url.searchParams.set('action', 'pdf');
    url.searchParams.set('id', validated.id);
    url.searchParams.set('fresh', '1');
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env['PUBLIC_SUPABASE_ANON_KEY'] as string,
      },
    });
    const json = (await response.json().catch(() => null)) as {
      pdf_base64?: string;
      numero?: string;
      error?: { message?: string };
    } | null;
    if (!response.ok || !json?.pdf_base64) {
      body.innerHTML = `<p class="quote-ingest-help">${escapeHtml(json?.error?.message ?? 'No se pudo generar el PDF.')}</p>`;
      return;
    }
    try {
      const binary = atob(json.pdf_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <a class="admin-button" href="${blobUrl}" download="${escapeHtml(json.numero || 'presupuesto')}.pdf">Descargar PDF</a>
          <a class="admin-button admin-button--ghost" href="${blobUrl}" target="_blank" rel="noopener noreferrer">Abrir en pestaña</a>
        </div>
        <object type="application/pdf" data="${blobUrl}" style="width:100%;min-height:min(70vh,720px);border:1px solid var(--admin-line,#ddd);border-radius:8px">
          <p class="quote-ingest-help">Tu navegador no embebe PDF. Usa Descargar o Abrir en pestaña.</p>
        </object>`;
    } catch {
      body.innerHTML = '<p class="quote-ingest-help">No se pudo mostrar el PDF.</p>';
    }
  }

  app
    .querySelector<HTMLButtonElement>('[data-cotizacion-enviar]')
    ?.addEventListener('click', () => void enviarCotizacionCanal('email'));
  app
    .querySelector<HTMLButtonElement>('[data-cotizacion-enviar-whatsapp]')
    ?.addEventListener('click', () => void enviarCotizacionCanal('whatsapp'));
  app
    .querySelector<HTMLButtonElement>('[data-cotizacion-preview]')
    ?.addEventListener('click', () => void previewCotizacionPdfAdmin());

  const selectedCountEl = app.querySelector<HTMLElement>('[data-cotizaciones-selected-count]');
  const selectAllBtn = app.querySelector<HTMLButtonElement>('[data-cotizaciones-select-all]');
  const bulkDeleteBtn = app.querySelector<HTMLButtonElement>('[data-bulk-cotizacion-delete]');

  const getSelectedIds = () =>
    Array.from(app.querySelectorAll<HTMLInputElement>('[data-cotizacion-select]:checked')).map(
      input => input.value
    );

  const syncSelectedCount = () => {
    if (selectedCountEl) selectedCountEl.textContent = String(getSelectedIds().length);
  };

  app.querySelectorAll<HTMLInputElement>('[data-cotizacion-select]').forEach(input => {
    input.addEventListener('change', syncSelectedCount);
  });
  syncSelectedCount();

  selectAllBtn?.addEventListener('click', () => {
    const checkboxes = Array.from(
      app.querySelectorAll<HTMLInputElement>('[data-cotizacion-select]')
    );
    const allChecked = checkboxes.length > 0 && checkboxes.every(input => input.checked);
    checkboxes.forEach(input => {
      input.checked = !allChecked;
    });
    syncSelectedCount();
  });

  bulkDeleteBtn?.addEventListener('click', async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      toast('Selecciona al menos una cotizacion.');
      return;
    }
    if (!confirm(`Eliminar ${ids.length} cotizacion(es)? Esta accion no se puede deshacer.`)) {
      return;
    }
    const { error } = await supabase!.from('solicitudes_cotizacion').delete().in('id', ids);
    if (error) {
      toast(error.message);
      return;
    }
    toast(`${ids.length} cotizacion(es) eliminadas.`);
    await render();
  });
}

function bindClientes() {
  const filterForm = app.querySelector<HTMLFormElement>('[data-clientes-filter]');
  filterForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(filterForm);
    const params = new URLSearchParams();
    for (const key of ['q', 'tipo_cliente']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    location.hash = `#/clientes${params.toString() ? `?${params.toString()}` : ''}`;
  });
  app.querySelector('[data-new-cliente]')?.addEventListener('click', () => {
    location.hash = '#/cliente';
  });

  const form = app.querySelector<HTMLFormElement>('[data-cliente-form]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = String(data.get('id') ?? '');
    const payload: Row = {
      email: String(data.get('email') ?? '')
        .trim()
        .toLowerCase(),
      tipo_cliente: String(data.get('tipo_cliente') ?? 'b2b'),
      nombre: emptyToNull(data.get('nombre')),
      apellido: emptyToNull(data.get('apellido')),
      telefono: emptyToNull(data.get('telefono')),
      institucion: emptyToNull(data.get('institucion')),
      documento_tipo: emptyToNull(data.get('documento_tipo')),
      documento_numero: emptyToNull(data.get('documento_numero')),
      tipo_documento: emptyToNull(data.get('tipo_documento')),
      numero_documento: (() => {
        const tipo = String(data.get('tipo_documento') ?? '') as TipoDocumentoFiscal | '';
        return normalizeNumeroDocumento(tipo || null, String(data.get('numero_documento') ?? ''));
      })(),
      tipo_persona: emptyToNull(data.get('tipo_persona')),
      razon_social: emptyToNull(data.get('razon_social')),
      email_facturacion: emptyToNull(data.get('email_facturacion')),
      responsable_iva:
        form.elements.namedItem('responsable_iva') instanceof HTMLInputElement &&
        (form.elements.namedItem('responsable_iva') as HTMLInputElement).checked,
      agente_retencion:
        form.elements.namedItem('agente_retencion') instanceof HTMLInputElement &&
        (form.elements.namedItem('agente_retencion') as HTMLInputElement).checked,
      agente_reteica:
        form.elements.namedItem('agente_reteica') instanceof HTMLInputElement &&
        (form.elements.namedItem('agente_reteica') as HTMLInputElement).checked,
      direccion_facturacion: (() => {
        const direccion = String(data.get('dir_fact_direccion') ?? '').trim();
        const ciudad = String(data.get('dir_fact_ciudad') ?? '').trim();
        if (!direccion && !ciudad) return null;
        return {
          direccion: direccion || null,
          ciudad: ciudad || null,
          departamento: String(data.get('dir_fact_departamento') ?? '').trim() || null,
          pais: 'CO',
        };
      })(),
      notas: emptyToNull(data.get('notas')),
      consentimiento_datos:
        form.elements.namedItem('consentimiento_datos') instanceof HTMLInputElement &&
        (form.elements.namedItem('consentimiento_datos') as HTMLInputElement).checked,
      consentimiento_timestamp:
        form.elements.namedItem('consentimiento_datos') instanceof HTMLInputElement &&
        (form.elements.namedItem('consentimiento_datos') as HTMLInputElement).checked
          ? new Date().toISOString()
          : null,
    };
    const req = id
      ? supabase!.from('clientes').update(payload).eq('id', id).select('id').single()
      : supabase!.from('clientes').insert(payload).select('id').single();
    const { data: saved, error } = await req;
    if (error) {
      toast(error.message);
      return;
    }
    toast('Cliente guardado');
    location.hash = `#/cliente?id=${encodeURIComponent(text((saved as Row).id))}`;
  });

  const dirForm = app.querySelector<HTMLFormElement>('[data-direccion-form]');
  dirForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(dirForm);
    const payload: Row = {
      cliente_id: String(data.get('cliente_id') ?? ''),
      tipo: String(data.get('tipo') ?? 'facturacion'),
      nombre: emptyToNull(data.get('nombre')),
      telefono: emptyToNull(data.get('telefono')),
      pais: String(data.get('pais') ?? 'CO'),
      departamento: emptyToNull(data.get('departamento')),
      ciudad: emptyToNull(data.get('ciudad')),
      direccion: String(data.get('direccion') ?? ''),
      codigo_postal: emptyToNull(data.get('codigo_postal')),
      principal:
        dirForm.elements.namedItem('principal') instanceof HTMLInputElement &&
        (dirForm.elements.namedItem('principal') as HTMLInputElement).checked,
    };
    const { error } = await supabase!.from('cliente_direcciones').insert(payload);
    if (error) toast(error.message);
    else toast('Direccion agregada');
    await render();
  });
}

function bindCupones() {
  const form = app.querySelector<HTMLFormElement>('[data-cupon-form]');
  const tipoSelect = form?.elements.namedItem('tipo_descuento');
  const valorInput = form?.elements.namedItem('valor');
  const syncValorMax = () => {
    if (!(tipoSelect instanceof HTMLSelectElement) || !(valorInput instanceof HTMLInputElement))
      return;
    if (tipoSelect.value === 'porcentaje') {
      valorInput.max = '100';
      if (Number(valorInput.value) > 100) valorInput.value = '100';
    } else {
      valorInput.removeAttribute('max');
    }
  };
  if (tipoSelect instanceof HTMLSelectElement) {
    tipoSelect.addEventListener('change', syncValorMax);
    syncValorMax();
  }
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = String(data.get('id') ?? '');
    const payload: Row = {
      codigo: String(data.get('codigo') ?? '')
        .trim()
        .toUpperCase(),
      tipo_descuento: String(data.get('tipo_descuento') ?? 'porcentaje'),
      valor: (() => {
        const tipo = String(data.get('tipo_descuento') ?? 'porcentaje');
        const raw = numberOrZero(data.get('valor'));
        return tipo === 'porcentaje' ? Math.min(100, Math.max(0, raw)) : Math.max(0, raw);
      })(),
      moneda: String(data.get('moneda') ?? 'COP'),
      monto_minimo: numberOrNull(data.get('monto_minimo')),
      monto_maximo: numberOrNull(data.get('monto_maximo')),
      limite_uso_total: numberOrNull(data.get('limite_uso_total')),
      limite_uso_por_usuario: numberOrNull(data.get('limite_uso_por_usuario')),
      empieza_at: emptyToNull(data.get('empieza_at')),
      expira_at: emptyToNull(data.get('expira_at')),
      productos_incluidos: lines(data.get('productos_incluidos')),
      productos_excluidos: lines(data.get('productos_excluidos')),
      familias_incluidas: lines(data.get('familias_incluidas')),
      familias_excluidas: lines(data.get('familias_excluidas')),
      emails_permitidos: lines(data.get('emails_permitidos')).map(email => email.toLowerCase()),
      descripcion: emptyToNull(data.get('descripcion')),
      activo:
        form.elements.namedItem('activo') instanceof HTMLInputElement &&
        (form.elements.namedItem('activo') as HTMLInputElement).checked,
      uso_individual:
        form.elements.namedItem('uso_individual') instanceof HTMLInputElement &&
        (form.elements.namedItem('uso_individual') as HTMLInputElement).checked,
      excluir_ofertas:
        form.elements.namedItem('excluir_ofertas') instanceof HTMLInputElement &&
        (form.elements.namedItem('excluir_ofertas') as HTMLInputElement).checked,
      envio_gratis:
        form.elements.namedItem('envio_gratis') instanceof HTMLInputElement &&
        (form.elements.namedItem('envio_gratis') as HTMLInputElement).checked,
    };
    const { error } = id
      ? await supabase!.from('cupones').update(payload).eq('id', id)
      : await supabase!.from('cupones').insert(payload);
    if (error) {
      toast(error.message);
      return;
    }
    toast('Cupon guardado');
    location.hash = '#/cupones';
  });
}

function bindPedidoOperaciones() {
  const copyText = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast('Copiado al portapapeles.');
    } catch {
      toast('No se pudo copiar el texto.');
    }
  };

  app.querySelectorAll<HTMLButtonElement>('[data-pedido-ver-comprobante]').forEach(button => {
    button.addEventListener('click', async () => {
      const path = button.dataset['pedidoVerComprobante'] ?? '';
      if (!path) return;
      const { data, error } = await supabase!.storage
        .from('comprobantes-pago')
        .createSignedUrl(path, 120);
      if (error || !data?.signedUrl) {
        toast(error?.message || 'No se pudo abrir el comprobante.');
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-pedido-validar-transferencia]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['pedidoValidarTransferencia'] ?? state.recordId ?? '';
      if (!id) return;
      if (!confirm('Confirmar que el comprobante es valido y marcar el pedido como pagado?')) {
        return;
      }
      button.disabled = true;
      const { data, error } = await supabase!.functions.invoke('validar-transferencia', {
        body: { pedido_id: id },
      });
      button.disabled = false;
      if (error) {
        const context = (error as { context?: unknown }).context;
        let message = error.message;
        if (context instanceof Response) {
          try {
            const json = (await context.json()) as { error?: { message?: string } };
            if (json?.error?.message) message = json.error.message;
          } catch {
            /* ignore */
          }
        }
        toast(message);
        return;
      }
      const json = (data ?? {}) as {
        ok?: boolean;
        error?: { message?: string };
        facturacion_solicitada?: boolean;
      };
      if (!json.ok) {
        toast(json.error?.message || 'No se pudo validar la transferencia.');
        return;
      }
      toast(
        json.facturacion_solicitada
          ? 'Transferencia validada. Pedido pagado y factura DIAN en proceso.'
          : 'Transferencia validada. Pedido marcado como pagado. Cliente notificado.'
      );
      await render();
    });
  });

  app
    .querySelectorAll<HTMLButtonElement>('[data-pedido-rechazar-transferencia]')
    .forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset['pedidoRechazarTransferencia'] ?? state.recordId ?? '';
        if (!id) return;
        if (
          !confirm(
            'Rechazar el comprobante? Se marcara el pedido como rechazado, se reabrira la cotizacion y se enviara un email al cliente para reintentar la validacion.'
          )
        ) {
          return;
        }
        const motivo =
          window.prompt(
            'Motivo opcional para el cliente (deja vacio si no aplica):',
            'Comprobante no valido'
          ) ?? '';
        button.disabled = true;
        const before = await getRow('pedidos', id);
        const { data, error } = await supabase!.functions.invoke('rechazar-comprobante', {
          body: { pedido_id: id, motivo: motivo.trim() || undefined },
        });
        button.disabled = false;
        if (error) {
          const context = (error as { context?: unknown }).context;
          let message = error.message;
          if (context instanceof Response) {
            try {
              const json = (await context.json()) as { error?: { message?: string } };
              if (json?.error?.message) message = json.error.message;
            } catch {
              /* ignore */
            }
          }
          toast(message);
          return;
        }
        const json = (data ?? {}) as {
          ok?: boolean;
          email_enviado?: boolean;
          error?: { message?: string };
        };
        if (!json.ok) {
          toast(json.error?.message || 'No se pudo rechazar el comprobante.');
          return;
        }
        await registrarEventoPedido(id, {
          tipo: 'comprobante_rechazado',
          de_estado: text(before?.estado) || null,
          a_estado: 'rechazado',
          metadata: {
            source: 'admin',
            metodo: 'transferencia',
            motivo: motivo.trim() || null,
            email_enviado: Boolean(json.email_enviado),
          },
        });
        toast(
          json.email_enviado
            ? 'Comprobante rechazado. Email enviado al cliente para reintentar.'
            : 'Comprobante rechazado.'
        );
        await render();
      });
    });

  app.querySelectorAll<HTMLButtonElement>('[data-pedido-quick-estado]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = state.recordId;
      const estado = button.dataset['pedidoQuickEstado'] ?? '';
      if (!id || !estado) return;
      if (
        estado === 'retrasado' &&
        !confirm(
          'Marcar como "retrasado" implica que un pedido ya pagado no podra cumplirse a tiempo. Recuerda contactar al cliente manualmente. Continuar?'
        )
      ) {
        return;
      }
      const ok = await actualizarEstadoPedido(id, estado);
      if (ok) toast(`Pedido actualizado a ${pedidoEstadoLabel(estado)}.`);
      await render();
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-pedido-nota-template]').forEach(button => {
    button.addEventListener('click', () => {
      const target = app.querySelector<HTMLTextAreaElement>('[data-pedido-nota-input]');
      const value = button.dataset['pedidoNotaTemplate'] ?? '';
      if (!target || !value) return;
      target.value = value;
      target.focus();
      target.setSelectionRange(value.length, value.length);
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-pedido-copy-summary]').forEach(button => {
    button.addEventListener('click', async () => {
      const summary =
        app.querySelector<HTMLElement>('[data-pedido-summary]')?.textContent?.trim() ?? '';
      if (summary) await copyText(summary);
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-copy-text]').forEach(button => {
    button.addEventListener('click', async () => {
      await copyText(button.dataset['copyText'] ?? '');
    });
  });

  const reembolsoForm = app.querySelector<HTMLFormElement>('[data-reembolso-form]');
  reembolsoForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(reembolsoForm);
    const pedidoId = String(data.get('pedido_id') ?? '');
    const monto = Number(data.get('monto') ?? 0);
    const motivo = String(data.get('motivo') ?? '').trim();
    if (!pedidoId || !(monto > 0) || !motivo) {
      toast('Monto y motivo son obligatorios');
      return;
    }
    const notaCredito =
      reembolsoForm.elements.namedItem('nota_credito_dian') instanceof HTMLInputElement &&
      (reembolsoForm.elements.namedItem('nota_credito_dian') as HTMLInputElement).checked;
    const { error } = await supabase!.from('reembolsos').insert({
      pedido_id: pedidoId,
      monto,
      motivo,
      metodo: String(data.get('metodo') ?? 'pasarela'),
      referencia_externa: String(data.get('referencia_externa') ?? '').trim() || null,
      estado: 'procesado',
      nota_credito_dian: notaCredito,
      creado_por: state.email,
      procesado_at: new Date().toISOString(),
    });
    if (error) {
      toast(error.message);
      return;
    }
    await registrarEventoPedido(pedidoId, {
      tipo: 'reembolso_registrado',
      metadata: { monto, motivo },
    });
    const pedido = await getRow('pedidos', pedidoId);
    const total = Number(pedido?.total ?? 0);
    if (
      monto >= total &&
      text(pedido?.estado) !== 'reembolsado' &&
      confirm(
        'El monto cubre el total del pedido. Marcar el pedido como reembolsado? (envia email al cliente)'
      )
    ) {
      await actualizarEstadoPedido(pedidoId, 'reembolsado');
    }
    toast('Reembolso registrado');
    await render();
  });

  const noteForm = app.querySelector<HTMLFormElement>('[data-pedido-nota-form]');
  noteForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(noteForm);
    const pedidoId = String(data.get('pedido_id') ?? '');
    const {
      data: { user },
    } = await supabase!.auth.getUser();
    const payload: Row = {
      pedido_id: pedidoId,
      tipo: String(data.get('tipo') ?? 'interna'),
      nota: String(data.get('nota') ?? '').trim(),
      autor_id: user?.id ?? null,
      autor_email: user?.email ?? state.email,
    };
    if (!payload['nota']) return;
    const { error } = await supabase!.from('pedido_notas').insert(payload);
    if (error) toast(error.message);
    else {
      try {
        await registrarEventoPedido(pedidoId, {
          tipo: 'nota_agregada',
          metadata: { tipo: payload.tipo, nota: payload.nota },
        });
      } catch {
        // La nota ya quedó guardada; el timeline es una mejora de auditoría, no un bloqueo.
      }
      toast('Nota agregada');
      noteForm.reset();
    }
    await render();
  });

  const fiscalForm = app.querySelector<HTMLFormElement>('[data-pedido-fiscal-form]');
  fiscalForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(fiscalForm);
    const pedidoId = String(data.get('pedido_id') ?? state.recordId ?? '').trim();
    if (!pedidoId) return;

    const tipoDocumento = String(data.get('tipo_documento') ?? 'NIT') as TipoDocumentoFiscal;
    const numeroDocumento = normalizeNumeroDocumento(
      tipoDocumento,
      String(data.get('numero_documento') ?? '')
    );
    const tipoPersona = String(data.get('tipo_persona') ?? 'juridica') as TipoPersonaFiscal;
    const solicitar =
      fiscalForm.elements.namedItem('solicitar_factura_electronica') instanceof HTMLInputElement &&
      (fiscalForm.elements.namedItem('solicitar_factura_electronica') as HTMLInputElement).checked;

    const profile: ClienteFiscalProfile = {
      solicitar_factura_electronica: solicitar,
      tipo_documento: tipoDocumento,
      numero_documento: numeroDocumento,
      tipo_persona: tipoPersona,
      razon_social: String(data.get('razon_social') ?? '').trim(),
      email_facturacion: String(data.get('email_facturacion') ?? '').trim(),
      responsable_iva:
        fiscalForm.elements.namedItem('responsable_iva') instanceof HTMLInputElement &&
        (fiscalForm.elements.namedItem('responsable_iva') as HTMLInputElement).checked,
      direccion_facturacion: {
        direccion: String(data.get('direccion') ?? '').trim(),
        ciudad: String(data.get('ciudad') ?? '').trim(),
        departamento: String(data.get('departamento') ?? '').trim() || null,
        pais: 'CO',
      },
    };

    const errors = validateClienteFiscal(profile, { moneda: 'COP', mercado: 'CO' });
    if (solicitar && errors.length) {
      toast(errors[0] ?? 'Datos fiscales invalidos');
      return;
    }

    const { data: pedidoRow, error: loadError } = await supabase!
      .from('pedidos')
      .select('id,cliente_id,metadata,facturacion_electronica_solicitada')
      .eq('id', pedidoId)
      .maybeSingle();
    if (loadError || !pedidoRow) {
      toast(loadError?.message || 'Pedido no encontrado');
      return;
    }

    const existingMeta =
      pedidoRow.metadata &&
      typeof pedidoRow.metadata === 'object' &&
      !Array.isArray(pedidoRow.metadata)
        ? { ...(pedidoRow.metadata as Row) }
        : {};
    const existingDraft =
      existingMeta.dian_draft && typeof existingMeta.dian_draft === 'object'
        ? { ...(existingMeta.dian_draft as Row) }
        : {};
    const existingDraftCliente =
      existingDraft.cliente && typeof existingDraft.cliente === 'object'
        ? { ...(existingDraft.cliente as Row) }
        : {};

    existingMeta.fiscal = {
      ...((existingMeta.fiscal as Row) ?? {}),
      solicitar_factura_electronica: solicitar,
      tipo_documento: profile.tipo_documento,
      numero_documento: profile.numero_documento,
      tipo_persona: profile.tipo_persona,
      razon_social: profile.razon_social,
      email_facturacion: profile.email_facturacion,
      responsable_iva: profile.responsable_iva === true,
      direccion_facturacion: profile.direccion_facturacion,
    };

    if (solicitar) {
      existingDraft.cliente = {
        ...existingDraftCliente,
        tipo_documento: profile.tipo_documento,
        numero_documento: profile.numero_documento,
        tipo_persona: profile.tipo_persona,
        razon_social: profile.razon_social,
        email: profile.email_facturacion,
        responsable_iva: profile.responsable_iva === true,
        direccion: {
          direccion: profile.direccion_facturacion?.direccion ?? '',
          ciudad: profile.direccion_facturacion?.ciudad ?? '',
          departamento: profile.direccion_facturacion?.departamento ?? null,
          pais: 'CO',
        },
      };
      existingMeta.dian_draft = existingDraft;
    }

    const { error: updateError } = await supabase!
      .from('pedidos')
      .update({
        metadata: existingMeta,
        facturacion_electronica_solicitada: solicitar,
        facturacion_electronica_estado: solicitar ? 'pendiente_envio' : 'no_solicitada',
        direccion_facturacion: profile.direccion_facturacion,
      })
      .eq('id', pedidoId);
    if (updateError) {
      toast(updateError.message);
      return;
    }

    const clienteId = text((pedidoRow as Row).cliente_id);
    if (clienteId) {
      await supabase!
        .from('clientes')
        .update({
          tipo_documento: profile.tipo_documento,
          numero_documento: profile.numero_documento,
          tipo_persona: profile.tipo_persona,
          razon_social: profile.razon_social,
          email_facturacion: profile.email_facturacion,
          responsable_iva: profile.responsable_iva === true,
          direccion_facturacion: profile.direccion_facturacion,
          documento_tipo: profile.tipo_documento,
          documento_numero: profile.numero_documento,
        })
        .eq('id', clienteId);
    }

    toast('Datos fiscales guardados (NIT normalizado)');
    await render();
  });

  app.querySelectorAll<HTMLButtonElement>('[data-pedido-reemitir-dian]').forEach(button => {
    button.addEventListener('click', async () => {
      const pedidoId = state.recordId ?? '';
      if (!pedidoId) return;
      if (
        !confirm('Reemitir factura electronica a DIAN/Siigo con los datos actuales del pedido?')
      ) {
        return;
      }
      button.disabled = true;
      const { data, error } = await supabase!.functions.invoke('emitir-factura-dian', {
        body: { pedido_id: pedidoId, force_live: true },
      });
      button.disabled = false;
      if (error) {
        const context = (error as { context?: unknown }).context;
        let message = error.message;
        if (context instanceof Response) {
          try {
            const json = (await context.json()) as { error?: { message?: string } };
            if (json?.error?.message) message = json.error.message;
          } catch {
            /* ignore */
          }
        }
        toast(message);
        return;
      }
      const json = data as { ok?: boolean; estado?: string; error?: string; skipped?: string };
      if (json?.skipped) {
        toast(`Omitido: ${json.skipped}`);
      } else if (json?.ok) {
        toast(`Factura ${json.estado ?? 'procesada'}`);
      } else {
        toast(json?.error || 'Emision fallida');
      }
      await render();
    });
  });
}

function bindFacturas() {
  const filterForm = app.querySelector<HTMLFormElement>('[data-facturas-filter]');
  filterForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(filterForm);
    const params = new URLSearchParams();
    for (const key of ['q', 'estado']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    location.hash = `#/facturas${params.toString() ? `?${params.toString()}` : ''}`;
  });

  app.querySelectorAll<HTMLButtonElement>('[data-factura-reemitir]').forEach(button => {
    button.addEventListener('click', async () => {
      const pedidoId = button.dataset['facturaReemitir'] ?? '';
      if (!pedidoId) return;
      if (!confirm('Reemitir factura DIAN con el borrador actual del pedido?')) return;
      button.disabled = true;
      const { data, error } = await supabase!.functions.invoke('emitir-factura-dian', {
        body: { pedido_id: pedidoId, force_live: true },
      });
      button.disabled = false;
      if (error) {
        toast(error.message);
        return;
      }
      const json = data as { ok?: boolean; estado?: string; error?: string };
      toast(json?.ok ? `Factura ${json.estado ?? 'ok'}` : json?.error || 'Error');
      await render();
    });
  });
}

type NitScope = 'cliente' | 'pedido';

function nitFormForScope(scope: NitScope): HTMLFormElement | null {
  if (scope === 'cliente') return app.querySelector<HTMLFormElement>('[data-cliente-form]');
  return app.querySelector<HTMLFormElement>('[data-pedido-fiscal-form]');
}

function setNitStatus(scope: NitScope, message: string, ok?: boolean) {
  const el = app.querySelector<HTMLElement>(`[data-nit-status="${scope}"]`);
  if (!el) return;
  el.textContent = message;
  el.style.color = ok === false ? '#8b1e1e' : ok === true ? '#0b5c3b' : '';
}

function readNitFromForm(form: HTMLFormElement): { tipo: TipoDocumentoFiscal; nit: string } {
  const tipo = (String(
    form.elements.namedItem('tipo_documento') instanceof HTMLSelectElement
      ? (form.elements.namedItem('tipo_documento') as HTMLSelectElement).value
      : 'NIT'
  ) || 'NIT') as TipoDocumentoFiscal;
  const nitInput = form.elements.namedItem('numero_documento');
  const nit = nitInput instanceof HTMLInputElement ? nitInput.value : '';
  return { tipo: tipo || 'NIT', nit };
}

function applyContribuyenteToForm(
  form: HTMLFormElement,
  contribuyente: {
    nit?: string;
    razon_social?: string;
    tipo_persona?: string | null;
    email?: string | null;
    direccion?: string | null;
    ciudad?: string | null;
    departamento?: string | null;
    responsable_iva?: boolean | null;
  },
  scope: NitScope
) {
  const setVal = (name: string, value: string) => {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = value;
  };
  if (contribuyente.nit) setVal('numero_documento', contribuyente.nit);
  if (contribuyente.razon_social) setVal('razon_social', contribuyente.razon_social);
  if (contribuyente.tipo_persona) setVal('tipo_persona', contribuyente.tipo_persona);
  if (contribuyente.email) setVal('email_facturacion', contribuyente.email);
  if (scope === 'pedido') {
    if (contribuyente.direccion) setVal('direccion', contribuyente.direccion);
    if (contribuyente.ciudad) setVal('ciudad', contribuyente.ciudad);
    if (contribuyente.departamento) setVal('departamento', contribuyente.departamento);
  } else {
    if (contribuyente.direccion) setVal('dir_fact_direccion', contribuyente.direccion);
    if (contribuyente.ciudad) setVal('dir_fact_ciudad', contribuyente.ciudad);
    if (contribuyente.departamento) setVal('dir_fact_departamento', contribuyente.departamento);
  }
  if (typeof contribuyente.responsable_iva === 'boolean') {
    const el = form.elements.namedItem('responsable_iva');
    if (el instanceof HTMLInputElement) el.checked = contribuyente.responsable_iva;
  }
}

function bindNitDian() {
  app.querySelectorAll<HTMLButtonElement>('[data-nit-verificar]').forEach(button => {
    button.addEventListener('click', () => {
      const scope = (button.dataset['nitVerificar'] ?? 'pedido') as NitScope;
      const form = nitFormForScope(scope);
      if (!form) return;
      const { tipo, nit } = readNitFromForm(form);
      const result = verificarNitCampo(nit, tipo || 'NIT');
      const nitInput = form.elements.namedItem('numero_documento');
      if (result.ok && result.numero && nitInput instanceof HTMLInputElement) {
        nitInput.value = result.numero;
      }
      if (!result.ok) {
        setNitStatus(scope, result.errores[0] ?? 'NIT invalido', false);
        toast(result.errores[0] ?? 'NIT invalido');
        return;
      }
      const msg = `NIT OK ${result.numero_formateado}${
        result.avisos[0] ? ` · ${result.avisos[0]}` : ''
      }`;
      setNitStatus(scope, msg, true);
      toast(msg);
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-nit-importar-dian]').forEach(button => {
    button.addEventListener('click', async () => {
      const scope = (button.dataset['nitImportarDian'] ?? 'pedido') as NitScope;
      const form = nitFormForScope(scope);
      if (!form) return;
      const { tipo, nit } = readNitFromForm(form);
      const local = verificarNitCampo(nit, tipo || 'NIT');
      if (!local.ok || !local.numero) {
        setNitStatus(scope, local.errores[0] ?? 'NIT invalido', false);
        toast(local.errores[0] ?? 'Corrige el NIT antes de importar');
        return;
      }
      const nitInput = form.elements.namedItem('numero_documento');
      if (nitInput instanceof HTMLInputElement) nitInput.value = local.numero;

      button.disabled = true;
      setNitStatus(scope, 'Consultando DIAN…');
      const { data, error } = await supabase!.functions.invoke('consultar-nit-dian', {
        body: { nit: local.numero, tipo_documento: tipo || 'NIT' },
      });
      button.disabled = false;

      if (error) {
        const context = (error as { context?: unknown }).context;
        let message = error.message;
        if (context instanceof Response) {
          try {
            const json = (await context.json()) as {
              mensaje?: string;
              verificacion?: { errores?: string[] };
            };
            message = json?.mensaje || json?.verificacion?.errores?.[0] || message;
          } catch {
            /* ignore */
          }
        }
        setNitStatus(scope, message, false);
        toast(message);
        return;
      }

      const json = data as {
        ok?: boolean;
        mensaje?: string;
        verificacion?: { numero?: string; numero_formateado?: string; ok?: boolean };
        contribuyente?: {
          nit?: string;
          razon_social?: string;
          tipo_persona?: string | null;
          email?: string | null;
          direccion?: string | null;
          ciudad?: string | null;
          departamento?: string | null;
          responsable_iva?: boolean | null;
          fuente?: string;
          estado?: string | null;
        } | null;
      };

      if (json?.verificacion?.numero && nitInput instanceof HTMLInputElement) {
        nitInput.value = json.verificacion.numero;
      }

      const fuenteDian = String(json?.contribuyente?.fuente ?? '').toLowerCase();
      if (json?.contribuyente?.razon_social) {
        if (!esFuenteDianContribuyente(fuenteDian)) {
          const msg =
            `La consulta no devolvio datos oficiales DIAN (fuente: ${fuenteDian || 'desconocida'}). ` +
            'No se rellenaron campos para evitar datos de un cliente existente en otro sistema.';
          setNitStatus(scope, msg, false);
          toast(msg);
          return;
        }
        applyContribuyenteToForm(form, json.contribuyente, scope);
        const estado = json.contribuyente.estado ? ` · ${json.contribuyente.estado}` : '';
        const msg = `Importado desde DIAN (${fuenteDian}): ${json.contribuyente.razon_social}${estado}`;
        setNitStatus(scope, msg, true);
        toast(msg);
        return;
      }

      const intentadas = Array.isArray(
        (json as { fuentes_intentadas?: string[] }).fuentes_intentadas
      )
        ? (json as { fuentes_intentadas: string[] }).fuentes_intentadas.join(', ')
        : '';
      const sinDatos =
        json?.mensaje ||
        (intentadas
          ? `NIT valido. DIAN no devolvio datos (consultado: ${intentadas}).`
          : 'NIT valido. Sin datos DIAN para importar.');
      setNitStatus(scope, sinDatos, json?.ok !== false);
      toast(sinDatos);
    });
  });
}

function bindPedidoMasivo() {
  const filterForm = app.querySelector<HTMLFormElement>('[data-pedidos-filter]');
  filterForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(filterForm);
    const params = new URLSearchParams();
    for (const key of ['q', 'estado', 'mercado', 'leida']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    location.hash = `#/pedidos${params.toString() ? `?${params.toString()}` : ''}`;
  });

  const selectedCountEl = app.querySelector<HTMLElement>('[data-pedidos-selected-count]');
  const selectAllBtn = app.querySelector<HTMLButtonElement>('[data-pedidos-select-all]');
  const bulkReadBtn = app.querySelector<HTMLButtonElement>('[data-bulk-pedido-read]');
  const bulkStateBtns = Array.from(
    app.querySelectorAll<HTMLButtonElement>('[data-bulk-pedido-estado]')
  );

  const getSelectedIds = () =>
    Array.from(app.querySelectorAll<HTMLInputElement>('[data-pedido-select]:checked')).map(
      input => input.value
    );

  const syncSelectedCount = () => {
    if (selectedCountEl) selectedCountEl.textContent = String(getSelectedIds().length);
  };

  app.querySelectorAll<HTMLInputElement>('[data-pedido-select]').forEach(input => {
    input.addEventListener('change', syncSelectedCount);
  });
  syncSelectedCount();

  selectAllBtn?.addEventListener('click', () => {
    const checkboxes = Array.from(app.querySelectorAll<HTMLInputElement>('[data-pedido-select]'));
    const allChecked = checkboxes.length > 0 && checkboxes.every(input => input.checked);
    checkboxes.forEach(input => {
      input.checked = !allChecked;
    });
    syncSelectedCount();
  });

  bulkReadBtn?.addEventListener('click', async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) {
      toast('Selecciona al menos un pedido.');
      return;
    }
    const { error } = await supabase!.from('pedidos').update({ leida: true }).in('id', ids);
    if (error) {
      toast(error.message);
      return;
    }
    toast('Pedidos marcados como leidos.');
    await render();
  });

  bulkStateBtns.forEach(button => {
    button.addEventListener('click', async () => {
      const estado = button.dataset['bulkPedidoEstado'] ?? '';
      const ids = getSelectedIds();
      if (!estado || ids.length === 0) {
        toast('Selecciona al menos un pedido.');
        return;
      }
      if (
        estado === 'retrasado' &&
        !confirm(
          'Marcar pedidos como "retrasado" implica una rotura de stock post-pago. Avisa manualmente a cada cliente antes de continuar.'
        )
      ) {
        return;
      }
      for (const id of ids) {
        // Cambios secuenciales para no saturar la BD ni perder el timeline por pedido.

        await actualizarEstadoPedido(id, estado);
      }
      toast(`Pedidos actualizados a ${estado}.`);
      await render();
    });
  });
}

function bindIngest() {
  const form = app.querySelector<HTMLFormElement>('[data-ingest-form]');
  const reviewContainer = app.querySelector<HTMLElement>('[data-ingest-review]');
  if (!form || !reviewContainer) return;
  app
    .querySelector<HTMLButtonElement>('[data-ingest-upload-pdf]')
    ?.addEventListener('click', async () => {
      await uploadIngestPdf(form);
    });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    reviewContainer.innerHTML = '<p class="admin-help">Extrayendo borrador...</p>';
    const data = new FormData(form);
    const pdfUrl = String(data.get('pdf_url') ?? '').trim();
    const pdfText = String(data.get('pdf_text') ?? '').trim();
    if (!pdfText) {
      reviewContainer.innerHTML =
        '<div class="admin-alert">No hay texto extraido. Selecciona un PDF con texto real desde el dispositivo o pega el texto extraido antes de generar el borrador.</div>';
      return;
    }
    // Intenta Ollama directo si está configurado (dev local, sin Edge Function)
    if (OLLAMA_URL) {
      reviewContainer.innerHTML =
        '<p class="admin-help">Extrayendo borrador con Ollama local (qwen3:8b)...</p>';
      const ollamaResult = await callOllamaIngest(pdfText, pdfUrl);
      if (ollamaResult) {
        reviewContainer.innerHTML = renderIngestReview(ollamaResult, pdfUrl);
        bindIngestReview(reviewContainer);
        return;
      }
    }
    const { data: json, error } = await supabase!.functions.invoke('ingesta-pdf', {
      body: {
        pdf_url: emptyToNull(data.get('pdf_url')),
        pdf_text: pdfText,
      },
    });
    if (error || !json) {
      const fallback = buildLocalIngestDraft(pdfText, pdfUrl, error?.message);
      reviewContainer.innerHTML = renderIngestReview(fallback, pdfUrl);
      bindIngestReview(reviewContainer);
      return;
    }
    reviewContainer.innerHTML = renderIngestReview(json as Row, pdfUrl);
    bindIngestReview(reviewContainer);
  });
}

function arrayOf<T>(value: unknown, mapItem: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(mapItem) : [];
}

function campoRevisable(value: unknown): CampoRevisable {
  const obj = value && typeof value === 'object' ? (value as Row) : {};
  return {
    valor: text(obj.valor),
    origen: text(obj.origen) || 'ausente',
    confianza: typeof obj.confianza === 'number' ? obj.confianza : 0,
    requiere_revision: obj.requiere_revision !== false,
  };
}

function especRevisable(value: unknown): EspecRevisable {
  const obj = value && typeof value === 'object' ? (value as Row) : {};
  return {
    clave: text(obj.clave),
    valor: text(obj.valor),
    grupo: text(obj.grupo),
    origen: text(obj.origen) || 'ausente',
    confianza: typeof obj.confianza === 'number' ? obj.confianza : 0,
    requiere_revision: obj.requiere_revision !== false,
  };
}

function campoBadges(campo: CampoRevisable, traduccion = false): string {
  const badges: string[] = [];
  if (campo.origen === 'manual') {
    badges.push('<span class="admin-badge">Agregado manualmente</span>');
  } else if (campo.origen === 'ausente') {
    badges.push('<span class="admin-badge admin-badge--warn">Ausente / requiere cliente</span>');
  } else if (campo.confianza < 0.6) {
    badges.push('<span class="admin-badge admin-badge--warn">Baja confianza</span>');
  } else {
    badges.push('<span class="admin-badge admin-badge--ok">Extraido del PDF</span>');
  }
  if (traduccion)
    badges.push('<span class="admin-badge admin-badge--info">Traduccion borrador</span>');
  return badges.join(' ');
}

function campoRevisableField(
  name: string,
  label: string,
  campo: CampoRevisable,
  multiline = false
): string {
  const inputHtml = multiline
    ? `<textarea name="${escapeHtml(name)}">${escapeHtml(campo.valor)}</textarea>`
    : `<input name="${escapeHtml(name)}" type="text" value="${escapeHtml(campo.valor)}" />`;
  return `
    <div class="admin-campo-revisable">
      <div class="admin-campo-revisable__head">
        <span>${escapeHtml(label)}</span>
        <span class="admin-campo-revisable__badges">${campoBadges(campo)}</span>
      </div>
      <label class="admin-field">${inputHtml}</label>
      <label class="admin-campo-revisable__check">
        <input type="checkbox" name="revisado__${escapeHtml(name)}" ${campo.requiere_revision ? 'required' : ''} /> Revisado
      </label>
    </div>`;
}

function especRevisableRow(espec: EspecRevisable): string {
  return `
    <div class="admin-campo-revisable" data-spec-row>
      <div class="admin-campo-revisable__head">
        <span>Especificacion</span>
        <span class="admin-campo-revisable__badges">${campoBadges(espec)}</span>
        <button class="admin-button admin-button--ghost" type="button" data-remove-row>Quitar</button>
      </div>
      <div class="admin-editor__cols">
        ${field('spec_clave', 'Clave', espec.clave)}
        ${field('spec_valor', 'Valor', espec.valor)}
        ${field('spec_grupo', 'Grupo', espec.grupo)}
      </div>
      <label class="admin-campo-revisable__check">
        <input type="checkbox" name="spec_revisado" ${espec.requiere_revision ? 'required' : ''} /> Revisado
      </label>
    </div>`;
}

function specEditorRow(espec: Row): string {
  return `
    <div class="admin-campo-revisable" data-spec-row>
      <div class="admin-campo-revisable__head">
        <span>Especificacion</span>
        <button class="admin-button admin-button--ghost" type="button" data-remove-row>Quitar</button>
      </div>
      <div class="admin-editor__cols">
        ${field('spec_clave', 'Clave', text(espec.clave))}
        ${field('spec_valor', 'Valor', text(espec.valor))}
        ${field('spec_grupo', 'Grupo', text(espec.grupo))}
      </div>
    </div>`;
}

function renderSpecEditor(specs: unknown[]): string {
  const rows =
    Array.isArray(specs) && specs.length > 0 ? specs : [{ clave: '', valor: '', grupo: '' }];
  return `
    <div class="admin-spec-editor" data-spec-editor>
      <div class="admin-spec-editor__actions">
        <button class="admin-button admin-button--ghost" type="button" data-add-spec>Agregar especificacion</button>
        <button class="admin-button admin-button--ghost" type="button" data-spec-fill-sample>Plantilla vacia</button>
      </div>
      <div class="admin-spec-editor__rows" data-spec-rows>
        ${rows.map(row => specEditorRow(row as Row)).join('')}
      </div>
      <label class="admin-field">
        Especificaciones JSON de respaldo
        <textarea name="especificaciones" data-spec-json>${escapeHtml(JSON.stringify(rows, null, 2))}</textarea>
      </label>
      <p class="admin-help">Edita las filas para mantener la estructura. El JSON sirve como respaldo o importación masiva.</p>
    </div>`;
}

function specRowPayload(row: HTMLElement): Row {
  return {
    clave: text(row.querySelector<HTMLInputElement>('input[name="spec_clave"]')?.value),
    valor: text(row.querySelector<HTMLInputElement>('input[name="spec_valor"]')?.value),
    grupo: text(row.querySelector<HTMLInputElement>('input[name="spec_grupo"]')?.value),
  };
}

function aplicacionRevisableRow(item: CampoRevisable): string {
  return `
    <div class="admin-campo-revisable" data-aplicacion-row>
      <div class="admin-campo-revisable__head">
        <span>Aplicacion</span>
        <span class="admin-campo-revisable__badges">${campoBadges(item)}</span>
        <button class="admin-button admin-button--ghost" type="button" data-remove-row>Quitar</button>
      </div>
      ${field('aplicacion_valor', 'Descripcion', item.valor)}
      <label class="admin-campo-revisable__check">
        <input type="checkbox" name="aplicacion_revisado" ${item.requiere_revision ? 'required' : ''} /> Revisado
      </label>
    </div>`;
}

function emptySpecRow(): string {
  return especRevisableRow({
    clave: '',
    valor: '',
    grupo: '',
    origen: 'manual',
    confianza: 1,
    requiere_revision: false,
  });
}

function emptyAplicacionRow(): string {
  return aplicacionRevisableRow({
    valor: '',
    origen: 'manual',
    confianza: 1,
    requiere_revision: false,
  });
}

function renderIngestReview(draft: Row, pdfUrl: string): string {
  const productoEs =
    draft.producto_es && typeof draft.producto_es === 'object' ? (draft.producto_es as Row) : {};
  const productoEn =
    draft.producto_en_borrador && typeof draft.producto_en_borrador === 'object'
      ? (draft.producto_en_borrador as Row)
      : {};
  const ausentes = arrayOf(draft.ausentes, v => text(v)).filter(Boolean);
  const advertencias = arrayOf(draft.advertencias, v => text(v)).filter(Boolean);
  const rawOutput = typeof draft.raw_output === 'string' ? draft.raw_output : '';

  const nombre = campoRevisable(productoEs.nombre);
  const descripcionCorta = campoRevisable(productoEs.descripcion_corta);
  const descripcionLarga = campoRevisable(productoEs.descripcion_larga);
  const familiaSugerida = campoRevisable(productoEs.familia_sugerida);
  const tipoSugerido = campoRevisable(productoEs.tipo_sugerido);
  const familiaId = matchTaxonomyId(familiaSugerida.valor, ingestFamilias);
  const tipoId = matchTaxonomyId(tipoSugerido.valor, ingestTipos);
  const especs = arrayOf(productoEs.especificaciones, especRevisable);
  const aplicaciones = arrayOf(productoEs.aplicaciones, campoRevisable);
  const beneficiosDraft = revisableStringsFromDraft(productoEs.beneficios);
  const valorDraft = campoRevisable(productoEs.valor_institucional);
  const marcaDraft = campoRevisable(productoEs.marca);
  const seoDraft = revisableStringsFromDraft(productoEs.seo_keywords);
  const enrichedFallback = deriveEnrichedFields({
    nombre: nombre.valor,
    descripcionCorta: descripcionCorta.valor,
    descripcionLarga: descripcionLarga.valor,
    especificaciones: especs.map(s => ({ clave: s.clave, valor: s.valor, grupo: s.grupo })),
    aplicaciones: aplicaciones.map(a => a.valor).filter(Boolean),
  });
  const beneficios_es = beneficiosDraft.length ? beneficiosDraft : enrichedFallback.beneficios_es;
  const valor_es = valorDraft.valor || enrichedFallback.valor_es;
  const marca = marcaDraft.valor || enrichedFallback.marca;
  const seo_keywords_es = seoDraft.length ? seoDraft : enrichedFallback.seo_keywords_es;
  const beneficios_en = revisableStringsFromDraft(productoEn.beneficios);
  const valor_en = campoRevisable(productoEn.valor_institucional).valor;
  const seo_keywords_en = revisableStringsFromDraft(productoEn.seo_keywords);
  const metaSeo =
    productoEs.meta_seo && typeof productoEs.meta_seo === 'object'
      ? (productoEs.meta_seo as Row)
      : {};

  const nombreEn = campoRevisable(productoEn.nombre);
  const descripcionCortaEn = campoRevisable(productoEn.descripcion_corta);
  const descripcionLargaEn = campoRevisable(productoEn.descripcion_larga);
  const aplicacionesEn = arrayOf(productoEn.aplicaciones, campoRevisable);
  const hasEnDraft =
    Boolean(nombreEn.valor || descripcionCortaEn.valor || descripcionLargaEn.valor) ||
    aplicacionesEn.length > 0;

  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Borrador para revision</h2></div>
      <div style="padding:16px">
        ${advertencias.length ? `<div class="admin-alert"><strong>Advertencias del modelo:</strong><ul>${advertencias.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>` : ''}
        ${ausentes.length ? `<div class="admin-alert"><strong>Campos ausentes en el PDF:</strong> ${escapeHtml(ausentes.join(', '))}</div>` : ''}
        ${rawOutput ? `<div class="admin-alert"><strong>El modelo no devolvio JSON valido.</strong> Revise la salida cruda antes de continuar.</div><pre class="admin-card" style="white-space:pre-wrap;overflow:auto;max-height:30vh">${escapeHtml(rawOutput)}</pre>` : ''}
      </div>
      <form class="admin-form" data-ingest-review-form style="padding:16px">
        <input type="hidden" name="ficha_pdf" value="${escapeHtml(pdfUrl)}" />
        <h3>Espanol (fuente)</h3>
        ${field('slug', 'Slug', slugify(nombre.valor), true)}
        ${campoRevisableField('nombre_es', 'Nombre', nombre)}
        <div class="admin-campo-revisable">
          <div class="admin-campo-revisable__head">
            <span>Imagen principal</span>
            <span class="admin-campo-revisable__badges"><span class="admin-badge admin-badge--warn">Requerida para publicar</span></span>
          </div>
          ${field('imagen_principal', 'URL imagen principal')}
          ${upload('productos', 'imagen_principal', 'Subir imagen del producto')}
        </div>
        <div class="admin-editor__cols">
          <div>
            <p class="admin-help">Sugerencia LLM (familia): ${escapeHtml(familiaSugerida.valor) || '—'} ${campoBadges(familiaSugerida)}</p>
            ${select('familia_id', 'Familia (asignar)', familiaId, ingestFamilias, 'nombre_es', true)}
          </div>
          <div>
            <p class="admin-help">Sugerencia LLM (tipo): ${escapeHtml(tipoSugerido.valor) || '—'} ${campoBadges(tipoSugerido)}</p>
            ${select('tipo_id', 'Tipo (asignar)', tipoId, ingestTipos, 'nombre_es', true)}
          </div>
        </div>
        ${campoRevisableField('descripcion_corta_es', 'Descripcion corta', descripcionCorta, true)}
        ${campoRevisableField('descripcion_larga_es', 'Descripcion larga', descripcionLarga, true)}

        <h3>Especificaciones</h3>
        <div data-spec-rows>${especs.length ? especs.map(especRevisableRow).join('') : emptySpecRow()}</div>
        <button class="admin-button admin-button--ghost" type="button" data-add-spec>Agregar especificacion</button>

        <h3>Aplicaciones (ES)</h3>
        <div data-aplicacion-rows>${aplicaciones.length ? aplicaciones.map(aplicacionRevisableRow).join('') : emptyAplicacionRow()}</div>
        <button class="admin-button admin-button--ghost" type="button" data-add-aplicacion>Agregar aplicacion</button>

        <h3>Beneficios y valor (landing enriquecida)</h3>
        ${textarea('beneficios_es', 'Beneficios ES (uno por linea)', beneficios_es.join('\n'))}
        ${textarea('beneficios_en', 'Beneficios EN (uno por linea)', beneficios_en.join('\n'))}
        ${field('valor_es', 'Valor institucional ES', valor_es)}
        ${field('valor_en', 'Valor institucional EN', valor_en)}
        ${field('marca', 'Marca / fabricante', marca)}
        ${textarea('seo_keywords_es', 'SEO keywords ES (una por linea)', seo_keywords_es.join('\n'))}
        ${textarea('seo_keywords_en', 'SEO keywords EN (una por linea)', seo_keywords_en.join('\n'))}

        <h3>Traduccion EN (borrador)</h3>
        <div class="admin-campo-revisable">
          <div class="admin-campo-revisable__head">
            <span>Campos EN</span>
            <span class="admin-campo-revisable__badges">${campoBadges(nombreEn, true)}</span>
          </div>
          ${field('nombre_en', 'Nombre EN', nombreEn.valor)}
          ${textarea('descripcion_corta_en', 'Descripcion corta EN', descripcionCortaEn.valor)}
          ${textarea('descripcion_larga_en', 'Descripcion larga EN', descripcionLargaEn.valor)}
          ${textarea(
            'aplicaciones_en',
            'Aplicaciones EN (una por linea)',
            aplicacionesEn
              .map(a => a.valor)
              .filter(Boolean)
              .join('\n')
          )}
          <label class="admin-campo-revisable__check">
            <input type="checkbox" name="revisado_en" ${hasEnDraft ? 'required' : ''} /> Traduccion EN revisada
          </label>
        </div>

        <h3>SEO</h3>
        <div class="admin-editor__cols">
          ${field('meta_title', 'Meta title', text(metaSeo.title))}
          ${field('meta_description', 'Meta description', text(metaSeo.description))}
        </div>

        <h3>Datos comerciales</h3>
        <div class="admin-editor__cols">
          ${selectStatic('tipo_comercial', 'Tipo comercial', 'equipo', [
            ['equipo', 'Equipo'],
            ['consumible', 'Consumible'],
          ])}
          ${selectStatic('fulfillment_mode', 'Fulfillment', 'cotizacion', [
            ['cotizacion', 'Cotizacion'],
            ['dropship', 'Dropship'],
            ['individualizado', 'Individualizado'],
          ])}
        </div>
        ${checkbox('activo', 'Publicar en catalogo al crear', true)}
        <div class="admin-alert">Si no publica al crear, el producto queda como borrador interno. Si publica, revise familia, descripcion e imagen antes de confirmar; la publicacion solicita rebuild automaticamente.</div>
        <p class="admin-help" data-ingest-save-status aria-live="polite"></p>
        <button class="admin-button" type="submit">Crear producto</button>
      </form>
    </section>`;
}

function bindIngestReview(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>('[data-add-spec]').forEach(button => {
    button.addEventListener('click', () => {
      container.querySelector('[data-spec-rows]')?.insertAdjacentHTML('beforeend', emptySpecRow());
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-add-aplicacion]').forEach(button => {
    button.addEventListener('click', () => {
      container
        .querySelector('[data-aplicacion-rows]')
        ?.insertAdjacentHTML('beforeend', emptyAplicacionRow());
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-spec-fill-sample]').forEach(button => {
    button.addEventListener('click', () => {
      const rows = container.querySelector<HTMLElement>('[data-spec-rows]');
      if (!rows) return;
      rows.innerHTML = emptySpecRow();
      syncSpecJson(container);
    });
  });
  container.addEventListener('click', event => {
    const target = event.target;
    const removeButton =
      target instanceof HTMLElement ? target.closest<HTMLElement>('[data-remove-row]') : null;
    removeButton?.closest('[data-spec-row], [data-aplicacion-row]')?.remove();
    syncSpecJson(container);
  });
  container.addEventListener('input', event => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.closest('[data-spec-row]')) {
      syncSpecJson(container);
    }
  });

  const form = container.querySelector<HTMLFormElement>('[data-ingest-review-form]');
  if (!form) return;

  const nombreInput = form.elements.namedItem('nombre_es');
  if (nombreInput instanceof HTMLInputElement) {
    nombreInput.addEventListener('input', () => {
      const slugInput = form.elements.namedItem('slug');
      if (slugInput instanceof HTMLInputElement && !slugInput.value) {
        slugInput.value = slugify(nombreInput.value);
      }
    });
  }

  form.querySelectorAll<HTMLButtonElement>('[data-upload]').forEach(button => {
    button.addEventListener('click', async () => uploadFile(button, form));
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const statusEl = form.querySelector<HTMLElement>('[data-ingest-save-status]');
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const payload = ingestPayload(form);
    if (!text(payload['nombre_es'])) {
      toast('El nombre en español (ES) es obligatorio para crear el producto');
      return;
    }
    if (!text(payload['nombre_en'])) {
      const continuar = confirm(
        'El nombre EN está vacío. El producto se creará sin traducción EN y los visitantes en inglés verán el nombre en español. ¿Continuar?'
      );
      if (!continuar) return;
    }
    payload['slug'] = await uniqueProductSlug(
      text(payload['slug']) || slugify(text(payload['nombre_es']))
    );
    const slug = text(payload['slug']);
    if (statusEl) statusEl.textContent = 'Guardando producto en Supabase...';
    if (submitButton) submitButton.disabled = true;
    try {
      await invokeAdminImport('productos', [payload]);
    } catch (error) {
      const message = formatImportError(error);
      if (statusEl) {
        statusEl.innerHTML = `<span class="admin-import-error">Error al crear producto:</span> ${escapeHtml(message)}`;
      }
      toast(message);
      if (submitButton) submitButton.disabled = false;
      return;
    }

    const { data, error } = await supabase!
      .from('productos')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      const message = `Producto guardado, pero no se pudo confirmar el ID para abrirlo: ${error.message}`;
      if (statusEl)
        statusEl.innerHTML = `<span class="admin-import-error">Aviso:</span> ${escapeHtml(message)}`;
      toast(message);
      if (submitButton) submitButton.disabled = false;
      return;
    }
    const productId = text((data as Row | null)?.id);
    const pdfUrl = text(payload['ficha_pdf']);
    if (productId && pdfUrl) {
      if (statusEl) statusEl.textContent = 'Publicando ficha PDF en catalogo...';
      await persistIngestPdfForProduct(slug, pdfUrl);
    }
    if (payload['activo'] === true && productId) {
      await generarEmbeddingProducto(productId);
      await triggerRebuild();
    }
    toast(
      payload['activo'] === true
        ? 'Producto creado y publicacion solicitada'
        : 'Producto creado como borrador'
    );
    location.hash = productId ? `#/producto?id=${encodeURIComponent(productId)}` : '#/productos';
    await render();
  });

  syncSpecJson(container);
}

function syncSpecJson(container: HTMLElement) {
  const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-spec-row]')).map(
    specRowPayload
  );
  const json = container.querySelector<HTMLTextAreaElement>('[data-spec-json]');
  if (!json) return;
  json.value = JSON.stringify(
    rows.filter(row => row.clave || row.valor || row.grupo),
    null,
    2
  );
}

function buildLocalIngestDraft(pdfText: string, pdfUrl: string, errorMessage?: string): Row {
  const clean = pdfText
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const title = inferProductName(clean, pdfUrl);
  const description = clean
    .filter(line => line.length > 35 && !/^pagina\s+\d+/i.test(line))
    .slice(0, 4)
    .join(' ')
    .slice(0, 900);
  const specs = inferSpecs(clean);
  const family = inferFamiliaSugerida(`${title} ${description}`);
  const tipo = inferTipoSugerido(`${title} ${description}`);
  const aplicaciones = inferAplicacionesFromText(`${title} ${description} ${pdfText}`);
  const enriched = deriveEnrichedFields({
    nombre: title,
    descripcionCorta: description.slice(0, 240),
    descripcionLarga: description,
    especificaciones: specs.map(s => ({ clave: s.clave, valor: s.valor, grupo: s.grupo })),
    aplicaciones,
    textoCompleto: pdfText,
  });
  const englishName = looksLikeEnglishProductName(title) ? title : '';
  return {
    producto_es: {
      nombre: revisable(title, 'pdf', 0.55, true),
      familia_sugerida: revisable(family, family ? 'pdf' : 'ausente', family ? 0.5 : 0, true),
      tipo_sugerido: revisable(tipo, tipo ? 'pdf' : 'ausente', tipo ? 0.5 : 0, true),
      descripcion_corta: revisable(
        description.slice(0, 240),
        description ? 'pdf' : 'ausente',
        0.45,
        true
      ),
      descripcion_larga: revisable(description, description ? 'pdf' : 'ausente', 0.45, true),
      especificaciones: specs,
      aplicaciones: aplicaciones.map(valor => revisable(valor, 'pdf', 0.5, true)),
      beneficios: enriched.beneficios_es.map(valor => revisable(valor, 'inferido', 0.45, true)),
      valor_institucional: revisable(enriched.valor_es, 'inferido', 0.45, true),
      marca: revisable(enriched.marca, enriched.marca ? 'pdf' : 'ausente', 0.4, true),
      seo_keywords: enriched.seo_keywords_es.map(valor => revisable(valor, 'inferido', 0.4, true)),
      meta_seo: {
        title,
        description: description.slice(0, 155),
      },
    },
    producto_en_borrador: {
      nombre: revisable(
        englishName,
        englishName ? 'manual' : 'ausente',
        englishName ? 0.35 : 0,
        true
      ),
      descripcion_corta: revisable('', 'ausente', 0, true),
      descripcion_larga: revisable('', 'ausente', 0, true),
      aplicaciones: [],
      meta_seo: {
        title: englishName,
        description: '',
      },
    },
    campos_confianza: [],
    ausentes: specs.length
      ? ['tipo_sugerido', 'producto_en_borrador']
      : ['tipo_sugerido', 'especificaciones', 'producto_en_borrador'],
    advertencias: [
      errorMessage
        ? `La IA no genero el borrador (${errorMessage}). Se creo un borrador local editable desde el texto del PDF.`
        : 'Se creo un borrador local editable desde el texto del PDF.',
      'El fallback local no traduce contenido medico. Complete y revise los campos EN antes de crear el producto.',
    ],
    raw_model_id: 'local-pdf-parser',
  };
}

function revisable(
  valor: string,
  origen: 'pdf' | 'ausente' | 'manual' | 'inferido',
  confianza: number,
  requiere_revision: boolean
): CampoRevisable {
  return { valor, origen, confianza, requiere_revision };
}

/** Llama a Ollama directamente desde el navegador para generar el borrador de ingesta. */
async function callOllamaIngest(pdfText: string, pdfUrl: string): Promise<Row | null> {
  if (!OLLAMA_URL) return null;
  try {
    const systemPrompt =
      'Extrae un borrador JSON bilingue para catalogo medico B2B con landing enriquecida (beneficios, valor institucional, SEO). Devuelve solo JSON valido, sin texto adicional. No inventes datos. Campo no presente: valor vacio, origen="ausente", requiere_revision=true. Genera producto_es desde el PDF y producto_en_borrador como traduccion al ingles. La traduccion EN es borrador y todos sus campos requieren_revision=true. /no_think';
    const userPrompt = buildIngestUserPrompt(pdfText, pdfUrl);

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_INGEST_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: { temperature: 0, num_predict: 4500 },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { message?: { content?: string }; model?: string };
    const raw = (json.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
    const jsonStr =
      fenced ??
      (() => {
        const a = raw.indexOf('{'),
          b = raw.lastIndexOf('}');
        return a >= 0 && b > a ? raw.slice(a, b + 1) : raw;
      })();
    const parsed = JSON.parse(jsonStr) as Row;
    parsed['raw_model_id'] = json.model ?? OLLAMA_INGEST_MODEL;
    return parsed;
  } catch {
    return null;
  }
}

/** Genera embeddings con Ollama local y actualiza productos.embedding via Supabase client. */
async function reindexarConOllamaLocal(): Promise<{ procesados: number; errores: number }> {
  const { data, error } = await supabase!
    .from('productos')
    .select(
      'id, nombre_es, nombre_en, descripcion_corta_es, descripcion_corta_en, descripcion_larga_es, descripcion_larga_en, especificaciones, aplicaciones_es, aplicaciones_en'
    )
    .eq('activo', true);
  if (error) throw new Error(error.message);
  const productos = (data ?? []) as Row[];
  if (!productos.length) return { procesados: 0, errores: 0 };

  let procesados = 0;
  let errores = 0;
  const BATCH = 10;

  for (let i = 0; i < productos.length; i += BATCH) {
    const lote = productos.slice(i, i + BATCH);
    const textos = lote.map(p => buildEmbedText(p));
    try {
      const res = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: textos }),
      });
      if (!res.ok) throw new Error(`Ollama embed ${res.status}`);
      const json = (await res.json()) as { embeddings?: number[][] };
      const vectors = json.embeddings ?? [];
      if (vectors.length !== lote.length) throw new Error('Longitud de embeddings inesperada');
      for (let j = 0; j < lote.length; j++) {
        const { error: upErr } = await supabase!
          .from('productos')
          .update({ embedding: vectors[j] })
          .eq('id', text(lote[j]!['id']));
        if (upErr) {
          errores++;
          continue;
        }
        procesados++;
      }
    } catch {
      errores += lote.length;
    }
  }
  return { procesados, errores };
}

function buildEmbedText(p: Row): string {
  const parts: string[] = [
    text(p['nombre_es']),
    text(p['nombre_en']),
    text(p['descripcion_corta_es']),
    text(p['descripcion_corta_en']),
    text(p['descripcion_larga_es']),
    text(p['descripcion_larga_en']),
  ];
  if (Array.isArray(p['especificaciones'])) {
    for (const s of p['especificaciones'] as Row[]) {
      const clave = text(s['clave']).trim();
      const val = text(s['valor']).trim();
      if (clave || val) parts.push(`${clave}: ${val}`.trim());
    }
  }
  if (Array.isArray(p['aplicaciones_es'])) {
    for (const a of p['aplicaciones_es'] as string[]) parts.push(String(a));
  }
  return parts.filter(Boolean).join('\n').slice(0, 6000);
}

/** Genera embeddings para todos los artículos publicados con Ollama local. */
async function reindexarArticulosConOllama(): Promise<{ procesados: number; errores: number }> {
  const { data, error } = await supabase!
    .from('articulos')
    .select('id, titulo_es, titulo_en, cuerpo_es, cuerpo_en')
    .eq('publicado', true);
  if (error) throw new Error(error.message);
  const articulos = (data ?? []) as Row[];
  if (!articulos.length) return { procesados: 0, errores: 0 };

  let procesados = 0;
  let errores = 0;
  const BATCH = 10;

  for (let i = 0; i < articulos.length; i += BATCH) {
    const lote = articulos.slice(i, i + BATCH);
    const textos = lote.map(a =>
      [text(a['titulo_es']), text(a['titulo_en']), text(a['cuerpo_es']), text(a['cuerpo_en'])]
        .filter(Boolean)
        .join('\n')
        .slice(0, 6000)
    );
    try {
      const res = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: textos }),
      });
      if (!res.ok) throw new Error(`Ollama embed ${res.status}`);
      const json = (await res.json()) as { embeddings?: number[][] };
      const vectors = json.embeddings ?? [];
      if (vectors.length !== lote.length) throw new Error('Longitud de embeddings inesperada');
      for (let j = 0; j < lote.length; j++) {
        const { error: upErr } = await supabase!
          .from('articulos')
          .update({ embedding: vectors[j] })
          .eq('id', text(lote[j]!['id']));
        if (upErr) {
          errores++;
          continue;
        }
        procesados++;
      }
    } catch {
      errores += lote.length;
    }
  }
  return { procesados, errores };
}

function inferProductName(lines: string[], pdfUrl: string): string {
  const candidate =
    lines.find(line => {
      const words = line.split(/\s+/).length;
      return line.length >= 6 && line.length <= 90 && words <= 12 && !/^pagina\s+\d+/i.test(line);
    }) ?? '';
  if (candidate) return candidate;
  const fromUrl = decodeURIComponent(pdfUrl.split('/').pop() ?? '').replace(/\.pdf$/i, '');
  return fromUrl ? fromUrl.replace(/[-_]+/g, ' ').trim() : 'Producto desde PDF';
}

function inferSpecs(lines: string[]): EspecRevisable[] {
  const specs: EspecRevisable[] = [];
  for (const line of lines) {
    if (specs.length >= 18) break;
    const colon = line.match(/^([^:]{3,45}):\s*(.{2,160})$/);
    if (colon?.[1] && colon?.[2]) {
      specs.push({
        clave: colon[1],
        valor: colon[2],
        grupo: '',
        origen: 'pdf',
        confianza: 0.55,
        requiere_revision: true,
      });
      continue;
    }
    const technical = line.match(
      /\b(\d+(?:[.,]\d+)?\s?(?:mm|cm|kg|g|hz|khz|mhz|v|w|kw|ma|a|mah|kva|mpa|bar|psi|rpm|l\/min|ml\/h|bpm|°c|lux|inch|pulgadas?))\b/i
    );
    if (technical) {
      specs.push({
        clave: 'Caracteristica',
        valor: line.slice(0, 160),
        grupo: '',
        origen: 'pdf',
        confianza: 0.4,
        requiere_revision: true,
      });
    }
  }
  return specs;
}

function inferAplicacionesFromText(textValue: string): string[] {
  const value = textValue.toLowerCase();
  const out: string[] = [];
  if (/invasiv/i.test(value)) out.push('Ventilación invasiva');
  if (/no invasiv|vni|niv/i.test(value)) out.push('Ventilación no invasiva');
  if (/adult/i.test(value)) out.push('Cuidados intensivos adultos');
  if (/pediatr|infant|niñ/i.test(value)) out.push('Cuidados intensivos pediátricos');
  if (/uci|critico|intensiv/i.test(value) && !out.length) out.push('Cuidados intensivos');
  return out;
}

async function persistIngestPdfForProduct(slug: string, pdfUrl: string): Promise<string | null> {
  const storagePath = productPdfStoragePath(slug);
  const publicAssetPath = productPdfPublicPath(slug);

  if (lastIngestPdfFile) {
    const { error } = await supabase!.storage
      .from('productos')
      .upload(storagePath, lastIngestPdfFile, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (error) {
      console.warn('No se pudo subir ficha PDF al bucket productos:', error.message);
    } else {
      const remoteUrl = supabase!.storage.from('productos').getPublicUrl(storagePath)
        .data.publicUrl;
      await supabase!.from('productos').update({ ficha_pdf: remoteUrl }).eq('slug', slug);
      lastIngestPdfFile = null;
      return remoteUrl;
    }
  }

  if (pdfUrl) {
    try {
      const response = await fetch(pdfUrl);
      if (response.ok) {
        const blob = await response.blob();
        const { error } = await supabase!.storage.from('productos').upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });
        if (!error) {
          const remoteUrl = supabase!.storage.from('productos').getPublicUrl(storagePath)
            .data.publicUrl;
          await supabase!.from('productos').update({ ficha_pdf: remoteUrl }).eq('slug', slug);
          return remoteUrl;
        }
      }
    } catch {
      // fallback: conservar URL original de ingesta
    }
    await supabase!.from('productos').update({ ficha_pdf: pdfUrl }).eq('slug', slug);
    return pdfUrl;
  }

  return publicAssetPath;
}

function looksLikeEnglishProductName(value: string): boolean {
  if (!value) return false;
  const normalized = ` ${normalizeMatchText(value)} `;
  const spanishSignals = [
    ' de ',
    ' para ',
    ' con ',
    ' equipo ',
    ' maquina ',
    ' anestesia',
    ' radiologia',
  ];
  return !spanishSignals.some(signal => normalized.includes(signal));
}

function matchTaxonomyId(suggestion: string, rows: Row[]): string {
  const normalizedSuggestion = normalizeMatchText(suggestion);
  if (!normalizedSuggestion) return '';
  const match = rows.find(row => {
    const candidates = [row['nombre_es'], row['nombre_en'], row['slug']].map(value =>
      normalizeMatchText(text(value))
    );
    return candidates.some(
      candidate =>
        candidate &&
        (candidate === normalizedSuggestion ||
          candidate.includes(normalizedSuggestion) ||
          normalizedSuggestion.includes(candidate))
    );
  });
  return text(match?.['id']);
}

function normalizeMatchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function uniqueProductSlug(baseSlug: string): Promise<string> {
  const base = baseSlug || 'producto';
  let candidate = base;
  for (let i = 2; i <= 100; i += 1) {
    const { data, error } = await supabase!
      .from('productos')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) return `${base}-${Date.now()}`;
    if (!data) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

async function uniqueArticuloSlug(baseSlug: string, excludeId?: string): Promise<string> {
  const base = baseSlug || 'articulo';
  let candidate = base;
  for (let i = 2; i <= 100; i += 1) {
    const { data, error } = await supabase!
      .from('articulos')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) return `${base}-${Date.now()}`;
    const existingId = data ? text((data as Row).id) : '';
    if (!existingId || (excludeId && existingId === excludeId)) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

function ingestPayload(form: HTMLFormElement): Row {
  const data = new FormData(form);
  const especificaciones = Array.from(form.querySelectorAll<HTMLElement>('[data-spec-row]'))
    .map(row => ({
      clave: text(row.querySelector<HTMLInputElement>('input[name="spec_clave"]')?.value),
      valor: text(row.querySelector<HTMLInputElement>('input[name="spec_valor"]')?.value),
      grupo: text(row.querySelector<HTMLInputElement>('input[name="spec_grupo"]')?.value),
    }))
    .filter(item => item.clave || item.valor);
  const aplicaciones_es = Array.from(form.querySelectorAll<HTMLElement>('[data-aplicacion-row]'))
    .map(row => text(row.querySelector<HTMLInputElement>('input[name="aplicacion_valor"]')?.value))
    .filter(Boolean);
  const beneficios_es = lines(data.get('beneficios_es'));
  const beneficios_en = lines(data.get('beneficios_en'));
  const seo_keywords_es = lines(data.get('seo_keywords_es'));
  const seo_keywords_en = lines(data.get('seo_keywords_en'));
  const meta_title = emptyToNull(data.get('meta_title'));
  const meta_description = emptyToNull(data.get('meta_description'));
  const atributos = buildAtributosPayload({
    beneficios_es,
    beneficios_en,
    valor_es: String(data.get('valor_es') ?? ''),
    valor_en: String(data.get('valor_en') ?? ''),
    seo_keywords_es,
    seo_keywords_en,
    ...(meta_title ? { meta_title } : {}),
    ...(meta_description ? { meta_description } : {}),
    ...(String(data.get('marca') ?? '').trim() ? { marca: String(data.get('marca')) } : {}),
  });
  return {
    slug: String(data.get('slug') ?? ''),
    nombre_es: String(data.get('nombre_es') ?? ''),
    nombre_en: emptyToNull(data.get('nombre_en')),
    descripcion_corta_es: emptyToNull(data.get('descripcion_corta_es')),
    descripcion_corta_en: emptyToNull(data.get('descripcion_corta_en')),
    descripcion_larga_es: emptyToNull(data.get('descripcion_larga_es')),
    descripcion_larga_en: emptyToNull(data.get('descripcion_larga_en')),
    familia_id: emptyToNull(data.get('familia_id')),
    tipo_id: emptyToNull(data.get('tipo_id')),
    especificaciones,
    aplicaciones_es,
    aplicaciones_en: lines(data.get('aplicaciones_en')),
    atributos,
    imagen_principal: emptyToNull(data.get('imagen_principal')),
    ficha_pdf: emptyToNull(data.get('ficha_pdf')),
    tipo_comercial: String(data.get('tipo_comercial') ?? 'equipo'),
    fulfillment_mode: String(data.get('fulfillment_mode') ?? 'cotizacion'),
    moneda: 'COP',
    destacado: false,
    nuevo: false,
    activo:
      form.elements.namedItem('activo') instanceof HTMLInputElement &&
      (form.elements.namedItem('activo') as HTMLInputElement).checked,
    orden: 0,
  };
}

/** Valida precios/ofertas/stock básicos antes de guardar producto. */
function validarPreciosProducto(payload: Row): string | null {
  const precio = typeof payload.precio === 'number' ? payload.precio : null;
  const regular = typeof payload.precio_regular === 'number' ? payload.precio_regular : null;
  const oferta = typeof payload.precio_oferta === 'number' ? payload.precio_oferta : null;
  const stock = typeof payload.stock === 'number' ? payload.stock : null;

  for (const [label, value] of [
    ['Precio', precio],
    ['Precio regular', regular],
    ['Precio oferta', oferta],
    ['Stock', stock],
  ] as const) {
    if (value !== null && value < 0) return `${label} no puede ser negativo.`;
  }

  if (oferta !== null && regular !== null && oferta > regular) {
    return 'Precio oferta no puede ser mayor que precio regular.';
  }
  if (oferta !== null && precio !== null && regular === null && oferta > precio) {
    return 'Precio oferta no puede ser mayor que precio actual.';
  }

  const inicio = typeof payload.oferta_inicio === 'string' ? payload.oferta_inicio : null;
  const fin = typeof payload.oferta_fin === 'string' ? payload.oferta_fin : null;
  if (inicio && fin && new Date(inicio).getTime() > new Date(fin).getTime()) {
    return 'Inicio de oferta no puede ser posterior al fin.';
  }
  return null;
}

async function triggerRebuild() {
  const { data, error } = await supabase!.functions.invoke('trigger-rebuild', {
    body: { reason: 'admin_publish_batch' },
  });
  const json = data as { ok?: boolean; mode?: string; error?: { message?: string } } | null;
  if (json?.ok) {
    toast(`Rebuild solicitado (${json.mode ?? 'ok'})`);
  } else {
    const detail = error?.message ?? json?.error?.message ?? 'No se pudo solicitar rebuild';
    toast(
      /CI_DEPLOY_HOOK|GITHUB_TOKEN|unconfigured|Configurar/i.test(detail)
        ? 'Publicar cambios: faltan secretos Edge (GITHUB_TOKEN + GITHUB_REPOSITORY). Revisa ADMIN_GUIDE.'
        : detail
    );
  }
  // Refresca dashboard si estamos ahí para ver historial; no fuerza navegación.
  if (state.view === 'dashboard') await render();
}

async function publishLogPanel(): Promise<string> {
  const { data, error } = await supabase!
    .from('cms_publish_log')
    .select('id,requested_email,reason,mode,ok,error_message,created_at')
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) {
    return `<section class="admin-panel"><div class="admin-panel__head"><h2>Historial de publicaciones</h2></div><p class="admin-help" style="padding:16px">No disponible aún (${escapeHtml(error.message)}). Aplica migración 20260804200000.</p></section>`;
  }
  const rows = (data ?? []) as Row[];
  if (!rows.length) {
    return `<section class="admin-panel"><div class="admin-panel__head"><h2>Historial de publicaciones</h2></div><p class="admin-help" style="padding:16px">Sin publicaciones registradas. Usa "Publicar cambios".</p></section>`;
  }
  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Historial de publicaciones</h2></div>
      ${table(
        ['Fecha', 'Usuario', 'Modo', 'Resultado', 'Detalle'],
        rows.map(row => [
          formatCell(row.created_at),
          escapeHtml(text(row.requested_email)) || '—',
          escapeHtml(text(row.mode)) || '—',
          row.ok === true
            ? '<span class="admin-badge admin-badge--ok">OK</span>'
            : '<span class="admin-badge admin-badge--warn">Error</span>',
          escapeHtml(text(row.error_message) || text(row.reason)) || '—',
        ])
      )}
    </section>`;
}

/** Genera/actualiza el embedding del producto al activarlo (Asesor RAG). No bloquea el guardado si falla. */
async function generarEmbeddingProducto(productoId: string) {
  if (!productoId) return;
  if (OLLAMA_URL) {
    try {
      const { data: row } = await supabase!
        .from('productos')
        .select(
          'id, nombre_es, nombre_en, descripcion_corta_es, descripcion_corta_en, descripcion_larga_es, descripcion_larga_en, especificaciones, aplicaciones_es, aplicaciones_en'
        )
        .eq('id', productoId)
        .single();
      if (row) {
        const embedText = buildEmbedText(row as Row);
        const res = await fetch(`${OLLAMA_URL}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: [embedText] }),
        });
        if (res.ok) {
          const json = (await res.json()) as { embeddings?: number[][] };
          const vector = json.embeddings?.[0];
          if (vector?.length) {
            await supabase!.from('productos').update({ embedding: vector }).eq('id', productoId);
          }
        }
      }
    } catch {
      /* no bloquea guardado */
    }
    return;
  }
  const { error } = await supabase!.functions.invoke('generar-embeddings', {
    body: { producto_id: productoId },
  });
  if (error)
    toast(`Producto guardado, pero el embedding del Asesor no se actualizo: ${error.message}`);
}

async function selectRows(
  tableName: string,
  columns: string,
  order: string,
  limit: number,
  ascending = true
): Promise<Row[]> {
  const { data, error } = await supabase!
    .from(tableName)
    .select(columns)
    .order(order, { ascending })
    .limit(limit);
  if (error) {
    toast(error.message);
    return [];
  }
  return (data ?? []) as unknown as Row[];
}

async function selectRowsWhere(
  tableName: string,
  columns: string,
  order: string,
  eq: Row,
  limit: number,
  ascending = true
): Promise<Row[]> {
  let req = supabase!.from(tableName).select(columns).order(order, { ascending }).limit(limit);
  for (const [key, value] of Object.entries(eq)) req = req.eq(key, value);
  const { data, error } = await req;
  if (error) {
    toast(error.message);
    return [];
  }
  return (data ?? []) as unknown as Row[];
}

async function getRow(tableName: string, id: string): Promise<Row | null> {
  const { data, error } = await supabase!.from(tableName).select('*').eq('id', id).maybeSingle();
  if (error) {
    toast(error.message);
    return null;
  }
  return (data as Row | null) ?? null;
}

async function count(tableName: string, eq?: Row): Promise<number> {
  let req = supabase!.from(tableName).select('id', { count: 'exact', head: true });
  for (const [key, value] of Object.entries(eq ?? {})) req = req.eq(key, value);
  const { count: total, error } = await req;
  if (error) return 0;
  return total ?? 0;
}

async function productosDropshipSinProveedor(): Promise<number> {
  const productos = await selectRows('productos', 'id', 'created_at', 500);
  const dropship = productos.filter(row => row['fulfillment_mode'] === 'dropship');
  if (dropship.length === 0) return 0;
  const links = await selectRows('proveedor_producto', 'producto_id', 'prioridad', 500);
  const linked = new Set(links.map(row => text(row.producto_id)));
  return dropship.filter(row => !linked.has(text(row.id))).length;
}

function groupCount(rows: Row[], key: string): Map<string, number> {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const value = text(row[key]);
    grouped.set(value, (grouped.get(value) ?? 0) + 1);
  }
  return grouped;
}

function productDraft(row: Row | null): ProductoDraft {
  return {
    id: text(row?.id) || undefined,
    slug: text(row?.slug),
    sku: text(row?.sku),
    gtin: text(row?.gtin),
    nombre_es: text(row?.nombre_es),
    nombre_en: text(row?.nombre_en),
    descripcion_corta_es: text(row?.descripcion_corta_es),
    descripcion_corta_en: text(row?.descripcion_corta_en),
    descripcion_larga_es: text(row?.descripcion_larga_es),
    descripcion_larga_en: text(row?.descripcion_larga_en),
    familia_id: text(row?.familia_id),
    tipo_id: text(row?.tipo_id),
    especificaciones: Array.isArray(row?.especificaciones) ? row.especificaciones : [],
    aplicaciones_es: stringArray(row?.aplicaciones_es),
    aplicaciones_en: stringArray(row?.aplicaciones_en),
    imagen_principal: text(row?.imagen_principal),
    ficha_pdf: text(row?.ficha_pdf),
    atributos: row?.atributos && typeof row.atributos === 'object' ? (row.atributos as Row) : {},
    peso_kg: numberOrNull(row?.peso_kg),
    dimensiones_cm:
      row?.dimensiones_cm && typeof row.dimensiones_cm === 'object'
        ? (row.dimensiones_cm as Row)
        : {},
    tipo_comercial: row?.tipo_comercial === 'consumible' ? 'consumible' : 'equipo',
    fulfillment_mode:
      row?.fulfillment_mode === 'dropship' || row?.fulfillment_mode === 'individualizado'
        ? row.fulfillment_mode
        : 'cotizacion',
    precio: numberOrNull(row?.precio),
    precio_regular: numberOrNull(row?.precio_regular),
    precio_oferta: numberOrNull(row?.precio_oferta),
    dian_codigo: text(row?.dian_codigo),
    tarifa_iva_pct: numberOrNull(row?.tarifa_iva_pct),
    retencion_fuente_pct: numberOrNull(row?.retencion_fuente_pct),
    retencion_iva_pct: numberOrNull(row?.retencion_iva_pct),
    retencion_ica_pct: numberOrNull(row?.retencion_ica_pct),
    oferta_inicio: datetimeLocal(row?.oferta_inicio),
    oferta_fin: datetimeLocal(row?.oferta_fin),
    moneda: text(row?.moneda) || 'COP',
    stock: numberOrNull(row?.stock),
    gestionar_stock: Boolean(row?.gestionar_stock),
    stock_estado:
      row?.stock_estado === 'outofstock' || row?.stock_estado === 'onbackorder'
        ? row.stock_estado
        : 'instock',
    backorder_policy:
      row?.backorder_policy === 'notify' || row?.backorder_policy === 'yes'
        ? row.backorder_policy
        : 'no',
    destacado: Boolean(row?.destacado),
    nuevo: Boolean(row?.nuevo),
    activo: row ? Boolean(row.activo) : false,
    disponible: row ? row.disponible !== false : true,
    excluido_iva: row ? row.excluido_iva === true : false,
    orden: numberOrZero(row?.orden),
  };
}

function articleDraft(row: Row | null): ArticuloDraft {
  const autorTipo = text(row?.autor_tipo);
  return {
    id: text(row?.id) || undefined,
    slug: text(row?.slug),
    titulo_es: text(row?.titulo_es),
    titulo_en: text(row?.titulo_en),
    cuerpo_es: text(row?.cuerpo_es),
    cuerpo_en: text(row?.cuerpo_en),
    imagen: text(row?.imagen),
    publicado: row ? Boolean(row.publicado) : false,
    autor_tipo: autorTipo === 'cliente' || autorTipo === 'fabricante' ? autorTipo : 'ime',
    autor_nombre: text(row?.autor_nombre) || 'Equipo I-ME',
    autor_empresa: text(row?.autor_empresa) || 'I-ME International Medical Enterprise',
    autor_bio_corta: text(row?.autor_bio_corta),
  };
}

function productPayload(form: HTMLFormElement): Row {
  const data = new FormData(form);
  const structuredSpecs = Array.from(form.querySelectorAll<HTMLElement>('[data-spec-row]'))
    .map(specRowPayload)
    .filter(item => item.clave || item.valor || item.grupo);
  const fallbackSpecsParsed = parseJson(data.get('especificaciones'), []);
  const fallbackSpecs = Array.isArray(fallbackSpecsParsed) ? fallbackSpecsParsed : [];
  const specs = structuredSpecs.length > 0 ? structuredSpecs : fallbackSpecs;
  return {
    slug: String(data.get('slug') ?? ''),
    sku: emptyToNull(data.get('sku')),
    gtin: emptyToNull(data.get('gtin')),
    nombre_es: String(data.get('nombre_es') ?? ''),
    nombre_en: emptyToNull(data.get('nombre_en')),
    descripcion_corta_es: emptyToNull(data.get('descripcion_corta_es')),
    descripcion_corta_en: emptyToNull(data.get('descripcion_corta_en')),
    descripcion_larga_es: emptyToNull(data.get('descripcion_larga_es')),
    descripcion_larga_en: emptyToNull(data.get('descripcion_larga_en')),
    familia_id: emptyToNull(data.get('familia_id')),
    tipo_id: emptyToNull(data.get('tipo_id')),
    especificaciones: specs,
    aplicaciones_es: lines(data.get('aplicaciones_es')),
    aplicaciones_en: lines(data.get('aplicaciones_en')),
    imagen_principal: emptyToNull(data.get('imagen_principal')),
    ficha_pdf: emptyToNull(data.get('ficha_pdf')),
    atributos: parseJson(data.get('atributos'), {}),
    peso_kg: numberOrNull(data.get('peso_kg')),
    dimensiones_cm: parseJson(data.get('dimensiones_cm'), {}),
    tipo_comercial: String(data.get('tipo_comercial') ?? 'equipo'),
    fulfillment_mode: String(data.get('fulfillment_mode') ?? 'cotizacion'),
    precio: numberOrNull(data.get('precio')),
    precio_regular: numberOrNull(data.get('precio_regular')),
    precio_oferta: numberOrNull(data.get('precio_oferta')),
    dian_codigo: emptyToNull(data.get('dian_codigo')),
    tarifa_iva_pct: numberOrNull(data.get('tarifa_iva_pct')),
    retencion_fuente_pct: numberOrNull(data.get('retencion_fuente_pct')),
    retencion_iva_pct: numberOrNull(data.get('retencion_iva_pct')),
    retencion_ica_pct: numberOrNull(data.get('retencion_ica_pct')),
    oferta_inicio: emptyToNull(data.get('oferta_inicio')),
    oferta_fin: emptyToNull(data.get('oferta_fin')),
    moneda: 'COP',
    stock: numberOrNull(data.get('stock')),
    gestionar_stock:
      form.elements.namedItem('gestionar_stock') instanceof HTMLInputElement &&
      (form.elements.namedItem('gestionar_stock') as HTMLInputElement).checked,
    stock_estado: String(data.get('stock_estado') ?? 'instock'),
    backorder_policy: String(data.get('backorder_policy') ?? 'no'),
    destacado:
      form.elements.namedItem('destacado') instanceof HTMLInputElement &&
      (form.elements.namedItem('destacado') as HTMLInputElement).checked,
    nuevo:
      form.elements.namedItem('nuevo') instanceof HTMLInputElement &&
      (form.elements.namedItem('nuevo') as HTMLInputElement).checked,
    activo:
      form.elements.namedItem('activo') instanceof HTMLInputElement &&
      (form.elements.namedItem('activo') as HTMLInputElement).checked,
    disponible:
      form.elements.namedItem('disponible') instanceof HTMLInputElement &&
      (form.elements.namedItem('disponible') as HTMLInputElement).checked,
    excluido_iva:
      form.elements.namedItem('excluido_iva') instanceof HTMLInputElement &&
      (form.elements.namedItem('excluido_iva') as HTMLInputElement).checked,
    disponible_actualizado_at: new Date().toISOString(),
    orden: numberOrZero(data.get('orden')),
  };
}

async function uploadFile(button: HTMLButtonElement, form: HTMLFormElement) {
  const bucket = button.dataset['upload'];
  const targetName = button.dataset['target'];
  if (!bucket || !targetName) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = bucket === 'fichas' ? 'application/pdf' : 'image/*';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (bucket !== 'fichas' && file.size > PRODUCT_IMAGE_MAX_BYTES) {
      toast('Imagen supera 2 MB. Comprime antes de subir.');
      return;
    }
    if (bucket === 'fichas' && file.size > INGEST_PDF_MAX_BYTES) {
      toast('El PDF supera 25 MB. Reduce el archivo antes de subirlo.');
      return;
    }
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Subiendo...';
    const path = `${Date.now()}-${slugify(file.name)}`;
    const { error } = await supabase!.storage.from(bucket).upload(path, file, { upsert: false });
    button.disabled = false;
    button.textContent = originalLabel;
    if (error) {
      toast(error.message);
      return;
    }
    const publicUrl = supabase!.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const target = form.elements.namedItem(targetName);
    if (target instanceof HTMLInputElement) target.value = publicUrl;
    const previewBox = button
      .closest('.admin-upload-box')
      ?.querySelector<HTMLElement>('[data-image-preview]');
    if (previewBox) {
      previewBox.innerHTML = `<img src="${escapeHtml(publicUrl)}" alt="Preview" style="max-width:100%; max-height:150px; border-radius:8px;" />`;
      previewBox.style.display = '';
    }
    toast('Imagen subida correctamente');
  });
  input.click();
}

async function uploadIngestPdf(form: HTMLFormElement) {
  const statusEl = app.querySelector<HTMLElement>('[data-ingest-upload-status]');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf,.pdf';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    lastIngestPdfFile = file;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      toast('Selecciona un archivo PDF.');
      return;
    }
    if (file.size > INGEST_PDF_MAX_BYTES) {
      toast('El PDF supera 25 MB. Reduce el archivo antes de subirlo.');
      return;
    }

    if (statusEl) statusEl.textContent = `Leyendo texto de ${file.name}...`;
    let extractedText: string;
    try {
      extractedText = await extractPdfText(file);
    } catch (error) {
      if (statusEl) statusEl.textContent = '';
      toast(error instanceof Error ? error.message : 'No se pudo leer el PDF.');
      return;
    }

    const textTarget = form.elements.namedItem('pdf_text');
    if (textTarget instanceof HTMLTextAreaElement) textTarget.value = extractedText;

    if (statusEl) statusEl.textContent = `Subiendo ${file.name}...`;
    const path = `ingesta/${Date.now()}-${slugify(file.name)}`;
    const { error } = await supabase!.storage.from('fichas').upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (error) {
      if (statusEl) statusEl.textContent = '';
      toast(error.message);
      return;
    }

    const publicUrl = supabase!.storage.from('fichas').getPublicUrl(path).data.publicUrl;
    const target = form.elements.namedItem('pdf_url');
    if (target instanceof HTMLInputElement) target.value = publicUrl;
    if (!extractedText.trim()) {
      if (statusEl)
        statusEl.textContent =
          'PDF subido, pero no contiene texto seleccionable. Pega texto extraido por OCR para generar el borrador.';
      return;
    }
    if (statusEl) {
      statusEl.textContent = `PDF cargado: ${file.name}. Texto extraido: ${extractedText.length.toLocaleString('es-CO')} caracteres.`;
    }
  });
  input.click();
}

/** Cached blob: URL for pdf.js worker (avoids Hostinger serving .mjs as text/plain). */
let pdfWorkerSrcPromise: Promise<string> | null = null;

/**
 * Resolve pdf.js workerSrc as a blob URL with a JS MIME type.
 * Hostinger/LiteSpeed often serves hashed `.mjs` assets as `text/plain`; with
 * `X-Content-Type-Options: nosniff` the browser refuses to run them as module
 * workers, which breaks PDF text extraction in admin ingesta.
 */
async function resolvePdfWorkerSrc(): Promise<string> {
  if (!pdfWorkerSrcPromise) {
    pdfWorkerSrcPromise = (async () => {
      const builtWorkerUrl = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
        import.meta.url
      ).toString();
      try {
        const response = await fetch(builtWorkerUrl);
        if (!response.ok) {
          throw new Error(`Worker HTTP ${response.status}`);
        }
        const code = await response.text();
        return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      } catch {
        return builtWorkerUrl;
      }
    })();
  }
  return pdfWorkerSrcPromise;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = await resolvePdfWorkerSrc();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!pageText) continue;

    pages.push(`Pagina ${pageNumber}\n${pageText}`);
    totalChars += pageText.length;
    if (totalChars >= INGEST_PDF_MAX_CHARS) {
      pages.push('[Texto truncado por limite de ingesta.]');
      break;
    }
  }

  return pages.join('\n\n').slice(0, INGEST_PDF_MAX_CHARS);
}

function _listWithCsv(
  tableName: string,
  rows: Row[],
  keys: string[],
  detailRoute?: string
): string {
  const csvPayload = escapeHtml(JSON.stringify(rows));
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>${escapeHtml(tableName)}</h2>
        <button class="admin-button" data-csv="${csvPayload}" data-filename="${escapeHtml(tableName)}.csv" type="button">Exportar CSV</button>
      </div>
      ${table(
        [...keys, 'Acciones'],
        rows.map(row => [
          ...keys.map(key => formatCell(row[key])),
          [
            detailRoute
              ? `<a class="admin-button admin-button--ghost" href="#/${detailRoute}?id=${escapeHtml(text(row.id))}">Ver</a>`
              : '',
            row['leida'] === false
              ? `<button class="admin-button admin-button--ghost" data-table="${escapeHtml(tableName)}" data-mark-read="${escapeHtml(text(row.id))}" type="button">Marcar leida</button>`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        ])
      )}
    </section>`;
}

function entityImportForm(entity: ExcelEntity, label: string, help: string): string {
  return `
    <form class="admin-panel admin-form" data-entity-import-form="${escapeHtml(entity)}">
      <div class="admin-panel__head">
        <h2>Importar ${escapeHtml(label)} desde Excel</h2>
        <button class="admin-button" type="submit">Importar Excel</button>
      </div>
      <div class="admin-upload-box">
        <div>
          <strong>Sube un archivo .xlsx o .xls</strong>
          <p>${escapeHtml(help)}</p>
        </div>
        <label class="admin-button admin-button--ghost">
          Seleccionar archivo
          <input data-entity-import-file type="file" accept=".xlsx,.xls" hidden />
        </label>
      </div>
      <p class="admin-help" data-entity-import-status>Sin archivo seleccionado.</p>
    </form>`;
}

function table(headers: string[], rows: string[][], className = ''): string {
  return `<div class="admin-table-wrap"><table class="admin-table ${escapeHtml(className)}"><thead><tr>${headers
    .map(h => `<th>${h.trim().startsWith('<') ? h : escapeHtml(h)}</th>`)
    .join('')}</tr></thead><tbody>${
    rows.length
      ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headers.length}">Sin registros.</td></tr>`
  }</tbody></table></div>`;
}

function productListCell(
  row: Row,
  column: ProductListColumn,
  familias: Row[],
  tipos: Row[]
): string {
  const productId = text(row.id);
  const productSlug = text(row.slug) || productId;
  const name = column.key;
  const baseAttrs = `data-product-id="${escapeHtml(productId)}" data-product-field="${escapeHtml(name)}"`;
  const value = row[name];
  if (column.type === 'computed') {
    if (name === 'fabricante_distribuidor') {
      return escapeHtml(formatFabricanteDistribuidor(row));
    }
    return '—';
  }
  if (column.type === 'image') {
    const imageUrl = text(value);
    return `
      <div class="admin-product-image-cell">
        <div class="admin-product-image-cell__media">
          ${
            imageUrl
              ? `<img class="admin-thumb" src="${escapeHtml(imageUrl)}" alt="" width="48" height="48" loading="lazy" />`
              : '<span class="admin-image-empty">Sin foto</span>'
          }
        </div>
        <div class="admin-row-actions admin-row-actions--product-media">
          <button class="admin-button" data-product-row-save="${escapeHtml(productId)}" type="button">Guardar</button>
          <button class="admin-button admin-button--ghost" data-product-row-upload="${escapeHtml(productId)}" type="button">Subir foto</button>
          <button class="admin-button admin-button--ghost" data-product-row-gallery-upload="${escapeHtml(productId)}" type="button">Subir galería</button>
          <a
            class="admin-button admin-button--ghost"
            href="/es/productos/${encodeURIComponent(productSlug)}/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver producto online
          </a>
          <a class="admin-button admin-button--ghost" href="#/producto?id=${encodeURIComponent(productId)}">Detalle</a>
        </div>
      </div>`;
  }
  if (column.type === 'gallery') {
    const urls = stringArray(value);
    return `
      <div class="admin-gallery-cell">
        <div class="admin-gallery-preview">
          ${
            urls.length
              ? urls
                  .slice(0, 4)
                  .map(
                    url =>
                      `<img class="admin-gallery-thumb" src="${escapeHtml(url)}" alt="" width="32" height="32" loading="lazy" />`
                  )
                  .join('')
              : '<span class="admin-image-empty">Sin galería</span>'
          }
        </div>
        <textarea class="admin-inline-input admin-inline-input--textarea" ${baseAttrs}>${escapeHtml(urls.join('\n'))}</textarea>
      </div>`;
  }
  if (column.type === 'boolean') {
    return `<label class="admin-inline-check"><input ${baseAttrs} type="checkbox" ${value ? 'checked' : ''} /><span></span></label>`;
  }
  if (column.type === 'select') {
    const options =
      name === 'familia_id'
        ? familias.map((item): [string, string] => [text(item.id), text(item.nombre_es)])
        : name === 'tipo_id'
          ? [['', 'Sin asignar'] as [string, string]].concat(
              tipos.map((item): [string, string] => [text(item.id), text(item.nombre_es)])
            )
          : (column.options ?? []);
    return `<select class="admin-inline-input admin-inline-input--select" ${baseAttrs}>${options
      .map(
        ([optionValue, label]) =>
          `<option value="${escapeHtml(optionValue)}" ${optionValue === text(value) ? 'selected' : ''}>${escapeHtml(label)}</option>`
      )
      .join('')}</select>`;
  }
  if (column.type === 'textarea') {
    return `<textarea class="admin-inline-input admin-inline-input--textarea" ${baseAttrs}>${escapeHtml(text(value))}</textarea>`;
  }
  if (column.type === 'json') {
    const jsonValue =
      value && typeof value === 'object' ? JSON.stringify(value, null, 2) : text(value);
    return `<textarea class="admin-inline-input admin-inline-input--json" ${baseAttrs}>${escapeHtml(jsonValue)}</textarea>`;
  }
  if (column.type === 'list') {
    return `<textarea class="admin-inline-input admin-inline-input--textarea" ${baseAttrs}>${escapeHtml(stringArray(value).join('\n'))}</textarea>`;
  }
  if (column.type === 'link') {
    const url = text(value);
    return `<div class="admin-inline-link-cell"><input class="admin-inline-input" ${baseAttrs} type="url" value="${escapeHtml(url)}" />${
      url
        ? `<a class="admin-button admin-button--ghost" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
        : ''
    }</div>`;
  }
  return `<input class="admin-inline-input" ${baseAttrs} type="${column.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(text(value))}" />`;
}

function field(
  name: string,
  label: string,
  value = '',
  required = false,
  type = 'text',
  extraAttrs = ''
): string {
  return `<label class="admin-field">${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${extraAttrs} /></label>`;
}

function textarea(name: string, label: string, value = ''): string {
  return `<label class="admin-field">${escapeHtml(label)}<textarea name="${escapeHtml(name)}">${escapeHtml(value)}</textarea></label>`;
}

function markdownEditor(name: string, label: string, value = ''): string {
  const cmds: Array<[string, string, string]> = [
    ['h2', 'H2', 'Titulo H2'],
    ['h3', 'H3', 'Titulo H3'],
    ['bold', 'B', 'Negrita'],
    ['italic', 'I', 'Cursiva'],
    ['link', 'Link', 'Enlace'],
    ['ul', 'Lista', 'Lista con viñetas'],
    ['quote', '>', 'Cita'],
    ['hr', '—', 'Separador'],
    ['pdp', 'PDP', 'Enlace producto /es/productos/slug'],
  ];
  return `
    <div class="admin-md-editor" data-md-editor>
      <div class="admin-md-toolbar" role="toolbar" aria-label="Formato ${escapeHtml(label)}">
        ${cmds
          .map(
            ([cmd, labelBtn, title]) =>
              `<button type="button" class="admin-button admin-button--ghost admin-md-toolbar__btn" data-md-cmd="${cmd}" title="${escapeHtml(title)}">${escapeHtml(labelBtn)}</button>`
          )
          .join('')}
      </div>
      <label class="admin-field">${escapeHtml(label)}
        <textarea name="${escapeHtml(name)}" class="admin-md-body" data-md-body rows="18">${escapeHtml(value)}</textarea>
      </label>
    </div>`;
}

function checkbox(name: string, label: string, checked: boolean): string {
  return `<label class="admin-field"><span><input name="${escapeHtml(name)}" type="checkbox" ${checked ? 'checked' : ''} /> ${escapeHtml(label)}</span></label>`;
}

function upload(bucket: string, target: string, label: string): string {
  return `<button class="admin-button admin-button--ghost" data-upload="${escapeHtml(bucket)}" data-target="${escapeHtml(target)}" type="button">${escapeHtml(label)}</button>`;
}

function select(
  name: string,
  label: string,
  value: string,
  rows: Row[],
  labelKey: string,
  optional = false
): string {
  return `<label class="admin-field">${escapeHtml(label)}<select name="${escapeHtml(name)}">${optional ? '<option value="">Sin asignar</option>' : ''}${rows
    .map(row => {
      const id = text(row.id);
      return `<option value="${escapeHtml(id)}" ${id === value ? 'selected' : ''}>${escapeHtml(text(row[labelKey]) || text(row.slug))}</option>`;
    })
    .join('')}</select></label>`;
}

function selectStatic(
  name: string,
  label: string,
  value: string,
  options: Array<[string, string]>
): string {
  return `<label class="admin-field">${escapeHtml(label)}<select name="${escapeHtml(name)}">${options
    .map(
      ([id, optionLabel]) =>
        `<option value="${escapeHtml(id)}" ${id === value ? 'selected' : ''}>${escapeHtml(optionLabel)}</option>`
    )
    .join('')}</select></label>`;
}

function status(value: unknown): string {
  return value
    ? '<span class="admin-badge admin-badge--ok">Activo</span>'
    : '<span class="admin-badge admin-badge--warn">Inactivo</span>';
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

function setFormValue(form: HTMLFormElement, name: string, value: string): void {
  const element = form.elements.namedItem(name);
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    element.value = value;
  }
}

function setCheckboxValue(form: HTMLFormElement, name: string, checked: boolean): void {
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    element.checked = checked;
  }
}

function formatCell(value: unknown): string {
  if (typeof value === 'boolean') return status(value);
  if (typeof value === 'object' && value !== null)
    return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
  return escapeHtml(text(value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const clean = String(value ?? '').trim();
  return clean || null;
}

function numberOrNull(value: unknown): number | null {
  const clean = String(value ?? '').trim();
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function parseJson(value: unknown, fallback: unknown): unknown {
  try {
    return JSON.parse(String(value ?? ''));
  } catch {
    return fallback;
  }
}

function datetimeLocal(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => text(item)).filter(Boolean) : [];
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

type ProductosExcelFilters = {
  q: string;
  familia_id: string;
  tipo_id: string;
  activo: string;
  tipo_comercial: string;
  incorporado_desde: string;
  incorporado_hasta: string;
  ordenar: string;
};

type ProveedoresQuery = {
  q: string;
  activo: string;
  incorporado_desde: string;
  incorporado_hasta: string;
  ordenar: string;
};

type ExcelEntity = 'clientes' | 'proveedores' | 'pedidos';
type AdminImportEntity = ExcelEntity | 'productos' | 'familias' | 'tipos';

type EntityExcelConfig = {
  entity: ExcelEntity;
  table: string;
  sheet: string;
  conflict: string;
  headers: string[];
  sample: Record<string, unknown>;
};

const CLIENTES_EXCEL_HEADERS = [
  'email',
  'nombre',
  'apellido',
  'telefono',
  'institucion',
  'tipo_cliente',
  'documento_tipo',
  'documento_numero',
  'razon_social',
  'tipo_documento',
  'numero_documento',
  'tipo_persona',
  'responsable_iva',
  'agente_retencion',
  'agente_reteica',
  'email_facturacion',
  'direccion_facturacion',
  'consentimiento_datos',
  'consentimiento_timestamp',
  'notas',
  'total_pedidos',
  'total_gastado',
  'ultimo_pedido_at',
];

const PROVEEDORES_EXCEL_HEADERS = [
  'slug',
  'nombre',
  'contacto_email',
  'contacto_whatsapp',
  'canal',
  'webhook_url',
  'api_config',
  'notas',
  'activo',
];

const PEDIDOS_EXCEL_HEADERS = [
  'id',
  'cliente_id',
  'cliente',
  'items',
  'subtotal',
  'subtotal_sin_impuestos',
  'descuento_total',
  'impuesto_total',
  'retencion_total',
  'envio_total',
  'total',
  'moneda',
  'mercado',
  'proveedor_pago',
  'estado',
  'referencia_pasarela',
  'checkout_url',
  'cupon_codigo',
  'direccion_facturacion',
  'direccion_envio',
  'facturacion_electronica_solicitada',
  'facturacion_electronica_estado',
  'metadata',
  'consentimiento_datos',
  'consentimiento_timestamp',
  'leida',
];

const ENTITY_EXCEL_CONFIGS: Record<ExcelEntity, EntityExcelConfig> = {
  clientes: {
    entity: 'clientes',
    table: 'clientes',
    sheet: 'clientes',
    conflict: 'email',
    headers: CLIENTES_EXCEL_HEADERS,
    sample: {
      email: 'cliente@ejemplo.com',
      nombre: 'Nombre',
      apellido: 'Apellido',
      telefono: '+57 300 000 0000',
      institucion: 'Clinica ejemplo',
      tipo_cliente: 'b2b',
      responsable_iva: false,
      agente_retencion: false,
      agente_reteica: false,
      direccion_facturacion: '{}',
      consentimiento_datos: true,
      notas: 'Notas internas',
    },
  },
  proveedores: {
    entity: 'proveedores',
    table: 'proveedores',
    sheet: 'proveedores',
    conflict: 'slug',
    headers: PROVEEDORES_EXCEL_HEADERS,
    sample: {
      slug: 'proveedor-ejemplo',
      nombre: 'Proveedor ejemplo',
      contacto_email: 'proveedor@ejemplo.com',
      contacto_whatsapp: '+57 300 000 0000',
      canal: 'email',
      webhook_url: '',
      api_config: '{}',
      notas: 'Condiciones internas',
      activo: true,
    },
  },
  pedidos: {
    entity: 'pedidos',
    table: 'pedidos',
    sheet: 'pedidos',
    conflict: 'referencia_pasarela',
    headers: PEDIDOS_EXCEL_HEADERS,
    sample: {
      cliente: '{"nombre":"Cliente","email":"cliente@ejemplo.com"}',
      items: '[]',
      subtotal: 0,
      total: 0,
      moneda: 'COP',
      mercado: 'CO',
      proveedor_pago: 'wompi',
      estado: 'pendiente',
      referencia_pasarela: 'REF-EJEMPLO',
      metadata: '{}',
      leida: false,
    },
  },
};

type ProductosExcelImportRow = Row & {
  slug: string;
  sku: string | null;
  gtin: string | null;
  nombre_es: string;
  nombre_en: string | null;
  descripcion_corta_es: string | null;
  descripcion_corta_en: string | null;
  descripcion_larga_es: string | null;
  descripcion_larga_en: string | null;
  familia_slug: string | null;
  familia: string | null;
  tipo_slug: string | null;
  tipo: string | null;
  tipo_comercial: 'consumible' | 'equipo';
  fulfillment_mode: 'dropship' | 'cotizacion' | 'individualizado';
  precio: number | null;
  precio_regular: number | null;
  precio_oferta: number | null;
  dian_codigo: string | null;
  tarifa_iva_pct: number | null;
  retencion_fuente_pct: number | null;
  retencion_iva_pct: number | null;
  retencion_ica_pct: number | null;
  moneda: string;
  stock: number | null;
  gestionar_stock: boolean;
  stock_estado: 'instock' | 'outofstock' | 'onbackorder';
  backorder_policy: 'no' | 'notify' | 'yes';
  disponible: boolean;
  excluido_iva: boolean;
  activo: boolean;
  destacado: boolean;
  nuevo: boolean;
  ficha_pdf: string | null;
  especificaciones: Row[];
  aplicaciones_es: string[];
  aplicaciones_en: string[];
  atributos: Row;
  peso_kg: number | null;
  dimensiones_cm: Row;
  orden: number;
};

const PRODUCTOS_EXCEL_HEADERS = [
  'slug',
  'sku',
  'gtin',
  'nombre_es',
  'nombre_en',
  'descripcion_corta_es',
  'descripcion_corta_en',
  'descripcion_larga_es',
  'descripcion_larga_en',
  'familia_slug',
  'familia',
  'tipo_slug',
  'tipo',
  'tipo_comercial',
  'fulfillment_mode',
  'precio',
  'precio_regular',
  'precio_oferta',
  'dian_codigo',
  'tarifa_iva_pct',
  'retencion_fuente_pct',
  'retencion_iva_pct',
  'retencion_ica_pct',
  'moneda',
  'stock',
  'gestionar_stock',
  'stock_estado',
  'backorder_policy',
  'disponible',
  'excluido_iva',
  'activo',
  'destacado',
  'nuevo',
  'ficha_pdf',
  'especificaciones',
  'aplicaciones_es',
  'aplicaciones_en',
  'atributos',
  'peso_kg',
  'dimensiones_cm',
  'orden',
];

function getExcelEntity(value: string | undefined): ExcelEntity | null {
  return value === 'clientes' || value === 'proveedores' || value === 'pedidos' ? value : null;
}

async function exportEntityExcel(entity: ExcelEntity) {
  const rows = await fetchEntityRowsForExcel(entity);
  const config = ENTITY_EXCEL_CONFIGS[entity];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(
    rows.map(row => entityRowToExcel(row, entity)),
    {
      header: config.headers,
    }
  );
  XLSX.utils.book_append_sheet(workbook, sheet, config.sheet);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [`I-ME ${entity}`],
      ['Exportado desde el admin.'],
      [`Edite solo la hoja "${config.sheet}".`],
      [
        `Importación: ${entity === 'pedidos' ? 'actualiza por id o referencia_pasarela' : `upsert por ${config.conflict}`}.`,
      ],
      ['Columnas JSON deben conservar JSON válido. Booleanos: true/false, si/no, 1/0.'],
    ]),
    'instrucciones'
  );
  downloadWorkbook(workbook, `${entity}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function buildEntityTemplateWorkbook(entity: ExcelEntity): XLSX.WorkBook {
  const config = ENTITY_EXCEL_CONFIGS[entity];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([config.sample], { header: config.headers }),
    config.sheet
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [`Plantilla de ${entity}`],
      [`Hoja principal: ${config.sheet}.`],
      [
        `Clave de importación: ${entity === 'pedidos' ? 'id o referencia_pasarela' : config.conflict}.`,
      ],
      ['No cambies los encabezados de columnas.'],
    ]),
    'instrucciones'
  );
  return workbook;
}

async function fetchEntityRowsForExcel(entity: ExcelEntity): Promise<Row[]> {
  if (entity === 'clientes') return fetchClientesForExcel();
  if (entity === 'proveedores') return fetchProveedoresForExcel();
  return fetchPedidosForExcel();
}

async function fetchClientesForExcel(): Promise<Row[]> {
  const params = hashParams();
  const q = (params.get('q') ?? '').trim();
  const tipo = params.get('tipo_cliente') ?? '';
  let query = supabase!.from('clientes').select('*').order('updated_at', { ascending: false });
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '');
    if (safeQ) {
      query = query.or(
        `email.ilike.%${safeQ}%,nombre.ilike.%${safeQ}%,apellido.ilike.%${safeQ}%,institucion.ilike.%${safeQ}%`
      );
    }
  }
  if (tipo) query = query.eq('tipo_cliente', tipo);
  return fetchQueryPages(query);
}

async function fetchProveedoresForExcel(): Promise<Row[]> {
  const params = hashParams();
  const filters: ProveedoresQuery = {
    q: (params.get('q') ?? '').trim(),
    activo: params.get('activo') ?? '',
    incorporado_desde: params.get('incorporado_desde') ?? '',
    incorporado_hasta: params.get('incorporado_hasta') ?? '',
    ordenar: params.get('ordenar') ?? 'alfabetico_asc',
  };
  let query = supabase!.from('proveedores').select('*');
  if (filters.q) {
    const safeQ = filters.q.replace(/[,()%]/g, '');
    if (safeQ) query = query.or(`nombre.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`);
  }
  if (filters.activo === '1') query = query.eq('activo', true);
  if (filters.activo === '0') query = query.eq('activo', false);
  if (filters.incorporado_desde)
    query = query.gte('created_at', `${filters.incorporado_desde}T00:00:00`);
  if (filters.incorporado_hasta)
    query = query.lte('created_at', `${filters.incorporado_hasta}T23:59:59.999`);
  if (filters.ordenar === 'alfabetico_desc') {
    query = query.order('nombre', { ascending: false }).order('created_at', { ascending: false });
  } else if (filters.ordenar === 'recientes') {
    query = query.order('created_at', { ascending: false }).order('nombre', { ascending: true });
  } else if (filters.ordenar === 'antiguos') {
    query = query.order('created_at', { ascending: true }).order('nombre', { ascending: true });
  } else {
    query = query.order('nombre', { ascending: true }).order('created_at', { ascending: false });
  }
  return fetchQueryPages(query);
}

async function fetchPedidosForExcel(): Promise<Row[]> {
  const params = hashParams();
  const q = (params.get('q') ?? '').trim();
  const estado = params.get('estado') ?? '';
  const mercado = params.get('mercado') ?? '';
  const leida = params.get('leida') ?? '';
  let query = supabase!.from('pedidos').select('*').order('created_at', { ascending: false });
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '');
    if (safeQ) {
      query = query.or(
        `referencia_pasarela.ilike.%${safeQ}%,checkout_url.ilike.%${safeQ}%,moneda.ilike.%${safeQ}%`
      );
    }
  }
  if (estado) query = query.eq('estado', estado);
  if (mercado) query = query.eq('mercado', mercado);
  if (leida === '1') query = query.eq('leida', true);
  if (leida === '0') query = query.eq('leida', false);
  return fetchQueryPages(query);
}

async function fetchQueryPages(query: {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: Error | null }>;
}): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function entityRowToExcel(row: Row, entity: ExcelEntity): Record<string, unknown> {
  const config = ENTITY_EXCEL_CONFIGS[entity];
  const result: Record<string, unknown> = {};
  for (const header of config.headers) {
    const value = row[header];
    result[header] =
      value && typeof value === 'object' ? JSON.stringify(value, null, 2) : (value ?? '');
  }
  return result;
}

async function importEntityExcel(
  entity: ExcelEntity,
  file: File
): Promise<{ processed: number; skipped: number }> {
  const rows = await readWorkbookRows(file, entity);
  if (!rows.length) throw new Error('La hoja principal no contiene filas.');
  const parsedRows = rows.map((row, index) => ({
    row: normalizeEntityImportRow(entity, row),
    index,
  }));
  const payloads = parsedRows.filter(item => Boolean(item.row)).map(item => item.row as Row);
  if (!payloads.length) {
    const expected = entityImportKeyHint(entity);
    throw new Error(
      `No hay filas válidas para importar. Verifica que exista la columna ${expected}.`
    );
  }

  const result = await invokeAdminImport(entity, payloads);
  return { processed: result.processed, skipped: rows.length - payloads.length + result.skipped };
}

async function readWorkbookRows(
  source: File | ArrayBuffer,
  entity: ExcelEntity | 'productos'
): Promise<Row[]> {
  const buffer = source instanceof File ? await readFileArrayBuffer(source) : source;
  return readWorkbookRowsFromBuffer(buffer, entity);
}

async function readWorkbookRowsFromBuffer(
  buffer: ArrayBuffer,
  entity: ExcelEntity | 'productos'
): Promise<Row[]> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch (error) {
    throw new Error(
      `No se pudo leer el archivo Excel. Confirma que sea .xlsx/.xls válido y no esté protegido. ${error instanceof Error ? error.message : ''}`.trim(),
      { cause: error }
    );
  }
  const preferred = entity === 'productos' ? 'productos' : ENTITY_EXCEL_CONFIGS[entity].sheet;
  const sheetName =
    workbook.SheetNames.find(name => name.toLowerCase() === preferred.toLowerCase()) ??
    workbook.SheetNames.find(name => name.toLowerCase() !== 'instrucciones') ??
    workbook.SheetNames[0];
  if (!sheetName) throw new Error('El archivo Excel no contiene hojas.');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`No se pudo leer la hoja ${sheetName}.`);
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' });
  if (!rows.length) {
    throw new Error(`La hoja "${sheetName}" no contiene filas de datos.`);
  }
  return rows;
}

async function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer();
  } catch {
    // file.arrayBuffer() no disponible o falló; usar FileReader como fallback
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    const failWithMessage = (extra = '') => {
      reject(
        new Error(
          `No se pudo leer el archivo seleccionado.${extra} Vuelve a seleccionarlo e intenta de nuevo.`
        )
      );
    };
    reader.onerror = () => failWithMessage(' El archivo puede haber dejado de estar accesible.');
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
        return;
      }
      reject(new Error('No se pudo interpretar el archivo seleccionado.'));
    };
    try {
      reader.readAsArrayBuffer(file);
    } catch {
      failWithMessage(' El archivo puede no ser accesible en este momento.');
    }
  });
}

async function invokeAdminImport(
  entity: AdminImportEntity,
  rows: Row[]
): Promise<{ processed: number; skipped: number }> {
  const {
    data: { session },
  } = await supabase!.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Sesión expirada. Vuelve a entrar al admin.');

  const url = `${import.meta.env['PUBLIC_SUPABASE_URL']}/functions/v1/admin-import`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env['PUBLIC_SUPABASE_ANON_KEY'] as string,
    },
    body: JSON.stringify({ entity, rows }),
  });
  const json = (await response.json().catch(() => null)) as Row | null;
  if (!response.ok) {
    const error = json?.error && typeof json.error === 'object' ? (json.error as Row) : null;
    const details = error?.details ? ` Detalle: ${formatErrorDetails(error.details)}` : '';
    throw new Error(`${text(error?.message) || `HTTP ${response.status}`}${details}`.trim());
  }
  return {
    processed: Number(json?.processed ?? 0),
    skipped: Number(json?.skipped ?? 0),
  };
}

function normalizeEntityImportRow(entity: ExcelEntity, rawRow: Row): Row | null {
  const row = normalizeImportedRowKeys(rawRow);
  if (entity === 'clientes') return normalizeClienteImportRow(row);
  if (entity === 'proveedores') return normalizeProveedorImportRow(row);
  return normalizePedidoImportRow(row);
}

function normalizeImportedRowKeys(row: Row): Row {
  const normalized: Row = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeExcelKey(key)] = value;
  }
  return normalized;
}

function normalizeClienteImportRow(row: Row): Row | null {
  const email = text(row.email).trim().toLowerCase();
  if (!email) return null;
  return removeUndefined({
    email,
    nombre: emptyStringToNull(text(row.nombre)),
    apellido: emptyStringToNull(text(row.apellido)),
    telefono: emptyStringToNull(text(row.telefono)),
    institucion: emptyStringToNull(text(row.institucion)),
    tipo_cliente: ['b2b', 'b2c', 'mixto'].includes(text(row.tipo_cliente))
      ? text(row.tipo_cliente)
      : 'b2b',
    documento_tipo: emptyStringToNull(text(row.documento_tipo)),
    documento_numero: emptyStringToNull(text(row.documento_numero)),
    razon_social: emptyStringToNull(text(row.razon_social)),
    tipo_documento: emptyStringToNull(text(row.tipo_documento)),
    numero_documento: emptyStringToNull(text(row.numero_documento)),
    tipo_persona: ['natural', 'juridica'].includes(text(row.tipo_persona))
      ? text(row.tipo_persona)
      : null,
    responsable_iva: parseExcelBoolean(row.responsable_iva, false),
    agente_retencion: parseExcelBoolean(row.agente_retencion, false),
    agente_reteica: parseExcelBoolean(row.agente_reteica, false),
    email_facturacion: emptyStringToNull(text(row.email_facturacion)),
    direccion_facturacion: parseExcelJsonObject(row.direccion_facturacion),
    consentimiento_datos: parseExcelBoolean(row.consentimiento_datos, false),
    consentimiento_timestamp: emptyStringToNull(text(row.consentimiento_timestamp)),
    notas: emptyStringToNull(text(row.notas)),
    total_pedidos: parseExcelInteger(row.total_pedidos, 0),
    total_gastado: parseExcelNumber(row.total_gastado) ?? 0,
    ultimo_pedido_at: emptyStringToNull(text(row.ultimo_pedido_at)),
  });
}

function normalizeProveedorImportRow(row: Row): Row | null {
  const nombre = text(row.nombre).trim();
  const slug = slugify(text(row.slug) || nombre);
  if (!slug || !nombre) return null;
  const canal = text(row.canal);
  return removeUndefined({
    slug,
    nombre,
    contacto_email: emptyStringToNull(text(row.contacto_email)),
    contacto_whatsapp: emptyStringToNull(text(row.contacto_whatsapp)),
    canal: ['email', 'whatsapp', 'webhook', 'api', 'manual'].includes(canal) ? canal : 'email',
    webhook_url: emptyStringToNull(text(row.webhook_url)),
    api_config: parseExcelJsonObject(row.api_config),
    notas: emptyStringToNull(text(row.notas)),
    activo: parseExcelBoolean(row.activo, true),
  });
}

function normalizePedidoImportRow(row: Row): Row | null {
  const id = normalizeUuid(text(row.id));
  const referencia = emptyStringToNull(text(row.referencia_pasarela));
  if (!id && !referencia) return null;
  const estado = text(row.estado);
  const mercado = text(row.mercado);
  const proveedorPago = text(row.proveedor_pago);
  const facturaEstado = text(row.facturacion_electronica_estado);
  return removeUndefined({
    ...(id ? { id } : {}),
    cliente_id: normalizeUuid(text(row.cliente_id)),
    cliente: parseExcelJsonObject(row.cliente),
    items: parseExcelJsonList(row.items),
    subtotal: parseExcelNumber(row.subtotal) ?? 0,
    subtotal_sin_impuestos: parseExcelNumber(row.subtotal_sin_impuestos) ?? 0,
    descuento_total: parseExcelNumber(row.descuento_total) ?? 0,
    impuesto_total: parseExcelNumber(row.impuesto_total) ?? 0,
    retencion_total: parseExcelNumber(row.retencion_total) ?? 0,
    envio_total: parseExcelNumber(row.envio_total) ?? 0,
    total: parseExcelNumber(row.total) ?? 0,
    moneda: text(row.moneda) || 'COP',
    mercado: mercado === 'INTL' ? 'INTL' : 'CO',
    proveedor_pago: ['bold', 'stripe', 'wompi', 'transferencia'].includes(proveedorPago)
      ? proveedorPago
      : 'wompi',
    estado: PEDIDO_ESTADOS.some(([value]) => value === estado) ? estado : 'pendiente',
    referencia_pasarela: referencia,
    checkout_url: emptyStringToNull(text(row.checkout_url)),
    cupon_codigo: emptyStringToNull(text(row.cupon_codigo)),
    direccion_facturacion: parseExcelJsonObject(row.direccion_facturacion),
    direccion_envio: parseExcelJsonObject(row.direccion_envio),
    facturacion_electronica_solicitada: parseExcelBoolean(
      row.facturacion_electronica_solicitada,
      false
    ),
    facturacion_electronica_estado: [
      'no_solicitada',
      'pendiente_pago',
      'pendiente_envio',
      'emitida',
      'rechazada',
      'error',
    ].includes(facturaEstado)
      ? facturaEstado
      : 'no_solicitada',
    metadata: parseExcelJsonObject(row.metadata),
    consentimiento_datos: parseExcelBoolean(row.consentimiento_datos, false),
    consentimiento_timestamp: emptyStringToNull(text(row.consentimiento_timestamp)),
    leida: parseExcelBoolean(row.leida, false),
  });
}

function parseExcelInteger(value: unknown, fallback = 0): number {
  const parsed = parseExcelNumber(value);
  return parsed === null ? fallback : Math.trunc(parsed);
}

function removeUndefined(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function entityImportKeyHint(entity: ExcelEntity): string {
  if (entity === 'clientes') return '"email"';
  if (entity === 'proveedores') return '"slug"';
  return '"id" o "referencia_pasarela"';
}

function formatImportError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') return formatErrorDetails(error);
  return 'No se pudo importar Excel. Revisa que el archivo tenga la hoja y columnas correctas.';
}

function formatErrorDetails(details: unknown): string {
  if (Array.isArray(details)) {
    return details
      .slice(0, 5)
      .map(item => {
        if (item && typeof item === 'object') {
          const row = (item as Row).row ? `fila ${text((item as Row).row)}: ` : '';
          return `${row}${text((item as Row).message) || JSON.stringify(item)}`;
        }
        return text(item);
      })
      .filter(Boolean)
      .join(' | ');
  }
  if (details && typeof details === 'object') {
    const message = text((details as Row).message);
    const code = text((details as Row).code);
    return [code, message].filter(Boolean).join(' - ') || JSON.stringify(details);
  }
  return text(details);
}

function bindProductExcelTools() {
  const app = document.getElementById('admin-app');
  if (!app) return;
  const exportButton = app.querySelector<HTMLButtonElement>('[data-products-export-xlsx]');
  exportButton?.addEventListener('click', async () => {
    try {
      exportButton.disabled = true;
      exportButton.textContent = 'Exportando...';
      await exportProductosExcel();
      toast('Excel exportado');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo exportar a Excel');
    } finally {
      exportButton.disabled = false;
      exportButton.textContent = 'Exportar Excel';
    }
  });

  const templateButton = app.querySelector<HTMLButtonElement>('[data-products-template-xlsx]');
  templateButton?.addEventListener('click', () => {
    try {
      downloadWorkbook(
        buildProductosTemplateWorkbook(),
        `productos-plantilla-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast('Plantilla descargada');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se pudo descargar la plantilla');
    }
  });

  const form = app.querySelector<HTMLFormElement>('[data-products-import-form]');
  if (!form) return;
  const fileInput = form.querySelector<HTMLInputElement>('[data-products-import-file]');
  const status = form.querySelector<HTMLElement>('[data-products-import-status]');
  let pendingImportBuffer: ArrayBuffer | null = null;
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    pendingImportBuffer = null;
    if (!status) return;
    if (!file) {
      status.textContent = 'Sin archivo seleccionado.';
      return;
    }
    status.textContent = `Archivo seleccionado: ${file.name}. Leyendo archivo...`;
    void (async () => {
      try {
        pendingImportBuffer = await readFileArrayBuffer(file);
        if (fileInput.files?.[0]?.name === file.name) {
          status.textContent = `Archivo listo: ${file.name}`;
        }
      } catch (error) {
        pendingImportBuffer = null;
        const message = formatImportError(error);
        if (fileInput.files?.[0]?.name === file.name) {
          status.innerHTML = `<span class="admin-import-error">Error al leer:</span> ${escapeHtml(message)}`;
        }
        toast(message);
      }
    })();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const file = fileInput?.files?.[0];
    if (!file) {
      toast('Selecciona un archivo Excel.');
      return;
    }
    const createMissingTaxonomy =
      form.querySelector<HTMLInputElement>('[data-products-import-create-taxonomy]')?.checked ??
      false;
    try {
      if (status) status.textContent = 'Procesando Excel...';
      const buffer = pendingImportBuffer ?? (await readFileArrayBuffer(file));
      pendingImportBuffer = buffer;
      const result = await importProductosExcel(buffer, { createMissingTaxonomy });
      if (status) {
        status.textContent = `Importados ${result.upserted} productos. ${result.createdFamilies} familias y ${result.createdTypes} tipos creados. ${result.warnings.length} advertencias.`;
      }
      toast(`Importación completada: ${result.upserted} productos`);
      await render();
    } catch (error) {
      const message = formatImportError(error);
      if (status) {
        status.innerHTML = `<span class="admin-import-error">Error al importar:</span> ${escapeHtml(message)}`;
      }
      toast(message);
    }
  });
}

function getCurrentProductosFilters(): ProductosExcelFilters {
  const params = hashParams();
  return {
    q: (params.get('q') ?? '').trim(),
    familia_id: params.get('familia_id') ?? '',
    tipo_id: params.get('tipo_id') ?? '',
    activo: params.get('activo') ?? '',
    tipo_comercial: params.get('tipo_comercial') ?? '',
    incorporado_desde: params.get('incorporado_desde') ?? '',
    incorporado_hasta: params.get('incorporado_hasta') ?? '',
    ordenar: params.get('ordenar') ?? 'interno',
  };
}

async function fetchAllProductosForExcel(filters: ProductosExcelFilters): Promise<Row[]> {
  let query = supabase!.from('productos').select('*');
  if (filters.q) {
    const safeQ = filters.q.replace(/[,()%]/g, '');
    if (safeQ) query = query.or(`nombre_es.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`);
  }
  if (filters.familia_id) query = query.eq('familia_id', filters.familia_id);
  if (filters.tipo_id) query = query.eq('tipo_id', filters.tipo_id);
  if (filters.activo === '1') query = query.eq('activo', true);
  if (filters.activo === '0') query = query.eq('activo', false);
  if (filters.tipo_comercial) query = query.eq('tipo_comercial', filters.tipo_comercial);
  if (filters.incorporado_desde)
    query = query.gte('created_at', `${filters.incorporado_desde}T00:00:00`);
  if (filters.incorporado_hasta)
    query = query.lte('created_at', `${filters.incorporado_hasta}T23:59:59.999`);
  if (filters.ordenar === 'alfabetico_asc') {
    query = query.order('nombre_es', { ascending: true }).order('orden', { ascending: true });
  } else if (filters.ordenar === 'alfabetico_desc') {
    query = query.order('nombre_es', { ascending: false }).order('orden', { ascending: true });
  } else if (filters.ordenar === 'recientes') {
    query = query.order('created_at', { ascending: false }).order('nombre_es', { ascending: true });
  } else if (filters.ordenar === 'antiguos') {
    query = query.order('created_at', { ascending: true }).order('nombre_es', { ascending: true });
  } else {
    query = query.order('orden', { ascending: true }).order('nombre_es', { ascending: true });
  }
  const rows: Row[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function exportProductosExcel() {
  const filters = getCurrentProductosFilters();
  const [productos, familias, tipos] = await Promise.all([
    fetchAllProductosForExcel(filters),
    selectRows('familias', '*', 'orden', 500),
    selectRows('tipos', '*', 'orden', 1000),
  ]);
  const workbook = buildProductosWorkbook(productos, familias, tipos);
  downloadWorkbook(
    workbook,
    `productos-${filters.q ? slugify(filters.q) : 'catalogo'}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

function buildProductosWorkbook(productos: Row[], familias: Row[], tipos: Row[]): XLSX.WorkBook {
  const worksheetRows = productos.map(row => productoToExcelRow(row, familias, tipos));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(worksheetRows, { header: PRODUCTOS_EXCEL_HEADERS });
  XLSX.utils.book_append_sheet(workbook, sheet, 'productos');
  const readme = XLSX.utils.aoa_to_sheet([
    ['I-ME productos'],
    ['Exportado desde el admin.'],
    ['Edite solo la hoja "productos".'],
    ['Upsert por slug.'],
  ]);
  XLSX.utils.book_append_sheet(workbook, readme, 'instrucciones');
  return workbook;
}

function buildProductosTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(
    [
      {
        slug: 'ejemplo-producto',
        sku: 'SKU-EJEMPLO',
        nombre_es: 'Producto de ejemplo',
        tipo_comercial: 'equipo',
        fulfillment_mode: 'cotizacion',
        moneda: 'COP',
        disponible: true,
        activo: true,
        especificaciones: '[]',
        aplicaciones_es: '[]',
        aplicaciones_en: '[]',
        atributos: '{}',
        dimensiones_cm: '{}',
      },
    ],
    { header: PRODUCTOS_EXCEL_HEADERS }
  );
  XLSX.utils.book_append_sheet(workbook, sheet, 'productos');
  const readme = XLSX.utils.aoa_to_sheet([
    ['Plantilla de importacion de productos'],
    ['Columnas clave: slug, nombre_es, familia/tipo o familia_slug/tipo_slug.'],
    ['Las listas pueden ir separadas por salto de linea.'],
    ['Los JSON aceptan texto JSON valido.'],
  ]);
  XLSX.utils.book_append_sheet(workbook, readme, 'instrucciones');
  return workbook;
}

function productoToExcelRow(row: Row, familias: Row[], tipos: Row[]): Record<string, unknown> {
  const familiasPorId = new Map(familias.map(f => [text(f.id), f]));
  const tiposPorId = new Map(tipos.map(t => [text(t.id), t]));
  const familia = familiasPorId.get(text(row.familia_id));
  const tipo = tiposPorId.get(text(row.tipo_id));
  return {
    slug: text(row.slug),
    sku: text(row.sku),
    gtin: text(row.gtin),
    nombre_es: text(row.nombre_es),
    nombre_en: text(row.nombre_en),
    descripcion_corta_es: text(row.descripcion_corta_es),
    descripcion_corta_en: text(row.descripcion_corta_en),
    descripcion_larga_es: text(row.descripcion_larga_es),
    descripcion_larga_en: text(row.descripcion_larga_en),
    familia_slug: text(familia?.slug),
    familia: text(familia?.nombre_es),
    tipo_slug: text(tipo?.slug),
    tipo: text(tipo?.nombre_es),
    tipo_comercial: text(row.tipo_comercial),
    fulfillment_mode: text(row.fulfillment_mode),
    precio: row.precio ?? '',
    precio_regular: row.precio_regular ?? '',
    precio_oferta: row.precio_oferta ?? '',
    dian_codigo: text(row.dian_codigo),
    tarifa_iva_pct: row.tarifa_iva_pct ?? '',
    retencion_fuente_pct: row.retencion_fuente_pct ?? '',
    retencion_iva_pct: row.retencion_iva_pct ?? '',
    retencion_ica_pct: row.retencion_ica_pct ?? '',
    moneda: text(row.moneda) || 'COP',
    stock: row.stock ?? '',
    gestionar_stock: Boolean(row.gestionar_stock),
    stock_estado: text(row.stock_estado),
    backorder_policy: text(row.backorder_policy),
    disponible: row.disponible !== false,
    excluido_iva: Boolean(row.excluido_iva),
    activo: Boolean(row.activo),
    destacado: Boolean(row.destacado),
    nuevo: Boolean(row.nuevo),
    ficha_pdf: text(row.ficha_pdf),
    especificaciones: JSON.stringify(
      Array.isArray(row.especificaciones) ? row.especificaciones : [],
      null,
      2
    ),
    aplicaciones_es: stringArray(row.aplicaciones_es).join('\n'),
    aplicaciones_en: stringArray(row.aplicaciones_en).join('\n'),
    atributos: JSON.stringify(
      row.atributos && typeof row.atributos === 'object' ? row.atributos : {},
      null,
      2
    ),
    peso_kg: row.peso_kg ?? '',
    dimensiones_cm: JSON.stringify(
      row.dimensiones_cm && typeof row.dimensiones_cm === 'object' ? row.dimensiones_cm : {},
      null,
      2
    ),
    orden: numberOrZero(row.orden),
  };
}

async function selectProveedores(filters: ProveedoresQuery): Promise<Row[]> {
  let query = supabase!.from('proveedores').select('*');
  if (filters.q) {
    const safeQ = filters.q.replace(/[,()%]/g, '');
    if (safeQ) query = query.or(`nombre.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`);
  }
  if (filters.activo === '1') query = query.eq('activo', true);
  if (filters.activo === '0') query = query.eq('activo', false);
  if (filters.incorporado_desde)
    query = query.gte('created_at', `${filters.incorporado_desde}T00:00:00`);
  if (filters.incorporado_hasta)
    query = query.lte('created_at', `${filters.incorporado_hasta}T23:59:59.999`);
  if (filters.ordenar === 'alfabetico_desc') {
    query = query.order('nombre', { ascending: false }).order('created_at', { ascending: false });
  } else if (filters.ordenar === 'recientes') {
    query = query.order('created_at', { ascending: false }).order('nombre', { ascending: true });
  } else if (filters.ordenar === 'antiguos') {
    query = query.order('created_at', { ascending: true }).order('nombre', { ascending: true });
  } else {
    query = query.order('nombre', { ascending: true }).order('created_at', { ascending: false });
  }
  const { data, error } = await query.limit(100);
  if (error) {
    toast(error.message);
    return [];
  }
  return (data ?? []) as unknown as Row[];
}

async function importProductosExcel(
  source: File | ArrayBuffer,
  options: { createMissingTaxonomy: boolean }
): Promise<{
  upserted: number;
  createdFamilies: number;
  createdTypes: number;
  warnings: string[];
}> {
  const rawRows = await readWorkbookRows(source, 'productos');
  if (!rawRows.length) throw new Error('La hoja principal no contiene filas.');

  const [familias, tipos] = await Promise.all([
    selectRows('familias', '*', 'orden', 500),
    selectRows('tipos', '*', 'orden', 1000),
  ]);
  const familiasMap = new Map<string, Row>();
  const tiposMap = new Map<string, Row>();
  for (const familia of familias) {
    familiasMap.set(text(familia.id), familia);
    familiasMap.set(slugify(text(familia.slug)), familia);
    familiasMap.set(slugify(text(familia.nombre_es)), familia);
  }
  for (const tipo of tipos) {
    tiposMap.set(`${text(tipo.familia_id)}::${slugify(text(tipo.slug))}`, tipo);
    tiposMap.set(`${text(tipo.familia_id)}::${slugify(text(tipo.nombre_es))}`, tipo);
    tiposMap.set(text(tipo.id), tipo);
  }

  const warnings: string[] = [];
  let createdFamilies = 0;
  let createdTypes = 0;
  const upserts: Row[] = [];

  for (const [index, rawRow] of rawRows.entries()) {
    const normalized = normalizeExcelImportRow(rawRow);
    const slug = slugify(
      normalized.slug ||
        normalized.nombre_es ||
        normalized.nombre_en ||
        normalized.sku ||
        `producto-${index + 1}`
    );
    if (!slug) {
      warnings.push(`Fila ${index + 2}: sin slug ni nombre utilizable.`);
      continue;
    }

    const familyResult = await resolveExcelFamilia(
      normalized,
      familiasMap,
      options.createMissingTaxonomy
    );
    if (familyResult.created) createdFamilies += 1;
    const tipoResult = await resolveExcelTipo(
      normalized,
      familyResult.id,
      tiposMap,
      options.createMissingTaxonomy
    );
    if (tipoResult.created) createdTypes += 1;

    upserts.push({
      slug,
      sku: normalized.sku,
      gtin: normalized.gtin,
      familia_id: familyResult.id,
      tipo_id: tipoResult.id,
      nombre_es: normalized.nombre_es || slug,
      nombre_en: normalized.nombre_en,
      descripcion_corta_es: normalized.descripcion_corta_es,
      descripcion_corta_en: normalized.descripcion_corta_en,
      descripcion_larga_es: normalized.descripcion_larga_es,
      descripcion_larga_en: normalized.descripcion_larga_en,
      especificaciones: normalized.especificaciones,
      aplicaciones_es: normalized.aplicaciones_es,
      aplicaciones_en: normalized.aplicaciones_en,
      ficha_pdf: normalized.ficha_pdf,
      atributos: {
        ...(normalized.atributos ?? {}),
        source: 'excel_admin',
        bulk_import_at: new Date().toISOString(),
      },
      peso_kg: normalized.peso_kg,
      dimensiones_cm: normalized.dimensiones_cm,
      tipo_comercial: normalized.tipo_comercial,
      fulfillment_mode: normalized.fulfillment_mode,
      precio: normalized.precio,
      precio_regular: normalized.precio_regular,
      precio_oferta: normalized.precio_oferta,
      dian_codigo: normalized.dian_codigo,
      tarifa_iva_pct: normalized.tarifa_iva_pct,
      retencion_fuente_pct: normalized.retencion_fuente_pct,
      retencion_iva_pct: normalized.retencion_iva_pct,
      retencion_ica_pct: normalized.retencion_ica_pct,
      moneda: normalized.moneda || 'COP',
      stock: normalized.stock,
      gestionar_stock: normalized.gestionar_stock,
      stock_estado: normalized.stock_estado,
      backorder_policy: normalized.backorder_policy,
      disponible: normalized.disponible,
      disponible_actualizado_at: new Date().toISOString(),
      excluido_iva: normalized.excluido_iva,
      destacado: normalized.destacado,
      nuevo: normalized.nuevo,
      activo: normalized.activo,
      orden: normalized.orden,
    });
  }

  if (!upserts.length) {
    throw new Error(
      warnings.length
        ? `No hay productos validos para importar. ${warnings.slice(0, 5).join(' ')}`
        : 'No hay productos validos para importar.'
    );
  }

  const result = await invokeAdminImport('productos', upserts);

  return { upserted: result.processed, createdFamilies, createdTypes, warnings };
}

function normalizeExcelImportRow(row: Row): ProductosExcelImportRow {
  const mapped = new Map<string, unknown>();
  for (const [rawKey, value] of Object.entries(row)) {
    mapped.set(normalizeExcelKey(rawKey), value);
  }
  const get = (key: string) => mapped.get(key);
  const textValue = (key: string) => text(get(key)).trim();
  const boolValue = (key: string, fallback = false) => parseExcelBoolean(get(key), fallback);
  const numValue = (key: string) => parseExcelNumber(get(key));
  return {
    slug: textValue('slug'),
    sku: emptyStringToNull(textValue('sku')),
    gtin: emptyStringToNull(textValue('gtin')),
    nombre_es: textValue('nombre_es'),
    nombre_en: emptyStringToNull(textValue('nombre_en')),
    descripcion_corta_es: emptyStringToNull(textValue('descripcion_corta_es')),
    descripcion_corta_en: emptyStringToNull(textValue('descripcion_corta_en')),
    descripcion_larga_es: emptyStringToNull(textValue('descripcion_larga_es')),
    descripcion_larga_en: emptyStringToNull(textValue('descripcion_larga_en')),
    familia_slug: emptyStringToNull(textValue('familia_slug')),
    familia: emptyStringToNull(textValue('familia')),
    tipo_slug: emptyStringToNull(textValue('tipo_slug')),
    tipo: emptyStringToNull(textValue('tipo')),
    tipo_comercial: textValue('tipo_comercial') === 'consumible' ? 'consumible' : 'equipo',
    fulfillment_mode:
      textValue('fulfillment_mode') === 'dropship' ||
      textValue('fulfillment_mode') === 'individualizado'
        ? (textValue('fulfillment_mode') as 'dropship' | 'individualizado')
        : 'cotizacion',
    precio: numValue('precio'),
    precio_regular: numValue('precio_regular'),
    precio_oferta: numValue('precio_oferta'),
    dian_codigo: emptyStringToNull(textValue('dian_codigo')),
    tarifa_iva_pct: numValue('tarifa_iva_pct'),
    retencion_fuente_pct: numValue('retencion_fuente_pct'),
    retencion_iva_pct: numValue('retencion_iva_pct'),
    retencion_ica_pct: numValue('retencion_ica_pct'),
    moneda: textValue('moneda') || 'COP',
    stock: numValue('stock'),
    gestionar_stock: boolValue('gestionar_stock'),
    stock_estado:
      textValue('stock_estado') === 'outofstock' || textValue('stock_estado') === 'onbackorder'
        ? (textValue('stock_estado') as 'outofstock' | 'onbackorder')
        : 'instock',
    backorder_policy:
      textValue('backorder_policy') === 'notify' || textValue('backorder_policy') === 'yes'
        ? (textValue('backorder_policy') as 'notify' | 'yes')
        : 'no',
    disponible: boolValue('disponible', true),
    excluido_iva: boolValue('excluido_iva', false),
    activo: boolValue('activo', true),
    destacado: boolValue('destacado'),
    nuevo: boolValue('nuevo'),
    ficha_pdf: emptyStringToNull(textValue('ficha_pdf')),
    especificaciones: parseExcelJsonList(get('especificaciones')),
    aplicaciones_es: parseExcelList(get('aplicaciones_es')),
    aplicaciones_en: parseExcelList(get('aplicaciones_en')),
    atributos: parseExcelJsonObject(get('atributos')),
    peso_kg: numValue('peso_kg'),
    dimensiones_cm: parseExcelJsonObject(get('dimensiones_cm')),
    orden: Number.isFinite(Number(textValue('orden'))) ? Number(textValue('orden')) : 0,
  };
}

async function resolveExcelFamilia(
  row: ProductosExcelImportRow,
  familiasMap: Map<string, Row>,
  createMissing: boolean
): Promise<{ id: string | null; created: boolean }> {
  const providedId = normalizeUuid(row.familia_slug ?? row.familia);
  if (providedId && familiasMap.has(providedId)) {
    return { id: text(familiasMap.get(providedId)?.id) || providedId, created: false };
  }
  const raw = (row.familia_slug || row.familia || '').trim();
  if (!raw) return { id: null, created: false };
  const key = slugify(raw);
  const existing = familiasMap.get(key) ?? familiasMap.get(raw);
  if (existing) return { id: text(existing.id), created: false };
  if (!createMissing) return { id: null, created: false };
  const slug = key || slugify(row.nombre_es || 'familia');
  const payload = {
    slug,
    nombre_es: row.familia?.trim() || row.familia_slug?.trim() || slug,
    nombre_en: null,
    descripcion_es: null,
    descripcion_en: null,
    orden: 0,
    activo: true,
  };
  await invokeAdminImport('familias', [payload]);
  const { data, error } = await supabase!
    .from('familias')
    .select('id,slug,nombre_es')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Familia "${slug}" creada, pero no se pudo recuperar su ID.`);
  familiasMap.set(slugify(text(data.slug)), data as Row);
  familiasMap.set(text(data.id), data as Row);
  familiasMap.set(slugify(text(data.nombre_es)), data as Row);
  return { id: text(data.id), created: true };
}

async function resolveExcelTipo(
  row: ProductosExcelImportRow,
  familiaId: string | null,
  tiposMap: Map<string, Row>,
  createMissing: boolean
): Promise<{ id: string | null; created: boolean }> {
  if (!familiaId) return { id: null, created: false };
  const raw = (row.tipo_slug || row.tipo || '').trim();
  if (!raw) return { id: null, created: false };
  const key = `${familiaId}::${slugify(raw)}`;
  const existing = tiposMap.get(key);
  if (existing) return { id: text(existing.id), created: false };
  if (!createMissing) return { id: null, created: false };
  const slug = slugify(raw);
  const payload = {
    familia_id: familiaId,
    slug,
    nombre_es: row.tipo?.trim() || row.tipo_slug?.trim() || slug,
    nombre_en: null,
    orden: 0,
    activo: true,
  };
  await invokeAdminImport('tipos', [payload]);
  const { data, error } = await supabase!
    .from('tipos')
    .select('id,slug,nombre_es')
    .eq('familia_id', familiaId)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Tipo "${slug}" creado, pero no se pudo recuperar su ID.`);
  tiposMap.set(`${familiaId}::${slugify(text(data.slug))}`, data as Row);
  tiposMap.set(`${familiaId}::${slugify(text(data.nombre_es))}`, data as Row);
  tiposMap.set(text(data.id), data as Row);
  return { id: text(data.id), created: true };
}

function parseExcelBoolean(value: unknown, fallback = false): boolean {
  const raw = text(value).trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'y', 'si', 'sí', 'x'].includes(raw);
}

function parseExcelNumber(value: unknown): number | null {
  const raw = text(value).trim().replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseExcelList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => text(item)).filter(Boolean);
  const raw = text(value).trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    const parsed = parseJson(raw, []);
    return Array.isArray(parsed) ? parsed.map(item => text(item)).filter(Boolean) : [];
  }
  return raw
    .split(/\r?\n|[|]/g)
    .flatMap(chunk => chunk.split(/\s*;\s*/g))
    .map(item => item.trim())
    .filter(Boolean);
}

function parseExcelJsonObject(value: unknown): Row {
  const raw = text(value).trim();
  if (!raw) return {};
  const parsed = parseJson(raw, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Row) : {};
}

function parseExcelJsonList(value: unknown): Row[] {
  const raw = text(value).trim();
  if (!raw) return [];
  const parsed = parseJson(raw, []);
  return Array.isArray(parsed) ? (parsed as Row[]) : [];
}

function emptyStringToNull(value: string): string | null {
  const clean = value.trim();
  return clean ? clean : null;
}

function normalizeExcelKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeUuid(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw : null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: Row[]) {
  const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const csv = [
    keys.join(','),
    ...rows.map(row => keys.map(key => csvCell(row[key])).join(',')),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const raw = typeof value === 'object' && value !== null ? JSON.stringify(value) : text(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

function toast(message: string) {
  const node = document.createElement('div');
  node.className = 'admin-toast';
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), 4200);
}
