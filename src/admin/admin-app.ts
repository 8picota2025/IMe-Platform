import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

type View =
  | 'dashboard'
  | 'productos'
  | 'producto'
  | 'taxonomia'
  | 'cotizaciones'
  | 'cotizacion'
  | 'pedidos'
  | 'pedido'
  | 'proveedores'
  | 'proveedor-productos'
  | 'fulfillments'
  | 'conocimiento'
  | 'ingesta'
  | 'asesor'

type Row = Record<string, unknown>
type ProductoDraft = {
  id: string | undefined
  slug: string
  nombre_es: string
  nombre_en: string
  descripcion_corta_es: string
  descripcion_corta_en: string
  descripcion_larga_es: string
  descripcion_larga_en: string
  familia_id: string
  tipo_id: string
  especificaciones: unknown[]
  aplicaciones_es: string[]
  aplicaciones_en: string[]
  imagen_principal: string
  ficha_pdf: string
  tipo_comercial: 'consumible' | 'equipo'
  fulfillment_mode: 'dropship' | 'cotizacion' | 'individualizado'
  precio: number | null
  moneda: string
  stock: number | null
  destacado: boolean
  nuevo: boolean
  activo: boolean
  orden: number
}

interface CampoRevisable {
  valor: string
  origen: string
  confianza: number
  requiere_revision: boolean
}

interface EspecRevisable extends CampoRevisable {
  clave: string
  grupo: string
}

let ingestFamilias: Row[] = []
let ingestTipos: Row[] = []

const appElement = document.getElementById('admin-app')
const supabase = getSupabaseClient()

if (!appElement) throw new Error('admin-app root missing')
const app = appElement

const state = {
  view: parseView(location.hash),
  recordId: new URLSearchParams(location.hash.split('?')[1] ?? '').get('id'),
  email: '',
}

window.addEventListener('hashchange', () => {
  state.view = parseView(location.hash)
  state.recordId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('id')
  void render()
})

void render()

function hashParams(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '')
}

function parseView(hash: string): View {
  const raw = hash.replace(/^#\/?/, '').split('?')[0]
  if (
    raw === 'productos' ||
    raw === 'producto' ||
    raw === 'taxonomia' ||
    raw === 'cotizaciones' ||
    raw === 'cotizacion' ||
    raw === 'pedidos' ||
    raw === 'pedido' ||
    raw === 'proveedores' ||
    raw === 'proveedor-productos' ||
    raw === 'fulfillments' ||
    raw === 'conocimiento' ||
    raw === 'ingesta' ||
    raw === 'asesor'
  ) {
    return raw
  }
  return 'dashboard'
}

async function render() {
  if (!isSupabaseConfigured() || !supabase) {
    app.innerHTML = shellHtml(
      'Configuracion pendiente',
      `<div class="admin-alert">Configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY para usar el admin. Sin esas variables no se abre sesion ni se escriben datos.</div>`
    )
    bindShell()
    return
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    renderLogin()
    return
  }
  state.email = session.user.email ?? 'admin'

  const view = await routeView()
  app.innerHTML = shellHtml(view.title, view.body)
  bindShell()
  bindView()
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
    </section>`
  const form = app.querySelector<HTMLFormElement>('[data-login]')
  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const data = new FormData(form)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) {
      toast(error.message)
      return
    }
    location.hash = '#/dashboard'
    await render()
  })
}

async function routeView(): Promise<{ title: string; body: string }> {
  if (state.view === 'productos') return { title: 'Productos', body: await productosView() }
  if (state.view === 'producto') return { title: 'Producto', body: await productoFormView() }
  if (state.view === 'taxonomia') return { title: 'Taxonomia', body: await taxonomiaView() }
  if (state.view === 'cotizaciones')
    return { title: 'Cotizaciones', body: await cotizacionesView() }
  if (state.view === 'cotizacion')
    return { title: 'Cotizacion', body: await cotizacionDetailView() }
  if (state.view === 'pedidos') return { title: 'Pedidos', body: await pedidosView() }
  if (state.view === 'pedido') return { title: 'Pedido', body: await pedidoDetailView() }
  if (state.view === 'proveedores') return { title: 'Proveedores', body: await proveedoresView() }
  if (state.view === 'proveedor-productos')
    return { title: 'Productos del proveedor', body: await proveedorProductosView() }
  if (state.view === 'fulfillments')
    return { title: 'Fulfillments', body: await fulfillmentsView() }
  if (state.view === 'conocimiento') return { title: 'Conocimiento', body: conocimientoView() }
  if (state.view === 'ingesta') return { title: 'Ingesta PDF', body: await ingestaView() }
  if (state.view === 'asesor') return { title: 'Asesor', body: await asesorView() }
  return { title: 'Dashboard', body: await dashboardView() }
}

function shellHtml(title: string, body: string): string {
  const links: Array<[View, string]> = [
    ['dashboard', 'Dashboard'],
    ['productos', 'Productos'],
    ['taxonomia', 'Taxonomia'],
    ['ingesta', 'Ingesta PDF'],
    ['cotizaciones', 'Cotizaciones'],
    ['pedidos', 'Pedidos'],
    ['proveedores', 'Proveedores'],
    ['fulfillments', 'Fulfillments'],
    ['conocimiento', 'Conocimiento'],
    ['asesor', 'Asesor'],
  ]
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
    </section>`
}

function bindShell() {
  app.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await supabase?.auth.signOut()
    location.hash = '#/dashboard'
    await render()
  })
  app.querySelector('[data-publish]')?.addEventListener('click', async () => {
    await triggerRebuild()
  })
}

function bindView() {
  bindProductFilters()
  bindProductList()
  bindProductForm()
  bindTaxonomy()
  bindReasignacion()
  bindSimpleTables()
  bindIngest()
  bindProveedorProductos()
  bindFulfillments()
  bindAsesorPanel()
}

async function dashboardView(): Promise<string> {
  const [productos, cotizaciones, pedidos, dropship] = await Promise.all([
    count('productos'),
    count('solicitudes_cotizacion', { leida: false }),
    count('pedidos', { leida: false }),
    count('productos', { fulfillment_mode: 'dropship' }),
  ])
  const withoutProvider = await productosDropshipSinProveedor()
  return `
    ${withoutProvider > 0 ? `<div class="admin-alert">${withoutProvider} productos dropship no tienen proveedor asignado.</div>` : ''}
    <section class="admin-grid">
      ${metric('Total productos', productos)}
      ${metric('Cotizaciones sin leer', cotizaciones)}
      ${metric('Pedidos sin leer', pedidos)}
      ${metric('Dropship', dropship)}
      ${metric('Dropship sin proveedor', withoutProvider)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Accesos</h2></div>
      <div class="admin-grid" style="padding:16px">
        <a class="admin-button" href="#/producto">Crear producto</a>
        <a class="admin-button" href="#/ingesta">Ingesta PDF</a>
        <a class="admin-button admin-button--ghost" href="#/taxonomia">Taxonomia</a>
        <a class="admin-button admin-button--ghost" href="#/cotizaciones">Cotizaciones</a>
      </div>
    </section>`
}

