/**
 * Zone shipping for checkout totals.
 *
 * Locked quote formalization already negotiated a final commercial total —
 * same rule as `formalizar-cotizacion` / `convertir-cotizacion-pedido`
 * (`envio_total: 0`). Open cart CO checkouts still apply `tarifas_envio`.
 */
export function resolveCheckoutEnvioTotal(args: {
  mercado: string;
  preciosLockedCotizacion: boolean;
  tarifaZona: number;
}): number {
  if (args.preciosLockedCotizacion) return 0;
  if (args.mercado !== 'CO') return 0;
  return args.tarifaZona;
}
