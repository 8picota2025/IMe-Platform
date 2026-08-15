/**
 * Bandeja + editor de cotizaciones en `/comercial`.
 * Writes: Edge `comercial-cotizacion` con fallback PostgREST. Send: `enviar-cotizacion`.
 */
import {
  calcularTotalOfertado,
  formatQuoteMoney,
  normalizarMonedaOferta,
  ofertaCompleta,
  parseLineasOferta,
  resolveCatalogUnitPrice,
  sanitizarLineasComercial,
  type CotizacionLineaOferta,
} from '../lib/cotizacion-oferta';
import {
  callEdgeFunction,
  escapeHtml,
  formatDate,
  state,
  toast,
  trackCommercialUsage,
} from './shared';
import {
  duplicarQuote,
  getQuote,
  listQuotes,
  previewQuotePdf,
  saveQuote as persistQuote,
  searchProducts,
  type ProductHit,
  type QuotePublic,
} from './quote-api';
import {
  cotizacionesListHash,
  parseCotizacionesRoute,
  takeQuotePrefill,
  type CotizacionesRoute,
} from './quote-route';

const ERROR_COPY: Record<string, string> = {
  OFERTA_SIN_LINEAS: 'Agrega al menos un producto.',
  OFERTA_SIN_PRECIO: 'Falta el precio en alguna línea.',
  OFERTA_SIN_CONDICIONES: 'Escribe las condiciones comerciales.',
  OFERTA_MONEDA_MIXTA: 'Unifica la moneda de la oferta.',
  SIN_EMAIL: 'Email del cliente inválido.',
  SIN_NOMBRE: 'Nombre del contacto requerido.',
  SIN_TELEFONO: 'Teléfono del contacto requerido.',
  EMAIL_FALLIDO:
    'Email no salió. Cotización no marcada enviada. Usa un correo real (no @example.com).',
  TEMPLATE_INACTIVE: 'La plantilla de oferta está desactivada.',
  PDF_RENDER_FAILED: 'No se pudo generar el PDF. Reintenta o usa Descargar/Abrir en pestaña.',
  SEND_IN_FLIGHT: 'Hay un envío en curso. Espera y reintenta.',
  COTIZACION_INMUTABLE: 'Esta cotización ya no se edita. Crea una revisión.',
  CONCURRENT_UPDATE: 'Otro comercial guardó esta oferta. Recarga.',
  COTIZACION_YA_CONVERTIDA: 'Ya se convirtió en pedido.',
};

let navGuard: (() => boolean) | null = null;
let dirty = false;

export function quoteNavigationAllowed(): boolean {
  if (!navGuard) return true;
  return navGuard();
}

function setDirty(value: boolean): void {
  dirty = value;
}

function confirmLeave(): boolean {
  if (!dirty) return true;
  return window.confirm('Hay cambios sin guardar. ¿Salir de la cotización?');
}

function errMsg(code?: string, fallback?: string): string {
  if (code && ERROR_COPY[code]) return ERROR_COPY[code]!;
  return fallback || 'No se pudo completar la operación.';
}

function estadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    nueva: 'Nueva',
    en_revision: 'En revisión',
    respondida: 'Respondida',
    enviada: 'Enviada',
    convertida: 'Convertida',
    expirada: 'Expirada',
  };
  return labels[estado] ?? estado;
}

function estadoBadge(estado: string): string {
  const kind =
    estado === 'enviada' || estado === 'convertida'
      ? 'ok'
      : estado === 'expirada'
        ? 'warn'
        : estado === 'nueva'
          ? 'muted'
          : 'warn';
  return `<span class="comercial-badge comercial-badge--status-${kind}">${escapeHtml(estadoLabel(estado))}</span>`;
}

function emptyLine(moneda: 'COP' | 'USD'): CotizacionLineaOferta {
  return { slug: '', nombre: '', cantidad: 1, precio_unitario: 0, subtotal: 0, moneda };
}

export async function renderCotizacionesView(): Promise<string> {
  const route = parseCotizacionesRoute(location.hash);
  if (route.mode === 'list') return renderList(route);
  return renderEditor(route);
}