function metric(label: string, value: number): string {
  return `<article class="admin-card"><strong>${escapeHtml(label)}</strong><span>${value}</span></article>`
}

const PRODUCTOS_PAGE_SIZE = 20

function productosLink(overrides: Record<string, string>): string {
  const params = hashParams()
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value)
    else params.delete(key)
  }
  const qs = params.toString()
  return `#/productos${qs ? `?${qs}` : ''}`
}

async function productosView(): Promise<string> {
  const params = hashParams()
  const q = (params.get('q') ?? '').trim()
  const familiaId = params.get('familia_id') ?? ''
  const tipoId = params.get('tipo_id') ?? ''
  const activo = params.get('activo') ?? ''
  const tipoComercial = params.get('tipo_comercial') ?? ''
  const page = Math.max(1, numberOrZero(params.get('page')) || 1)

  const [familias, tipos] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
  ])
  const familiasPorId = new Map(familias.map((f) => [text(f.id), text(f.nombre_es)]))
  const tiposPorId = new Map(tipos.map((t) => [text(t.id), text(t.nombre_es)]))
  const tiposParaSelect = tipos.map(
    (t): Row => ({
      ...t,
      nombre_es: `${familiasPorId.get(text(t.familia_id)) ?? 'Sin familia'} / ${text(t.nombre_es)}`,
    })
  )

  let query = supabase!.from('productos').select('*', { count: 'exact' })
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '')
    if (safeQ) query = query.or(`nombre_es.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`)
  }
  if (familiaId) query = query.eq('familia_id', familiaId)
  if (tipoId) query = query.eq('tipo_id', tipoId)
  if (activo === '1') query = query.eq('activo', true)
  if (activo === '0') query = query.eq('activo', false)
  if (tipoComercial) query = query.eq('tipo_comercial', tipoComercial)

  const from = (page - 1) * PRODUCTOS_PAGE_SIZE
  const { data, count, error } = await query
    .order('orden', { ascending: true })
    .range(from, from + PRODUCTOS_PAGE_SIZE - 1)
  if (error) toast(error.message)
  const rows = (data ?? []) as unknown as Row[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PRODUCTOS_PAGE_SIZE))

  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Catalogo (${total})</h2>
        <a class="admin-button" href="#/producto">Nuevo producto</a>
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
      ${table(
        ['Imagen', 'Nombre', 'Slug', 'Familia', 'Tipo', 'Fulfillment', 'Estado', 'Acciones'],
        rows.map((row) => [
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
    </section>`
}

async function productoFormView(): Promise<string> {
  const [familias, tipos, producto] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
    state.recordId ? getRow('productos', state.recordId) : Promise.resolve(null),
  ])
  const draft = productDraft(producto)
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
            ${field('precio', 'Precio COP', draft.precio?.toString() ?? '', false, 'number')}
            ${field('stock', 'Stock', draft.stock?.toString() ?? '', false, 'number')}
            ${field('orden', 'Orden', String(draft.orden), false, 'number')}
          </div>
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
          ${checkbox('destacado', 'Destacado', draft.destacado)}
          ${checkbox('nuevo', 'Nuevo', draft.nuevo)}
          ${checkbox('activo', 'Activo / publicado en sitio estatico', draft.activo)}
          <div class="admin-alert">Guardar desde ingesta siempre debe quedar como borrador hasta revision humana. Publicar cambios dispara rebuild separado.</div>
        </aside>
      </div>
    </form>`
}

async function taxonomiaView(): Promise<string> {
  const [familias, tipos, productos] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
    selectRows('productos', 'id,nombre_es,slug,familia_id,tipo_id', 'nombre_es', 500),
  ])
  const familiasPorId = new Map(familias.map((f) => [text(f.id), text(f.nombre_es)]))
  const conteoPorTipo = new Map<string, number>()
  const productosSinTipo: Row[] = []
  for (const producto of productos) {
    const tipoId = text(producto.tipo_id)
    if (!tipoId) {
      productosSinTipo.push(producto)
      continue
    }
    conteoPorTipo.set(tipoId, (conteoPorTipo.get(tipoId) ?? 0) + 1)
  }
  const tiposParaSelect = tipos.map((t) => ({
    ...t,
    nombre_es: `${familiasPorId.get(text(t.familia_id)) ?? 'Sin familia'} / ${text(t.nombre_es)}`,
  }))
  return `
    <section class="admin-grid">
      <form class="admin-panel admin-form" data-simple-form data-table="familias" data-fields="slug,nombre_es,nombre_en,descripcion_es,descripcion_en,orden,activo">
        <div class="admin-panel__head"><h2>Familias</h2><button class="admin-button" type="submit">Crear familia</button></div>
        <div style="padding:16px" class="admin-form">
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
          familias.map((r) => [text(r.slug), text(r.nombre_es), status(r.activo)])
        )}
      </form>
      <form class="admin-panel admin-form" data-simple-form data-table="tipos" data-fields="familia_id,slug,nombre_es,nombre_en,orden,activo">
        <div class="admin-panel__head"><h2>Tipos</h2><button class="admin-button" type="submit">Crear tipo</button></div>
        <div style="padding:16px" class="admin-form">
          ${select('familia_id', 'Familia', '', familias, 'nombre_es')}
          ${field('slug', 'Slug', '', true)}
          ${field('nombre_es', 'Nombre ES', '', true)}
          ${field('nombre_en', 'Nombre EN')}
          ${field('orden', 'Orden', '0', false, 'number')}
          ${checkbox('activo', 'Activo', true)}
        </div>
        ${table(
          ['Slug', 'Nombre', 'Productos', 'Estado'],
          tipos.map((r) => [
            text(r.slug),
            text(r.nombre_es),
            String(conteoPorTipo.get(text(r.id)) ?? 0),
            status(r.activo),
          ])
        )}
      </form>
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Productos sin tipo asignado (${productosSinTipo.length})</h2></div>
      ${
        productosSinTipo.length === 0
          ? '<p class="admin-help" style="padding:16px">Todos los productos tienen tipo asignado.</p>'
          : productosSinTipo
              .map(
                (p) => `
        <form class="admin-form" data-reasignar-form style="padding:16px;border-top:1px solid var(--admin-line)">
          <input type="hidden" name="producto_id" value="${escapeHtml(text(p.id))}" />
          <div class="admin-editor__cols">
            <div class="admin-field">Producto<strong>${escapeHtml(text(p.nombre_es))} <span class="admin-meta">(${escapeHtml(text(p.slug))})</span></strong></div>
            ${select('familia_id', 'Familia', text(p.familia_id), familias, 'nombre_es', true)}
            ${select('tipo_id', 'Tipo', '', tiposParaSelect, 'nombre_es', true)}
          </div>
          <button class="admin-button" type="submit">Reasignar</button>
        </form>`
              )
              .join('')
      }
    </section>`
}

async function cotizacionesView(): Promise<string> {
  const rows = await selectRows('solicitudes_cotizacion', '*', 'created_at', 100, false)
  return listWithCsv(
    'solicitudes_cotizacion',
    rows,
    ['created_at', 'nombre', 'empresa', 'email', 'telefono', 'leida'],
    'cotizacion'
  )
}

async function cotizacionDetailView(): Promise<string> {
  const row = state.recordId ? await getRow('solicitudes_cotizacion', state.recordId) : null
  if (!row) return notFoundPanel('Cotizacion no encontrada', '#/cotizaciones')
  const productos = Array.isArray(row.productos) ? row.productos : []
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
    </section>`
}

const PEDIDO_ESTADOS: Array<[string, string]> = [
  ['pendiente', 'Pendiente'],
  ['pagado', 'Pagado'],
  ['procesando', 'Procesando'],
  ['enviado', 'Enviado'],
  ['entregado', 'Entregado'],
  ['cancelado', 'Cancelado'],
  ['error', 'Error'],
]

async function pedidosView(): Promise<string> {
  const rows = await selectRows('pedidos', '*', 'created_at', 100, false)
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
  )
}

async function pedidoDetailView(): Promise<string> {
  const row = state.recordId ? await getRow('pedidos', state.recordId) : null
  if (!row) return notFoundPanel('Pedido no encontrado', '#/pedidos')
  const cliente = row.cliente && typeof row.cliente === 'object' ? (row.cliente as Row) : {}
  const items = Array.isArray(row.items) ? row.items : []

  const referencia = text(row.referencia_pasarela)
  const [eventosResult, fulfillmentsResult] = await Promise.all([
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
  ])
  const eventos = (eventosResult.data ?? []) as Row[]
  const fulfillments = (fulfillmentsResult.data ?? []) as Row[]

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
            ['Total', `${escapeHtml(text(row.total))} ${escapeHtml(text(row.moneda))}`],
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
                fulfillments.map((f) => {
                  const proveedor =
                    f.proveedores && typeof f.proveedores === 'object' ? (f.proveedores as Row) : {}
                  return [
                    escapeHtml(text(proveedor.nombre)) || '—',
                    formatCell(f.estado),
                    formatCell(f.notificado_at),
                    escapeHtml(text(f.notas)) || escapeHtml(text(f.error_detalle)) || '—',
                    `<button class="admin-button admin-button--ghost" data-resend-notification="${escapeHtml(text(f.id))}" type="button">Reenviar</button>`,
                  ]
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
                eventos.map((e) => [
                  formatCell(e.created_at),
                  escapeHtml(text(e.proveedor_pago)),
                  escapeHtml(text(e.event_id)),
                  formatCell(e.procesado),
                ])
              )
        }
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
        <div class="admin-alert">Cambiar el estado aqui es manual y no envia notificaciones de pago ni al proveedor (eso llega en F4). Usalo solo para correcciones administrativas.</div>
        <div class="admin-editor__cols">
          ${selectStatic('estado', 'Estado', text(row.estado), PEDIDO_ESTADOS)}
        </div>
        <button class="admin-button" type="submit">Cambiar estado</button>
      </form>
    </section>`
}

function notFoundPanel(message: string, backHref: string): string {
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>${escapeHtml(message)}</h2>
        <a class="admin-button admin-button--ghost" href="${escapeHtml(backHref)}">Volver</a>
      </div>
    </section>`
}

function jsonObjectTable(obj: Row): string {
  const keys = Object.keys(obj)
  if (keys.length === 0) return '<p class="admin-help">Sin datos.</p>'
  return table(
    ['Campo', 'Valor'],
    keys.map((key) => [escapeHtml(key), formatCell(obj[key])])
  )
}

function jsonRowsTable(items: unknown[]): string {
  if (items.length === 0) return '<p class="admin-help">Sin elementos.</p>'
  const objectItems = items.map((item) =>
    item && typeof item === 'object' ? (item as Row) : { valor: item }
  )
  const keys = Array.from(new Set(objectItems.flatMap((item) => Object.keys(item))))
  return table(
    keys,
    objectItems.map((item) => keys.map((key) => formatCell(item[key])))
  )
}

async function proveedoresView(): Promise<string> {
  const [rows, asignaciones] = await Promise.all([
    selectRows('proveedores', '*', 'nombre', 100),
    selectRows('proveedor_producto', 'proveedor_id', 'prioridad', 1000),
  ])
  const conteos = new Map<string, number>()
  for (const row of asignaciones) {
    const id = text(row.proveedor_id)
    conteos.set(id, (conteos.get(id) ?? 0) + 1)
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
        rows.map((r) => [
          text(r.nombre),
          text(r.canal),
          status(r.activo),
          String(conteos.get(text(r.id)) ?? 0),
          `<a class="admin-button admin-button--ghost" href="#/proveedor-productos?id=${encodeURIComponent(text(r.id))}">Productos</a>`,
        ])
      )}
    </form>`
}

async function proveedorProductosView(): Promise<string> {
  const proveedorId = state.recordId
  if (!proveedorId) {
    return `<section class="admin-panel"><div style="padding:16px" class="admin-alert">Selecciona un proveedor desde la lista de Proveedores.</div></section>`
  }
  const [proveedor, asignaciones, productos] = await Promise.all([
    getRow('proveedores', proveedorId),
    selectProveedorProductos(proveedorId),
    selectRows('productos', 'id,nombre_es,slug,fulfillment_mode', 'nombre_es', 500),
  ])
  if (!proveedor) {
    return `<section class="admin-panel"><div style="padding:16px" class="admin-alert">Proveedor no encontrado.</div></section>`
  }
  const asignados = new Set(asignaciones.map((row) => text(row.producto_id)))
  const disponibles = productos.filter((p) => !asignados.has(text(p.id)))
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Productos de ${escapeHtml(text(proveedor.nombre))}</h2>
        <a class="admin-button admin-button--ghost" href="#/proveedores">Volver a proveedores</a>
      </div>
      <div style="padding:16px" class="admin-alert">precio_costo es CONFIDENCIAL: nunca se expone en APIs publicas ni en el sitio.</div>
      ${table(
        ['Producto', 'Fulfillment', 'Precio costo', 'Moneda', 'Prioridad', 'Activo', 'Acciones'],
        asignaciones.map((row) => {
          const producto =
            row.productos && typeof row.productos === 'object' ? (row.productos as Row) : {}
          return [
            text(producto.nombre_es) || text(row.producto_id),
            text(producto.fulfillment_mode),
            text(row.precio_costo),
            text(row.moneda_costo),
            text(row.prioridad),
            status(row.activo),
            `<button class="admin-button admin-button--ghost admin-button--danger" data-remove-pp="${escapeHtml(text(row.id))}" type="button">Quitar</button>`,
          ]
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
    </section>`
}

async function selectProveedorProductos(proveedorId: string): Promise<Row[]> {
  const { data, error } = await supabase!
    .from('proveedor_producto')
    .select('*, productos(nombre_es, slug, fulfillment_mode)')
    .eq('proveedor_id', proveedorId)
    .order('prioridad')
  if (error) {
    toast(error.message)
    return []
  }
  return (data ?? []) as unknown as Row[]
}

const FULFILLMENT_ESTADOS: Array<[string, string]> = [
  ['pendiente', 'Pendiente'],
  ['notificado', 'Notificado'],
  ['preparando', 'Preparando'],
  ['enviado', 'Enviado'],
  ['entregado', 'Entregado'],
  ['cancelado', 'Cancelado'],
  ['error', 'Error'],
]

async function fulfillmentsView(): Promise<string> {
  const params = hashParams()
  const estado = params.get('estado') ?? ''
  const proveedorId = params.get('proveedor_id') ?? ''
  const desde = params.get('desde') ?? ''
  const hasta = params.get('hasta') ?? ''

  const [pendientes, notificados, enviados, entregados, conError, proveedores] = await Promise.all([
    count('fulfillments', { estado: 'pendiente' }),
    count('fulfillments', { estado: 'notificado' }),
    count('fulfillments', { estado: 'enviado' }),
    count('fulfillments', { estado: 'entregado' }),
    count('fulfillments', { estado: 'error' }),
    selectRows('proveedores', 'id, nombre', 'nombre', 200),
  ])

  let query = supabase!
    .from('fulfillments')
    .select('*, pedidos(cliente, total, moneda), proveedores(nombre)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (estado) query = query.eq('estado', estado)
  if (proveedorId) query = query.eq('proveedor_id', proveedorId)
  if (desde) query = query.gte('created_at', desde)
  if (hasta) query = query.lte('created_at', `${hasta}T23:59:59`)
  const { data, error } = await query
  if (error) toast(error.message)
  const rows = (data ?? []) as unknown as Row[]

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
              .map((row) => {
                const pedido =
                  row.pedidos && typeof row.pedidos === 'object' ? (row.pedidos as Row) : {}
                const proveedor =
                  row.proveedores && typeof row.proveedores === 'object'
                    ? (row.proveedores as Row)
                    : {}
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
              </form>`
              })
              .join('')
      }
    </section>`
}

function conocimientoView(): string {
  return `<section class="admin-panel"><div class="admin-panel__head"><h2>Conocimiento</h2></div><div style="padding:16px"><div class="admin-alert">BACKLOG_V2: el CMS completo de articulos queda fuera del alcance V1. Este panel queda como stub documentado.</div></div></section>`
}

async function ingestaView(): Promise<string> {
  const [familias, tipos] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
  ])
  ingestFamilias = familias
  ingestTipos = tipos
  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>PDF a borrador revisable</h2></div>
      <form class="admin-form" data-ingest-form style="padding:16px">
        ${field('pdf_url', 'URL de PDF en Storage')}
        ${textarea('pdf_text', 'Texto extraido del PDF')}
        <button class="admin-button" type="submit">Extraer borrador</button>
        <div class="admin-alert">La IA solo propone. Revise cada campo, marque "Revisado" en los campos marcados y complete los datos comerciales antes de crear el producto.</div>
      </form>
    </section>
    <div data-ingest-review></div>`
}

const TIPOS_USO_LLM: Array<[string, string]> = [
  ['chat', 'Chat (Asesor)'],
  ['embedding', 'Embeddings'],
  ['ingesta', 'Ingesta PDF'],
]

const MODOS_ASESOR: Array<[string, string]> = [
  ['rag', 'RAG (normal)'],
  ['keyword_degradado', 'Degradado (palabra clave)'],
  ['sin_resultados', 'Sin resultados'],
]

function periodoActualCliente(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function sumField(rows: Row[], key: string): number {
  return rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0)
}

async function asesorView(): Promise<string> {
  const periodo = periodoActualCliente()
  const [{ data: llmData, error: llmError }, { data: asesorData, error: asesorError }] =
    await Promise.all([
      supabase!.from('llm_uso').select('*').eq('periodo_yyyy_mm', periodo),
      supabase!.from('asesor_uso').select('*').eq('periodo_yyyy_mm', periodo),
    ])
  if (llmError) toast(llmError.message)
  if (asesorError) toast(asesorError.message)
  const llmRows = (llmData ?? []) as unknown as Row[]
  const asesorRows = (asesorData ?? []) as unknown as Row[]

  const costeTotal = sumField(llmRows, 'coste_estimado')
  const conversaciones = asesorRows.length
  const handoffs = asesorRows.filter((r) => r.hubo_handoff === true).length
  const latencias = asesorRows
    .map((r) => Number(r.latencia_ms ?? 0))
    .filter((v) => Number.isFinite(v) && v > 0)
  const latenciaPromedio = latencias.length
    ? Math.round(latencias.reduce((acc, v) => acc + v, 0) / latencias.length)
    : 0

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
          const filas = llmRows.filter((r) => text(r.tipo) === tipo)
          return [
            label,
            String(sumField(filas, 'input_tokens')),
            String(sumField(filas, 'output_tokens')),
            sumField(filas, 'coste_estimado').toFixed(4),
          ]
        })
      )}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Conversaciones por modo (${escapeHtml(periodo)})</h2></div>
      ${table(
        ['Modo', 'Conversaciones'],
        MODOS_ASESOR.map(([modo, label]) => [
          label,
          String(asesorRows.filter((r) => text(r.modo) === modo).length),
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
    </section>`
}

function bindAsesorPanel() {
  const resultado = app.querySelector<HTMLElement>('[data-asesor-reindex-result]')
  if (!resultado) return

  app.querySelector('[data-asesor-estimar]')?.addEventListener('click', async () => {
    resultado.innerHTML = '<p class="admin-help">Estimando coste...</p>'
    const { data, error } = await supabase!.functions.invoke('generar-embeddings', {
      body: { todos: true, estimar: true },
    })
    if (error) {
      resultado.innerHTML = `<div class="admin-alert">${escapeHtml(error.message)}</div>`
      return
    }
    const json = data as Row
    resultado.innerHTML = `
      <div class="admin-alert">
        Productos a procesar: ${escapeHtml(text(json['productos_a_procesar']))} ·
        Tokens estimados: ${escapeHtml(text(json['tokens_estimados']))} ·
        Coste estimado: $${escapeHtml(text(json['coste_estimado']))} (${escapeHtml(text(json['proveedor']))}/${escapeHtml(text(json['modelo']))})
      </div>`
  })

  app.querySelector('[data-asesor-reindexar]')?.addEventListener('click', async () => {
    if (!confirm('Reindexar todo el catalogo activo? Esto consume presupuesto LLM.')) return
    resultado.innerHTML = '<p class="admin-help">Reindexando catalogo, esto puede tardar...</p>'
    const { data, error } = await supabase!.functions.invoke('generar-embeddings', {
      body: { todos: true },
    })
    if (error) {
      resultado.innerHTML = `<div class="admin-alert">${escapeHtml(error.message)}</div>`
      return
    }
    const json = data as Row
    const errores = Array.isArray(json['errores']) ? json['errores'] : []
    resultado.innerHTML = `
      <div class="admin-alert">
        Procesados: ${escapeHtml(text(json['procesados']))} ·
        Omitidos: ${escapeHtml(text(json['omitidos']))} ·
        Coste estimado: $${escapeHtml(text(json['coste_estimado']))}
      </div>
      ${errores.length ? jsonRowsTable(errores) : ''}`
  })
}

function bindProductFilters() {
  const form = app.querySelector<HTMLFormElement>('[data-productos-filter]')
  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(form)
    const params = new URLSearchParams()
    for (const key of ['q', 'familia_id', 'tipo_id', 'activo', 'tipo_comercial']) {
      const value = String(data.get(key) ?? '').trim()
      if (value) params.set(key, value)
    }
    const qs = params.toString()
    location.hash = `#/productos${qs ? `?${qs}` : ''}`
  })
}

function bindProductList() {
  app.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const tableName = button.getAttribute('data-table')
      const id = button.getAttribute('data-delete')
      if (!tableName || !id || !confirm('Eliminar registro?')) return
      const { error } = await supabase!.from(tableName).delete().eq('id', id)
      if (error) toast(error.message)
      await render()
    })
  })
}

