/**
 * Valida comprobante de transferencia bancaria:
 * - marca pedido como pagado (solo desde pendiente_validacion)
 * - actualiza totales de cliente, emails, dropship y factura DIAN si aplica
 *
 * Auth: JWT admin (ventas|operaciones+) o service_role.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import {
  badRequest,
  unauthorized,
  notFound,
  errorResponse,
  internalError,
} from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { notificarFulfillmentDropship, registrarPedidoPagado } from '../_shared/post-pago.ts';

const ROLES = new Set(['owner', 'admin', 'ventas', 'operaciones']);

interface Body {
  pedido_id?: string;
}

interface PedidoItem {
  producto_id?: string;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const supabase = getServerSupabase();
  const auth = await requireAdmin(supabase, req.headers.get('authorization'), ROLES);
  if (!auth.ok) return unauthorized(origin);

  const body = (await req.json().catch(() => ({}))) as Body;
  const pedidoId = (body.pedido_id ?? '').trim();
  if (!pedidoId) return badRequest('pedido_id requerido', origin);

  const { data: pedidoData, error: pedidoError } = await supabase
    .from('pedidos')
    .select(
      'id, estado, proveedor_pago, items, cliente_id, total, facturacion_electronica_solicitada'
    )
    .eq('id', pedidoId)
    .maybeSingle();
  if (pedidoError) return internalError(pedidoError.message, origin);
  if (!pedidoData) return notFound(origin);

  const pedido = pedidoData as {
    id: string;
    estado: string;
    proveedor_pago: string | null;
    items: PedidoItem[] | null;
    cliente_id: string | null;
    total: number | string | null;
    facturacion_electronica_solicitada: boolean | null;
  };

  if (pedido.proveedor_pago !== 'transferencia') {
    return errorResponse(
      {
        code: 'NO_ES_TRANSFERENCIA',
        message: 'Solo se pueden validar pedidos de transferencia bancaria',
      },
      409,
      origin
    );
  }

  if (pedido.estado !== 'pendiente_validacion') {
    return errorResponse(
      {
        code: 'ESTADO_INVALIDO',
        message: `Solo se valida desde pendiente_validacion (actual: ${pedido.estado})`,
      },
      409,
      origin
    );
  }

  const deEstado = pedido.estado;
  const { data: updated, error: updateError } = await supabase
    .from('pedidos')
    .update({
      estado: 'pagado',
      pago_validado_at: new Date().toISOString(),
      pago_validado_por: auth.email ?? auth.userId ?? 'admin',
      leida: true,
    })
    .eq('id', pedidoId)
    .eq('estado', 'pendiente_validacion')
    .select('id')
    .maybeSingle();

  if (updateError) return internalError(updateError.message, origin);
  if (!updated) {
    return errorResponse(
      {
        code: 'RACE_CONDITION',
        message: 'El pedido ya cambio de estado (posible rechazo concurrente)',
      },
      409,
      origin
    );
  }

  const eventId = `transferencia-validada:${pedidoId}:${Date.now()}`;
  await registrarPedidoPagado(supabase, pedidoId, 'transferencia', eventId, {
    deEstado,
  });
  await notificarFulfillmentDropship(supabase, pedidoId, pedido.items ?? []);

  return new Response(
    JSON.stringify({
      ok: true,
      pedido_id: pedidoId,
      estado: 'pagado',
      facturacion_solicitada: Boolean(pedido.facturacion_electronica_solicitada),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
