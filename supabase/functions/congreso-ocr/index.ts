import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { extractQuoteFromImage } from '../_shared/vision-quote-ocr.ts';

const BUCKET = 'presupuestos-competencia';
const MAX_BYTES = 8 * 1024 * 1024;
const ROLES = new Set(['ventas', 'admin', 'owner']);

function response(body: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return unauthorized(origin);
  const supabase = getServerSupabase();
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return unauthorized(origin);
  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('rol,activo')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!profile || profile.activo !== true || !ROLES.has(profile.rol)) return unauthorized(origin);
  // Same accion bucket as comercial-ocr-presupuesto / congreso-lead.
  // 'ocr' is not a RateLimitAccion — THRESHOLDS['ocr'] threw TypeError on every request.
  const limit = await checkRateLimit(supabase, `congreso-ocr:${auth.user.id}`, 'cotizacion');
  if (limit.limited)
    return response({ ok: false, error: 'Demasiados OCR. Espera un momento.' }, origin, 429);
  const body = (await req.json().catch(() => ({}))) as { image_base64?: string; mime?: string };
  const base64 = typeof body.image_base64 === 'string' ? body.image_base64 : '';
  const mime =
    typeof body.mime === 'string' && /^image\/(jpeg|png|webp|heic|heif)$/.test(body.mime)
      ? body.mime
      : 'image/jpeg';
  if (!base64) return badRequest('Imagen requerida', origin);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  } catch {
    return badRequest('Imagen invalida', origin);
  }
  if (bytes.byteLength > MAX_BYTES) return badRequest('Imagen demasiado grande', origin);
  const path = `congreso/${auth.user.id}/${crypto.randomUUID()}.${mime.split('/')[1] ?? 'jpg'}`;
  const uploaded = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (uploaded.error)
    return internalError(`No se pudo preparar OCR: ${uploaded.error.message}`, origin);
  try {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    const extracted = await extractQuoteFromImage('', mime, { imageUrl: signed.data?.signedUrl });
    const source = extracted.extract;
    return response(
      {
        ok: true,
        extract: {
          nombres: source.cliente_nombre.split(/\s+/).slice(0, -1).join(' '),
          apellidos: source.cliente_nombre.split(/\s+/).slice(-1).join(' '),
          institucion: source.cliente_empresa,
          email: source.cliente_email,
          telefono: source.cliente_telefono,
        },
      },
      origin
    );
  } catch (error) {
    return response(
      { ok: false, error: error instanceof Error ? error.message : 'OCR fallo' },
      origin,
      422
    );
  } finally {
    await supabase.storage.from(BUCKET).remove([path]);
  }
});
