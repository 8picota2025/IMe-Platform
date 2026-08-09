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
import {
  isPaymentReconcileTerminalEstado,
  resolvePaymentReconcileTarget,
} from '../../../src/lib/stripe-session.ts';

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

  // Success-page reconciliation: Wompi uses pedido reference; Stripe needs cs_…
  // stored in metadata by crear-pago / convertir-cotizacion-pedido / webhook-stripe.
  if (pedido.estado === 'pendiente') {
    const target = resolvePaymentReconcileTarget({
      proveedorPago: pedido.proveedor_pago,
      referenciaPasarela: referencia,
      metadata: pedido.metadata,
    });

    if (target) {
      const gateway = getGatewayByProvider(target.provider);
      const verificacion = await gateway.verificarPago(target.reference);
      const nuevoEstado = verificacion.estado;

      // Apply only terminal states. Skip error_verificacion so transient API
      // blips do not stick the pedido before the webhook/retry path recovers.
      if (
        isPaymentReconcileTerminalEstado(nuevoEstado) &&
        nuevoEstado !== pedido.estado
      ) {
        const syntheticEventId = `reconcile:${target.provider}:${referencia}:${Date.now()}`;
        const metaKey =
          target.provider === 'wompi'
            ? 'ultima_reconciliacion_wompi'
            : 'ultima_reconciliacion_stripe';
        await supabase
          .from('pedidos')
          .update({
            estado: nuevoEstado,
            metadata: { ...(pedido.metadata ?? {}), [metaKey]: syntheticEventId },
          })
          .eq('id', pedido.id);

        if (nuevoEstado === 'pagado') {
          await registrarPedidoPagado(supabase, pedido.id, target.provider, syntheticEventId);
          await notificarFulfillmentDropship(supabase, pedido.id, pedido.items ?? []);
        } else {
          await notificarEstadoPedido(pedido.id, nuevoEstado, pedido.estado);
        }

        estado = nuevoEstado;
      }
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
