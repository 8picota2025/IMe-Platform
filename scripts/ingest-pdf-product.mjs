#!/usr/bin/env node
/**
 * Ingesta PDF → producto enriquecido en mock-productos + assets públicos.
 *
 * Uso:
 *   node scripts/ingest-pdf-product.mjs --pdf=/ruta/ficha.pdf --slug=mi-producto
 *   node scripts/ingest-pdf-product.mjs --pdf=/ruta/ficha.pdf --update-existing
 *   node scripts/ingest-pdf-product.mjs --dir=/home/shoky/ftp/producto/2 --slug=ventilador-...
 *
 * Opciones:
 *   --sync-supabase   Ejecuta sync-productos-supabase.mjs para el slug
 *   --dry-run         Solo imprime diff
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildAtributosPayload,
  deriveEnrichedFields,
  extractPdfTextFromPath,
  inferAplicaciones,
  inferFamiliaSugerida,
  inferProductName,
  inferSpecs,
  inferTipoSugerido,
  productPdfPublicPath,
  slugify,
} from './lib/pdf-ingest-core.mjs';

const repoRoot = process.cwd();
const mockPath = path.join(repoRoot, 'src/data/mock-productos.json');
const familiasPath = path.join(repoRoot, 'src/data/mock-familias.json');
const tiposPath = path.join(repoRoot, 'src/data/mock-tipos.json');

const args = Object.fromEntries(
  process.argv.slice(2).map(part => {
    const [k, v = 'true'] = part.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const DRY_RUN = args['dry-run'] === 'true';
const SYNC_SUPABASE = args['sync-supabase'] === 'true';

function normalize(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function resolvePdfPath() {
  if (args.pdf) return path.resolve(args.pdf);
  if (args.dir) {
    const dir = path.resolve(args.dir);
    const { readdir } = await import('node:fs/promises');
    const files = (await readdir(dir)).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (files.length !== 1) {
      throw new Error(`Se esperaba 1 PDF en ${dir}, encontrados: ${files.length}`);
    }
    return path.join(dir, files[0]);
  }
  throw new Error('Indica --pdf= o --dir=');
}

function matchTaxonomyId(suggestion, rows) {
  const normalizedSuggestion = slugify(suggestion).replace(/-/g, ' ');
  if (!normalizedSuggestion) return '';
  const match = rows.find(row => {
    const candidates = [row.nombre_es, row.nombre_en, row.slug].map(v =>
      slugify(String(v ?? '')).replace(/-/g, ' ')
    );
    return candidates.some(
      c =>
        c &&
        (c === normalizedSuggestion ||
          c.includes(normalizedSuggestion) ||
          normalizedSuggestion.includes(c))
    );
  });
  return match?.id ?? '';
}

function mergeProduct(existing, patch) {
  const atributos = {
    ...(existing?.atributos ?? {}),
    ...buildAtributosPayload({
      beneficios_es: patch.beneficios_es ?? existing?.beneficios_es ?? [],
      beneficios_en: patch.beneficios_en ?? existing?.beneficios_en ?? [],
      valor_es: patch.valor_es ?? existing?.valor_es ?? '',
      valor_en: patch.valor_en ?? existing?.valor_en ?? '',
      seo_keywords_es: patch.seo_keywords_es ?? existing?.seo_keywords_es ?? [],
      seo_keywords_en: patch.seo_keywords_en ?? existing?.seo_keywords_en ?? [],
      marca: patch.marca ?? existing?.marca ?? null,
    }),
  };

  return {
    ...existing,
    ...patch,
    atributos,
    activo: patch.activo ?? existing?.activo ?? true,
    disponible: patch.disponible ?? existing?.disponible ?? true,
  };
}

const pdfPath = await resolvePdfPath();
const pdfText = await extractPdfTextFromPath(pdfPath);
const lines = pdfText
  .replace(/\r/g, '')
  .split('\n')
  .map(line => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const nombre = inferProductName(lines, pdfPath);
const descripcionLarga = lines
  .filter(line => line.length > 35 && !/^pagina\s+\d+/i.test(line))
  .slice(0, 4)
  .join(' ')
  .slice(0, 900);
const descripcionCorta = descripcionLarga.slice(0, 240);
const especificaciones = inferSpecs(lines);
const aplicaciones_es = inferAplicaciones(`${nombre} ${pdfText}`);
const enriched = deriveEnrichedFields({
  nombre,
  descripcionCorta,
  descripcionLarga,
  especificaciones,
  aplicaciones: aplicaciones_es,
  textoCompleto: pdfText,
});

const mockProductos = JSON.parse(await readFile(mockPath, 'utf8'));
const familias = JSON.parse(await readFile(familiasPath, 'utf8'));
const tipos = JSON.parse(await readFile(tiposPath, 'utf8'));

let slug = args.slug ? slugify(args.slug) : '';
if (!slug && args['update-existing']) {
  const hit = mockProductos.find(p => normalize(p.nombre_es).includes('monnal t75') || normalize(p.slug).includes('monnal-ref-t75'));
  slug = hit?.slug ?? '';
}
if (!slug) slug = slugify(nombre);

const familiaNombre = inferFamiliaSugerida(`${nombre} ${pdfText}`);
const tipoNombre = inferTipoSugerido(`${nombre} ${pdfText}`);
const familia_id = matchTaxonomyId(familiaNombre, familias);
const tipo_id = matchTaxonomyId(tipoNombre, tipos);
const familia_slug = familias.find(f => f.id === familia_id)?.slug ?? '';
const ficha_pdf = productPdfPublicPath(slug);
const assetsDir = path.join(repoRoot, 'public/assets/productos/importados', slug);
const pdfDest = path.join(assetsDir, `ficha-${slug}.pdf`);

const patch = existing
  ? {
      slug,
      ficha_pdf,
      ...(especificaciones.length > (existing.especificaciones?.length ?? 0)
        ? { especificaciones }
        : {}),
    }
  : {
      slug,
      nombre_es: nombre,
      descripcion_corta_es: descripcionCorta,
      descripcion_larga_es: descripcionLarga,
      especificaciones,
      aplicaciones_es,
      beneficios_es: enriched.beneficios_es,
      valor_es: enriched.valor_es,
      seo_keywords_es: enriched.seo_keywords_es,
      marca: enriched.marca || 'Air Liquide',
      ficha_pdf,
      familia_id: familia_id || undefined,
      familia_slug: familia_slug || undefined,
      tipo_id: tipo_id || undefined,
      activo: true,
      disponible: true,
    };

let index = mockProductos.findIndex(p => p.slug === slug);
const existing = index >= 0 ? mockProductos[index] : null;
const merged = mergeProduct(existing, patch);

if (DRY_RUN) {
  console.log(JSON.stringify({ slug, pdfPath, patch, mergedPreview: merged, chars: pdfText.length }, null, 2));
  process.exit(0);
}

if (!existsSync(assetsDir)) await mkdir(assetsDir, { recursive: true });
await copyFile(pdfPath, pdfDest);

if (index >= 0) {
  mockProductos[index] = merged;
} else {
  merged.id = crypto.randomUUID();
  merged.tipo_comercial = 'equipo';
  merged.fulfillment_mode = 'cotizacion';
  merged.moneda = 'COP';
  merged.orden = 0;
  mockProductos.push(merged);
  index = mockProductos.length - 1;
}

await writeFile(mockPath, `${JSON.stringify(mockProductos, null, 2)}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      ok: true,
      slug,
      action: existing ? 'updated' : 'created',
      pdfCopiedTo: pdfDest,
      ficha_pdf,
      especificaciones: especificaciones.length,
      beneficios: enriched.beneficios_es.length,
      charsExtracted: pdfText.length,
    },
    null,
    2
  )
);

if (SYNC_SUPABASE) {
  const result = spawnSync(
    'node',
    ['--env-file-if-exists=.env', 'scripts/sync-productos-supabase.mjs', `--slugs=${slug}`],
    { cwd: repoRoot, stdio: 'inherit', env: process.env }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
