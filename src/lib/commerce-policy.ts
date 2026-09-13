/**
 * Política comercial única (F4.2).
 *
 * Comprabilidad, disponibilidad y elegibilidad Merchant Center deben
 * resolverse aquí — no con filtros ad-hoc en cards, landings, checkout o feed.
 *
 * Jerarquía ADR-0009: activo → disponible → stock_estado → stock → fulfillment.
 * Regla feat-comercio: precio público > 0 → checkout; sin precio → cotización.
 * Umbral $6M COP: NO forma parte de esta política (ausente en repo).
 *
 * Nota Edge/Deno: sin imports a format/i18n (el bundler de functions exige
 * grafo autocontenido con extensiones .ts).
 */

function tienePrecioPublico(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

export type StockEstado = 'instock' | 'outofstock' | 'onbackorder';
export type BackorderPolicy = 'no' | 'notify' | 'yes';
export type FulfillmentMode = 'dropship' | 'cotizacion' | 'individualizado';

export type AvailabilityState =
  | 'available'
  | 'unavailable'
  | 'out_of_stock'
  | 'backorder'
  | 'unknown';

export interface CommerceProductSignals {
  activo?: boolean | null;
  disponible?: boolean | null;
  /** Precio público ya resuelto (p. ej. con IVA), no precio_costo. */
  precio?: number | null;
  stock?: number | null;
  gestionar_stock?: boolean | null;
  stock_estado?: string | null;
  backorder_policy?: string | null;
  fulfillment_mode?: string | null;
  imagen_principal?: string | null;
  slug?: string | null;
  /** Marca/fabricante reales si existen; no inventar "I-ME". */
  marca?: string | null;
  fabricante?: string | null;
}

export interface AvailabilityResult {
  state: AvailabilityState;
  /** Unidades vendibles ahora (null = no se gestiona cantidad). */
  unitsAvailable: number | null;
  reason: string;
}

export interface PolicyResult {
  ok: boolean;
  reason: string;
}

function asStockEstado(value: string | null | undefined): StockEstado | null {
  if (value === 'instock' || value === 'outofstock' || value === 'onbackorder') return value;
  return null;
}

function asBackorder(value: string | null | undefined): BackorderPolicy {
  if (value === 'notify' || value === 'yes') return value;
  return 'no';
}

/**
 * Disponibilidad operativa (no es solo `stock > 0`).
 * `disponible=false` saca de venta aunque haya stock físico.
 */
export function resolveAvailability(product: CommerceProductSignals): AvailabilityResult {
  if (product.activo === false) {
    return { state: 'unavailable', unitsAvailable: 0, reason: 'inactivo' };
  }
  if (product.disponible === false) {
    return { state: 'unavailable', unitsAvailable: 0, reason: 'no_disponible' };
  }

  const stockEstado = asStockEstado(product.stock_estado ?? null);
  const backorder = asBackorder(product.backorder_policy ?? null);
  const gestiona =
    product.gestionar_stock === true || (product.stock !== null && product.stock !== undefined);

  if (stockEstado === 'outofstock') {
    if (backorder === 'yes') {
      return { state: 'backorder', unitsAvailable: 0, reason: 'backorder' };
    }
    return { state: 'out_of_stock', unitsAvailable: 0, reason: 'stock_estado_outofstock' };
  }

  if (stockEstado === 'onbackorder') {
    return { state: 'backorder', unitsAvailable: 0, reason: 'stock_estado_onbackorder' };
  }

  if (gestiona && typeof product.stock === 'number') {
    if (!Number.isFinite(product.stock) || product.stock <= 0) {
      if (backorder === 'yes') {
        return { state: 'backorder', unitsAvailable: 0, reason: 'sin_stock_backorder' };
      }
      return { state: 'out_of_stock', unitsAvailable: 0, reason: 'sin_stock' };
    }
    return {
      state: 'available',
      unitsAvailable: Math.floor(product.stock),
      reason: 'stock_positivo',
    };
  }

  // Sin gestión de cantidad: disponible operativo sin cifra.
  return { state: 'available', unitsAvailable: null, reason: 'disponible_sin_cupo' };
}

/**
 * ¿Puede ir a checkout automático?
 * No muta tipo_comercial. No usa umbral $6M. No trata INVIMA como veto automático.
 */
export function isPurchasable(
  product: CommerceProductSignals,
  opts: { quantity?: number } = {}
): PolicyResult {
  const quantity = Math.max(1, Math.floor(opts.quantity ?? 1));

  if (product.activo === false) {
    return { ok: false, reason: 'inactivo' };
  }
  if (!tienePrecioPublico(product.precio)) {
    return { ok: false, reason: 'sin_precio' };
  }
  if (product.disponible === false) {
    return { ok: false, reason: 'no_disponible' };
  }

  const availability = resolveAvailability(product);
  if (availability.state === 'unavailable' || availability.state === 'out_of_stock') {
    return { ok: false, reason: availability.reason };
  }
  // backorder: no checkout automático hasta política humana (conservador).
  if (availability.state === 'backorder') {
    return { ok: false, reason: availability.reason };
  }
  if (availability.unitsAvailable !== null && quantity > availability.unitsAvailable) {
    return { ok: false, reason: 'stock_insuficiente' };
  }

  return { ok: true, reason: 'comprable' };
}

/**
 * Elegibilidad Google Merchant Center — separada de isPurchasable.
 * Un SKU puede venderse en I-ME y no listarse en Merchant.
 */
export function isMerchantEligible(product: CommerceProductSignals): PolicyResult {
  if (product.activo === false) {
    return { ok: false, reason: 'inactivo' };
  }
  if (!tienePrecioPublico(product.precio)) {
    return { ok: false, reason: 'sin_precio' };
  }

  const slug = typeof product.slug === 'string' ? product.slug.trim() : '';
  if (!slug) {
    return { ok: false, reason: 'sin_slug' };
  }

  const image = typeof product.imagen_principal === 'string' ? product.imagen_principal.trim() : '';
  if (!image) {
    return { ok: false, reason: 'sin_imagen' };
  }

  const availability = resolveAvailability(product);
  if (availability.state !== 'available') {
    return { ok: false, reason: `availability_${availability.state}` };
  }

  // Merchant: stock gestionado en 0 no debe listarse como in stock.
  if (availability.unitsAvailable === 0) {
    return { ok: false, reason: 'sin_unidades' };
  }

  const purchase = isPurchasable(product, { quantity: 1 });
  if (!purchase.ok) {
    return { ok: false, reason: purchase.reason };
  }

  return { ok: true, reason: 'merchant_ok' };
}

/** Bucket comercial derivado (no muta atributos de catálogo). */
export type CommerceBucket = 'A_compra_directa' | 'B_bundle' | 'C_cotizacion';

export function classifyCommerceBucket(
  product: CommerceProductSignals,
  opts: { isBundle?: boolean } = {}
): CommerceBucket {
  if (opts.isBundle) {
    return isPurchasable(product).ok ? 'B_bundle' : 'C_cotizacion';
  }
  return isPurchasable(product).ok ? 'A_compra_directa' : 'C_cotizacion';
}

/**
 * Disponibilidad g:availability para Merchant (valores oficiales).
 * Solo llamar tras isMerchantEligible().ok o documentar el motivo.
 */
export function merchantAvailability(
  product: CommerceProductSignals
): 'in_stock' | 'out_of_stock' | 'preorder' {
  const availability = resolveAvailability(product);
  if (availability.state === 'available') return 'in_stock';
  if (availability.state === 'backorder') return 'preorder';
  return 'out_of_stock';
}
