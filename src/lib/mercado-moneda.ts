/**
 * Payment mercado must follow catalog/offer currency.
 * Self-asserted `mercado=INTL` on a COP cart would skip Colombian IVA
 * (fiscal only applies when mercado=CO && moneda=COP) while still charging
 * COP via Stripe — underprice vs the Wompi/CO path.
 */

export type MercadoPago = 'CO' | 'INTL';

/** USD → Stripe/INTL; anything else (COP, empty, unknown) → Wompi/CO. */
export function mercadoDesdeMoneda(moneda: string | null | undefined): MercadoPago {
  return String(moneda ?? '')
    .trim()
    .toUpperCase() === 'USD'
    ? 'INTL'
    : 'CO';
}

export function mercadoMonedaCompatibles(
  mercado: string | null | undefined,
  moneda: string | null | undefined
): boolean {
  const m = String(mercado ?? '')
    .trim()
    .toUpperCase();
  if (m !== 'CO' && m !== 'INTL') return false;
  return mercadoDesdeMoneda(moneda) === m;
}
