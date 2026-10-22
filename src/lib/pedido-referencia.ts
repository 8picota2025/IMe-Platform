/**
 * Referencias de pasarela / checkout.
 * Wompi y Stripe buscan el pedido por `pedidos.referencia_pasarela`.
 * Esa columna debe ser el UUID del pedido (como en crear-pago), nunca el
 * número de cotización (IME-Q-…): si no hay fila, el webhook marca el evento
 * procesado y el cobro queda huérfano.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/**
 * Recuperación IME-Q (#203/#205): solo materializar/reclamar cotización cuando
 * la verificación server-side confirma cobro. DECLINED/VOIDED/PENDING no deben
 * insertar pedido ni marcar la oferta `convertida` (bloquea Formalizar).
 */
export function debeRecuperarPedidoImeQ(
  referenciaPasarela: string | null | undefined,
  estadoVerificado: string | null | undefined
): boolean {
  return pareceNumeroCotizacion(referenciaPasarela) && estadoVerificado === 'pagado';
}

/**
 * Reuso de pedido Wompi pendiente cuando el webhook trae override IME-Q.
 * - same / empty existing → ok (usar tal cual)
 * - distinta + pendiente → rebind (adjuntar cobro IME-Q al pedido Formalizar)
 * - distinta + no pendiente → reject (no pisar pagado/rechazado)
 */
export type CompatibilidadRefWompi = 'ok' | 'rebind' | 'reject';

export function compatibilidadReferenciaWompi(opts: {
  referenciaExistente: string | null | undefined;
  override: string | null | undefined;
  estadoPedido: string | null | undefined;
}): CompatibilidadRefWompi {
  const override = String(opts.override ?? '').trim();
  if (!override) return 'ok';
  const existente = String(opts.referenciaExistente ?? '').trim();
  if (!existente || existente === override) return 'ok';
  return String(opts.estadoPedido ?? '') === 'pendiente' ? 'rebind' : 'reject';
}
