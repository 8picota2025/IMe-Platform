import { describe, expect, it } from 'vitest';
import { ventanaPaginacion } from './paginacion';

describe('ventanaPaginacion', () => {
  it('no devuelve nada si hay una sola página', () => {
    expect(ventanaPaginacion(1, 1)).toEqual([]);
    expect(ventanaPaginacion(1, 0)).toEqual([]);
  });

  it('muestra todas las páginas cuando son pocas', () => {
    expect(ventanaPaginacion(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('en la página 1 de 14 enlaza la última y marca el hueco', () => {
    expect(ventanaPaginacion(1, 14)).toEqual([1, 2, 3, 'gap', 14]);
  });

  it('en el medio muestra primera, vecinas y última con huecos a ambos lados', () => {
    expect(ventanaPaginacion(8, 14)).toEqual([1, 'gap', 6, 7, 8, 9, 10, 'gap', 14]);
  });

  it('en la última página enlaza la primera', () => {
    expect(ventanaPaginacion(14, 14)).toEqual([1, 'gap', 12, 13, 14]);
  });

  it('rellena huecos de una sola página en lugar de usar puntos suspensivos', () => {
    expect(ventanaPaginacion(5, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('acota páginas fuera de rango', () => {
    expect(ventanaPaginacion(99, 14)).toEqual([1, 'gap', 12, 13, 14]);
    expect(ventanaPaginacion(-3, 14)).toEqual([1, 2, 3, 'gap', 14]);
  });

  it('toda página enlaza la primera y la última', () => {
    for (let actual = 1; actual <= 14; actual += 1) {
      const enlaces = ventanaPaginacion(actual, 14);
      expect(enlaces).toContain(1);
      expect(enlaces).toContain(14);
    }
  });
});
