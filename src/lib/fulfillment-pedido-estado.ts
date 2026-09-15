/**
 * Deriva pedidos.estado from sibling fulfillments.
 *
 * Critical: never mirror a single fulfillment's cancelado/entregado onto the
 * whole pedido when other suppliers still have active lines.
 */

const ESTADOS_FULFILLMENT_INACTIVOS = new Set(['cancelado', 'error']);

/** Payment / terminal states that suppliers must not advance or rewrite. */
const ESTADOS_PEDIDO_NO_SYNC = new Set([
  'pendiente',
  'pendiente_validacion',
  'rechazado',
  'expirado',
  'reembolsado',
  'error_verificacion',
]);

const RANK_ENVIO: Record<string, number> = {
  pagado: 0,
  preparando: 1,
  retrasado: 1,
  enviado: 2,
  entregado: 3,
};

export function pedidoAceptaSyncFulfillment(pedidoEstado: string): boolean {
  const estado = String(pedidoEstado ?? '');
  if (!estado) return false;
  if (ESTADOS_PEDIDO_NO_SYNC.has(estado)) return false;
  // Do not reopen a cancelled order from a supplier callback.
  if (estado === 'cancelado') return false;
  return true;
}

/**
 * Apply an in-memory override for the fulfillment just updated, then derive
 * the pedido shipping state. Returns null when the pedido must not change.
 */
export function derivarEstadoPedidoDesdeFulfillments(
  fulfillmentEstados: readonly string[],
  pedidoEstadoActual: string
): string | null {
  if (!pedidoAceptaSyncFulfillment(pedidoEstadoActual)) return null;
  if (fulfillmentEstados.length === 0) return null;

  const activos = fulfillmentEstados.filter(e => !ESTADOS_FULFILLMENT_INACTIVOS.has(e));

  let derivado: string;
  if (activos.length === 0) {
    // Every fulfillment cancelled/errored → only then cancel the pedido.
    derivado = 'cancelado';
  } else if (activos.every(e => e === 'entregado')) {
    derivado = 'entregado';
  } else if (activos.every(e => e === 'enviado' || e === 'entregado')) {
    derivado = 'enviado';
  } else if (
    activos.every(e => e === 'pendiente' || e === 'notificado') &&
    pedidoEstadoActual === 'pagado'
  ) {
    // Still waiting on suppliers — keep paid marker.
    return null;
  } else {
    derivado = 'preparando';
  }

  if (derivado === pedidoEstadoActual) return null;

  // No shipping regressions (entregado → enviado, enviado → preparando, etc.).
  if (pedidoEstadoActual === 'entregado' && derivado !== 'entregado') return null;

  const rankActual = RANK_ENVIO[pedidoEstadoActual];
  const rankNuevo = RANK_ENVIO[derivado];
  if (
    rankActual !== undefined &&
    rankNuevo !== undefined &&
    rankNuevo < rankActual &&
    derivado !== 'cancelado'
  ) {
    return null;
  }

  return derivado;
}

/** Merge DB rows with the fulfillment just written. */
export function estadosFulfillmentConOverride(
  rows: ReadonlyArray<{ id: string; estado: string }>,
  overrideId: string,
  overrideEstado: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    seen.add(row.id);
    out.push(row.id === overrideId ? overrideEstado : row.estado);
  }
  if (!seen.has(overrideId)) out.push(overrideEstado);
  return out;
}
