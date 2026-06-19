/**
 * Lista de equipos para "Solicitud de cotización" — estado persistido en
 * sessionStorage. Independiente del carrito de consumibles (carrito.ts).
 * Solo guarda slug/nombre/cantidad; el envío real va por submitCotizacion.
 */

export interface CotizacionItem {
  slug: string;
  nombre: string;
  imagen: string;
  cantidad: number;
}

const STORAGE_KEY = 'ime_cotizacion';
export const EVENTO_CAMBIO = 'ime:cotizacion:cambio';
export const EVENTO_ABRIR = 'ime:cotizacion:abrir';

function leer(): CotizacionItem[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is CotizacionItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as CotizacionItem).slug === 'string' &&
        typeof (item as CotizacionItem).cantidad === 'number'
    );
  } catch {
    return [];
  }
}

function escribir(items: CotizacionItem[]): CotizacionItem[] {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CotizacionItem[]>(EVENTO_CAMBIO, { detail: items }));
  }
  return items;
}

export function getCotizacionItems(): CotizacionItem[] {
  return leer();
}

export function getCotizacionCantidad(): number {
  return leer().reduce((acc, item) => acc + item.cantidad, 0);
}

export function agregarACotizacion(
  item: Omit<CotizacionItem, 'cantidad'>,
  cantidad = 1
): CotizacionItem[] {
  const items = leer();
  const existente = items.find(i => i.slug === item.slug);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    items.push({ ...item, cantidad: Math.max(cantidad, 1) });
  }
  return escribir(items);
}

export function actualizarCantidadCotizacion(slug: string, cantidad: number): CotizacionItem[] {
  let items = leer();
  if (cantidad <= 0) {
    items = items.filter(i => i.slug !== slug);
  } else {
    const existente = items.find(i => i.slug === slug);
    if (existente) existente.cantidad = cantidad;
  }
  return escribir(items);
}

export function quitarDeCotizacion(slug: string): CotizacionItem[] {
  return escribir(leer().filter(i => i.slug !== slug));
}

export function vaciarCotizacion(): CotizacionItem[] {
  return escribir([]);
}

export function suscribirCotizacion(callback: (items: CotizacionItem[]) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => callback((event as CustomEvent<CotizacionItem[]>).detail);
  window.addEventListener(EVENTO_CAMBIO, handler);
  return () => window.removeEventListener(EVENTO_CAMBIO, handler);
}

export function abrirCotizacion(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_ABRIR));
}

export function alAbrirCotizacion(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(EVENTO_ABRIR, callback);
  return () => window.removeEventListener(EVENTO_ABRIR, callback);
}
