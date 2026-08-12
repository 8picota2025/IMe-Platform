#!/usr/bin/env node
/**
 * Importa únicamente productos Saikang ausentes del catálogo I-ME.
 * Fuente: catálogo público y fichas de Saikang. No infiere certificaciones,
 * prestaciones clínicas, precios ni equivalencias con otros fabricantes.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ROOT = process.cwd();
const PRODUCTS = path.join(ROOT, 'src/data/mock-productos.json');
const ASSETS = path.join(ROOT, 'public/assets/productos/importados');
const LIST_URL = 'https://saikangmedical.com/en/products/all/';
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.slice(8)) : Number.POSITIVE_INFINITY;

const FAMILIAS = {
  mobiliario: '3d631fe7-2f3b-4b43-a07c-861844755476',
  cirugia: '42daf82e-4b05-479c-9557-74214a9e655b',
  gineco: '2f70b322-e498-4924-8630-3a1ee268c01f',
  traslado: '5c8c5719-4488-4723-99e6-77b7342c1a40',
  monitores: '82aa3109-df88-468b-aed8-5ff953f2749a',
  infusion: '7a54551b-46c8-4afb-9b57-eb2922795e83',
  respiratorio: '7cbfd53b-91c4-4cd1-9c6c-7d4fd812520b',
  esterilizacion: '12af966b-90d0-460c-a51a-a51b18b3f17d',
};

function cleanHtml(value = '') {
  return value
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#\d+;|&amp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function slugify(value) {
  return cleanHtml(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
function compact(value) { return slugify(value).replaceAll('-', ''); }
function decode(value = '') { return value.replace(/&amp;/g, '&').replace(/&#8211;/g, '-').replace(/&#8217;/g, "'"); }
function firstMatch(source, expression) { return source.match(expression)?.[1] ? decode(source.match(expression)[1]) : ''; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function productUrls(html) {
  return unique([...html.matchAll(/https:\/\/saikangmedical\.com\/en\/product\/[^"?#<\s]+/g)].map(match => match[0]));
}
async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'I-ME catalog importer/1.0', accept: 'text/html,application/pdf,image/*;q=0.8,*/*;q=0.5' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return { response, buffer: Buffer.from(await response.arrayBuffer()) };
}
async function pool(items, size, worker) {
  const results = []; let index = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (index < items.length) {
      const current = items[index++];
      try { results.push(await worker(current)); } catch (error) { results.push({ url: current, error: String(error) }); }
    }
  }));
  return results;
}
function familyFor(text) {
  const source = text.toLowerCase();
  if (/infusion pump|syringe pump/.test(source)) return ['infusion', 'terapia-de-infusion'];
  if (/patient monitor|ecg machine|electrocardiograph/.test(source)) return ['monitores', 'monitorizacion-y-signos-vitales'];
  if (/ventilator|suction device|nebulizer|oxygen/.test(source)) return ['respiratorio', 'terapia-respiratoria-soporte-vital'];
  if (/autoclave|sterilizer/.test(source)) return ['esterilizacion', 'esterilizacion-control-infecciones'];
  if (/stretcher|patient trolley|emergency trolley/.test(source)) return ['traslado', 'emergencias-traslado-inmovilizacion'];
  if (/gynecological|obstetric|delivery bed|exam couch/.test(source)) return ['gineco', 'neonatologia'];
  if (/operating table|operating lamp|shadowless|pendant|operating room/.test(source)) return ['cirugia', 'sala-cirugia'];
  return ['mobiliario', 'mobiliario'];
}
function productKind(text) {
  const source = text.toLowerCase();
  if (/icu|hospital bed|nursing home bed|pediatric bed|baby crib/.test(source)) return 'cama hospitalaria';
  if (/operating table/.test(source)) return 'mesa quirúrgica';
  if (/gynecological|obstetric|exam couch/.test(source)) return 'mesa de examen ginecológico u obstétrico';
  if (/operating lamp|shadowless/.test(source)) return 'lámpara quirúrgica';
  if (/pendant/.test(source)) return 'columna o puente médico';
  if (/stretcher|patient trolley/.test(source)) return 'camilla de traslado';
  if (/trolley|cart/.test(source)) return 'carro clínico';
  if (/chair|stool|wheel chair/.test(source)) return 'sillón o silla clínica';
  if (/monitor/.test(source)) return 'monitor de paciente';
  if (/infusion pump|syringe pump/.test(source)) return 'bomba de infusión';
  if (/ventilator/.test(source)) return 'ventilador';
  if (/autoclave|sterilizer/.test(source)) return 'equipo de esterilización';
  return 'equipo hospitalario';
}
function titleEs(title, url) {
  const clean = cleanHtml(title).replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const model = clean.match(/^[A-Za-z]+[\w-]*/)?.[0] ?? '';
  const source = `${clean} ${url}`.toLowerCase();
  const kind = productKind(source);
  const type = kind.charAt(0).toUpperCase() + kind.slice(1);
  return model ? `${type} Ref. ${model} Saikang` : `${type} Saikang`;
}
function titleEn(title) { return cleanHtml(title).replace(/\s+/g, ' ').trim(); }
function sourceFacts(html) {
  const main = html.slice(html.indexOf('<main'), html.indexOf('<footer') > 0 ? html.indexOf('<footer') : undefined);
  const raw = [...main.matchAll(/<(?:li|p|td|th|h[2-4])\b[^>]*>([\s\S]*?)<\/(?:li|p|td|th|h[2-4])>/gi)]
    .map(match => cleanHtml(match[1]))
    .filter(value => value.length >= 8 && value.length <= 220)
    .filter(value => !/download brochure|submit the form|cookie|privacy|contact us/i.test(value));
  return unique(raw).slice(0, 14);
}
function modelKeys(title, url) {
  const pathKey = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
  const titleKey = cleanHtml(title).replace(/\([^)]*\)/g, '');
  const first = titleKey.match(/^[A-Za-z]+[\w-]*/)?.[0] ?? '';
  const parenthetical = [...cleanHtml(title).matchAll(/\(([^)]+)\)/g)].map(match => compact(match[1]));
  return unique([compact(pathKey), compact(titleKey), compact(first), ...parenthetical]).filter(key => key.length >= 3);
}
function modelReference(title) {
  return cleanHtml(title).match(/^[A-Za-z]+[\w-]*/)?.[0] ?? slugify(title);
}
function existingKeys(product) {
  return unique([product.slug, product.sku, product.nombre_es, product.nombre_en].map(compact)).filter(key => key.length >= 3);
}
function parsePage(url, html) {
  const title = firstMatch(html, /<h1[^>]*product_title[^>]*>([\s\S]*?)<\/h1>/i) || firstMatch(html, /"title":"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  const image = firstMatch(html, /"featuredImage":"(https?:\\?\/\\?\/[^"\\]+)"/i).replace(/\\\//g, '/') || firstMatch(html, /property="og:image" content="([^"]+)"/i);
  const pdfs = unique([...html.matchAll(/href="(https?:\/\/[^"']+\.pdf(?:\?[^"']*)?)"/gi)].map(match => decode(match[1])));
  return { url, title: title.replace(/\\u[0-9a-f]{4}/gi, ''), image, pdfs, facts: sourceFacts(html) };
}
async function download(url, output) {
  const { buffer } = await fetchText(url);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, buffer);
}

const products = JSON.parse(await readFile(PRODUCTS, 'utf8'));
const listPages = await pool(
  Array.from({ length: 24 }, (_, index) => (index === 0 ? LIST_URL : `${LIST_URL}page/${index + 1}/`)),
  6,
  async url => (await fetchText(url)).buffer.toString('utf8')
);
const urls = unique(listPages.flatMap(productUrls));
if (urls.length < 200) throw new Error(`Inventario incompleto: ${urls.length} URLs`);
const pages = await pool(urls, 8, async url => parsePage(url, (await fetchText(url)).buffer.toString('utf8')));
const currentKeys = new Set(products.flatMap(existingKeys));
const isPresent = page => modelKeys(page.title, page.url).some(key =>
  currentKeys.has(key) || (key.length >= 4 && [...currentKeys].some(current => current.endsWith(key)))
);
const candidates = pages.filter(page => !page.error && page.title && !isPresent(page)).slice(0, LIMIT);
let imported = 0; let pdfsDownloaded = 0; let imagesDownloaded = 0; const failures = []; const importedProducts = []; const assetJobs = [];

for (const page of candidates) {
  const model = modelReference(page.title);
  const slug = `saikang-${slugify(model)}`;
  if (products.some(product => product.slug === slug)) continue;
  const [familyKey, familySlug] = familyFor(`${page.title} ${page.url}`);
  const nombreEs = titleEs(page.title, page.url);
  const nombreEn = titleEn(page.title);
  const kind = productKind(`${page.title} ${page.url}`);
  const shortEs = `${nombreEs} para hospitales, clínicas y servicios de salud.`;
  const shortEn = `${nombreEn} for hospitals, clinics, and healthcare services.`;
  const facts = page.facts;
  const descEn = facts.slice(0, 4).join(' ') || `${nombreEn} by Saikang Medical. Consult the manufacturer documentation for product-specific technical information.`;
  const descEs = `${nombreEs} de Saikang Medical para uso institucional según la configuración y documentación del fabricante. Consulte la ficha técnica para especificaciones, accesorios y condiciones de uso del equipo.`;
  const assetDir = path.join(ASSETS, slug);
  const product = {
    id: randomUUID(), slug, sku: model.toUpperCase(), familia_id: FAMILIAS[familyKey], familia_slug: familySlug, tipo_id: null,
    nombre_es: nombreEs, nombre_en: nombreEn, descripcion_corta_es: shortEs, descripcion_corta_en: shortEn,
    descripcion_larga_es: descEs, descripcion_larga_en: descEn,
    especificaciones: [{ clave: 'Modelo', valor: model.toUpperCase(), grupo: 'Identificación' }, { clave: 'Fabricante', valor: 'Jiangsu Saikang Medical Equipment Co., Ltd.', grupo: 'Fabricante' }, ...facts.slice(0, 10).map((value, index) => ({ clave: `Información técnica ${index + 1}`, valor: value, grupo: 'Fabricante' }))],
    imagen_principal: null, galeria: [], ficha_pdf: null,
    tipo_comercial: 'equipo', fulfillment_mode: 'cotizacion', precio: null, moneda: 'COP', stock: null, disponible: true, destacado: false, nuevo: true, activo: true, orden: products.length + 1,
    aplicaciones_es: [kind, 'Hospitales y clínicas'], aplicaciones_en: [kind, 'Hospitals and clinics'],
    beneficios_es: facts.slice(0, 4), beneficios_en: facts.slice(0, 4), valor_es: null, valor_en: null,
    preguntas_frecuentes_es: [], preguntas_frecuentes_en: [], marca: 'Saikang Medical',
    seo_keywords_es: [nombreEs, `${kind} Saikang`, `${kind} Colombia`, `ficha técnica ${model.toUpperCase()}`, `cotizar ${model.toUpperCase()}`],
    seo_keywords_en: [nombreEn, `Saikang ${kind}`, `${kind} Colombia`, `${model.toUpperCase()} datasheet`, `request a quote for ${model.toUpperCase()}`],
    atributos: { fabricante_url: page.url, manufacturer_pdf_url: page.pdfs[0] ?? null, seo_keywords_es: [nombreEs, `${kind} Saikang`, `${kind} Colombia`, `ficha técnica ${model.toUpperCase()}`, `cotizar ${model.toUpperCase()}`], seo_keywords_en: [nombreEn, `Saikang ${kind}`, `${kind} Colombia`, `${model.toUpperCase()} datasheet`, `request a quote for ${model.toUpperCase()}`], beneficios_es: facts.slice(0, 4), beneficios_en: facts.slice(0, 4), marca: 'Saikang Medical' },
  };
  products.push(product);
  if (!DRY_RUN) assetJobs.push(async () => {
    if (page.image) {
      try {
        const ext = path.extname(new URL(page.image).pathname) || '.jpg';
        await download(page.image, path.join(assetDir, `imagen-principal${ext}`));
        product.imagen_principal = `/assets/productos/importados/${slug}/imagen-principal${ext}`;
        product.galeria = [product.imagen_principal];
        imagesDownloaded += 1;
      } catch (error) { failures.push({ slug, type: 'image', error: String(error) }); }
    }
    if (page.pdfs[0]) {
      try {
        await download(page.pdfs[0], path.join(assetDir, 'ficha-tecnica-saikang.pdf'));
        product.ficha_pdf = `/assets/productos/importados/${slug}/ficha-tecnica-saikang.pdf`;
        pdfsDownloaded += 1;
      } catch (error) { failures.push({ slug, type: 'pdf', error: String(error) }); }
    }
  });
  imported += 1;
  importedProducts.push({ title: page.title, url: page.url, slug, pdf_available: Boolean(page.pdfs[0]) });
}
if (!DRY_RUN) await pool(assetJobs, 12, job => job());
if (!DRY_RUN) await writeFile(PRODUCTS, `${JSON.stringify(products, null, 2)}\n`);
console.log(JSON.stringify({ manufacturer_products: urls.length, catalog_before: products.length - imported, already_present: pages.length - candidates.length, imported, imported_products: importedProducts, pdfs_downloaded: pdfsDownloaded, images_downloaded: imagesDownloaded, failures }, null, 2));
