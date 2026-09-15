/**
 * Builds Stripe Checkout line_items so the charged amount equals the
 * server-calculated order total (coupons, shipping, fiscal adjustments).
 *
 * Stripe prices are unit_amount × quantity. Summing catalog unit prices
 * ignores `CheckoutRequest.total`, which overcharges when a coupon applies.
 */

export interface StripeAmountInputItem {
  nombre: string;
  cantidad: number;
  /** Major currency units (e.g. USD dollars), server-side. */
  precio_unitario: number;
  moneda: string;
}

export interface StripeCheckoutLineItem {
  nombre: string;
  cantidad: number;
  /** Integer cents for Stripe price_data.unit_amount */
  unit_amount_cents: number;
  moneda: string;
}

function lineSubtotalCents(item: StripeAmountInputItem): number {
  return Math.round(item.precio_unitario * 100) * item.cantidad;
}

/**
 * Returns Stripe line items whose (unit_amount_cents × cantidad) sum equals
 * `Math.round(total * 100)`.
 *
 * When catalog subtotal already matches the target, items stay itemized.
 * When they diverge (coupon / adjustment), falls back to a single line for
 * the exact total so Stripe cannot charge more than the pedido.
 */
export function buildStripeCheckoutLineItems(
  items: StripeAmountInputItem[],
  total: number,
  referencia: string
): StripeCheckoutLineItem[] {
  const targetCents = Math.max(0, Math.round(total * 100));
  const usable = items.filter(item => item.cantidad > 0);
  const subtotalCents = usable.reduce((sum, item) => sum + lineSubtotalCents(item), 0);
  const currency = (usable[0]?.moneda ?? 'usd').toLowerCase();

  if (usable.length === 0) {
    return [
      {
        nombre: `Order ${referencia.slice(0, 8).toUpperCase()}`,
        cantidad: 1,
        unit_amount_cents: targetCents,
        moneda: currency,
      },
    ];
  }

  if (subtotalCents === targetCents) {
    return usable.map(item => ({
      nombre: item.nombre,
      cantidad: item.cantidad,
      unit_amount_cents: Math.round(item.precio_unitario * 100),
      moneda: item.moneda.toLowerCase(),
    }));
  }

  const label =
    usable.length === 1
      ? usable[0]!.nombre
      : `Order ${referencia.slice(0, 8).toUpperCase()} (${usable.length} items)`;

  return [
    {
      nombre: label,
      cantidad: 1,
      unit_amount_cents: targetCents,
      moneda: currency,
    },
  ];
}

/** Sum of unit_amount_cents × cantidad — the amount Stripe will charge. */
export function stripeLineItemsTotalCents(lines: StripeCheckoutLineItem[]): number {
  return lines.reduce((sum, line) => sum + line.unit_amount_cents * line.cantidad, 0);
}
