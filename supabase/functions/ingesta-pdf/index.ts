/**
 * Edge Function: ingesta-pdf
 * Genera borrador estructurado. Nunca escribe en BD ni publica.
 *
 * Auth: JWT validado por Auth + admin_profiles activo (owner|admin|catalogo|ventas).
 * Una sesión de cuenta/tienda NO basta — evita quemar presupuesto LLM con claves de Edge.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, internalError, unauthorized } from '../_shared/errors.ts';
import { confirmarUsoLlm, createLlmGateway, reservarPresupuesto } from '../_shared/llm-gateway.ts';
import { buildIngestPrompt } from '../_shared/pdf-ingest-prompt.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { canInvokeIngestaPdf } from '../../../src/lib/ingesta-auth.ts';

interface IngestRequest {
  pdf_url?: string;
  pdf_text?: string;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const token = req.headers
    .get('Authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) return unauthorized(origin);

  try {
    const supabase = getServerSupabase();
    // Validar sesión real vía Auth (no confiar en claims JWT sin verificar).
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return unauthorized(origin);

    const { data: profile, error: profileError } = await supabase
      .from('admin_profiles')
      .select('rol, activo')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) {
      return internalError(`error consultando perfil admin: ${profileError.message}`, origin);
    }
    if (!canInvokeIngestaPdf(profile as { rol?: string | null; activo?: boolean | null } | null)) {
      return errorResponse(
        {
          code: 'FORBIDDEN',
          message: 'Se requiere perfil admin activo (catalogo, ventas, admin u owner)',
        },
        403,
        origin
      );
    }

    const body = (await req.json()) as IngestRequest;
    const pdfText = body.pdf_text?.trim() ?? '';
    const pdfUrl = body.pdf_url?.trim() ?? '';
    if (!pdfText && !pdfUrl) {
      return badRequest('Enviar pdf_text o pdf_url', origin);
    }

    const gateway = createLlmGateway();
    const systemPrompt =
      'Extrae un borrador JSON bilingue para catalogo medico B2B con landing enriquecida (beneficios, valor institucional, SEO). Devuelve solo JSON valido. No inventes datos. Campo no presente: valor vacio, origen="ausente", requiere_revision=true. Genera producto_es desde el PDF y producto_en_borrador solo como traduccion al ingles de datos extraidos. La traduccion EN es borrador y todos sus campos requieren_revision=true.';
    const userPrompt = buildIngestPrompt(pdfText, pdfUrl);

    const reserva = await reservarPresupuesto(supabase, {
      proveedor: gateway.provider,
      modelo: gateway.defaultChatModel,
      tipo: 'ingesta',
      approxInputChars: systemPrompt.length + userPrompt.length,
      maxOutputTokens: 4500,
      sessionId: user.id,
    });
    if (!reserva.disponible) {
      return badRequest(
        `BLOQUEANTE_BACKEND: presupuesto LLM mensual agotado ` +
          `($${reserva.gastado.toFixed(2)} / $${reserva.limite} en ${reserva.periodo}). ` +
          `Ingesta PDF detenida.`,
        origin
      );
    }

    const response = await gateway.chat({
      maxTokens: 4500,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    if (reserva.reservaId) {
      await confirmarUsoLlm(supabase, {
        reservaId: reserva.reservaId,
        proveedor: gateway.provider,
        modelo: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      });
    }

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
      beneficios: Array.isArray(productoEs['beneficios']) ? productoEs['beneficios'] : [],
      valor_institucional: revisableValue(productoEs['valor_institucional'], 'ausente'),
      marca: revisableValue(productoEs['marca'], 'ausente'),
      seo_keywords: Array.isArray(productoEs['seo_keywords']) ? productoEs['seo_keywords'] : [],
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
      beneficios: Array.isArray(productoEn['beneficios'])
        ? productoEn['beneficios'].map(item => revisableValue(item, 'ausente', true))
        : [],
      valor_institucional: revisableValue(productoEn['valor_institucional'], 'ausente', true),
      seo_keywords: Array.isArray(productoEn['seo_keywords'])
        ? productoEn['seo_keywords'].map(item => revisableValue(item, 'ausente', true))
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
      beneficios: [],
      valor_institucional: revisableValue(undefined, 'ausente'),
      marca: revisableValue(undefined, 'ausente'),
      seo_keywords: [],
      meta_seo: {},
    },
    producto_en_borrador: {
      nombre: revisableValue(undefined, 'ausente', true),
      descripcion_corta: revisableValue(undefined, 'ausente', true),
      descripcion_larga: revisableValue(undefined, 'ausente', true),
      aplicaciones: [],
      beneficios: [],
      valor_institucional: revisableValue(undefined, 'ausente', true),
      seo_keywords: [],
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
