import { describe, expect, it } from 'vitest';
import { getProductoBySlug, mapProductoSupabase } from './datos';
import type { Locale } from '../i18n/utils';

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

describe('mapProductoSupabase — marca fallback desde atributos', () => {
  it('usa top-level marca si está disponible', () => {
    const rawRow = {
      id: 'test-1',
      slug: 'test-product',
      familia_id: 'fam-test',
      tipo_id: null,
      nombre_es: 'Test Product ES',
      nombre_en: 'Test Product EN',
      descripcion_corta_es: 'Descripción corta ES',
      descripcion_corta_en: 'Descripción corta EN',
      descripcion_larga_es: '',
      descripcion_larga_en: '',
      especificaciones: [],
      aplicaciones_es: [],
      aplicaciones_en: [],
      atributos: {
        beneficios_es: [],
        beneficios_en: [],
        valor_es: null,
        valor_en: null,
        marca: 'Nested Brand',
      },
      imagen_principal: null,
      galeria: [],
      ficha_pdf: null,
      tipo_comercial: 'equipo',
      fulfillment_mode: 'cotizacion',
      precio: null,
      moneda: 'COP',
      stock: null,
      disponible: true,
      destacado: false,
      nuevo: false,
      activo: true,
      orden: 1,
      marca: 'Top Level Brand',
    };

    const producto = mapProductoSupabase(rawRow, 'es' as Locale);
    expect(producto.marca).toBe('Top Level Brand');
  });

  it('cae de vuelta a marca en atributos cuando no hay top-level marca', () => {
    const rawRow = {
      id: 'test-2',
      slug: 'test-product-2',
      familia_id: 'fam-test',
      tipo_id: null,
      nombre_es: 'Test Product 2 ES',
      nombre_en: 'Test Product 2 EN',
      descripcion_corta_es: 'Descripción corta ES',
      descripcion_corta_en: 'Descripción corta EN',
      descripcion_larga_es: '',
      descripcion_larga_en: '',
      especificaciones: [],
      aplicaciones_es: [],
      aplicaciones_en: [],
      atributos: {
        beneficios_es: [],
        beneficios_en: [],
        valor_es: null,
        valor_en: null,
        marca: 'Atributos Brand',
      },
      imagen_principal: null,
      galeria: [],
      ficha_pdf: null,
      tipo_comercial: 'equipo',
      fulfillment_mode: 'cotizacion',
      precio: null,
      moneda: 'COP',
      stock: null,
      disponible: true,
      destacado: false,
      nuevo: false,
      activo: true,
      orden: 1,
    };

    const producto = mapProductoSupabase(rawRow, 'es' as Locale);
    expect(producto.marca).toBe('Atributos Brand');
  });

  it('devuelve null si marca no está en ningún lado', () => {
    const rawRow = {
      id: 'test-3',
      slug: 'test-product-3',
      familia_id: 'fam-test',
      tipo_id: null,
      nombre_es: 'Test Product 3 ES',
      nombre_en: 'Test Product 3 EN',
      descripcion_corta_es: 'Descripción corta ES',
      descripcion_corta_en: 'Descripción corta EN',
      descripcion_larga_es: '',
      descripcion_larga_en: '',
      especificaciones: [],
      aplicaciones_es: [],
      aplicaciones_en: [],
      atributos: {
        beneficios_es: [],
        beneficios_en: [],
        valor_es: null,
        valor_en: null,
      },
      imagen_principal: null,
      galeria: [],
      ficha_pdf: null,
      tipo_comercial: 'equipo',
      fulfillment_mode: 'cotizacion',
      precio: null,
      moneda: 'COP',
      stock: null,
      disponible: true,
      destacado: false,
      nuevo: false,
      activo: true,
      orden: 1,
    };

    const producto = mapProductoSupabase(rawRow, 'es' as Locale);
    expect(producto.marca).toBeNull();
  });
});
