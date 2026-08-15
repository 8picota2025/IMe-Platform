/**
 * PDF Presupuesto I-ME — layout alineado a plantilla comercial IPS.pdf
 * (cotización + consideraciones + anexo fichas/resumen de productos).
 */
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import type { CotizacionLineaOferta } from './cotizacion-oferta';

export interface QuotePdfAnnex {
  slug: string;
  nombre: string;
  sku?: string | null;
  resumen: string;
  url?: string | null;
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
  /** IVA % sobre subtotal. Default 19 COP / 0 USD. */
  ivaPct?: number | null;
  tagline?: string | null;
  annexes?: QuotePdfAnnex[];
  logoBytes?: Uint8Array | null;
  fecha?: string | null;
}

const TEAL = rgb(0 / 255, 94 / 255, 96 / 255);
const INK = rgb(0.08, 0.12, 0.12);
const MUTED = rgb(0.35, 0.4, 0.4);
const LINE = rgb(0.82, 0.86, 0.86);
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const MAX_BYTES = 8 * 1024 * 1024;
const FOOTER_Y = 36;

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
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max) {
      if (cur) lines.push(cur);
      cur = w.length > max ? w.slice(0, max) : w;
    } else {
      cur = next;
    }
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

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  logo: PDFImage | null;
  locale: 'es' | 'en';
  tagline: string;
}

function drawFooter(page: PDFPage, font: PDFFont): void {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_Y + 14 },
    end: { x: PAGE_W - MARGIN, y: FOOTER_Y + 14 },
    thickness: 0.6,
    color: LINE,
  });
  page.drawText(winAnsi('www.i-me.com.co   ·   info@i-me.com.co   ·   +57 313 867 4059'), {
    x: MARGIN,
    y: FOOTER_Y,
    size: 8,
    font,
    color: MUTED,
  });
}

function drawHeader(ctx: Ctx): void {
  const { page, logo, font, bold, locale, tagline } = ctx;
  if (logo) {
    const maxH = 42;
    const scale = maxH / logo.height;
    const w = logo.width * scale;
    page.drawImage(logo, { x: MARGIN, y: PAGE_H - 58, width: w, height: maxH });
  } else {
    page.drawText(winAnsi('I-ME'), {
      x: MARGIN,
      y: PAGE_H - 42,
      size: 18,
      font: bold,
      color: TEAL,
    });
  }
  page.drawText(winAnsi(locale === 'en' ? 'QUOTATION' : 'COTIZACION'), {
    x: PAGE_W - MARGIN - 120,
    y: PAGE_H - 38,
    size: 16,
    font: bold,
    color: TEAL,
  });
  page.drawText(winAnsi(`"${tagline}"`), {
    x: PAGE_W - MARGIN - 220,
    y: PAGE_H - 54,
    size: 7,
    font,
    color: MUTED,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - 68 },
    end: { x: PAGE_W - MARGIN, y: PAGE_H - 68 },
    thickness: 1,
    color: TEAL,
  });
  ctx.y = PAGE_H - 86;
}

function newPage(ctx: Ctx): void {
  drawFooter(ctx.page, ctx.font);
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  drawHeader(ctx);
}

function ensure(ctx: Ctx, need: number): void {
  if (ctx.y < 64 + need) newPage(ctx);
}

function drawTableHeader(ctx: Ctx): void {
  const { page, bold, locale } = ctx;
  const y = ctx.y;
  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: PAGE_W - MARGIN * 2,
    height: 18,
    color: rgb(0.93, 0.96, 0.96),
  });
  const cols =
    locale === 'en'
      ? [
          [MARGIN + 2, 'REF'],
          [MARGIN + 70, 'DESCRIPTION'],
          [MARGIN + 320, 'QTY'],
          [MARGIN + 360, 'UNIT'],
          [MARGIN + 450, 'TOTAL'],
        ]
      : [
          [MARGIN + 2, 'REF'],
          [MARGIN + 70, 'DESCRIPCION'],
          [MARGIN + 320, 'CANT'],
          [MARGIN + 360, 'P.UNIT'],
          [MARGIN + 450, 'TOTAL'],
        ];
  for (const [x, label] of cols) {
    page.drawText(winAnsi(String(label)), {
      x: Number(x),
      y,
      size: 8,
      font: bold,
      color: TEAL,
    });
  }
  ctx.y = y - 22;
}

