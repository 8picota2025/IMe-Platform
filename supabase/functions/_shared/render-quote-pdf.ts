/**
 * Edge mirror of src/lib/render-quote-pdf.ts — keep in sync.
 */
/**
 * PDF Presupuesto I-ME — layout calibrado al boceto IPS.pdf
 * (posiciones, tamaños, tabla con rejilla, totales, notas, footer,
 *  anexo con foto + características + descripción).
 */
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit';
import type { CotizacionLineaOferta } from '../../../src/lib/cotizacion-oferta.ts';
import { displayQuoteNumero } from '../../../src/lib/cotizacion-oferta.ts';
import {
  isCondicionesSectionHeading,
  resolveCondicionesOferta,
} from '../../../src/lib/condiciones-oferta.ts';

export interface QuotePdfAnnex {
  slug: string;
  nombre: string;
  sku?: string | null;
  /** Resumen corto (landing). */
  resumen: string;
  /** Descripción larga (landing). */
  descripcion?: string;
  /** Lista de características / especificaciones. */
  caracteristicas?: string[];
  url?: string | null;
  imageBytes?: Uint8Array | null;
}

export interface QuotePdfSnapshot {
  numero: string;
  clienteNombre: string;
  empresa?: string | null;
  email?: string | null;
  telefono?: string | null;
  nitCliente?: string | null;
  condiciones: string;
  validezHasta?: string | null;
  moneda: string;
  total: number;
  lineas: CotizacionLineaOferta[];
  locale?: 'es' | 'en';
  nombreComercial?: string | null;
  correoComercial?: string | null;
  telefonoComercial?: string | null;
  condicionPago?: string | null;
  medioPago?: string | null;
  bancoLineas?: string[];
  ivaPct?: number | null;
  tagline?: string | null;
  annexes?: QuotePdfAnnex[];
  logoBytes?: Uint8Array | null;
  /** Icono WhatsApp blanco (PNG) para el pie. */
  whatsappIconBytes?: Uint8Array | null;
  fontRegularBytes?: Uint8Array | null;
  fontBoldBytes?: Uint8Array | null;
  fecha?: string | null;
}

/** Página A4 del boceto IPS. */
const PAGE_W = 595.5;
const PAGE_H = 842.25;
const MAX_BYTES = 8 * 1024 * 1024;

/** Azules del boceto IPS (header/footer bars). */
const BLUE = rgb(4 / 255, 109 / 255, 184 / 255);
const GRAY_TITLE = rgb(0.45, 0.45, 0.45);
const INK = rgb(0.12, 0.12, 0.12);
const MUTED = rgb(0.35, 0.35, 0.35);
const LINE = rgb(0.15, 0.15, 0.15);
const WHITE = rgb(1, 1, 1);

/** Convierte Y del boceto (origen arriba) → pdf-lib (origen abajo). */
function topY(yFromTop: number): number {
  return PAGE_H - yFromTop;
}

function winAnsi(s: string): string {
  return s
    .replace(/[\u2013\u2014\u2212\u2010\u2011]/g, '-') // en/em/minus dashes → -
    .replace(/[\u00D7\u2715\u2716]/g, 'x') // × → x
    .replace(/[\u2022\u2023\u25CF\u25E6\u2219]/g, '#') // bullets → # (no · U+00B7)
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2070/g, '0')
    .replace(/\u00B9/g, '1')
    .replace(/\u00B2/g, '2')
    .replace(/\u00B3/g, '3')
    .replace(/\u2074/g, '4')
    .replace(/\u2075/g, '5')
    .replace(/\u2076/g, '6')
    .replace(/\u2077/g, '7')
    .replace(/\u2078/g, '8')
    .replace(/\u2079/g, '9')
    .replace(/\u207B/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, '?');
}

function moneyPlain(value: number, moneda: string, locale: 'es' | 'en'): string {
  const n = Number.isFinite(value) ? value : 0;
  const digits = moneda === 'COP' ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n);
  } catch {
    return String(n);
  }
}

