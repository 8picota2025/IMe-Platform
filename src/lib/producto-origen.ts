/**
 * Fabricante (marca) y distribuidor visibles en listados.
 * Marca vive en `atributos.marca` / `atributos.fabricante` (no hay columna SQL).
 * Distribuidor: `atributos.distribuidor` o I-ME vs Dropship según fulfillment.
 * No lee `proveedor_producto` (precio_costo).
 */

export type ProductoOrigenInput = {
  marca?: unknown;
  fulfillment_mode?: unknown;
  atributos?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Misma semántica que el catálogo público: top-level marca, luego atributos. */
export function resolveMarca(raw: ProductoOrigenInput): string | null {
  const attrs = asRecord(raw.atributos);
  return firstText(raw.marca, attrs.marca, attrs.fabricante, attrs.brand);
}

export function resolveDistribuidor(raw: ProductoOrigenInput): string | null {
  const attrs = asRecord(raw.atributos);
  const named = firstText(attrs.distribuidor, attrs.distributor);
  if (named) return named;
  const mode = String(raw.fulfillment_mode ?? '').trim();
  if (mode === 'dropship') return 'Dropship';
  if (mode === 'individualizado') return 'I-ME (individualizado)';
  if (mode === 'cotizacion' || mode) return 'I-ME';
  return null;
}

export function formatFabricanteDistribuidor(raw: ProductoOrigenInput): string {
  const fabricante = resolveMarca(raw);
  const distribuidor = resolveDistribuidor(raw);
  if (fabricante && distribuidor && fabricante !== distribuidor) {
    return `${fabricante} · ${distribuidor}`;
  }
  return fabricante || distribuidor || '—';
}
