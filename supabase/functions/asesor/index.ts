/**
 * Edge Function `asesor` — IMEIA (v3, 2026-07-03).
 *
 * Sustituye el pipeline RAG local (embeddings pgvector + Ollama) por el agente
 * IMEIA servido en infraestructura propia (Hermes + base documental del
 * catálogo). Esta función queda como fachada segura: valida entrada, anti-bot
 * (Turnstile), rate-limit por IP/sesión, responde consultas de sitio/legales
 * con el fallback estático y delega el resto en IMEIA vía API
 * OpenAI-compatible. Mantiene EXACTAMENTE el contrato de respuesta que
 * consume src/lib/asesor.ts (texto, productos[], accion_handoff, modo).
 *
 * Secretos (supabase secrets):
 *  - IMEIA_API_URL  p. ej. https://<tunel>.trycloudflare.com
 *  - IMEIA_API_KEY  API key del gateway Hermes (Bearer)
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  buildAsesorStaticFallback,
  esConsultaSitioOLegal,
} from '../../../src/lib/asesor-knowledge.ts';

type Locale = 'es' | 'en';
type Modo = 'rag' | 'keyword_degradado' | 'sin_resultados';
type TipoHandoff = 'whatsapp' | 'cotizacion' | 'compra';

interface HistorialItem {
  rol: 'usuario' | 'asesor';
  contenido: string;
}

interface AsesorRequest {
  mensaje?: string;
  historial?: HistorialItem[];
  locale?: Locale;
  turnstileToken?: string;
  sessionId?: string;
}

interface ProductoTarjeta {
  slug: string;
  nombre: string;
  imagen: string | null;
  url_landing: string;
  score: number;
}

interface AccionHandoff {
  tipo: TipoHandoff;
  resumen: string;
}

interface AsesorResponse {
  texto: string;
  productos: ProductoTarjeta[];
  accion_handoff: AccionHandoff | null;
  modo: Modo;
}

const MAX_MENSAJE_CHARS = 1000;
const MAX_HISTORIAL_TURNOS = 8;
const MAX_HISTORIAL_CHARS = 4000;
const IMEIA_TIMEOUT_MS = 110_000;
const MAX_TARJETAS = 4;

function periodoActual(): string {
  return new Date().toISOString().slice(0, 7);
}

Deno.serve(async req => {
  const inicio = Date.now();
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  let body: AsesorRequest;
  try {
    body = (await req.json()) as AsesorRequest;
  } catch {
    return badRequest('JSON invalido', origin);
  }

  const mensaje = body.mensaje?.trim() ?? '';
  if (!mensaje) return badRequest('mensaje requerido', origin);
  if (mensaje.length > MAX_MENSAJE_CHARS) {
    return badRequest(`mensaje supera ${MAX_MENSAJE_CHARS} caracteres`, origin);
  }

  const locale: Locale = body.locale === 'en' ? 'en' : 'es';
  const sessionId = (body.sessionId?.trim() || crypto.randomUUID()).slice(0, 128);
  const historial = normalizarHistorial(body.historial);

  const supabase = getServerSupabase();
  const ip = obtenerIp(req);

  // Anti-bot: falla cerrado, sin gastar presupuesto LLM.
  const turnstile = await verifyTurnstile(body.turnstileToken, ip);
  if (!turnstile.success) {
    if (turnstile.reason === 'not_configured') {
      return errorResponse(
        {
          code: 'NOT_CONFIGURED',
          message: 'BLOQUEANTE_BACKEND: TURNSTILE_SECRET_KEY no configurado',
        },
        503,
        origin
      );
    }
    return errorResponse(
      { code: 'FORBIDDEN', message: 'Verificacion anti-bot fallida' },
      403,
      origin
    );
  }

  // Rate-limit por IP y por sesion.
  const limitIp = await checkRateLimit(supabase, `ip:${ip}`);
  const limitSesion = await checkRateLimit(supabase, `session:${sessionId}`);
  const limitado = limitIp.limited ? limitIp : limitSesion;
  if (limitado.limited) {
    return new Response(
      JSON.stringify({
        error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta mas tarde' },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin),
          ...(limitado.retryAfterSeconds
            ? { 'Retry-After': String(limitado.retryAfterSeconds) }
            : {}),
        },
      }
    );
  }

  // Consultas de sitio/legales: respuesta estática sin coste LLM.
  const fallbackSitio = esConsultaSitioOLegal(mensaje)
    ? buildAsesorStaticFallback(locale, mensaje)
    : null;
  if (fallbackSitio) {
    await registrarUso(supabase, {
      sessionId,
      locale,
      historial,
      tokens: 0,
      latenciaMs: Date.now() - inicio,
      handoff: null,
    });
    return respuestaOk(
      { texto: fallbackSitio, productos: [], accion_handoff: null, modo: 'rag' },
      origin
    );
  }

  // Delegación en IMEIA.
  const apiUrl = Deno.env.get('IMEIA_API_URL')?.replace(/\/$/, '');
  const apiKey = Deno.env.get('IMEIA_API_KEY');
  if (!apiUrl || !apiKey) {
    return errorResponse(
      {
        code: 'NOT_CONFIGURED',
        message: 'BLOQUEANTE_BACKEND: IMEIA_API_URL/IMEIA_API_KEY no configurados',
      },
      503,
      origin
    );
  }

  try {
    const messages = [
      ...historial.map(h => ({
        role: h.rol === 'usuario' ? 'user' : 'assistant',
        content: h.contenido,
      })),
      { role: 'user', content: mensaje },
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMEIA_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: 'imeia', messages }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new Error(`IMEIA HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const texto = data.choices?.[0]?.message?.content?.trim();
    if (!texto) throw new Error('IMEIA sin contenido');

    const productos = await construirTarjetas(supabase, texto, locale);
    const accionHandoff = detectarHandoff(texto, mensaje);
    const tokens = data.usage?.total_tokens ?? 0;

    await registrarUso(supabase, {
      sessionId,
      locale,
      historial,
      tokens,
      latenciaMs: Date.now() - inicio,
      handoff: accionHandoff?.tipo ?? null,
    });

    return respuestaOk({ texto, productos, accion_handoff: accionHandoff, modo: 'rag' }, origin);
  } catch (err) {
    console.error('[asesor] IMEIA no disponible:', err instanceof Error ? err.message : err);
    return errorResponse({ code: 'UNAVAILABLE', message: 'Asesor no disponible' }, 503, origin);
  }
});

function respuestaOk(payload: AsesorResponse, origin: string | null): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function obtenerIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const primera = xff.split(',')[0]?.trim();
    if (primera) return primera;
  }
  return req.headers.get('cf-connecting-ip') ?? 'desconocida';
}

function normalizarHistorial(historial: HistorialItem[] | undefined): HistorialItem[] {
  if (!Array.isArray(historial)) return [];
  const recortado = historial
    .filter(
      h => h && (h.rol === 'usuario' || h.rol === 'asesor') && typeof h.contenido === 'string'
    )
    .slice(-MAX_HISTORIAL_TURNOS * 2);
  let total = 0;
  const resultado: HistorialItem[] = [];
  for (let i = recortado.length - 1; i >= 0; i--) {
    const item = recortado[i]!;
    const contenido = item.contenido.slice(0, MAX_MENSAJE_CHARS);
    total += contenido.length;
    if (total > MAX_HISTORIAL_CHARS) break;
    resultado.unshift({ rol: item.rol, contenido });
  }
  return resultado;
}

/**
 * Extrae slugs de producto de los enlaces que IMEIA incluye en su texto
 * (https://i-me.com.co/es/productos/<slug>) y construye tarjetas con datos
 * reales de la tabla productos. Best-effort: un fallo aquí no rompe la respuesta.
 */
