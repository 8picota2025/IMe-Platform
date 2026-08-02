/**
 * Edge Function: webhook-stripe
 *
 * Recibe eventos de Stripe (Checkout Session), valida la firma HMAC-SHA256
 * con STRIPE_WEBHOOK_SECRET (header stripe-signature), verifica el estado
 * real contra la API de Stripe (server-side), actualiza el pedido y
 * registra el evento en eventos_pago (idempotente).
 *
 * Tras confirmar 'pagado', dispara notificar-proveedor para los items
 * con fulfillment_mode='dropship'.
 *
 * Variables requeridas: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.
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

const FN_NAME = 'webhook-stripe';

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

    const gateway = getGatewayByProvider('stripe');
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
      proveedor_pago: 'stripe',
      event_id: evento.event_id,
      referencia_pasarela: evento.referencia_pasarela,
      payload: evento.payload,
      procesado: false,
    });

    if (insertEventoError) {
      if (insertEventoError.code === '23505') {
        const dup = await resolverEventoDuplicado(supabase, 'stripe', evento.event_id);
        if (dup === 'error') {
          return internalError('error consultando evento duplicado', origin);
        }
        if (dup === 'skip') {
          return new Response(JSON.stringify({ ok: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
          });
        }
      } else {
        return internalError(`error registrando evento: ${insertEventoError.message}`, origin);
      }
    }

    // ── Buscar pedido (referencia_pasarela = pedidos.id, ver crear-pago) ──
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
        .eq('proveedor_pago', 'stripe')
        .eq('event_id', evento.event_id);

      return new Response(JSON.stringify({ ok: true, pedido: 'no encontrado' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      });
    }

    const pedidoRow = pedido as unknown as PedidoRow;

    // Stripe usa el id de la sesión de checkout para consultar /checkout/sessions/{id},
    // pero validarWebhook ya resuelve referencia_pasarela = client_reference_id (= pedido.id)
    // cuando está presente. Para verificar contra Stripe usamos el id de sesión del payload.
    const dataObject = (evento.payload['data'] as { object?: { id?: string } } | undefined)?.object;
    const sessionId = dataObject?.id ?? evento.referencia_pasarela;

    const verificacion = await gateway.verificarPago(sessionId);
    const nuevoEstado = verificacion.estado;
    const eraPagado = pedidoRow.estado === 'pagado';

    if (!eraPagado && esVerificacionReintentable(nuevoEstado)) {
      void trackEvent(
        FN_NAME,
        'verificacion_reintentable',
        { pedido_id: pedidoRow.id, event_id: evento.event_id },
        { nivel: 'warn' }
      );
      return internalError('verificacion Stripe temporalmente no disponible', origin);
    }

    if (eraPagado) {
      await supabase
        .from('eventos_pago')
        .update({ procesado: true })
        .eq('proveedor_pago', 'stripe')
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
        { ultimo_evento_stripe: evento.event_id },
        pedidoRow.metadata
      );

      await supabase
        .from('eventos_pago')
        .update({ procesado: true })
        .eq('proveedor_pago', 'stripe')
        .eq('event_id', evento.event_id);

      if (claim.claimed) {
        await registrarPedidoPagado(supabase, pedidoRow.id, 'stripe', evento.event_id);
        await notificarFulfillmentDropship(supabase, pedidoRow.id, pedidoRow.items ?? []);
        void trackEvent(FN_NAME, 'pago_confirmado', {
          pedido_id: pedidoRow.id,
          proveedor_pago: 'stripe',
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
          metadata: { ...(pedidoRow.metadata ?? {}), ultimo_evento_stripe: evento.event_id },
        })
        .eq('id', pedidoRow.id)
        .neq('estado', 'pagado');

      await notificarEstadoPedido(pedidoRow.id, nuevoEstado, pedidoRow.estado);
    }

    await supabase
      .from('eventos_pago')
      .update({ procesado: true })
      .eq('proveedor_pago', 'stripe')
      .eq('event_id', evento.event_id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  })
);