function bindProductForm() {
  const form = app.querySelector<HTMLFormElement>('[data-product-form]')
  if (!form) return
  form.addEventListener('input', (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.name !== 'nombre_es') return
    const slug = form.elements.namedItem('slug')
    if (slug instanceof HTMLInputElement && !slug.value) slug.value = slugify(target.value)
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const payload = productPayload(form)
    const id = String(new FormData(form).get('id') ?? '')
    if (id) {
      const { error } = await supabase!.from('productos').update(payload).eq('id', id)
      if (error) {
        toast(error.message)
        return
      }
      if (payload['activo']) await generarEmbeddingProducto(id)
      toast('Producto guardado')
      location.hash = '#/productos'
      return
    }
    const { data, error } = await supabase!.from('productos').insert(payload).select('id').single()
    if (error) {
      toast(error.message)
      return
    }
    if (payload['activo']) await generarEmbeddingProducto(text((data as Row).id))
    toast('Producto guardado')
    location.hash = '#/productos'
  })
  form.querySelector('[data-delete-product]')?.addEventListener('click', async () => {
    const id = String(new FormData(form).get('id') ?? '')
    if (!id || !confirm('Eliminar producto?')) return
    const { error } = await supabase!.from('productos').delete().eq('id', id)
    if (error) toast(error.message)
    location.hash = '#/productos'
  })
  form.querySelectorAll<HTMLButtonElement>('[data-upload]').forEach((button) => {
    button.addEventListener('click', async () => uploadFile(button, form))
  })
}

