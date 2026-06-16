import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { renderMarkdown } from '../lib/markdown';
import * as XLSX from 'xlsx';

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

void render();

function hashParams(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
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
  if (!session) {
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
  app.innerHTML = `
    <section class="admin-login">
      <form class="admin-login__panel admin-form" data-login>
        <div>
          <h1>I-ME Admin</h1>
          <p>Back-office privado para catalogo, cotizaciones, pedidos e ingesta documental.</p>
        </div>
        <label class="admin-field">Email
          <input name="email" type="email" autocomplete="email" required />
        </label>
        <label class="admin-field">Contrasena
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="admin-button" type="submit">Entrar</button>
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
    location.hash = '#/dashboard';
    await render();
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
  bindTaxonomy();
  bindReasignacion();
  bindSimpleTables();
  bindClientes();
  bindCupones();
  bindPedidoOperaciones();
  bindIngest();
  bindArticulos();
  bindProveedorProductos();
  bindFulfillments();
  bindAsesorPanel();
}

async function dashboardView(): Promise<string> {
  const [productos, cotizaciones, pedidos, dropship, clientes, cupones, fulfillmentsError] =
    await Promise.all([
      count('productos'),
      count('solicitudes_cotizacion', { leida: false }),
      count('pedidos', { leida: false }),
      count('productos', { fulfillment_mode: 'dropship' }),
      count('clientes'),
      count('cupones', { activo: true }),
      count('fulfillments', { estado: 'error' }),
    ]);
  const withoutProvider = await productosDropshipSinProveedor();
  return `
    ${withoutProvider > 0 ? `<div class="admin-alert">${withoutProvider} productos dropship no tienen proveedor asignado.</div>` : ''}
    <section class="admin-grid">
      ${metric('Total productos', productos)}
      ${metric('Clientes', clientes)}
      ${metric('Cotizaciones sin leer', cotizaciones)}
      ${metric('Pedidos sin leer', pedidos)}
      ${metric('Cupones activos', cupones)}
      ${metric('Dropship', dropship)}
      ${metric('Dropship sin proveedor', withoutProvider)}
      ${metric('Fulfillments con error', fulfillmentsError)}
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

function productosLink(overrides: Record<string, string>): string {
  const params = hashParams();
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  return `#/productos${qs ? `?${qs}` : ''}`;
}

async function productosView(): Promise<string> {
  const params = hashParams();
  const q = (params.get('q') ?? '').trim();
  const familiaId = params.get('familia_id') ?? '';
  const tipoId = params.get('tipo_id') ?? '';
  const activo = params.get('activo') ?? '';
  const tipoComercial = params.get('tipo_comercial') ?? '';
  const page = Math.max(1, numberOrZero(params.get('page')) || 1);

  const [familias, tipos] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
  ]);
  const familiasPorId = new Map(familias.map(f => [text(f.id), text(f.nombre_es)]));
  const tiposPorId = new Map(tipos.map(t => [text(t.id), text(t.nombre_es)]));
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

  const from = (page - 1) * PRODUCTOS_PAGE_SIZE;
  const { data, count, error } = await query
    .order('orden', { ascending: true })
    .range(from, from + PRODUCTOS_PAGE_SIZE - 1);
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
        ['Imagen', 'Nombre', 'Slug', 'Familia', 'Tipo', 'Fulfillment', 'Estado', 'PDF', 'Acciones'],
        rows.map(row => [
          text(row.imagen_principal)
            ? `<img class="admin-thumb" src="${escapeHtml(text(row.imagen_principal))}" alt="" width="48" height="48" loading="lazy" />`
            : '',
          text(row.nombre_es),
          text(row.slug),
          familiasPorId.get(text(row.familia_id)) ?? '—',
          tiposPorId.get(text(row.tipo_id)) ?? '—',
          text(row.fulfillment_mode),
          row.activo
            ? '<span class="admin-badge admin-badge--ok">Activo</span>'
            : '<span class="admin-badge admin-badge--warn">Borrador</span>',
          text(row.ficha_pdf)
            ? `<a class="admin-button admin-button--ghost" href="${escapeHtml(text(row.ficha_pdf))}" target="_blank" rel="noopener noreferrer">Ver PDF</a>`
            : '—',
          `<a class="admin-button admin-button--ghost" href="#/producto?id=${encodeURIComponent(text(row.id))}">Editar</a>`,
        ])
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
          <div class="admin-help">Desmarcar "Disponible" saca el producto del carrito y de crear-pago en tiempo real (sin rebuild), aunque siga "Activo" para SEO/landing. Usalo para roturas de stock del proveedor.</div>
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
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Cotizacion de ${escapeHtml(text(row.nombre))}</h2>
        <div class="admin-toolbar">
          ${
            row.leida === false
              ? `<button class="admin-button admin-button--ghost" data-table="solicitudes_cotizacion" data-mark-read="${escapeHtml(text(row.id))}" type="button">Marcar leida</button>`
              : '<span class="admin-badge admin-badge--ok">Leida</span>'
          }
          <a class="admin-button admin-button--ghost" href="#/cotizaciones">Volver</a>
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
        <h3>Consentimiento de datos</h3>
        <p class="admin-help">${
          row.consentimiento_datos
            ? `Aceptado el ${formatCell(row.consentimiento_timestamp)}`
            : 'No aceptado / no registrado'
        }</p>
      </div>
      <form class="admin-form" data-cotizacion-estado-form style="padding:0 16px 16px">
        <input type="hidden" name="id" value="${escapeHtml(text(row.id))}" />
        <div class="admin-editor__cols">
          ${selectStatic('estado', 'Estado', text(row.estado) || 'nueva', COTIZACION_ESTADOS)}
        </div>
        ${textarea('notas_internas', 'Notas internas', text(row.notas_internas))}
        <button class="admin-button" type="submit">Guardar seguimiento</button>
      </form>
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
        <button class="admin-button" data-new-cliente type="button">Nuevo cliente</button>
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

async function pedidosView(): Promise<string> {
  const rows = await selectRows('pedidos', '*', 'created_at', 100, false);
  return listWithCsv(
    'pedidos',
    rows,
    [
      'created_at',
      'cliente',
      'total',
      'moneda',
      'mercado',
      'estado',
      'referencia_pasarela',
      'leida',
    ],
    'pedido'
  );
}

async function pedidoDetailView(): Promise<string> {
  const row = state.recordId ? await getRow('pedidos', state.recordId) : null;
  if (!row) return notFoundPanel('Pedido no encontrado', '#/pedidos');
  const cliente = row.cliente && typeof row.cliente === 'object' ? (row.cliente as Row) : {};
  const items = Array.isArray(row.items) ? row.items : [];

  const referencia = text(row.referencia_pasarela);
  const [eventosResult, fulfillmentsResult, notasResult, timelineResult] = await Promise.all([
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
  ]);
  const eventos = (eventosResult.data ?? []) as Row[];
  const fulfillments = (fulfillmentsResult.data ?? []) as Row[];
  const notas = (notasResult.data ?? []) as Row[];
  const timeline = (timelineResult.data ?? []) as Row[];

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Pedido ${escapeHtml(text(row.referencia_pasarela)) || escapeHtml(text(row.id)).slice(0, 8)}</h2>
        <div class="admin-toolbar">
          ${
            row.leida === false
              ? `<button class="admin-button admin-button--ghost" data-table="pedidos" data-mark-read="${escapeHtml(text(row.id))}" type="button">Marcar leida</button>`
              : '<span class="admin-badge admin-badge--ok">Leida</span>'
          }
          <a class="admin-button admin-button--ghost" href="#/pedidos">Volver</a>
        </div>
      </div>
      <div style="padding:16px">
        ${table(
          ['Campo', 'Valor'],
          [
            ['Fecha', formatCell(row.created_at)],
            ['Subtotal', escapeHtml(text(row.subtotal))],
            ['Descuento', escapeHtml(text(row.descuento_total))],
            ['Impuestos', escapeHtml(text(row.impuesto_total))],
            ['Envio', escapeHtml(text(row.envio_total))],
            ['Total', `${escapeHtml(text(row.total))} ${escapeHtml(text(row.moneda))}`],
            ['Cupon', escapeHtml(text(row.cupon_codigo)) || '—'],
            ['Mercado', escapeHtml(text(row.mercado))],
            ['Pasarela', escapeHtml(text(row.proveedor_pago))],
            ['Referencia', escapeHtml(text(row.referencia_pasarela)) || '—'],
            ['Checkout URL', escapeHtml(text(row.checkout_url)) || '—'],
          ]
        )}
      </div>
      <div style="padding:0 16px 16px">
        <h3>Cliente</h3>
        ${jsonObjectTable(cliente)}
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
        <h3>Timeline interno</h3>
        ${
          timeline.length === 0
            ? '<p class="admin-help">Sin eventos internos aun.</p>'
            : table(
                ['Fecha', 'Tipo', 'De', 'A', 'Actor'],
                timeline.map(e => [
                  formatCell(e.created_at),
                  escapeHtml(text(e.tipo)),
                  escapeHtml(text(e.de_estado)) || '—',
                  escapeHtml(text(e.a_estado)) || '—',
                  escapeHtml(text(e.actor_email)) || '—',
                ])
              )
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
        <form class="admin-form" data-pedido-nota-form style="margin-top:12px">
          <input type="hidden" name="pedido_id" value="${escapeHtml(text(row.id))}" />
          ${selectStatic('tipo', 'Tipo de nota', 'interna', [
            ['interna', 'Interna'],
            ['cliente', 'Visible para cliente (futuro portal)'],
            ['sistema', 'Sistema'],
          ])}
          ${textarea('nota', 'Nueva nota')}
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
  const [rows, asignaciones] = await Promise.all([
    selectRows('proveedores', '*', 'nombre', 100),
    selectRows('proveedor_producto', 'proveedor_id', 'prioridad', 1000),
  ]);
  const conteos = new Map<string, number>();
  for (const row of asignaciones) {
    const id = text(row.proveedor_id);
    conteos.set(id, (conteos.get(id) ?? 0) + 1);
  }
  return `
    <form class="admin-panel admin-form" data-simple-form data-table="proveedores" data-fields="slug,nombre,contacto_email,contacto_whatsapp,canal,webhook_url,notas,activo">
      <div class="admin-panel__head"><h2>Proveedores</h2><button class="admin-button" type="submit">Crear proveedor</button></div>
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
    </form>`;
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
                return `
              <form class="admin-form" data-fulfillment-form style="padding:16px;border-top:1px solid var(--admin-line)">
                <input type="hidden" name="id" value="${escapeHtml(text(row.id))}" />
                <div class="admin-campo-revisable__head">
                  <span>Pedido: ${formatCell(pedido.cliente)} — ${escapeHtml(text(pedido.total))} ${escapeHtml(text(pedido.moneda))}</span>
                  <span>Proveedor: ${escapeHtml(text(proveedor.nombre) || 'Sin asignar')}</span>
                  <span>Creado: ${formatCell(row.created_at)}</span>
                  ${row.error_detalle ? `<span class="admin-badge admin-badge--warn">Error: ${escapeHtml(text(row.error_detalle))}</span>` : ''}
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
        <div class="admin-alert">Reindexar recalcula el embedding de todos los productos activos y consume presupuesto LLM. Estima el coste antes de confirmar.</div>
        <div class="admin-toolbar">
          <button class="admin-button admin-button--ghost" data-asesor-estimar type="button">Estimar coste de reindexado completo</button>
          <button class="admin-button" data-asesor-reindexar type="button">Reindexar catalogo</button>
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
}

function bindProductFilters() {
  const form = app.querySelector<HTMLFormElement>('[data-productos-filter]');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ['q', 'familia_id', 'tipo_id', 'activo', 'tipo_comercial']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    location.hash = `#/productos${qs ? `?${qs}` : ''}`;
  });
}

