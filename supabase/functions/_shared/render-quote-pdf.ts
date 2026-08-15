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
  return s.replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, '?');
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

  // Título COTIZACIÓN — boceto: TTNormsPro-Bold 28.8 @ x348.6 top57.8
  drawText(page, locale === 'en' ? 'QUOTATION' : 'COTIZACIÓN', {
    x: 348.6,
    top: 57.8,
    size: 28.8,
    font: bold,
    color: GRAY_TITLE,
    maxWidth: 220,
  });

  // Tagline bajo el logo — Comfortaa ~9.4 @ x21 top94
  drawText(page, `"${tagline}"`, {
    x: 21,
    top: 94,
    size: 9.4,
    font,
    color: MUTED,
    maxWidth: 300,
  });

  // N° / Fecha (derecha)
  drawRight(page, `${locale === 'en' ? 'No.' : 'N°'}: ${snapshot.numero}`, {
    right: 560,
    top: 97,
    size: 11,
    font,
    maxWidth: 150,
  });
  drawRight(page, `${locale === 'en' ? 'Date' : 'Fecha'}: ${fecha}`, {
    right: 560,
    top: 113,
    size: 11,
    font,
    maxWidth: 150,
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

  // Bloque empresa I-ME
  const companyTop = Math.max(ry + 10, py + 8, 250);
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
  if (snapshot.nombreComercial) {
    drawText(page, `Asesor: ${snapshot.nombreComercial}`, {
      x: 59.5,
      top: companyTop + 45,
      size: 9,
      font,
      color: MUTED,
      maxWidth: 310,
    });
  }

  // ——— Tabla ———
  const tableTop = Math.min(360, Math.max(300, companyTop + (snapshot.nombreComercial ? 62 : 48)));
  const headerH = 38;
  const colXs = [27.5, 65.1, 180.4, 381.0, 468.8, 569.2];
  const unitRight = 460;
  const totalRight = 560;
  const descMaxW = colXs[3]! - colXs[2]! - 8;
  const refMaxW = colXs[2]! - colXs[1]! - 6;
  const rowHBase = 40;
  const footerGuard = 790;
  const totalsBlockH = 110;
  const available = footerGuard - totalsBlockH - (tableTop + headerH);
  const maxRowsFit = Math.max(1, Math.floor(available / rowHBase));
  const pageLines = snapshot.lineas.slice(0, maxRowsFit);
  const overflowLines = snapshot.lineas.slice(maxRowsFit);

  page.drawRectangle({
    x: 22,
    y: topY(tableTop + headerH),
    width: 552,
    height: headerH,
    color: BLUE,
  });
  const headerLabels =
    locale === 'en'
      ? [
          [40, 'QTY'],
          [74, 'REF'],
          [190, 'DESCRIPTION'],
        ]
      : [
          [40, 'CANT'],
          [74, 'REF'],
          [190, 'DESCRIPCION'],
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
    drawText(page, cant, { x: 36, top: rowTop + 12, size: 11, font, maxWidth: 26 });
    drawText(page, ref, { x: 70, top: rowTop + 12, size: 10, font, maxWidth: refMaxW });
    descLines.forEach((line, i) => {
      drawText(page, line, {
        x: 186,
        top: rowTop + 8 + i * 13,
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
        top: rowTop + 12,
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
        top: rowTop + 12,
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
      thickness: 1.1,
      color: LINE,
    });
  }
  for (let i = 0; i <= maxRows; i += 1) {
    const y = gridTop + i * rowH;
    page.drawLine({
      start: { x: 26.7, y: topY(y) },
      end: { x: 570, y: topY(y) },
      thickness: 1.1,
      color: LINE,
    });
  }

  // Totales + NOTAS
  const totalsTop = Math.min(gridBottom + 12, footerGuard - totalsBlockH);
  drawText(page, locale === 'en' ? 'GROSS TOTAL' : 'TOTAL BRUTO', {
    x: 323,
    top: totalsTop,
    size: 11,
    font: bold,
    maxWidth: 120,
  });
  drawRight(page, moneyPlain(subtotal, snapshot.moneda, locale), {
    right: totalRight,
    top: totalsTop,
    size: 11,
    font,
    maxWidth: 100,
  });
  drawText(page, 'SUBTOTAL', { x: 323, top: totalsTop + 24, size: 11, font: bold, maxWidth: 120 });
  drawRight(page, moneyPlain(subtotal, snapshot.moneda, locale), {
    right: totalRight,
    top: totalsTop + 24,
    size: 11,
    font,
    maxWidth: 100,
  });
  drawText(page, locale === 'en' ? `VAT ${ivaPct}%` : `IVA ${ivaPct}%`, {
    x: 323,
    top: totalsTop + 48,
    size: 11,
    font: bold,
    maxWidth: 120,
  });
  drawRight(page, moneyPlain(iva, snapshot.moneda, locale), {
    right: totalRight,
    top: totalsTop + 48,
    size: 11,
    font,
    maxWidth: 100,
  });
  drawText(page, locale === 'en' ? 'TOTAL DUE' : 'TOTAL A PAGAR', {
    x: 323,
    top: totalsTop + 74,
    size: 11,
    font: bold,
    color: BLUE,
    maxWidth: 120,
  });
  drawRight(page, moneyCash(totalPagar, snapshot.moneda, locale), {
    right: totalRight,
    top: totalsTop + 74,
    size: 12,
    font: bold,
    color: BLUE,
    maxWidth: 120,
  });

  drawText(page, locale === 'en' ? 'NOTES' : 'NOTAS', {
    x: 27,
    top: totalsTop + 40,
    size: 11,
    font: bold,
  });
  const note = snapshot.validezHasta
    ? locale === 'en'
      ? `Valid until ${snapshot.validezHasta}. After this date prices and lead times may change.`
      : `válida hasta el ${snapshot.validezHasta}. Posterior a esta fecha, los precios y tiempos de entrega podrán estar sujetos a revisión según condiciones de mercado.`
    : snapshot.condiciones.slice(0, 280) ||
      (locale === 'en'
        ? 'Prices subject to change according to market conditions.'
        : 'Precios sujetos a revisión según condiciones de mercado.');
  wrapByWidth(note, font, 9, 280)
    .slice(0, 4)
    .forEach((line, i) => {
      drawText(page, line, {
        x: 27,
        top: totalsTop + 56 + i * 12,
        size: 9,
        font,
        color: MUTED,
        maxWidth: 280,
      });
    });

  drawFooterBar(page, font);

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
    drawFooterBar(page, font);
  }

  // ——— Página consideraciones (boceto IPS p.2) ———
  page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
  drawText(page, locale === 'en' ? 'Offer considerations' : 'Consideraciones de la oferta', {
    x: 40,
    top: 50,
    size: 14,
    font: bold,
    color: BLUE,
  });
  let cy = 80;
  const terms = resolveCondicionesOferta(snapshot.condiciones, locale);
  const termLines = terms.replace(/\r\n/g, '\n').split('\n');
  const ensureCondPage = () => {
    if (cy <= 760) return;
    drawFooterBar(page, font);
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
    drawText(
      page,
      locale === 'en' ? 'Offer considerations (cont.)' : 'Consideraciones de la oferta (cont.)',
      {
        x: 40,
        top: 50,
        size: 13,
        font: bold,
        color: BLUE,
      }
    );
    cy = 80;
  };
  for (const rawLine of termLines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      cy += 10;
      ensureCondPage();
      continue;
    }
    const heading = isCondicionesSectionHeading(line.trim(), locale);
    if (heading) {
      cy += cy > 80 ? 8 : 0;
      ensureCondPage();
      drawText(page, line.trim(), {
        x: 40,
        top: cy,
        size: 13,
        font: bold,
        color: BLUE,
        maxWidth: 510,
      });
      cy += 20;
      continue;
    }
    const indent = /^\s/.test(rawLine) ? 58 : 40;
    const width = 510 - (indent - 40);
    for (const chunk of wrapByWidth(line.trim(), font, 11, width)) {
      ensureCondPage();
      drawText(page, chunk, { x: indent, top: cy, size: 11, font, maxWidth: width });
      cy += 15;
    }
  }
  drawFooterBar(page, font);

  // ——— Anexos (orden boceto): título → descripción → foto → características ———
  for (const annex of snapshot.annexes ?? []) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });

    const titleParts = wrapByWidth(annex.nombre.toUpperCase(), bold, 13, 500).slice(0, 2);
    titleParts.forEach((line, i) => {
      const w = bold.widthOfTextAtSize(winAnsi(line), 13);
      drawText(page, line, {
        x: Math.max(40, (PAGE_W - w) / 2),
        top: 57.4 + i * 18,
        size: 13,
        font: bold,
        color: BLUE,
        maxWidth: 510,
      });
    });

    // Descripción primero (boceto ~128)
    let ay = 128;
    const body = (annex.descripcion || annex.resumen || '').replace(/\s+/g, ' ').trim();
    if (body) {
      for (const chunk of wrapByWidth(body, font, 11, 510).slice(0, 10)) {
        drawText(page, chunk, { x: 38, top: ay, size: 11, font, maxWidth: 510 });
        ay += 15;
      }
      ay += 10;
    }

    // Foto centrada (boceto bbox ≈ 174–394 × 220–328 → ~220×109)
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
        // Si descripción corta, anclar cerca del boceto (top≈220)
        const imgTop = Math.max(ay, 220);
        page.drawImage(img, {
          x: (PAGE_W - w) / 2,
          y: topY(imgTop + h),
          width: w,
          height: h,
        });
        ay = imgTop + h + 12;
      }
    }

    // Características (boceto ~340)
    const chars = (annex.caracteristicas ?? []).filter(Boolean);
    if (chars.length > 0) {
      ay = Math.max(ay, 340);
      if (ay > 700) {
        drawFooterBar(page, font);
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
      ay += 28;
      for (const c of chars.slice(0, 14)) {
        if (ay > 760) {
          drawFooterBar(page, font);
          page = doc.addPage([PAGE_W, PAGE_H]);
          page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
          ay = 50;
        }
        const lines = wrapByWidth(c, font, 11, 470);
        for (const line of lines.slice(0, 4)) {
          drawText(page, line, { x: 67.5, top: ay, size: 12, font });
          ay += 16.5;
        }
        ay += 10;
      }
    }

    drawFooterBar(page, font);
  }

  const bytes = await doc.save();
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error('PDF_RENDER_FAILED: PDF exceeds 8MB');
  }
  return bytes;
};

function drawFooterBar(page: PDFPage, font: PDFFont): void {
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
  page.drawText(winAnsi('+57 3138674059'), {
    x: 267,
    y: topY(812),
    size: 11,
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
