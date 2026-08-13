/**
 * Compare-and-swap claim for the transition to `pagado`.
 *
 * Payment webhooks and success-page reconcile can race on the same order.
 * Only the caller that wins this update may run post-pago side effects
 * (client totals, emails, DIAN, dropship notify).
 */

export interface PedidoPagadoClaimClient {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string
      ) => {
        neq: (
          column: string,
          value: string
        ) => {
          select: (columns: string) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
}

export async function claimPedidoPagado(
  supabase: PedidoPagadoClaimClient,
  pedidoId: string,
  metadata: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await supabase
    .from('pedidos')
    .update({
      estado: 'pagado',
      metadata,
    })
    .eq('id', pedidoId)
    .neq('estado', 'pagado')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('claimPedidoPagado:', error.message);
    return false;
  }

  return Boolean(data?.id);
}
