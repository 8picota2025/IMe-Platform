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
import { defaultCondicionesOferta } from '../lib/condiciones-oferta';
import {
  callEdgeFunction,
  escapeHtml,
  esRolAdmin,
  formatDate,
  state,
  toast,
  trackCommercialUsage,
} from './shared';
import {
  deleteQuote,
  duplicarQuote,
  getQuote,
  listQuotes,
  previewQuotePdf,
  saveQuote as persistQuote,
  searchProducts,
  validarQuoteCrm,
  type ProductHit,
  type QuotePublic,
} from './quote-api';
import { ocrPresupuestoCompetencia, pickCompetenciaImage, compressImageForOcr } from './quote-ocr';
import {
  cotizacionesListHash,
  parseCotizacionesRoute,
  takeQuotePrefill,
  type CotizacionesRoute,
} from './quote-route';

const ERROR_COPY: Record<string, string> = {
  OFERTA_SIN_LINEAS: 'Agrega al menos un producto.',
  OFERTA_SIN_PRECIO: 'Falta el precio en alguna línea.',
  PRECIO_PENDIENTE: 'Hay líneas en Pendiente validar. Asigna precio antes de validar al CRM.',
  CRM_SYNC_FAILED: 'No se pudo sincronizar con el CRM.',
  QUOTE_LOCKED: 'No se puede borrar un presupuesto convertido a pedido.',
  FORBIDDEN: 'No tienes permiso para esta acción.',
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
  OCR_FAILED: 'OCR falló (moondream/Ollama). Revisa que el puente local esté activo.',
  OCR_EMPTY: 'No se detectaron datos. Prueba otra foto más nítida.',
  INTERNAL_ERROR: 'Error interno del servidor. Reintenta; si sigue, avisa a sistemas.',
  STORAGE_FAILED: 'No se pudo guardar la foto del presupuesto.',
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
  if (route.mode === 'escanear') return renderScanView();
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
        <a class="comercial-nav-link" href="#/cotizaciones/escanear">Escanear</a>
      </div>
      <div class="comercial-quote-toolbar__actions">
        <a class="comercial-button ${route.equipo ? 'comercial-button--ghost' : 'comercial-button--primary'}" href="${escapeHtml(miasHref)}">Mías</a>
        <a class="comercial-button ${route.equipo ? 'comercial-button--primary' : 'comercial-button--ghost'}" href="${escapeHtml(equipoHref)}">Equipo</a>
        <a class="comercial-button comercial-button--ghost" href="#/cotizaciones/escanear">Foto OCR</a>
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
      : `<p>Aún no hay presupuestos formales.</p>
         <div class="comercial-quote-empty-actions">
           <a class="comercial-button comercial-button--primary" href="#/cotizaciones/escanear">Escanear foto competencia</a>
           <a class="comercial-button comercial-button--ghost" href="#/cotizaciones/nueva">Nuevo manual</a>
         </div>
         <p class="comercial-help">Info/catálogo por WhatsApp o email: usa Catálogo → Enviar info.${!route.equipo ? ' Cambia a Equipo para ver solicitudes web.' : ''}</p>`;
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
              <td class="comercial-quote-row-actions">
                <a class="comercial-button comercial-button--primary comercial-button--sm" href="#/cotizaciones?id=${escapeHtml(row.id)}${route.equipo ? '&equipo=1' : ''}${route.tab === 'enviadas' ? '&tab=enviadas' : ''}">Abrir</a>
                ${
                  esRolAdmin(state.rol) && row.estado !== 'convertida' && !row.pedido_id
                    ? `<button class="comercial-button comercial-button--danger comercial-button--sm" type="button" data-quote-list-delete data-id="${escapeHtml(row.id)}" data-label="${escapeHtml(row.numero || row.empresa || row.nombre || 'presupuesto')}">Borrar</button>`
                    : ''
                }
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;

  return `<section class="comercial-panel"><div class="comercial-panel__head"><h2>Presupuestos formales (${total})</h2><p class="comercial-help">PDF + email al cliente. Distinto de Envíos info (enlaces/catálogo).</p></div>${toolbar}${table}${pager}</section>`;
}

