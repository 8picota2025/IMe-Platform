/**
 * Guardas de fulfillment dropship.
 * Solo pedidos con pago confirmado (o en flujo post-pago) pueden
 * disparar notificar-proveedor.
 */

/** Estados de pedido que autorizan notificación al proveedor / creación de fulfillments. */
export const ESTADOS_PEDIDO_NOTIFICAR_PROVEEDOR = new Set([
  'pagado',
  'procesando',
  'enviado',
  'entregado',
  'retrasado',
]);

export function pedidoPermiteNotificarProveedor(estado: string | null | undefined): boolean {
  if (!estado) return false;
  return ESTADOS_PEDIDO_NOTIFICAR_PROVEEDOR.has(estado);
}