function bindReasignacion() {
  app.querySelectorAll<HTMLFormElement>('[data-reasignar-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const data = new FormData(form)
      const productoId = String(data.get('producto_id') ?? '')
      const payload: Row = {
        familia_id: emptyToNull(data.get('familia_id')),
        tipo_id: emptyToNull(data.get('tipo_id')),
      }
      const { error } = await supabase!.from('productos').update(payload).eq('id', productoId)
      if (error) {
        toast(error.message)
        return
      }
      toast('Producto reasignado')
      await render()
    })
  })
}

function bindTaxonomy() {
  app.querySelectorAll<HTMLFormElement>('[data-simple-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const tableName = form.dataset['table']
      const fields = form.dataset['fields']?.split(',') ?? []
      if (!tableName) return
      const data = new FormData(form)
      const payload: Row = {}
      for (const fieldName of fields) {
        const element = form.elements.namedItem(fieldName)
        if (element instanceof HTMLInputElement && element.type === 'checkbox') {
          payload[fieldName] = element.checked
        } else if (fieldName === 'orden') {
          payload[fieldName] = numberOrZero(data.get(fieldName))
        } else {
          payload[fieldName] = emptyToNull(data.get(fieldName))
        }
      }
      const { error } = await supabase!.from(tableName).insert(payload)
      if (error) {
        toast(error.message)
        return
      }
      toast('Registro creado')
      await render()
    })
  })
}

