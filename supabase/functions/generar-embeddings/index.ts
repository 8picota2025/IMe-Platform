/**
 * Edge Function: generar-embeddings
 * Genera/actualiza productos.embedding (Asesor RAG). Idempotente.
 * Requiere usuario autenticado (admin).
 *
 * Body:
 * - { producto_id }       → un producto
 * - { producto_ids: [] }  → lote de productos
 * - { todos: true }       → todos los productos activos (reindexar)
 * - { ...; estimar: true } → solo estima coste, no escribe ni llama al proveedor
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts'
import { getServerSupabase } from '../_shared/supabase-server.ts'
import {
  createEmbedder,
  normalizeEmbeddingInput,
  type ProductoEmbeddingInput,
} from '../_shared/embeddings.ts'
import { enforceBudget, estimateCost, registrarUsoLlm } from '../_shared/llm-gateway.ts'

type ServerSupabase = ReturnType<typeof getServerSupabase>

interface GenerarEmbeddingsRequest {
  producto_id?: string
  producto_ids?: string[]
  todos?: boolean
  estimar?: boolean
}

interface ProductoRow extends ProductoEmbeddingInput {
  id: string
  slug: string
}

interface ProductoRawRow {
  id: string
  slug: string
  nombre_es: string
  nombre_en: string | null
  descripcion_corta_es: string | null
  descripcion_corta_en: string | null
  descripcion_larga_es: string | null
  descripcion_larga_en: string | null
  especificaciones: Array<{ clave?: string; valor?: string; grupo?: string }> | null
  aplicaciones_es: string[] | null
  aplicaciones_en: string[] | null
  familias: { nombre_es: string | null; nombre_en: string | null } | null
  tipos: { nombre_es: string | null; nombre_en: string | null } | null
}

const BATCH_SIZE = 20

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsRes = handleCors(req)
  if (corsRes) return corsRes
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin)

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return unauthorized(origin)

  try {
    const supabase = getServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) return unauthorized(origin)

    const body = (await req.json().catch(() => ({}))) as GenerarEmbeddingsRequest
    if (!body.producto_id && !body.producto_ids?.length && !body.todos) {
      return badRequest('Especificar producto_id, producto_ids o todos=true', origin)
    }

    const productos = await cargarProductos(supabase, body)
    if (productos.length === 0) {
      return ok(origin, { procesados: 0, omitidos: 0, coste_estimado: 0 })
    }

    const textos = productos.map((producto) => normalizeEmbeddingInput(producto))
    const embedder = createEmbedder()

    if (body.estimar) {
      const totalChars = textos.reduce((acc, texto) => acc + texto.length, 0)
      const tokensEstimados = Math.ceil(totalChars / 4)
      return ok(origin, {
        estimar: true,
        productos_a_procesar: productos.length,
        tokens_estimados: tokensEstimados,
        coste_estimado: estimateCost({
          model: embedder.model,
          provider: embedder.provider,
          inputTokens: tokensEstimados,
        }),
        modelo: embedder.model,
        proveedor: embedder.provider,
      })
    }

    const presupuesto = await enforceBudget(supabase)
    if (!presupuesto.disponible) {
      return badRequest(
        `BLOQUEANTE_BACKEND: presupuesto LLM mensual agotado ` +
          `($${presupuesto.gastado.toFixed(2)} / $${presupuesto.limite} en ${presupuesto.periodo}). ` +
          `Generacion de embeddings detenida.`,
        origin
      )
    }

    let procesados = 0
    let costeTotal = 0
    const errores: Array<{ producto_id: string; error: string }> = []

    for (let i = 0; i < productos.length; i += BATCH_SIZE) {
      const lote = productos.slice(i, i + BATCH_SIZE)
      const loteTextos = textos.slice(i, i + BATCH_SIZE)

      try {
        const resultado = await embedder.embed(loteTextos)
        if (resultado.vectors.length !== lote.length) {
          throw new Error('Respuesta de embeddings con longitud inesperada')
        }

        for (let j = 0; j < lote.length; j++) {
          const producto = lote[j]!
          const { error: updateError } = await supabase
            .from('productos')
            .update({ embedding: resultado.vectors[j] })
            .eq('id', producto.id)
          if (updateError) throw new Error(updateError.message)
          procesados++
        }

        costeTotal += await registrarUsoLlm(supabase, {
          proveedor: resultado.provider,
          modelo: resultado.model,
          tipo: 'embedding',
          inputTokens: resultado.inputTokens,
        })
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'embedding error'
        for (const producto of lote) {
          errores.push({ producto_id: producto.id, error: mensaje })
        }
      }
    }

    return ok(origin, {
      procesados,
      omitidos: errores.length,
      coste_estimado: Number(costeTotal.toFixed(6)),
      errores,
    })
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'generar-embeddings error',
      origin
    )
  }
})

async function cargarProductos(
  supabase: ServerSupabase,
  body: GenerarEmbeddingsRequest
): Promise<ProductoRow[]> {
  let query = supabase.from('productos').select(
    `id, slug, nombre_es, nombre_en, descripcion_corta_es, descripcion_corta_en,
     descripcion_larga_es, descripcion_larga_en, especificaciones, aplicaciones_es, aplicaciones_en,
     familias(nombre_es, nombre_en), tipos(nombre_es, nombre_en)`
  )

  if (body.producto_id) {
    query = query.eq('id', body.producto_id)
  } else if (body.producto_ids?.length) {
    query = query.in('id', body.producto_ids)
  } else {
    query = query.eq('activo', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as ProductoRawRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    nombre_es: row.nombre_es,
    nombre_en: row.nombre_en,
    descripcion_corta_es: row.descripcion_corta_es,
    descripcion_corta_en: row.descripcion_corta_en,
    descripcion_larga_es: row.descripcion_larga_es,
    descripcion_larga_en: row.descripcion_larga_en,
    especificaciones: row.especificaciones,
    aplicaciones_es: row.aplicaciones_es,
    aplicaciones_en: row.aplicaciones_en,
    familia_nombre_es: row.familias?.nombre_es ?? null,
    familia_nombre_en: row.familias?.nombre_en ?? null,
    tipo_nombre_es: row.tipos?.nombre_es ?? null,
    tipo_nombre_en: row.tipos?.nombre_en ?? null,
  }))
}

function ok(origin: string | null, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  })
}
