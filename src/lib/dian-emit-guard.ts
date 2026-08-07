/**
 * Guards for live DIAN/Siigo invoice emission.
 * Pure helpers — used by emitir-factura-dian and covered by vitest.
 */

export type DianEmitGuardInput = {
  dryRun: boolean;
  facturacionSolicitada: boolean;
  pedidoEstado: string;
  /** Estado en facturas_electronicas, si existe. */
  facturaEstado?: string | null;
  /** Mirror en pedidos.facturacion_electronica_estado. */
  pedidoFacturaEstado?: string | null;
};

export type DianEmitGuardResult =
  | { ok: true }
  | { ok: false; kind: 'skip'; code: string; message?: string }
  | { ok: false; kind: 'reject'; code: string; message: string; status: number };

/**
 * Decide si se puede emitir (o dry-run) una factura DIAN para un pedido.
 * Live emission requires pago confirmado and blocks re-emission when already emitida.
 */
export function evaluateDianEmitGuard(input: DianEmitGuardInput): DianEmitGuardResult {
  if (!input.facturacionSolicitada) {
    return { ok: false, kind: 'skip', code: 'no_solicitada' };
  }

  // dry_run valida borrador/config sin crear documento fiscal.
  if (input.dryRun) return { ok: true };

  const facturaEstado = (input.facturaEstado ?? input.pedidoFacturaEstado ?? '').toLowerCase();
  if (facturaEstado === 'emitida') {
    return {
      ok: false,
      kind: 'skip',
      code: 'ya_emitida',
      message: 'La factura electronica ya fue emitida para este pedido',
    };
  }

  if (input.pedidoEstado !== 'pagado') {
    return {
      ok: false,
      kind: 'reject',
      code: 'PEDIDO_NO_PAGADO',
      message: `Solo se emite factura DIAN para pedidos pagados (estado actual: ${input.pedidoEstado || 'desconocido'})`,
      status: 422,
    };
  }

  return { ok: true };
}

/**
 * Estado de facturación al guardar datos fiscales desde admin.
 * No adelanta a pendiente_envio si el pedido aún no está pagado.
 */
export function estadoFacturacionTrasEdicionFiscal(opts: {
  solicitar: boolean;
  pedidoEstado: string;
  estadoActual?: string | null;
}): string {
  if (!opts.solicitar) return 'no_solicitada';

  const actual = (opts.estadoActual ?? '').toLowerCase();
  if (actual === 'emitida' || actual === 'anulada') return actual;

  if (opts.pedidoEstado === 'pagado') return 'pendiente_envio';
  return 'pendiente_pago';
}
