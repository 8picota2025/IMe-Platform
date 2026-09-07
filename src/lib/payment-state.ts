/**
 * Minimal structural client used by Edge Functions to claim a paid transition.
 * Keeping this interface local makes the helper unit-testable without importing
 * the Supabase runtime into the browser test suite.
 */
export interface PaymentStateUpdateResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

export interface PaymentStateSelectBuilder {
  maybeSingle(): Promise<PaymentStateUpdateResult>;
}

/** After the first `.eq('id', …)` the chain supports paid-claim (neq) or void-claim (eq). */
export interface PaymentStateIdFilter {
  neq(column: string, value: string): { select(columns: string): PaymentStateSelectBuilder };
  eq(column: string, value: string): { select(columns: string): PaymentStateSelectBuilder };
}

export interface PaymentStateClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): PaymentStateIdFilter;
    };
  };
}

export interface PaidTransitionClaim {
  claimed: boolean;
  error: string | null;
}

/**
 * Atomically changes a non-paid order to paid and returns whether this caller
 * won the transition. Only the winner may execute customer/provider side effects.
 */
export async function claimPaidTransition(
  client: PaymentStateClient,
  pedidoId: string
): Promise<PaidTransitionClaim> {
  const { data, error } = await client
    .from('pedidos')
    .update({ estado: 'pagado' })
    .eq('id', pedidoId)
    .neq('estado', 'pagado')
    .select('id')
    .maybeSingle();

  if (error) return { claimed: false, error: error.message };
  return { claimed: data !== null, error: null };
}

/**
 * Atomically moves a paid order to cancelado after Wompi VOIDED (card void).
 * Only the winner should notify the customer that payment was reversed.
 */
export async function claimCancelFromPaid(
  client: PaymentStateClient,
  pedidoId: string,
  extraFields: Record<string, unknown> = {}
): Promise<PaidTransitionClaim> {
  const { data, error } = await client
    .from('pedidos')
    .update({ estado: 'cancelado', ...extraFields })
    .eq('id', pedidoId)
    .eq('estado', 'pagado')
    .select('id')
    .maybeSingle();

  if (error) return { claimed: false, error: error.message };
  return { claimed: data !== null, error: null };
}
