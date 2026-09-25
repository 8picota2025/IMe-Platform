import { describe, expect, it } from 'vitest';
import { lotesDeRango, PRODUCTO_SELECT } from './datos';

describe('lotesDeRango', () => {
  it('parte una página de 1000 en lotes de 200 sin huecos ni solapes', () => {
    expect(lotesDeRango(0, 999)).toEqual([
      [0, 199],
      [200, 399],
      [400, 599],
      [600, 799],
      [800, 999],
    ]);
  });

  it('una página pequeña es un solo lote', () => {
    expect(lotesDeRango(24, 47)).toEqual([[24, 47]]);
  });

  it('el último lote se recorta al final del rango', () => {
    expect(lotesDeRango(0, 249, 100)).toEqual([
      [0, 99],
      [100, 199],
      [200, 249],
    ]);
  });
});

describe('PRODUCTO_SELECT', () => {
  it('no pide las columnas pesadas', () => {
    const cols = PRODUCTO_SELECT.split(',');
    expect(cols).not.toContain('embedding');
    expect(cols).not.toContain('busqueda_tsv');
    expect(cols).toContain('slug');
  });
});
