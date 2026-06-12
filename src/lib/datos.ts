/**
 * Capa de datos intercambiable.
 * Si hay env Supabase configurado: usa Supabase.
 * Si no: usa mocks JSON locales de F0.
 *
 * BLOQUEANTE_BACKEND: Supabase real en F2.
 */

import type { Locale } from '../i18n/utils'
import { isSupabaseConfigured, getSupabaseClient } from './supabase'

import mockFamilias from '../data/mock-familias.json'
import mockProductos from '../data/mock-productos.json'
import mockTipos from '../data/mock-tipos.json'

let supabaseDeshabilitadoPorError = false

function debeUsarSupabase(): boolean {
  return isSupabaseConfigured() && !supabaseDeshabilitadoPorError
}

function registrarErrorSupabase(scope: string, error: { message?: string } | null): void {
  supabaseDeshabilitadoPorError = true
  console.error(
    `[datos] Supabase ${scope} error, falling back to mock:`,
    error?.message ?? 'error desconocido'
  )
}

function registrarVacioSupabase(scope: string): void {
  console.warn(`[datos] Supabase ${scope} devolvió 0 filas, usando mock como respaldo`)
}

// Cache de mapeo familia_id <-> familia_slug, resuelto vía Supabase (productos.familia_id
// es FK a familias.id; no existe columna familia_slug en la tabla productos).
let familiaIdPorSlug: Record<string, string> | null = null
let familiaSlugPorId: Record<string, string> | null = null