async function renderList(route: CotizacionesRoute): Promise<string> {
  const query: Record<string, string> = {
    tab: route.tab,
    page: String(route.page),
  };
  if (route.equipo) query['equipo'] = '1';
  if (route.q) query['q'] = route.q;

  const { data, error } = await listQuotes(query);

  if (error) {
    return `<section class="comercial-panel"><div class="comercial-state comercial-state--empty"><p>No fue posible cargar cotizaciones.</p><p class="comercial-help">${escapeHtml(error)}</p><button class="comercial-button comercial-button--ghost" type="button" data-view-retry>Reintentar</button></div></section>`;
  }

  const rows = data?.quotes ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pendientesHref = cotizacionesListHash({ equipo: route.equipo, q: route.q });
  const enviadasHref = cotizacionesListHash({ tab: 'enviadas', equipo: route.equipo, q: route.q });
  const miasHref = cotizacionesListHash({ tab: route.tab, q: route.q });
  const equipoHref = cotizacionesListHash({ tab: route.tab, equipo: true, q: route.q });

  const toolbar = `
    <div class="comercial-quote-toolbar">
      <div class="comercial-quote-tabs" role="tablist" aria-label="Bandeja de cotizaciones">
        <a class="comercial-nav-link${route.tab === 'pendientes' ? ' comercial-nav-link--active' : ''}" href="${escapeHtml(pendientesHref)}" ${route.tab === 'pendientes' ? 'aria-current="page"' : ''}>Pendientes</a>
        <a class="comercial-nav-link${route.tab === 'enviadas' ? ' comercial-nav-link--active' : ''}" href="${escapeHtml(enviadasHref)}" ${route.tab === 'enviadas' ? 'aria-current="page"' : ''}>Enviadas</a>
      </div>
      <div class="comercial-quote-toolbar__actions">
        <a class="comercial-button ${route.equipo ? 'comercial-button--ghost' : 'comercial-button--primary'}" href="${escapeHtml(miasHref)}">Mías</a>
        <a class="comercial-button ${route.equipo ? 'comercial-button--primary' : 'comercial-button--ghost'}" href="${escapeHtml(equipoHref)}">Equipo</a>
        <a class="comercial-button comercial-button--primary" href="#/cotizaciones/nueva">Nueva</a>
      </div>
    </div>
    <form class="comercial-toolbar comercial-quote-search" data-quote-search>
      <input class="comercial-input" type="search" name="q" value="${escapeHtml(route.q)}" placeholder="Buscar número, empresa, contacto o email" aria-label="Buscar cotizaciones" />
      <button class="comercial-button" type="submit">Buscar</button>
      ${route.q ? `<a class="comercial-button comercial-button--ghost" href="${escapeHtml(cotizacionesListHash({ tab: route.tab, equipo: route.equipo }))}">Limpiar</a>` : ''}
    </form>`;

  if (rows.length === 0) {
    const empty = route.q
      ? `<p>Sin resultados.</p><a class="comercial-button comercial-button--ghost" href="${escapeHtml(cotizacionesListHash({ tab: route.tab, equipo: route.equipo }))}">Limpiar</a>`
      : `<p>Aún no hay presupuestos formales.</p><a class="comercial-button comercial-button--primary" href="#/cotizaciones/nueva">Nuevo presupuesto</a><p class="comercial-help">Info/catálogo por WhatsApp o email: usa Catálogo → Enviar info.${!route.equipo ? ' Cambia a Equipo para ver solicitudes web.' : ''}</p>`;
    return `<section class="comercial-panel"><div class="comercial-panel__head"><h2>Presupuestos formales</h2><p class="comercial-help">PDF + email al cliente. Distinto de Envíos info (enlaces/catálogo).</p></div>${toolbar}<div class="comercial-state comercial-state--empty">${empty}</div></section>`;
  }

  const pager =
    totalPages > 1
      ? `<nav class="comercial-pager" aria-label="Paginación cotizaciones">
          ${route.page > 1 ? `<a class="comercial-button comercial-button--ghost" href="${escapeHtml(cotizacionesListHash({ tab: route.tab, equipo: route.equipo, q: route.q, page: route.page - 1 }))}">Anterior</a>` : ''}
          <span class="comercial-help">Página ${route.page} / ${totalPages}</span>
          ${route.page < totalPages ? `<a class="comercial-button comercial-button--ghost" href="${escapeHtml(cotizacionesListHash({ tab: route.tab, equipo: route.equipo, q: route.q, page: route.page + 1 }))}">Siguiente</a>` : ''}
        </nav>`
      : '';

  const table = `
    <div class="comercial-table-wrap">
      <table class="comercial-table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Comercial</th>
            <th>Origen</th>
            <th>Actualizada</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              row => `
            <tr>
              <td>${escapeHtml(row.numero || 'Borrador')}</td>
              <td>${escapeHtml(row.empresa || row.nombre)}${row.incompleta ? ' <span class="comercial-badge comercial-badge--status-warn">Precio incompleto</span>' : ''}${row.estado === 'expirada' ? ' <span class="comercial-badge comercial-badge--status-warn">Expirada</span>' : ''}</td>
              <td>${estadoBadge(row.estado)}</td>
              <td>${escapeHtml(formatQuoteMoney(row.precio_total_ofertado, row.moneda))}</td>
              <td>${escapeHtml(row.created_by_nombre || '—')}</td>
              <td>${row.origen === 'pwa' ? 'PWA' : 'Web'}</td>
              <td>${escapeHtml(formatDate(row.updated_at || row.created_at))}</td>
              <td><a class="comercial-button comercial-button--primary comercial-button--sm" href="#/cotizaciones?id=${escapeHtml(row.id)}">Abrir</a></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;

  return `<section class="comercial-panel"><div class="comercial-panel__head"><h2>Presupuestos formales (${total})</h2><p class="comercial-help">PDF + email al cliente. Distinto de Envíos info (enlaces/catálogo).</p></div>${toolbar}${table}${pager}</section>`;
}

