/**
 * Fuente canónica del feed Google Merchant Center (F4.2).
 * Astro es static en Hostinger → no usar page SSR como generador paralelo.
 *
 * URL sugerida (tras deploy function + rewrite opcional):
 *   https://<project>.supabase.co/functions/v1/generar-feed-google
 *
 * Auth: pública de lectura; rate-limit por IP. Sin service_role en response.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { resolvePrecioPublico } from '../../../src/lib/format.ts';
import { buildMerchantFeedXml, type MerchantFeedProduct } from '../../../src/lib/merchant-feed.ts';

const SITE = (Deno.env.get('SITE_URL') ?? 'https://i-me.com.co').replace(/\/$/, '');

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: getCorsHeaders(origin) });
  }

  const supabase = getServerSupabase();
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'desconocida';
  const limite = await checkRateLimit(supabase, `feed-google:ip:${ip}`, 'cotizacion');
  if (limite.limited) {
    return new Response('Too many requests', {
      status: 429,
      headers: getCorsHeaders(origin),
    });
  }

  const { data, error } = await supabase
    .from('productos')
    .select(
      'id,slug,nombre_es,descripcion_corta_es,imagen_principal,precio,precio_regular,precio_oferta,oferta_inicio,oferta_fin,stock,gestionar_stock,stock_estado,disponible,activo,atributos,moneda'
    )
    .eq('activo', true)
    .limit(5000);

  if (error) {
    console.error('generar-feed-google:', error.message);
    return new Response('Feed error', { status: 500, headers: getCorsHeaders(origin) });
  }

  // Liberar reservas expiradas best-effort antes de leer disponibilidad.
  try {
    await supabase.rpc('liberar_stock_reservas_expiradas');
  } catch {
    /* migración aún no aplicada */
  }

  const reservadoPorProducto = new Map<string, number>();
  {
    const { data: reservas } = await supabase
      .from('stock_reservas')
      .select('producto_id,cantidad,expires_at')
      .eq('estado', 'activa')
      .limit(10000);
    const ahora = Date.now();
    for (const r of (reservas ?? []) as Array<{
      producto_id: string;
      cantidad: number;
      expires_at: string;
    }>) {
      if (new Date(r.expires_at).getTime() <= ahora) continue;
      reservadoPorProducto.set(
        r.producto_id,
        (reservadoPorProducto.get(r.producto_id) ?? 0) + Number(r.cantidad || 0)
      );
    }
  }

  const products: MerchantFeedProduct[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const attrs =
      row.atributos && typeof row.atributos === 'object'
        ? (row.atributos as Record<string, unknown>)
        : {};
    const precio = resolvePrecioPublico(row);
    const slug = String(row.slug ?? '');
    const id = String(row.id ?? '');
    const reservado = reservadoPorProducto.get(id) ?? 0;
    const stockFisico = row.stock === null || row.stock === undefined ? null : Number(row.stock);
    const stockDisponible = stockFisico === null ? null : Math.max(stockFisico - reservado, 0);

    products.push({
      id,
      slug,
      nombre: String(row.nombre_es ?? slug),
      descripcion: (row.descripcion_corta_es as string | null) ?? null,
      link: `${SITE}/es/productos/${slug}/`,
      imagen_principal: (row.imagen_principal as string | null) ?? null,
      precio,
      currency: String(row.moneda ?? 'COP'),
      activo: row.activo !== false,
      disponible: row.disponible !== false,
      stock: stockDisponible,
      gestionar_stock: Boolean(row.gestionar_stock) || stockFisico !== null,
      stock_estado: (row.stock_estado as string | null) ?? null,
      marca: typeof attrs.marca === 'string' ? attrs.marca : null,
      fabricante: typeof attrs.fabricante === 'string' ? attrs.fabricante : null,
    });
  }

  const xml = buildMerchantFeedXml(products, 'I-ME productos');
  return new Response(req.method === 'HEAD' ? null : xml, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
});
