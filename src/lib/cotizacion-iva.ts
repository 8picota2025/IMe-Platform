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
import type { CotizacionLineaOferta } from './cotizacion-oferta';

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

export interface DesgloseLinea {
  base: number;
  iva: number;
  total: number;
  tasaPct: number;
  tratamiento: TratamientoIva;
}

export function desgloseLinea(input: {
  precioUnitario: number;
  cantidad: number;
  tratamiento: TratamientoIva;
  impuestosIncluidos: boolean;
  pendiente?: boolean;
}): DesgloseLinea {
  const tratamiento = input.tratamiento;
  const tasaPct = tasaDeTratamiento(tratamiento);
  if (input.pendiente) {
    return { base: 0, iva: 0, total: 0, tasaPct, tratamiento };
  }
  const bruto = roundMoney(input.precioUnitario * input.cantidad);
  if (tasaPct === 0) {
    return { base: bruto, iva: 0, total: bruto, tasaPct: 0, tratamiento };
  }
  if (input.impuestosIncluidos) {
    const base = roundMoney(bruto / (1 + tasaPct / 100));
    const iva = roundMoney(bruto - base);
    return { base, iva, total: bruto, tasaPct, tratamiento };
  }
  const iva = roundMoney(bruto * (tasaPct / 100));
  return { base: bruto, iva, total: roundMoney(bruto + iva), tasaPct, tratamiento };
}

export interface DesgloseCotizacion {
  base: number;
  iva: number;
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
      'precio_unitario' | 'cantidad' | 'slug' | 'moneda' | 'precio_pendiente_validar'
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
    });
  });
  const base = roundMoney(detalles.reduce((acc, linea) => acc + linea.base, 0));
  const iva = roundMoney(detalles.reduce((acc, linea) => acc + linea.iva, 0));
  const total = roundMoney(detalles.reduce((acc, linea) => acc + linea.total, 0));
  const tasas = new Set(
    detalles.filter(linea => linea.base > 0 || linea.total > 0).map(linea => linea.tasaPct)
  );
  const tasaUnica = tasas.size === 1 ? ([...tasas][0] ?? 0) : null;
  return {
    base,
    iva,
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
  desglose: Pick<DesgloseCotizacion, 'tasaUnica'>,
  impuestosIncluidos: boolean,
  locale: 'es' | 'en'
): string {
  const tasa = desglose.tasaUnica;
  if (tasa == null) return locale === 'en' ? 'VAT' : 'IVA';
  if (tasa === 0) return locale === 'en' ? 'VAT 0%' : 'IVA 0%';
  if (impuestosIncluidos) {
    return locale === 'en' ? `VAT ${tasa}% incl.` : `IVA ${tasa}% incl.`;
  }
  return locale === 'en' ? `VAT ${tasa}%` : `IVA ${tasa}%`;
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
