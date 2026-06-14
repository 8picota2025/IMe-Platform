/**
 * Acciones comunes tras confirmar un pago como 'pagado' (webhook-wompi/webhook-stripe):
 * resolver items dropship del pedido y disparar notificar-proveedor.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PedidoItem {
  producto_id: string
}

/**
 * Para los items del pedido cuyo producto tenga fulfillment_mode='dropship',
 * invoca notificar-proveedor (server-to-server, con service_role).
 * Items con fulfillment_mode 'cotizacion'/'individualizado' no se notifican aquí
 * (van por el flujo de cotización de equipos, fuera del checkout de consumibles).
 */
export async function notificarFulfillmentDropship(
  supabase: SupabaseClient,
  pedidoId: string,
  items: PedidoItem[]
): Promise<void> {
  const productoIds = items
    .map((i) => i.producto_id)
    .filter((id): id is string => typeof id === 'string' && !!id)
  if (productoIds.length === 0) return

  const { data: productos, error } = await supabase
    .from('productos')
    .select('id, fulfillment_mode')
    .in('id', productoIds)

  if (error) {
    console.error('notificarFulfillmentDropship: error consultando productos', error.message)
    return
  }

  const dropshipIds = ((productos ?? []) as Array<{ id: string; fulfillment_mode: string }>)
    .filter((p) => p.fulfillment_mode === 'dropship')
    .map((p) => p.id)

  if (dropshipIds.length === 0) return

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return

  try {
    await fetch(`${supabaseUrl}/functions/v1/notificar-proveedor`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pedido_id: pedidoId, producto_ids: dropshipIds }),
    })
  } catch (err) {
    console.error('notificarFulfillmentDropship: error invocando notificar-proveedor', err)
  }
}

export async function registrarPedidoPagado(
  supabase: SupabaseClient,
  pedidoId: string,
  provider: 'wompi' | 'stripe',
  eventId: string
): Promise<void> {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, cliente_id, total')
    .eq('id', pedidoId)
    .maybeSingle()

  if (error) {
    console.error('registrarPedidoPagado: error consultando pedido', error.message)
    return
  }

  const row = pedido as { cliente_id?: string | null; total?: number | string | null } | null
  if (row?.cliente_id) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('total_pedidos, total_gastado')
      .eq('id', row.cliente_id)
      .maybeSingle()
    const totalPedidos = Number((cliente as { total_pedidos?: number } | null)?.total_pedidos ?? 0)
    const totalGastado = Number(
      (cliente as { total_gastado?: number | string } | null)?.total_gastado ?? 0
    )
    await supabase
      .from('clientes')
      .update({
        total_pedidos: totalPedidos + 1,
        total_gastado: totalGastado + Number(row.total ?? 0),
        ultimo_pedido_at: new Date().toISOString(),
      })
      .eq('id', row.cliente_id)
  }

  await supabase.from('pedido_eventos').insert({
    pedido_id: pedidoId,
    tipo: 'pago_confirmado',
    de_estado: 'pendiente',
    a_estado: 'pagado',
    metadata: { provider, event_id: eventId },
  })
}
