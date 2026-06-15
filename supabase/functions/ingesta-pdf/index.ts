/**
 * Edge Function: ingesta-pdf
 * Genera borrador estructurado. Nunca escribe en BD ni publica.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts'
import { createLlmGateway } from '../_shared/llm-gateway.ts'
import { getServerSupabase } from '../_shared/supabase-server.ts'

interface IngestRequest {
  pdf_url?: string
  pdf_text?: string
}

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
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return unauthorized(origin)

    const body = (await req.json()) as IngestRequest
    const pdfText = body.pdf_text?.trim() ?? ''
    const pdfUrl = body.pdf_url?.trim() ?? ''
    if (!pdfText && !pdfUrl) {
      return badRequest('Enviar pdf_text o pdf_url', origin)
    }

    const gateway = createLlmGateway()
    const response = await gateway.chat({
      maxTokens: 4500,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Extrae un borrador JSON para catalogo medico B2B. Devuelve solo JSON valido. No inventes datos. Campo no presente: valor vacio, origen="ausente", requiere_revision=true. La traduccion EN es borrador y requiere_revision=true.',
        },
        {
          role: 'user',
          content: buildPrompt(pdfText, pdfUrl),
        },
      ],
    })

    return new Response(normalizeJson(response.content, response.model), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin),
      },
    })
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'ingesta-pdf error', origin)
  }
})

function buildPrompt(pdfText: string, pdfUrl: string): string {
  return `Fuente PDF: ${pdfUrl || 'texto pegado por admin'}

Texto disponible:
${pdfText || '[No se proporciono texto extraido. Marca todos los campos como ausentes y agrega advertencia de que se requiere extraer texto/OCR del PDF antes de validar.]'}

Estructura requerida:
{
  "producto_es": {
    "nombre": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "familia_sugerida": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "tipo_sugerido": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_corta": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_larga": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "especificaciones": [{"clave": "", "valor": "", "grupo": "", "origen": "pdf", "confianza": 0, "requiere_revision": true}],
    "aplicaciones": [{"valor": "", "origen": "pdf", "confianza": 0, "requiere_revision": true}],
    "meta_seo": {"title": "", "description": ""}
  },
  "producto_en_borrador": {},
  "campos_confianza": [],
  "ausentes": [],
  "advertencias": [],
  "raw_model_id": ""
}`
}

function normalizeJson(content: string, model: string): string {
  const jsonText = extractJson(content)
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    parsed['raw_model_id'] = parsed['raw_model_id'] || model
    return JSON.stringify(parsed)
  } catch {
    return JSON.stringify({
      producto_es: {},
      producto_en_borrador: {},
      campos_confianza: [],
      ausentes: [],
      advertencias: ['El modelo no devolvio JSON valido; revisar salida cruda.'],
      raw_model_id: model,
      raw_output: content,
    })
  }
}

function extractJson(content: string): string {
  const clean = content.trim()
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim()
  if (fenced) return fenced

  const firstObject = clean.indexOf('{')
  const lastObject = clean.lastIndexOf('}')
  if (firstObject >= 0 && lastObject > firstObject) return clean.slice(firstObject, lastObject + 1)

  return clean
}
