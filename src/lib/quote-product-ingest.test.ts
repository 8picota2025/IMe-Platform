import { describe, expect, it } from 'vitest';
import {
  buildProductImportRow,
  parseIngestDraftResponse,
  slugifyProductName,
} from './quote-product-ingest';

describe('quote-product-ingest', () => {
  it('parseIngestDraftResponse extrae nombre desde producto_es', () => {
    const draft = parseIngestDraftResponse(
      {
        producto_es: {
          nombre: { valor: 'Ventilador Monnal T75', origen: 'pdf', confianza: 0.9 },
          descripcion_corta: { valor: 'Ventilador crítico adulto-pediátrico' },
        },
      },
      'https://example.com/ficha.pdf'
    );
    expect(draft?.nombre_es).toBe('Ventilador Monnal T75');
    expect(draft?.slug).toBe('ventilador-monnal-t75');
    expect(draft?.ficha_pdf).toBe('https://example.com/ficha.pdf');
  });

  it('buildProductImportRow crea borrador no publicado', () => {
    const row = buildProductImportRow(
      {
        nombre_es: 'Monitor X',
        nombre_en: 'Monitor X',
        slug: 'monitor-x',
        descripcion_corta_es: '',
        descripcion_larga_es: '',
        especificaciones: [],
        aplicaciones_es: [],
        beneficios_es: [],
        valor_es: '',
        marca: 'Acme',
        ficha_pdf: '',
      },
      { precio: 1200000 }
    );
    expect(row.activo).toBe(false);
    expect(row.precio).toBe(1200000);
    expect(row.slug).toBe('monitor-x');
  });

  it('slugifyProductName normaliza acentos', () => {
    expect(slugifyProductName('Ecógrafo Portátil')).toBe('ecografo-portatil');
  });
});
