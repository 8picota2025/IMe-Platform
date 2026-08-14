/**
 * Quote PDF renderer for Edge (Deno). Mirrors src/lib/render-quote-pdf.ts.
 */
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import type { CotizacionLineaOferta } from '../../../src/lib/cotizacion-oferta.ts';

export interface QuotePdfSnapshot {
  numero: string;
  clienteNombre: string;
  empresa?: string | null;
  email?: string | null;
  telefono?: string | null;
  condiciones: string;
  validezHasta?: string | null;
  moneda: string;
  total: number;
  lineas: CotizacionLineaOferta[];
  locale?: 'es' | 'en';
  nombreComercial?: string | null;
  correoComercial?: string | null;
  telefonoComercial?: string | null;
}

export type QuotePdfRenderer = (snapshot: QuotePdfSnapshot) => Promise<Uint8Array>;

const TEAL = rgb(0 / 255, 94 / 255, 96 / 255);
const INK = rgb(0.08, 0.12, 0.12);
const MUTED = rgb(0.35, 0.4, 0.4);
const MAX_BYTES = 8 * 1024 * 1024;

function winAnsi(s: string): string {
  return s.replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, '?');
}

function money(value: number, moneda: string, locale: 'es' | 'en'): string {
  const n = Number.isFinite(value) ? value : 0;
  const digits = moneda === 'COP' ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return `${n} ${moneda}`;
  }
}

function wrapText(text: string, max: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 60);
}

export const renderQuotePdf: QuotePdfRenderer = async snapshot => {
  const locale = snapshot.locale === 'en' ? 'en' : 'es';
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let page = doc.addPage([595.28, 841.89]);
  let y = 800;
  const width = 595.28;

  const ensure = (need = 24) => {
    if (y < 64 + need) {
      page = doc.addPage([595.28, 841.89]);
      y = 800;
    }
  };

  const line = (text: string, size: number, f = font, color = INK) => {
    ensure(size + 8);
    page.drawText(winAnsi(text).slice(0, 110), {
      x: margin,
      y,
      size,
      font: f,
      color,
    });
    y -= size + 8;
  };

  page.drawRectangle({ x: 0, y: 780, width, height: 62, color: TEAL });
  page.drawText(winAnsi('I-ME International Medical Enterprise'), {
    x: margin,
    y: 818,
    size: 10,
    font,
    color: rgb(1, 1, 1),
  });
  page.drawText(winAnsi(locale === 'en' ? 'QUOTATION / BUDGET' : 'PRESUPUESTO'), {
    x: margin,
    y: 798,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });
  y = 760;

  line(snapshot.numero || 'IME-Q-BORRADOR', 12, bold, TEAL);
  y -= 4;
  line(locale === 'en' ? 'Client' : 'Cliente', 10, bold);
  line(snapshot.clienteNombre, 10);
  if (snapshot.empresa) line(`${locale === 'en' ? 'Company' : 'Empresa'}: ${snapshot.empresa}`, 9);
  if (snapshot.email) line(`Email: ${snapshot.email}`, 9);
  if (snapshot.telefono) line(`${locale === 'en' ? 'Phone' : 'Teléfono'}: ${snapshot.telefono}`, 9);
  if (snapshot.validezHasta) {
    line(`${locale === 'en' ? 'Valid until' : 'Válido hasta'}: ${snapshot.validezHasta}`, 9);
  }
  y -= 6;

  const comercial = snapshot.nombreComercial?.trim();
  if (comercial) {
    line(locale === 'en' ? 'Prepared by' : 'Elaborado por', 10, bold);
    line(comercial, 10);
    const contact = [snapshot.correoComercial, snapshot.telefonoComercial]
      .map(v => (v || '').trim())
      .filter(Boolean)
      .join(' · ');
    if (contact) line(contact, 9, font, MUTED);
    y -= 6;
  }

  line(locale === 'en' ? 'Items' : 'Productos', 11, bold);
  for (const item of snapshot.lineas) {
    const qty = item.cantidad;
    const name = item.nombre || item.slug || (locale === 'en' ? 'Item' : 'Producto');
    line(`${qty} x ${name}`, 9);
    line(
      `    ${money(item.precio_unitario, snapshot.moneda, locale)}  ·  ${money(item.subtotal, snapshot.moneda, locale)}`,
      8,
      font,
      MUTED
    );
  }

  y -= 4;
  ensure(20);
  page.drawLine({
    start: { x: margin, y: y + 10 },
    end: { x: width - margin, y: y + 10 },
    thickness: 0.8,
    color: TEAL,
  });
  line(`TOTAL: ${money(snapshot.total, snapshot.moneda, locale)}`, 12, bold, TEAL);
  y -= 6;
  line(locale === 'en' ? 'Terms' : 'Condiciones', 11, bold);
  const terms = snapshot.condiciones.trim() || (locale === 'en' ? 'See email.' : 'Ver correo.');
  for (const chunk of wrapText(terms, 88)) line(chunk, 9);
  y -= 14;
  line('i-me.com.co  ·  ventas@i-me.com.co', 8, font, MUTED);
  if (comercial) line(winAnsi(`Asesor: ${comercial}`), 8, font, MUTED);

  const bytes = await doc.save();
  if (bytes.byteLength > MAX_BYTES) throw new Error('PDF_RENDER_FAILED: PDF exceeds 8MB');
  return bytes;
};