function moneyCash(value: number, moneda: string, locale: 'es' | 'en'): string {
  return `$${moneyPlain(value, moneda, locale)}`;
}

/** Wrap using real glyph widths (fixes overflow with Poppins). */
function wrapByWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = '';
  const width = (s: string) => font.widthOfTextAtSize(winAnsi(s), size);
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (width(next) <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    if (width(w) <= maxWidth) {
      cur = w;
      continue;
    }
    let chunk = '';
    for (const ch of w) {
      const trial = chunk + ch;
      if (width(trial) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else chunk = trial;
    }
    cur = chunk;
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitOneLine(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const s = winAnsi(text);
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  const ell = '…';
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const cand = s.slice(0, mid) + ell;
    if (font.widthOfTextAtSize(cand, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${s.slice(0, lo)}${ell}` : ell;
}

/** Dibuja párrafo justificado (última línea a la izquierda). Devuelve siguiente `top`. */
function drawJustifiedParagraph(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    top: number;
    size: number;
    font: PDFFont;
    maxWidth: number;
    lineHeight?: number;
    color?: ReturnType<typeof rgb>;
    maxLines?: number;
  }
): number {
  const lineHeight = opts.lineHeight ?? opts.size + 4;
  const color = opts.color ?? INK;
  const lines = wrapByWidth(text, opts.font, opts.size, opts.maxWidth);
  const limited = opts.maxLines != null ? lines.slice(0, opts.maxLines) : lines;
  let top = opts.top;
  limited.forEach((line, idx) => {
    const words = line.split(' ').filter(Boolean);
    const isLast = idx === limited.length - 1;
    const y = topY(top + opts.size * 0.78);
    if (words.length <= 1 || isLast) {
      page.drawText(winAnsi(line), {
        x: opts.x,
        y,
        size: opts.size,
        font: opts.font,
        color,
      });
    } else {
      const wordWidths = words.map(w => opts.font.widthOfTextAtSize(winAnsi(w), opts.size));
      const wordsW = wordWidths.reduce((a, b) => a + b, 0);
      const gap = (opts.maxWidth - wordsW) / (words.length - 1);
      let cx = opts.x;
      words.forEach((w, i) => {
        page.drawText(winAnsi(w), {
          x: cx,
          y,
          size: opts.size,
          font: opts.font,
          color,
        });
        cx += wordWidths[i]! + gap;
      });
    }
    top += lineHeight;
  });
  return top;
}

function drawCentered(
  page: PDFPage,
  text: string,
  opts: {
    top: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
): void {
  const raw =
    opts.maxWidth != null ? fitOneLine(text, opts.font, opts.size, opts.maxWidth) : winAnsi(text);
  const w = opts.font.widthOfTextAtSize(raw, opts.size);
  page.drawText(raw, {
    x: Math.max(40, (PAGE_W - w) / 2),
    y: topY(opts.top + opts.size * 0.78),
    size: opts.size,
    font: opts.font,
    color: opts.color ?? INK,
  });
}

function todayLabel(locale: 'es' | 'en'): string {
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function drawText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    /** Y desde el borde superior del boceto. */
    top: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
): void {
  const size = opts.size;
  const raw = winAnsi(text);
  const shown =
    opts.maxWidth != null ? fitOneLine(raw, opts.font, size, opts.maxWidth) : raw.slice(0, 160);
  const y = topY(opts.top + size * 0.78);
  page.drawText(shown, {
    x: opts.x,
    y,
    size,
    font: opts.font,
    color: opts.color ?? INK,
  });
}

function drawRight(
  page: PDFPage,
  text: string,
  opts: {
    right: number;
    top: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
): void {
  const size = opts.size;
  const raw = winAnsi(text);
  const shown =
    opts.maxWidth != null ? fitOneLine(raw, opts.font, size, opts.maxWidth) : raw.slice(0, 40);
  const w = opts.font.widthOfTextAtSize(shown, size);
  page.drawText(shown, {
    x: opts.right - w,
    y: topY(opts.top + size * 0.78),
    size,
    font: opts.font,
    color: opts.color ?? INK,
  });
}

export type QuotePdfRenderer = (snapshot: QuotePdfSnapshot) => Promise<Uint8Array>;

export const renderQuotePdf: QuotePdfRenderer = async snapshot => {
  const locale = snapshot.locale === 'en' ? 'en' : 'es';
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  let font: PDFFont;
  let bold: PDFFont;
  if (snapshot.fontRegularBytes?.byteLength && snapshot.fontBoldBytes?.byteLength) {
    font = await doc.embedFont(snapshot.fontRegularBytes, { subset: true });
    bold = await doc.embedFont(snapshot.fontBoldBytes, { subset: true });
  } else {
    const { StandardFonts } = await import('pdf-lib');
    font = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  let logo: PDFImage | null = null;
  if (snapshot.logoBytes && snapshot.logoBytes.byteLength > 0) {
    try {
      logo = await doc.embedPng(snapshot.logoBytes);
    } catch {
      try {
        logo = await doc.embedJpg(snapshot.logoBytes);
      } catch {
        logo = null;
      }
    }
  }

  let whatsappIcon: PDFImage | null = null;
  if (snapshot.whatsappIconBytes && snapshot.whatsappIconBytes.byteLength > 0) {
    try {
      whatsappIcon = await doc.embedPng(snapshot.whatsappIconBytes);
    } catch {
      whatsappIcon = null;
    }
  }

  const ivaPct =
    snapshot.ivaPct != null ? Number(snapshot.ivaPct) : snapshot.moneda === 'COP' ? 19 : 0;
  const subtotal = snapshot.lineas.reduce((acc, l) => {
    if (l.precio_pendiente_validar) return acc;
    const lineSub = Number(l.subtotal);
    if (Number.isFinite(lineSub) && lineSub > 0) return acc + lineSub;
    return acc + (Number(l.precio_unitario) || 0) * (Number(l.cantidad) || 0);
  }, 0);
  const iva = Math.round(subtotal * (ivaPct / 100) * 100) / 100;
  const totalPagar = Math.round((subtotal + iva) * 100) / 100;
  const fecha = snapshot.fecha?.trim() || todayLabel(locale);
  const tagline =
    snapshot.tagline?.trim() ||
    (locale === 'en'
      ? 'Equipping your mission to save lives'
      : 'Equipando tu misión de salvar vidas');
  const banco =
    snapshot.bancoLineas && snapshot.bancoLineas.length > 0
      ? snapshot.bancoLineas
      : ['Transferencia bancaria:', 'Bancolombia/Ahorros'];

  // ——— Página 1: COTIZACIÓN ———
  let page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });

  // Logo web (navbar: logo-ime-site → logo-ime-pdf.png). Boceto ~x40.
  if (logo) {
    const maxW = 150;
    const maxH = 74;
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, {
      x: 40,
      y: topY(18 + h),
      width: w,
      height: h,
    });
  }

  // Título COTIZACIÓN — boceto derecha; evitar overflow
  drawText(page, locale === 'en' ? 'QUOTATION' : 'COTIZACIÓN', {
    x: 348.6,
    top: 57.8,
    size: 26,
    font: bold,
    color: GRAY_TITLE,
    maxWidth: 200,
  });

  // Tagline bajo el logo
  drawText(page, `"${tagline}"`, {
    x: 40,
    top: 94,
    size: 9,
    font,
    color: MUTED,
    maxWidth: 280,
  });

  // N° / Fecha (derecha, número corto estilo boceto)
  const numeroVisible = displayQuoteNumero(snapshot.numero);
  drawRight(page, `${locale === 'en' ? 'No.' : 'N°'}: ${numeroVisible}`, {
    right: 536,
    top: 97,
    size: 12,
    font,
    maxWidth: 160,
  });
  drawRight(page, `${locale === 'en' ? 'Date' : 'Fecha'}: ${fecha}`, {
    right: 536,
    top: 115,
    size: 12,
    font,
    maxWidth: 160,
  });

  // RECEPTOR — nombre, organización, teléfono, email
  const leftColW = 300;
  drawText(page, locale === 'en' ? 'RECIPIENT:' : 'RECEPTOR:', {
    x: 58.3,
    top: 142.8,
    size: 11,
    font: bold,
    color: BLUE,
  });
  drawText(page, snapshot.clienteNombre || '—', {
    x: 59.5,
    top: 155.4,
    size: 11,
    font,
    maxWidth: leftColW,
  });
  let ry = 172.7;
  if (snapshot.empresa) {
    drawText(page, snapshot.empresa, { x: 59.5, top: ry, size: 11, font, maxWidth: leftColW });
    ry += 16;
  }
  if (snapshot.nitCliente) {
    drawText(page, `Nit: ${snapshot.nitCliente}`, {
      x: 59.5,
      top: ry,
      size: 11,
      font,
      maxWidth: leftColW,
    });
    ry += 16;
  }
  if (snapshot.telefono) {
    drawText(page, `${locale === 'en' ? 'Phone' : 'Teléfono'}: ${snapshot.telefono}`, {
      x: 59.5,
      top: ry,
      size: 11,
      font,
      maxWidth: leftColW,
    });
    ry += 16;
  }
  if (snapshot.email) {
    const emailLabel = `${locale === 'en' ? 'Email' : 'Correo electrónico'}: `;
    const emailLines = wrapByWidth(`${emailLabel}${snapshot.email}`, font, 11, leftColW).slice(
      0,
      2
    );
    for (const line of emailLines) {
      drawText(page, line, { x: 59.5, top: ry, size: 11, font, maxWidth: leftColW });
      ry += 15;
    }
  }

  // Condición / medio de pago (derecha) — anclado, no empuja tabla
  drawText(page, locale === 'en' ? 'PAYMENT TERMS:' : 'CONDICION DE PAGO:', {
    x: 385,
    top: 155,
    size: 11,
    font: bold,
    color: BLUE,
    maxWidth: 175,
  });
  drawText(page, snapshot.condicionPago || (locale === 'en' ? 'Prepaid' : 'Contado'), {
    x: 385,
    top: 170,
    size: 11,
    font,
    maxWidth: 175,
  });
  drawText(page, locale === 'en' ? 'PAYMENT METHOD:' : 'MEDIO  DE PAGO:', {
    x: 385,
    top: 194,
    size: 11,
    font: bold,
    maxWidth: 175,
  });
  let py = 210;
  for (const line of banco.slice(0, 4)) {
    drawText(page, line, { x: 385, top: py, size: 11, font, maxWidth: 175 });
    py += 15;
  }

  // Bloque empresa I-ME (columna izquierda; no espera a MEDIO DE PAGO)
  const companyTop = Math.max(ry + 12, 228);
  drawText(page, 'INTERNATIONAL MEDICAL ENTERPRISE', {
    x: 59.5,
    top: companyTop,
    size: 10,
    font: bold,
    color: BLUE,
    maxWidth: 310,
  });
  drawText(page, 'Nit: 901871720', { x: 59.5, top: companyTop + 15, size: 10, font });
  drawText(page, 'Medellín', { x: 59.5, top: companyTop + 30, size: 10, font });
  let companyBottom = companyTop + 42;
  if (snapshot.nombreComercial) {
    drawText(page, `Asesor: ${snapshot.nombreComercial}`, {
      x: 59.5,
      top: companyTop + 45,
      size: 9,
      font,
      color: MUTED,
      maxWidth: 310,
    });
    companyBottom = companyTop + 58;
  }

  // ——— Tabla + recuadro de precios (debajo de empresa y de pago; sin tope que pise) ———
  const tableLeft = 27;
  const tableRight = 568;
  const tableTop = Math.max(companyBottom + 16, py + 10, 270);
  const headerH = 36;
  const colXs = [tableLeft, 65, 175, 372, 462, tableRight];
  const unitRight = colXs[4]! - 8;
  const totalRight = tableRight - 8;
  const descMaxW = colXs[3]! - colXs[2]! - 10;
  const refMaxW = colXs[2]! - colXs[1]! - 8;
  const rowHBase = 40;
  const footerGuard = 780;
  const totalsBlockH = 118;
  const available = footerGuard - totalsBlockH - (tableTop + headerH);
  const maxRowsFit = Math.max(1, Math.floor(available / rowHBase));
  const pageLines = snapshot.lineas.slice(0, maxRowsFit);
  const overflowLines = snapshot.lineas.slice(maxRowsFit);

  page.drawRectangle({
    x: tableLeft,
    y: topY(tableTop + headerH),
    width: tableRight - tableLeft,
    height: headerH,
    color: BLUE,
  });
  const headerLabels =
    locale === 'en'
      ? [
          [40, 'QTY'],
          [74, 'REF'],
          [186, 'DESCRIPTION'],
        ]
      : [
          [40, 'CANT'],
          [74, 'REF'],
          [186, 'DESCRIPCION'],
        ];
  for (const [x, label] of headerLabels) {
    drawText(page, String(label), {
      x: Number(x),
      top: tableTop + 12,
      size: 11,
      font: bold,
      color: WHITE,
    });
  }
  drawRight(page, locale === 'en' ? 'UNIT' : 'PRECIO UNIT', {
    right: unitRight,
    top: tableTop + 12,
    size: 10,
    font: bold,
    color: WHITE,
    maxWidth: 78,
  });
  drawRight(page, 'TOTAL', {
    right: totalRight,
    top: tableTop + 12,
    size: 11,
    font: bold,
    color: WHITE,
    maxWidth: 70,
  });

  const gridTop = tableTop + headerH;
  const rowH = rowHBase;
  const maxRows = Math.max(1, pageLines.length);
  const gridBottom = gridTop + rowH * maxRows;

  pageLines.forEach((item, idx) => {
    const rowTop = gridTop + idx * rowH;
    const cant = String(item.cantidad);
    const ref = fitOneLine(item.slug || item.nombre || '—', font, 10, refMaxW);
    const descLines = wrapByWidth(item.nombre || item.slug || 'Producto', font, 10, descMaxW).slice(
      0,
      2
    );
    const pendiente = Boolean(item.precio_pendiente_validar);
    const textTop = rowTop + (descLines.length > 1 ? 10 : 14);
    drawText(page, cant, { x: 36, top: textTop, size: 11, font, maxWidth: 26 });
    drawText(page, ref, { x: 70, top: textTop, size: 10, font, maxWidth: refMaxW });
    descLines.forEach((line, i) => {
      drawText(page, line, {
        x: 186,
        top: rowTop + 10 + i * 13,
        size: 10,
        font,
        maxWidth: descMaxW,
      });
    });
    drawRight(
      page,
      pendiente
        ? locale === 'en'
          ? 'Pending'
          : 'Pendiente'
        : moneyPlain(item.precio_unitario, snapshot.moneda, locale),
      {
        right: unitRight,
        top: textTop,
        size: pendiente ? 9 : 10,
        font,
        maxWidth: 74,
      }
    );
    drawRight(
      page,
      pendiente
        ? locale === 'en'
          ? 'Pending'
          : 'Pendiente'
        : moneyPlain(item.subtotal, snapshot.moneda, locale),
      {
        right: totalRight,
        top: textTop,
        size: pendiente ? 9 : 10,
        font,
        maxWidth: 86,
      }
    );
  });

  for (const x of colXs) {
    page.drawLine({
      start: { x, y: topY(gridBottom) },
      end: { x, y: topY(gridTop) },
      thickness: 1,
      color: LINE,
    });
  }
  for (let i = 0; i <= maxRows; i += 1) {
    const y = gridTop + i * rowH;
    page.drawLine({
      start: { x: tableLeft, y: topY(y) },
      end: { x: tableRight, y: topY(y) },
      thickness: 1,
      color: LINE,
    });
  }

  // Totales (recuadro flush con columnas PRECIO/TOTAL) + NOTAS
  const boxRight = tableRight;
  const boxLeft = colXs[3]!;
  const boxWidth = boxRight - boxLeft;
  const totRowH = 23;
  const totRows = 4;
  const boxPadY = 10;
  const boxPadX = 14;
  const boxH = boxPadY * 2 + totRowH * totRows;
  const totalsTop = Math.min(gridBottom + 16, footerGuard - boxH - 8);
  const LIGHT_BOX = rgb(0.972, 0.978, 0.992);
  const TOTAL_BAND = rgb(0.88, 0.93, 0.98);
  const RULE = rgb(0.72, 0.76, 0.8);

  page.drawRectangle({
    x: boxLeft,
    y: topY(totalsTop + boxH),
    width: boxWidth,
    height: boxH,
    color: LIGHT_BOX,
  });
  // Acento superior (mismo azul del header de tabla)
  page.drawRectangle({
    x: boxLeft,
    y: topY(totalsTop + 4),
    width: boxWidth,
    height: 4,
    color: BLUE,
  });
  // Marco con las mismas coordenadas que la rejilla (sin inset de borderWidth)
  const boxBottom = totalsTop + boxH;
  for (const [x1, y1, x2, y2] of [
    [boxLeft, totalsTop, boxRight, totalsTop],
    [boxLeft, boxBottom, boxRight, boxBottom],
    [boxLeft, totalsTop, boxLeft, boxBottom],
    [boxRight, totalsTop, boxRight, boxBottom],
  ] as const) {
    page.drawLine({
      start: { x: x1, y: topY(y1) },
      end: { x: x2, y: topY(y2) },
      thickness: 1.15,
      color: LINE,
    });
  }

  const totEntries: Array<{
    label: string;
    value: string;
    emphasize?: boolean;
  }> = [
    {
      label: locale === 'en' ? 'GROSS TOTAL' : 'TOTAL BRUTO',
      value: moneyPlain(subtotal, snapshot.moneda, locale),
    },
    {
      label: 'SUBTOTAL',
      value: moneyPlain(subtotal, snapshot.moneda, locale),
    },
    {
      label: locale === 'en' ? `VAT ${ivaPct}%` : `IVA ${ivaPct}%`,
      value: moneyPlain(iva, snapshot.moneda, locale),
    },
    {
      label: locale === 'en' ? 'TOTAL DUE' : 'TOTAL A PAGAR',
      value: moneyCash(totalPagar, snapshot.moneda, locale),
      emphasize: true,
    },
  ];

  totEntries.forEach((row, i) => {
    const rowTop = totalsTop + boxPadY + i * totRowH;
    if (row.emphasize) {
      page.drawRectangle({
        x: boxLeft,
        y: topY(Math.min(rowTop + totRowH, boxBottom)),
        width: boxWidth,
        height: Math.min(totRowH, boxBottom - rowTop),
        color: TOTAL_BAND,
      });
    } else if (i < totEntries.length - 1) {
      page.drawLine({
        start: { x: boxLeft + boxPadX, y: topY(rowTop + totRowH) },
        end: { x: boxRight - boxPadX, y: topY(rowTop + totRowH) },
        thickness: 0.7,
        color: RULE,
      });
    }
    const textTop = rowTop + 7;
    drawText(page, row.label, {
      x: boxLeft + boxPadX,
      top: textTop,
      size: 10,
      font: bold,
      color: row.emphasize ? BLUE : INK,
      maxWidth: 120,
    });
    drawRight(page, row.value, {
      right: boxRight - boxPadX,
      top: textTop,
      size: row.emphasize ? 11 : 10,
      font: row.emphasize ? bold : font,
      color: row.emphasize ? BLUE : INK,
      maxWidth: 120,
    });
  });

  const validezLabel = snapshot.validezHasta
    ? (() => {
        const m = String(snapshot.validezHasta).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : snapshot.validezHasta;
      })()
    : null;
  drawText(page, locale === 'en' ? 'NOTES' : 'NOTAS', {
    x: tableLeft,
    top: totalsTop + 4,
    size: 11,
    font: bold,
  });
  const note = validezLabel
    ? locale === 'en'
      ? `Valid until ${validezLabel}. After this date prices and lead times may change.`
      : `Válida hasta el ${validezLabel}. Posterior a esta fecha, los precios y tiempos de entrega podrán estar sujetos a revisión según condiciones de mercado.`
    : snapshot.condiciones.slice(0, 280) ||
      (locale === 'en'
        ? 'Prices subject to change according to market conditions.'
        : 'Precios sujetos a revisión según condiciones de mercado.');
  drawJustifiedParagraph(page, note, {
    x: tableLeft,
    top: totalsTop + 22,
    size: 9,
    font,
    maxWidth: Math.max(120, boxLeft - tableLeft - 16),
    lineHeight: 12,
    color: MUTED,
    maxLines: 5,
  });

  drawFooterBar(page, font, whatsappIcon);

  // Continuación de líneas si no caben en página 1
  if (overflowLines.length > 0) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
    drawText(page, locale === 'en' ? 'Continued lines' : 'Continuación de líneas', {
      x: 40,
      top: 50,
      size: 13,
      font: bold,
      color: BLUE,
    });
    let oy = 80;
    for (const item of overflowLines) {
      if (oy > 740) break;
      const pendiente = Boolean(item.precio_pendiente_validar);
      const line = `${item.cantidad} × ${item.nombre} — ${
        pendiente
          ? locale === 'en'
            ? 'Pending'
            : 'Pendiente validar'
          : moneyCash(item.subtotal, snapshot.moneda, locale)
      }`;
      for (const chunk of wrapByWidth(line, font, 11, 500).slice(0, 2)) {
        drawText(page, chunk, { x: 40, top: oy, size: 11, font, maxWidth: 510 });
        oy += 15;
      }
      oy += 6;
    }
    drawFooterBar(page, font, whatsappIcon);
  }

  // ——— Página consideraciones (boceto IPS p.2) ———
  page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
  drawCentered(page, locale === 'en' ? 'Offer considerations' : 'Consideraciones de la oferta', {
    top: 56,
    size: 14,
    font: bold,
    color: BLUE,
    maxWidth: 480,
  });
  let cy = 88;
  const terms = resolveCondicionesOferta(snapshot.condiciones, locale);
  const termBlocks = terms
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean);
  const ensureCondPage = () => {
    if (cy <= 750) return;
    drawFooterBar(page, font, whatsappIcon);
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
    drawCentered(
      page,
      locale === 'en' ? 'Offer considerations (cont.)' : 'Consideraciones de la oferta (cont.)',
      { top: 56, size: 13, font: bold, color: BLUE, maxWidth: 480 }
    );
    cy = 88;
  };
  for (const block of termBlocks) {
    ensureCondPage();
    if (isCondicionesSectionHeading(block, locale)) {
      cy += cy > 88 ? 10 : 0;
      ensureCondPage();
      drawText(page, block, {
        x: 50,
        top: cy,
        size: 13,
        font: bold,
        color: BLUE,
        maxWidth: 490,
      });
      cy += 20;
      continue;
    }
    cy = drawJustifiedParagraph(page, block, {
      x: 50,
      top: cy,
      size: 11,
      font,
      maxWidth: 490,
      lineHeight: 15,
    });
    cy += 8;
  }
  drawFooterBar(page, font, whatsappIcon);

  // ——— Anexos (orden boceto): título → descripción → foto → características ———
  for (const annex of snapshot.annexes ?? []) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });

    const titleParts = wrapByWidth(annex.nombre.toUpperCase(), bold, 13, 500).slice(0, 2);
    titleParts.forEach((line, i) => {
      drawCentered(page, line, {
        top: 52 + i * 18,
        size: 13,
        font: bold,
        color: BLUE,
        maxWidth: 500,
      });
    });

    let ay = 52 + titleParts.length * 18 + 16;
    const body = (annex.descripcion || annex.resumen || '').replace(/\s+/g, ' ').trim();
    if (body) {
      ay = drawJustifiedParagraph(page, body, {
        x: 40,
        top: ay,
        size: 11,
        font,
        maxWidth: 510,
        lineHeight: 15,
        maxLines: 14,
      });
      ay += 12;
    }

    if (annex.imageBytes && annex.imageBytes.byteLength > 0) {
      let img: PDFImage | null = null;
      try {
        img = await doc.embedJpg(annex.imageBytes);
      } catch {
        try {
          img = await doc.embedPng(annex.imageBytes);
        } catch {
          /* unsupported image */
        }
      }
      if (img) {
        const maxW = 220;
        const maxH = 110;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const imgTop = ay;
        page.drawImage(img, {
          x: (PAGE_W - w) / 2,
          y: topY(imgTop + h),
          width: w,
          height: h,
        });
        ay = imgTop + h + 12;
      }
    }

    const chars = (annex.caracteristicas ?? []).filter(Boolean);
    if (chars.length > 0) {
      if (ay > 700) {
        drawFooterBar(page, font, whatsappIcon);
        page = doc.addPage([PAGE_W, PAGE_H]);
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
        ay = 50;
      }
      drawText(page, locale === 'en' ? 'Smart features:' : 'Características Inteligentes:', {
        x: 47,
        top: ay,
        size: 12,
        font: bold,
      });
      ay += 22;
      for (const c of chars.slice(0, 14)) {
        if (ay > 760) {
          drawFooterBar(page, font, whatsappIcon);
          page = doc.addPage([PAGE_W, PAGE_H]);
          page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
          ay = 50;
        }
        const lines = wrapByWidth(`# ${c}`, font, 11, 470);
        for (const line of lines.slice(0, 3)) {
          drawText(page, line, { x: 55, top: ay, size: 11, font, maxWidth: 480 });
          ay += 14;
        }
        ay += 4;
      }
    }

    drawFooterBar(page, font, whatsappIcon);
  }

  const bytes = await doc.save();
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error('PDF_RENDER_FAILED: PDF exceeds 8MB');
  }
  return bytes;
};

function drawFooterBar(page: PDFPage, font: PDFFont, whatsappIcon: PDFImage | null): void {
  // Boceto footer bar y≈790–830, fill = mismo azul header
  page.drawRectangle({
    x: 46.4,
    y: topY(829.8),
    width: 520,
    height: 39.4,
    color: BLUE,
  });
  page.drawText(winAnsi('www.i-me.com.co'), {
    x: 88.6,
    y: topY(812),
    size: 11,
    font,
    color: WHITE,
  });

  const phone = '+57 3103332607';
  const phoneSize = 11;
  const iconSize = 12;
  const gap = 4;
  let cursorX = 252;
  if (whatsappIcon) {
    page.drawImage(whatsappIcon, {
      x: cursorX,
      y: topY(812) - 1,
      width: iconSize,
      height: iconSize,
    });
    cursorX += iconSize + gap;
  }
  page.drawText(winAnsi(phone), {
    x: cursorX,
    y: topY(812),
    size: phoneSize,
    font,
    color: WHITE,
  });

  page.drawText(winAnsi('info@i-me.com.co'), {
    x: 411,
    y: topY(812),
    size: 11,
    font,
    color: WHITE,
  });
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
