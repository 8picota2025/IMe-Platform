#!/usr/bin/env node
/**
 * Core PDF ingest helpers for Node scripts (mirror of src/lib/pdf-ingest-enrich.ts).
 */
import { readFile } from 'node:fs/promises';

const FAMILY_HINTS = [
  ['Ventiladores', ['ventilador', 'respirador', 'monnal', 'vni', 'vmi']],
  ['Anestesia y soporte ventilatorio', ['anestesia', 'vaporizador', 'mascara laringea']],
  ['Radiología y Diagnóstico por Imagen', ['radiologia', 'rayos x', 'rx', 'mamogra', 'arco c']],
  ['Ultrasonido', ['ecogra', 'ultrasonido', 'doppler']],
  ['Monitores', ['monitor multiparam', 'monitor de signos', 'signos vitales']],
];

const TIPO_HINTS = [
  ['Ventiladores', ['ventilador', 'respirador', 'monnal']],
  ['Monitores multiparamétricos', ['monitor multiparam']],
  ['Ecógrafos', ['ecogra', 'ultrasonido']],
];

export function normalizeMatchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function inferFamiliaSugerida(textValue) {
  const value = normalizeMatchText(textValue);
  return FAMILY_HINTS.find(([, keywords]) => keywords.some(k => value.includes(k)))?.[0] ?? '';
}

export function inferTipoSugerido(textValue) {
  const value = normalizeMatchText(textValue);
  return TIPO_HINTS.find(([, keywords]) => keywords.some(k => value.includes(k)))?.[0] ?? '';
}

export function productPdfPublicPath(slug) {
  return `/assets/productos/importados/${slug}/ficha-${slug}.pdf`;
}

export async function extractPdfTextFromPath(pdfPath, maxChars = 50000) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(await readFile(pdfPath));
  const pdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false }).promise;
  const pages = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!pageText) continue;
    pages.push(`Pagina ${pageNumber}\n${pageText}`);
    totalChars += pageText.length;
    if (totalChars >= maxChars) {
      pages.push('[Texto truncado por limite de ingesta.]');
      break;
    }
  }

  return pages.join('\n\n').slice(0, maxChars);
}

export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function inferProductName(lines, pdfPath) {
  const candidate =
    lines.find(line => {
      const words = line.split(/\s+/).length;
      return line.length >= 6 && line.length <= 90 && words <= 12 && !/^pagina\s+\d+/i.test(line);
    }) ?? '';
  if (candidate) return candidate;
  const fromPath = decodeURIComponent(pdfPath.split('/').pop() ?? '').replace(/\.pdf$/i, '');
  return fromPath ? fromPath.replace(/[-_]+/g, ' ').trim() : 'Producto desde PDF';
}

export function inferSpecs(lines) {
  const specs = [];
  for (const line of lines) {
    if (specs.length >= 24) break;
    const colon = line.match(/^([^:]{3,45}):\s*(.{2,160})$/);
    if (colon?.[1] && colon?.[2]) {
      specs.push({ clave: colon[1].trim(), valor: colon[2].trim(), grupo: '' });
      continue;
    }
    const technical = line.match(
      /\b(\d+(?:[.,]\d+)?\s?(?:mm|cm|kg|g|hz|khz|mhz|v|w|kw|ma|a|mah|kva|mpa|bar|psi|rpm|l\/min|ml\/h|bpm|°c|lux|inch|pulgadas?))\b/i
    );
    if (technical) {
      specs.push({ clave: 'Caracteristica', valor: line.slice(0, 160), grupo: '' });
    }
  }
  return specs;
}

export function inferAplicaciones(textValue) {
  const value = textValue.toLowerCase();
  const out = [];
  if (/invasiv/i.test(value)) out.push('Ventilación invasiva');
  if (/no invasiv|vni|niv/i.test(value)) out.push('Ventilación no invasiva');
  if (/adult/i.test(value)) out.push('Cuidados intensivos adultos');
  if (/pediatr|infant|niñ/i.test(value)) out.push('Cuidados intensivos pediátricos');
  if (/uci|critico|intensiv/i.test(value) && !out.length) out.push('Cuidados intensivos');
  return [...new Set(out)];
}

function detectMarca(corpus, nombre) {
  const brands = ['Air Liquide', 'Philips', 'GE Healthcare', 'Mindray', 'Drager', 'Hamilton', 'Medtronic'];
  return (
    brands.find(b => corpus.includes(b.toLowerCase()) || nombre.toLowerCase().includes(b.toLowerCase())) ??
    ''
  );
}

function dedupeStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = normalizeMatchText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(value).trim());
  }
  return out;
}

export function deriveEnrichedFields(input) {
  const corpus = [
    input.nombre,
    input.descripcionCorta,
    input.descripcionLarga,
    input.textoCompleto ?? '',
    ...input.especificaciones.map(s => `${s.clave} ${s.valor}`),
  ]
    .join(' ')
    .toLowerCase();

  const marca = detectMarca(corpus, input.nombre);
  const beneficios_es = [];
  const pick = clave =>
    input.especificaciones.find(s => normalizeMatchText(s.clave).includes(normalizeMatchText(clave)));

  const pantalla = pick('pantalla');
  if (pantalla?.valor) {
    beneficios_es.push(`Interfaz ${pantalla.valor.toLowerCase()} para ajustes rápidos en cuidado crítico.`);
  }
  const modos = pick('modos');
  if (modos?.valor) {
    beneficios_es.push(`Amplio portafolio de modos (${modos.valor}) para ventilación invasiva y no invasiva.`);
  } else if (/ventilacion invasiva|vni|psv|cpap/i.test(corpus)) {
    beneficios_es.push('Cubre ventilación invasiva y no invasiva en una misma plataforma clínica.');
  }
  if (input.aplicaciones.length) {
    beneficios_es.push(`Aplicaciones clínicas: ${input.aplicaciones.slice(0, 4).join(', ')}.`);
  }

  const corto = input.nombre.split(/\s+/).slice(0, 6).join(' ');
  const apps = input.aplicaciones.slice(0, 2).join(' y ');
  const valor_es = apps
    ? `${corto} con enfoque en ${apps.toLowerCase()}, listo para evaluación técnica y cotización institucional.`
    : `${corto} para entornos hospitalarios que requieren ventilación segura y trazabilidad clínica.`;

  const seo_keywords_es = dedupeStrings([
    'ventilador UCI Colombia',
    'equipo médico hospitalario Colombia',
    marca ? `${marca} Colombia` : '',
    ...input.aplicaciones.slice(0, 2).map(a => `${a.toLowerCase()} hospital`),
  ]).slice(0, 6);

  return {
    beneficios_es: dedupeStrings(beneficios_es).slice(0, 5),
    beneficios_en: [],
    valor_es,
    valor_en: '',
    seo_keywords_es,
    seo_keywords_en: [],
    marca,
  };
}

export function buildAtributosPayload(fields) {
  return {
    beneficios_es: fields.beneficios_es,
    beneficios_en: fields.beneficios_en,
    valor_es: fields.valor_es || null,
    valor_en: fields.valor_en || null,
    seo_keywords_es: fields.seo_keywords_es,
    seo_keywords_en: fields.seo_keywords_en,
    marca: fields.marca ?? null,
  };
}