/** Pantalla PWA dedicada: tomar foto o galería → OCR → borrador. */
function renderScanView(): string {
  return `
    <section class="comercial-panel comercial-quote-scan" data-quote-scan>
      <div class="comercial-panel__head">
        <div>
          <h2>Escanear presupuesto competencia</h2>
          <p class="comercial-help">Desde el móvil: toma foto o elige de la galería. OCR rellena cliente, productos, unidades y precios (mejorados vs catálogo I-ME).</p>
        </div>
        <a class="comercial-button comercial-button--ghost" href="#/cotizaciones">Bandeja</a>
      </div>
      <div class="comercial-quote-scan__actions">
        <button class="comercial-button comercial-button--primary comercial-quote-scan__cta" type="button" data-quote-ocr-camera>
          Tomar foto
        </button>
        <button class="comercial-button comercial-button--ghost comercial-quote-scan__cta" type="button" data-quote-ocr-gallery>
          Elegir de galería
        </button>
      </div>
      <div class="comercial-quote-scan__preview" data-quote-scan-preview hidden>
        <img alt="Vista previa presupuesto competencia" data-quote-scan-img />
      </div>
      <p class="comercial-help comercial-quote-scan__status" data-quote-scan-status role="status"></p>
      <p class="comercial-help">También puedes crear un presupuesto vacío en <a href="#/cotizaciones/nueva">Nueva</a> y escanear después.</p>
    </section>`;
}