async function cargarMapaFamilias(supabase: ReturnType<typeof getSupabaseClient>): Promise<void> {
  if (familiaIdPorSlug && familiaSlugPorId) return
  const { data, error } = await supabase!.from('familias').select('id, slug')
  if (!error && data && data.length > 0) {
    familiaIdPorSlug = {}
    familiaSlugPorId = {}
    for (const f of data as { id: string; slug: string }[]) {
      familiaIdPorSlug[f.slug] = f.id
      familiaSlugPorId[f.id] = f.slug
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductoSupabase(raw: any, locale: Locale): Producto {
  return {
    id: raw.id,
    slug: raw.slug,
    familia_id: raw.familia_id,
    familia_slug: familiaSlugPorId?.[raw.familia_id] ?? '',
    tipo_id: raw.tipo_id,
    nombre: locale === 'en' ? raw.nombre_en : raw.nombre_es,
    descripcion_corta: locale === 'en' ? raw.descripcion_corta_en : raw.descripcion_corta_es,
    descripcion_larga: locale === 'en' ? raw.descripcion_larga_en : raw.descripcion_larga_es,
    especificaciones: raw.especificaciones ?? [],
    imagen_principal: raw.imagen_principal,
    galeria: raw.galeria ?? [],
    ficha_pdf: raw.ficha_pdf,
    tipo_comercial: raw.tipo_comercial,
    fulfillment_mode: raw.fulfillment_mode,
    precio: raw.precio,
    moneda: raw.moneda,
    stock: raw.stock ?? null,
    destacado: raw.destacado,
    nuevo: raw.nuevo,
    activo: raw.activo,
    orden: raw.orden,
  }
}

/* ============================================================
   Tipos
   ============================================================ */

export interface Familia {
  id: string
  slug: string
  nombre: string
  descripcion: string
  icono?: string
  orden: number
  activo: boolean
}

export interface Tipo {
  id: string
  familia_id: string
  slug: string
  nombre: string
  orden: number
  activo: boolean
}

export interface Producto {
  id: string
  slug: string
  familia_id: string
  familia_slug: string
  tipo_id: string | null
  nombre: string
  descripcion_corta: string
  descripcion_larga: string
  especificaciones: unknown[]
  imagen_principal: string
  galeria: string[]
  ficha_pdf: string | null
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

export interface FiltrosProductos {
  familia?: string
  tipo?: string
  destacado?: boolean
  query?: string
  page?: number
  pageSize?: number
}

export interface CotizacionProducto {
  slug: string
  nombre: string
  cantidad: number
}

export interface CotizacionPayload {
  nombre: string
  apellido: string
  email: string
  telefono: string
  institucion?: string
  interes?: string
  mensaje: string
  consentimiento_datos: boolean
  productos?: CotizacionProducto[]
}

/* ============================================================
   Helpers de mapeo desde mock
   ============================================================ */

function mapFamilia(raw: (typeof mockFamilias)[0], locale: Locale): Familia {
  return {
    id: raw.id,
    slug: raw.slug,
    nombre: locale === 'en' ? raw.nombre_en : raw.nombre_es,
    descripcion: locale === 'en' ? raw.descripcion_en : raw.descripcion_es,
    icono: raw.icono,
    orden: raw.orden,
    activo: raw.activo,
  }
}

function mapProducto(raw: (typeof mockProductos)[0], locale: Locale): Producto {
  return {
    id: raw.id,
    slug: raw.slug,
    familia_id: raw.familia_id,
    familia_slug: raw.familia_slug,
    tipo_id: raw.tipo_id,
    nombre: locale === 'en' ? raw.nombre_en : raw.nombre_es,
    descripcion_corta: locale === 'en' ? raw.descripcion_corta_en : raw.descripcion_corta_es,
    descripcion_larga: locale === 'en' ? raw.descripcion_larga_en : raw.descripcion_larga_es,
    especificaciones: raw.especificaciones,
    imagen_principal: raw.imagen_principal,
    galeria: raw.galeria,
    ficha_pdf: raw.ficha_pdf,
    tipo_comercial: raw.tipo_comercial as Producto['tipo_comercial'],
    fulfillment_mode: raw.fulfillment_mode as Producto['fulfillment_mode'],
    precio: raw.precio,
    moneda: raw.moneda,
    stock: (raw as { stock?: number | null }).stock ?? null,
    destacado: raw.destacado,
    nuevo: raw.nuevo,
    activo: raw.activo,
    orden: raw.orden,
  }
}

/* ============================================================
   API pública
   ============================================================ */

export async function getFamilias(locale: Locale): Promise<Familia[]> {
  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!
    const { data, error } = await supabase
      .from('familias')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (error) {
      registrarErrorSupabase('getFamilias', error)
    } else if (data && data.length > 0) {
      return data.map((raw) => ({
        id: raw.id as string,
        slug: raw.slug as string,
        nombre: (locale === 'en' ? raw.nombre_en : raw.nombre_es) as string,
        descripcion: (locale === 'en' ? raw.descripcion_en : raw.descripcion_es) as string,
        orden: raw.orden as number,
        activo: raw.activo as boolean,
      }))
    } else if (data) {
      registrarVacioSupabase('getFamilias')
    }
  }
  return mockFamilias.filter((f) => f.activo).map((f) => mapFamilia(f, locale))
}

export async function getTipos(familiaSlug: string, locale: Locale): Promise<Tipo[]> {
  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!
    const { data: familiaData, error: familiaError } = await supabase
      .from('familias')
      .select('id')
      .eq('slug', familiaSlug)
      .maybeSingle()
    if (familiaError) registrarErrorSupabase('getTipos/familia', familiaError)
    if (familiaData) {
      const { data, error } = await supabase
        .from('tipos')
        .select('*')
        .eq('familia_id', familiaData.id)
        .eq('activo', true)
        .order('orden')
      if (!error && data && data.length > 0) {
        return data.map((raw) => ({
          id: raw.id as string,
          familia_id: raw.familia_id as string,
          slug: raw.slug as string,
          nombre: (locale === 'en' ? raw.nombre_en : raw.nombre_es) as string,
          orden: raw.orden as number,
          activo: raw.activo as boolean,
        }))
      }
      if (error) registrarErrorSupabase('getTipos', error)
    }
  }
  return mockTipos
    .filter((t) => {
      const familiaObj = mockFamilias.find((f) => f.slug === familiaSlug)
      return (
        familiaObj &&
        (t as { familia_id: string }).familia_id === familiaObj.id &&
        (t as { activo: boolean }).activo
      )
    })
    .map((t) => ({
      id: (t as { id: string }).id,
      familia_id: (t as { familia_id: string }).familia_id,
      slug: (t as { slug: string }).slug,
      nombre:
        (locale === 'en'
          ? (t as { nombre_en?: string }).nombre_en
          : (t as { nombre_es?: string }).nombre_es) ?? '',
      orden: (t as { orden: number }).orden,
      activo: (t as { activo: boolean }).activo,
    }))
}

export async function getProductos(filtros: FiltrosProductos, locale: Locale): Promise<Producto[]> {
  const { familia, tipo, destacado, query, page = 1, pageSize = 24 } = filtros

  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!
    await cargarMapaFamilias(supabase)
    let req = supabase.from('productos').select('*').eq('activo', true)
    if (familia) {
      const familiaId = familiaIdPorSlug?.[familia]
      // Familia sin equivalente en Supabase: no hay filas que coincidan.
      req = req.eq('familia_id', familiaId ?? '00000000-0000-0000-0000-000000000000')
    }
    if (destacado !== undefined) req = req.eq('destacado', destacado)
    req = req.order('orden').range((page - 1) * pageSize, page * pageSize - 1)
    const { data, error } = await req
    if (!error && data && data.length > 0) {
      return data.map((raw) => mapProductoSupabase(raw, locale))
    }
    if (error) registrarErrorSupabase('getProductos', error)
    else if (data && !familia) registrarVacioSupabase('getProductos')
  }

  let lista = mockProductos.filter((p) => p.activo)
  if (familia) lista = lista.filter((p) => p.familia_slug === familia)
  if (tipo) lista = lista.filter((p) => p.tipo_id === tipo)
  if (destacado !== undefined) lista = lista.filter((p) => p.destacado === destacado)
  if (query) {
    const q = query.toLowerCase()
    lista = lista.filter(
      (p) =>
        p.nombre_es.toLowerCase().includes(q) || p.descripcion_corta_es.toLowerCase().includes(q)
    )
  }
  const start = (page - 1) * pageSize
  return lista.slice(start, start + pageSize).map((p) => mapProducto(p, locale))
}

export async function getProductoBySlug(slug: string, locale: Locale): Promise<Producto | null> {
  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!
    await cargarMapaFamilias(supabase)
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('slug', slug)
      .eq('activo', true)
      .maybeSingle()
    if (!error && data) {
      return mapProductoSupabase(data, locale)
    }
    if (error) registrarErrorSupabase('getProductoBySlug', error)
  }
  const found = mockProductos.find((p) => p.slug === slug && p.activo)
  return found ? mapProducto(found, locale) : null
}