function bindFulfillments() {
  app.querySelectorAll<HTMLFormElement>('[data-fulfillment-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const data = new FormData(form)
      const id = String(data.get('id') ?? '')
      const payload: Row = {
        estado: String(data.get('estado') ?? 'pendiente'),
        tracking_number: emptyToNull(data.get('tracking_number')),
        tracking_url: emptyToNull(data.get('tracking_url')),
        notas: emptyToNull(data.get('notas')),
      }
      const { error } = await supabase!.from('fulfillments').update(payload).eq('id', id)
      if (error) {
        toast(error.message)
        return
      }
      toast('Fulfillment actualizado')
      await render()
    })
  })
  const filterForm = app.querySelector<HTMLFormElement>('[data-fulfillments-filter]')
  filterForm?.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(filterForm)
    const params = new URLSearchParams()
    for (const key of ['estado', 'proveedor_id', 'desde', 'hasta']) {
      const value = String(data.get(key) ?? '').trim()
      if (value) params.set(key, value)
    }
    const qs = params.toString()
    location.hash = `#/fulfillments${qs ? `?${qs}` : ''}`
  })
  app.querySelectorAll<HTMLButtonElement>('[data-resend-notification]').forEach((button) => {
    button.addEventListener('click', async () => {
      const fulfillmentId = button.dataset['resendNotification']
      if (!fulfillmentId) return
      const { error } = await supabase!.functions.invoke('notificar-proveedor', {
        body: { fulfillment_id: fulfillmentId },
      })
      toast(error ? error.message : 'Notificacion enviada al proveedor.')
    })
  })
}

