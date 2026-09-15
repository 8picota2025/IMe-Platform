/**
 * Precio público edge-safe (sin i18n). Misma semántica que src/lib/format.ts
 * resolvePrecioPublico / precioConIvaColombia.
 */

export const IVA_COLOMBIA_PCT = 19;

function tienePrecioPublico(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

function numeroPublicable(valor: unknown): number | null {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return tienePrecioPublico(numero) ? numero : null;
}

function ofertaVigente(row: Record<string, unknown>): number | null {
  const precioOferta = numeroPublicable(row['precio_oferta']);
  if (precioOferta === null) return null;
  const ahora = Date.now();
  const inicio = row['oferta_inicio'];
  const fin = row['oferta_fin'];
  const inicioOk =
    typeof inicio !== 'string' || !inicio.trim() || new Date(inicio).getTime() <= ahora;
  const finOk = typeof fin !== 'string' || !fin.trim() || new Date(fin).getTime() >= ahora;
  return inicioOk && finOk ? precioOferta : null;
}

function precioConIvaColombia(precioBase: number): number | null {
  if (!tienePrecioPublico(precioBase)) return null;
  const baseEnPesos = Math.round(precioBase);
  return baseEnPesos + Math.round((baseEnPesos * IVA_COLOMBIA_PCT) / 100);
}

export function resolvePrecioPublico(row: unknown): number | null {
  if (!row || typeof row !== 'object') return null;
  const valores = row as Record<string, unknown>;
  return precioConIvaColombia(
    ofertaVigente(valores) ?? numeroPublicable(valores['precio_regular']) ?? 0
  );
}
