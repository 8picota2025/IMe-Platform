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

export function pedidoDebeLiberarReserva(estado: string): boolean {
  return (
    estado === 'rechazado' ||
    estado === 'expirado' ||
    estado === 'cancelado' ||
    estado === 'error_verificacion'
  );
}
