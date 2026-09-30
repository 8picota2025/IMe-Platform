import { describe, expect, it } from 'vitest';
import { lineasDeResumen, resumenEspecificaciones } from './quote-specs-summary';

describe('resumenEspecificaciones', () => {
  it('toma hasta 5 líneas «Clave: valor» en orden', () => {
    const specs = Array.from({ length: 8 }, (_, i) => ({ clave: `C${i}`, valor: `V${i}` }));
    expect(resumenEspecificaciones(specs).split('\n')).toEqual([
      'C0: V0',
      'C1: V1',
      'C2: V2',
      'C3: V3',
      'C4: V4',
    ]);
  });

  it('completa con aplicaciones si faltan especificaciones', () => {
    expect(resumenEspecificaciones([{ clave: 'Peso', valor: '2 kg' }], ['UCI', 'Urgencias'])).toBe(
      'Peso: 2 kg\nUCI\nUrgencias'
    );
  });

  it('ignora filas vacías o inválidas y acepta solo valor', () => {
    expect(
      resumenEspecificaciones([null, { clave: 'X', valor: '' }, { valor: ' Portátil ' }])
    ).toBe('Portátil');
  });

  it('devuelve vacío sin datos', () => {
    expect(resumenEspecificaciones(undefined, undefined)).toBe('');
  });
});

describe('lineasDeResumen', () => {
  it('limpia espacios y descarta líneas vacías', () => {
    expect(lineasDeResumen('  A:  1 \n\n B: 2 ')).toEqual(['A: 1', 'B: 2']);
  });

  it('tolera valores no texto', () => {
    expect(lineasDeResumen(undefined)).toEqual([]);
    expect(lineasDeResumen(42)).toEqual([]);
  });
});