async function renderEditor(route: CotizacionesRoute): Promise<string> {
  let quote: QuotePublic;
  if (route.mode === 'edit' && route.id) {
    const { data, error } = await getQuote(route.id);
    if (error || !data?.quote) {
      return `<section class="comercial-panel"><div class="comercial-state comercial-state--empty"><p>Cotización no encontrada.</p><a class="comercial-button comercial-button--ghost" href="#/cotizaciones">Volver</a></div></section>`;
    }
    quote = data.quote;
  } else {
    const prefill = takeQuotePrefill();
    const monedaPrefill =
      prefill.find(l => (l.precio_unitario ?? 0) > 0)?.moneda ??
      prefill.find(l => l.moneda)?.moneda ??
      'COP';
    const productos = prefill.map(l => {
      const precio = Number(l.precio_unitario ?? 0) > 0 ? Number(l.precio_unitario) : 0;
      const cantidad = l.cantidad;
      return {
        slug: l.slug,
        nombre: l.nombre,
        cantidad,
        precio_unitario: precio,
        subtotal: Math.round(precio * cantidad * 100) / 100,
        moneda: l.moneda || monedaPrefill,
      };
    });
    quote = {
      id: '',
      numero: null,
      estado: 'nueva',
      nombre: '',
      empresa: '',
      email: '',
      telefono: '',
      moneda: monedaPrefill,
      validez_hasta: null,
      condiciones: '',
      productos,
      precio_total_ofertado: calcularTotalOfertado(productos),
      updated_at: null,
      created_at: null,
      pdf_storage_path: null,
      pdf_revision: 0,
      send_error: null,
      crm_sync_status: null,
      created_by: state.userId,
      created_by_nombre: state.nombre,
      pedido_id: null,
      incompleta: true,
      origen: 'pwa',
      editable: true,
    };
  }

  const editable = quote.editable;
  const disabled = editable ? '' : 'disabled';
  const convertida = quote.estado === 'convertida' || Boolean(quote.pedido_id);
  const banner = convertida
    ? `<div class="comercial-quote-banner" role="status">Pedido en /admin — no editar.</div>`
    : quote.estado === 'expirada'
      ? `<div class="comercial-quote-banner" role="status">Vencida. Duplica a borrador para cotizar de nuevo.</div>`
      : quote.estado === 'enviada'
        ? `<div class="comercial-quote-banner" role="status">${escapeHtml(quote.numero || 'IME-Q')} enviada. El PDF anterior queda en archivo.</div>`
        : quote.send_error
          ? `<div class="comercial-quote-banner comercial-quote-banner--error" role="alert">${escapeHtml(quote.send_error)}</div>`
          : '';

  return `
    <section class="comercial-panel comercial-quote-editor" data-quote-editor data-quote-id="${escapeHtml(quote.id)}" data-updated-at="${escapeHtml(quote.updated_at ?? '')}" data-estado="${escapeHtml(quote.estado)}">
      <div class="comercial-panel__head">
        <div>
          <h2>${escapeHtml(quote.numero || 'Nuevo presupuesto')}</h2>
          <p class="comercial-help">${estadoBadge(quote.estado)} · ${escapeHtml(formatQuoteMoney(quote.precio_total_ofertado, quote.moneda))}</p>
        </div>
        <a class="comercial-button comercial-button--ghost" href="#/cotizaciones">Bandeja</a>
      </div>
      ${banner}
      <form class="comercial-form comercial-quote-form" data-quote-form>
        <div class="comercial-field-row">
          <label class="comercial-field"><span>Nombre del contacto</span><input name="nombre" type="text" required minlength="2" autocomplete="name" value="${escapeHtml(quote.nombre)}" ${disabled} /></label>
          <label class="comercial-field"><span>Empresa</span><input name="empresa" type="text" autocomplete="organization" value="${escapeHtml(quote.empresa ?? '')}" ${disabled} /></label>
        </div>
        <div class="comercial-field-row">
          <label class="comercial-field"><span>Email</span><input name="email" type="email" required autocomplete="email" value="${escapeHtml(quote.email)}" ${disabled} /></label>
          <label class="comercial-field"><span>Teléfono</span><input name="telefono" type="tel" required autocomplete="tel" value="${escapeHtml(quote.telefono)}" ${disabled} /></label>
        </div>
        <div class="comercial-field-row">
          <label class="comercial-field"><span>Moneda</span>
            <select name="moneda" data-quote-moneda ${disabled}>
              <option value="COP" ${quote.moneda === 'COP' ? 'selected' : ''}>COP</option>
              <option value="USD" ${quote.moneda === 'USD' ? 'selected' : ''}>USD</option>
            </select>
          </label>
          <label class="comercial-field"><span>Validez</span><input name="validez_hasta" type="date" value="${escapeHtml(quote.validez_hasta ?? '')}" ${disabled} /></label>
        </div>
        ${editable ? comboboxHtml() : ''}
        <div data-quote-lines>${linesHtml(quote.productos, quote.moneda, editable)}</div>
        <p class="comercial-quote-total" data-quote-total>Total ${escapeHtml(formatQuoteMoney(calcularTotalOfertado(quote.productos), quote.moneda))}</p>
        <label class="comercial-field"><span>Condiciones</span><textarea name="condiciones" rows="6" ${disabled}>${escapeHtml(quote.condiciones)}</textarea></label>
        <p class="comercial-help" data-quote-hint role="status"></p>
      </form>
      <div class="comercial-quote-footer">
        ${
          editable
            ? `<button class="comercial-button comercial-button--ghost" type="button" data-quote-save>Guardar</button>
               <button class="comercial-button comercial-button--ghost" type="button" data-quote-preview>Vista previa</button>
               <button class="comercial-button comercial-button--primary comercial-quote-send" type="button" data-quote-send>Enviar presupuesto</button>`
            : `<button class="comercial-button comercial-button--ghost" type="button" data-quote-preview>Abrir PDF</button>
               ${quote.estado === 'enviada' ? `<button class="comercial-button comercial-button--primary" type="button" data-quote-duplicar>Nueva revisión</button>` : ''}
               ${quote.estado === 'expirada' ? `<button class="comercial-button comercial-button--primary" type="button" data-quote-duplicar>Duplicar a borrador</button>` : ''}`
        }
      </div>
      ${editable ? `<p class="comercial-help comercial-quote-send-copy"><strong>Presupuesto formal:</strong> PDF + email a <span data-quote-email-copy>${escapeHtml(quote.email || '…')}</span>. <strong>Info/enlaces WhatsApp o email:</strong> Catálogo → Enviar info (no este formulario).</p>` : ''}
    </section>
    <div data-quote-modal-slot></div>`;
}