async function renderEditor(route: CotizacionesRoute): Promise<string> {
  let quote: QuotePublic;
  if (route.mode === 'edit' && route.id) {
    const { data, error } = await getQuote(route.id);
    if (error || !data?.quote) {
      return `<section class="comercial-panel"><div class="comercial-state comercial-state--empty"><p>Cotización no encontrada.</p><a class="comercial-button comercial-button--ghost" href="#/cotizaciones">Volver</a></div></section>`;
    }
    quote = data.quote;
    if (quote.editable && !String(quote.condiciones ?? '').trim()) {
      quote = { ...quote, condiciones: defaultCondicionesOferta('es') };
    }
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
      condiciones: defaultCondicionesOferta('es'),
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

  const isAdmin = esRolAdmin(state.rol);
  const crmStatus = quote.crm_sync_status;
  const crmLabel =
    crmStatus === 'synced'
      ? 'CRM sincronizado'
      : crmStatus === 'failed'
        ? 'CRM falló'
        : crmStatus === 'pending'
          ? 'CRM pendiente de validación'
          : crmStatus === 'skipped'
            ? 'CRM omitido'
            : '';
  const canValidarCrm = Boolean(quote.id) && !quote.productos.some(l => l.precio_pendiente_validar);
  const adminActions = isAdmin
    ? `${
        quote.id
          ? `<button class="comercial-button comercial-button--danger" type="button" data-quote-delete>Borrar</button>`
          : ''
      }${
        canValidarCrm
          ? `<button class="comercial-button comercial-button--primary" type="button" data-quote-validar-crm>${crmStatus === 'synced' ? 'Revalidar CRM' : 'Validar → CRM'}</button>`
          : ''
      }`
    : '';

  return `
    <section class="comercial-panel comercial-quote-editor" data-quote-editor data-quote-id="${escapeHtml(quote.id)}" data-updated-at="${escapeHtml(quote.updated_at ?? '')}" data-estado="${escapeHtml(quote.estado)}" data-quote-numero="${escapeHtml(quote.numero ?? '')}">
      <div class="comercial-panel__head">
        <div>
          <h2>${escapeHtml(quote.numero || 'Nuevo presupuesto')}</h2>
          <p class="comercial-help">${estadoBadge(quote.estado)} · ${escapeHtml(formatQuoteMoney(quote.precio_total_ofertado, quote.moneda))}${crmLabel ? ` · ${escapeHtml(crmLabel)}` : ''}</p>
        </div>
        <a class="comercial-button comercial-button--ghost" href="#/cotizaciones">Bandeja</a>
      </div>
      ${banner}
      ${
        editable && !quote.id
          ? `<div class="comercial-quote-scan-card">
        <p><strong>¿Tienes foto del presupuesto competencia?</strong></p>
        <p class="comercial-help">Escanea desde el móvil y generamos un borrador mejorado automáticamente.</p>
        <a class="comercial-button comercial-button--primary" href="#/cotizaciones/escanear">Escanear foto</a>
      </div>`
          : ''
      }
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
        ${
          editable
            ? `<div class="comercial-quote-ocr-bar">
          <a class="comercial-button comercial-button--ghost comercial-button--sm" href="#/cotizaciones/escanear">Escanear foto</a>
          <button class="comercial-button comercial-button--ghost comercial-button--sm" type="button" data-quote-ocr-camera>Cámara</button>
          <button class="comercial-button comercial-button--ghost comercial-button--sm" type="button" data-quote-ocr-gallery>Galería</button>
          <span class="comercial-help">Rellena o actualiza este presupuesto con OCR.</span>
        </div>`
            : ''
        }
        <div data-quote-lines>${linesHtml(quote.productos, quote.moneda, editable)}</div>
        <p class="comercial-quote-total" data-quote-total>Total ${escapeHtml(formatQuoteMoney(calcularTotalOfertado(quote.productos), quote.moneda))}</p>
        <label class="comercial-field"><span>Condiciones / consideraciones de la oferta</span><textarea name="condiciones" rows="12" ${disabled}>${escapeHtml(quote.condiciones)}</textarea></label>
        <p class="comercial-help">Secciones del boceto: Entrega, Costo de envío, Garantía, Instalación. Edita plazos y garantías por producto.</p>
        <p class="comercial-help" data-quote-hint role="status"></p>
      </form>
      <div class="comercial-quote-footer">
        ${
          editable
            ? `<button class="comercial-button comercial-button--ghost" type="button" data-quote-save>Guardar</button>
               <button class="comercial-button comercial-button--ghost" type="button" data-quote-preview>Vista previa</button>
               <button class="comercial-button comercial-button--primary comercial-quote-send" type="button" data-quote-send-email>Enviar email</button>
               <button class="comercial-button comercial-button--whatsapp comercial-quote-send" type="button" data-quote-send-whatsapp>WhatsApp</button>
               ${adminActions}`
            : `<button class="comercial-button comercial-button--ghost" type="button" data-quote-preview>Abrir PDF</button>
               ${quote.estado === 'enviada' ? `<button class="comercial-button comercial-button--primary" type="button" data-quote-duplicar>Nueva revisión</button>` : ''}
               ${quote.estado === 'expirada' ? `<button class="comercial-button comercial-button--primary" type="button" data-quote-duplicar>Duplicar a borrador</button>` : ''}
               ${adminActions}`
        }
      </div>
      ${
        editable
          ? `<p class="comercial-help comercial-quote-send-copy"><strong>Presupuesto formal:</strong> PDF + enlace Formalizar por <strong>email</strong> o <strong>WhatsApp</strong> (usa el teléfono del contacto). CRM solo tras <strong>Validar → CRM</strong>.</p>`
          : isAdmin
            ? `<p class="comercial-help">CRM: ${escapeHtml(crmLabel || 'sin sincronizar')}.</p>`
            : ''
      }
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
            const pendiente = Boolean(l.precio_pendiente_validar);
            const missing = !pendiente && !(l.precio_unitario > 0);
            return `
        <article class="comercial-quote-line" data-quote-line data-index="${index}">
          <div class="comercial-quote-line__name">
            <input class="comercial-input" data-linea-nombre value="${escapeHtml(l.nombre)}" placeholder="Nombre del producto" aria-label="Nombre" ${disabled} />
            <input class="comercial-input" data-linea-slug value="${escapeHtml(l.slug)}" placeholder="SKU (opcional)" aria-label="SKU" ${disabled} />
            ${missing ? '<span class="comercial-badge comercial-badge--status-warn">Sin precio</span>' : ''}
            ${pendiente ? '<span class="comercial-badge comercial-badge--status-warn">Pendiente validar</span>' : ''}
          </div>
          <label class="comercial-field"><span>Cantidad</span>
            <input class="comercial-input comercial-quote-qty" data-linea-cantidad type="number" min="1" step="1" value="${l.cantidad}" ${disabled} />
          </label>
          <div class="comercial-field comercial-quote-precio">
            <span>Precio (${escapeHtml(moneda)})</span>
            <select class="comercial-input" data-linea-precio-modo aria-label="Modo de precio" ${disabled}>
              <option value="numero" ${pendiente ? '' : 'selected'}>Importe</option>
              <option value="pendiente" ${pendiente ? 'selected' : ''}>Pendiente validar</option>
            </select>
            <input class="comercial-input" data-linea-precio type="number" min="0" step="${moneda === 'USD' ? '0.01' : '1'}" value="${pendiente ? '' : l.precio_unitario}" placeholder="0" ${disabled} ${pendiente ? 'disabled' : ''} />
          </div>
          <p class="comercial-quote-line__subtotal" data-linea-subtotal>${pendiente ? 'Pendiente validar' : escapeHtml(formatQuoteMoney(l.subtotal, moneda))}</p>
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
    const pendiente =
      row.querySelector<HTMLSelectElement>('[data-linea-precio-modo]')?.value === 'pendiente';
    const precio = pendiente
      ? 0
      : Number(row.querySelector<HTMLInputElement>('[data-linea-precio]')?.value) || 0;
    if (!nombre && !slug) return;
    const linea: CotizacionLineaOferta = {
      slug,
      nombre: nombre || slug,
      cantidad,
      precio_unitario: precio,
      subtotal: pendiente ? 0 : Math.round(precio * cantidad * 100) / 100,
      moneda,
    };
    if (pendiente) linea.precio_pendiente_validar = true;
    productos.push(linea);
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
    const modo = row.querySelector<HTMLSelectElement>('[data-linea-precio-modo]');
    const pendiente = modo?.value === 'pendiente';
    const precioInput = row.querySelector<HTMLInputElement>('[data-linea-precio]');
    if (precioInput && modo) {
      precioInput.disabled = Boolean(modo.disabled) || Boolean(pendiente);
    }
    const precio = pendiente ? 0 : Number(precioInput?.value) || 0;
    const cell = row.querySelector('[data-linea-subtotal]');
    if (cell) {
      cell.textContent = pendiente
        ? 'Pendiente validar'
        : formatQuoteMoney(precio * cantidad, parsed.moneda);
    }
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
  root.setAttribute('data-quote-numero', quote.numero ?? '');
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
          .map(l => {
            const pendiente = Boolean(l.precio_pendiente_validar);
            return `<tr>
              <td>${escapeHtml(l.nombre)}</td>
              <td>${l.cantidad}</td>
              <td>${pendiente ? 'Pendiente validar' : escapeHtml(formatQuoteMoney(l.precio_unitario, parsed.moneda))}</td>
              <td>${pendiente ? '—' : escapeHtml(formatQuoteMoney(l.subtotal, parsed.moneda))}</td>
            </tr>`;
          })
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
  const title = root.querySelector('h2')?.textContent?.trim() || '';
  const attrNumero = root.getAttribute('data-quote-numero')?.trim() || '';
  const numero =
    (attrNumero && attrNumero !== 'Nuevo presupuesto' ? attrNumero : '') ||
    (title.startsWith('IME-Q') ? title : '');
  const snapshot = { ...parsed, ...(numero ? { numero } : {}) };
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

async function confirmAndDeleteQuote(id: string, label: string): Promise<boolean> {
  if (!id) return false;
  if (
    !window.confirm(
      `¿Borrar ${label}? Esta acción no se puede deshacer (PDF incluido). Solo admin/owner.`
    )
  ) {
    return false;
  }
  const { error, code } = await deleteQuote(id);
  if (error) {
    toast(errMsg(code, error), 'error');
    return false;
  }
  toast('Presupuesto borrado.', 'success');
  return true;
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

  const runOcr = async (mode: 'camera' | 'gallery', quoteId?: string) => {
    const statusEl = container.querySelector<HTMLElement>('[data-quote-scan-status]');
    const preview = container.querySelector<HTMLElement>('[data-quote-scan-preview]');
    const img = container.querySelector<HTMLImageElement>('[data-quote-scan-img]');
    const setStatus = (msg: string) => {
      if (statusEl) statusEl.textContent = msg;
    };
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '[data-quote-ocr-camera], [data-quote-ocr-gallery]'
    );
    buttons.forEach(b => {
      b.disabled = true;
    });

    const file = await pickCompetenciaImage(mode);
    if (!file) {
      buttons.forEach(b => {
        b.disabled = false;
      });
      setStatus('Cancelado.');
      return;
    }

    if (preview && img) {
      const url = URL.createObjectURL(file);
      img.src = url;
      preview.hidden = false;
    }

    setStatus('Comprimiendo imagen…');
    toast('Analizando presupuesto competencia…', 'success');
    const compressed = await compressImageForOcr(file);
    setStatus('Enviando a OCR…');
    const payload: { file: Blob; filename: string; quoteId?: string } = {
      file: compressed.blob,
      filename: compressed.filename,
    };
    if (quoteId) payload.quoteId = quoteId;
    const { data, error, code } = await ocrPresupuestoCompetencia(payload);
    buttons.forEach(b => {
      b.disabled = false;
    });
    if (error || !data?.quote_id) {
      setStatus(errMsg(code, error ?? 'OCR falló'));
      toast(errMsg(code, error ?? 'OCR falló'), 'error');
      return;
    }
    const conf =
      data.extract?.confianza != null
        ? ` · confianza ${(data.extract.confianza * 100).toFixed(0)}%`
        : '';
    setStatus(`Listo${conf}. Abriendo borrador…`);
    toast(`OCR listo${conf}. Abriendo borrador mejorado.`, 'success');
    trackCommercialUsage('share_succeeded', { result: 'ocr_competencia' }, 'cotizaciones');
    location.hash = `#/cotizaciones?id=${encodeURIComponent(data.quote_id)}`;
  };

  container.querySelectorAll<HTMLButtonElement>('[data-quote-ocr-camera]').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid =
        container.querySelector('[data-quote-editor]')?.getAttribute('data-quote-id') || '';
      void runOcr('camera', qid || undefined);
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-quote-ocr-gallery]').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid =
        container.querySelector('[data-quote-editor]')?.getAttribute('data-quote-id') || '';
      void runOcr('gallery', qid || undefined);
    });
  });

  const onListDelete = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLButtonElement>('[data-quote-list-delete]');
    if (!btn) return;
    event.preventDefault();
    const id = btn.getAttribute('data-id') || '';
    const label = btn.getAttribute('data-label') || 'este presupuesto';
    void (async () => {
      btn.disabled = true;
      const ok = await confirmAndDeleteQuote(id, label);
      btn.disabled = false;
      if (ok) window.dispatchEvent(new HashChangeEvent('hashchange'));
    })();
  };
  container.addEventListener('click', onListDelete);

  if (!editor) {
    return () => {
      container.removeEventListener('click', onListDelete);
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

  const runSend = async (canal: 'email' | 'whatsapp') => {
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
    if (canal === 'email' && /@example\.com$/i.test(parsed.email)) {
      toast('Usa un correo real del cliente. Resend rechaza @example.com.', 'error');
      return;
    }
    if (canal === 'whatsapp' && !parsed.telefono.trim()) {
      toast(ERROR_COPY.SIN_TELEFONO!, 'error');
      return;
    }
    const numero = editor.querySelector('h2')?.textContent ?? 'IME-Q';
    const destino = canal === 'whatsapp' ? parsed.telefono : parsed.email;
    // Abrir pestaña en el mismo gesto del click (antes de confirm/await);
    // si no, el popup blocker mata wa.me tras el async.
    let waTab: Window | null = null;
    if (canal === 'whatsapp') {
      waTab = window.open('about:blank', '_blank');
    }
    const ok = window.confirm(
      `¿Enviar presupuesto ${numero} por ${canal === 'whatsapp' ? 'WhatsApp' : 'email'} a ${destino} (${formatQuoteMoney(calcularTotalOfertado(parsed.productos), parsed.moneda)})?`
    );
    if (!ok) {
      waTab?.close();
      return;
    }
    const emailBtn = editor.querySelector<HTMLButtonElement>('[data-quote-send-email]');
    const waBtn = editor.querySelector<HTMLButtonElement>('[data-quote-send-whatsapp]');
    const saveBtn = editor.querySelector<HTMLButtonElement>('[data-quote-save]');
    const activeBtn = canal === 'whatsapp' ? waBtn : emailBtn;
    if (emailBtn) emailBtn.disabled = true;
    if (waBtn) waBtn.disabled = true;
    if (activeBtn) {
      activeBtn.textContent = canal === 'whatsapp' ? 'Abriendo WhatsApp…' : 'Enviando email…';
    }
    if (saveBtn) saveBtn.disabled = true;
    const { data, error, code } = await callEdgeFunction<{
      numero?: string;
      ok?: boolean;
      canal?: string;
      whatsapp_url?: string;
      formalizar_url?: string;
      crm_sync_status?: string;
    }>('enviar-cotizacion', {
      method: 'POST',
      body: {
        cotizacion_id: id,
        canal,
        productos: parsed.productos,
        condiciones: parsed.condiciones,
        moneda: parsed.moneda,
        validez_hasta: parsed.validez_hasta,
        mercado: parsed.moneda === 'USD' ? 'INTL' : 'CO',
      },
    });
    if (emailBtn) {
      emailBtn.disabled = false;
      emailBtn.textContent = 'Enviar email';
    }
    if (waBtn) {
      waBtn.disabled = false;
      waBtn.textContent = 'WhatsApp';
    }
    if (saveBtn) saveBtn.disabled = false;
    if (error) {
      waTab?.close();
      const alert = editor.querySelector('[data-quote-hint]');
      if (alert) {
        alert.setAttribute('role', 'alert');
        alert.textContent = errMsg(code, error);
      }
      toast(errMsg(code, error), 'error');
      return;
    }
    if (canal === 'whatsapp' && data?.whatsapp_url) {
      if (waTab && !waTab.closed) {
        waTab.location.href = data.whatsapp_url;
      } else {
        const a = document.createElement('a');
        a.href = data.whatsapp_url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      toast(
        `Presupuesto ${String(data?.numero ?? numero)} listo en WhatsApp. CRM pendiente de validación admin.`,
        'success'
      );
    } else {
      waTab?.close();
      toast(
        `Presupuesto ${String(data?.numero ?? numero)} enviado por email. CRM pendiente de validación admin.`,
        'success'
      );
    }
    trackCommercialUsage(
      'share_succeeded',
      { result: canal === 'whatsapp' ? 'quote_whatsapp' : 'quote_email' },
      'cotizaciones'
    );
    setDirty(false);
    const next = `#/cotizaciones?id=${encodeURIComponent(id)}`;
    if (location.hash === next) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      location.hash = next;
    }
  };

  editor
    .querySelector('[data-quote-send-email]')
    ?.addEventListener('click', () => void runSend('email'));
  editor
    .querySelector('[data-quote-send-whatsapp]')
    ?.addEventListener('click', () => void runSend('whatsapp'));

  editor.querySelector('[data-quote-delete]')?.addEventListener('click', async () => {
    const id = editor.getAttribute('data-quote-id') || '';
    if (!id) return;
    const numero = editor.querySelector('h2')?.textContent ?? 'este presupuesto';
    const btn = editor.querySelector<HTMLButtonElement>('[data-quote-delete]');
    if (btn) btn.disabled = true;
    const ok = await confirmAndDeleteQuote(id, numero);
    if (btn) btn.disabled = false;
    if (!ok) return;
    setDirty(false);
    location.hash = '#/cotizaciones';
  });

  editor.querySelector('[data-quote-validar-crm]')?.addEventListener('click', async () => {
    const id = editor.getAttribute('data-quote-id') || '';
    if (!id) return;
    const parsed = readForm(editor);
    if (parsed.productos.some(l => l.precio_pendiente_validar)) {
      toast(ERROR_COPY.PRECIO_PENDIENTE!, 'error');
      return;
    }
    const check = ofertaCompleta(parsed.productos, parsed.condiciones);
    if (!check.ok) {
      toast(errMsg(check.error), 'error');
      return;
    }
    if (dirty) {
      const saved = await saveQuote(editor);
      if (!saved) return;
      applySaved(editor, saved);
    }
    if (
      !window.confirm(
        '¿Validar este presupuesto y enviarlo al CRM Twenty? Solo tras revisar precios y condiciones.'
      )
    ) {
      return;
    }
    const btn = editor.querySelector<HTMLButtonElement>('[data-quote-validar-crm]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Validando…';
    }
    const { data, error, code } = await validarQuoteCrm(id);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Validar → CRM';
    }
    if (error) {
      toast(errMsg(code, error), 'error');
      return;
    }
    const status = data?.crm_sync_status ?? 'synced';
    toast(
      status === 'skipped'
        ? 'Validado. CRM omitido (sin secrets Twenty).'
        : 'Presupuesto validado y sincronizado con el CRM.',
      'success'
    );
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
    container.removeEventListener('click', onListDelete);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
