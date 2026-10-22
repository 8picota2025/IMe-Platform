/**
 * Cálculo de stock disponible (físico − reservado).
 * La atomicidad real vive en RPC `reservar_stock` (Postgres).
 */

/** Ítem listo para `reservar_stock` (producto_id + cantidad ≥ 1). */
export interface StockReserveItem {
  producto_id: string;
  cantidad: number;
}

/** TTL checkout online (crear-pago / convertir-cotizacion). Mínimo 5 min. */
export const STOCK_RESERVA_TTL_CHECKOUT_DEFAULT_MIN = 30;

/**
 * TTL transferencia / comprobante pendiente de validación admin.
 * Debe cubrir el SLA de revisión (default 7 días). Mínimo 60 min.
 */
export const STOCK_RESERVA_TTL_TRANSFERENCIA_DEFAULT_MIN = 10_080;

export function ttlMinutosReservaCheckout(envValue?: string | null): number {
  if (envValue == null || String(envValue).trim() === '') {
    return STOCK_RESERVA_TTL_CHECKOUT_DEFAULT_MIN;
  }
  const n = Number(envValue);
  if (!Number.isFinite(n)) return STOCK_RESERVA_TTL_CHECKOUT_DEFAULT_MIN;
  return Math.max(5, Math.floor(n));
}

export function ttlMinutosReservaTransferencia(envValue?: string | null): number {
  if (envValue == null || String(envValue).trim() === '') {
    return STOCK_RESERVA_TTL_TRANSFERENCIA_DEFAULT_MIN;
  }
  const n = Number(envValue);
  if (!Number.isFinite(n)) return STOCK_RESERVA_TTL_TRANSFERENCIA_DEFAULT_MIN;
  return Math.max(60, Math.floor(n));
}

/**
 * Normaliza ítems de pedido/cotización para reserva atómica.
 * Falla cerrado si falta producto_id o la cantidad no es enter ≥ 1.
 */
export function normalizeStockReserveItems(
  items: ReadonlyArray<{ producto_id?: string | null; cantidad?: number | null }>
): { ok: true; items: StockReserveItem[] } | { ok: false; motivo: string } {
  const out: StockReserveItem[] = [];
  for (const item of items) {
    const id = typeof item.producto_id === 'string' ? item.producto_id.trim() : '';
    if (!id) return { ok: false, motivo: 'producto_id_faltante' };
    const qty = Math.floor(Number(item.cantidad));
    if (!Number.isFinite(qty) || qty < 1) return { ok: false, motivo: 'cantidad_invalida' };
    out.push({ producto_id: id, cantidad: qty });
  }
  return { ok: true, items: out };
}

export function stockDisponibleNumerico(
  stockFisico: number | null | undefined,
  reservadoActivo: number,
  gestionarStock = false
): number | null {
  if ((stockFisico === null || stockFisico === undefined) && gestionarStock !== true) {
    return null;
  }
  const fisico = Math.max(0, Math.floor(Number(stockFisico) || 0));
  const reservado = Math.max(0, Math.floor(reservadoActivo) || 0);
  return Math.max(fisico - reservado, 0);
}

/** Simula el resultado de dos reservas concurrentes sobre 1 unidad. */
export function simularReservaConcurrente(stockDisponible: number, demandas: number[]): boolean[] {
  let restante = Math.max(0, stockDisponible);
  return demandas.map(qty => {
    const need = Math.max(1, Math.floor(qty));
    if (restante >= need) {
      restante -= need;
      return true;
    }
    return false;
  });
}

export function pedidoDebeLiberarReserva(estado: string): boolean {
  return (
    estado === 'rechazado' ||
    estado === 'expirado' ||
    estado === 'cancelado' ||
    estado === 'error_verificacion'
  );
}
