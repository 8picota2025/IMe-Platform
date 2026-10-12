import { describe, expect, it } from 'vitest';
import { getProductos, getProductosBySlugs } from './datos';
import { esProductoDePrueba } from './productos-prueba';

describe('esProductoDePrueba', () => {
  it('reconoce los slugs de prueba y de muestra', () => {
    expect(esProductoDePrueba('test')).toBe(true);
    expect(esProductoDePrueba('test-de-pasarela-de-pagos')).toBe(true);
    expect(esProductoDePrueba('ejemplo-producto')).toBe(true);
  });

  it('no marca productos reales ni valores no string', () => {
    expect(esProductoDePrueba('monitor-de-paciente-ref-sk-em005-saikang')).toBe(false);
    expect(esProductoDePrueba('testigo-de-esterilizacion')).toBe(false);
    expect(esProductoDePrueba(undefined)).toBe(false);
    expect(esProductoDePrueba(null)).toBe(false);
  });
});

describe('catálogo público sin productos de prueba', () => {
  it('getProductos no devuelve ningún producto de prueba', async () => {
    const lista = await getProductos({ pageSize: 5000 }, 'es');
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.filter(p => esProductoDePrueba(p.slug))).toEqual([]);
  });

  it('getProductosBySlugs ignora los slugs de prueba', async () => {
    const lista = await getProductosBySlugs(['test', 'ejemplo-producto'], 'es');
    expect(lista).toEqual([]);
  });
});
