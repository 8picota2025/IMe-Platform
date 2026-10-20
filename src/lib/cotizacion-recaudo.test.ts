import { describe, expect, it } from 'vitest';
import { bancoLineasCotizacion } from './transferencia-bancaria';
import {
  aplicarNotaImportesUsd,
  CUENTA_RECAUDO_DEFAULT,
  cuentaRecaudoPorId,
  lineasMedioPagoCotizacion,
  lineasPagoCuenta,
  CONDICION_PAGO_DEFAULT_NUEVA,
  normalizarCondicionPago,
  normalizarCuentaRecaudo,
  NOTA_IMPORTES_USD_ES,
  resumenCuentaRecaudo,
} from './cotizacion-recaudo';

describe('cuentas de recaudo', () => {
  it('mantiene las líneas históricas de Bancolombia Ahorros COP', () => {
    const historicas = bancoLineasCotizacion();
    expect(lineasPagoCuenta(cuentaRecaudoPorId(null))).toEqual(historicas);
    expect(lineasPagoCuenta(cuentaRecaudoPorId(CUENTA_RECAUDO_DEFAULT))).toEqual(historicas);
    expect(lineasMedioPagoCotizacion(null, historicas)).toEqual(historicas);
    expect(lineasMedioPagoCotizacion(CUENTA_RECAUDO_DEFAULT, historicas)).toEqual(historicas);
    expect(historicas.join('\n')).not.toMatch(/SWIFT|Davivienda|0550108900697583/);
  });

  it('imprime Davivienda, la cuenta y el SWIFT cuando se elige esa cuenta', () => {
    const lineas = lineasMedioPagoCotizacion('davivienda_sa', bancoLineasCotizacion());
    expect(lineas).toEqual([
      'Transferencia bancaria:',
      '0550108900697583',
      'Davivienda S.A.',
      'SWIFT: CAFECOBBXXX',
      'International Medical Enterprise IME S.A.S.',
    ]);
    expect(resumenCuentaRecaudo(cuentaRecaudoPorId('davivienda_sa'))).toContain('CAFECOBBXXX');
    expect(normalizarCuentaRecaudo('davivienda_sa')).toBe('davivienda_sa');
    expect(normalizarCuentaRecaudo('otro')).toBeNull();
  });
});

describe('condición de pago y nota USD', () => {
  it('normaliza la condición y deja vacío como null', () => {
    expect(normalizarCondicionPago('  35% / 35% / 30%  ')).toBe('35% / 35% / 30%');
    expect(normalizarCondicionPago('   ')).toBeNull();
    expect(normalizarCondicionPago(CONDICION_PAGO_DEFAULT_NUEVA)).toBe(CONDICION_PAGO_DEFAULT_NUEVA);
  });

  it('añade la nota USD y la retira al volver a COP', () => {
    const base = 'Entrega:\n30 días.';
    const conNota = aplicarNotaImportesUsd(base, 'USD', 'es');
    expect(conNota).toBe(`${base}\n${NOTA_IMPORTES_USD_ES}`);
    expect(aplicarNotaImportesUsd(conNota, 'USD', 'es')).toBe(conNota);
    expect(aplicarNotaImportesUsd(conNota, 'COP', 'es')).toBe(base);
  });
});
