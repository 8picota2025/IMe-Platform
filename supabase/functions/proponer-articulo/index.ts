import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError } from '../_shared/errors.ts';
import { createLogger, generateRequestId } from '../_shared/logging.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';

const FN_NAME = 'proponer-articulo';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PropuestaBody {
  titulo?: string;
  resumen?: string;
  cuerpo_md?: string;
  autor_nombre?: string;
  autor_email?: string;
  autor_tipo?: 'cliente' | 'fabricante';
  autor_empresa?: string;
  autor_nit?: string;
  consentimiento_datos?: boolean;
  turnstileToken?: string;
}

function stripHtml(value: string): string {
  return value.replace(/<\/?[^>\n]+>/g, '');
}

function sanitizePlainText(value: unknown, maxLength: number): string {
  return stripHtml(String(value ?? ''))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function sanitizeMarkdown(value: unknown, maxLength: number): string {
  return stripHtml(String(value ?? ''))
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    const supabase = getServerSupabase();
    const requestId = generateRequestId();
    const logger = createLogger({ function: FN_NAME, requestId });

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'desconocida';

    const turnstileHeader = req.headers.get('x-turnstile-token');
    const body = (await req.json().catch(() => ({}))) as PropuestaBody;

    const turnstile = await verifyTurnstile(turnstileHeader ?? body.turnstileToken, ip);
    if (!turnstile.success) {
      logger.warn('Turnstile invalido en propuesta de articulo', { ip, reason: turnstile.reason });
      return new Response(
        JSON.stringify({ ok: false, error: 'No se pudo completar la verificacion de seguridad.' }),
        {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        }
      );
    }

    const limite = await checkRateLimit(supabase, `articulo:ip:${ip}`, 'cotizacion');
    if (limite.limited) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Demasiadas solicitudes, intenta mas tarde.' }),
        {
          status: 429,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        }
      );
    }

    const titulo = sanitizePlainText(body.titulo, 180);
    const resumen = sanitizePlainText(body.resumen, 600);
    const cuerpoMd = sanitizeMarkdown(body.cuerpo_md, 16000);
    const autorNombre = sanitizePlainText(body.autor_nombre, 160);
    const autorEmail = sanitizePlainText(body.autor_email, 200).toLowerCase();
    const autorTipo = body.autor_tipo === 'fabricante' ? 'fabricante' : body.autor_tipo;
    const autorEmpresa = sanitizePlainText(body.autor_empresa, 180);
    const autorNit = sanitizePlainText(body.autor_nit, 40);

    if (!titulo || titulo.length < 12) {
      return badRequest('titulo invalido', origin);
    }
    if (!resumen || resumen.length < 40) {
      return badRequest('resumen invalido', origin);
    }
    if (!cuerpoMd || cuerpoMd.length < 300) {
      return badRequest('cuerpo_md invalido', origin);
    }
    if (!autorNombre) return badRequest('autor_nombre requerido', origin);
    if (!EMAIL_RE.test(autorEmail)) return badRequest('autor_email invalido', origin);
    if (autorTipo !== 'cliente' && autorTipo !== 'fabricante') {
      return badRequest('autor_tipo invalido', origin);
    }
    if (body.consentimiento_datos !== true) {
      return badRequest('consentimiento_datos es obligatorio', origin);
    }

    const { error } = await supabase.from('articulos_propuestos').insert({
      titulo,
      resumen,
      cuerpo_md: cuerpoMd,
      autor_nombre: autorNombre,
      autor_email: autorEmail,
      autor_tipo: autorTipo,
      autor_empresa: autorEmpresa || null,
      autor_nit: autorNit || null,
      estado: 'pendiente',
    });

    if (error) {
      logger.error('Error insertando articulo propuesto', new Error(error.message), {
        ip,
        autorTipo,
      });
      return internalError('No se pudo registrar la propuesta', origin);
    }

    void trackEvent(FN_NAME, 'articulo_propuesto', { autor_tipo: autorTipo });
    logger.info('Articulo propuesto registrado', { ip, autorTipo });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  })
);
