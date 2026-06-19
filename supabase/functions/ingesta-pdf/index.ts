/**
 * Edge Function: ingesta-pdf
 * Genera borrador estructurado. Nunca escribe en BD ni publica.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { createLlmGateway } from '../_shared/llm-gateway.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';

interface IngestRequest {
  pdf_url?: string;
  pdf_text?: string;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return unauthorized(origin);

  try {
    const supabase = getServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return unauthorized(origin);

    const body = (await req.json()) as IngestRequest;
    const pdfText = body.pdf_text?.trim() ?? '';
    const pdfUrl = body.pdf_url?.trim() ?? '';
    if (!pdfText && !pdfUrl) {
      return badRequest('Enviar pdf_text o pdf_url', origin);
    }

    const gateway = createLlmGateway();
    const response = await gateway.chat({
      maxTokens: 4500,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Extrae un borrador JSON bilingue para catalogo medico B2B. Devuelve solo JSON valido. No inventes datos. Campo no presente: valor vacio, origen="ausente", requiere_revision=true. Genera producto_es desde el PDF y producto_en_borrador solo como traduccion al ingles de datos extraidos. La traduccion EN es borrador y todos sus campos requieren_revision=true.',
        },
        {
          role: 'user',
          content: buildPrompt(pdfText, pdfUrl),
        },
      ],
    });

    return new Response(normalizeJson(response.content, response.model), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin),
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'ingesta-pdf error', origin);
  }
});

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
  "producto_en_borrador": {
    "nombre": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_corta": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_larga": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "aplicaciones": [{"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true}],
    "meta_seo": {"title": "", "description": ""}
  },
  "campos_confianza": [],
  "ausentes": [],
  "advertencias": [],
  "raw_model_id": ""
}

Reglas EN:
- Traduce al ingles solo los campos presentes en producto_es.
- Conserva marcas, modelos, unidades, cifras, certificaciones y nombres tecnicos sin alterarlos.
- Si el dato fuente esta ausente en ES, deja el campo EN vacio con origen="ausente".
- Marca siempre los campos EN con requiere_revision=true.`;
}

function normalizeJson(content: string, model: string): string {
  const jsonText = extractJson(content);
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return JSON.stringify(normalizeDraftShape(parsed, model));
  } catch {
    return JSON.stringify({
      ...emptyDraftShape(model),
      campos_confianza: [],
      ausentes: [],
      advertencias: ['El modelo no devolvio JSON valido; revisar salida cruda.'],
      raw_output: content,
    });
  }
}

function normalizeDraftShape(
  parsed: Record<string, unknown>,
  model: string
): Record<string, unknown> {
  const base = emptyDraftShape(model);
  const productoEs = objectValue(parsed['producto_es']);
  const productoEn = objectValue(parsed['producto_en_borrador']);

  return {
    ...parsed,
    producto_es: {
      ...objectValue(base['producto_es']),
      ...productoEs,
      nombre: revisableValue(productoEs['nombre'], 'ausente'),
      familia_sugerida: revisableValue(productoEs['familia_sugerida'], 'ausente'),
      tipo_sugerido: revisableValue(productoEs['tipo_sugerido'], 'ausente'),
      descripcion_corta: revisableValue(productoEs['descripcion_corta'], 'ausente'),
      descripcion_larga: revisableValue(productoEs['descripcion_larga'], 'ausente'),
      especificaciones: Array.isArray(productoEs['especificaciones'])
        ? productoEs['especificaciones']
        : [],
      aplicaciones: Array.isArray(productoEs['aplicaciones']) ? productoEs['aplicaciones'] : [],
      meta_seo: objectValue(productoEs['meta_seo']),
    },
    producto_en_borrador: {
      ...objectValue(base['producto_en_borrador']),
      ...productoEn,
      nombre: revisableValue(productoEn['nombre'], 'ausente', true),
      descripcion_corta: revisableValue(productoEn['descripcion_corta'], 'ausente', true),
      descripcion_larga: revisableValue(productoEn['descripcion_larga'], 'ausente', true),
      aplicaciones: Array.isArray(productoEn['aplicaciones'])
        ? productoEn['aplicaciones'].map(item => revisableValue(item, 'ausente', true))
        : [],
      meta_seo: objectValue(productoEn['meta_seo']),
    },
    campos_confianza: Array.isArray(parsed['campos_confianza']) ? parsed['campos_confianza'] : [],
    ausentes: Array.isArray(parsed['ausentes']) ? parsed['ausentes'] : [],
    advertencias: Array.isArray(parsed['advertencias']) ? parsed['advertencias'] : [],
    raw_model_id: parsed['raw_model_id'] || model,
  };
}

function emptyDraftShape(model: string): Record<string, unknown> {
  return {
    producto_es: {
      nombre: revisableValue(undefined, 'ausente'),
      familia_sugerida: revisableValue(undefined, 'ausente'),
      tipo_sugerido: revisableValue(undefined, 'ausente'),
      descripcion_corta: revisableValue(undefined, 'ausente'),
      descripcion_larga: revisableValue(undefined, 'ausente'),
      especificaciones: [],
      aplicaciones: [],
      meta_seo: {},
    },
    producto_en_borrador: {
      nombre: revisableValue(undefined, 'ausente', true),
      descripcion_corta: revisableValue(undefined, 'ausente', true),
      descripcion_larga: revisableValue(undefined, 'ausente', true),
      aplicaciones: [],
      meta_seo: {},
    },
    campos_confianza: [],
    ausentes: [],
    advertencias: [],
    raw_model_id: model,
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function revisableValue(
  value: unknown,
  defaultOrigin: string,
  forceReview = false
): Record<string, unknown> {
  const obj = objectValue(value);
  return {
    valor: typeof obj['valor'] === 'string' ? obj['valor'] : '',
    origen: typeof obj['origen'] === 'string' ? obj['origen'] : defaultOrigin,
    confianza: typeof obj['confianza'] === 'number' ? obj['confianza'] : 0,
    requiere_revision: forceReview ? true : obj['requiere_revision'] !== false,
  };
}

function extractJson(content: string): string {
  const clean = content.trim();
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  if (fenced) return fenced;

  const firstObject = clean.indexOf('{');
  const lastObject = clean.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) return clean.slice(firstObject, lastObject + 1);

  return clean;
}
