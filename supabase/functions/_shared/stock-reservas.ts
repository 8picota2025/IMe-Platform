/**
 * Reservas de inventario (F4.2). Solo service_role vía RPC SECURITY DEFINER.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
export { pedidoDebeLiberarReserva } from '../../../src/lib/stock-availability.ts';

export interface ReservaStockResult {
  ok: boolean;
  reserva_id: string | null;
  disponible_restante: number | null;
  motivo: string;
}

export interface ConsumoStockResult {
  /** true si no hace falta stock o se consumió / re-reservó con éxito */
  ok: boolean;
  consumidas: number;
  motivo: string;
}

type RpcClient = Pick<SupabaseClient, 'rpc'>;
type QueryClient = Pick<SupabaseClient, 'rpc' | 'from'>;

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

interface PedidoLineaStock {
  producto_id?: string;
  cantidad?: number;
}

/**
 * Consume reservas activas; si ya se liberaron (TTL / bug de decline) intenta
 * re-reservar antes de permitir fulfillment. Idempotente si ya hay `consumida`.
 */
export async function asegurarConsumoStockPedido(
  supabase: QueryClient,
  pedidoId: string,
  items: PedidoLineaStock[]
): Promise<ConsumoStockResult> {
  const { count: yaConsumidas, error: countError } = await supabase
    .from('stock_reservas')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedidoId)
    .eq('estado', 'consumida');

  if (countError) {
    console.error('asegurarConsumoStockPedido: count consumida', countError.message);
    return { ok: false, consumidas: 0, motivo: countError.message };
  }
  if ((yaConsumidas ?? 0) > 0) {
    return { ok: true, consumidas: yaConsumidas ?? 0, motivo: 'ya_consumido' };
  }

  let consumidas = await consumirReservasPedido(supabase, pedidoId);
  if (consumidas > 0) {
    return { ok: true, consumidas, motivo: 'consumido' };
  }

  const lineas = items
    .map(i => ({
      producto_id: typeof i.producto_id === 'string' ? i.producto_id : '',
      cantidad: Math.max(1, Math.floor(Number(i.cantidad) || 1)),
    }))
    .filter(i => i.producto_id.length > 0);

  if (lineas.length === 0) {
    return { ok: true, consumidas: 0, motivo: 'sin_items' };
  }

  const productoIds = [...new Set(lineas.map(l => l.producto_id))];
  const { data: productos, error: prodError } = await supabase
    .from('productos')
    .select('id, stock, gestionar_stock')
    .in('id', productoIds);

  if (prodError) {
    console.error('asegurarConsumoStockPedido: productos', prodError.message);
    return { ok: false, consumidas: 0, motivo: prodError.message };
  }

  const managedIds = new Set(
    (
      (productos ?? []) as Array<{
        id: string;
        stock: number | null;
        gestionar_stock: boolean | null;
      }>
    )
      .filter(p => !(p.stock === null && p.gestionar_stock !== true))
      .map(p => p.id)
  );

  if (managedIds.size === 0) {
    return { ok: true, consumidas: 0, motivo: 'sin_gestion_stock' };
  }

  const correlationId = `reclaim:${pedidoId}`;
  for (const linea of lineas) {
    if (!managedIds.has(linea.producto_id)) continue;
    const reserva = await reservarStockProducto(supabase, {
      productoId: linea.producto_id,
      cantidad: linea.cantidad,
      pedidoId,
      correlationId,
    });
    if (!reserva.ok && reserva.motivo !== 'sin_gestion_stock') {
      return { ok: false, consumidas: 0, motivo: reserva.motivo };
    }
  }

  consumidas = await consumirReservasPedido(supabase, pedidoId);
  if (consumidas === 0) {
    return { ok: false, consumidas: 0, motivo: 'consumo_vacio_tras_re_reserva' };
  }
  return { ok: true, consumidas, motivo: 're_reservado_y_consumido' };
}
