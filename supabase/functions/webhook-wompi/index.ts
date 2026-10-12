/**
 * Edge Function: webhook-wompi
 *
 * Recibe eventos de Wompi (Web Checkout / Events API), valida la firma con
 * WOMPI_EVENTS_SECRET, verifica el estado real contra la API de Wompi
 * (server-side, nunca confía en el payload del webhook por sí solo),
 * actualiza el pedido y registra el evento en eventos_pago (idempotente).
 *
 * Tras confirmar 'pagado', dispara notificar-proveedor para los items
 * con fulfillment_mode='dropship'.
 *
 * Variables requeridas: WOMPI_EVENTS_SECRET, WOMPI_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { getGatewayByProvider } from '../_shared/payment-gateway.ts';
import {
  notificarEstadoPedido,
  notificarFulfillmentDropship,
  registrarPedidoPagado,
} from '../_shared/post-pago.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';
import {
  claimCancelFromPaid,
  claimPaidTransition,
  type PaymentStateClient,
} from '../../../src/lib/payment-state.ts';

const FN_NAME = 'webhook-wompi';

interface PedidoRow {
  id: string;
  estado: string;
  items: Array<{ producto_id: string }>;
  metadata: Record<string, unknown> | null;
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    const rawBody = await req.text();

    const gateway = getGatewayByProvider('wompi');
    const evento = await gateway.validarWebhook(rawBody, req);
    if (!evento) {
      void trackEvent(
        FN_NAME,
        'webhook_rechazado',
        { motivo: 'firma_invalida' },
        { nivel: 'warn' }
      );
      return unauthorized(origin);
    }

    const supabase = getServerSupabase();

    // ── Idempotencia: registrar evento (unique proveedor_pago+event_id) ──
    const { error: insertEventoError } = await supabase.from('eventos_pago').insert({
      proveedor_pago: 'wompi',
      event_id: evento.event_id,
      referencia_pasarela: evento.referencia_pasarela,
      payload: evento.payload,
      procesado: false,
    });

    if (insertEventoError) {
      if (insertEventoError.code === '23505') {
        // Un proceso puede haber caído después del INSERT. Solo descartamos
        // replay si fila ya está procesada; si quedó pendiente, reintentamos.
        const { data: existente, error: existenteError } = await supabase
          .from('eventos_pago')
          .select('procesado')
          .eq('proveedor_pago', 'wompi')
          .eq('event_id', evento.event_id)
          .maybeSingle();
        if (existenteError)
          return internalError(`error consultando evento: ${existenteError.message}`, origin);
        if (existente?.procesado === true) {
          return new Response(JSON.stringify({ ok: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
          });
        }
      }
      if (insertEventoError.code !== '23505') {
        return internalError(`error registrando evento: ${insertEventoError.message}`, origin);
      }
    }

    // ── Buscar pedido ──────────────────────────────────────────
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, estado, items, metadata')
      .eq('referencia_pasarela', evento.referencia_pasarela)
      .maybeSingle();

    if (pedidoError)
      return internalError(`error consultando pedido: ${pedidoError.message}`, origin);

    if (!pedido) {
      await supabase
        .from('eventos_pago')
        .update({ procesado: true })
        .eq('proveedor_pago', 'wompi')
        .eq('event_id', evento.event_id);

      return new Response(JSON.stringify({ ok: true, pedido: 'no encontrado' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      });
    }

    const pedidoRow = pedido as unknown as PedidoRow;

    // ── Verificación server-side del estado real (nunca confiar solo en el payload) ──
    const verificacion = await gateway.verificarPago(evento.referencia_pasarela);
    const nuevoEstado = verificacion.estado;
    const eraPagado = pedidoRow.estado === 'pagado';
    let pagoReclamado = false;
    let canceladoDesdePagado = false;
    let estadoActualizado = false;
    const paymentClient = supabase as unknown as PaymentStateClient;

    if (!eraPagado && nuevoEstado === 'pagado') {
      const claim = await claimPaidTransition(paymentClient, pedidoRow.id);
      if (claim.error) {
        return internalError(`error reclamando pago confirmado: ${claim.error}`, origin);
      }
      pagoReclamado = claim.claimed;
      estadoActualizado = claim.claimed;
    } else if (eraPagado && nuevoEstado === 'cancelado') {
      // Card VOIDED after APPROVED: money reversed at Wompi; stop treating as paid.
      const claim = await claimCancelFromPaid(paymentClient, pedidoRow.id, {
        metadata: {
          ...(pedidoRow.metadata ?? {}),
          ultimo_evento_wompi: evento.event_id,
          anulado_por_wompi: true,
        },
      });
      if (claim.error) {
        return internalError(`error reclamando anulación de pago: ${claim.error}`, origin);
      }
      canceladoDesdePagado = claim.claimed;
      estadoActualizado = claim.claimed;
    } else if (!eraPagado && nuevoEstado !== pedidoRow.estado) {
      // El predicado evita que una respuesta de verificacion obsoleta degrade
      // un pago confirmado en paralelo por el webhook o la reconciliacion.
      const { data: actualizado, error: actualizarError } = await supabase
        .from('pedidos')
        .update({
          estado: nuevoEstado,
          metadata: { ...(pedidoRow.metadata ?? {}), ultimo_evento_wompi: evento.event_id },
        })
        .eq('id', pedidoRow.id)
        .neq('estado', 'pagado')
        .select('id')
        .maybeSingle();
      if (actualizarError) {
        return internalError(`error actualizando pedido: ${actualizarError.message}`, origin);
      }
      estadoActualizado = actualizado !== null;
    }

    await supabase
      .from('eventos_pago')
      .update({ procesado: true })
      .eq('proveedor_pago', 'wompi')
      .eq('event_id', evento.event_id);

    if (pagoReclamado) {
      await registrarPedidoPagado(supabase, pedidoRow.id, 'wompi', evento.event_id);
      await notificarFulfillmentDropship(supabase, pedidoRow.id, pedidoRow.items ?? []);
      void trackEvent(FN_NAME, 'pago_confirmado', {
        pedido_id: pedidoRow.id,
        proveedor_pago: 'wompi',
      });
    } else if (canceladoDesdePagado) {
      await notificarEstadoPedido(pedidoRow.id, 'cancelado', 'pagado');
      void trackEvent(FN_NAME, 'pago_anulado', {
        pedido_id: pedidoRow.id,
        proveedor_pago: 'wompi',
      });
    } else if (estadoActualizado && nuevoEstado !== 'pagado') {
      await notificarEstadoPedido(pedidoRow.id, nuevoEstado, pedidoRow.estado);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  })
);