function comboboxHtml(): string {
  return `
    <div class="comercial-quote-combobox" data-quote-combobox>
      <label class="comercial-field">
        <span>Buscar producto</span>
        <input type="search" data-quote-search-product autocomplete="off" placeholder="Escribe al menos 2 caracteres" aria-autocomplete="list" aria-controls="quote-product-list" />
      </label>
      <ul id="quote-product-list" class="comercial-quote-suggest" data-quote-suggest hidden role="listbox"></ul>
      <button class="comercial-button comercial-button--ghost" type="button" data-quote-add-free>Añadir línea libre</button>
    </div>`;
}

function linesHtml(
  lineas: CotizacionLineaOferta[],
  moneda: 'COP' | 'USD',
  editable: boolean
): string {
  const disabled = editable ? '' : 'disabled';
  const rows =
    lineas.length === 0
      ? `<p class="comercial-help">Sin productos. Busca en catálogo o añade una línea libre.</p>`
      : lineas
          .map((l, index) => {
            const missing = !(l.precio_unitario > 0);
            return `
        <article class="comercial-quote-line" data-quote-line data-index="${index}">
          <div class="comercial-quote-line__name">
            <input class="comercial-input" data-linea-nombre value="${escapeHtml(l.nombre)}" placeholder="Nombre del producto" aria-label="Nombre" ${disabled} />
            <input class="comercial-input" data-linea-slug value="${escapeHtml(l.slug)}" placeholder="SKU (opcional)" aria-label="SKU" ${disabled} />
            ${missing ? '<span class="comercial-badge comercial-badge--status-warn">Sin precio</span>' : ''}
          </div>
          <label class="comercial-field"><span>Cantidad</span>
            <input class="comercial-input comercial-quote-qty" data-linea-cantidad type="number" min="1" step="1" value="${l.cantidad}" ${disabled} />
          </label>
          <label class="comercial-field"><span>Precio (${escapeHtml(moneda)})</span>
            <input class="comercial-input" data-linea-precio type="number" min="0" step="${moneda === 'USD' ? '0.01' : '1'}" value="${l.precio_unitario}" ${disabled} />
          </label>
          <p class="comercial-quote-line__subtotal" data-linea-subtotal>${escapeHtml(formatQuoteMoney(l.subtotal, moneda))}</p>
          ${editable ? `<button class="comercial-button comercial-button--ghost" type="button" data-linea-eliminar aria-label="Eliminar ${escapeHtml(l.nombre || 'línea')}">Eliminar</button>` : ''}
        </article>`;
          })
          .join('');
  return `<div class="comercial-quote-lines">${rows}</div>`;
}

