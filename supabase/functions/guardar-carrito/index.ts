/**
 * Guarda/actualiza el carrito activo de un email para recuperacion de
 * carrito abandonado. Publico con rate-limit; escritura via service_role.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

interface GuardarCarritoBody {
  email?: string;
  nombre?: string;
  items?: Array<{ slug?: string; nombre?: string; precio?: number; cantidad?: number }>;
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
  const limite = await checkRateLimit(supabase, `carrito:ip:${ip}`, 'cotizacion');
  if (limite.limited) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 429,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const body = (await req.json().catch(() => ({}))) as GuardarCarritoBody;
  const email = (body.email ?? '').trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) return badRequest('email invalido', origin);

  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).map(i => ({
    slug: String(i.slug ?? '').slice(0, 200),
    nombre: String(i.nombre ?? '').slice(0, 300),
    precio: Number(i.precio) || 0,
    cantidad: Math.max(1, Math.min(9999, Number(i.cantidad) || 1)),
  }));
  if (items.length === 0) return badRequest('items vacios', origin);

  const subtotal = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const nombre = (body.nombre ?? '').trim().slice(0, 200);
  const ahora = new Date().toISOString();

  const { data: existente } = await supabase
    .from('carritos_abandonados')
    .select('id')
    .eq('email', email)
    .eq('estado', 'activo')
    .maybeSingle();

  const { error } = existente
    ? await supabase
        .from('carritos_abandonados')
        .update({ items, subtotal, nombre: nombre || null, updated_at: ahora })
        .eq('id', (existente as { id: string }).id)
    : await supabase
        .from('carritos_abandonados')
        .insert({ email, nombre: nombre || null, items, subtotal });

  if (error) console.error('guardar-carrito:', error.message);

  return new Response(JSON.stringify({ ok: !error }), {
    status: 200,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
});
