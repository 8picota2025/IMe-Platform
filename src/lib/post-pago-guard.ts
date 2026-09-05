/**
 * Guards post-pago side effects so webhook retries can safely re-enter
 * after a crash between "pedido pagado" and emails/DIAN/dropship notify.
 */

export const POST_PAGO_EVENT_TIPOS = ['pago_confirmado', 'transferencia_validada'] as const;

export type PostPagoEventTipo = (typeof POST_PAGO_EVENT_TIPOS)[number];

export function tipoEventoPostPago(
  provider: 'wompi' | 'stripe' | 'bold' | 'transferencia'
): PostPagoEventTipo {
  return provider === 'transferencia' ? 'transferencia_validada' : 'pago_confirmado';
}

/** True when an audit row shows post-pago side effects already ran for this order. */
export function yaRegistroPostPago(
  eventos: Array<{ tipo?: string | null }> | null | undefined
): boolean {
  if (!eventos || eventos.length === 0) return false;
  const tipos = new Set<string>(POST_PAGO_EVENT_TIPOS);
  return eventos.some(evento => typeof evento.tipo === 'string' && tipos.has(evento.tipo));
}
