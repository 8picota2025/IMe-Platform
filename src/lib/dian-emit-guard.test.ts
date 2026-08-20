import { describe, expect, it } from 'vitest';

import {
  estadoFacturacionTrasEdicionFiscal,
  evaluateDianEmitGuard,
} from './dian-emit-guard';

describe('evaluateDianEmitGuard', () => {
  it('omite emision cuando no se solicito factura electronica', () => {
    const result = evaluateDianEmitGuard({
      dryRun: false,
      facturacionSolicitada: false,
      pedidoEstado: 'pagado',
    });
    expect(result).toEqual({ ok: false, kind: 'skip', code: 'no_solicitada' });
  });

  it('bloquea emision live si el pedido no esta pagado', () => {
    const result = evaluateDianEmitGuard({
      dryRun: false,
      facturacionSolicitada: true,
      pedidoEstado: 'pendiente_validacion',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('reject');
      expect(result.code).toBe('PEDIDO_NO_PAGADO');
      if (result.kind === 'reject') expect(result.status).toBe(422);
    }
  });

  it('omite reemision live cuando la factura ya esta emitida', () => {
    const result = evaluateDianEmitGuard({
      dryRun: false,
      facturacionSolicitada: true,
      pedidoEstado: 'pagado',
      facturaEstado: 'emitida',
    });
    expect(result).toMatchObject({ ok: false, kind: 'skip', code: 'ya_emitida' });
  });

  it('permite dry_run aunque el pedido no este pagado', () => {
    const result = evaluateDianEmitGuard({
      dryRun: true,
      facturacionSolicitada: true,
      pedidoEstado: 'pendiente_validacion',
    });
    expect(result).toEqual({ ok: true });
  });

  it('permite emision live de pedidos pagados sin factura emitida', () => {
    const result = evaluateDianEmitGuard({
      dryRun: false,
      facturacionSolicitada: true,
      pedidoEstado: 'pagado',
      facturaEstado: 'pendiente_pago',
    });
    expect(result).toEqual({ ok: true });
  });
});

describe('estadoFacturacionTrasEdicionFiscal', () => {
  it('no adelanta a pendiente_envio si el pedido no esta pagado', () => {
    expect(
      estadoFacturacionTrasEdicionFiscal({
        solicitar: true,
        pedidoEstado: 'pendiente_validacion',
        estadoActual: 'pendiente_pago',
      })
    ).toBe('pendiente_pago');
  });

  it('marca pendiente_envio solo cuando el pedido ya esta pagado', () => {
    expect(
      estadoFacturacionTrasEdicionFiscal({
        solicitar: true,
        pedidoEstado: 'pagado',
        estadoActual: 'pendiente_pago',
      })
    ).toBe('pendiente_envio');
  });

  it('conserva emitida/anulada al reeditar datos fiscales', () => {
    expect(
      estadoFacturacionTrasEdicionFiscal({
        solicitar: true,
        pedidoEstado: 'pagado',
        estadoActual: 'emitida',
      })
    ).toBe('emitida');
  });
});
