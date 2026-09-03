/**
 * Carrito de consumibles — estado persistido en sessionStorage.
 *
 * Nota sobre precios: precio/nombre/moneda se guardan junto al slug/cantidad
 * únicamente para renderizar el drawer sin re-consultar Supabase en cada visita.
 * NUNCA son la fuente de verdad del cobro: crear-pago (Edge Function) recalcula
 * siempre precio, stock y total desde la tabla `productos` con credenciales privilegiadas.
 */

import type { Locale } from '../i18n/utils';
import { emitAnalyticsEvent } from './analytics';
import { captureCommercialAttribution } from './commercial-attribution';
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

export interface ResultadoSolicitudCompra {
  ok: boolean;
  error?: string;
}

const STORAGE_KEY = 'ime_carrito';
const COTIZACION_CHECKOUT_KEY = 'ime_cotizacion_checkout';
export const EVENTO_CAMBIO = 'ime:carrito:cambio';
export const EVENTO_ABRIR = 'ime:carrito:abrir';

export interface CotizacionCheckoutRef {
  cotizacionId: string;
  token: string;
}

export function getCotizacionCheckout(): CotizacionCheckoutRef | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(COTIZACION_CHECKOUT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CotizacionCheckoutRef;
    if (!data?.cotizacionId || !data?.token) return null;
    return data;
  } catch {
    return null;
  }
}

export function setCotizacionCheckout(ref: CotizacionCheckoutRef | null): void {
  if (typeof sessionStorage === 'undefined') return;
  if (!ref) {
    sessionStorage.removeItem(COTIZACION_CHECKOUT_KEY);
    return;
  }
  sessionStorage.setItem(COTIZACION_CHECKOUT_KEY, JSON.stringify(ref));
}

export function clearCotizacionCheckout(): void {
  setCotizacionCheckout(null);
}

/** Carga líneas de una cotización ofertada (precios locked en servidor al pagar). */
export function cargarCarritoDesdeCotizacion(
  lineas: Array<{
    slug: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    moneda: string;
  }>,
  ref: CotizacionCheckoutRef
): CarritoItem[] {
  const items: CarritoItem[] = lineas
    .filter(l => l.slug && l.cantidad > 0 && l.precio_unitario > 0)
    .map(l => ({
      slug: l.slug,
      nombre: l.nombre || l.slug,
      precio: l.precio_unitario,
      moneda: l.moneda || 'COP',
      stock: null,
      cantidad: Math.floor(l.cantidad),
    }));
  setCotizacionCheckout(ref);
  return escribir(items);
}

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
  emitAnalyticsEvent('add_to_cart', {
    currency: item.moneda,
    item_id: item.slug,
    item_name: item.nombre,
    quantity: cantidad,
    value: item.precio * cantidad,
  });
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
  clearCotizacionCheckout();
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
 * Guarda el carrito con email para recuperacion de carrito abandonado.
 * Fire-and-forget: nunca bloquea ni rompe el flujo de checkout.
 */
