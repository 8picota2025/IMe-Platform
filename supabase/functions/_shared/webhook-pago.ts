/**
 * Helpers compartidos para webhooks de pago (Wompi/Stripe).
 *
 * Reglas:
 * - Un fallo temporal de verificación NO debe marcar el evento como procesado
 *   ni degradar el pedido a error_verificacion (bloquearía reintentos).
 * - La transición a 'pagado' debe reclamarse de forma atómica para evitar
 *   doble fulfillment / doble factura / doble email.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Estados desde los que aún se puede reconciliar contra la pasarela. */
export const ESTADOS_RECONCILIABLES = ['pendiente', 'error_verificacion'] as const;

export type EstadoReconciliable = (typeof ESTADOS_RECONCILIABLES)[number];

export function esEstadoReconciliable(estado: string): estado is EstadoReconciliable {
  return (ESTADOS_RECONCILIABLES as readonly string[]).includes(estado);
}

/**
 * La verificación server-side falló por causa transitoria (API caída, red, clave).
 * El webhook debe responder 5xx y dejar el evento sin procesar para reintento.
 */
export function esVerificacionReintentable(estado: string): boolean {
  return estado === 'error_verificacion';
}

/**
 * Idempotency key for Wompi events.
 * Includes status + timestamp so distinct state transitions are not collapsed,
 * while identical retries (same payload) remain deduplicated.
 */
export function buildWompiEventId(
  eventName: string,
  transaction: { id?: string; reference?: string; status?: string },
  timestamp: unknown
): string {
  const txnKey = transaction.id ?? transaction.reference ?? 'unknown';
  const status = String(transaction.status ?? 'unknown').toUpperCase();
  const ts = timestamp === undefined || timestamp === null || timestamp === '' ? '0' : String(timestamp);
  return `${eventName}:${txnKey}:${status}:${ts}`;
}

export interface ClaimPagadoResult {
  claimed: boolean;
  previousEstado: string;
}

/**
 * Atomically transitions pedido → pagado only if still reconciliable.
 * Returns claimed=false when another worker already finalized the order.
 */
export async function claimPedidoPagado(
  supabase: SupabaseClient,
  pedidoId: string,
  metadataPatch: Record<string, unknown>,
  metadataActual: Record<string, unknown> | null
): Promise<ClaimPagadoResult> {
  const { data, error } = await supabase
    .from('pedidos')
    .update({
      estado: 'pagado',
      metadata: { ...(metadataActual ?? {}), ...metadataPatch },
    })
    .eq('id', pedidoId)
    .in('estado', [...ESTADOS_RECONCILIABLES])
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('claimPedidoPagado:', error.message);
    return { claimed: false, previousEstado: 'unknown' };
  }

  return { claimed: !!data, previousEstado: 'pendiente' };
}

/**
 * After a unique-constraint hit on eventos_pago, decide whether to skip or resume.
 * A row with procesado=false means a prior attempt crashed mid-flight — resume.
 */
export async function resolverEventoDuplicado(
  supabase: SupabaseClient,
  proveedorPago: 'wompi' | 'stripe',
  eventId: string
): Promise<'skip' | 'resume' | 'error'> {
  const { data, error } = await supabase
    .from('eventos_pago')
    .select('procesado')
    .eq('proveedor_pago', proveedorPago)
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    console.error('resolverEventoDuplicado:', error.message);
    return 'error';
  }

  if (!data) return 'resume';
  return (data as { procesado?: boolean }).procesado ? 'skip' : 'resume';
}
