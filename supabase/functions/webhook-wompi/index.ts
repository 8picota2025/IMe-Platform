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
import {
  claimPedidoPagado,
  esVerificacionReintentable,
  resolverEventoDuplicado,
} from '../_shared/webhook-pago.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';

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
        const dup = await resolverEventoDuplicado(supabase, 'wompi', evento.event_id);
        if (dup === 'error') {
          return internalError('error consultando evento duplicado', origin);
        }
        if (dup === 'skip') {
          return new Response(JSON.stringify({ ok: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
          });
        }
        // procesado=false → reanudar tras fallo previo mid-flight
      } else {
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

    // Fallo transitorio de la API Wompi: no marcar procesado ni degradar el pedido.
    // Responder 5xx para que Wompi reintente (hasta 3 veces / 24h).
    if (!eraPagado && esVerificacionReintentable(nuevoEstado)) {
      void trackEvent(
        FN_NAME,
        'verificacion_reintentable',
        { pedido_id: pedidoRow.id, event_id: evento.event_id },
        { nivel: 'warn' }
      );
      return internalError('verificacion Wompi temporalmente no disponible', origin);
    }

    if (eraPagado) {
      await supabase
        .from('eventos_pago')
        .update({ procesado: true })
        .eq('proveedor_pago', 'wompi')
        .eq('event_id', evento.event_id);

      return new Response(JSON.stringify({ ok: true, already_paid: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      });
    }

    if (nuevoEstado === 'pagado') {
      const claim = await claimPedidoPagado(
        supabase,
        pedidoRow.id,
        { ultimo_evento_wompi: evento.event_id },
        pedidoRow.metadata
      );

      await supabase
        .from('eventos_pago')
        .update({ procesado: true })
        .eq('proveedor_pago', 'wompi')
        .eq('event_id', evento.event_id);

      if (claim.claimed) {
        await registrarPedidoPagado(supabase, pedidoRow.id, 'wompi', evento.event_id);
        await notificarFulfillmentDropship(supabase, pedidoRow.id, pedidoRow.items ?? []);
        void trackEvent(FN_NAME, 'pago_confirmado', {
          pedido_id: pedidoRow.id,
          proveedor_pago: 'wompi',
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      });
    }

    if (nuevoEstado !== pedidoRow.estado) {
      await supabase
        .from('pedidos')
        .update({
          estado: nuevoEstado,
          metadata: { ...(pedidoRow.metadata ?? {}), ultimo_evento_wompi: evento.event_id },
        })
        .eq('id', pedidoRow.id)
        .neq('estado', 'pagado');

      await notificarEstadoPedido(pedidoRow.id, nuevoEstado, pedidoRow.estado);
    }

    await supabase
      .from('eventos_pago')
      .update({ procesado: true })
      .eq('proveedor_pago', 'wompi')
      .eq('event_id', evento.event_id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  })
);
