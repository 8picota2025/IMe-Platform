import { describe, expect, it } from 'vitest';
import { getProductoBySlug, resolveMarcaSupabase } from './datos';

describe('mapProducto — campos enriquecidos de landing', () => {
  it('resuelve aplicaciones, beneficios y valor en español', async () => {
    const producto = await getProductoBySlug('ten-20-pasta-conductiva-8onz-ref-si1067-natus', 'es');
    expect(producto).not.toBeNull();
    expect(producto!.aplicaciones).toContain('Estudios de electroencefalografía (EEG)');
    expect(producto!.beneficios.length).toBeGreaterThan(0);
    expect(producto!.valor).toContain('neuromonitoreo');
    expect(producto!.marca).toBe('Natus');
  });

  it('resuelve aplicaciones, beneficios y valor en inglés', async () => {
    const producto = await getProductoBySlug('ten-20-pasta-conductiva-8onz-ref-si1067-natus', 'en');
    expect(producto).not.toBeNull();
    expect(producto!.aplicaciones).toContain('Electroencephalography (EEG) studies');
    expect(producto!.valor).toContain('neuromonitoring');
  });

  it('resuelve siempre arreglos (nunca undefined) y valor string-o-null, incluso sin contenido enriquecido', async () => {
    // No se fija en un slug específico "vacío": con el catálogo real
    // sincronizado desde Supabase, casi todos los productos activos ya
    // tienen aplicaciones/beneficios reales, así que un caso negativo por
    // slug concreto sería frágil ante cambios de datos. En su lugar se
    // verifica el invariante de forma (arrays nunca undefined, valor
    // siempre string o null) sobre cualquier producto activo real.
    const producto = await getProductoBySlug('ten-20-pasta-conductiva-8onz-ref-si1067-natus', 'es');
    expect(producto).not.toBeNull();
    expect(Array.isArray(producto!.aplicaciones)).toBe(true);
    expect(Array.isArray(producto!.beneficios)).toBe(true);
    expect(producto!.valor === null || typeof producto!.valor === 'string').toBe(true);
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

  it('cae de vuelta a atributos.fabricante si no hay marca', () => {
    const result = resolveMarcaSupabase({
      atributos: { fabricante: 'Angell Technology' },
    });
    expect(result).toBe('Angell Technology');
  });
});
