/**
 * Guards for Siigo/DIAN credit-note (nota crédito) annulment.
 * Pure helpers — used by anular-factura-dian and covered by vitest.
 */

export type FacturaEstadoAnulable =
  | 'pendiente_pago'
  | 'pendiente_envio'
  | 'emitida'
  | 'rechazada'
  | 'error'
  | 'anulando'
  | 'anulada'
  | string;

export type AnularClaimDecision =
  | { ok: true; action: 'claim' }
  | { ok: true; action: 'dry_run' }
  | {
      ok: false;
      code: 'YA_ANULADA' | 'ANULACION_EN_CURSO' | 'FACTURA_NO_EMITIDA';
      message: string;
      status: number;
    };

/**
 * Decide whether live annulment may CAS-claim `emitida` → `anulando`
 * before calling Siigo `crearNotaCredito`.
 */
export function evaluateAnularClaim(input: {
  dryRun: boolean;
  facturaEstado: string | null | undefined;
}): AnularClaimDecision {
  const estado = String(input.facturaEstado ?? '')
    .trim()
    .toLowerCase();

  if (input.dryRun) {
    if (estado === 'anulada') {
      return {
        ok: false,
        code: 'YA_ANULADA',
        message: 'La factura ya esta marcada como anulada',
        status: 409,
      };
    }
    return { ok: true, action: 'dry_run' };
  }

  if (estado === 'anulada') {
    return {
      ok: false,
      code: 'YA_ANULADA',
      message: 'La factura ya esta marcada como anulada',
      status: 409,
    };
  }

  if (estado === 'anulando') {
    return {
      ok: false,
      code: 'ANULACION_EN_CURSO',
      message: 'Ya hay una anulacion en curso para esta factura',
      status: 409,
    };
  }

  if (estado !== 'emitida') {
    return {
      ok: false,
      code: 'FACTURA_NO_EMITIDA',
      message: `Solo se anulan facturas emitidas (estado actual: ${estado || 'desconocido'})`,
      status: 422,
    };
  }

  return { ok: true, action: 'claim' };
}

/**
 * After a lost CAS claim (`emitida` → `anulando` updated 0 rows), map the
 * current row estado to the client error.
 */
export function evaluateLostAnularClaim(facturaEstado: string | null | undefined): {
  code: 'YA_ANULADA' | 'ANULACION_EN_CURSO' | 'FACTURA_NO_EMITIDA';
  message: string;
  status: number;
} {
  const decision = evaluateAnularClaim({ dryRun: false, facturaEstado });
  if (!decision.ok) {
    return { code: decision.code, message: decision.message, status: decision.status };
  }
  return {
    code: 'ANULACION_EN_CURSO',
    message: 'Ya hay una anulacion en curso para esta factura',
    status: 409,
  };
}
