/**
 * Acciones comunes tras confirmar un pago como 'pagado' (webhook-wompi/webhook-stripe):
 * resolver items dropship del pedido y disparar notificar-proveedor.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { enviarEmailPlantilla, DESTINATARIOS_INTERNOS, escapeHtml, itemsToHtml } from './email.ts';
import { pushPagoToTwenty } from './twenty-commerce-sync.ts';
import { tipoEventoPostPago, yaRegistroPostPago } from '../../../src/lib/post-pago-guard.ts';

interface PedidoItem {
  producto_id: string;
}

/** Notificacion centralizada de estado. Best-effort; no bloquea pagos/webhooks. */
export async function notificarEstadoPedido(
  pedidoId: string,
  aEstado: string,
  deEstado?: string,
  tracking?: { number?: string; url?: string }
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/notificar-cliente`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pedido_id: pedidoId,
        a_estado: aEstado,
        de_estado: deEstado,
        tracking_number: tracking?.number,
        tracking_url: tracking?.url,
      }),
    });
    if (!response.ok) {
      console.error('notificarEstadoPedido:', await response.text());
    }
  } catch (error) {
    console.error('notificarEstadoPedido: no se pudo invocar notificar-cliente', error);
  }
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
    .map(i => i.producto_id)
    .filter((id): id is string => typeof id === 'string' && !!id);
  if (productoIds.length === 0) return;

  const { data: productos, error } = await supabase
    .from('productos')
    .select('id, fulfillment_mode')
    .in('id', productoIds);

  if (error) {
    console.error('notificarFulfillmentDropship: error consultando productos', error.message);
    return;
  }

  const dropshipIds = ((productos ?? []) as Array<{ id: string; fulfillment_mode: string }>)
    .filter(p => p.fulfillment_mode === 'dropship')
    .map(p => p.id);

  if (dropshipIds.length === 0) return;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;

  try {
    await fetch(`${supabaseUrl}/functions/v1/notificar-proveedor`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pedido_id: pedidoId, producto_ids: dropshipIds }),
    });
  } catch (err) {
    console.error('notificarFulfillmentDropship: error invocando notificar-proveedor', err);
  }
}

export type ProveedorPagoConfirmado = 'wompi' | 'stripe' | 'bold' | 'transferencia';

export async function registrarPedidoPagado(
  supabase: SupabaseClient,
  pedidoId: string,
  provider: ProveedorPagoConfirmado,
  eventId: string,
  options?: { deEstado?: string; skipClienteEmail?: boolean }
): Promise<void> {
  const deEstado = options?.deEstado ?? 'pendiente';

  // Idempotent re-entry: webhook may retry after claiming `pagado` but crashing
  // before emails/DIAN/dropship. A second pass must not double-count totals.
  const { data: eventosPrevios, error: eventosError } = await supabase
    .from('pedido_eventos')
    .select('tipo')
    .eq('pedido_id', pedidoId)
    .in('tipo', ['pago_confirmado', 'transferencia_validada'])
    .limit(1);
  if (eventosError) {
    console.error('registrarPedidoPagado: error consultando eventos', eventosError.message);
    return;
  }
  if (yaRegistroPostPago(eventosPrevios as Array<{ tipo?: string }> | null)) {
    return;
  }

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, cliente_id, total')
    .eq('id', pedidoId)
    .maybeSingle();

  if (error) {
    console.error('registrarPedidoPagado: error consultando pedido', error.message);
    return;
  }

  const row = pedido as { cliente_id?: string | null; total?: number | string | null } | null;
  if (row?.cliente_id) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('total_pedidos, total_gastado')
      .eq('id', row.cliente_id)
      .maybeSingle();
    const totalPedidos = Number((cliente as { total_pedidos?: number } | null)?.total_pedidos ?? 0);
    const totalGastado = Number(
      (cliente as { total_gastado?: number | string } | null)?.total_gastado ?? 0
    );
    await supabase
      .from('clientes')
      .update({
        total_pedidos: totalPedidos + 1,
        total_gastado: totalGastado + Number(row.total ?? 0),
        ultimo_pedido_at: new Date().toISOString(),
      })
      .eq('id', row.cliente_id);
  }

  await supabase.from('pedido_eventos').insert({
    pedido_id: pedidoId,
    tipo: tipoEventoPostPago(provider),
    de_estado: deEstado,
    a_estado: 'pagado',
    metadata: { provider, event_id: eventId },
  });

  const { data: pedidoFiscal } = await supabase
    .from('pedidos')
    .select('facturacion_electronica_solicitada')
    .eq('id', pedidoId)
    .maybeSingle();

  if (
    (pedidoFiscal as { facturacion_electronica_solicitada?: boolean } | null)
      ?.facturacion_electronica_solicitada
  ) {
    await supabase
      .from('pedidos')
      .update({ facturacion_electronica_estado: 'pendiente_envio' })
      .eq('id', pedidoId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceKey) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/emitir-factura-dian`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pedido_id: pedidoId, force_live: true }),
        });
      } catch (err) {
        console.error('registrarPedidoPagado: error invocando emitir-factura-dian', err);
      }
    }
  }

  await enviarEmailsPedidoPagado(supabase, pedidoId, {
    deEstado,
    skipClienteEmail: options?.skipClienteEmail,
  });
  await marcarCarritoConvertido(supabase, pedidoId);
  void pushPagoToTwenty(supabase, pedidoId, provider);
}

