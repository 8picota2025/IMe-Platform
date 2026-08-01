/**
 * Preview público de cotización para Formalizar (token en body).
 * No crea pedido — eso lo hace crear-pago con precios locked.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, notFound, internalError } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  calcularTotalOfertado,
  hashTokenSha256,
  ofertaCompleta,
  parseLineasOferta,
  tokenExpirado,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';

interface Body {
  cotizacion_id?: string;
  token?: string;
}

function obtenerIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const body = (await req.json().catch(() => ({}))) as Body;
  const id = (body.cotizacion_id ?? '').trim();
  const token = (body.token ?? '').trim();
  if (!id || !token) return badRequest('cotizacion_id y token requeridos', origin);

  const supabase = getServerSupabase();
  const limite = await checkRateLimit(supabase, `formalizar:ip:${obtenerIp(req)}`, 'crear-pago');
  if (limite.limited) {
    return errorResponse({ code: 'RATE_LIMITED', message: 'Demasiadas solicitudes' }, 429, origin);
  }

  const { data, error } = await supabase
    .from('solicitudes_cotizacion')
    .select(
      'id, nombre, empresa, email, productos, condiciones, validez_hasta, precio_total_ofertado, estado, formalizacion_token_hash, formalizacion_token_expira_at, pedido_id, locale, mercado, moneda'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);

  const row = data as CotizacionOfertaRow;
  if (row.pedido_id || row.estado === 'convertida') {
    return errorResponse(
      { code: 'COTIZACION_YA_CONVERTIDA', message: 'Esta cotizacion ya fue formalizada' },
      409,
      origin
    );
  }
  if (row.estado !== 'enviada' && row.estado !== 'respondida') {
    return errorResponse(
      {
        code: 'COTIZACION_NO_ENVIADA',
        message: 'La cotizacion no esta disponible para formalizar',
      },
      409,
      origin
    );
  }
  if (tokenExpirado(row.formalizacion_token_expira_at)) {
    return errorResponse(
      { code: 'TOKEN_EXPIRADO', message: 'El enlace de formalizacion expiro' },
      410,
      origin
    );
  }
  if (!row.formalizacion_token_hash) {
    return errorResponse({ code: 'TOKEN_INVALIDO', message: 'Token invalido' }, 401, origin);
  }
  const hash = await hashTokenSha256(token);
  if (hash !== row.formalizacion_token_hash) {
    return errorResponse({ code: 'TOKEN_INVALIDO', message: 'Token invalido' }, 401, origin);
  }

  const lineas = parseLineasOferta(row.productos);
  const check = ofertaCompleta(lineas, row.condiciones);
  if (!check.ok) {
    return errorResponse({ code: check.error, message: 'Oferta incompleta' }, 422, origin);
  }

  const total = Number(row.precio_total_ofertado) || calcularTotalOfertado(lineas);
  const moneda = lineas[0]?.moneda || String(row.moneda ?? 'COP');

  return new Response(
    JSON.stringify({
      ok: true,
      cotizacion: {
        id: row.id,
        nombre: row.nombre,
        empresa: row.empresa,
        email: row.email,
        condiciones: row.condiciones,
        validez_hasta: row.validez_hasta,
        estado: row.estado,
        locale: row.locale === 'en' ? 'en' : 'es',
        mercado: row.mercado === 'INTL' ? 'INTL' : 'CO',
        moneda,
        total,
        lineas: lineas.map(l => ({
          slug: l.slug,
          nombre: l.nombre,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          subtotal: l.subtotal,
          moneda: l.moneda,
        })),
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
