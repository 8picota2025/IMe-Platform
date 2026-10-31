/**
 * Cálculo de stock disponible (físico − reservado).
 * La atomicidad real vive en RPC `reservar_stock` (Postgres).
 */

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

/**
 * Liberar hold solo en abandono definitivo.
 * `rechazado` / `error_verificacion` NO liberan: Wompi (y similares) permiten
 * reintentos con la misma referencia; si liberamos al DECLINED y luego llega
 * APPROVED, `consumir_stock_reservas_pedido` no encuentra filas `activa` y el
 * pedido queda pagado + dropship sin decrementar stock (oversell).
 * Holds de decline quedan hasta TTL (`liberar_stock_reservas_expiradas`) o
 * cancelación explícita.
 */
export function pedidoDebeLiberarReserva(estado: string): boolean {
  return estado === 'expirado' || estado === 'cancelado';
}
