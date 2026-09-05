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
import { claimPaidTransition, type PaymentStateClient } from '../../../src/lib/payment-state.ts';
import { yaRegistroPostPago } from '../../../src/lib/post-pago-guard.ts';

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

  // Recovery: order already pagado but webhook crashed after the CAS claim and
  // before emails/DIAN/dropship. Success-page polls must finish those effects.
  if (pedido.estado === 'pagado') {
    const { data: eventosPrevios } = await supabase
      .from('pedido_eventos')
      .select('tipo')
      .eq('pedido_id', pedido.id)
      .in('tipo', ['pago_confirmado', 'transferencia_validada'])
      .limit(1);
    if (!yaRegistroPostPago(eventosPrevios as Array<{ tipo?: string }> | null)) {
      const provider =
        pedido.proveedor_pago === 'stripe'
          ? 'stripe'
          : pedido.proveedor_pago === 'transferencia'
            ? 'transferencia'
            : 'wompi';
      const syntheticEventId = `reconcile-recovery:${referencia}`;
      await registrarPedidoPagado(supabase, pedido.id, provider, syntheticEventId);
      await notificarFulfillmentDropship(supabase, pedido.id, pedido.items ?? []);
    }
  }

  if (pedido.proveedor_pago === 'wompi' && pedido.estado === 'pendiente') {
    const gateway = getGatewayByProvider('wompi');
    const verificacion = await gateway.verificarPago(referencia);
    const nuevoEstado = verificacion.estado;

    if (nuevoEstado !== 'pendiente' && nuevoEstado !== pedido.estado) {
      const syntheticEventId = `reconcile:${referencia}:${Date.now()}`;
      if (nuevoEstado === 'pagado') {
        const claim = await claimPaidTransition(
          supabase as unknown as PaymentStateClient,
          pedido.id
        );
        if (claim.error) {
          return internalError(`error reclamando pago confirmado: ${claim.error}`, origin);
        }
        if (claim.claimed) {
          await registrarPedidoPagado(supabase, pedido.id, 'wompi', syntheticEventId);
          await notificarFulfillmentDropship(supabase, pedido.id, pedido.items ?? []);
        }
      } else {
        const { data: actualizado, error: actualizarError } = await supabase
          .from('pedidos')
          .update({
            estado: nuevoEstado,
            metadata: {
              ...(pedido.metadata ?? {}),
              ultima_reconciliacion_wompi: syntheticEventId,
            },
          })
          .eq('id', pedido.id)
          .neq('estado', 'pagado')
          .select('id')
          .maybeSingle();
        if (actualizarError) {
          return internalError(`error actualizando pedido: ${actualizarError.message}`, origin);
        }
        if (actualizado) {
          await notificarEstadoPedido(pedido.id, nuevoEstado, pedido.estado);
        }
        estado = actualizado ? nuevoEstado : 'pagado';
      }

      if (nuevoEstado === 'pagado') estado = 'pagado';
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
