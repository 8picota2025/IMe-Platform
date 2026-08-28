import { describe, expect, it } from 'vitest';
import {
  deriveEnrichedFields,
  inferFamiliaSugerida,
  inferTipoSugerido,
  productPdfPublicPath,
  revisableStringsFromDraft,
} from './pdf-ingest-enrich';

describe('pdf-ingest-enrich', () => {
  it('infiere familia ventiladores para Monnal T75', () => {
    expect(inferFamiliaSugerida('Ventilador Monnal T75 cuidados intensivos')).toBe('Ventiladores');
    expect(inferTipoSugerido('Monnal T75 ventilador')).toBe('Ventiladores');
  });

  it('genera beneficios y SEO desde especificaciones', () => {
    const result = deriveEnrichedFields({
      nombre: 'Ventilador Monnal T75',
      descripcionCorta: 'Ventilador para UCI adulto y pediátrico',
      descripcionLarga: 'Ventilación invasiva y no invasiva',
      especificaciones: [
        { clave: 'Pantalla', valor: 'TFT-LCD 10,4 pulgadas táctil' },
        { clave: 'Modos de ventilación invasiva', valor: 'VCV, PCV, PSV' },
      ],
      aplicaciones: ['Ventilación invasiva', 'Cuidados intensivos adultos'],
    });
    expect(result.beneficios_es.length).toBeGreaterThan(0);
    expect(result.seo_keywords_es.length).toBeGreaterThan(0);
    expect(result.marca).toBe('');
  });

  it('parsea arrays revisables del borrador LLM', () => {
    expect(
      revisableStringsFromDraft([
        { valor: 'Beneficio A', origen: 'pdf' },
        { valor: 'Beneficio B', origen: 'inferido' },
      ])
    ).toEqual(['Beneficio A', 'Beneficio B']);
  });

  it('construye ruta publica de ficha PDF', () => {
    expect(productPdfPublicPath('monnal-t75')).toBe(
      '/assets/productos/importados/monnal-t75/ficha-monnal-t75.pdf'
    );
  });
});
