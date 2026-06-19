/**
 * Módulo de financiación — Colombia
 * Parámetros y cálculos financieros para equipos biomédicos
 *
 * IMPORTANTE: Estos valores son REALES y vinculantes
 * Requiere validación legal antes de publicar en producción
 *
 * @version 1.0
 * @vigencia 2026-06-19
 */

export const FINANCIACION_COLOMBIA = {
  pais: 'Colombia',
  moneda: 'COP',

  // Parámetros principales
  tasaAnualPorcentaje: 12, // 12% anual
  plazoMaximoMeses: 60, // 5 años
  plazoMaximoAnos: 5,
  plazosDisponibles: [12, 24, 36, 48, 60] as const,

  // Aporte cliente (OBLIGATORIO - Restricción legal crítica)
  aporteClientePorcentaje: 50, // 50% del costo total
  aporteClienteNota:
    'El cliente debe aportar mínimo el 50% del costo del equipo. El monto financiable es el 50% restante.',

  // Límites crediticios
  montoMinimo: 1_000_000, // COP
  montoMaximo: 500_000_000, // COP (considerando el 50% de aporte)
  montoMáximoTotal: 1_000_000_000, // COP (valor total máximo del equipo)
  montoPaso: 500_000, // Incremento sugerido
  montoSugerido: 50_000_000, // COP

  // Parámetros de mora
  interesMoraPorcentaje: 1, // 1% mensual sobre cuota vencida

  // Fechas
  vigencia: '2026-06-19',
  estado: 'COMPLETADO_LEGAL',
} as const;

/**
 * Calcula la cuota mensual usando la fórmula estándar de amortización
 *
 * Fórmula: Cuota = Monto × [r × (1 + r)^n] / [(1 + r)^n - 1]
 *
 * @param montoFinanciable - Monto a financiar (COP)
 * @param plazoMeses - Plazo en meses
 * @param tasaAnualPorcentaje - Tasa anual en porcentaje (ej: 12 para 12%)
 * @returns Cuota mensual (COP)
 */
export function calcularCuotaMensual(
  montoFinanciable: number,
  plazoMeses: number,
  tasaAnualPorcentaje: number = FINANCIACION_COLOMBIA.tasaAnualPorcentaje
): number {
  // Convertir tasa anual a tasa mensual en decimal
  const tasaMensualDecimal = tasaAnualPorcentaje / 100 / 12;

  if (tasaMensualDecimal === 0) {
    // Si no hay tasa (caso especial), división simple
    return montoFinanciable / plazoMeses;
  }

  // r × (1 + r)^n / [(1 + r)^n - 1]
  const factor =
    (tasaMensualDecimal * Math.pow(1 + tasaMensualDecimal, plazoMeses)) /
    (Math.pow(1 + tasaMensualDecimal, plazoMeses) - 1);

  return montoFinanciable * factor;
}

/**
 * Calcula el resumen total de financiación
 */
export function calcularResumenFinanciacion(costoEquipo: number, plazoMeses: number) {
  // Validar aporte del cliente
  const aporteCliente = costoEquipo * (FINANCIACION_COLOMBIA.aporteClientePorcentaje / 100);
  const montoFinanciable = costoEquipo - aporteCliente;

  if (montoFinanciable < FINANCIACION_COLOMBIA.montoMinimo) {
    throw new Error(
      `Monto financiable (${montoFinanciable.toLocaleString('es-CO')}) ` +
        `es menor al mínimo requerido (${FINANCIACION_COLOMBIA.montoMinimo.toLocaleString('es-CO')})`
    );
  }

  if (montoFinanciable > FINANCIACION_COLOMBIA.montoMaximo) {
    throw new Error(
      `Monto financiable (${montoFinanciable.toLocaleString('es-CO')}) ` +
        `excede el máximo permitido (${FINANCIACION_COLOMBIA.montoMaximo.toLocaleString('es-CO')})`
    );
  }

  const cuotaMensual = calcularCuotaMensual(montoFinanciable, plazoMeses);
  const totalPagado = cuotaMensual * plazoMeses;
  const totalIntereses = totalPagado - montoFinanciable;

  return {
    costoEquipo,
    aporteCliente,
    montoFinanciable,
    plazoMeses,
    tasaAnualPorcentaje: FINANCIACION_COLOMBIA.tasaAnualPorcentaje,
    cuotaMensual,
    totalIntereses,
    totalPagado,

    // Resumen
    resumen: {
      pagoMensual: `${cuotaMensual.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} COP`,
      totalPagos: plazoMeses,
      periodicidad: 'Mensual',
      tasaAnual: `${FINANCIACION_COLOMBIA.tasaAnualPorcentaje}%`,
      totalIntereses: `${totalIntereses.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} COP`,
      totalAPagar: `${totalPagado.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} COP`,
    },
  };
}

