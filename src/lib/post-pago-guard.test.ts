import { describe, expect, it } from 'vitest';
import { tipoEventoPostPago, yaRegistroPostPago } from './post-pago-guard';

describe('yaRegistroPostPago', () => {
  it('is false when no audit rows exist', () => {
    expect(yaRegistroPostPago(null)).toBe(false);
    expect(yaRegistroPostPago([])).toBe(false);
  });

  it('detects pago_confirmado from card webhooks', () => {
    expect(yaRegistroPostPago([{ tipo: 'pago_confirmado' }])).toBe(true);
  });

  it('detects transferencia_validada from bank transfers', () => {
    expect(yaRegistroPostPago([{ tipo: 'transferencia_validada' }])).toBe(true);
  });

  it('ignores unrelated pedido_eventos rows', () => {
    expect(yaRegistroPostPago([{ tipo: 'nota_interna' }, { tipo: 'estado_cambio' }])).toBe(false);
  });
});

describe('tipoEventoPostPago', () => {
  it('uses transferencia_validada only for bank transfers', () => {
    expect(tipoEventoPostPago('transferencia')).toBe('transferencia_validada');
    expect(tipoEventoPostPago('wompi')).toBe('pago_confirmado');
    expect(tipoEventoPostPago('stripe')).toBe('pago_confirmado');
  });
});
