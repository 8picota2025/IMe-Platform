/**
 * Resolución de tarifa de envío por zona (mercado CO).
 * Fail-closed: si hay tarifas activas y no se puede resolver zona, no cobrar 0 en silencio.
 */

export interface TarifaEnvioZona {
  departamentos: string[] | null;
  tarifa: number | string;
  gratis_desde: number | string | null;
}

export type EnvioZonaResult =
  | { ok: true; envio: number }
  | {
      ok: false;
      code: 'ENVIO_DEPARTAMENTO_REQUERIDO' | 'ENVIO_ZONA_DESCONOCIDA';
      message: string;
    };

export function normalizarDeptoEnvio(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Calcula el costo de envío a partir de tarifas activas.
 * - Sin tarifas: 0 (comportamiento histórico cuando no hay logística configurada).
 * - Con tarifas: exige departamento; si no hay zona específica ni default → error (no undercharge).
 * - `gratis_desde` compara contra la base (subtotal - descuento).
 */
export function resolverEnvioPorZona(
  tarifas: TarifaEnvioZona[],
  departamento: string | null | undefined,
  base: number
): EnvioZonaResult {
  if (tarifas.length === 0) return { ok: true, envio: 0 };

  const deptoRaw = typeof departamento === 'string' ? departamento.trim() : '';
  if (!deptoRaw) {
    return {
      ok: false,
      code: 'ENVIO_DEPARTAMENTO_REQUERIDO',
      message: 'Departamento requerido para calcular el envio',
    };
  }

  const depto = normalizarDeptoEnvio(deptoRaw);
  const especifica = tarifas.find(t =>
    (t.departamentos ?? []).some(d => normalizarDeptoEnvio(d) === depto)
  );
  const porDefecto = tarifas.find(t => (t.departamentos ?? []).length === 0);
  const zona = especifica ?? porDefecto;
  if (!zona) {
    return {
      ok: false,
      code: 'ENVIO_ZONA_DESCONOCIDA',
      message: 'No hay tarifa de envio para el departamento indicado',
    };
  }

  const gratisDesde = zona.gratis_desde === null ? null : Number(zona.gratis_desde);
  if (gratisDesde !== null && Number.isFinite(gratisDesde) && base >= gratisDesde) {
    return { ok: true, envio: 0 };
  }
  const tarifa = Number(zona.tarifa);
  return { ok: true, envio: Number.isFinite(tarifa) ? tarifa : 0 };
}
