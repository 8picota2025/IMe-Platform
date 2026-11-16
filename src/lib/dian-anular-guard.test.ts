import { describe, expect, it } from 'vitest';

import { evaluateAnularClaim, evaluateLostAnularClaim } from './dian-anular-guard';

describe('evaluateAnularClaim', () => {
  it('permite dry_run sobre factura emitida sin reclamar', () => {
    expect(evaluateAnularClaim({ dryRun: true, facturaEstado: 'emitida' })).toEqual({
      ok: true,
      action: 'dry_run',
    });
  });

  it('bloquea dry_run si ya esta anulada', () => {
    const result = evaluateAnularClaim({ dryRun: true, facturaEstado: 'anulada' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('YA_ANULADA');
  });

  it('reclama solo facturas emitidas en vivo', () => {
    expect(evaluateAnularClaim({ dryRun: false, facturaEstado: 'emitida' })).toEqual({
      ok: true,
      action: 'claim',
    });
  });

  it('rechaza segunda anulacion cuando ya esta anulada', () => {
    const result = evaluateAnularClaim({ dryRun: false, facturaEstado: 'anulada' });
    expect(result).toMatchObject({ ok: false, code: 'YA_ANULADA', status: 409 });
  });

  it('rechaza carrera cuando otra peticion ya reclamo anulando', () => {
    const result = evaluateAnularClaim({ dryRun: false, facturaEstado: 'anulando' });
    expect(result).toMatchObject({ ok: false, code: 'ANULACION_EN_CURSO', status: 409 });
  });

  it('bloquea anular facturas no emitidas (evita NC fantasma)', () => {
    for (const estado of ['pendiente_pago', 'pendiente_envio', 'error', 'rechazada', '']) {
      const result = evaluateAnularClaim({ dryRun: false, facturaEstado: estado });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('FACTURA_NO_EMITIDA');
        expect(result.status).toBe(422);
      }
    }
  });
});

describe('evaluateLostAnularClaim', () => {
  it('traduce fila anulada tras perder el CAS', () => {
    expect(evaluateLostAnularClaim('anulada').code).toBe('YA_ANULADA');
  });

  it('traduce fila anulando tras perder el CAS', () => {
    expect(evaluateLostAnularClaim('anulando').code).toBe('ANULACION_EN_CURSO');
  });
});
