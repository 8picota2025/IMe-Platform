import { describe, expect, it, vi } from 'vitest';
import type productosCatalogo from '../data/mock-productos.json';
import { getProductoBySlug, resolveMarcaSupabase } from './datos';

// Estas pruebas verifican el mapper, no la disponibilidad del catálogo real.
vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
}));

vi.mock('../data/mock-productos.json', async importOriginal => {
  const { default: productos } = await importOriginal<{ default: typeof productosCatalogo }>();
  const base = productos.find(p => p.slug === 'ten-20-pasta-conductiva-8onz-ref-si1067-natus');
  if (!base) throw new Error('Falta el producto de referencia del test del mapper');
  return {
    default: [
      { ...base, activo: true },
      {
        ...base,
        slug: 'fixture-sin-enriquecimiento',
        activo: true,
        aplicaciones_es: undefined,
        aplicaciones_en: undefined,
        beneficios_es: undefined,
        beneficios_en: undefined,
        valor_es: undefined,
        valor_en: undefined,
      },
      { ...base, slug: 'fixture-retirada', activo: false },
    ],
  };
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
    for (const locale of ['es', 'en'] as const) {
      const producto = await getProductoBySlug('fixture-sin-enriquecimiento', locale);
      expect(producto).not.toBeNull();
      expect(producto!.aplicaciones).toEqual([]);
      expect(producto!.beneficios).toEqual([]);
      expect(producto!.valor).toBeNull();
    }
  });

  it('no devuelve productos retirados del catálogo en ningún idioma', async () => {
    for (const locale of ['es', 'en'] as const) {
      expect(await getProductoBySlug('fixture-retirada', locale)).toBeNull();
    }
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