/**
 * Genera un cronograma de pagos completo
 */
export function generarCronogramaPagos(montoFinanciable: number, plazoMeses: number) {
  const cuotaMensual = calcularCuotaMensual(montoFinanciable, plazoMeses);
  const cronograma: Array<{
    cuota: number;
    fecha: string;
    capital: number;
    interes: number;
    saldo: number;
  }> = [];

  let saldoInsoluto = montoFinanciable;
  const tasaMensualDecimal = FINANCIACION_COLOMBIA.tasaAnualPorcentaje / 100 / 12;

  for (let i = 1; i <= plazoMeses; i++) {
    const interesMes = saldoInsoluto * tasaMensualDecimal;
    const capitalMes = cuotaMensual - interesMes;
    saldoInsoluto -= capitalMes;

    // Redondeos en última cuota
    const esUltimaCuota = i === plazoMeses;
    const cuotaFinal = esUltimaCuota
      ? montoFinanciable - cronograma.reduce((sum, c) => sum + c.capital, 0)
      : cuotaMensual;

    cronograma.push({
      cuota: i,
      fecha: new Date(new Date().setMonth(new Date().getMonth() + i)).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
      capital: esUltimaCuota ? cuotaFinal : capitalMes,
      interes: interesMes,
      saldo: Math.max(0, saldoInsoluto),
    });
  }

  return cronograma;
}

/**
 * Valida si un monto es elegible para financiación
 */
export function validarElegibilidad(costoEquipo: number): {
  valido: boolean;
  mensajes: string[];
} {
  const mensajes: string[] = [];

  if (costoEquipo < FINANCIACION_COLOMBIA.montoMinimo * 2) {
    mensajes.push(
      `Equipo muy económico: costo de ${costoEquipo.toLocaleString('es-CO')} COP. ` +
        `Aporte mínimo del cliente sería ${(costoEquipo * 0.5).toLocaleString('es-CO')} COP.`
    );
  }

  if (costoEquipo > FINANCIACION_COLOMBIA.montoMáximoTotal) {
    mensajes.push(
      `Equipo muy costoso: ${costoEquipo.toLocaleString('es-CO')} COP ` +
        `excede máximo de ${FINANCIACION_COLOMBIA.montoMáximoTotal.toLocaleString('es-CO')} COP.`
    );
  }

  return {
    valido: mensajes.length === 0,
    mensajes,
  };
}

/**
 * Formatea número a divisa COP
 */
export function formatearCOP(valor: number): string {
  return valor.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Obtiene el máximo a financiar considerando el límite de I-ME
 * y el requisito del 50% de aporte del cliente
 */
export function calcularMontoFinanciableMaximo(
  costoEquipoSugerido: number = FINANCIACION_COLOMBIA.montoSugerido * 2
): number {
  const montoFinanciableIdeal = costoEquipoSugerido * 0.5;
  return Math.min(montoFinanciableIdeal, FINANCIACION_COLOMBIA.montoMaximo);
}

/**
 * Tipos para TypeScript
 */
export interface ConfiguracionFinanciacion {
  costoEquipo: number;
  plazoMeses: number;
  tasaAnualPorcentaje?: number;
}

export interface ResumenFinanciacion {
  costoEquipo: number;
  aporteCliente: number;
  montoFinanciable: number;
  plazoMeses: number;
  tasaAnualPorcentaje: number;
  cuotaMensual: number;
  totalIntereses: number;
  totalPagado: number;
  resumen: {
    pagoMensual: string;
    totalPagos: number;
    periodicidad: string;
    tasaAnual: string;
    totalIntereses: string;
    totalAPagar: string;
  };
}
