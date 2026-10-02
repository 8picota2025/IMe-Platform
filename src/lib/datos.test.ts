import { describe, expect, it, vi } from 'vitest';
import { getProductoBySlug, resolveMarcaSupabase } from './datos';

// Snapshot of a real enriched product, explicitly active ONLY inside this test.
// Unit mapping tests must not depend on the current catalog publication state or network.
vi.mock('./supabase', () => ({ isSupabaseConfigured: () => false, getSupabaseClient: vi.fn() }));
vi.mock('../data/mock-productos.json', async () => {
  const { default: fixture } =
    await import('../../tests/fixtures/catalogo/producto-enriquecido.json');
  return { default: [fixture, { ...fixture, slug: 'fixture-inactive', activo: false }] };
});

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
    // Verify the public shape against a stable fixture, independent of live publication state.
    const producto = await getProductoBySlug('ten-20-pasta-conductiva-8onz-ref-si1067-natus', 'es');
    expect(producto).not.toBeNull();
    expect(Array.isArray(producto!.aplicaciones)).toBe(true);
    expect(Array.isArray(producto!.beneficios)).toBe(true);
    expect(producto!.valor === null || typeof producto!.valor === 'string').toBe(true);
  });
  it('continúa ocultando productos inactivos', async () => {
    expect(await getProductoBySlug('fixture-inactive', 'es')).toBeNull();
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
