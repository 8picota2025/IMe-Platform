import { describe, expect, it } from 'vitest';
import { getProductoBySlug, resolveMarcaSupabase } from './datos';

describe('mapProducto — campos enriquecidos de landing', () => {
  it('resuelve aplicaciones, beneficios y valor en español', async () => {
    const producto = await getProductoBySlug(
      'eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus',
      'es'
    );
    expect(producto).not.toBeNull();
    expect(producto!.aplicaciones).toContain('Estudios de electroencefalografía (EEG)');
    expect(producto!.beneficios.length).toBeGreaterThan(0);
    expect(producto!.valor).toContain('neuromonitoreo');
    expect(producto!.marca).toBe('Natus');
  });

  it('resuelve aplicaciones, beneficios y valor en inglés', async () => {
    const producto = await getProductoBySlug(
      'eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus',
      'en'
    );
    expect(producto).not.toBeNull();
    expect(producto!.aplicaciones).toContain('Electroencephalography (EEG) studies');
    expect(producto!.valor).toContain('neuromonitoring');
  });

  it('devuelve arreglos vacios y null cuando el producto no tiene estos campos', async () => {
    const producto = await getProductoBySlug('monitor-multiparametrico-uci-avanzado', 'es');
    expect(producto).not.toBeNull();
    expect(producto!.aplicaciones).toEqual([]);
    expect(producto!.beneficios).toEqual([]);
    expect(producto!.valor).toBeNull();
  });
});

describe('resolveMarcaSupabase — marca fallback desde atributos', () => {
  it('usa top-level marca si está disponible', () => {
    const result = resolveMarcaSupabase({
      marca: 'Top Level Brand',
      atributos: { marca: 'Nested Brand' },
    });
    expect(result).toBe('Top Level Brand');
  });

  it('cae de vuelta a marca en atributos cuando no hay top-level marca', () => {
    const result = resolveMarcaSupabase({
      atributos: { marca: 'Atributos Brand' },
    });
    expect(result).toBe('Atributos Brand');
  });

  it('devuelve null si marca no está en ningún lado', () => {
    const result = resolveMarcaSupabase({
      atributos: {},
    });
    expect(result).toBeNull();
  });
});