export async function renderQuotePdf(snapshot: QuotePdfSnapshot): Promise<Uint8Array> {
  const locale = snapshot.locale === 'en' ? 'en' : 'es';
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
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
  const subtotal = snapshot.lineas.reduce((acc, l) => acc + (Number(l.subtotal) || 0), 0);
  const iva = Math.round(subtotal * (ivaPct / 100) * 100) / 100;
  const totalPagar = Math.round((subtotal + iva) * 100) / 100;
  const fecha = snapshot.fecha?.trim() || todayLabel(locale);
  const tagline =
    snapshot.tagline?.trim() ||
    (locale === 'en'
      ? 'Equipping your mission to save lives'
      : 'Equipando tu mision de salvar vidas');
  const banco =
    snapshot.bancoLineas && snapshot.bancoLineas.length > 0
      ? snapshot.bancoLineas
      : [
          'Transferencia bancaria',
          'Bancolombia / Ahorros',
          'Cuenta: configurar secrets TRANSFERENCIA_*',
        ];

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: 0,
    font,
    bold,
    logo,
    locale,
    tagline,
  };
  drawHeader(ctx);

  // Meta / receptor
  const metaTop = ctx.y;
  ctx.page.drawText(winAnsi(`${locale === 'en' ? 'No.' : 'N°'}: ${snapshot.numero}`), {
    x: PAGE_W - MARGIN - 160,
    y: metaTop,
    size: 10,
    font: bold,
    color: INK,
  });
  ctx.page.drawText(winAnsi(`${locale === 'en' ? 'Date' : 'Fecha'}: ${fecha}`), {
    x: PAGE_W - MARGIN - 160,
    y: metaTop - 14,
    size: 9,
    font,
    color: MUTED,
  });

  let leftY = metaTop;
  ctx.page.drawText(winAnsi(locale === 'en' ? 'RECIPIENT:' : 'RECEPTOR:'), {
    x: MARGIN,
    y: leftY,
    size: 9,
    font: bold,
    color: TEAL,
  });
  leftY -= 13;
  ctx.page.drawText(winAnsi(snapshot.clienteNombre || '—').slice(0, 60), {
    x: MARGIN,
    y: leftY,
    size: 10,
    font: bold,
    color: INK,
  });
  leftY -= 12;
  if (snapshot.empresa) {
    ctx.page.drawText(winAnsi(snapshot.empresa).slice(0, 60), {
      x: MARGIN,
      y: leftY,
      size: 9,
      font,
      color: INK,
    });
    leftY -= 11;
  }
  if (snapshot.nitCliente) {
    ctx.page.drawText(winAnsi(`NIT: ${snapshot.nitCliente}`), {
      x: MARGIN,
      y: leftY,
      size: 9,
      font,
      color: MUTED,
    });
    leftY -= 11;
  }
  if (snapshot.email) {
    ctx.page.drawText(winAnsi(snapshot.email).slice(0, 60), {
      x: MARGIN,
      y: leftY,
      size: 8,
      font,
      color: MUTED,
    });
    leftY -= 11;
  }
  if (snapshot.telefono) {
    ctx.page.drawText(winAnsi(snapshot.telefono).slice(0, 40), {
      x: MARGIN,
      y: leftY,
      size: 8,
      font,
      color: MUTED,
    });
    leftY -= 11;
  }
  leftY -= 8;
  ctx.page.drawText(winAnsi('INTERNATIONAL MEDICAL ENTERPRISE'), {
    x: MARGIN,
    y: leftY,
    size: 8,
    font: bold,
    color: TEAL,
  });
  leftY -= 11;
  ctx.page.drawText(winAnsi('NIT: 901871720 · Medellin'), {
    x: MARGIN,
    y: leftY,
    size: 8,
    font,
    color: MUTED,
  });
  leftY -= 11;
  if (snapshot.nombreComercial) {
    ctx.page.drawText(winAnsi(`Asesor: ${snapshot.nombreComercial}`).slice(0, 70), {
      x: MARGIN,
      y: leftY,
      size: 8,
      font,
      color: MUTED,
    });
    leftY -= 11;
  }
  ctx.y = Math.min(leftY, metaTop - 28) - 12;

  drawTableHeader(ctx);
  for (const item of snapshot.lineas) {
    const ref = (item.slug || item.nombre || '—').slice(0, 18);
    const nameLines = wrapText(item.nombre || item.slug || 'Producto', 42).slice(0, 3);
    const rowH = Math.max(16, nameLines.length * 11 + 6);
    ensure(ctx, rowH + 8);
    const y = ctx.y;
    ctx.page.drawText(winAnsi(ref), { x: MARGIN + 2, y: y - 2, size: 8, font, color: INK });
    let ty = y - 2;
    for (const line of nameLines) {
      ctx.page.drawText(winAnsi(line), { x: MARGIN + 70, y: ty, size: 8, font, color: INK });
      ty -= 11;
    }
    ctx.page.drawText(String(item.cantidad), {
      x: MARGIN + 325,
      y: y - 2,
      size: 8,
      font,
      color: INK,
    });
    ctx.page.drawText(winAnsi(money(item.precio_unitario, snapshot.moneda, locale)), {
      x: MARGIN + 360,
      y: y - 2,
      size: 8,
      font,
      color: INK,
    });
    ctx.page.drawText(winAnsi(money(item.subtotal, snapshot.moneda, locale)), {
      x: MARGIN + 450,
      y: y - 2,
      size: 8,
      font,
      color: INK,
    });
    ctx.page.drawLine({
      start: { x: MARGIN, y: y - rowH + 4 },
      end: { x: PAGE_W - MARGIN, y: y - rowH + 4 },
      thickness: 0.4,
      color: LINE,
    });
    ctx.y = y - rowH;
  }

  ensure(ctx, 160);
  ctx.y -= 10;
  const labelX = MARGIN + 320;
  const valueX = MARGIN + 450;
  const totalRows: Array<[string, string, boolean]> = [
    [locale === 'en' ? 'SUBTOTAL' : 'SUBTOTAL', money(subtotal, snapshot.moneda, locale), false],
    [
      locale === 'en' ? `VAT ${ivaPct}%` : `IVA ${ivaPct}%`,
      money(iva, snapshot.moneda, locale),
      false,
    ],
    [
      locale === 'en' ? 'TOTAL DUE' : 'TOTAL A PAGAR',
      money(totalPagar, snapshot.moneda, locale),
      true,
    ],
  ];
  for (const [label, value, strong] of totalRows) {
    ctx.page.drawText(winAnsi(label), {
      x: labelX,
      y: ctx.y,
      size: strong ? 10 : 9,
      font: strong ? bold : font,
      color: strong ? TEAL : INK,
    });
    ctx.page.drawText(winAnsi(value), {
      x: valueX,
      y: ctx.y,
      size: strong ? 10 : 9,
      font: strong ? bold : font,
      color: strong ? TEAL : INK,
    });
    ctx.y -= strong ? 16 : 13;
  }

  ctx.y -= 8;
  ensure(ctx, 120);
  ctx.page.drawText(winAnsi(locale === 'en' ? 'PAYMENT TERMS:' : 'CONDICION DE PAGO:'), {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font: bold,
    color: TEAL,
  });
  ctx.y -= 12;
  ctx.page.drawText(
    winAnsi(snapshot.condicionPago || (locale === 'en' ? 'As agreed' : 'Contado')).slice(0, 80),
    { x: MARGIN, y: ctx.y, size: 9, font, color: INK }
  );
  ctx.y -= 14;
  ctx.page.drawText(winAnsi(locale === 'en' ? 'PAYMENT METHOD:' : 'MEDIO DE PAGO:'), {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font: bold,
    color: TEAL,
  });
  ctx.y -= 12;
  ctx.page.drawText(
    winAnsi(
      snapshot.medioPago || (locale === 'en' ? 'Bank transfer' : 'Transferencia bancaria')
    ).slice(0, 80),
    { x: MARGIN, y: ctx.y, size: 9, font, color: INK }
  );
  ctx.y -= 12;
  for (const line of banco.slice(0, 5)) {
    ensure(ctx, 14);
    ctx.page.drawText(winAnsi(line).slice(0, 90), {
      x: MARGIN,
      y: ctx.y,
      size: 8,
      font,
      color: MUTED,
    });
    ctx.y -= 11;
  }
  if (snapshot.validezHasta) {
    ensure(ctx, 16);
    ctx.y -= 4;
    ctx.page.drawText(
      winAnsi(
        locale === 'en'
          ? `Valid until ${snapshot.validezHasta}. Prices may change after this date.`
          : `Valida hasta ${snapshot.validezHasta}. Posterior a esta fecha, precios sujetos a revision.`
      ).slice(0, 100),
      { x: MARGIN, y: ctx.y, size: 8, font, color: MUTED }
    );
    ctx.y -= 12;
  }
  drawFooter(ctx.page, font);

  // Consideraciones
  newPage(ctx);
  ctx.page.drawText(
    winAnsi(locale === 'en' ? 'Offer considerations' : 'Consideraciones de la oferta'),
    {
      x: MARGIN,
      y: ctx.y,
      size: 13,
      font: bold,
      color: TEAL,
    }
  );
  ctx.y -= 22;
  const terms =
    snapshot.condiciones.trim() ||
    (locale === 'en'
      ? 'See commercial terms agreed with your advisor.'
      : 'Ver condiciones comerciales acordadas con su asesor.');
  for (const chunk of wrapText(terms, 95)) {
    ensure(ctx, 14);
    ctx.page.drawText(winAnsi(chunk), { x: MARGIN, y: ctx.y, size: 9, font, color: INK });
    ctx.y -= 13;
  }
  drawFooter(ctx.page, font);

  // Anexo fichas
  const annexes = snapshot.annexes ?? [];
  if (annexes.length > 0) {
    newPage(ctx);
    ctx.page.drawText(
      winAnsi(locale === 'en' ? 'Annex - Product sheets' : 'Anexo - Fichas de producto'),
      {
        x: MARGIN,
        y: ctx.y,
        size: 13,
        font: bold,
        color: TEAL,
      }
    );
    ctx.y -= 18;
    ctx.page.drawText(
      winAnsi(
        locale === 'en'
          ? 'Summaries from the product landing pages.'
          : 'Resumenes tomados de las landing pages de producto.'
      ),
      { x: MARGIN, y: ctx.y, size: 9, font, color: MUTED }
    );
    ctx.y -= 20;

    for (const annex of annexes) {
      ensure(ctx, 80);
      ctx.page.drawText(winAnsi(annex.nombre).slice(0, 90), {
        x: MARGIN,
        y: ctx.y,
        size: 11,
        font: bold,
        color: TEAL,
      });
      ctx.y -= 14;
      const meta = [annex.sku ? `SKU ${annex.sku}` : '', annex.slug || '']
        .filter(Boolean)
        .join(' · ');
      if (meta) {
        ctx.page.drawText(winAnsi(meta).slice(0, 100), {
          x: MARGIN,
          y: ctx.y,
          size: 8,
          font,
          color: MUTED,
        });
        ctx.y -= 12;
      }
      if (annex.url) {
        ctx.page.drawText(winAnsi(annex.url).slice(0, 100), {
          x: MARGIN,
          y: ctx.y,
          size: 8,
          font,
          color: MUTED,
        });
        ctx.y -= 12;
      }
      const body =
        annex.resumen.trim() || (locale === 'en' ? 'No summary available.' : 'Sin resumen.');
      for (const chunk of wrapText(body, 95).slice(0, 40)) {
        ensure(ctx, 14);
        ctx.page.drawText(winAnsi(chunk), { x: MARGIN, y: ctx.y, size: 9, font, color: INK });
        ctx.y -= 12;
      }
      ctx.y -= 14;
    }
    drawFooter(ctx.page, font);
  }

  const bytes = await doc.save();
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error('PDF_RENDER_FAILED: PDF exceeds 8MB');
  }
  return bytes;
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
