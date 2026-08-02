/**
 * Edge Function: consultar-pedido
 *
 * Consulta pública y de solo lectura del estado de un pedido, identificado
 * por su referencia de pasarela (UUID no secuencial). Usada por las páginas
 * de resultado de pago (/pago/exito|pendiente|fallo).
 *
 * Solo expone campos no sensibles: referencia, estado, moneda, total.
 * Nunca expone cliente, items, metadata ni datos de proveedor.
 *
 * Variables requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError } from '../_shared/errors.ts';
import { getGatewayByProvider } from '../_shared/payment-gateway.ts';
import {
  notificarEstadoPedido,
  notificarFulfillmentDropship,
  registrarPedidoPagado,
} from '../_shared/post-pago.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { claimPedidoPagado, esEstadoReconciliable } from '../_shared/webhook-pago.ts';

const REFERENCIA_REGEX = /^[a-zA-Z0-9-]{8,64}$/;

interface ConsultarPedidoRequest {
  referencia?: string;
}

interface PedidoRow {
  id: string;
  estado: string;
  moneda: string;
  total: number;
  proveedor_pago?: string | null;
  items?: Array<{ producto_id: string }>;
  metadata?: Record<string, unknown> | null;
}

function obtenerIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  let body: ConsultarPedidoRequest;
  try {
    body = (await req.json()) as ConsultarPedidoRequest;
  } catch {
    return badRequest('JSON invalido', origin);
  }

  const referencia = body.referencia?.trim() ?? '';

  if (!referencia || !REFERENCIA_REGEX.test(referencia)) {
    return badRequest('referencia invalida', origin);
  }

  const supabase = getServerSupabase();
  const ip = obtenerIp(req);

  const limite = await checkRateLimit(supabase, `pedido:ip:${ip}`);
  if (limite.limited) {
    return new Response(
      JSON.stringify({
        error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta mas tarde' },
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      }
    );
  }

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, estado, moneda, total, proveedor_pago, items, metadata')
    .eq('referencia_pasarela', referencia)
    .maybeSingle();

  if (error) {
    return internalError(`error consultando pedido: ${error.message}`, origin);
  }

  if (!data) {
    return new Response(JSON.stringify({ ok: true, encontrado: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  }

  const pedido = data as unknown as PedidoRow;
  let estado = pedido.estado;

  // Reconcile pendiente AND error_verificacion (the latter used to be a dead-end:
  // webhooks marked events processed after API blips and this endpoint ignored them).
  if (pedido.proveedor_pago === 'wompi' && esEstadoReconciliable(pedido.estado)) {
    const gateway = getGatewayByProvider('wompi');
    const verificacion = await gateway.verificarPago(referencia);
    const nuevoEstado = verificacion.estado;

    if (nuevoEstado === 'error_verificacion') {
      // Keep current estado; client can retry. Do not overwrite with error_verificacion.
      estado = pedido.estado;
    } else if (nuevoEstado === 'pagado') {
      const syntheticEventId = `reconcile:${referencia}:${Date.now()}`;
      const claim = await claimPedidoPagado(
        supabase,
        pedido.id,
        { ultima_reconciliacion_wompi: syntheticEventId },
        pedido.metadata ?? null
      );
      if (claim.claimed) {
        await registrarPedidoPagado(supabase, pedido.id, 'wompi', syntheticEventId, {
          deEstado: pedido.estado,
        });
        await notificarFulfillmentDropship(supabase, pedido.id, pedido.items ?? []);
      }
      estado = 'pagado';
    } else if (nuevoEstado !== pedido.estado && nuevoEstado !== 'pendiente') {
      const syntheticEventId = `reconcile:${referencia}:${Date.now()}`;
      await supabase
        .from('pedidos')
        .update({
          estado: nuevoEstado,
          metadata: { ...(pedido.metadata ?? {}), ultima_reconciliacion_wompi: syntheticEventId },
        })
        .eq('id', pedido.id)
        .neq('estado', 'pagado');

      await notificarEstadoPedido(pedido.id, nuevoEstado, pedido.estado);
      estado = nuevoEstado;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      encontrado: true,
      referencia,
      estado,
      moneda: pedido.moneda,
      total: pedido.total,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
