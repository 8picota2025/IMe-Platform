/**
 * PDF Presupuesto I-ME — layout calibrado al boceto IPS.pdf
 * (posiciones, tamaños, tabla con rejilla, totales, notas, footer,
 *  anexo con foto + características + descripción).
 */
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CotizacionLineaOferta } from './cotizacion-oferta';

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

function wrapText(text: string, max: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max) {
      if (cur) lines.push(cur);
      cur = w.length > max ? w.slice(0, max) : w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
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
  // Baseline ≈ top + size * 0.78 (aproxima métricas Poppins del boceto).
  const y = topY(opts.top + size * 0.78);
  page.drawText(winAnsi(text).slice(0, opts.maxWidth ? 200 : 120), {
    x: opts.x,
    y,
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
  });

  // Tagline bajo el logo — Comfortaa ~9.4 @ x21 top94
  drawText(page, `"${tagline}"`, {
    x: 21,
    top: 94,
    size: 9.4,
    font,
    color: MUTED,
  });

  // N° / Fecha (derecha) — Poppins 12
  drawText(page, `${locale === 'en' ? 'No.' : 'N°'}: ${snapshot.numero}`, {
    x: 470,
    top: 97,
    size: 12,
    font,
  });
  drawText(page, `${locale === 'en' ? 'Date' : 'Fecha'}: ${fecha}`, {
    x: 427,
    top: 115,
    size: 12,
    font,
  });

  // RECEPTOR — nombre, organización, teléfono, email (pedido comercial)
  drawText(page, locale === 'en' ? 'RECIPIENT:' : 'RECEPTOR:', {
    x: 58.3,
    top: 142.8,
    size: 11,
    font: bold,
    color: BLUE,
  });
  drawText(page, snapshot.clienteNombre || '—', { x: 59.5, top: 155.4, size: 11, font });
  let ry = 172.7;
  if (snapshot.empresa) {
    drawText(page, snapshot.empresa, { x: 59.5, top: ry, size: 11, font });
    ry += 17.3;
  }
  if (snapshot.nitCliente) {
    drawText(page, `Nit: ${snapshot.nitCliente}`, { x: 59.5, top: ry, size: 11, font });
    ry += 17.3;
  }
  if (snapshot.telefono) {
    drawText(page, `${locale === 'en' ? 'Phone' : 'Teléfono'}: ${snapshot.telefono}`, {
      x: 59.5,
      top: ry,
      size: 11,
      font,
    });
    ry += 17.3;
  }
  if (snapshot.email) {
    drawText(page, `${locale === 'en' ? 'Email' : 'Correo electrónico'}: ${snapshot.email}`, {
      x: 59.5,
      top: ry,
      size: 11,
      font,
    });
    ry += 17.3;
  }

  // Bloque empresa I-ME (boceto ~255)
  const companyTop = Math.max(ry + 12, 255);
  drawText(page, 'INTERNATIONAL MEDICAL ENTERPRISE', {
    x: 59.5,
    top: companyTop,
    size: 11,
    font: bold,
    color: BLUE,
  });
  drawText(page, 'Nit: 901871720', { x: 59.5, top: companyTop + 16.3, size: 11, font });
  drawText(page, 'Medellín', { x: 59.5, top: companyTop + 33.6, size: 11, font });
  if (snapshot.nombreComercial) {
    drawText(page, `Asesor: ${snapshot.nombreComercial}`, {
      x: 59.5,
      top: companyTop + 50,
      size: 10,
      font,
      color: MUTED,
    });
  }

  // Condición / medio de pago (derecha)
  drawText(page, locale === 'en' ? 'PAYMENT TERMS:' : 'CONDICION DE PAGO:', {
    x: 385,
    top: 208,
    size: 11,
    font: bold,
    color: BLUE,
  });
  drawText(page, snapshot.condicionPago || (locale === 'en' ? 'Prepaid' : 'Contado'), {
    x: 385,
    top: 223,
    size: 11,
    font,
  });
  drawText(page, locale === 'en' ? 'PAYMENT METHOD:' : 'MEDIO  DE PAGO:', {
    x: 385,
    top: 247,
    size: 11,
    font: bold,
  });
  let py = 265;
  for (const line of banco.slice(0, 4)) {
    drawText(page, line, { x: 385, top: py, size: 11, font });
    py += 16;
  }

  // ——— Tabla ———
  // Header bar azul (boceto y≈341–380)
  const tableTop = 341;
  const headerH = 38;
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
          [65, 'QTY'],
          [125, 'REF'],
          [205, 'DESCRIPTION'],
          [397, 'UNIT'],
          [484, 'TOTAL'],
        ]
      : [
          [65, 'CANT'],
          [125, 'REF'],
          [205, 'DESCRIPCION'],
          [397, 'PRECIO'],
          [484, 'TOTAL'],
        ];
  for (const [x, label] of headerLabels) {
    drawText(page, String(label), {
      x: Number(x),
      top: tableTop + 10,
      size: 12,
      font: bold,
      color: WHITE,
    });
  }
  if (locale !== 'en') {
    drawText(page, 'UNIT', { x: 406, top: tableTop + 22, size: 12, font: bold, color: WHITE });
  }

  // Columnas verticales (boceto)
  const colXs = [27.5, 65.1, 180.4, 381.0, 468.8, 569.2];
  const rowH = 42.8;
  const maxRows = Math.max(1, snapshot.lineas.length);
  const gridTop = tableTop + headerH;
  const gridBottom = gridTop + rowH * maxRows;

  // Filas de datos
  snapshot.lineas.forEach((item, idx) => {
    const rowTop = gridTop + idx * rowH;
    const cant = String(item.cantidad);
    const ref = (item.slug || item.nombre || '—').slice(0, 16);
    const descLines = wrapText(item.nombre || item.slug || 'Producto', 28).slice(0, 2);
    const pendiente = Boolean(item.precio_pendiente_validar);
    drawText(page, cant, { x: 40, top: rowTop + 12, size: 12, font });
    drawText(page, ref, { x: 74, top: rowTop + 12, size: 12, font });
    descLines.forEach((line, i) => {
      drawText(page, line, { x: 190, top: rowTop + 10 + i * 14, size: 11, font });
    });
    drawText(
      page,
      pendiente
        ? locale === 'en'
          ? 'Pending'
          : 'Pendiente'
        : moneyPlain(item.precio_unitario, snapshot.moneda, locale),
      {
        x: 395,
        top: rowTop + 12,
        size: pendiente ? 10 : 12,
        font,
      }
    );
    drawText(
      page,
      pendiente
        ? locale === 'en'
          ? 'Pending'
          : 'Pendiente'
        : moneyPlain(item.subtotal, snapshot.moneda, locale),
      {
        x: 478,
        top: rowTop + 12,
        size: pendiente ? 10 : 12,
        font,
      }
    );
  });

  // Rejilla
  for (const x of colXs) {
    page.drawLine({
      start: { x, y: topY(gridBottom) },
      end: { x, y: topY(gridTop) },
      thickness: 1.2,
      color: LINE,
    });
  }
  for (let i = 0; i <= maxRows; i += 1) {
    const y = gridTop + i * rowH;
    page.drawLine({
      start: { x: 26.7, y: topY(y) },
      end: { x: 570, y: topY(y) },
      thickness: 1.2,
      color: LINE,
    });
  }

  // Totales (derecha) + NOTAS (izquierda)
  const totalsTop = gridBottom + 14;
  drawText(page, locale === 'en' ? 'GROSS TOTAL' : 'TOTAL BRUTO', {
    x: 323,
    top: totalsTop,
    size: 12,
    font: bold,
  });
  drawText(page, moneyPlain(subtotal, snapshot.moneda, locale), {
    x: 478,
    top: totalsTop,
    size: 12,
    font,
  });
  drawText(page, 'SUBTOTAL', { x: 323, top: totalsTop + 28, size: 12, font: bold });
  drawText(page, moneyPlain(subtotal, snapshot.moneda, locale), {
    x: 478,
    top: totalsTop + 28,
    size: 12,
    font,
  });
  drawText(page, locale === 'en' ? `VAT ${ivaPct}%` : `IVA ${ivaPct}%`, {
    x: 323,
    top: totalsTop + 52,
    size: 12,
    font: bold,
  });
  drawText(page, moneyPlain(iva, snapshot.moneda, locale), {
    x: 478,
    top: totalsTop + 52,
    size: 12,
    font,
  });
  drawText(page, locale === 'en' ? 'TOTAL DUE' : 'TOTAL A PAGAR', {
    x: 323,
    top: totalsTop + 82,
    size: 12,
    font: bold,
    color: BLUE,
  });
  drawText(page, moneyCash(totalPagar, snapshot.moneda, locale), {
    x: 460,
    top: totalsTop + 82,
    size: 12,
    font: bold,
    color: BLUE,
  });

  // NOTAS (validez / condiciones cortas)
  drawText(page, locale === 'en' ? 'NOTES' : 'NOTAS', {
    x: 27,
    top: totalsTop + 46,
    size: 11,
    font: bold,
  });
  const note = snapshot.validezHasta
    ? locale === 'en'
      ? `Valid until ${snapshot.validezHasta}. After this date prices and lead times may change.`
      : `válida hasta el ${snapshot.validezHasta}. Posterior a esta fecha, los precios y tiempos de entrega podrán estar sujetos a revisión según condiciones de mercado.`
    : snapshot.condiciones.slice(0, 220) ||
      (locale === 'en'
        ? 'Prices subject to change according to market conditions.'
        : 'Precios sujetos a revisión según condiciones de mercado.');
  wrapText(note, 48)
    .slice(0, 4)
    .forEach((line, i) => {
      drawText(page, line, { x: 27, top: totalsTop + 62 + i * 12, size: 9, font, color: MUTED });
    });

  drawFooterBar(page, font);

  // ——— Página 2: consideraciones ———
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
  const terms =
    snapshot.condiciones.trim() ||
    (locale === 'en'
      ? 'See commercial terms agreed with your advisor.'
      : 'Ver condiciones comerciales acordadas con su asesor.');
  for (const chunk of wrapText(terms, 92)) {
    if (cy > 760) break;
    drawText(page, chunk, { x: 40, top: cy, size: 11, font });
    cy += 16;
  }
  drawFooterBar(page, font);

  // ——— Anexos (orden boceto): título → descripción → foto → características ———
  for (const annex of snapshot.annexes ?? []) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });

    const titleParts = wrapText(annex.nombre.toUpperCase(), 48).slice(0, 2);
    titleParts.forEach((line, i) => {
      const w = bold.widthOfTextAtSize(winAnsi(line), 13);
      drawText(page, line, {
        x: Math.max(40, (PAGE_W - w) / 2),
        top: 57.4 + i * 18,
        size: 13,
        font: bold,
        color: BLUE,
      });
    });

    // Descripción primero (boceto ~128)
    let ay = 128;
    const body = (annex.descripcion || annex.resumen || '').replace(/\s+/g, ' ').trim();
    if (body) {
      for (const chunk of wrapText(body, 88).slice(0, 8)) {
        drawText(page, chunk, { x: 38, top: ay, size: 12, font });
        ay += 16.5;
      }
      ay += 12;
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
        const lines = wrapText(c, 78);
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