export async function getProductosDestacados(locale: Locale): Promise<Producto[]> {
  return getProductos({ destacado: true, pageSize: 12 }, locale)
}

export async function getProductosBySlugs(slugs: string[], locale: Locale): Promise<Producto[]> {
  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!
    await cargarMapaFamilias(supabase)
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .in('slug', slugs)
      .eq('activo', true)
    if (!error && data && data.length > 0) {
      return data.map((raw) => mapProductoSupabase(raw, locale))
    }
    if (error) registrarErrorSupabase('getProductosBySlugs', error)
    else if (data) registrarVacioSupabase('getProductosBySlugs')
  }
  return mockProductos
    .filter((p) => slugs.includes(p.slug) && p.activo)
    .map((p) => mapProducto(p, locale))
}

export async function buscarProductos(query: string, locale: Locale): Promise<Producto[]> {
  return getProductos({ query, pageSize: 20 }, locale)
}

export async function submitCotizacion(
  datos: CotizacionPayload
): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!
    const { error } = await supabase.from('solicitudes_cotizacion').insert({
      nombre: datos.nombre,
      empresa: datos.institucion ?? '',
      email: datos.email,
      telefono: datos.telefono,
      productos: datos.productos ?? [],
      mensaje: `[${datos.interes ?? 'General'}] ${datos.mensaje}`,
      consentimiento_datos: datos.consentimiento_datos,
      consentimiento_timestamp: new Date().toISOString(),
      leida: false,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }
  // Mock: siempre OK en desarrollo sin Supabase
  console.warn('[datos] submitCotizacion mock (sin Supabase):', datos.email)
  return { ok: true }
}
