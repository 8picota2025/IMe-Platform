/**
 * PDF imprimible del checklist de recepción e instalación de monitores (Fase 3, D1).
 * Se genera en el navegador tras registrar el lead; no incluye datos personales.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  CHECKLIST_SECCIONES,
  CHECKLIST_VALIDACION,
  type ChecklistSeccion,
} from '../data/checklist-recepcion-monitor';

export interface ChecklistPdfInput {
  locale: 'es' | 'en';
  /** Ids de los puntos marcados en la herramienta; vacío = checklist en blanco. */
  marcados: ReadonlySet<string>;
  /** Fecha de generación ya formateada para el pie. */
  fecha: string;
  /** URL pública de la herramienta, para el pie. */
  url: string;
  secciones?: ChecklistSeccion[];
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOX = 9;
const ITEM_INDENT = BOX + 8;

const INK = rgb(0.07, 0.11, 0.13);
const MUTED = rgb(0.33, 0.4, 0.44);
const TEAL = rgb(15 / 255, 76 / 255, 92 / 255);

const TEXTOS = {
  es: {
    titulo: 'Checklist de recepción e instalación de un monitor hospitalario',
    campos: [
      'Institución y servicio',
      'Equipo (marca, modelo, n.º de serie)',
      'Fecha de recepción',
    ],
    progreso: (hechos: number, total: number) =>
      `Puntos marcados en la herramienta: ${hechos} de ${total}`,
    pie: 'I-ME · Checklist de recepción de monitores',
    pagina: (n: number, total: number) => `Página ${n} de ${total}`,
  },
  en: {
    titulo: 'Checklist for receiving and installing a hospital patient monitor',
    campos: ['Institution and unit', 'Equipment (brand, model, serial no.)', 'Receiving date'],
    progreso: (hechos: number, total: number) => `Items checked in the tool: ${hechos} of ${total}`,
    pie: 'I-ME · Monitor receiving checklist',
    pagina: (n: number, total: number) => `Page ${n} of ${total}`,
  },
} as const;

/** Las fuentes estándar sólo codifican WinAnsi: SpO₂ → SpO2, guiones y comillas tipográficas a ASCII. */
export function textoWinAnsi(texto: string): string {
  return texto
    .replace(/\u2082/g, '2')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, '');
}

function partirEnLineas(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (actual && font.widthOfTextAtSize(candidata, size) > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidata;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function generarChecklistPdf(input: ChecklistPdfInput): Promise<Uint8Array> {
  const { locale, marcados } = input;
  const secciones = input.secciones ?? CHECKLIST_SECCIONES;
  const t = TEXTOS[locale];
  const doc = await PDFDocument.create();
  doc.setTitle(t.titulo);
  doc.setAuthor('I-ME');
  doc.setLanguage(locale === 'en' ? 'en' : 'es-CO');

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const asegurarEspacio = (alto: number) => {
    if (y - alto < MARGIN + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const parrafo = (texto: string, font: PDFFont, size: number, color = INK, x = MARGIN) => {
    const lineas = partirEnLineas(textoWinAnsi(texto), font, size, PAGE_W - MARGIN - x);
    const alto = size * 1.35;
    for (const linea of lineas) {
      asegurarEspacio(alto);
      page.drawText(linea, { x, y: y - size, size, font, color });
      y -= alto;
    }
  };

  parrafo(t.titulo, bold, 16, TEAL);
  y -= 4;
  parrafo(CHECKLIST_VALIDACION[locale], italic, 8.5, MUTED);
  y -= 10;

  for (const campo of t.campos) {
    asegurarEspacio(22);
    page.drawText(textoWinAnsi(`${campo}:`), {
      x: MARGIN,
      y: y - 10,
      size: 9,
      font: bold,
      color: INK,
    });
    page.drawLine({
      start: { x: MARGIN + 190, y: y - 11 },
      end: { x: PAGE_W - MARGIN, y: y - 11 },
      thickness: 0.5,
      color: MUTED,
    });
    y -= 22;
  }

  const total = secciones.reduce((n, s) => n + s.items.length, 0);
  const hechos = secciones.reduce(
    (n, s) => n + s.items.filter(item => marcados.has(item.id)).length,
    0
  );
  if (hechos > 0) {
    y -= 2;
    parrafo(t.progreso(hechos, total), regular, 9, MUTED);
  }

  for (const seccion of secciones) {
    y -= 10;
    asegurarEspacio(40);
    parrafo(seccion.titulo[locale], bold, 11.5, TEAL);
    y -= 2;
    for (const item of seccion.items) {
      const size = 9.5;
      const lineas = partirEnLineas(
        textoWinAnsi(item.texto[locale]),
        regular,
        size,
        CONTENT_W - ITEM_INDENT
      );
      const alto = size * 1.35;
      asegurarEspacio(alto * Math.min(lineas.length, 2) + 4);
      const cajaY = y - size - 1;
      page.drawRectangle({
        x: MARGIN,
        y: cajaY,
        width: BOX,
        height: BOX,
        borderColor: INK,
        borderWidth: 0.8,
      });
      if (marcados.has(item.id)) {
        page.drawLine({
          start: { x: MARGIN + 1.8, y: cajaY + BOX / 2 },
          end: { x: MARGIN + BOX / 2.4, y: cajaY + 1.8 },
          thickness: 1.3,
          color: TEAL,
        });
        page.drawLine({
          start: { x: MARGIN + BOX / 2.4, y: cajaY + 1.8 },
          end: { x: MARGIN + BOX - 1.2, y: cajaY + BOX - 1.2 },
          thickness: 1.3,
          color: TEAL,
        });
      }
      for (const linea of lineas) {
        asegurarEspacio(alto);
        page.drawText(linea, {
          x: MARGIN + ITEM_INDENT,
          y: y - size,
          size,
          font: regular,
          color: INK,
        });
        y -= alto;
      }
      y -= 3;
    }
    if (seccion.nota) {
      y -= 1;
      parrafo(seccion.nota[locale], italic, 8.5, MUTED, MARGIN + ITEM_INDENT);
    }
  }

  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    const pie = textoWinAnsi(`${t.pie} · ${input.fecha} · ${input.url}`);
    p.drawText(pie, { x: MARGIN, y: MARGIN - 20, size: 7.5, font: regular, color: MUTED });
    const numero = t.pagina(i + 1, paginas.length);
    p.drawText(numero, {
      x: PAGE_W - MARGIN - regular.widthOfTextAtSize(numero, 7.5),
      y: MARGIN - 20,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}
