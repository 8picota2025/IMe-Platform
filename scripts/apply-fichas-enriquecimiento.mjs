#!/usr/bin/env node
/**
 * Aplica el enriquecimiento de landings a partir de fichas de fabricante.
 *
 *   src/data/fichas-enriquecimiento/manifest.json   sku/slug -> PDF (origen local, url oficial)
 *   src/data/fichas-enriquecimiento/<marca>.json    contenido redactado desde la ficha (por SKU)
 *
 * Por cada producto con contenido:
 *   1. Copia el PDF a public/assets/productos/fichas/<marca>/ (descargable en el hosting).
 *   2. Actualiza src/data/mock-productos.json (fallback de desarrollo).
 *   3. Genera supabase/migrations/<ts>_enriquecer_fichas_<marca>.sql (se aplica con el
 *      workflow manual "Deploy Supabase Migrations"; nunca se escribe en producción desde aquí).
 *
 * Uso: node scripts/apply-fichas-enriquecimiento.mjs [--dry-run] [--only=advanced]
 * Requiere un snapshot de productos (tmp/productos-snapshot.json) solo para fusionar
 * especificaciones existentes; si no existe se usa mock-productos.json.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const dir = path.join(root, 'src/data/fichas-enriquecimiento');
const mockPath = path.join(root, 'src/data/mock-productos.json');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v = 'true'] = a.replace(/^--/, '').split('='); return [k, v]; }));
const DRY = args['dry-run'] === 'true';
const TS = args.ts ?? '20261002';

const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const bySku = new Map(manifest.filter(m => m.sku).map(m => [m.sku, m]));
const bySlug = new Map(manifest.map(m => [m.slug, m]));
const mock = JSON.parse(readFileSync(mockPath, 'utf8'));
const mockBySlug = new Map(mock.map(p => [p.slug, p]));
const snapPath = args.snapshot ?? path.join(root, 'tmp/productos-snapshot.json');
const snap = existsSync(snapPath) ? new Map(JSON.parse(readFileSync(snapPath, 'utf8')).map(p => [p.slug, p])) : mockBySlug;

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dq = (tag, v) => `$${tag}$${typeof v === 'string' ? v : JSON.stringify(v)}$${tag}$`;
const sq = v => `'${String(v).replace(/'/g, "''")}'`;
const IDIOMA = { es: ['español', 'Spanish'], en: ['inglés', 'English'], fr: ['francés', 'French'] };

// Conserva las especificaciones existentes (incluidas las repetidas "Característica") y
// añade las nuevas; si una clave nueva ya existe (salvo "Característica"), la nueva la reemplaza.
function mergeSpecs(existing, nuevas) {
  const nuevasKeys = new Set(nuevas.map(s => String(s.clave).trim().toLowerCase()));
  const previas = (Array.isArray(existing) ? existing : []).filter(s => {
    const key = String(s.clave).trim().toLowerCase();
    return key === 'característica' || !nuevasKeys.has(key);
  });
  return [...nuevas, ...previas].map(s => ({ clave: s.clave, grupo: s.grupo, valor: s.valor }));
}

const pdfPorHash = new Map();
const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'manifest.json').filter(f => !args.only || f.startsWith(args.only));
let total = 0, sinProducto = [];
for (const f of files) {
  const marca = f.replace(/\.json$/, '');
  const items = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  const sql = [`-- Enriquecimiento de landings desde fichas técnicas oficiales del fabricante (${marca}).`,
    '-- Contenido redactado solo con datos presentes en la ficha; ver informe docs/informe-fichas-fabricantes-2026-10-02.md.',
    '-- Se aplica con el workflow manual "Deploy Supabase Migrations". Idempotente (UPDATE por slug).', ''];
  for (const it of items) {
    const m = bySku.get(it.sku) ?? bySlug.get(it.slug);
    if (!m) { sinProducto.push(`${marca}:${it.sku ?? it.slug}`); continue; }
    const prod = mockBySlug.get(m.slug);
    const base = snap.get(m.slug) ?? prod;
    if (!base) { sinProducto.push(`${marca}:${m.slug} (sin producto)`); continue; }

    // 1. PDF público
    // Los PDF idénticos (mismo contenido) se publican una sola vez y se reutiliza la ruta.
    const hash = createHash('sha1').update(readFileSync(m.origen_local)).digest('hex');
    const pdfName = `${slugify(path.basename(m.origen_local, '.pdf'))}.pdf`;
    const pdfRel = pdfPorHash.get(hash) ?? `/assets/productos/fichas/${m.fab_slug}/${pdfName}`;
    const yaCopiado = pdfPorHash.has(hash);
    pdfPorHash.set(hash, pdfRel);
    if (!DRY && !yaCopiado) {
      mkdirSync(path.join(root, 'public', path.dirname(pdfRel)), { recursive: true });
      // No sobrescribe un PDF ya publicado (puede estar optimizado por scripts/optimize-fichas-pdf.py).
      if (!existsSync(path.join(root, 'public', pdfRel))) copyFileSync(m.origen_local, path.join(root, 'public', pdfRel));
    }
    const [idEs, idEn] = IDIOMA[m.lang] ?? IDIOMA.en;
    const nombreEs = base.nombre_es, nombreEn = base.nombre_en || base.nombre_es;
    const faqEs = [...it.faq_es, { q: `¿Dónde descargo la ficha técnica de ${nombreEs}?`, a: `En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de ${m.fabricante} (en ${idEs}).` }];
    const faqEn = [...it.faq_en, { q: `Where can I download the ${nombreEn} datasheet?`, a: `On this page, with the “Download datasheet” button: it is the official ${m.fabricante} PDF (in ${idEn}).` }];
    const specs = mergeSpecs(base.especificaciones, it.especificaciones);
    const attrs = {
      beneficios_es: it.beneficios_es, beneficios_en: it.beneficios_en,
      valor_es: it.valor_es, valor_en: it.valor_en,
      preguntas_frecuentes_es: faqEs, preguntas_frecuentes_en: faqEn,
      seo_keywords_es: it.seo_keywords_es, seo_keywords_en: it.seo_keywords_en,
      ficha_fabricante: { fabricante: m.fabricante, idioma: m.lang, url_origen: m.url, descargada: '2026-10-02' },
    };
    const apps = it.aplicaciones_es ? { es: it.aplicaciones_es, en: it.aplicaciones_en } : null;

    // descripción larga: por defecto reemplaza; con `append_descripcion` conserva la existente y añade el párrafo nuevo
    const joinDesc = (actual, nuevo) => (it.append_descripcion && actual && !actual.includes(nuevo) ? `${actual.trim()}\n\n${nuevo}` : nuevo);
    const descEs = joinDesc(base.descripcion_larga_es, it.descripcion_larga_es);
    const descEn = joinDesc(base.descripcion_larga_en, it.descripcion_larga_en);

    // 2. mock
    if (prod && !DRY) {
      prod.ficha_pdf = pdfRel;
      prod.descripcion_larga_es = descEs; prod.descripcion_larga_en = descEn;
      prod.especificaciones = specs;
      if (apps) { prod.aplicaciones_es = apps.es; prod.aplicaciones_en = apps.en; }
      prod.beneficios_es = attrs.beneficios_es; prod.beneficios_en = attrs.beneficios_en;
      prod.valor_es = attrs.valor_es; prod.valor_en = attrs.valor_en;
      prod.preguntas_frecuentes_es = attrs.preguntas_frecuentes_es; prod.preguntas_frecuentes_en = attrs.preguntas_frecuentes_en;
      prod.seo_keywords_es = attrs.seo_keywords_es; prod.seo_keywords_en = attrs.seo_keywords_en;
    }

    // 3. SQL
    sql.push(`UPDATE public.productos SET`,
      `  ficha_pdf = ${sq(pdfRel)},`,
      `  descripcion_larga_es = ${dq('d', descEs)},`,
      `  descripcion_larga_en = ${dq('d', descEn)},`,
      `  especificaciones = ${dq('j', specs)}::jsonb,`,
      ...(apps ? [`  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text(${dq('j', apps.es)}::jsonb)),`, `  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text(${dq('j', apps.en)}::jsonb)),`] : []),
      `  atributos = COALESCE(atributos, '{}'::jsonb) || ${dq('j', attrs)}::jsonb`,
      `WHERE slug = ${sq(m.slug)};`, '');
    total++;
  }
  if (!DRY) writeFileSync(path.join(root, 'supabase/migrations', `${TS}${String(files.indexOf(f) + 1).padStart(2, '0')}0000_enriquecer_fichas_${slugify(marca).replace(/-/g, '_')}.sql`), sql.join('\n'));
}
if (!DRY) writeFileSync(mockPath, JSON.stringify(mock, null, 2) + '\n');
console.log(`Productos procesados: ${total}${DRY ? ' (dry-run)' : ''}`);
if (sinProducto.length) console.log('Sin producto/manifest:', sinProducto.join(', '));
