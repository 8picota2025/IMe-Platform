/**
 * Carrito de consumibles — estado persistido en sessionStorage.
 *
 * Nota sobre precios: precio/nombre/moneda se guardan junto al slug/cantidad
 * únicamente para renderizar el drawer sin re-consultar Supabase en cada visita.
 * NUNCA son la fuente de verdad del cobro: crear-pago (Edge Function) recalcula
 * siempre precio, stock y total desde la tabla `productos` con credenciales privilegiadas.
 */

import { getSupabaseClient } from './supabase'
import type { Locale } from '../i18n/utils'

export interface CarritoItem {
  slug: string
  nombre: string
  precio: number
  moneda: string
  stock: number | null
  cantidad: number
}

export interface CarritoCliente {
  nombre: string
  apellido: string
  email: string
  telefono: string
  institucion?: string
}

export type Mercado = 'CO' | 'INTL'

export interface ResultadoCheckout {
  ok: boolean
  checkoutUrl?: string
  referencia?: string
  error?: string
}

const STORAGE_KEY = 'ime_carrito'
export const EVENTO_CAMBIO = 'ime:carrito:cambio'
export const EVENTO_ABRIR = 'ime:carrito:abrir'

function leer(): CarritoItem[] {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter(
      (item): item is CarritoItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as CarritoItem).slug === 'string' &&
        typeof (item as CarritoItem).cantidad === 'number'
    )
  } catch {
    return []
  }
}

function escribir(items: CarritoItem[]): CarritoItem[] {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CarritoItem[]>(EVENTO_CAMBIO, { detail: items }))
  }
  return items
}

export function getCarrito(): CarritoItem[] {
  return leer()
}

export function getCarritoCantidad(): number {
  return leer().reduce((acc, item) => acc + item.cantidad, 0)
}

/** Suma de precio*cantidad. Solo orientativo — el servidor recalcula al pagar. */
export function getCarritoTotal(items: CarritoItem[] = leer()): { total: number; moneda: string } {
  const moneda = items[0]?.moneda ?? 'COP'
  const total = items.reduce((acc, item) => acc + item.precio * item.cantidad, 0)
  return { total, moneda }
}

export function agregarAlCarrito(item: Omit<CarritoItem, 'cantidad'>, cantidad = 1): CarritoItem[] {
  const items = leer()
  const existente = items.find((i) => i.slug === item.slug)
  const limite = item.stock ?? Infinity
  if (existente) {
    existente.cantidad = Math.min(existente.cantidad + cantidad, limite)
  } else {
    items.push({ ...item, cantidad: Math.min(Math.max(cantidad, 1), limite) })
  }
  return escribir(items)
}

export function actualizarCantidad(slug: string, cantidad: number): CarritoItem[] {
  let items = leer()
  if (cantidad <= 0) {
    items = items.filter((i) => i.slug !== slug)
  } else {
    const existente = items.find((i) => i.slug === slug)
    if (existente) {
      const limite = existente.stock ?? Infinity
      existente.cantidad = Math.min(cantidad, limite)
    }
  }
  return escribir(items)
}

export function quitarDelCarrito(slug: string): CarritoItem[] {
  return escribir(leer().filter((i) => i.slug !== slug))
}

export function vaciarCarrito(): CarritoItem[] {
  return escribir([])
}

export function suscribirCarrito(callback: (items: CarritoItem[]) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (event: Event) => callback((event as CustomEvent<CarritoItem[]>).detail)
  window.addEventListener(EVENTO_CAMBIO, handler)
  return () => window.removeEventListener(EVENTO_CAMBIO, handler)
}

export function abrirCarrito(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_ABRIR))
}

export function alAbrirCarrito(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(EVENTO_ABRIR, callback)
  return () => window.removeEventListener(EVENTO_ABRIR, callback)
}

/**
 * Llama a la Edge Function crear-pago. El servidor recalcula precios/stock
 * desde Supabase — items aquí solo aporta slug+cantidad.
 */
export async function iniciarCheckout(params: {
  cliente: CarritoCliente
  mercado: Mercado
  consentimientoDatos: boolean
  locale: Locale
}): Promise<ResultadoCheckout> {
  const items = leer()
  if (items.length === 0) return { ok: false, error: 'CARRITO_VACIO' }

  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: 'NO_DISPONIBLE' }

  const { data, error } = await supabase.functions.invoke('crear-pago', {
    body: {
      items: items.map((i) => ({ slug: i.slug, cantidad: i.cantidad })),
      cliente: params.cliente,
      mercado: params.mercado,
      consentimiento_datos: params.consentimientoDatos,
      locale: params.locale,
    },
  })

  if (error) {
    const context = (error as { context?: unknown }).context
    let mensaje = error.message
    if (context instanceof Response) {
      try {
        const json = (await context.json()) as { error?: { message?: string } }
        if (json?.error?.message) mensaje = json.error.message
      } catch {
        /* respuesta no JSON, usar mensaje por defecto */
      }
    }
    return { ok: false, error: mensaje }
  }

  const json = data as { ok?: boolean; checkout_url?: string; referencia?: string }
  if (!json?.ok || !json.checkout_url) {
    return { ok: false, error: 'GATEWAY_ERROR' }
  }
  return {
    ok: true,
    checkoutUrl: json.checkout_url,
    ...(json.referencia ? { referencia: json.referencia } : {}),
  }
}
