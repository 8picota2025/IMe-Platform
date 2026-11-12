import { describe, expect, it } from 'vitest';
import { bancoLineasCotizacion } from './transferencia-bancaria';
import {
  aplicarNotaImportesUsd,
  CUENTA_RECAUDO_DEFAULT,
  cuentaRecaudoPorId,
  lineasMedioPagoCotizacion,
  lineasPagoCuenta,
  normalizarCondicionPago,
  normalizarCuentaRecaudo,
  NOTA_IMPORTES_USD_ES,
  resolverCuentaRecaudo,
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

  it('si cuenta_recaudo es null, COP usa Bancolombia y USD usa Davivienda', () => {
    const historicas = bancoLineasCotizacion();
    const cop = resolverCuentaRecaudo(null, 'COP');
    const usd = resolverCuentaRecaudo(null, 'USD');
    expect(cop.historica).toBe(true);
    expect(cop.cuenta.id).toBe('bancolombia_ahorros');
    expect(cop.cuenta.numero_cuenta).toBe('61400006521');
    expect(usd.historica).toBe(false);
    expect(usd.cuenta.id).toBe('davivienda_sa');
    expect(usd.cuenta.banco).toBe('Davivienda S.A.');
    expect(usd.cuenta.numero_cuenta).toBe('0550108900697583');
    expect(usd.cuenta.swift).toBe('CAFECOBBXXX');
    expect(cuentaRecaudoPorId(null, 'USD').id).toBe('davivienda_sa');
    expect(cuentaRecaudoPorId(null, 'COP').id).toBe(CUENTA_RECAUDO_DEFAULT);
    expect(lineasMedioPagoCotizacion(null, historicas, 'COP')).toEqual(historicas);
    expect(lineasMedioPagoCotizacion(null, historicas, 'USD')).toEqual(
      lineasPagoCuenta(cuentaRecaudoPorId('davivienda_sa'))
    );
    expect(lineasMedioPagoCotizacion(undefined, historicas)).toEqual(historicas);
  });

  it('una cuenta_recaudo explícita gana a la moneda', () => {
    const historicas = bancoLineasCotizacion();
    expect(resolverCuentaRecaudo('davivienda_sa', 'COP').cuenta.id).toBe('davivienda_sa');
    expect(resolverCuentaRecaudo('bancolombia_ahorros', 'USD').cuenta.id).toBe(
      'bancolombia_ahorros'
    );
    expect(resolverCuentaRecaudo('bancolombia_ahorros', 'USD').historica).toBe(true);
    expect(lineasMedioPagoCotizacion('bancolombia_ahorros', historicas, 'USD')).toEqual(historicas);
    expect(lineasMedioPagoCotizacion('davivienda_sa', historicas, 'COP')).toEqual(
      lineasPagoCuenta(cuentaRecaudoPorId('davivienda_sa'))
    );
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
  });

  it('añade la nota USD y la retira al volver a COP', () => {
    const base = 'Entrega:\n30 días.';
    const conNota = aplicarNotaImportesUsd(base, 'USD', 'es');
    expect(conNota).toBe(`${base}\n${NOTA_IMPORTES_USD_ES}`);
    expect(aplicarNotaImportesUsd(conNota, 'USD', 'es')).toBe(conNota);
    expect(aplicarNotaImportesUsd(conNota, 'COP', 'es')).toBe(base);
  });
});