function bindProveedorProductos() {
  const form = app.querySelector<HTMLFormElement>('[data-pp-form]')
  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const data = new FormData(form)
    const productoId = String(data.get('producto_id') ?? '')
    if (!productoId) {
      toast('Selecciona un producto')
      return
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
    }
    const { error } = await supabase!.from('proveedor_producto').insert(payload)
    if (error) {
      toast(error.message)
      return
    }
    toast('Producto asignado')
    await render()
  })
  app.querySelectorAll<HTMLButtonElement>('[data-remove-pp]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset['removePp']
      if (!id || !confirm('Quitar esta asignacion?')) return
      const { error } = await supabase!.from('proveedor_producto').delete().eq('id', id)
      if (error) toast(error.message)
      await render()
    })
  })
}

function bindSimpleTables() {
  app.querySelectorAll<HTMLButtonElement>('[data-mark-read]').forEach((button) => {
    button.addEventListener('click', async () => {
      const tableName = button.dataset['table']
      const id = button.dataset['markRead']
      if (!tableName || !id) return
      const { error } = await supabase!.from(tableName).update({ leida: true }).eq('id', id)
      if (error) toast(error.message)
      await render()
    })
  })
  app.querySelectorAll<HTMLButtonElement>('[data-csv]').forEach((button) => {
    button.addEventListener('click', () => {
      const raw = button.dataset['csv']
      if (!raw) return
      downloadCsv(button.dataset['filename'] ?? 'export.csv', JSON.parse(raw) as Row[])
    })
  })
  const pedidoForm = app.querySelector<HTMLFormElement>('[data-pedido-estado-form]')
  pedidoForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const data = new FormData(pedidoForm)
    const id = String(data.get('id') ?? '')
    const estado = String(data.get('estado') ?? '')
    if (!id || !estado) return
    const { error } = await supabase!.from('pedidos').update({ estado }).eq('id', id)
    if (error) toast(error.message)
    else toast('Estado actualizado.')
    await render()
  })
}

function bindIngest() {
  const form = app.querySelector<HTMLFormElement>('[data-ingest-form]')
  const reviewContainer = app.querySelector<HTMLElement>('[data-ingest-review]')
  if (!form || !reviewContainer) return
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    reviewContainer.innerHTML = '<p class="admin-help">Extrayendo borrador...</p>'
    const data = new FormData(form)
    const pdfUrl = String(data.get('pdf_url') ?? '').trim()
    const { data: json, error } = await supabase!.functions.invoke('ingesta-pdf', {
      body: {
        pdf_url: emptyToNull(data.get('pdf_url')),
        pdf_text: emptyToNull(data.get('pdf_text')),
      },
    })
    if (error || !json) {
      reviewContainer.innerHTML = `<div class="admin-alert">${escapeHtml(error?.message ?? 'No se pudo generar el borrador.')}</div>`
      return
    }
    reviewContainer.innerHTML = renderIngestReview(json as Row, pdfUrl)
    bindIngestReview(reviewContainer)
  })
}

function arrayOf<T>(value: unknown, mapItem: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(mapItem) : []
}

function campoRevisable(value: unknown): CampoRevisable {
  const obj = value && typeof value === 'object' ? (value as Row) : {}
  return {
    valor: text(obj.valor),
    origen: text(obj.origen) || 'ausente',
    confianza: typeof obj.confianza === 'number' ? obj.confianza : 0,
    requiere_revision: obj.requiere_revision !== false,
  }
}

function especRevisable(value: unknown): EspecRevisable {
  const obj = value && typeof value === 'object' ? (value as Row) : {}
  return {
    clave: text(obj.clave),
    valor: text(obj.valor),
    grupo: text(obj.grupo),
    origen: text(obj.origen) || 'ausente',
    confianza: typeof obj.confianza === 'number' ? obj.confianza : 0,
    requiere_revision: obj.requiere_revision !== false,
  }
}

function campoBadges(campo: CampoRevisable, traduccion = false): string {
  const badges: string[] = []
  if (campo.origen === 'manual') {
    badges.push('<span class="admin-badge">Agregado manualmente</span>')
  } else if (campo.origen === 'ausente') {
    badges.push('<span class="admin-badge admin-badge--warn">Ausente / requiere cliente</span>')
  } else if (campo.confianza < 0.6) {
    badges.push('<span class="admin-badge admin-badge--warn">Baja confianza</span>')
  } else {
    badges.push('<span class="admin-badge admin-badge--ok">Extraido del PDF</span>')
  }
  if (traduccion)
    badges.push('<span class="admin-badge admin-badge--info">Traduccion borrador</span>')
  return badges.join(' ')
}

