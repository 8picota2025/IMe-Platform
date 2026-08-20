/**
 * Mirror of supabase/functions/_shared/fulfillment-guard.ts for vitest CI.
 * Keep both in sync: only paid/post-pago pedido states may notify suppliers.
 */

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
