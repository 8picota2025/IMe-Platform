import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { renderMarkdown } from '../lib/markdown';
import * as XLSX from 'xlsx';

const OLLAMA_URL = (import.meta.env['PUBLIC_OLLAMA_URL'] as string | undefined) ?? '';
const OLLAMA_INGEST_MODEL = 'qwen3:1.7b';
const OLLAMA_EMBED_MODEL = 'mxbai-embed-large';

type View =
  | 'dashboard'
  | 'productos'
  | 'producto'
  | 'taxonomia'
  | 'cotizaciones'
  | 'cotizacion'
  | 'clientes'
  | 'cliente'
  | 'pedidos'
  | 'pedido'
  | 'cupones'
  | 'cupon'
  | 'reportes'
  | 'proveedores'
  | 'proveedor-productos'
  | 'fulfillments'
  | 'conocimiento'
  | 'ingesta'
  | 'asesor';

type Row = Record<string, unknown>;
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
  publicado: boolean;
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
const INGEST_PDF_MAX_BYTES = 25 * 1024 * 1024;
const INGEST_PDF_MAX_CHARS = 60_000;

const appElement = document.getElementById('admin-app');
const supabase = getSupabaseClient();

if (!appElement) throw new Error('admin-app root missing');
const app = appElement;

const state = {
  view: parseView(location.hash),
  recordId: new URLSearchParams(location.hash.split('?')[1] ?? '').get('id'),
  email: '',
};

window.addEventListener('hashchange', () => {
  state.view = parseView(location.hash);
  state.recordId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('id');
  void render();
});

// Flag: prevents render() from overwriting renderNewPassword() after getSession() resolves
let recoveryHandled = false;