function campoRevisableField(
  name: string,
  label: string,
  campo: CampoRevisable,
  multiline = false
): string {
  const inputHtml = multiline
    ? `<textarea name="${escapeHtml(name)}">${escapeHtml(campo.valor)}</textarea>`
    : `<input name="${escapeHtml(name)}" type="text" value="${escapeHtml(campo.valor)}" />`
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
    </div>`
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
    </div>`
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
    </div>`
}

function emptySpecRow(): string {
  return especRevisableRow({
    clave: '',
    valor: '',
    grupo: '',
    origen: 'manual',
    confianza: 1,
    requiere_revision: false,
  })
}

function emptyAplicacionRow(): string {
  return aplicacionRevisableRow({
    valor: '',
    origen: 'manual',
    confianza: 1,
    requiere_revision: false,
  })
}

function renderIngestReview(draft: Row, pdfUrl: string): string {
  const productoEs =
    draft.producto_es && typeof draft.producto_es === 'object' ? (draft.producto_es as Row) : {}
  const productoEn =
    draft.producto_en_borrador && typeof draft.producto_en_borrador === 'object'
      ? (draft.producto_en_borrador as Row)
      : {}
  const ausentes = arrayOf(draft.ausentes, (v) => text(v)).filter(Boolean)
  const advertencias = arrayOf(draft.advertencias, (v) => text(v)).filter(Boolean)
  const rawOutput = typeof draft.raw_output === 'string' ? draft.raw_output : ''

  const nombre = campoRevisable(productoEs.nombre)
  const descripcionCorta = campoRevisable(productoEs.descripcion_corta)
  const descripcionLarga = campoRevisable(productoEs.descripcion_larga)
  const familiaSugerida = campoRevisable(productoEs.familia_sugerida)
  const tipoSugerido = campoRevisable(productoEs.tipo_sugerido)
  const especs = arrayOf(productoEs.especificaciones, especRevisable)
  const aplicaciones = arrayOf(productoEs.aplicaciones, campoRevisable)
  const metaSeo =
    productoEs.meta_seo && typeof productoEs.meta_seo === 'object'
      ? (productoEs.meta_seo as Row)
      : {}

  const nombreEn = campoRevisable(productoEn.nombre)
  const descripcionCortaEn = campoRevisable(productoEn.descripcion_corta)
  const descripcionLargaEn = campoRevisable(productoEn.descripcion_larga)
  const aplicacionesEn = arrayOf(productoEn.aplicaciones, campoRevisable)
  const hasEnDraft =
    Boolean(nombreEn.valor || descripcionCortaEn.valor || descripcionLargaEn.valor) ||
    aplicacionesEn.length > 0

  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Borrador para revision</h2></div>
      <div style="padding:16px">
        ${advertencias.length ? `<div class="admin-alert"><strong>Advertencias del modelo:</strong><ul>${advertencias.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>` : ''}
        ${ausentes.length ? `<div class="admin-alert"><strong>Campos ausentes en el PDF:</strong> ${escapeHtml(ausentes.join(', '))}</div>` : ''}
        ${rawOutput ? `<div class="admin-alert"><strong>El modelo no devolvio JSON valido.</strong> Revise la salida cruda antes de continuar.</div><pre class="admin-card" style="white-space:pre-wrap;overflow:auto;max-height:30vh">${escapeHtml(rawOutput)}</pre>` : ''}
      </div>
      <form class="admin-form" data-ingest-review-form style="padding:16px">
        <input type="hidden" name="ficha_pdf" value="${escapeHtml(pdfUrl)}" />
        <h3>Espanol (fuente)</h3>
        ${field('slug', 'Slug', slugify(nombre.valor), true)}
        ${campoRevisableField('nombre_es', 'Nombre', nombre)}
        <div class="admin-editor__cols">
          <div>
            <p class="admin-help">Sugerencia LLM (familia): ${escapeHtml(familiaSugerida.valor) || '—'} ${campoBadges(familiaSugerida)}</p>
            ${select('familia_id', 'Familia (asignar)', '', ingestFamilias, 'nombre_es', true)}
          </div>
          <div>
            <p class="admin-help">Sugerencia LLM (tipo): ${escapeHtml(tipoSugerido.valor) || '—'} ${campoBadges(tipoSugerido)}</p>
            ${select('tipo_id', 'Tipo (asignar)', '', ingestTipos, 'nombre_es', true)}
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
              .map((a) => a.valor)
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
        <div class="admin-alert">El producto se creara con activo=false. Complete precio, imagenes y publicacion desde el formulario de producto.</div>
        <button class="admin-button" type="submit">Crear como borrador</button>
      </form>
    </section>`
}

function bindIngestReview(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>('[data-add-spec]').forEach((button) => {
    button.addEventListener('click', () => {
      container.querySelector('[data-spec-rows]')?.insertAdjacentHTML('beforeend', emptySpecRow())
    })
  })
  container.querySelectorAll<HTMLButtonElement>('[data-add-aplicacion]').forEach((button) => {
    button.addEventListener('click', () => {
      container
        .querySelector('[data-aplicacion-rows]')
        ?.insertAdjacentHTML('beforeend', emptyAplicacionRow())
    })
  })
  container.addEventListener('click', (event) => {
    const target = event.target
    const removeButton =
      target instanceof HTMLElement ? target.closest<HTMLElement>('[data-remove-row]') : null
    removeButton?.closest('[data-spec-row], [data-aplicacion-row]')?.remove()
  })

  const form = container.querySelector<HTMLFormElement>('[data-ingest-review-form]')
  if (!form) return

  const nombreInput = form.elements.namedItem('nombre_es')
  if (nombreInput instanceof HTMLInputElement) {
    nombreInput.addEventListener('input', () => {
      const slugInput = form.elements.namedItem('slug')
      if (slugInput instanceof HTMLInputElement && !slugInput.value) {
        slugInput.value = slugify(nombreInput.value)
      }
    })
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const payload = ingestPayload(form)
    const { data, error } = await supabase!.from('productos').insert(payload).select('id').single()
    if (error) {
      toast(error.message)
      return
    }
    toast('Producto creado como borrador')
    location.hash = `#/producto?id=${encodeURIComponent(text((data as Row).id))}`
    await render()
  })
}

function ingestPayload(form: HTMLFormElement): Row {
  const data = new FormData(form)
  const especificaciones = Array.from(form.querySelectorAll<HTMLElement>('[data-spec-row]'))
    .map((row) => ({
      clave: text(row.querySelector<HTMLInputElement>('input[name="spec_clave"]')?.value),
      valor: text(row.querySelector<HTMLInputElement>('input[name="spec_valor"]')?.value),
      grupo: text(row.querySelector<HTMLInputElement>('input[name="spec_grupo"]')?.value),
    }))
    .filter((item) => item.clave || item.valor)
  const aplicaciones_es = Array.from(form.querySelectorAll<HTMLElement>('[data-aplicacion-row]'))
    .map((row) =>
      text(row.querySelector<HTMLInputElement>('input[name="aplicacion_valor"]')?.value)
    )
    .filter(Boolean)
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
    ficha_pdf: emptyToNull(data.get('ficha_pdf')),
    tipo_comercial: String(data.get('tipo_comercial') ?? 'equipo'),
    fulfillment_mode: String(data.get('fulfillment_mode') ?? 'cotizacion'),
    moneda: 'COP',
    destacado: false,
    nuevo: false,
    activo: false,
    orden: 0,
  }
}

async function triggerRebuild() {
  const { data, error } = await supabase!.functions.invoke('trigger-rebuild', {
    body: { reason: 'admin_publish_batch' },
  })
  const json = data as { ok?: boolean; error?: { message?: string } } | null
  toast(
    json?.ok
      ? 'Rebuild solicitado'
      : (error?.message ?? json?.error?.message ?? 'No se pudo solicitar rebuild')
  )
}

/** Genera/actualiza el embedding del producto al activarlo (Asesor RAG). No bloquea el guardado si falla. */
async function generarEmbeddingProducto(productoId: string) {
  if (!productoId) return
  const { error } = await supabase!.functions.invoke('generar-embeddings', {
    body: { producto_id: productoId },
  })
  if (error)
    toast(`Producto guardado, pero el embedding del Asesor no se actualizo: ${error.message}`)
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
    .limit(limit)
  if (error) {
    toast(error.message)
    return []
  }
  return (data ?? []) as unknown as Row[]
}

async function getRow(tableName: string, id: string): Promise<Row | null> {
  const { data, error } = await supabase!.from(tableName).select('*').eq('id', id).maybeSingle()
  if (error) {
    toast(error.message)
    return null
  }
  return (data as Row | null) ?? null
}

