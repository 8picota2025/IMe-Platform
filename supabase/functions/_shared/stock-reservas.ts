/**
 * Reservas de inventario (F4.2). Solo service_role vía RPC SECURITY DEFINER.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface ReservaStockResult {
  ok: boolean;
  reserva_id: string | null;
  disponible_restante: number | null;
  motivo: string;
}

type RpcClient = Pick<SupabaseClient, 'rpc'>;

function parseReservaRow(data: unknown): ReservaStockResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return { ok: false, reserva_id: null, disponible_restante: 0, motivo: 'rpc_vacio' };
  }
  const r = row as Record<string, unknown>;
  return {
    ok: r.ok === true,
    reserva_id: typeof r.reserva_id === 'string' ? r.reserva_id : null,
    disponible_restante:
      typeof r.disponible_restante === 'number'
        ? r.disponible_restante
        : r.disponible_restante === null
          ? null
          : Number(r.disponible_restante) || 0,
    motivo: typeof r.motivo === 'string' ? r.motivo : 'desconocido',
  };
}

export async function reservarStockProducto(
  supabase: RpcClient,
  params: {
    productoId: string;
    cantidad: number;
    pedidoId: string;
    ttlMinutes?: number;
    correlationId?: string;
  }
): Promise<ReservaStockResult> {
  const { data, error } = await supabase.rpc('reservar_stock', {
    p_producto_id: params.productoId,
    p_cantidad: params.cantidad,
    p_pedido_id: params.pedidoId,
    p_ttl_minutes: params.ttlMinutes ?? 30,
    p_correlation_id: params.correlationId ?? null,
  });
  if (error) {
    console.error('reservar_stock:', error.message);
    return { ok: false, reserva_id: null, disponible_restante: 0, motivo: error.message };
  }
  return parseReservaRow(data);
}

export async function consumirReservasPedido(
  supabase: RpcClient,
  pedidoId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('consumir_stock_reservas_pedido', {
    p_pedido_id: pedidoId,
  });
  if (error) {
    console.error('consumir_stock_reservas_pedido:', error.message);
    return 0;
  }
  return typeof data === 'number' ? data : Number(data) || 0;
}

export async function liberarReservasPedido(
  supabase: RpcClient,
  pedidoId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('liberar_stock_reservas_pedido', {
    p_pedido_id: pedidoId,
  });
  if (error) {
    console.error('liberar_stock_reservas_pedido:', error.message);
    return 0;
  }
  return typeof data === 'number' ? data : Number(data) || 0;
}

/** Estados de pedido que deben liberar reserva (no venta). */
export function pedidoDebeLiberarReserva(estado: string): boolean {
  return (
    estado === 'rechazado' ||
    estado === 'expirado' ||
    estado === 'cancelado' ||
    estado === 'error_verificacion'
  );
}
