/**
 * Asesor comercial RAG — cliente de la Edge Function `asesor`.
 *
 * REGLA RECTORA: asesor comercial, no clínico. Solo recomienda productos
 * recuperados del catálogo y solo afirma datos reales.
 */

import { getSupabaseClient } from './supabase'
import type { Locale } from '../i18n/utils'

export interface MensajeAsesor {
  rol: 'usuario' | 'asesor'
  contenido: string
  timestamp: Date
}

export type ModoAsesor = 'rag' | 'keyword_degradado' | 'sin_resultados'
export type TipoHandoff = 'whatsapp' | 'cotizacion'

export interface ProductoSugerido {
  slug: string
  nombre: string
  imagen: string | null
  urlLanding: string
  score: number
}

export interface AccionHandoff {
  tipo: TipoHandoff
  resumen: string
}

export interface RespuestaAsesor {
  texto: string
  productos: ProductoSugerido[]
  accionHandoff: AccionHandoff | null
  modo: ModoAsesor
}

export type ErrorAsesor =
  | { tipo: 'rate_limited'; retryAfterSegundos: number | null }
  | { tipo: 'no_disponible' }
  | { tipo: 'error' }

export type ResultadoAsesor =
  | { ok: true; respuesta: RespuestaAsesor }
  | { ok: false; error: ErrorAsesor }

interface AsesorApiResponse {
  texto: string
  productos: Array<{
    slug: string
    nombre: string
    imagen: string | null
    url_landing: string
    score: number
  }>
  accion_handoff: { tipo: TipoHandoff; resumen: string } | null
  modo: ModoAsesor
}

const SESSION_STORAGE_KEY = 'ime_asesor_session'

/** Identificador de sesión persistido en localStorage, usado para rate-limit y métricas. */
export function getSessionId(): string {
  try {
    const existente = localStorage.getItem(SESSION_STORAGE_KEY)
    if (existente) return existente
    const nuevo = crypto.randomUUID()
    localStorage.setItem(SESSION_STORAGE_KEY, nuevo)
    return nuevo
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * Consulta al Asesor RAG. Devuelve un resultado tipado con error explícito
 * (rate-limit, no disponible, error genérico) para que la UI elija el estado adecuado.
 */
export async function preguntarAsesor(params: {
  mensaje: string
  historial: MensajeAsesor[]
  locale: Locale
  turnstileToken?: string | undefined
}): Promise<ResultadoAsesor> {
  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, error: { tipo: 'no_disponible' } }

  const historial = params.historial.slice(-8).map((m) => ({ rol: m.rol, contenido: m.contenido }))

  const { data, error } = await supabase.functions.invoke('asesor', {
    body: {
      mensaje: params.mensaje,
      historial,
      locale: params.locale,
      turnstileToken: params.turnstileToken,
      sessionId: getSessionId(),
    },
  })

  if (error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      if (context.status === 429) {
        const retryAfter = context.headers.get('Retry-After')
        return {
          ok: false,
          error: {
            tipo: 'rate_limited',
            retryAfterSegundos: retryAfter ? Number(retryAfter) : null,
          },
        }
      }
      if (context.status === 503) return { ok: false, error: { tipo: 'no_disponible' } }
    }
    return { ok: false, error: { tipo: 'error' } }
  }

  if (!data) return { ok: false, error: { tipo: 'error' } }
  const json = data as AsesorApiResponse

  return {
    ok: true,
    respuesta: {
      texto: json.texto,
      productos: (json.productos ?? []).map((p) => ({
        slug: p.slug,
        nombre: p.nombre,
        imagen: p.imagen,
        urlLanding: p.url_landing,
        score: p.score,
      })),
      accionHandoff: json.accion_handoff,
      modo: json.modo,
    },
  }
}
