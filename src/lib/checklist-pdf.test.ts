import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_ARTICULO_SLUG,
  CHECKLIST_SECCIONES,
  totalItemsChecklist,
} from '../data/checklist-recepcion-monitor';
import { generarChecklistPdf, textoWinAnsi } from './checklist-pdf';

const MIGRACION = readFileSync(
  new URL(
    '../../supabase/migrations/20260925120000_publicar_articulos_monitoreo.sql',
    import.meta.url
  ),
  'utf8'
);

/** Texto del artículo publicado sin marcas de markdown, para comparar con la fuente. */
function textoArticulo(): string {
  const inicio = MIGRACION.indexOf(`$ime_art$${CHECKLIST_ARTICULO_SLUG}$ime_art$`);
  expect(inicio).toBeGreaterThan(-1);
  const fin = MIGRACION.indexOf(`$ime_art$monitoreo-uci$ime_art$`, inicio);
  return MIGRACION.slice(inicio, fin)
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

describe('checklist de recepción de monitores: fuente de datos', () => {
  it('ids únicos y textos en ES y EN', () => {
    const ids = CHECKLIST_SECCIONES.flatMap(s => s.items.map(i => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(totalItemsChecklist());
    for (const seccion of CHECKLIST_SECCIONES) {
      expect(seccion.titulo.es.trim()).not.toBe('');
      expect(seccion.titulo.en.trim()).not.toBe('');
      for (const item of seccion.items) {
        expect(item.texto.es.trim()).not.toBe('');
        expect(item.texto.en.trim()).not.toBe('');
      }
    }
  });

  it('cada punto aparece tal cual en el artículo validado (ES y EN)', () => {
    const articulo = textoArticulo();
    for (const item of CHECKLIST_SECCIONES.flatMap(s => s.items)) {
      // Los puntos que remiten a otra guía se cortan antes del paréntesis del enlace.
      const es = item.texto.es.replace(/\.$/, '');
      const en = item.texto.en.replace(/\.$/, '');
      expect(articulo, item.id).toContain(es);
      expect(articulo, item.id).toContain(en);
    }
  });
});

describe('generarChecklistPdf', () => {
  it('genera un PDF válido en blanco y con avance', async () => {
    for (const locale of ['es', 'en'] as const) {
      const vacio = await generarChecklistPdf({
        locale,
        marcados: new Set(),
        fecha: '25/09/2026',
        url: 'https://i-me.com.co/es/recursos/checklist-recepcion-monitor/',
      });
      const conAvance = await generarChecklistPdf({
        locale,
        marcados: new Set(['preparacion-toma', 'acta-firmas']),
        fecha: '25/09/2026',
        url: 'https://i-me.com.co/es/recursos/checklist-recepcion-monitor/',
      });
      for (const bytes of [vacio, conAvance]) {
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
        expect(doc.getPageCount()).toBeLessThanOrEqual(4);
      }
    }
  });

  it('pasa a WinAnsi los caracteres que Helvetica no codifica', () => {
    expect(textoWinAnsi('SpO₂ y EtCO₂ — ok')).toBe('SpO2 y EtCO2 - ok');
    expect(textoWinAnsi('Configuración, n.º de serie')).toBe('Configuración, n.º de serie');
  });
});
