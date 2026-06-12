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

import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts'
import { getServerSupabase } from '../_shared/supabase-server.ts'
import { getGatewayByProvider } from '../_shared/payment-gateway.ts'
import { notificarFulfillmentDropship } from '../_shared/post-pago.ts'

interface PedidoRow {
  id: string
  estado: string
  items: Array<{ producto_id: string }>
  metadata: Record<string, unknown> | null
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsRes = handleCors(req)
  if (corsRes) return corsRes
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin)

  const rawBody = await req.text()

  const gateway = getGatewayByProvider('stripe')
  const evento = await gateway.validarWebhook(rawBody, req)
  if (!evento) return unauthorized(origin)

  const supabase = getServerSupabase()

  // ── Idempotencia: registrar evento (unique proveedor_pago+event_id) ──
  const { error: insertEventoError } = await supabase.from('eventos_pago').insert({
    proveedor_pago: 'stripe',
    event_id: evento.event_id,
    referencia_pasarela: evento.referencia_pasarela,
    payload: evento.payload,
    procesado: false,
  })

  if (insertEventoError) {
    if (insertEventoError.code === '23505') {
      // Evento duplicado ya procesado anteriormente
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      })
    }
    return internalError(`error registrando evento: ${insertEventoError.message}`, origin)
  }

  // ── Buscar pedido (referencia_pasarela = pedidos.id, ver crear-pago) ──
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id, estado, items, metadata')
    .eq('referencia_pasarela', evento.referencia_pasarela)
    .maybeSingle()

  if (pedidoError) return internalError(`error consultando pedido: ${pedidoError.message}`, origin)

  if (!pedido) {
    await supabase
      .from('eventos_pago')
      .update({ procesado: true })
      .eq('proveedor_pago', 'stripe')
      .eq('event_id', evento.event_id)

    return new Response(JSON.stringify({ ok: true, pedido: 'no encontrado' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    })
  }

  const pedidoRow = pedido as unknown as PedidoRow

  // ── Verificación server-side del estado real (recupera la Checkout Session) ──
  // Stripe usa el id de la sesión de checkout para consultar /checkout/sessions/{id},
  // pero validarWebhook ya resuelve referencia_pasarela = client_reference_id (= pedido.id)
  // cuando está presente. Para verificar contra Stripe usamos el id de sesión del payload.
  const dataObject = (evento.payload['data'] as { object?: { id?: string } } | undefined)?.object
  const sessionId = dataObject?.id ?? evento.referencia_pasarela

  const verificacion = await gateway.verificarPago(sessionId)
  const nuevoEstado = verificacion.estado
  const eraPagado = pedidoRow.estado === 'pagado'

  if (!eraPagado && nuevoEstado !== pedidoRow.estado) {
    await supabase
      .from('pedidos')
      .update({
        estado: nuevoEstado,
        metadata: { ...(pedidoRow.metadata ?? {}), ultimo_evento_stripe: evento.event_id },
      })
      .eq('id', pedidoRow.id)
  }

  await supabase
    .from('eventos_pago')
    .update({ procesado: true })
    .eq('proveedor_pago', 'stripe')
    .eq('event_id', evento.event_id)

  if (!eraPagado && nuevoEstado === 'pagado') {
    await notificarFulfillmentDropship(supabase, pedidoRow.id, pedidoRow.items ?? [])
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  })
})
