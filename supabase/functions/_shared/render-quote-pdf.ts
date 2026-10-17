/**
 * Edge mirror of src/lib/render-quote-pdf.ts — keep in sync.
 */
/**
 * PDF Presupuesto I-ME — layout calibrado al boceto IPS.pdf
 * (posiciones, tamaños, tabla con rejilla, totales, notas, footer,
 *  anexo con foto + características + descripción).
 */
import {
  PDFDocument,
  PDFName,
  PDFString,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit';
import type { CotizacionLineaOferta } from '../../../src/lib/cotizacion-oferta.ts';
import { displayQuoteNumero } from '../../../src/lib/cotizacion-oferta.ts';
import { isCondicionesSectionHeading, resolveCondicionesOferta } from '../../../src/lib/condiciones-oferta.ts';
import { desgloseCotizacion, etiquetaIvaTotales, roundMoney } from '../../../src/lib/cotizacion-iva.ts';

import { lineasDeResumen } from '../../../src/lib/quote-specs-summary.ts';
import { quoteAnnexHasSpecContent } from '../../../src/lib/quote-pdf-annex.ts';
import { aplicarNotaImportesUsd, notaImportesUsd } from '../../../src/lib/cotizacion-recaudo.ts';
import {
  IME_EMAIL_PUBLICO,
  IME_NIT,
  IME_RAZON_SOCIAL,
  IME_WEB,
  textoCliente,
} from '../../../src/lib/contacto-cliente.ts';
import { etiquetaBilingue, type IdiomaCotizacion } from '../../../src/lib/idioma-cotizacion.ts';
import { IME_WHATSAPP_DISPLAY } from '../../../src/lib/contacto-oficial.ts';

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
  direccionCliente?: string | null;
  ciudadCliente?: string | null;
  paisCliente?: string | null;
  condiciones: string;
  /** Condiciones libres en inglés. Si faltan, la oferta bilingüe muestra las castellanas. */
  condicionesEn?: string | null;
  /** `es-en` imprime etiquetas, títulos y textos fijos en castellano e inglés. */
  idioma?: IdiomaCotizacion | null;
  validezHasta?: string | null;
  moneda: string;
  total: number;
  lineas: CotizacionLineaOferta[];
  locale?: 'es' | 'en';
  nombreComercial?: string | null;
  correoComercial?: string | null;
  telefonoComercial?: string | null;
  condicionPago?: string | null;
  /** Versión en inglés de la condición de pago libre. Si falta, se muestra la castellana. */
  condicionPagoEn?: string | null;
  medioPago?: string | null;
  bancoLineas?: string[];
  /** Precio digitado ya incluye IVA. El total a pagar no suma el impuesto encima. */
  impuestosIncluidos?: boolean | null;
  /** Enlace Web Checkout firmado. Vacío si no hay llaves o la cotización es USD. */
  wompiUrl?: string | null;
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

/** Poppins dibuja la raya «—». Helvetica (WinAnsi) no puede codificarla. */
let conservarRaya = false;

function winAnsi(s: string): string {
  const superMap: Record<string, string> = {
    '\u2070': '0',
    '\u00B9': '1',
    '\u00B2': '2',
    '\u00B3': '3',
    '\u2074': '4',
    '\u2075': '5',
    '\u2076': '6',
    '\u2077': '7',
    '\u2078': '8',
    '\u2079': '9',
  };
  const rayas = conservarRaya ? /[\u2013\u2212\u2010\u2011]/g : /[\u2013\u2014\u2212\u2010\u2011]/g;
  const permitido = conservarRaya
    ? /[^\t\n\r\x20-\x7E\xA0-\xFF\u2014\u2026]/g
    : /[^\t\n\r\x20-\x7E\xA0-\xFF\u2026]/g;
  return s
    .replace(rayas, '-')
    .replace(/[\u00D7\u2715\u2716]/g, 'x') // × → x
    .replace(/[\u2022\u2023\u25CF\u25E6\u2219]/g, '#') // bullets → # (no · U+00B7)
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(
      /[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+/g,
      m => `^${[...m].map(c => superMap[c] ?? '').join('')}`
    )
    .replace(/\u207B/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(permitido, '?');
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
  const plain = moneyPlain(value, moneda, locale);
  return moneda === 'USD' ? `USD ${plain}` : `$${plain}`;
}

function formatCantidad(value: number, locale: 'es' | 'en'): string {
  const n = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
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

/**
 * Párrafo alineado a la izquierda. La justificación abría huecos grandes
 * en inglés. Devuelve el siguiente `top`.
 */
function drawLeftParagraph(
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
  for (const line of limited) {
    page.drawText(winAnsi(line), {
      x: opts.x,
      y: topY(top + opts.size * 0.78),
      size: opts.size,
      font: opts.font,
      color,
    });
    top += lineHeight;
  }
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
  conservarRaya = Boolean(
    snapshot.fontRegularBytes?.byteLength && snapshot.fontBoldBytes?.byteLength
  );
  const locale = snapshot.locale === 'en' ? 'en' : 'es';
  const idioma: 'es' | 'en' | IdiomaCotizacion = snapshot.idioma === 'es-en' ? 'es-en' : locale;
  const localeNumero: 'es' | 'en' = idioma === 'en' ? 'en' : 'es';
  const et = (castellano: string, ingles: string) => etiquetaBilingue(castellano, ingles, idioma);
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

  const impuestosIncluidos = snapshot.impuestosIncluidos === true;
  const desglose = desgloseCotizacion(snapshot.lineas, {
    impuestosIncluidos,
    moneda: snapshot.moneda,
  });
  // El total del caller (desgloseDeLineas con catálogo) manda: sin mapa de
  // productos, "Según catálogo" caería en 19 % y el PDF divergiría del correo.
  const totalPagar =
    Number.isFinite(snapshot.total) && snapshot.total > 0
      ? roundMoney(snapshot.total)
      : desglose.total;
  const subtotal = desglose.base;
  const iva =
    Number.isFinite(snapshot.total) &&
    snapshot.total > 0 &&
    Math.abs(desglose.total - totalPagar) > 0.009
      ? roundMoney(Math.max(0, totalPagar - subtotal))
      : desglose.iva;
  const etiquetaIvaEs = etiquetaIvaTotales(desglose, impuestosIncluidos, 'es');
  const etiquetaIvaEn = etiquetaIvaTotales(desglose, impuestosIncluidos, 'en');
  const etiquetaIva =
    idioma === 'es-en'
      ? `${etiquetaIvaEs} / ${etiquetaIvaEn}`
      : idioma === 'en'
        ? etiquetaIvaEn
        : etiquetaIvaEs;
  const fecha = snapshot.fecha?.trim() || todayLabel(localeNumero);
  const taglineEs = snapshot.tagline?.trim() || 'Equipando tu misión de salvar vidas';
  const taglineEn = 'Equipping your mission to save lives';
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
  if (idioma === 'es-en') {
    drawRight(page, 'COTIZACIÓN', {
      right: 555,
      top: 46,
      size: 16,
      font: bold,
      color: GRAY_TITLE,
      maxWidth: 210,
    });
    drawRight(page, 'QUOTATION', {
      right: 555,
      top: 64,
      size: 12,
      font: bold,
      color: GRAY_TITLE,
      maxWidth: 210,
    });
  } else {
    drawText(page, idioma === 'en' ? 'QUOTATION' : 'COTIZACIÓN', {
      x: 348.6,
      top: 57.8,
      size: 26,
      font: bold,
      color: GRAY_TITLE,
      maxWidth: 200,
    });
  }

  // Tagline bajo el logo
  drawText(page, `"${idioma === 'en' ? taglineEn : taglineEs}"`, {
    x: 40,
    top: 94,
    size: 9,
    font,
    color: MUTED,
    maxWidth: 280,
  });
  if (idioma === 'es-en') {
    drawText(page, `"${taglineEn}"`, {
      x: 40,
      top: 106,
      size: 8,
      font,
      color: MUTED,
      maxWidth: 280,
    });
  }

  // N° / Fecha (derecha, número corto estilo boceto)
  const numeroVisible = displayQuoteNumero(snapshot.numero);
  drawRight(page, `${et('N°', 'No.')}: ${numeroVisible}`, {
    right: 536,
    top: 97,
    size: 12,
    font,
    maxWidth: 160,
  });
  drawRight(page, `${et('Fecha', 'Date')}: ${fecha}`, {
    right: 536,
    top: 115,
    size: 12,
    font,
    maxWidth: 160,
  });

  // CLIENTE — solo datos del cliente. Vacío o dato de I-ME se imprime como «—».
  const leftColW = 310;
  const clienteCampos: Array<[string, string]> = [
    [et('Razón social', 'Company'), textoCliente(snapshot.empresa, 'razon')],
    [et('NIT', 'Tax ID'), textoCliente(snapshot.nitCliente, 'nit')],
    [et('Contacto', 'Contact'), textoCliente(snapshot.clienteNombre, 'texto')],
    [et('Correo', 'Email'), textoCliente(snapshot.email, 'email')],
    [et('Teléfono', 'Phone'), textoCliente(snapshot.telefono, 'telefono')],
    [et('Dirección', 'Address'), textoCliente(snapshot.direccionCliente, 'texto')],
    [et('Ciudad', 'City'), textoCliente(snapshot.ciudadCliente, 'texto')],
    [et('País', 'Country'), textoCliente(snapshot.paisCliente, 'texto')],
  ];
  drawText(page, et('CLIENTE', 'CLIENT'), {
    x: 58.3,
    top: 142.8,
    size: 11,
    font: bold,
    color: BLUE,
  });
  let ry = 156;
  for (const [etiqueta, valor] of clienteCampos) {
    const lineasCampo = wrapByWidth(`${etiqueta}: ${valor}`, font, 9, leftColW).slice(0, 2);
    for (const linea of lineasCampo) {
      drawText(page, linea, { x: 59.5, top: ry, size: 9, font, maxWidth: leftColW });
      ry += 12;
    }
  }

  // Condición / medio de pago (derecha). Los títulos bilingües bajan de línea, no se cortan.
  const pagoX = 385;
  const pagoW = 175;
  const drawPagoTitulo = (texto: string, top: number): number => {
    const lineas = (
      texto.includes(' / ') ? texto.split(' / ') : wrapByWidth(texto, bold, 9, pagoW)
    ).slice(0, 2);
    lineas.forEach((linea, index) => {
      drawText(page, linea, {
        x: pagoX,
        top: top + index * 11,
        size: 9,
        font: bold,
        color: BLUE,
      });
    });
    return top + Math.max(1, lineas.length) * 11;
  };
  let pagoY = drawPagoTitulo(et('CONDICIÓN DE PAGO', 'PAYMENT TERMS'), 150);
  const condicionEs = snapshot.condicionPago?.trim() || '';
  const condicionEn = snapshot.condicionPagoEn?.trim() || '';
  // El texto libre del usuario no se traduce. «Contado / Prepaid» solo si no escribió condición.
  const condicion =
    idioma === 'es-en'
      ? condicionEs && condicionEn
        ? `${condicionEs}\n${condicionEn}`
        : condicionEs || condicionEn || 'Contado\nPrepaid'
      : idioma === 'en'
        ? condicionEn || condicionEs || 'Prepaid'
        : condicionEs || 'Contado';
  const condicionLines = condicion
    .split('\n')
    .flatMap(linea => wrapByWidth(linea, font, 9, pagoW))
    .slice(0, 4);
  condicionLines.forEach((line, index) => {
    drawText(page, line, {
      x: pagoX,
      top: pagoY + 2 + index * 11,
      size: 9,
      font,
    });
  });
  pagoY = pagoY + 2 + condicionLines.length * 11 + 6;
  const medioTop = drawPagoTitulo(et('MEDIO DE PAGO', 'PAYMENT METHOD'), pagoY);
  const bancoVisible = banco.map(linea =>
    linea.trim() === 'Transferencia bancaria:'
      ? et('Transferencia bancaria:', 'Bank transfer:')
      : linea
  );
  const bancoLines = bancoVisible
    .flatMap(line => {
      const partes = idioma === 'es-en' && line.includes(' / ') ? line.split(' / ') : [line];
      return partes.flatMap(parte => wrapByWidth(parte, font, 9, pagoW));
    })
    .slice(0, 8);
  let py = medioTop + 2;
  for (const line of bancoLines) {
    drawText(page, line, { x: 385, top: py, size: 9, font, maxWidth: 175 });
    py += 12;
  }
  const wompiUrl = snapshot.wompiUrl?.trim() ?? '';
  if (wompiUrl.startsWith('https://') && snapshot.moneda === 'COP') {
    const wompiLabel = et('Pagar con Wompi', 'Pay with Wompi');
    drawText(page, wompiLabel, {
      x: 385,
      top: py,
      size: 10,
      font: bold,
      color: BLUE,
      maxWidth: 175,
    });
    anotarEnlace(page, wompiLabel, wompiUrl, { x: 385, top: py, size: 10, font: bold });
    py += 14;
  }

  // Emisor: razón social, NIT, teléfono, correo y web de I-ME. Nunca en el bloque del cliente.
  const companyTop = ry + 10;
  drawText(page, et('EMISOR', 'ISSUER'), {
    x: 59.5,
    top: companyTop,
    size: 10,
    font: bold,
    color: BLUE,
    maxWidth: leftColW,
  });
  const emisorLineas = [
    IME_RAZON_SOCIAL,
    `NIT: ${IME_NIT}`,
    `${et('Teléfono', 'Phone')}: ${IME_WHATSAPP_DISPLAY}`,
    `${et('Correo', 'Email')}: ${IME_EMAIL_PUBLICO}`,
    `${et('Web', 'Web')}: ${IME_WEB}`,
    'Medellín, Colombia',
  ];
  let companyBottom = companyTop + 14;
  emisorLineas.forEach((linea, index) => {
    drawText(page, linea, {
      x: 59.5,
      top: companyTop + 14 + index * 12,
      size: 9,
      font: index === 0 ? bold : font,
      color: index === 0 ? BLUE : INK,
      maxWidth: leftColW,
    });
    companyBottom = companyTop + 14 + index * 12 + 12;
  });
  if (snapshot.nombreComercial) {
    drawText(page, `${et('Asesor', 'Advisor')}: ${snapshot.nombreComercial}`, {
      x: 59.5,
      top: companyBottom,
      size: 9,
      font,
      color: MUTED,
      maxWidth: leftColW,
    });
    companyBottom += 12;
  }

  // ——— Tabla de líneas (paginada) + recuadro de precios ———
  // Todas las líneas van dentro de la tabla. La altura de cada fila se calcula según su
  // contenido (descripción + resumen de especificaciones); si una fila no cabe, la tabla
  // continúa en una página nueva repitiendo la cabecera. El recuadro de totales y las notas
  // se dibujan justo después de la última fila (en página nueva solo si no caben).
  const tableLeft = 27;
  const tableRight = 568;
  const firstTableTop = Math.max(companyBottom + 16, py + 10, 270);
  const contTableTop = 60;
  const headerH = idioma === 'es-en' ? 46 : 36;
  // CANT más ancha: "50,000" / "50.000" (Poppins 11) no cabe en 26 px.
  const colXs = [tableLeft, 108, 208, 372, 462, tableRight];
  const unitRight = colXs[4]! - 8;
  const totalRight = tableRight - 8;
  const descMaxW = colXs[3]! - colXs[2]! - 10;
  const refMaxW = colXs[2]! - colXs[1]! - 8;
  const footerGuard = 780;
  const rowMinH = 40;
  const descLineH = 13;
  const resumenLineH = 10;
  const RESUMEN_MAX_LINEAS = 8;

  const newPage = (): PDFPage => {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
    return p;
  };

  const drawTableHeader = (p: PDFPage, top: number): void => {
    p.drawRectangle({
      x: tableLeft,
      y: topY(top + headerH),
      width: tableRight - tableLeft,
      height: headerH,
      color: BLUE,
    });
    const headerLabels: Array<[number, string, string]> =
      idioma === 'en'
        ? [
            [36, 'QTY', ''],
            [116, 'REF', ''],
            [219, 'DESCRIPTION', ''],
          ]
        : idioma === 'es-en'
          ? [
              [36, 'CANT', 'QTY'],
              [116, 'REF', 'REF'],
              [219, 'DESCRIPCIÓN', 'DESCRIPTION'],
            ]
          : [
              [36, 'CANT', ''],
              [116, 'REF', ''],
              [219, 'DESCRIPCIÓN', ''],
            ];
    for (const [x, label, secundario] of headerLabels) {
      drawText(p, label, {
        x: Number(x),
        top: top + (secundario && secundario !== label ? 8 : 12),
        size: secundario && secundario !== label ? 9 : 11,
        font: bold,
        color: WHITE,
      });
      if (secundario && secundario !== label) {
        drawText(p, secundario, {
          x: Number(x),
          top: top + 20,
          size: 8,
          font,
          color: WHITE,
        });
      }
    }
    drawRight(p, idioma === 'en' ? 'UNIT' : 'PRECIO UNIT', {
      right: unitRight,
      top: top + (idioma === 'es-en' ? 8 : 12),
      size: idioma === 'es-en' ? 8 : 10,
      font: bold,
      color: WHITE,
      maxWidth: 78,
    });
    if (idioma === 'es-en') {
      drawRight(p, 'UNIT PRICE', {
        right: unitRight,
        top: top + 20,
        size: 7,
        font,
        color: WHITE,
        maxWidth: 78,
      });
    }
    drawRight(p, 'TOTAL', {
      right: totalRight,
      top: top + (idioma === 'es-en' ? 8 : 12),
      size: 11,
      font: bold,
      color: WHITE,
      maxWidth: 70,
    });
  };

  /** Rejilla de un tramo de tabla: verticales + una horizontal por cada límite de fila. */
  const drawGrid = (p: PDFPage, rowEdges: number[]): void => {
    if (rowEdges.length < 2) return;
    const gTop = rowEdges[0]!;
    const gBottom = rowEdges[rowEdges.length - 1]!;
    for (const x of colXs) {
      p.drawLine({
        start: { x, y: topY(gBottom) },
        end: { x, y: topY(gTop) },
        thickness: 1,
        color: LINE,
      });
    }
    for (const y of rowEdges) {
      p.drawLine({
        start: { x: tableLeft, y: topY(y) },
        end: { x: tableRight, y: topY(y) },
        thickness: 1,
        color: LINE,
      });
    }
  };

  const refLineH = 11;
  /** Código corto (SKU) o el nombre completo, en castellano y en inglés, sin puntos suspensivos. */
  const lineasReferencia = (item: CotizacionLineaOferta): string[] => {
    const slug = item.slug?.trim() ?? '';
    const nombre = item.nombre?.trim() ?? '';
    const nombreEn = item.nombre_en?.trim() ?? '';
    const igual = (a: string, b: string) =>
      a.length > 0 && a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');
    const esCodigo =
      slug.length > 0 && !igual(slug, nombre) && !igual(slug, nombreEn) && !/\s/.test(slug);
    if (esCodigo) {
      const trozos = slug.split('-');
      const lineas: string[] = [];
      let actual = '';
      trozos.forEach((trozo, indice) => {
        const pieza = indice < trozos.length - 1 ? `${trozo}-` : trozo;
        const siguiente = actual ? `${actual}${pieza}` : pieza;
        if (font.widthOfTextAtSize(winAnsi(siguiente), 9) <= refMaxW) {
          actual = siguiente;
          return;
        }
        if (actual) lineas.push(actual);
        actual = pieza;
      });
      if (actual) lineas.push(actual);
      return lineas.length > 0 ? lineas : [slug];
    }
    const base = nombre || slug;
    const partes: string[] = [];
    if (idioma === 'en') partes.push(nombreEn || base || '—');
    else {
      if (base) partes.push(base);
      if (idioma === 'es-en' && nombreEn && !igual(nombreEn, base)) partes.push(nombreEn);
      if (partes.length === 0) partes.push('—');
    }
    return partes.flatMap(parte => wrapByWidth(parte, font, 9, refMaxW));
  };

  const filas = snapshot.lineas.map(item => {
    const nombreEs = item.nombre || item.slug || (idioma === 'en' ? 'Product' : 'Producto');
    const nombreEn = item.nombre_en?.trim() ?? '';
    const partesNombre = [nombreEs];
    if (idioma === 'es-en' && nombreEn && nombreEn.toLowerCase() !== nombreEs.toLowerCase()) {
      partesNombre.push(nombreEn);
    }
    const descLines = partesNombre
      .flatMap(parte => wrapByWidth(parte, font, 10, descMaxW).slice(0, 3))
      .slice(0, 5);
    const notasEn =
      idioma === 'es-en' &&
      item.notas_en?.trim() &&
      item.notas_en.trim() !== (item.notas ?? '').trim()
        ? lineasDeResumen(item.notas_en)
        : [];
    const resumenLineas = [...lineasDeResumen(item.notas), ...notasEn]
      .flatMap(linea => wrapByWidth(`• ${linea}`, font, 8, descMaxW).slice(0, 2))
      .slice(0, RESUMEN_MAX_LINEAS);
    const refLines = lineasReferencia(item);
    const contentH =
      10 +
      descLines.length * descLineH +
      (resumenLineas.length > 0 ? 2 + resumenLineas.length * resumenLineH : 0) +
      8;
    const refH = 10 + refLines.length * refLineH + 8;
    return {
      item,
      descLines,
      resumenLineas,
      refLines,
      h: Math.max(rowMinH, Math.ceil(contentH), Math.ceil(refH)),
    };
  });

  const drawRow = (p: PDFPage, fila: (typeof filas)[number], rowTop: number): void => {
    const { item, descLines, resumenLineas, refLines } = fila;
    const cant = formatCantidad(Number(item.cantidad) || 0, localeNumero);
    const pendiente = Boolean(item.precio_pendiente_validar);
    const textTop = rowTop + (descLines.length > 1 ? 10 : 14);
    const qtyX = colXs[0]! + 9;
    const refX = colXs[1]! + 8;
    const descX = colXs[2]! + 11;
    drawText(p, cant, {
      x: qtyX,
      top: textTop,
      size: 11,
      font,
      maxWidth: colXs[1]! - qtyX - 6,
    });
    refLines.forEach((linea, i) => {
      drawText(p, linea, { x: refX, top: rowTop + 10 + i * refLineH, size: 9, font });
    });
    descLines.forEach((line, i) => {
      drawText(p, line, {
        x: descX,
        top: rowTop + 10 + i * descLineH,
        size: 10,
        font,
        maxWidth: descMaxW,
      });
    });
    const resumenTop = rowTop + 10 + descLines.length * descLineH + 2;
    resumenLineas.forEach((linea, i) => {
      drawText(p, linea, {
        x: descX,
        top: resumenTop + i * resumenLineH,
        size: 8,
        font,
        maxWidth: descMaxW,
      });
    });
    const pendLabel = et('Pendiente', 'Pending');
    drawRight(
      p,
      pendiente ? pendLabel : moneyPlain(item.precio_unitario, snapshot.moneda, localeNumero),
      { right: unitRight, top: textTop, size: pendiente ? 9 : 10, font, maxWidth: 74 }
    );
    drawRight(p, pendiente ? pendLabel : moneyPlain(item.subtotal, snapshot.moneda, localeNumero), {
      right: totalRight,
      top: textTop,
      size: pendiente ? 9 : 10,
      font,
      maxWidth: 86,
    });
  };

  const drawContinuationTitle = (p: PDFPage): void => {
    drawText(
      p,
      idioma === 'en'
        ? `Quotation No. ${numeroVisible} (continued)`
        : idioma === 'es-en'
          ? `Cotización / Quotation N° ${numeroVisible}`
          : `Cotización N° ${numeroVisible} (continuación)`,
      { x: tableLeft, top: 32, size: 11, font: bold, color: BLUE, maxWidth: 500 }
    );
  };

  // Altura del bloque de totales. La última fila no debe quedarse sola en la página siguiente.
  const totalsBlockH = 16 + 20 + 23 * 4 + 8;
  const tramos: Array<{ items: typeof filas; tableTop: number }> = [];
  if (filas.length === 0) {
    tramos.push({ items: [], tableTop: firstTableTop });
  } else {
    let index = 0;
    let primero = true;
    while (index < filas.length) {
      const tableTop = primero ? firstTableTop : contTableTop;
      const start = index;
      let y = tableTop + headerH;
      while (index < filas.length) {
        const fila = filas[index]!;
        const colocadas = index - start;
        const noCabe = y + fila.h > footerGuard;
        const esUltima = index === filas.length - 1;
        const totalHuerfano =
          esUltima && !noCabe && y + fila.h + totalsBlockH > footerGuard && colocadas >= 2;
        if (colocadas > 0 && (noCabe || totalHuerfano)) break;
        y += fila.h;
        index += 1;
      }
      let end = index;
      if (filas.length - end === 1 && end - start >= 2) {
        end -= 1;
        index = end;
      }
      if (end === start) {
        end = start + 1;
        index = end;
      }
      tramos.push({ items: filas.slice(start, end), tableTop });
      primero = false;
    }
  }

  let gridBottom = firstTableTop + headerH;
  tramos.forEach((tramo, indice) => {
    if (indice > 0) {
      drawFooterBar(page, font, whatsappIcon);
      page = newPage();
      drawContinuationTitle(page);
    }
    drawTableHeader(page, tramo.tableTop);
    let cursorY = tramo.tableTop + headerH;
    const rowEdges = [cursorY];
    for (const fila of tramo.items) {
      drawRow(page, fila, cursorY);
      cursorY += fila.h;
      rowEdges.push(cursorY);
    }
    if (tramo.items.length === 0) {
      cursorY += rowMinH;
      rowEdges.push(cursorY);
    }
    drawGrid(page, rowEdges);
    gridBottom = cursorY;
  });

  // Totales (recuadro flush con columnas PRECIO/TOTAL) + NOTAS, justo después de la última fila
  const boxRight = tableRight;
  const boxLeft = colXs[3]!;
  const boxWidth = boxRight - boxLeft;
  const totRowH = 23;
  const totRows = 4;
  const boxPadY = 10;
  const boxPadX = 14;
  const boxH = boxPadY * 2 + totRowH * totRows;
  let totalsTop = gridBottom + 16;
  if (totalsTop + boxH > footerGuard - 8) {
    drawFooterBar(page, font, whatsappIcon);
    page = newPage();
    drawContinuationTitle(page);
    totalsTop = contTableTop;
  }
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
      label: et('TOTAL BRUTO', 'GROSS TOTAL'),
      value: moneyPlain(subtotal, snapshot.moneda, localeNumero),
    },
    {
      label: 'SUBTOTAL',
      value: moneyPlain(subtotal, snapshot.moneda, localeNumero),
    },
    {
      label: etiquetaIva,
      value: moneyPlain(iva, snapshot.moneda, localeNumero),
    },
    {
      label: et('TOTAL A PAGAR', 'TOTAL DUE'),
      value: moneyCash(totalPagar, snapshot.moneda, localeNumero),
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
    const partes =
      idioma === 'es-en' && row.label.includes(' / ') ? row.label.split(' / ') : [row.label];
    const etiquetaSize = partes.length > 1 ? 8 : 10;
    const etiquetaTop = partes.length > 1 ? textTop - 2 : textTop;
    const valorSize = partes.length > 1 ? (row.emphasize ? 10 : 9) : row.emphasize ? 11 : 10;
    if (partes.length > 1) {
      drawText(page, partes[0] ?? '', {
        x: boxLeft + boxPadX,
        top: etiquetaTop,
        size: etiquetaSize,
        font: bold,
        color: row.emphasize ? BLUE : INK,
      });
      drawText(page, partes[1] ?? '', {
        x: boxLeft + boxPadX,
        top: textTop + 8,
        size: 7,
        font,
        color: row.emphasize ? BLUE : INK,
      });
    } else {
      drawText(page, row.label, {
        x: boxLeft + boxPadX,
        top: etiquetaTop,
        size: etiquetaSize,
        font: bold,
        color: row.emphasize ? BLUE : INK,
        maxWidth: 120,
      });
    }
    // Misma línea de base que la etiqueta principal. El importe no baja entre los dos idiomas.
    const valorTop = etiquetaTop + (etiquetaSize - valorSize) * 0.78;
    drawRight(page, row.value, {
      right: boxRight - boxPadX,
      top: valorTop,
      size: valorSize,
      font: row.emphasize ? bold : font,
      color: row.emphasize ? BLUE : INK,
      maxWidth: 110,
    });
  });

  const validezLabel = snapshot.validezHasta
    ? (() => {
        const m = String(snapshot.validezHasta).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : snapshot.validezHasta;
      })()
    : null;
  drawText(page, et('NOTAS', 'NOTES'), {
    x: tableLeft,
    top: totalsTop + 4,
    size: 11,
    font: bold,
  });
  const notaValidezEs = validezLabel
    ? `Válida hasta el ${validezLabel}. Posterior a esta fecha, los precios y tiempos de entrega podrán estar sujetos a revisión según condiciones de mercado.`
    : snapshot.condiciones.slice(0, 280) ||
      'Precios sujetos a revisión según condiciones de mercado.';
  const notaValidezEn = validezLabel
    ? `Valid until ${validezLabel}. After this date prices and lead times may change.`
    : 'Prices subject to change according to market conditions.';
  let note =
    idioma === 'en'
      ? notaValidezEn
      : idioma === 'es-en'
        ? `${notaValidezEs} ${notaValidezEn}`
        : notaValidezEs;
  if (snapshot.moneda === 'USD') {
    const notasUsd =
      idioma === 'es-en'
        ? `${notaImportesUsd('es')} ${notaImportesUsd('en')}`
        : notaImportesUsd(idioma === 'en' ? 'en' : 'es');
    if (!note.includes(notaImportesUsd(idioma === 'en' ? 'en' : 'es')))
      note = `${note} ${notasUsd}`;
  }
  drawLeftParagraph(page, note, {
    x: tableLeft,
    top: totalsTop + 22,
    size: 9,
    font,
    maxWidth: Math.max(120, boxLeft - tableLeft - 16),
    lineHeight: 12,
    color: MUTED,
    maxLines: snapshot.moneda === 'USD' ? 8 : 5,
  });

  drawFooterBar(page, font, whatsappIcon);

  // ——— Página consideraciones (boceto IPS p.2) ———
  page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
  drawCentered(
    page,
    idioma === 'es-en'
      ? 'Consideraciones de la oferta / Offer considerations'
      : idioma === 'en'
        ? 'Offer considerations'
        : 'Consideraciones de la oferta',
    {
      top: 56,
      size: idioma === 'es-en' ? 12 : 14,
      font: bold,
      color: BLUE,
      maxWidth: 500,
    }
  );
  let cy = 88;
  const partirBloques = (texto: string) =>
    texto
      .replace(/\r\n/g, '\n')
      .split(/\n+/)
      .map(s => s.trim())
      .filter(Boolean);
  const terminosEs = partirBloques(
    resolveCondicionesOferta(
      aplicarNotaImportesUsd(snapshot.condiciones, snapshot.moneda, 'es'),
      'es'
    )
  ).map(texto => ({ texto, headingLocale: 'es' as const }));
  const terminosEnLibre = snapshot.condicionesEn?.trim()
    ? partirBloques(aplicarNotaImportesUsd(snapshot.condicionesEn, snapshot.moneda, 'en')).map(
        texto => ({ texto, headingLocale: 'en' as const })
      )
    : [];
  const notaEnSuelta =
    snapshot.moneda === 'USD' &&
    !terminosEs.some(b => b.texto.includes(notaImportesUsd('en'))) &&
    !terminosEnLibre.some(b => b.texto.includes(notaImportesUsd('en')))
      ? [{ texto: notaImportesUsd('en'), headingLocale: 'en' as const }]
      : [];
  const columnasBilingues = idioma === 'es-en' && terminosEnLibre.length > 0;
  const termBlocks = columnasBilingues
    ? []
    : idioma === 'en'
      ? partirBloques(
          resolveCondicionesOferta(
            aplicarNotaImportesUsd(
              snapshot.condicionesEn?.trim() || snapshot.condiciones,
              snapshot.moneda,
              'en'
            ),
            'en'
          )
        ).map(texto => ({ texto, headingLocale: 'en' as const }))
      : idioma === 'es-en'
        ? [
            ...terminosEs,
            ...(terminosEnLibre.length === 0 && !String(snapshot.condiciones ?? '').trim()
              ? notaEnSuelta
              : []),
            ...(String(snapshot.condiciones ?? '').trim() ? notaEnSuelta : []),
          ]
        : terminosEs;
  if (columnasBilingues) {
    const colW = 250;
    const leftX = 40;
    const rightX = leftX + colW + 16;
    const maxLineas = 58;
    type LineaCol = { text: string; bold: boolean; size: number };
    const lineasBloque = (bloque: { texto: string; headingLocale: 'es' | 'en' }): LineaCol[] => {
      const heading = isCondicionesSectionHeading(bloque.texto, bloque.headingLocale);
      const size = heading ? 9 : 8;
      const fuente = heading ? bold : font;
      return wrapByWidth(bloque.texto, fuente, size, colW).map(text => ({
        text,
        bold: heading,
        size,
      }));
    };
    const pares: Array<{ izq?: LineaCol; der?: LineaCol }> = [];
    const columnaEn = [...terminosEnLibre, ...notaEnSuelta];
    const bloques = Math.max(terminosEs.length, columnaEn.length);
    for (let indice = 0; indice < bloques; indice += 1) {
      const izquierdas = terminosEs[indice] ? lineasBloque(terminosEs[indice]) : [];
      const derechas = columnaEn[indice] ? lineasBloque(columnaEn[indice]) : [];
      const alto = Math.max(izquierdas.length, derechas.length, 1);
      for (let linea = 0; linea < alto; linea += 1) {
        const fila: { izq?: LineaCol; der?: LineaCol } = {};
        const izq = izquierdas[linea];
        const der = derechas[linea];
        if (izq) fila.izq = izq;
        if (der) fila.der = der;
        pares.push(fila);
      }
      pares.push({});
    }
    const paginas: Array<typeof pares> = [];
    let cursor = 0;
    while (cursor < pares.length) {
      let take = Math.min(maxLineas, pares.length - cursor);
      const ultimo = pares[cursor + take - 1];
      if (cursor + take < pares.length && take > 1 && (ultimo?.izq?.bold || ultimo?.der?.bold)) {
        take -= 1;
      }
      paginas.push(pares.slice(cursor, cursor + take));
      cursor += take;
    }
    paginas.forEach((filasCol, indice) => {
      if (indice > 0) {
        drawFooterBar(page, font, whatsappIcon);
        page = doc.addPage([PAGE_W, PAGE_H]);
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
        drawCentered(page, 'Consideraciones de la oferta / Offer considerations (cont.)', {
          top: 56,
          size: 12,
          font: bold,
          color: BLUE,
          maxWidth: 500,
        });
      }
      filasCol.forEach((fila, numero) => {
        const top = 88 + numero * 11;
        if (fila.izq?.text) {
          drawText(page, fila.izq.text, {
            x: leftX,
            top,
            size: fila.izq.size,
            font: fila.izq.bold ? bold : font,
            color: fila.izq.bold ? BLUE : INK,
          });
        }
        if (fila.der?.text) {
          drawText(page, fila.der.text, {
            x: rightX,
            top,
            size: fila.der.size,
            font: fila.der.bold ? bold : font,
            color: fila.der.bold ? BLUE : INK,
          });
        }
      });
    });
  }
  const ensureCondPage = () => {
    if (cy <= 750) return;
    drawFooterBar(page, font, whatsappIcon);
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: WHITE });
    drawCentered(
      page,
      idioma === 'en'
        ? 'Offer considerations (cont.)'
        : idioma === 'es-en'
          ? 'Consideraciones de la oferta / Offer considerations (cont.)'
          : 'Consideraciones de la oferta (cont.)',
      { top: 56, size: 12, font: bold, color: BLUE, maxWidth: 500 }
    );
    cy = 88;
  };
  for (const bloque of termBlocks) {
    const block = bloque.texto;
    ensureCondPage();
    if (isCondicionesSectionHeading(block, bloque.headingLocale)) {
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
    cy = drawLeftParagraph(page, block, {
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
  // Sin ficha, o con ficha sin descripción larga ni specs, no se abre página.
  for (const annex of snapshot.annexes ?? []) {
    if (!quoteAnnexHasSpecContent(annex)) continue;
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
      ay = drawLeftParagraph(page, body, {
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
      drawText(page, et('Características Inteligentes:', 'Smart features:'), {
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

function anotarEnlace(
  page: PDFPage,
  label: string,
  url: string,
  opts: { x: number; top: number; size: number; font: PDFFont }
): void {
  const text = winAnsi(label);
  const width = Math.min(opts.font.widthOfTextAtSize(text, opts.size), 175);
  const baseline = topY(opts.top + opts.size * 0.78);
  const annot = page.doc.context.register(
    page.doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [opts.x, baseline - 2, opts.x + Math.max(width, 40), baseline + opts.size],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(url),
      },
    })
  );
  page.node.set(PDFName.of('Annots'), page.doc.context.obj([annot]));
}

function drawFooterBar(page: PDFPage, font: PDFFont, whatsappIcon: PDFImage | null): void {
  // Boceto footer bar y≈790–830, fill = mismo azul header
  page.drawRectangle({
    x: 46.4,
    y: topY(829.8),
    width: 520,
    height: 39.4,
    color: BLUE,
  });
  page.drawText(winAnsi('i-me.com.co'), {
    x: 88.6,
    y: topY(812),
    size: 11,
    font,
    color: WHITE,
  });

  const phone = '+57 313 724 7353';
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
