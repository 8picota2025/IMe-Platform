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
