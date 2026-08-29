/**
 * Admin cupones.excluir_ofertas must drop lines charged at an active
 * catalog precio_oferta. crear-pago previously ignored the flag, so
 * percentage/fixed coupons stacked on already-reduced offer prices
 * (live underpriced Wompi/Stripe checkout).
 */

export function isProductoEnOfertaVigente(args: {
  precioOferta: number | string | null | undefined;
  ofertaInicio?: string | null;
  ofertaFin?: string | null;
  nowMs?: number;
}): boolean {
  if (args.precioOferta === null || args.precioOferta === undefined) return false;
  const oferta = Number(args.precioOferta);
  if (!Number.isFinite(oferta) || !(oferta > 0)) return false;
  const now = args.nowMs ?? Date.now();
  const inicioOk = !args.ofertaInicio || new Date(args.ofertaInicio).getTime() <= now;
  const finOk = !args.ofertaFin || new Date(args.ofertaFin).getTime() >= now;
  return inicioOk && finOk;
}

/** False when the coupon excludes offer SKUs and this line is on oferta. */
export function isCuponLineaPermitidaConExcluirOfertas(args: {
  excluirOfertas: boolean;
  enOferta: boolean;
}): boolean {
  if (args.excluirOfertas && args.enOferta) return false;
  return true;
}
