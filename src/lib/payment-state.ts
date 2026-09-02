/**
 * Minimal structural client used by Edge Functions to claim a paid transition.
 * Keeping this interface local makes the helper unit-testable without importing
 * the Supabase runtime into the browser test suite.
 */
export interface PaymentStateClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string
      ): {
        neq(
          column: string,
          value: string
        ): {
          select(columns: string): {
            maybeSingle(): Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
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
