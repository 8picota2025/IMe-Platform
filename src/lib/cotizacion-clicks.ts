/**
 * Un solo listener delegado para CTAs de cotización y controles del drawer.
 * Evita doble incremento cuando ProductoCard persiste tras navegación Astro
 * y páginas como index vuelven a enlazar los mismos botones.
 */

import {
  agregarACotizacion,
  asegurarProductoEnCotizacion,
  actualizarCantidadCotizacion,
  quitarDeCotizacion,
  getCotizacionItems,
  type CotizacionItem,
} from './cotizacion-equipos';

let abortController: AbortController | null = null;

function confirmarAdd(btn: HTMLButtonElement): void {
  const original = btn.dataset['labelAgregar'] ?? btn.textContent ?? '';
  const agregado = btn.dataset['labelAgregado'] ?? original;
  btn.textContent = agregado;
  window.setTimeout(() => {
    btn.textContent = original;
  }, 1800);
}

function readCotizacionItem(btn: HTMLElement): Omit<CotizacionItem, 'cantidad'> | null {
  const slug = btn.dataset['addCotizacion'] ?? btn.dataset['ensureCotizacion'];
  const nombre = btn.dataset['nombre'];
  const imagen = btn.dataset['imagen'];
  const url = btn.dataset['url'];
  const modelo = btn.dataset['modelo'];
  const marca = btn.dataset['marca'];
  if (!slug || !nombre || !imagen) return null;
  return { slug, nombre, imagen, url, modelo, marca };
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const qtyBtn = target.closest<HTMLButtonElement>('#cotizacion-drawer button[data-action]');
  if (qtyBtn) {
    event.preventDefault();
    const li = qtyBtn.closest<HTMLElement>('.cotizacion-item');
    const slug = li?.dataset.slug;
    if (!slug) return;
    const items = getCotizacionItems();
    const item = items.find(i => i.slug === slug);
    if (!item) return;
    const action = qtyBtn.dataset.action;
    if (action === 'inc') actualizarCantidadCotizacion(slug, item.cantidad + 1);
    else if (action === 'dec') actualizarCantidadCotizacion(slug, item.cantidad - 1);
    else if (action === 'remove') quitarDeCotizacion(slug);
    return;
  }

  const ensureBtn = target.closest<HTMLButtonElement>('[data-ensure-cotizacion]');
  if (ensureBtn) {
    event.preventDefault();
    const item = readCotizacionItem(ensureBtn);
    if (!item) return;
    asegurarProductoEnCotizacion(item);
    return;
  }

  const cotizacionBtn = target.closest<HTMLButtonElement>('[data-add-cotizacion]');
  if (!cotizacionBtn) return;

  event.preventDefault();
  const item = readCotizacionItem(cotizacionBtn);
  if (!item) return;
  agregarACotizacion(item);
  confirmarAdd(cotizacionBtn);
}

/** Registra (o reemplaza) el listener global de cotización. Idempotente en astro:page-load. */
export function initCotizacionClickDelegation(): void {
  if (typeof document === 'undefined') return;
  abortController?.abort();
  abortController = new AbortController();
  document.addEventListener('click', onDocumentClick, {
    capture: true,
    signal: abortController.signal,
  });
}
