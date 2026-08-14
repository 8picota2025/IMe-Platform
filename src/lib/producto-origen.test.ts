import { describe, expect, it } from 'vitest';
import { formatFabricanteDistribuidor, resolveDistribuidor, resolveMarca } from './producto-origen';

describe('producto origen', () => {
  it('usa marca top-level, luego atributos.marca, luego fabricante', () => {
    expect(resolveMarca({ marca: 'Natus', atributos: { marca: 'X', fabricante: 'Y' } })).toBe(
      'Natus'
    );
    expect(resolveMarca({ atributos: { marca: 'Welch Allyn' } })).toBe('Welch Allyn');
    expect(resolveMarca({ atributos: { fabricante: 'Angell Technology' } })).toBe(
      'Angell Technology'
    );
    expect(resolveMarca({ atributos: {} })).toBeNull();
  });

  it('resuelve distribuidor sin leer costo', () => {
    expect(resolveDistribuidor({ atributos: { distribuidor: 'I-ME Bogotá' } })).toBe('I-ME Bogotá');
    expect(resolveDistribuidor({ fulfillment_mode: 'dropship' })).toBe('Dropship');
    expect(resolveDistribuidor({ fulfillment_mode: 'cotizacion' })).toBe('I-ME');
  });

  it('formatea columna fabricante / distribuidor', () => {
    expect(
      formatFabricanteDistribuidor({
        atributos: { marca: 'Tuttnauer' },
        fulfillment_mode: 'cotizacion',
      })
    ).toBe('Tuttnauer · I-ME');
    expect(formatFabricanteDistribuidor({ atributos: {} })).toBe('—');
  });
});