export function guardarCarritoAbandonado(email: string, nombre: string): void {
  const items = leer();
  if (!email.includes('@') || items.length === 0) return;
  void (async () => {
    try {
      const supabase = await loadSupabaseClient();
      if (!supabase) return;
      await supabase.functions.invoke('guardar-carrito', {
        body: {
          email: email.trim().toLowerCase(),
          nombre: nombre.trim(),
          items: items.map(i => ({
            slug: i.slug,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
          })),
        },
      });
    } catch {
      // best-effort
    }
  })();
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
  const { total, moneda } = getCarritoTotal(items);
  emitAnalyticsEvent('begin_checkout', {
    currency: moneda,
    item_count: items.reduce((acc, item) => acc + item.cantidad, 0),
    items: items.map(item => `${item.slug}:${item.cantidad}`).join(','),
    market: params.mercado,
    value: total,
  });

  const supabase = await loadSupabaseClient();
  if (!supabase) return { ok: false, error: 'NO_DISPONIBLE' };

  const cotizacionRef = getCotizacionCheckout();
  const { data, error } = await supabase.functions.invoke('crear-pago', {
    body: {
      items: items.map(i => ({ slug: i.slug, cantidad: i.cantidad })),
      cliente: params.cliente,
      mercado: params.mercado,
      cupon_codigo: cotizacionRef ? undefined : params.cuponCodigo || undefined,
      consentimiento_datos: params.consentimientoDatos,
      locale: params.locale,
      fiscal: params.cliente.fiscal,
      ...(cotizacionRef
        ? {
            cotizacion_id: cotizacionRef.cotizacionId,
            formalizacion_token: cotizacionRef.token,
          }
        : {}),
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
  clearCotizacionCheckout();
  return {
    ok: true,
    checkoutUrl: json.checkout_url,
    ...(json.referencia ? { referencia: json.referencia } : {}),
  };
}

function buildCompraValorarMensaje(params: {
  cliente: CarritoCliente;
  mercado: Mercado;
  cuponCodigo?: string | undefined;
  total: number;
  moneda: string;
}): string {
  const lines = [
    'COMPRA A VALORAR - Pago online temporalmente no disponible.',
    `Mercado: ${params.mercado}`,
    `Total estimado mostrado en carrito: ${params.total} ${params.moneda}`,
  ];
  if (params.cliente.institucion) lines.push(`Institucion: ${params.cliente.institucion}`);
  if (params.cuponCodigo) lines.push(`Cupon indicado: ${params.cuponCodigo}`);
  if (params.cliente.fiscal) {
    lines.push('Cliente solicito datos de facturacion electronica para validacion comercial.');
  }
  lines.push(
    'Solicitar a compras validacion de disponibilidad, valor unitario final, impuestos, envio y total.'
  );
  return lines.join('\n');
}

/**
 * Contingencia ecommerce: mientras pago online esta pausado, convierte el
 * carrito en solicitud de cotizacion identificada como compra a valorar.
 */
export async function solicitarCotizacionCompra(params: {
  cliente: CarritoCliente;
  mercado: Mercado;
  cuponCodigo?: string;
  consentimientoDatos: boolean;
  locale: Locale;
}): Promise<ResultadoSolicitudCompra> {
  const items = leer();
  if (items.length === 0) return { ok: false, error: 'CARRITO_VACIO' };

  const { total, moneda } = getCarritoTotal(items);
  emitAnalyticsEvent('begin_checkout', {
    currency: moneda,
    item_count: items.reduce((acc, item) => acc + item.cantidad, 0),
    items: items.map(item => `${item.slug}:${item.cantidad}`).join(','),
    market: params.mercado,
    quote_type: 'compra_a_valorar',
    value: total,
  });

  const supabase = await loadSupabaseClient();
  if (!supabase) return { ok: false, error: 'NO_DISPONIBLE' };

  const nombre = `${params.cliente.nombre} ${params.cliente.apellido}`.trim();
  const { data, error } = await supabase.functions.invoke('registrar-cotizacion', {
    body: {
      ...captureCommercialAttribution(),
      tipo_solicitud: 'compra_a_valorar',
      origen: 'carrito',
      locale: params.locale,
      nombre,
      empresa: params.cliente.institucion ?? '',
      email: params.cliente.email,
      telefono: params.cliente.telefono,
      mensaje: buildCompraValorarMensaje({
        cliente: params.cliente,
        mercado: params.mercado,
        cuponCodigo: params.cuponCodigo,
        total,
        moneda,
      }),
      consentimiento_datos: params.consentimientoDatos,
      mercado: params.mercado,
      moneda,
      total_estimado: total,
      cupon_codigo: params.cuponCodigo || undefined,
      fiscal: params.cliente.fiscal,
      productos: items.map(item => ({
        slug: item.slug,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
        subtotal: item.precio * item.cantidad,
        moneda: item.moneda,
      })),
    },
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? 'Error registrando solicitud' };

  emitAnalyticsEvent('quote_submit', {
    has_products: true,
    item_count: items.reduce((acc, item) => acc + item.cantidad, 0),
    products: items.map(item => `${item.slug}:${item.cantidad}`).join(','),
    quote_type: 'compra_a_valorar',
    value: total,
  });
  return { ok: true };
}
