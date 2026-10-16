/**
 * Referencias de pasarela / checkout.
 * Wompi y Stripe buscan el pedido por `pedidos.referencia_pasarela`.
 * Esa columna debe ser el UUID del pedido (como en crear-pago), nunca el
 * número de cotización (IME-Q-…): si no hay fila, el webhook marca el evento
 * procesado y el cobro queda huérfano.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esReferenciaPedidoUuid(value: string | null | undefined): boolean {
  const ref = String(value ?? '').trim();
  return UUID_RE.test(ref);
}

/** Números de presupuesto / cotización que no deben firmarse como reference Wompi. */
export function pareceNumeroCotizacion(value: string | null | undefined): boolean {
  const ref = String(value ?? '').trim();
  if (!ref || esReferenciaPedidoUuid(ref)) return false;
  return /^(IME[-_]?Q[-_]?|COT[-_]?|BORRADOR)/i.test(ref) || /^Q[-_]?\d/i.test(ref);
}
