/**
 * IVA de una cotización.
 *
 * Precedencia de la tarifa, por línea:
 * 1. `tratamiento_iva` de la línea (19, 5, excluido, exento)
 * 2. ficha del producto (`excluido_iva` o `tarifa_iva_pct`)
 * 3. si el producto no trae tarifa, 19 %
 *
 * `impuestos_incluidos` es de la cotización: el precio digitado ya es el total
 * con IVA. No se vuelve a sumar el impuesto encima.
 */
import type { CotizacionLineaOferta } from './cotizacion-oferta.ts';

export const TRATAMIENTOS_IVA = ['19', '5', 'excluido', 'exento'] as const;
export type TratamientoIva = (typeof TRATAMIENTOS_IVA)[number];

export interface ProductoIva {
  tarifa_iva_pct?: number | string | null;
  excluido_iva?: boolean | null;
}

const ALIAS_IVA: Record<string, TratamientoIva> = {
  '19': '19',
  '19%': '19',
  gravado_19: '19',
  iva_19: '19',
  '5': '5',
  '5%': '5',
  gravado_5: '5',
  iva_5: '5',
  '0': 'excluido',
  '0%': 'excluido',
  excluido: 'excluido',
  excluded: 'excluido',
  exento: 'exento',
  exempt: 'exento',
  exenta: 'exento',
};

export function parseTratamientoIva(value: unknown): TratamientoIva | null {
  if (value == null || value === '') return null;
  const key = String(value).trim().toLowerCase().replace(/\s+/g, '');
  return ALIAS_IVA[key] ?? null;
}

export function tasaDeTratamiento(tratamiento: TratamientoIva): number {
  if (tratamiento === '19') return 19;
  if (tratamiento === '5') return 5;
  return 0;
}

/**
 * Tarifa de catálogo. `null` / vacío no es 0 %: es “sin definir” y cae en 19 %.
 * Un 0 explícito o `excluido_iva` sí es IVA 0.
 */
export function tratamientoDesdeProducto(producto: ProductoIva | null | undefined): TratamientoIva {
  if (!producto) return '19';
  if (producto.excluido_iva === true) return 'excluido';
  const raw = producto.tarifa_iva_pct;
  if (raw == null || raw === '') return '19';
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return '19';
  if (n === 0) return 'excluido';
  if (n === 5) return '5';
  return '19';
}