async function count(tableName: string, eq?: Row): Promise<number> {
  let req = supabase!.from(tableName).select('id', { count: 'exact', head: true })
  for (const [key, value] of Object.entries(eq ?? {})) req = req.eq(key, value)
  const { count: total, error } = await req
  if (error) return 0
  return total ?? 0
}

async function productosDropshipSinProveedor(): Promise<number> {
  const productos = await selectRows('productos', 'id', 'created_at', 500)
  const dropship = productos.filter((row) => row['fulfillment_mode'] === 'dropship')
  if (dropship.length === 0) return 0
  const links = await selectRows('proveedor_producto', 'producto_id', 'prioridad', 500)
  const linked = new Set(links.map((row) => text(row.producto_id)))
  return dropship.filter((row) => !linked.has(text(row.id))).length
}

function productDraft(row: Row | null): ProductoDraft {
  return {
    id: text(row?.id) || undefined,
    slug: text(row?.slug),
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
    tipo_comercial: row?.tipo_comercial === 'consumible' ? 'consumible' : 'equipo',
    fulfillment_mode:
      row?.fulfillment_mode === 'dropship' || row?.fulfillment_mode === 'individualizado'
        ? row.fulfillment_mode
        : 'cotizacion',
    precio: numberOrNull(row?.precio),
    moneda: text(row?.moneda) || 'COP',
    stock: numberOrNull(row?.stock),
    destacado: Boolean(row?.destacado),
    nuevo: Boolean(row?.nuevo),
    activo: row ? Boolean(row.activo) : false,
    orden: numberOrZero(row?.orden),
  }
}

function productPayload(form: HTMLFormElement): Row {
  const data = new FormData(form)
  let specs: unknown[]
  try {
    const parsed = JSON.parse(String(data.get('especificaciones') ?? '[]')) as unknown
    specs = Array.isArray(parsed) ? parsed : []
  } catch {
    specs = []
  }
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
    especificaciones: specs,
    aplicaciones_es: lines(data.get('aplicaciones_es')),
    aplicaciones_en: lines(data.get('aplicaciones_en')),
    imagen_principal: emptyToNull(data.get('imagen_principal')),
    ficha_pdf: emptyToNull(data.get('ficha_pdf')),
    tipo_comercial: String(data.get('tipo_comercial') ?? 'equipo'),
    fulfillment_mode: String(data.get('fulfillment_mode') ?? 'cotizacion'),
    precio: numberOrNull(data.get('precio')),
    moneda: 'COP',
    stock: numberOrNull(data.get('stock')),
    destacado:
      form.elements.namedItem('destacado') instanceof HTMLInputElement &&
      (form.elements.namedItem('destacado') as HTMLInputElement).checked,
    nuevo:
      form.elements.namedItem('nuevo') instanceof HTMLInputElement &&
      (form.elements.namedItem('nuevo') as HTMLInputElement).checked,
    activo:
      form.elements.namedItem('activo') instanceof HTMLInputElement &&
      (form.elements.namedItem('activo') as HTMLInputElement).checked,
    orden: numberOrZero(data.get('orden')),
  }
}

async function uploadFile(button: HTMLButtonElement, form: HTMLFormElement) {
  const bucket = button.dataset['upload']
  const targetName = button.dataset['target']
  if (!bucket || !targetName) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = bucket === 'fichas' ? 'application/pdf' : 'image/*'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    const path = `${Date.now()}-${slugify(file.name)}`
    const { error } = await supabase!.storage.from(bucket).upload(path, file, { upsert: false })
    if (error) {
      toast(error.message)
      return
    }
    const publicUrl = supabase!.storage.from(bucket).getPublicUrl(path).data.publicUrl
    const target = form.elements.namedItem(targetName)
    if (target instanceof HTMLInputElement) target.value = publicUrl
  })
  input.click()
}

function listWithCsv(tableName: string, rows: Row[], keys: string[], detailRoute?: string): string {
  const csvPayload = escapeHtml(JSON.stringify(rows))
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>${escapeHtml(tableName)}</h2>
        <button class="admin-button" data-csv="${csvPayload}" data-filename="${escapeHtml(tableName)}.csv" type="button">Exportar CSV</button>
      </div>
      ${table(
        [...keys, 'Acciones'],
        rows.map((row) => [
          ...keys.map((key) => formatCell(row[key])),
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
    </section>`
}

function table(headers: string[], rows: string[][]): string {
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('')}</tr></thead><tbody>${
    rows.length
      ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headers.length}">Sin registros.</td></tr>`
  }</tbody></table></div>`
}

function field(name: string, label: string, value = '', required = false, type = 'text'): string {
  return `<label class="admin-field">${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''} /></label>`
}

function textarea(name: string, label: string, value = ''): string {
  return `<label class="admin-field">${escapeHtml(label)}<textarea name="${escapeHtml(name)}">${escapeHtml(value)}</textarea></label>`
}

function checkbox(name: string, label: string, checked: boolean): string {
  return `<label class="admin-field"><span><input name="${escapeHtml(name)}" type="checkbox" ${checked ? 'checked' : ''} /> ${escapeHtml(label)}</span></label>`
}

function upload(bucket: string, target: string, label: string): string {
  return `<button class="admin-button admin-button--ghost" data-upload="${escapeHtml(bucket)}" data-target="${escapeHtml(target)}" type="button">${escapeHtml(label)}</button>`
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
    .map((row) => {
      const id = text(row.id)
      return `<option value="${escapeHtml(id)}" ${id === value ? 'selected' : ''}>${escapeHtml(text(row[labelKey]) || text(row.slug))}</option>`
    })
    .join('')}</select></label>`
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
    .join('')}</select></label>`
}

function status(value: unknown): string {
  return value
    ? '<span class="admin-badge admin-badge--ok">Activo</span>'
    : '<span class="admin-badge admin-badge--warn">Inactivo</span>'
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function formatCell(value: unknown): string {
  if (typeof value === 'boolean') return status(value)
  if (typeof value === 'object' && value !== null)
    return `<code>${escapeHtml(JSON.stringify(value))}</code>`
  return escapeHtml(text(value))
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const clean = String(value ?? '').trim()
  return clean || null
}

function numberOrNull(value: unknown): number | null {
  const clean = String(value ?? '').trim()
  if (!clean) return null
  const parsed = Number(clean)
  return Number.isFinite(parsed) ? parsed : null
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : []
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function downloadCsv(filename: string, rows: Row[]) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const csv = [
    keys.join(','),
    ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(',')),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: unknown): string {
  const raw = typeof value === 'object' && value !== null ? JSON.stringify(value) : text(value)
  return `"${raw.replaceAll('"', '""')}"`
}

function toast(message: string) {
  const node = document.createElement('div')
  node.className = 'admin-toast'
  node.textContent = message
  document.body.append(node)
  window.setTimeout(() => node.remove(), 4200)
}
