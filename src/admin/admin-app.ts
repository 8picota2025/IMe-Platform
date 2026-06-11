import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

type View =
  | 'dashboard'
  | 'productos'
  | 'producto'
  | 'taxonomia'
  | 'cotizaciones'
  | 'pedidos'
  | 'proveedores'
  | 'fulfillments'
  | 'conocimiento'
  | 'ingesta'

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

const appElement = document.getElementById('admin-app')
const supabase = getSupabaseClient()

if (!appElement) throw new Error('admin-app root missing')
const app = appElement

const state = {
  view: parseView(location.hash),
  productId: new URLSearchParams(location.hash.split('?')[1] ?? '').get('id'),
  email: '',
}

window.addEventListener('hashchange', () => {
  state.view = parseView(location.hash)
  state.productId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('id')
  void render()
})

void render()

function parseView(hash: string): View {
  const raw = hash.replace(/^#\/?/, '').split('?')[0]
  if (
    raw === 'productos' ||
    raw === 'producto' ||
    raw === 'taxonomia' ||
    raw === 'cotizaciones' ||
    raw === 'pedidos' ||
    raw === 'proveedores' ||
    raw === 'fulfillments' ||
    raw === 'conocimiento' ||
    raw === 'ingesta'
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
  if (state.view === 'pedidos') return { title: 'Pedidos', body: await pedidosView() }
  if (state.view === 'proveedores') return { title: 'Proveedores', body: await proveedoresView() }
  if (state.view === 'fulfillments')
    return { title: 'Fulfillments', body: await fulfillmentsView() }
  if (state.view === 'conocimiento') return { title: 'Conocimiento', body: conocimientoView() }
  if (state.view === 'ingesta') return { title: 'Ingesta PDF', body: ingestaView() }
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
  bindProductList()
  bindProductForm()
  bindTaxonomy()
  bindSimpleTables()
  bindIngest()
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

async function productosView(): Promise<string> {
  const rows = await selectRows('productos', '*', 'orden', 80)
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Catalogo</h2>
        <a class="admin-button" href="#/producto">Nuevo producto</a>
      </div>
      ${table(
        ['Nombre', 'Slug', 'Tipo', 'Fulfillment', 'Estado', 'Acciones'],
        rows.map((row) => [
          text(row.nombre_es),
          text(row.slug),
          text(row.tipo_comercial),
          text(row.fulfillment_mode),
          row.activo
            ? '<span class="admin-badge admin-badge--ok">Activo</span>'
            : '<span class="admin-badge admin-badge--warn">Borrador</span>',
          `<a class="admin-button admin-button--ghost" href="#/producto?id=${encodeURIComponent(text(row.id))}">Editar</a>`,
        ])
      )}
    </section>`
}

async function productoFormView(): Promise<string> {
  const [familias, tipos, producto] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
    state.productId ? getRow('productos', state.productId) : Promise.resolve(null),
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
  const [familias, tipos] = await Promise.all([
    selectRows('familias', '*', 'orden', 200),
    selectRows('tipos', '*', 'orden', 300),
  ])
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
          ['Slug', 'Nombre', 'Estado'],
          tipos.map((r) => [text(r.slug), text(r.nombre_es), status(r.activo)])
        )}
      </form>
    </section>`
}

async function cotizacionesView(): Promise<string> {
  const rows = await selectRows('solicitudes_cotizacion', '*', 'created_at', 100, false)
  return listWithCsv('solicitudes_cotizacion', rows, [
    'created_at',
    'nombre',
    'empresa',
    'email',
    'telefono',
    'leida',
  ])
}

async function pedidosView(): Promise<string> {
  const rows = await selectRows('pedidos', '*', 'created_at', 100, false)
  return listWithCsv('pedidos', rows, [
    'created_at',
    'cliente',
    'total',
    'moneda',
    'mercado',
    'estado',
    'referencia_pasarela',
    'leida',
  ])
}

async function proveedoresView(): Promise<string> {
  const rows = await selectRows('proveedores', '*', 'nombre', 100)
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
        ['Nombre', 'Canal', 'Estado'],
        rows.map((r) => [text(r.nombre), text(r.canal), status(r.activo)])
      )}
    </form>`
}

async function fulfillmentsView(): Promise<string> {
  const rows = await selectRows('fulfillments', '*', 'created_at', 100, false)
  return listWithCsv('fulfillments', rows, [
    'created_at',
    'pedido_id',
    'proveedor_id',
    'estado',
    'tracking_number',
    'error_detalle',
  ])
}

function conocimientoView(): string {
  return `<section class="admin-panel"><div class="admin-panel__head"><h2>Conocimiento</h2></div><div style="padding:16px"><div class="admin-alert">BACKLOG_V2: el CMS completo de articulos queda fuera del alcance V1. Este panel queda como stub documentado.</div></div></section>`
}

function ingestaView(): string {
  return `
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>PDF a borrador revisable</h2></div>
      <form class="admin-editor" data-ingest-form>
        <div class="admin-form">
          ${field('pdf_url', 'URL de PDF en Storage')}
          ${textarea('pdf_text', 'Texto extraido del PDF')}
          <button class="admin-button" type="submit">Extraer borrador</button>
          <div class="admin-alert">La IA solo propone. Revise campos, origen y confianza antes de crear producto.</div>
        </div>
        <aside>
          <pre class="admin-card" data-ingest-output style="white-space:pre-wrap;overflow:auto;max-height:60vh">Sin borrador.</pre>
        </aside>
      </form>
    </section>`
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
    const request = id
      ? supabase!.from('productos').update(payload).eq('id', id)
      : supabase!.from('productos').insert(payload)
    const { error } = await request
    if (error) {
      toast(error.message)
      return
    }
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
}

function bindIngest() {
  const form = app.querySelector<HTMLFormElement>('[data-ingest-form]')
  const output = app.querySelector<HTMLElement>('[data-ingest-output]')
  if (!form || !output) return
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    output.textContent = 'Extrayendo...'
    const data = new FormData(form)
    const { data: json, error } = await supabase!.functions.invoke('ingesta-pdf', {
      body: {
        pdf_url: emptyToNull(data.get('pdf_url')),
        pdf_text: emptyToNull(data.get('pdf_text')),
      },
    })
    output.textContent = JSON.stringify(error ? { error: error.message } : json, null, 2)
  })
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

function listWithCsv(tableName: string, rows: Row[], keys: string[]): string {
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
          row['leida'] === false
            ? `<button class="admin-button admin-button--ghost" data-table="${escapeHtml(tableName)}" data-mark-read="${escapeHtml(text(row.id))}" type="button">Marcar leida</button>`
            : '',
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