function bindProductList() {
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
      const payload: Row = {
        estado: String(data.get('estado') ?? 'pendiente'),
        tracking_number: emptyToNull(data.get('tracking_number')),
        tracking_url: emptyToNull(data.get('tracking_url')),
        notas: emptyToNull(data.get('notas')),
      };
      const { error } = await supabase!.from('fulfillments').update(payload).eq('id', id);
      if (error) {
        toast(error.message);
        return;
      }
      toast('Fulfillment actualizado');
      await render();
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
  const cotizacionForm = app.querySelector<HTMLFormElement>('[data-cotizacion-estado-form]');
  cotizacionForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(cotizacionForm);
    const id = String(data.get('id') ?? '');
    const estado = String(data.get('estado') ?? '');
    const notas_internas = String(data.get('notas_internas') ?? '');
    if (!id || !estado) return;
    const { error } = await supabase!
      .from('solicitudes_cotizacion')
      .update({ estado, notas_internas: notas_internas || null })
      .eq('id', id);
    if (error) toast(error.message);
    else toast('Seguimiento actualizado.');
    await render();
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
    const before = await getRow('pedidos', id);
    const estadoAnterior = text(before?.estado);
    const { error } = await supabase!.from('pedidos').update({ estado }).eq('id', id);
    if (error) toast(error.message);
    else {
      const {
        data: { user },
      } = await supabase!.auth.getUser();
      await supabase!.from('pedido_eventos').insert({
        pedido_id: id,
        actor_id: user?.id ?? null,
        actor_email: user?.email ?? state.email,
        tipo: 'estado_actualizado',
        de_estado: estadoAnterior || null,
        a_estado: estado,
        metadata: { source: 'admin' },
      });
      toast('Estado actualizado.');
    }
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
  const noteForm = app.querySelector<HTMLFormElement>('[data-pedido-nota-form]');
  noteForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(noteForm);
    const {
      data: { user },
    } = await supabase!.auth.getUser();
    const payload: Row = {
      pedido_id: String(data.get('pedido_id') ?? ''),
      tipo: String(data.get('tipo') ?? 'interna'),
      nota: String(data.get('nota') ?? '').trim(),
      autor_id: user?.id ?? null,
      autor_email: user?.email ?? state.email,
    };
    if (!payload['nota']) return;
    const { error } = await supabase!.from('pedido_notas').insert(payload);
    if (error) toast(error.message);
    else toast('Nota agregada');
    await render();
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
    const { data, error } = await supabase!.from('productos').insert(payload).select('id').single();
    if (error) {
      toast(error.message);
      return;
    }
    if (payload['activo'] === true) {
      await generarEmbeddingProducto(text((data as Row).id));
      await triggerRebuild();
    }
    toast(
      payload['activo'] === true
        ? 'Producto creado y publicacion solicitada'
        : 'Producto creado como borrador'
    );
    location.hash = `#/producto?id=${encodeURIComponent(text((data as Row).id))}`;
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

function table(headers: string[], rows: string[][]): string {
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers
    .map(h => `<th>${escapeHtml(h)}</th>`)
    .join('')}</tr></thead><tbody>${
    rows.length
      ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headers.length}">Sin registros.</td></tr>`
  }</tbody></table></div>`;
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
  moneda: string;
  stock: number | null;
  gestionar_stock: boolean;
  stock_estado: 'instock' | 'outofstock' | 'onbackorder';
  backorder_policy: 'no' | 'notify' | 'yes';
  disponible: boolean;
  activo: boolean;
  destacado: boolean;
  nuevo: boolean;
  imagen_principal: string | null;
  galeria: string[];
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
  'moneda',
  'stock',
  'gestionar_stock',
  'stock_estado',
  'backorder_policy',
  'disponible',
  'activo',
  'destacado',
  'nuevo',
  'imagen_principal',
  'galeria',
  'ficha_pdf',
  'especificaciones',
  'aplicaciones_es',
  'aplicaciones_en',
  'atributos',
  'peso_kg',
  'dimensiones_cm',
  'orden',
];

function bindProductExcelTools() {
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
  fileInput?.addEventListener('change', () => {
    if (!status) return;
    const file = fileInput.files?.[0];
    status.textContent = file ? `Archivo seleccionado: ${file.name}` : 'Sin archivo seleccionado.';
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
      if (status) status.textContent = 'Leyendo Excel...';
      const result = await importProductosExcel(file, { createMissingTaxonomy });
      if (status) {
        status.textContent = `Importados ${result.upserted} productos. ${result.createdFamilies} familias y ${result.createdTypes} tipos creados. ${result.warnings.length} advertencias.`;
      }
      toast(`Importación completada: ${result.upserted} productos`);
      await render();
    } catch (error) {
      if (status) status.textContent = 'Error al importar Excel.';
      toast(error instanceof Error ? error.message : 'No se pudo importar Excel');
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
  const rows: Row[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query
      .order('orden', { ascending: true })
      .range(from, from + pageSize - 1);
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
        galeria: '',
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
    moneda: text(row.moneda) || 'COP',
    stock: row.stock ?? '',
    gestionar_stock: Boolean(row.gestionar_stock),
    stock_estado: text(row.stock_estado),
    backorder_policy: text(row.backorder_policy),
    disponible: row.disponible !== false,
    activo: Boolean(row.activo),
    destacado: Boolean(row.destacado),
    nuevo: Boolean(row.nuevo),
    imagen_principal: text(row.imagen_principal),
    galeria: stringArray(row.galeria).join('\n'),
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

async function importProductosExcel(
  file: File,
  options: { createMissingTaxonomy: boolean }
): Promise<{
  upserted: number;
  createdFamilies: number;
  createdTypes: number;
  warnings: string[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('El archivo Excel no contiene hojas.');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`No se pudo leer la hoja ${sheetName}.`);
  const rawRows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' });
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

    const imagenPrincipal = normalized.imagen_principal || normalized.galeria[0] || null;
    const galeria = [
      ...new Set([normalized.imagen_principal, ...normalized.galeria].filter(Boolean) as string[]),
    ];

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
      imagen_principal: imagenPrincipal,
      galeria,
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
      moneda: normalized.moneda || 'COP',
      stock: normalized.stock,
      gestionar_stock: normalized.gestionar_stock,
      stock_estado: normalized.stock_estado,
      backorder_policy: normalized.backorder_policy,
      disponible: normalized.disponible,
      disponible_actualizado_at: new Date().toISOString(),
      destacado: normalized.destacado,
      nuevo: normalized.nuevo,
      activo: normalized.activo,
      orden: normalized.orden,
    });
  }

  const chunkSize = 50;
  let upserted = 0;
  for (let i = 0; i < upserts.length; i += chunkSize) {
    const chunk = upserts.slice(i, i + chunkSize);
    const { error } = await supabase!.from('productos').upsert(chunk, { onConflict: 'slug' });
    if (error) throw error;
    upserted += chunk.length;
  }

  return { upserted, createdFamilies, createdTypes, warnings };
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
    activo: boolValue('activo', true),
    destacado: boolValue('destacado'),
    nuevo: boolValue('nuevo'),
    imagen_principal: emptyStringToNull(textValue('imagen_principal')),
    galeria: parseExcelList(get('galeria')),
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
  const { data, error } = await supabase!
    .from('familias')
    .insert(payload)
    .select('id,slug,nombre_es')
    .single();
  if (error) throw error;
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
  const { data, error } = await supabase!
    .from('tipos')
    .insert(payload)
    .select('id,slug,nombre_es')
    .single();
  if (error) throw error;
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