function readForm(root: HTMLElement): {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  moneda: 'COP' | 'USD';
  validez_hasta: string | null;
  condiciones: string;
  productos: CotizacionLineaOferta[];
} {
  const form = root.querySelector<HTMLFormElement>('[data-quote-form]');
  const data = form ? new FormData(form) : new FormData();
  const moneda = String(data.get('moneda') ?? 'COP') === 'USD' ? 'USD' : 'COP';
  const productos: CotizacionLineaOferta[] = [];
  root.querySelectorAll<HTMLElement>('[data-quote-line]').forEach(row => {
    const nombre = row.querySelector<HTMLInputElement>('[data-linea-nombre]')?.value.trim() ?? '';
    const slug = row.querySelector<HTMLInputElement>('[data-linea-slug]')?.value.trim() ?? '';
    const cantidad = Math.max(
      1,
      Math.floor(Number(row.querySelector<HTMLInputElement>('[data-linea-cantidad]')?.value) || 1)
    );
    const precio = Number(row.querySelector<HTMLInputElement>('[data-linea-precio]')?.value) || 0;
    if (!nombre && !slug) return;
    productos.push({
      slug,
      nombre: nombre || slug,
      cantidad,
      precio_unitario: precio,
      subtotal: Math.round(precio * cantidad * 100) / 100,
      moneda,
    });
  });
  return {
    nombre: String(data.get('nombre') ?? '').trim(),
    empresa: String(data.get('empresa') ?? '').trim(),
    email: String(data.get('email') ?? '').trim(),
    telefono: String(data.get('telefono') ?? '').trim(),
    moneda,
    validez_hasta: String(data.get('validez_hasta') ?? '').trim() || null,
    condiciones: String(data.get('condiciones') ?? '').trim(),
    productos: sanitizarLineasComercial(productos, moneda),
  };
}

function refreshTotals(root: HTMLElement): void {
  const parsed = readForm(root);
  const total = calcularTotalOfertado(parsed.productos);
  const totalEl = root.querySelector('[data-quote-total]');
  if (totalEl) totalEl.textContent = `Total ${formatQuoteMoney(total, parsed.moneda)}`;
  const emailCopy = root.querySelector('[data-quote-email-copy]');
  if (emailCopy) emailCopy.textContent = parsed.email || '…';
  root.querySelectorAll<HTMLElement>('[data-quote-line]').forEach(row => {
    const cantidad = Math.max(
      1,
      Math.floor(Number(row.querySelector<HTMLInputElement>('[data-linea-cantidad]')?.value) || 1)
    );
    const precio = Number(row.querySelector<HTMLInputElement>('[data-linea-precio]')?.value) || 0;
    const cell = row.querySelector('[data-linea-subtotal]');
    if (cell) cell.textContent = formatQuoteMoney(precio * cantidad, parsed.moneda);
  });
  const hint = root.querySelector('[data-quote-hint]');
  const check = ofertaCompleta(parseLineasOferta(parsed.productos), parsed.condiciones);
  if (hint) {
    hint.textContent = check.ok ? '' : errMsg(check.error);
  }
}

async function saveQuote(root: HTMLElement): Promise<QuotePublic | null> {
  const form = root.querySelector<HTMLFormElement>('[data-quote-form]');
  if (form && !form.reportValidity()) return null;
  const parsed = readForm(root);
  const id = root.getAttribute('data-quote-id') || '';
  const updatedAt = root.getAttribute('data-updated-at') || '';
  const saveBtn = root.querySelector<HTMLButtonElement>('[data-quote-save]');
  if (saveBtn) saveBtn.disabled = true;
  const { data, error, code } = await persistQuote({
    ...(id ? { id, updated_at: updatedAt || null } : {}),
    ...parsed,
  });
  if (saveBtn) saveBtn.disabled = false;
  if (error || !data?.quote) {
    toast(errMsg(code, error ?? undefined), 'error');
    return null;
  }
  setDirty(false);
  toast(`Guardada ${data.quote.numero || data.quote.id.slice(0, 8)}`.trim(), 'success');
  return data.quote;
}

function applySaved(root: HTMLElement, quote: QuotePublic): void {
  root.setAttribute('data-quote-id', quote.id);
  root.setAttribute('data-updated-at', quote.updated_at ?? '');
  root.setAttribute('data-estado', quote.estado);
  const title = root.querySelector('h2');
  if (title) title.textContent = quote.numero || 'Nuevo presupuesto';
  if (quote.id && !location.hash.includes(quote.id)) {
    history.replaceState(null, '', `#/cotizaciones?id=${encodeURIComponent(quote.id)}`);
  }
}