supabase?.auth.onAuthStateChange(event => {
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
    raw === 'producto' ||
    raw === 'taxonomia' ||
    raw === 'cotizaciones' ||
    raw === 'cotizacion' ||
    raw === 'clientes' ||
    raw === 'cliente' ||
    raw === 'pedidos' ||
    raw === 'pedido' ||
    raw === 'cupones' ||
    raw === 'cupon' ||
    raw === 'reportes' ||
    raw === 'proveedores' ||
    raw === 'proveedor-productos' ||
    raw === 'fulfillments' ||
    raw === 'conocimiento' ||
    raw === 'ingesta' ||
    raw === 'asesor'
  ) {
    return raw;
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
  if (state.view === 'productos') return { title: 'Productos', body: await productosView() };
  if (state.view === 'producto') return { title: 'Producto', body: await productoFormView() };
  if (state.view === 'taxonomia') return { title: 'Taxonomia', body: await taxonomiaView() };
  if (state.view === 'cotizaciones')
    return { title: 'Cotizaciones', body: await cotizacionesView() };
  if (state.view === 'cotizacion')
    return { title: 'Cotizacion', body: await cotizacionDetailView() };
  if (state.view === 'clientes') return { title: 'Clientes', body: await clientesView() };
  if (state.view === 'cliente') return { title: 'Cliente', body: await clienteDetailView() };
  if (state.view === 'pedidos') return { title: 'Pedidos', body: await pedidosView() };
  if (state.view === 'pedido') return { title: 'Pedido', body: await pedidoDetailView() };
  if (state.view === 'cupones') return { title: 'Cupones', body: await cuponesView() };
  if (state.view === 'cupon') return { title: 'Cupon', body: await cuponFormView() };
  if (state.view === 'reportes') return { title: 'Reportes', body: await reportesView() };
  if (state.view === 'proveedores') return { title: 'Proveedores', body: await proveedoresView() };
  if (state.view === 'proveedor-productos')
    return { title: 'Productos del proveedor', body: await proveedorProductosView() };
  if (state.view === 'fulfillments')
    return { title: 'Fulfillments', body: await fulfillmentsView() };
  if (state.view === 'conocimiento')
    return { title: 'Conocimiento', body: await conocimientoView() };
  if (state.view === 'ingesta') return { title: 'Ingesta PDF', body: await ingestaView() };
  if (state.view === 'asesor') return { title: 'Asesor', body: await asesorView() };
  return { title: 'Dashboard', body: await dashboardView() };
}

function shellHtml(title: string, body: string): string {
  const links: Array<[View, string]> = [
    ['dashboard', 'Dashboard'],
    ['productos', 'Productos'],
    ['taxonomia', 'Taxonomia'],
    ['ingesta', 'Ingesta PDF'],
    ['clientes', 'Clientes'],
    ['cotizaciones', 'Cotizaciones'],
    ['pedidos', 'Pedidos'],
    ['cupones', 'Cupones'],
    ['proveedores', 'Proveedores'],
    ['fulfillments', 'Fulfillments'],
    ['reportes', 'Reportes'],
    ['conocimiento', 'Conocimiento'],
    ['asesor', 'Asesor'],
  ];
  return `
    <section class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand"><strong>I-ME</strong><span>Biomedical commerce admin</span></div>
        <nav class="admin-nav" aria-label="Admin">
          ${links
            .map(
              ([view, label]) =>
                `<a href="#/${view}" ${state.view === view ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`
            )
            .join('')}
        </nav>
        <button class="admin-button admin-button--sidebar" data-logout type="button">Salir</button>
      </aside>
      <section class="admin-main">
        <header class="admin-topbar">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <p class="admin-meta">${escapeHtml(state.email || 'Sesion privada')}</p>
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
  bindClientes();
  bindCupones();
  bindPedidoOperaciones();
  bindPedidoMasivo();
  bindIngest();
  bindArticulos();
  bindProviderFilters();
  bindProveedorProductos();
  bindFulfillments();
  bindAsesorPanel();
}

async function dashboardView(): Promise<string> {
  const [
    productos,
    productosActivos,
    productosBorrador,
    productosDropship,
    productosDisponibles,
    cotizaciones,
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
    count('pedidos', { leida: false }),
    count('clientes'),
    count('cupones', { activo: true }),
    count('fulfillments', { estado: 'error' }),
    selectRows('productos', 'id,tipo_id', 'nombre_es', 500),
  ]);
  const withoutProvider = await productosDropshipSinProveedor();
  const productosSinTipo = productosRows.filter(row => !text(row.tipo_id)).length;
  const productosNoDisponibles = Math.max(0, productos - productosDisponibles);
  return `
    ${withoutProvider > 0 ? `<div class="admin-alert">${withoutProvider} productos dropship no tienen proveedor asignado.</div>` : ''}
    <section class="admin-grid">
      ${metric('Total productos', productos)}
      ${metric('Productos activos', productosActivos)}
      ${metric('Borradores', productosBorrador)}
      ${metric('Clientes', clientes)}
      ${metric('Cotizaciones sin leer', cotizaciones)}
      ${metric('Pedidos sin leer', pedidos)}
      ${metric('Cupones activos', cupones)}
      ${metric('Dropship', productosDropship)}
      ${metric('Disponibles', productosDisponibles)}
      ${metric('No disponibles', productosNoDisponibles)}
      ${metric('Sin tipo', productosSinTipo)}
      ${metric('Dropship sin proveedor', withoutProvider)}
      ${metric('Fulfillments con error', fulfillmentsError)}
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
          <p>${productosActivos} publicados y ${productosBorrador} borradores en revisión.</p>
        </div>
        <div class="admin-health__item">
          <strong>Fulfillment</strong>
          <p>${productosDropship} productos con modalidad dropship, ${withoutProvider} sin proveedor asignado.</p>
        </div>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Accesos</h2></div>
      <div class="admin-grid" style="padding:16px">
        <a class="admin-button" href="#/producto">Crear producto</a>
        <a class="admin-button" href="#/ingesta">Ingesta PDF</a>
        <a class="admin-button admin-button--ghost" href="#/taxonomia">Taxonomia</a>
        <a class="admin-button admin-button--ghost" href="#/clientes">Clientes</a>
        <a class="admin-button admin-button--ghost" href="#/cupones">Cupones</a>
        <a class="admin-button admin-button--ghost" href="#/cotizaciones">Cotizaciones</a>
        <a class="admin-button admin-button--ghost" href="#/reportes">Reportes</a>
      </div>
    </section>`;
}

function metric(label: string, value: number): string {
  return `<article class="admin-card"><strong>${escapeHtml(label)}</strong><span>${value}</span></article>`;
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
  | 'list';

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
  { key: 'imagen_principal', label: 'Foto', type: 'image' },
  { key: 'galeria', label: 'Galería', type: 'gallery' },
  { key: 'nombre_es', label: 'Nombre ES', type: 'text', sortable: true },
  { key: 'nombre_en', label: 'Nombre EN', type: 'text', sortable: true },
  { key: 'slug', label: 'Slug', type: 'text', sortable: true },
  { key: 'sku', label: 'SKU', type: 'text', sortable: true },
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
        [
          ...PRODUCT_LIST_COLUMNS.map(column =>
            column.sortable
              ? `<a class="admin-sort-link" href="${productSortLink(column.key, sort, dir)}">${escapeHtml(column.label)}${productSortIndicator(column.key, sort, dir)}</a>`
              : escapeHtml(column.label)
          ),
          'Acciones',
        ],
        rows.map(row => [
          ...PRODUCT_LIST_COLUMNS.map(column =>
            productListCell(row, column, familias, tiposParaSelect)
          ),
          `<div class="admin-row-actions">
            <button class="admin-button" data-product-row-save="${escapeHtml(text(row.id))}" type="button">Guardar</button>
            <button class="admin-button admin-button--ghost" data-product-row-upload="${escapeHtml(text(row.id))}" type="button">Subir foto</button>
            <button class="admin-button admin-button--ghost" data-product-row-gallery-upload="${escapeHtml(text(row.id))}" type="button">Subir galería</button>
            <a class="admin-button admin-button--ghost" href="#/producto?id=${encodeURIComponent(text(row.id))}">Detalle</a>
          </div>`,
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
          ${textarea('especificaciones', 'Especificaciones JSON', JSON.stringify(draft.especificaciones, null, 2))}
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
  const conteoPorTipo = new Map<string, number>();
  const productosSinTipo: Row[] = [];
  for (const producto of productos) {
    const tipoId = text(producto.tipo_id);
    if (!tipoId) {
      productosSinTipo.push(producto);
      continue;
    }
    conteoPorTipo.set(tipoId, (conteoPorTipo.get(tipoId) ?? 0) + 1);
  }
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
          ['Slug', 'Nombre', 'Estado'],
          familias.map(r => [text(r.slug), text(r.nombre_es), status(r.activo)])
        )}
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
          ['Slug', 'Nombre', 'Productos', 'Estado'],
          tipos.map(r => [
            text(r.slug),
            text(r.nombre_es),
            String(conteoPorTipo.get(text(r.id)) ?? 0),
            status(r.activo),
          ])
        )}
      </form>
    </section>
    <section class="admin-panel admin-taxonomy-unassigned">
      <div class="admin-panel__head"><h2>Productos sin tipo asignado (${productosSinTipo.length})</h2></div>
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
    </section>`;
}

const COTIZACION_ESTADOS: Array<[string, string]> = [
  ['nueva', 'Nueva'],
  ['en_revision', 'En revision'],
  ['respondida', 'Respondida'],
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
  return listWithCsv(
    'solicitudes_cotizacion',
    rows,
    ['created_at', 'nombre', 'empresa', 'email', 'telefono', 'estado', 'leida'],
    'cotizacion'
  );
}

async function cotizacionDetailView(): Promise<string> {
  const row = state.recordId ? await getRow('solicitudes_cotizacion', state.recordId) : null;
  if (!row) return notFoundPanel('Cotizacion no encontrada', '#/cotizaciones');
  const productos = Array.isArray(row.productos) ? row.productos : [];
  const notasInternas = parseNotasInternas(text(row.notas_internas));
  const resumen = cotizacionResumenTexto(row);
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <div>
          <h2>Cotizacion de ${escapeHtml(text(row.nombre))}</h2>
          <p class="admin-meta">${escapeHtml(text(row.empresa) || 'Sin empresa')} · ${escapeHtml(
            text(row.email)
          )} · ${escapeHtml(cotizacionEstadoLabel(text(row.estado) || 'nueva'))}</p>
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
          <span class="admin-badge admin-badge--info">${escapeHtml(text(row.empresa) || 'Sin empresa')}</span>
          <span class="admin-badge">${escapeHtml(text(row.created_at))}</span>
          <span class="admin-badge ${row.leida ? 'admin-badge--ok' : 'admin-badge--warn'}">${row.leida ? 'Leida' : 'Sin leer'}</span>
        </div>
        <div class="admin-toolbar cotizacion-workflow__actions">
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-quick-estado="nueva">Volver a nueva</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-quick-estado="en_revision">Enviar a revision</button>
          <button class="admin-button admin-button--ghost" type="button" data-cotizacion-quick-estado="respondida">Marcar respondida</button>
        </div>
      </div>
      <div style="padding:16px">
        ${table(
          ['Campo', 'Valor'],
          [
            ['Empresa', escapeHtml(text(row.empresa)) || '—'],
            ['Email', escapeHtml(text(row.email))],
            ['Telefono', escapeHtml(text(row.telefono))],
            ['Fecha', formatCell(row.created_at)],
          ]
        )}
      </div>
      <div style="padding:0 16px 16px">
        <h3>Productos solicitados</h3>
        ${jsonRowsTable(productos)}
      </div>
      <div style="padding:0 16px 16px">
        <h3>Mensaje</h3>
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
            ${selectStatic('estado', 'Estado', text(row.estado) || 'nueva', COTIZACION_ESTADOS)}
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
          ${field('documento_tipo', 'Tipo documento', text(cliente?.documento_tipo))}
          ${field('documento_numero', 'Numero documento', text(cliente?.documento_numero))}
        </div>
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
  ['pagado', 'Pagado'],
  ['procesando', 'Procesando'],
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
  const [eventosResult, fulfillmentsResult, notasResult, timelineResult, facturaResult] =
    await Promise.all([
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
      supabase!
        .from('facturas_electronicas')
        .select('*')
        .eq('pedido_id', text(row.id))
        .maybeSingle(),
    ]);
  const eventos = (eventosResult.data ?? []) as Row[];
  const fulfillments = (fulfillmentsResult.data ?? []) as Row[];
  const notas = (notasResult.data ?? []) as Row[];
  const timeline = (timelineResult.data ?? []) as Row[];
  const factura = (facturaResult.data ?? null) as Row | null;
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
            <button class="admin-button admin-button--ghost" type="button" data-pedido-quick-estado="procesando">Procesar</button>
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
            ['Mercado', escapeHtml(text(row.mercado))],
            ['Pasarela', escapeHtml(text(row.proveedor_pago))],
            ['Referencia', escapeHtml(text(row.referencia_pasarela)) || '—'],
            ['Checkout URL', escapeHtml(text(row.checkout_url)) || '—'],
          ]
        )}
      </div>
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
          ${selectStatic('tipo_descuento', 'Tipo descuento', text(row?.tipo_descuento) || 'porcentaje', CUPON_TIPOS)}
          ${field('valor', 'Valor', text(row?.valor), true, 'number')}
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
  const [pedidos, cotizaciones, productos, fulfillments, cupones] = await Promise.all([
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
  ]);
  const ventas = pedidos
    .filter(p => ['pagado', 'procesando', 'enviado', 'entregado'].includes(text(p.estado)))
    .reduce((acc, p) => acc + Number(p.total ?? 0), 0);
  const pedidosPorEstado = groupCount(pedidos, 'estado');
  const cotizacionesPorEstado = groupCount(cotizaciones, 'estado');
  const productosCriticos = productos.filter(
    p => p.disponible === false || text(p.stock_estado) !== 'instock'
  );
  return `
    <section class="admin-grid">
      ${metric('Ventas reconocidas COP', Math.round(ventas))}
      ${metric('Pedidos', pedidos.length)}
      ${metric('Cotizaciones', cotizaciones.length)}
      ${metric('Productos criticos', productosCriticos.length)}
      ${metric('Fulfillments error', fulfillments.filter(f => text(f.estado) === 'error').length)}
      ${metric('Cupones activos', cupones.filter(c => c.activo === true).length)}
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
      <div class="admin-panel__head"><h2>Fulfillments</h2></div>
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
    <section class="admin-grid">
      <section class="admin-panel">
        <div class="admin-panel__head">
          <h2>Articulos</h2>
          <a class="admin-button admin-button--ghost" href="#/conocimiento">Nuevo articulo</a>
        </div>
        <div class="admin-help" style="padding:0 16px 12px">
          CMS basico de articulos editorial: crea, edita y publica contenido para la seccion de Conocimiento.
        </div>
        ${
          articulos.length
            ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Estado</th><th>Slug</th><th>Titulo ES</th><th>Titulo EN</th><th>Actualizado</th><th>Acciones</th></tr></thead><tbody>${articulos
                .map(row => {
                  const published = Boolean(row.publicado);
                  return `<tr>
                    <td>${published ? '<span class="admin-badge admin-badge--ok">Publicado</span>' : '<span class="admin-badge admin-badge--warn">Borrador</span>'}</td>
                    <td>${escapeHtml(text(row.slug))}</td>
                    <td>${escapeHtml(text(row.titulo_es))}</td>
                    <td>${escapeHtml(text(row.titulo_en) || '—')}</td>
                    <td>${escapeHtml(text(row.updated_at) || text(row.created_at))}</td>
                    <td>
                      <a class="admin-button admin-button--ghost" href="#/conocimiento?id=${encodeURIComponent(text(row.id))}">Editar</a>
                      <a class="admin-button admin-button--ghost" href="/es/conocimiento/${encodeURIComponent(text(row.slug))}" target="_blank" rel="noreferrer noopener">Ver</a>
                    </td>
                  </tr>`;
                })
                .join('')}</tbody></table></div>`
            : '<div style="padding:16px"><div class="admin-alert">Aún no hay artículos. Crea el primero con el formulario de la derecha.</div></div>'
        }
      </section>
      <section class="admin-panel">
        <div class="admin-panel__head">
          <h2>${draft.id ? 'Editar articulo' : 'Nuevo articulo'}</h2>
          ${draft.id ? `<a class="admin-button admin-button--ghost" href="#/conocimiento">Limpiar</a>` : ''}
        </div>
        <form class="admin-form" data-article-form style="padding:16px">
          <input type="hidden" name="id" value="${escapeHtml(draft.id ?? '')}" />
          ${field('slug', 'Slug', draft.slug, true)}
          ${field('titulo_es', 'Titulo ES', draft.titulo_es, true)}
          ${field('titulo_en', 'Titulo EN', draft.titulo_en)}
          <div class="admin-markdown-grid">
            <div>
              ${textarea('cuerpo_es', 'Cuerpo ES', draft.cuerpo_es)}
              <div class="admin-help" style="margin-top:8px">Vista previa ES</div>
              <div class="admin-markdown-preview" data-article-preview-es>${renderMarkdown(draft.cuerpo_es || '')}</div>
            </div>
            <div>
              ${textarea('cuerpo_en', 'Cuerpo EN', draft.cuerpo_en)}
              <div class="admin-help" style="margin-top:8px">Vista previa EN</div>
              <div class="admin-markdown-preview" data-article-preview-en>${renderMarkdown(draft.cuerpo_en || '')}</div>
            </div>
          </div>
          ${checkbox('publicado', 'Publicado', draft.publicado)}
          <div class="admin-toolbar">
            <button class="admin-button" type="submit">Guardar articulo</button>
            ${draft.id ? '<button class="admin-button admin-button--danger" data-article-delete type="button">Eliminar articulo</button>' : ''}
          </div>
          <div class="admin-alert">El contenido del CMS vive en "articulos". Las páginas publicas solo muestran registros publicados.</div>
        </form>
      </section>
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
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = productPayload(form);
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

  form.addEventListener('input', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== 'titulo_es') return;
    const slug = form.elements.namedItem('slug');
    if (slug instanceof HTMLInputElement && !slug.value) slug.value = slugify(target.value);
  });

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
    const slug = String(data.get('slug') ?? '').trim();
    const payload: Row = {
      slug,
      titulo_es: String(data.get('titulo_es') ?? '').trim(),
      titulo_en: emptyToNull(data.get('titulo_en')),
      cuerpo_es: emptyToNull(data.get('cuerpo_es')),
      cuerpo_en: emptyToNull(data.get('cuerpo_en')),
      publicado:
        form.elements.namedItem('publicado') instanceof HTMLInputElement &&
        (form.elements.namedItem('publicado') as HTMLInputElement).checked,
    };

    if (!payload.slug || !payload.titulo_es) {
      toast('Completa slug y titulo ES');
      return;
    }

    if (id) {
      const { error } = await supabase!.from('articulos').update(payload).eq('id', id);
      if (error) {
        toast(error.message);
        return;
      }
      toast('Articulo guardado');
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
    toast('Articulo guardado');
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
  return true;
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

function bindCotizaciones() {
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
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = String(data.get('id') ?? '');
    const payload: Row = {
      codigo: String(data.get('codigo') ?? '')
        .trim()
        .toUpperCase(),
      tipo_descuento: String(data.get('tipo_descuento') ?? 'porcentaje'),
      valor: numberOrZero(data.get('valor')),
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
        ${checkbox('activo', 'Publicar en catalogo al crear', false)}
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
  container.addEventListener('click', event => {
    const target = event.target;
    const removeButton =
      target instanceof HTMLElement ? target.closest<HTMLElement>('[data-remove-row]') : null;
    removeButton?.closest('[data-spec-row], [data-aplicacion-row]')?.remove();
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
  const family = inferFamily(`${title} ${description}`);
  const englishName = looksLikeEnglishProductName(title) ? title : '';
  return {
    producto_es: {
      nombre: revisable(title, 'pdf', 0.55, true),
      familia_sugerida: revisable(family, family ? 'pdf' : 'ausente', family ? 0.5 : 0, true),
      tipo_sugerido: revisable('', 'ausente', 0, true),
      descripcion_corta: revisable(
        description.slice(0, 240),
        description ? 'pdf' : 'ausente',
        0.45,
        true
      ),
      descripcion_larga: revisable(description, description ? 'pdf' : 'ausente', 0.45, true),
      especificaciones: specs,
      aplicaciones: [],
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
  origen: 'pdf' | 'ausente' | 'manual',
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
      'Extrae un borrador JSON bilingue para catalogo medico B2B. Devuelve solo JSON valido, sin texto adicional. No inventes datos. Campo no presente: valor vacio, origen="ausente", requiere_revision=true. Genera producto_es desde el PDF y producto_en_borrador como traduccion al ingles. La traduccion EN es borrador y todos sus campos requieren_revision=true. /no_think';
    const userPrompt = `Fuente PDF: ${pdfUrl || 'texto pegado por admin'}

Texto disponible:
${pdfText.slice(0, 12000)}

Estructura requerida:
{
  "producto_es": {
    "nombre": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "familia_sugerida": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "tipo_sugerido": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_corta": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_larga": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "especificaciones": [{"clave": "", "valor": "", "grupo": "", "origen": "pdf", "confianza": 0, "requiere_revision": true}],
    "aplicaciones": [{"valor": "", "origen": "pdf", "confianza": 0, "requiere_revision": true}],
    "meta_seo": {"title": "", "description": ""}
  },
  "producto_en_borrador": {
    "nombre": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_corta": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_larga": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "aplicaciones": [{"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true}],
    "meta_seo": {"title": "", "description": ""}
  },
  "campos_confianza": [],
  "ausentes": [],
  "advertencias": [],
  "raw_model_id": ""
}`;

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

function inferFamily(textValue: string): string {
  const value = normalizeMatchText(textValue);
  const matches: Array<[string, string[]]> = [
    [
      'Radiología y Diagnóstico por Imagen',
      ['radiologia', 'rayos x', 'rx', 'mamogra', 'arco c', 'radiograf'],
    ],
    ['Anestesia y Ventilación', ['anestesia', 'ventilador', 'respirador']],
    ['Ultrasonido', ['ecogra', 'ultrasonido', 'doppler']],
    ['Monitores', ['monitor multiparam', 'monitor de signos', 'uci']],
    ['Cardiología', ['ecg', 'electrocardio', 'desfibrilador', 'holter', 'cardio']],
    ['Neonatología', ['neonatal', 'incubadora', 'cpap', 'cuna radiante']],
    ['Soluciones IV', ['infusion', 'jeringa', 'bomba']],
    ['Mobiliario Hospitalario', ['camilla', 'cama', 'carro de paro', 'mobiliario']],
    ['Sala de Cirugía', ['quirurg', 'cialitica', 'mesa']],
  ];
  return (
    matches.find(([, keywords]) => keywords.some(keyword => value.includes(keyword)))?.[0] ?? ''
  );
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

async function uniqueArticuloSlug(baseSlug: string): Promise<string> {
  const base = baseSlug || 'articulo';
  let candidate = base;
  for (let i = 2; i <= 100; i += 1) {
    const { data, error } = await supabase!
      .from('articulos')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) return `${base}-${Date.now()}`;
    if (!data) return candidate;
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

async function triggerRebuild() {
  const { data, error } = await supabase!.functions.invoke('trigger-rebuild', {
    body: { reason: 'admin_publish_batch' },
  });
  const json = data as { ok?: boolean; error?: { message?: string } } | null;
  toast(
    json?.ok
      ? 'Rebuild solicitado'
      : (error?.message ?? json?.error?.message ?? 'No se pudo solicitar rebuild')
  );
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
  return {
    id: text(row?.id) || undefined,
    slug: text(row?.slug),
    titulo_es: text(row?.titulo_es),
    titulo_en: text(row?.titulo_en),
    cuerpo_es: text(row?.cuerpo_es),
    cuerpo_en: text(row?.cuerpo_en),
    publicado: row ? Boolean(row.publicado) : false,
  };
}

function productPayload(form: HTMLFormElement): Row {
  const data = new FormData(form);
  const specsParsed = parseJson(data.get('especificaciones'), []);
  const specs = Array.isArray(specsParsed) ? specsParsed : [];
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
    const path = `${Date.now()}-${slugify(file.name)}`;
    const { error } = await supabase!.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) {
      toast(error.message);
      return;
    }
    const publicUrl = supabase!.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const target = form.elements.namedItem(targetName);
    if (target instanceof HTMLInputElement) target.value = publicUrl;
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

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
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

function listWithCsv(tableName: string, rows: Row[], keys: string[], detailRoute?: string): string {
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
  const name = column.key;
  const baseAttrs = `data-product-id="${escapeHtml(productId)}" data-product-field="${escapeHtml(name)}"`;
  const value = row[name];
  if (column.type === 'image') {
    const imageUrl = text(value);
    return `
      <div class="admin-product-image-cell">
        ${
          imageUrl
            ? `<img class="admin-thumb" src="${escapeHtml(imageUrl)}" alt="" width="48" height="48" loading="lazy" />`
            : '<span class="admin-image-empty">Sin foto</span>'
        }
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

function field(name: string, label: string, value = '', required = false, type = 'text'): string {
  return `<label class="admin-field">${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''} /></label>`;
}

function textarea(name: string, label: string, value = ''): string {
  return `<label class="admin-field">${escapeHtml(label)}<textarea name="${escapeHtml(name)}">${escapeHtml(value)}</textarea></label>`;
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
    proveedor_pago: ['bold', 'stripe', 'wompi'].includes(proveedorPago) ? proveedorPago : 'wompi',
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
