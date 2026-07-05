/**
 * Registra una resena de producto (pendiente de moderacion en el admin).
 * Publica con rate-limit; nunca se publica sin aprobacion.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

interface CrearResenaBody {
  producto_slug?: string;
  nombre?: string;
  email?: string;
  rating?: number;
  comentario?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const supabase = getServerSupabase();
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'desconocida';
  const limite = await checkRateLimit(supabase, `resena:ip:${ip}`, 'cotizacion');
  if (limite.limited) {
    return new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes' }), {
      status: 429,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const body = (await req.json().catch(() => ({}))) as CrearResenaBody;
  const slug = (body.producto_slug ?? '').trim().slice(0, 200);
  const nombre = (body.nombre ?? '').trim().slice(0, 120);
  const email = (body.email ?? '').trim().toLowerCase().slice(0, 200);
  const comentario = (body.comentario ?? '').trim().slice(0, 2000);
  const rating = Number(body.rating);

  if (!slug || !nombre || !comentario) {
    return badRequest('producto_slug, nombre y comentario son obligatorios', origin);
  }
  if (!EMAIL_RE.test(email)) return badRequest('email invalido', origin);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return badRequest('rating debe ser entero 1-5', origin);
  }

  const { data: producto } = await supabase
    .from('productos')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!producto) return badRequest(`producto no encontrado: ${slug}`, origin);

  const { error } = await supabase.from('resenas').insert({
    producto_id: (producto as { id: string }).id,
    nombre,
    email,
    rating,
    comentario,
    aprobada: false,
  });
  if (error) {
    console.error('crear-resena:', error.message);
    return internalError('No se pudo registrar la resena', origin);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
});
