/**
 * Carrito de consumibles — estado persistido en sessionStorage.
 *
 * Nota sobre precios: precio/nombre/moneda se guardan junto al slug/cantidad
 * únicamente para renderizar el drawer sin re-consultar Supabase en cada visita.
 * NUNCA son la fuente de verdad del cobro: crear-pago (Edge Function) recalcula
 * siempre precio, stock y total desde la tabla `productos` con credenciales privilegiadas.
 */

import type { Locale } from '../i18n/utils';
import type { ClienteFiscalProfile } from './fiscal';

export interface CarritoItem {
  slug: string;
  nombre: string;
  precio: number;
  moneda: string;
  stock: number | null;
  cantidad: number;
}

export interface CarritoCliente {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  institucion?: string;
  fiscal?: ClienteFiscalProfile;
}

export type Mercado = 'CO' | 'INTL';

export interface ResultadoCheckout {
  ok: boolean;
  checkoutUrl?: string;
  referencia?: string;
  error?: string;
  /** Codigo de error de la Edge Function (ej. 'PRODUCTO_NO_DISPONIBLE_TEMPORAL'). */
  codigo?: string;
  detalles?: unknown;
}

const STORAGE_KEY = 'ime_carrito';
export const EVENTO_CAMBIO = 'ime:carrito:cambio';
export const EVENTO_ABRIR = 'ime:carrito:abrir';

async function loadSupabaseClient() {
  const { getSupabaseClient } = await import('./supabase');
  return getSupabaseClient();
}

function leer(): CarritoItem[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is CarritoItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as CarritoItem).slug === 'string' &&
        typeof (item as CarritoItem).cantidad === 'number'
    );
  } catch {
    return [];
  }
}

function escribir(items: CarritoItem[]): CarritoItem[] {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CarritoItem[]>(EVENTO_CAMBIO, { detail: items }));
  }
  return items;
}

export function getCarrito(): CarritoItem[] {
  return leer();
}

export function getCarritoCantidad(): number {
  return leer().reduce((acc, item) => acc + item.cantidad, 0);
}

/** Suma de precio*cantidad. Solo orientativo — el servidor recalcula al pagar. */
export function getCarritoTotal(items: CarritoItem[] = leer()): { total: number; moneda: string } {
  const moneda = items[0]?.moneda ?? 'COP';
  const total = items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  return { total, moneda };
}

export function agregarAlCarrito(item: Omit<CarritoItem, 'cantidad'>, cantidad = 1): CarritoItem[] {
  const items = leer();
  const existente = items.find(i => i.slug === item.slug);
  const limite = item.stock ?? Infinity;
  if (existente) {
    existente.cantidad = Math.min(existente.cantidad + cantidad, limite);
  } else {
    items.push({ ...item, cantidad: Math.min(Math.max(cantidad, 1), limite) });
  }
  return escribir(items);
}

export function actualizarCantidad(slug: string, cantidad: number): CarritoItem[] {
  let items = leer();
  if (cantidad <= 0) {
    items = items.filter(i => i.slug !== slug);
  } else {
    const existente = items.find(i => i.slug === slug);
    if (existente) {
      const limite = existente.stock ?? Infinity;
      existente.cantidad = Math.min(cantidad, limite);
    }
  }
  return escribir(items);
}

export function quitarDelCarrito(slug: string): CarritoItem[] {
  return escribir(leer().filter(i => i.slug !== slug));
}

export function vaciarCarrito(): CarritoItem[] {
  return escribir([]);
}

export interface RevalidacionResultado {
  items: CarritoItem[];
  eliminados: CarritoItem[];
}

/**
 * Escenario A: revalida `disponible` contra Supabase y quita del carrito los
 * ítems que el proveedor marcó como no disponibles desde que se agregaron.
 * crear-pago vuelve a validar igualmente — esto solo evita sorpresas en el drawer.
 */
export async function revalidarDisponibilidad(): Promise<RevalidacionResultado> {
  const items = leer();
  if (items.length === 0) return { items, eliminados: [] };

  const supabase = await loadSupabaseClient();
  if (!supabase) return { items, eliminados: [] };

  const { data, error } = await supabase
    .from('productos')
    .select('slug, disponible')
    .in(
      'slug',
      items.map(i => i.slug)
    );

  if (error || !data) return { items, eliminados: [] };

  const noDisponibles = new Set(
    (data as { slug: string; disponible: boolean }[])
      .filter(p => p.disponible === false)
      .map(p => p.slug)
  );
  if (noDisponibles.size === 0) return { items, eliminados: [] };

  const eliminados = items.filter(i => noDisponibles.has(i.slug));
  const restantes = items.filter(i => !noDisponibles.has(i.slug));
  escribir(restantes);
  return { items: restantes, eliminados };
}

export function suscribirCarrito(callback: (items: CarritoItem[]) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => callback((event as CustomEvent<CarritoItem[]>).detail);
  window.addEventListener(EVENTO_CAMBIO, handler);
  return () => window.removeEventListener(EVENTO_CAMBIO, handler);
}

export function abrirCarrito(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_ABRIR));
}

export function alAbrirCarrito(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(EVENTO_ABRIR, callback);
  return () => window.removeEventListener(EVENTO_ABRIR, callback);
}

/**
 * Llama a la Edge Function crear-pago. El servidor recalcula precios/stock
 * desde Supabase — items aquí solo aporta slug+cantidad.
 */
export async function iniciarCheckout(params: {
  cliente: CarritoCliente;
  mercado: Mercado;
  cuponCodigo?: string;
  consentimientoDatos: boolean;
  locale: Locale;
}): Promise<ResultadoCheckout> {
  const items = leer();
  if (items.length === 0) return { ok: false, error: 'CARRITO_VACIO' };

  const supabase = await loadSupabaseClient();
  if (!supabase) return { ok: false, error: 'NO_DISPONIBLE' };

  const { data, error } = await supabase.functions.invoke('crear-pago', {
    body: {
      items: items.map(i => ({ slug: i.slug, cantidad: i.cantidad })),
      cliente: params.cliente,
      mercado: params.mercado,
      cupon_codigo: params.cuponCodigo || undefined,
      consentimiento_datos: params.consentimientoDatos,
      locale: params.locale,
      fiscal: params.cliente.fiscal,
    },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    let mensaje = error.message;
    let codigo: string | undefined;
    let detalles: unknown;
    if (context instanceof Response) {
      try {
        const json = (await context.json()) as {
          error?: { code?: string; message?: string; details?: unknown };
        };
        if (json?.error?.message) mensaje = json.error.message;
        codigo = json?.error?.code;
        detalles = json?.error?.details;
      } catch {
        /* respuesta no JSON, usar mensaje por defecto */
      }
    }
    return {
      ok: false,
      error: mensaje,
      ...(codigo ? { codigo } : {}),
      ...(detalles !== undefined ? { detalles } : {}),
    };
  }

  const json = data as { ok?: boolean; checkout_url?: string; referencia?: string };
  if (!json?.ok || !json.checkout_url) {
    return { ok: false, error: 'GATEWAY_ERROR' };
  }
  return {
    ok: true,
    checkoutUrl: json.checkout_url,
    ...(json.referencia ? { referencia: json.referencia } : {}),
  };
}