function htmlPreview(root: HTMLElement): string {
  const parsed = readForm(root);
  const total = calcularTotalOfertado(parsed.productos);
  const rows =
    parsed.productos.length === 0
      ? '<tr><td colspan="4">Sin líneas</td></tr>'
      : parsed.productos
          .map(
            l => `<tr>
              <td>${escapeHtml(l.nombre)}</td>
              <td>${l.cantidad}</td>
              <td>${escapeHtml(formatQuoteMoney(l.precio_unitario, parsed.moneda))}</td>
              <td>${escapeHtml(formatQuoteMoney(l.subtotal, parsed.moneda))}</td>
            </tr>`
          )
          .join('');
  return `
    <article class="comercial-presupuesto-preview">
      <header>
        <p class="comercial-eyebrow">I-ME · Plantilla Presupuesto</p>
        <h3>Presupuesto para ${escapeHtml(parsed.nombre)}</h3>
        <p class="comercial-help">${escapeHtml(parsed.empresa || 'Sin empresa')} · ${escapeHtml(parsed.email)} · ${escapeHtml(parsed.telefono)}</p>
        <p class="comercial-help">Asesor: ${escapeHtml(state.nombre || state.email || '—')}${state.telefono ? ` · ${escapeHtml(state.telefono)}` : ''}</p>
      </header>
      <table class="comercial-table">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="comercial-quote-total">Total ${escapeHtml(formatQuoteMoney(total, parsed.moneda))}</p>
      ${parsed.condiciones ? `<pre class="comercial-quote-preview-terms">${escapeHtml(parsed.condiciones)}</pre>` : '<p class="comercial-help">Sin condiciones.</p>'}
    </article>`;
}

async function previewPdf(root: HTMLElement): Promise<void> {
  const id = root.getAttribute('data-quote-id') || '';
  if (!id) {
    toast('Guarda la cotización antes de previsualizar.', 'error');
    return;
  }
  if (dirty) {
    const saved = await saveQuote(root);
    if (!saved) return;
    applySaved(root, saved);
  }
  const parsed = readForm(root);
  const slot = root.parentElement?.querySelector('[data-quote-modal-slot]');
  if (!slot) return;
  slot.innerHTML = `<div class="comercial-modal-overlay" data-pdf-overlay><div class="comercial-modal comercial-modal--wide" role="dialog" aria-modal="true" aria-labelledby="quote-pdf-title"><header class="comercial-modal__header"><h2 id="quote-pdf-title">Vista previa · Presupuesto</h2><button class="comercial-modal__close" type="button" data-pdf-close aria-label="Cerrar">✕</button></header><div class="comercial-modal__body"><p>Generando PDF…</p></div></div></div>`;
  const title = root.querySelector('h2')?.textContent;
  const snapshot = title?.startsWith('IME-Q') ? { ...parsed, numero: title } : parsed;
  const { data, error, code } = await previewQuotePdf(id, snapshot);
  const body = slot.querySelector('.comercial-modal__body');
  if (!body) return;
  slot.querySelector('[data-pdf-close]')?.addEventListener('click', () => {
    slot.innerHTML = '';
  });
  slot.querySelector('[data-pdf-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) slot.innerHTML = '';
  });
  if (!error && data?.pdf_base64) {
    try {
      const binary = atob(data.pdf_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      body.innerHTML = `
        <div class="comercial-quote-pdf-actions">
          <a class="comercial-button comercial-button--primary comercial-button--sm" href="${url}" download="${escapeHtml(data.numero || 'presupuesto')}.pdf">Descargar PDF</a>
          <a class="comercial-button comercial-button--ghost comercial-button--sm" href="${url}" target="_blank" rel="noopener noreferrer">Abrir en pestaña</a>
        </div>
        <object class="comercial-quote-pdf" type="application/pdf" data="${url}" title="Presupuesto ${escapeHtml(data.numero)}">
          <p class="comercial-help">Tu navegador no embebe PDF. Usa Descargar o Abrir en pestaña.</p>
        </object>
        <p class="comercial-help">Plantilla <strong>Presupuesto</strong> · ${escapeHtml(data.numero)} · Asesor: ${escapeHtml(state.nombre || state.email || '—')}</p>`;
      return;
    } catch (err) {
      console.error('quote pdf preview decode failed', err);
    }
  }
  body.innerHTML = htmlPreview(root);
  toast(errMsg(code, error ?? 'No se pudo mostrar el PDF.'), 'error');
}