async function construirTarjetas(
  supabase: ReturnType<typeof getServerSupabase>,
  texto: string,
  locale: Locale
): Promise<ProductoTarjeta[]> {
  try {
    const slugs = [
      ...new Set(
        Array.from(texto.matchAll(/i-me\.com\.co\/es\/productos\/([a-z0-9-]+)/g), m => m[1]!)
      ),
    ].slice(0, MAX_TARJETAS);
    if (slugs.length === 0) return [];

    const { data, error } = await supabase
      .from('productos')
      .select('slug, nombre_es, nombre_en, imagen_principal')
      .in('slug', slugs);
    if (error || !data) return [];

    const porSlug = new Map(data.map(p => [p.slug as string, p]));
    return slugs
      .filter(s => porSlug.has(s))
      .map((s, i) => {
        const p = porSlug.get(s)!;
        const nombre =
          locale === 'en'
            ? ((p.nombre_en as string | null) ?? (p.nombre_es as string))
            : (p.nombre_es as string);
        return {
          slug: s,
          nombre,
          imagen: (p.imagen_principal as string | null) ?? null,
          url_landing: locale === 'en' ? `/en/products/${s}` : `/es/productos/${s}`,
          score: 1 - i * 0.05,
        };
      });
  } catch {
    return [];
  }
}

/** Heurística de handoff sobre el texto de IMEIA (su SOUL ofrece WhatsApp/cotización). */
function detectarHandoff(texto: string, mensaje: string): AccionHandoff | null {
  const resumen = mensaje.slice(0, 200);
  if (/whatsapp/i.test(texto)) return { tipo: 'whatsapp', resumen };
  if (/cotizaci[oó]n|cotizarle|solicitud de cotizaci/i.test(texto)) {
    return { tipo: 'cotizacion', resumen };
  }
  return null;
}

async function registrarUso(
  supabase: ReturnType<typeof getServerSupabase>,
  params: {
    sessionId: string;
    locale: Locale;
    historial: HistorialItem[];
    tokens: number;
    latenciaMs: number;
    handoff: TipoHandoff | null;
  }
): Promise<void> {
  try {
    await supabase.from('asesor_uso').insert({
      session_id: params.sessionId,
      locale: params.locale,
      modo: 'rag',
      turnos: params.historial.filter(h => h.rol === 'usuario').length + 1,
      tokens_totales: params.tokens,
      coste_estimado: 0,
      latencia_ms: params.latenciaMs,
      hubo_handoff: params.handoff !== null,
      tipo_handoff: params.handoff,
      periodo_yyyy_mm: periodoActual(),
    });
  } catch (err) {
    console.error('[asesor] registrarUso fallo:', err instanceof Error ? err.message : err);
  }
}