async function marcarCarritoConvertido(supabase: SupabaseClient, pedidoId: string): Promise<void> {
  const { data } = await supabase
    .from('pedidos')
    .select('cliente')
    .eq('id', pedidoId)
    .maybeSingle();
  const email = (data as { cliente?: { email?: string } } | null)?.cliente?.email
    ?.trim()
    .toLowerCase();
  if (!email) return;
  await supabase
    .from('carritos_abandonados')
    .update({ estado: 'convertido', updated_at: new Date().toISOString() })
    .eq('email', email)
    .in('estado', ['activo', 'recordado']);
}

/**
 * Emails tras confirmar pago: aviso interno (root@ + ventas@) y confirmacion
 * al cliente. Best-effort: nunca bloquea el flujo del webhook.
 */
async function enviarEmailsPedidoPagado(
  supabase: SupabaseClient,
  pedidoId: string,
  options?: { deEstado?: string; skipClienteEmail?: boolean }
): Promise<void> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, cliente, items, total, moneda, referencia_pasarela')
    .eq('id', pedidoId)
    .maybeSingle();
  if (error || !data) {
    console.error('enviarEmailsPedidoPagado: pedido no encontrado', error?.message);
    return;
  }
  const pedido = data as {
    id: string;
    cliente: { nombre?: string; apellido?: string; email?: string } | null;
    items: Array<{ nombre?: string; cantidad?: number }> | null;
    total: number | string;
    moneda: string;
    referencia_pasarela: string | null;
  };
  const nombre = `${pedido.cliente?.nombre ?? ''} ${pedido.cliente?.apellido ?? ''}`.trim();
  const emailCliente = pedido.cliente?.email ?? '';
  const referencia = pedido.referencia_pasarela ?? pedido.id;
  const vars = {
    referencia: escapeHtml(referencia),
    cliente_nombre: escapeHtml(nombre || 'Cliente'),
    cliente_email: escapeHtml(emailCliente),
    total: Number(pedido.total).toLocaleString('es-CO'),
    moneda: escapeHtml(pedido.moneda ?? 'COP'),
    items_html: itemsToHtml(pedido.items ?? []),
    fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
  };

  try {
    const interno = await enviarEmailPlantilla(
      supabase,
      'venta_interna',
      DESTINATARIOS_INTERNOS,
      vars,
      referencia
    );
    if (!interno.ok) console.error('enviarEmailsPedidoPagado: interno', interno.detalle);
    if (emailCliente && !options?.skipClienteEmail) {
      await notificarEstadoPedido(pedidoId, 'pagado', options?.deEstado ?? 'pendiente');
    }
  } catch (err) {
    console.error('enviarEmailsPedidoPagado: error inesperado', err);
  }
}
