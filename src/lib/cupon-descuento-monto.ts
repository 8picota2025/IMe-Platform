/**
 * Coupon discount amount after product/family eligibility filtering.
 *
 * All discount types must be capped by `baseElegible` (sum of eligible
 * line totals). Using the full cart `subtotal` for `monto_carrito` let a
 * cheap eligible SKU unlock a large fixed discount against excluded
 * expensive lines → underpriced Wompi/Stripe checkout.
 */

export type CuponTipoDescuento = 'porcentaje' | 'monto_carrito' | 'monto_producto';

export function calcularMontoDescuentoCupon(args: {
  tipo: CuponTipoDescuento;
  valor: number;
  baseElegible: number;
  /** Unit count of eligible lines (for monto_producto). */
  unidadesElegibles: number;
}): number {
  const base = Math.max(0, Number.isFinite(args.baseElegible) ? args.baseElegible : 0);
  const valorRaw = Number(args.valor);
  const valor =
    args.tipo === 'porcentaje'
      ? Math.min(100, Math.max(0, Number.isFinite(valorRaw) ? valorRaw : 0))
      : Math.max(0, Number.isFinite(valorRaw) ? valorRaw : 0);

  if (args.tipo === 'porcentaje') {
    return Math.max(0, Math.round(base * (valor / 100)));
  }
  if (args.tipo === 'monto_producto') {
    const unidades = Math.max(
      0,
      Number.isFinite(args.unidadesElegibles) ? args.unidadesElegibles : 0
    );
    return Math.max(0, Math.round(Math.min(base, valor * unidades)));
  }
  // monto_carrito: fixed amount, never larger than eligible base
  return Math.max(0, Math.round(Math.min(base, valor)));
}