export function bindCotizacionesView(container: HTMLElement): () => void {
  navGuard = confirmLeave;
  dirty = false;
  const editor = container.querySelector<HTMLElement>('[data-quote-editor]');

  const onSearchSubmit = (event: Event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const q = String(new FormData(form).get('q') ?? '').trim();
    const route = parseCotizacionesRoute(location.hash);
    location.hash = cotizacionesListHash({ tab: route.tab, equipo: route.equipo, q });
  };
  container.querySelector('[data-quote-search]')?.addEventListener('submit', onSearchSubmit);

  if (!editor) {
    return () => {
      navGuard = null;
    };
  }

  const onFormInput = () => {
    setDirty(true);
    refreshTotals(editor);
    const email = editor.querySelector<HTMLInputElement>('[name="email"]')?.value ?? '';
    const copy = editor.querySelector('[data-quote-email-copy]');
    if (copy) copy.textContent = email.trim() || '…';
  };
  editor.addEventListener('input', onFormInput);
  editor.addEventListener('change', onFormInput);

  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-linea-eliminar]')) {
      target.closest('[data-quote-line]')?.remove();
      setDirty(true);
      refreshTotals(editor);
      return;
    }
    if (target.closest('[data-quote-add-free]')) {
      const moneda =
        editor.querySelector<HTMLSelectElement>('[data-quote-moneda]')?.value === 'USD'
          ? 'USD'
          : 'COP';
      const slot = editor.querySelector('[data-quote-lines]');
      const current = readForm(editor).productos;
      current.push(emptyLine(moneda));
      if (slot) slot.innerHTML = linesHtml(current, moneda, true);
      setDirty(true);
      refreshTotals(editor);
      return;
    }
  };
  editor.addEventListener('click', onClick);

  const persistFromEditor = async () => {
    const saved = await saveQuote(editor);
    if (saved) applySaved(editor, saved);
  };
  editor
    .querySelector('[data-quote-save]')
    ?.addEventListener('click', () => void persistFromEditor());
  editor.querySelector('[data-quote-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    void persistFromEditor();
  });

  editor
    .querySelector('[data-quote-preview]')
    ?.addEventListener('click', () => void previewPdf(editor));

  editor.querySelector('[data-quote-send]')?.addEventListener('click', async () => {
    const parsed = readForm(editor);
    const check = ofertaCompleta(parsed.productos, parsed.condiciones);
    if (!check.ok) {
      toast(errMsg(check.error), 'error');
      return;
    }
    let id = editor.getAttribute('data-quote-id') || '';
    if (dirty || !id) {
      const saved = await saveQuote(editor);
      if (!saved) return;
      applySaved(editor, saved);
      id = saved.id;
    }
    if (/@example\.com$/i.test(parsed.email)) {
      toast('Usa un correo real del cliente. Resend rechaza @example.com.', 'error');
      return;
    }
    const numero = editor.querySelector('h2')?.textContent ?? 'IME-Q';
    const ok = window.confirm(
      `¿Enviar presupuesto ${numero} a ${parsed.email} por ${formatQuoteMoney(calcularTotalOfertado(parsed.productos), parsed.moneda)}?`
    );
    if (!ok) return;
    const sendBtn = editor.querySelector<HTMLButtonElement>('[data-quote-send]');
    const saveBtn = editor.querySelector<HTMLButtonElement>('[data-quote-save]');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando presupuesto…';
    }
    if (saveBtn) saveBtn.disabled = true;
    const { data, error, code } = await callEdgeFunction<{
      numero?: string;
      ok?: boolean;
      crm_sync_status?: string;
    }>('enviar-cotizacion', {
      method: 'POST',
      body: {
        cotizacion_id: id,
        productos: parsed.productos,
        condiciones: parsed.condiciones,
        moneda: parsed.moneda,
        validez_hasta: parsed.validez_hasta,
        mercado: parsed.moneda === 'USD' ? 'INTL' : 'CO',
      },
    });
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Enviar presupuesto';
    }
    if (saveBtn) saveBtn.disabled = false;
    if (error) {
      const alert = editor.querySelector('[data-quote-hint]');
      if (alert) {
        alert.setAttribute('role', 'alert');
        alert.textContent = errMsg(code, error);
      }
      toast(errMsg(code, error), 'error');
      return;
    }
    const crmNote =
      data?.crm_sync_status === 'synced'
        ? ' CRM sincronizado.'
        : data?.crm_sync_status === 'failed'
          ? ' Aviso: CRM no sincronizó.'
          : data?.crm_sync_status === 'skipped'
            ? ' CRM omitido (sin secrets).'
            : '';
    toast(`Presupuesto ${String(data?.numero ?? numero)} enviado.${crmNote}`, 'success');
    trackCommercialUsage('share_succeeded', { result: 'quote_sent' }, 'cotizaciones');
    setDirty(false);
    const next = `#/cotizaciones?id=${encodeURIComponent(id)}`;
    if (location.hash === next) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      location.hash = next;
    }
  });

  editor.querySelector('[data-quote-duplicar]')?.addEventListener('click', async () => {
    const id = editor.getAttribute('data-quote-id') || '';
    if (!id) return;
    if (
      !window.confirm(
        'Esto crea una revisión nueva. El PDF anterior queda en archivo. El cliente recibirá un correo nuevo si envías.'
      )
    ) {
      return;
    }
    const { data, error, code } = await duplicarQuote(id);
    if (error || !data?.quote) {
      toast(errMsg(code, error ?? undefined), 'error');
      return;
    }
    setDirty(false);
    location.hash = `#/cotizaciones?id=${encodeURIComponent(data.quote.id)}`;
  });

  const searchInput = editor.querySelector<HTMLInputElement>('[data-quote-search-product]');
  const suggest = editor.querySelector<HTMLElement>('[data-quote-suggest]');
  let activeIndex = -1;
  let hits: ProductHit[] = [];
  let searchTimer = 0;

  async function runSearch(q: string): Promise<void> {
    if (q.trim().length < 2 || !suggest) {
      hits = [];
      if (suggest) {
        suggest.hidden = true;
        suggest.innerHTML = '';
      }
      return;
    }
    hits = await searchProducts(q.trim());
    suggest.hidden = hits.length === 0;
    suggest.innerHTML = hits
      .map((p, i) => {
        const unit = resolveCatalogUnitPrice(p);
        const precio =
          unit > 0
            ? ` <span class="comercial-help">${escapeHtml(formatQuoteMoney(unit, normalizarMonedaOferta(p.moneda)))}</span>`
            : '';
        return `<li role="option" data-hit="${i}" class="comercial-quote-suggest__item">${escapeHtml(p.nombre_es)}${p.sku ? ` <span class="comercial-help">${escapeHtml(p.sku)}</span>` : ''}${precio}</li>`;
      })
      .join('');
    activeIndex = -1;
  }

  const addHit = (hit: ProductHit) => {
    const monedaSelect =
      editor.querySelector<HTMLSelectElement>('[data-quote-moneda]')?.value === 'USD'
        ? 'USD'
        : 'COP';
    const precio = resolveCatalogUnitPrice(hit);
    const monedaLinea = precio > 0 ? normalizarMonedaOferta(hit.moneda) : monedaSelect;
    // Si el presupuesto aún no tiene moneda forzada por líneas, alinear al catálogo.
    const monedaSelectEl = editor.querySelector<HTMLSelectElement>('[data-quote-moneda]');
    if (precio > 0 && monedaSelectEl && monedaSelectEl.value !== monedaLinea) {
      const current = readForm(editor).productos;
      if (current.every(l => !(l.precio_unitario > 0))) {
        monedaSelectEl.value = monedaLinea;
      }
    }
    const moneda =
      editor.querySelector<HTMLSelectElement>('[data-quote-moneda]')?.value === 'USD'
        ? 'USD'
        : 'COP';
    const current = readForm(editor).productos;
    current.push({
      slug: hit.slug,
      nombre: hit.nombre_es,
      cantidad: 1,
      precio_unitario: precio,
      subtotal: precio,
      moneda,
    });
    const slot = editor.querySelector('[data-quote-lines]');
    if (slot) slot.innerHTML = linesHtml(current, moneda, true);
    setDirty(true);
    refreshTotals(editor);
    if (suggest) {
      suggest.hidden = true;
      suggest.innerHTML = '';
    }
    if (searchInput) searchInput.value = '';
  };

  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void runSearch(searchInput.value), 220);
  });
  searchInput?.addEventListener('keydown', event => {
    if (!suggest || suggest.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(hits.length - 1, activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0 && hits[activeIndex]) {
      event.preventDefault();
      addHit(hits[activeIndex]!);
      return;
    } else if (event.key === 'Escape') {
      suggest.hidden = true;
      return;
    } else {
      return;
    }
    suggest.querySelectorAll('[data-hit]').forEach((el, i) => {
      el.classList.toggle('is-active', i === activeIndex);
    });
  });
  suggest?.addEventListener('click', event => {
    const li = (event.target as Element).closest<HTMLElement>('[data-hit]');
    if (!li) return;
    const hit = hits[Number(li.getAttribute('data-hit'))];
    if (hit) addHit(hit);
  });

  const onDocClick = (event: Event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
    if (
      t.closest('[data-pdf-close]') ||
      (t.classList.contains('comercial-modal-overlay') && t.hasAttribute('data-pdf-overlay'))
    ) {
      container.querySelector('[data-quote-modal-slot]')?.replaceChildren();
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      container.querySelector('[data-quote-modal-slot]')?.replaceChildren();
    }
  };
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  const first = editor.querySelector<HTMLInputElement>('[name="nombre"]');
  if (editor.getAttribute('data-quote-id') === '') first?.focus();
  refreshTotals(editor);

  return () => {
    navGuard = null;
    dirty = false;
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