export function resolverTratamientoLinea(
  linea: { tratamiento_iva?: unknown; moneda?: string | null },
  producto: ProductoIva | null | undefined,
  moneda?: string | null
): TratamientoIva {
  const divisa = String(moneda ?? linea.moneda ?? 'COP').toUpperCase();
  if (divisa === 'USD') return 'excluido';
  return parseTratamientoIva(linea.tratamiento_iva) ?? tratamientoDesdeProducto(producto);
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function clampDescuentoPct(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Neto = bruto × (1 − descuento/100). */
export function aplicarDescuento(bruto: number, descuentoPct: number): number {
  return roundMoney(bruto * (1 - clampDescuentoPct(descuentoPct) / 100));
}

/** Bruto = neto ÷ (1 − descuento/100). */
export function revertirDescuento(neto: number, descuentoPct: number): number {
  const tasa = clampDescuentoPct(descuentoPct);
  if (!(neto > 0)) return 0;
  if (tasa >= 100) return 0;
  if (tasa === 0) return roundMoney(neto);
  return roundMoney(neto / (1 - tasa / 100));
}

export type OrigenPrecioLinea = 'bruto' | 'neto';

export function resolverPreciosLinea(
  linea: {
    precio_bruto?: number | null;
    descuento_pct?: number | null;
    precio_neto?: number | null;
    precio_unitario?: number | null;
  },
  origen: OrigenPrecioLinea = 'bruto'
): { bruto: number; descuento_pct: number; neto: number } {
  const descuento_pct = clampDescuentoPct(linea.descuento_pct);
  const brutoRaw = Number(linea.precio_bruto);
  const netoRaw = Number(linea.precio_neto);
  const unitRaw = Number(linea.precio_unitario);
  const hasBruto = Number.isFinite(brutoRaw) && brutoRaw > 0;
  const hasNeto = Number.isFinite(netoRaw) && netoRaw > 0;
  const hasUnit = Number.isFinite(unitRaw) && unitRaw > 0;
  if (origen === 'neto' && (hasNeto || hasUnit)) {
    const neto = roundMoney(hasNeto ? netoRaw : unitRaw);
    return { bruto: revertirDescuento(neto, descuento_pct), descuento_pct, neto };
  }
  if (hasBruto) {
    const bruto = roundMoney(brutoRaw);
    return { bruto, descuento_pct, neto: aplicarDescuento(bruto, descuento_pct) };
  }
  if (hasNeto) {
    const neto = roundMoney(netoRaw);
    return { bruto: revertirDescuento(neto, descuento_pct), descuento_pct, neto };
  }
  if (hasUnit) {
    const unit = roundMoney(unitRaw);
    return { bruto: unit, descuento_pct, neto: aplicarDescuento(unit, descuento_pct) };
  }
  return { bruto: 0, descuento_pct, neto: 0 };
}

/** IVA por unidad a partir de la tarifa. No pisa un iva_unitario ya guardado. */
export function calcularIvaUnitario(
  neto: number,
  tratamiento: TratamientoIva,
  impuestosIncluidos: boolean
): number {
  const tasaPct = tasaDeTratamiento(tratamiento);
  if (!(neto > 0) || tasaPct === 0) return 0;
  if (impuestosIncluidos) {
    const base = roundMoney(neto / (1 + tasaPct / 100));
    return roundMoney(neto - base);
  }
  return roundMoney(neto * (tasaPct / 100));
}

/** Si la línea trae IVA unitario, se usa tal cual. */
export function ivaUnitarioGuardado(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? roundMoney(n) : null;
}

/**
 * IVA unitario que entra al sumatorio.
 * Un 0 guardado no cuenta como IVA cuando la tarifa es 19 % o 5 %:
 * es el hueco de “marcado el IVA, precio después” y hay que calcularlo.
 * Un importe > 0 sí se respeta (productos con IVA distinto o digitado a mano).
 */
export function ivaUnitarioEfectivo(
  value: unknown,
  neto: number,
  tratamiento: TratamientoIva,
  impuestosIncluidos: boolean
): number {
  const tasaPct = tasaDeTratamiento(tratamiento);
  const guardado = ivaUnitarioGuardado(value);
  if (guardado != null && (guardado > 0 || tasaPct === 0)) return guardado;
  return calcularIvaUnitario(neto, tratamiento, impuestosIncluidos);
}

/** La línea declaró IVA (tarifa o importe). Las antiguas sin campo no inventan 19 %. */
export function lineaDeclaraIva(linea: {
  tratamiento_iva?: unknown;
  iva_unitario?: unknown;
}): boolean {
  if (parseTratamientoIva(linea.tratamiento_iva) != null) return true;
  const iva = ivaUnitarioGuardado(linea.iva_unitario);
  return iva != null && iva > 0;
}

export interface DesgloseLinea {
  base: number;
  iva: number;
  total: number;
  /** Suma de precios de lista (bruto × cantidad). */
  bruto: number;
  tasaPct: number;
  tratamiento: TratamientoIva;
  ivaUnitario: number;
}

export function desgloseLinea(input: {
  precioUnitario: number;
  cantidad: number;
  tratamiento: TratamientoIva;
  impuestosIncluidos: boolean;
  pendiente?: boolean;
  precioBruto?: number | null;
  descuentoPct?: number | null;
  /** Si viene, no se recalcula. Productos distintos pueden tener IVA distinto. */
  ivaUnitario?: number | null;
}): DesgloseLinea {
  const tratamiento = input.tratamiento;
  const tasaPct = tasaDeTratamiento(tratamiento);
  if (input.pendiente) {
    return { base: 0, iva: 0, total: 0, bruto: 0, tasaPct, tratamiento, ivaUnitario: 0 };
  }
  const precios = resolverPreciosLinea({
    precio_bruto: input.precioBruto,
    descuento_pct: input.descuentoPct,
    precio_unitario: input.precioUnitario,
  });
  const cantidad = Math.max(0, Number(input.cantidad) || 0);
  const bruto = roundMoney(precios.bruto * cantidad);
  const netoLinea = roundMoney(precios.neto * cantidad);
  const ivaGuardado = ivaUnitarioGuardado(input.ivaUnitario);
  const ivaUnitario = ivaUnitarioEfectivo(
    input.ivaUnitario,
    precios.neto,
    tratamiento,
    input.impuestosIncluidos
  );
  const iva = roundMoney(ivaUnitario * cantidad);
  if (tasaPct === 0 && !(ivaGuardado != null && ivaGuardado > 0)) {
    return {
      base: netoLinea,
      iva: 0,
      total: netoLinea,
      bruto,
      tasaPct: 0,
      tratamiento,
      ivaUnitario: 0,
    };
  }
  if (input.impuestosIncluidos) {
    const base = roundMoney(Math.max(0, netoLinea - iva));
    return { base, iva, total: netoLinea, bruto, tasaPct, tratamiento, ivaUnitario };
  }
  return {
    base: netoLinea,
    iva,
    total: roundMoney(netoLinea + iva),
    bruto,
    tasaPct,
    tratamiento,
    ivaUnitario,
  };
}

export interface DesgloseCotizacion {
  base: number;
  iva: number;
  /** Suma de precios de lista. */
  bruto: number;
  /** Importe que el cliente paga. Nunca la base sin IVA. */
  total: number;
  impuestosIncluidos: boolean;
  lineas: DesgloseLinea[];
  /** null cuando las líneas no comparten una sola tarifa. */
  tasaUnica: number | null;
}

export function desgloseCotizacion(
  lineas: Array<
    Pick<
      CotizacionLineaOferta,
      | 'precio_unitario'
      | 'cantidad'
      | 'slug'
      | 'moneda'
      | 'precio_pendiente_validar'
      | 'precio_bruto'
      | 'descuento_pct'
      | 'precio_neto'
      | 'iva_unitario'
    > & { tratamiento_iva?: unknown }
  >,
  opts: {
    impuestosIncluidos: boolean;
    moneda: string;
    productos?: Map<string, ProductoIva> | null;
  }
): DesgloseCotizacion {
  const detalles = lineas.map(linea => {
    const tratamiento = resolverTratamientoLinea(
      linea,
      opts.productos?.get(linea.slug) ?? null,
      opts.moneda
    );
    return desgloseLinea({
      precioUnitario: linea.precio_unitario,
      cantidad: linea.cantidad,
      tratamiento,
      impuestosIncluidos: opts.impuestosIncluidos,
      pendiente: Boolean(linea.precio_pendiente_validar),
      precioBruto: linea.precio_bruto,
      descuentoPct: linea.descuento_pct,
      ivaUnitario: linea.iva_unitario,
    });
  });
  const base = roundMoney(detalles.reduce((acc, linea) => acc + linea.base, 0));
  const iva = roundMoney(detalles.reduce((acc, linea) => acc + linea.iva, 0));
  const bruto = roundMoney(detalles.reduce((acc, linea) => acc + linea.bruto, 0));
  const total = roundMoney(detalles.reduce((acc, linea) => acc + linea.total, 0));
  const tasas = new Set(
    detalles.filter(linea => linea.base > 0 || linea.total > 0).map(linea => linea.tasaPct)
  );
  const tasaUnica = tasas.size === 1 ? ([...tasas][0] ?? 0) : null;
  return {
    base,
    iva,
    bruto,
    total,
    impuestosIncluidos: opts.impuestosIncluidos,
    lineas: detalles,
    tasaUnica,
  };
}

export function totalPagarCotizacion(
  lineas: Parameters<typeof desgloseCotizacion>[0],
  opts: Parameters<typeof desgloseCotizacion>[1]
): number {
  return desgloseCotizacion(lineas, opts).total;
}

export function etiquetaIvaTotales(
  _desglose: Pick<DesgloseCotizacion, 'tasaUnica'>,
  _impuestosIncluidos: boolean,
  locale: 'es' | 'en'
): string {
  return locale === 'en' ? 'Total VAT:' : 'Total IVA:';
}

export function resumenIvaTexto(desglose: DesgloseCotizacion, locale: 'es' | 'en' = 'es'): string {
  if (desglose.iva === 0) {
    return locale === 'en'
      ? 'VAT 0%. The amount due is the quoted total.'
      : 'IVA 0 %. El total a pagar es el valor cotizado.';
  }
  if (desglose.impuestosIncluidos) {
    return locale === 'en'
      ? 'Prices already include VAT. The amount due is the quoted total, not the pre-VAT base.'
      : 'Los precios ya incluyen IVA. El total a pagar es el valor cotizado, no la base sin IVA.';
  }
  const tasa = desglose.tasaUnica;
  const label = tasa == null ? 'IVA' : `IVA ${tasa} %`;
  return locale === 'en'
    ? `VAT is added to the net prices. Amount due includes VAT.`
    : `${label} se suma a los precios netos. El total a pagar incluye IVA.`;
}

export function htmlOpcionesTratamientoIva(actual: unknown): string {
  const selected = parseTratamientoIva(actual) ?? '';
  return OPCIONES_TRATAMIENTO_IVA.map(
    opcion =>
      `<option value="${opcion.value}"${opcion.value === selected ? ' selected' : ''}>${opcion.label}</option>`
  ).join('');
}

export const OPCIONES_TRATAMIENTO_IVA: Array<{ value: '' | TratamientoIva; label: string }> = [
  { value: '', label: 'Según catálogo' },
  { value: '19', label: 'IVA 19%' },
  { value: '5', label: 'IVA 5%' },
  { value: 'excluido', label: 'IVA 0% / excluido' },
  { value: 'exento', label: 'Exento' },
];
