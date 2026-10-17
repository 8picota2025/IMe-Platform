#!/usr/bin/env node
/**
 * Sets product.marca / atributos from official ficha manufacturer metadata.
 * Does not change prices. Copies missing PDFs when origen_local exists.
 *
 * Usage: node scripts/set-marca-from-fichas.mjs [--dry-run]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const DRY = process.argv.includes('--dry-run');
const dir = path.join(root, 'src/data/fichas-enriquecimiento');
const mockPath = path.join(root, 'src/data/mock-productos.json');
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const mock = JSON.parse(readFileSync(mockPath, 'utf8'));
const mockBySlug = new Map(mock.map(p => [p.slug, p]));

const slugify = s =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const sq = v => `'${String(v).replace(/'/g, "''")}'`;

let marcaSet = 0;
let attrsSet = 0;
let pdfOk = 0;
let pdfCopied = 0;
let pdfMissing = 0;
const sql = [
  '-- audit/seo-geo-landings-20261017: set marca from official fichas manufacturer metadata',
  '-- No price changes. Idempotent UPDATE by slug.',
  '',
];

for (const m of manifest) {
  const p = mockBySlug.get(m.slug);
  if (!p || !m.fabricante) continue;

  if (!p.marca) {
    p.marca = m.fabricante;
    marcaSet++;
  }
  p.atributos = p.atributos && typeof p.atributos === 'object' ? p.atributos : {};
  if (!p.atributos.ficha_fabricante) {
    p.atributos.ficha_fabricante = {
      fabricante: m.fabricante,
      idioma: m.lang || 'es',
      url_origen: m.url || null,
      descargada: '2026-10-17',
    };
    attrsSet++;
  }
  if (!p.atributos.fabricante) p.atributos.fabricante = m.fabricante;
  if (!p.atributos.marca) p.atributos.marca = m.fabricante;

  if (m.origen_local && existsSync(m.origen_local)) {
    const pdfName = `${slugify(path.basename(m.origen_local, '.pdf'))}.pdf`;
    const pdfRel = `/assets/productos/fichas/${m.fab_slug}/${pdfName}`;
    const dest = path.join(root, 'public', pdfRel);
    if (!existsSync(dest)) {
      if (!DRY) {
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(m.origen_local, dest);
      }
      pdfCopied++;
    } else {
      pdfOk++;
    }
    if (!p.ficha_pdf) p.ficha_pdf = pdfRel;
  } else {
    pdfMissing++;
  }

  sql.push(
    `UPDATE public.productos SET marca = COALESCE(NULLIF(marca, ''), ${sq(m.fabricante)}), atributos = COALESCE(atributos, '{}'::jsonb) || jsonb_build_object('marca', ${sq(m.fabricante)}, 'fabricante', ${sq(m.fabricante)}, 'ficha_fabricante', jsonb_build_object('fabricante', ${sq(m.fabricante)}, 'idioma', ${sq(m.lang || 'es')}, 'url_origen', ${sq(m.url || '')}, 'descargada', '2026-10-17')) WHERE slug = ${sq(m.slug)};`,
  );
}

if (!DRY) {
  writeFileSync(mockPath, `${JSON.stringify(mock, null, 2)}\n`);
  writeFileSync(
    path.join(root, 'supabase/migrations/20261017210000_set_marca_from_fichas.sql'),
    `${sql.join('\n')}\n`,
  );
}

console.log(
  JSON.stringify(
    { dryRun: DRY, marcaSet, attrsSet, pdfOk, pdfCopied, pdfMissing, sqlStatements: sql.length - 3 },
    null,
    2,
  ),
);
