#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const assetsDir = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) {
  console.error('Uso: node scripts/import-product-seo-images.mjs <directorio-con-zips>');
  process.exit(1);
}

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'public/assets/productos/seo');
const manifestPath = path.join(repoRoot, 'src/data/product-image-manifest.json');
const productsPath = path.join(repoRoot, 'src/data/mock-productos.json');

// Los paquetes específicos contienen las correcciones más recientes y se procesan al final.
const archives = [
  'productos-ime-todos-lotes-4.zip',
  'productos-ime-fotos-malas.zip',
  'productos-ime-sin-foto.zip',
];

const aliases = new Map([
  ['ventilador-para-uci-v-1000', 'ventilador-para-uci-ref-v-1000-advanced'],
  ['monitor-modular-biolight-ref-p15', 'monitor-de-paciente-modular-serie-p-ref-p15-biolight'],
  ['monitor-multiparametro-biolight-ref-m12', 'monitor-de-paciente-ref-m12-biolight'],
]);

function listEntries(archivePath) {
  return execFileSync('unzip', ['-Z1', archivePath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean);
}

function extractEntry(archivePath, entry) {
  return execFileSync('unzip', ['-p', archivePath, entry], {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function isWebp(buffer) {
  return (
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

const products = JSON.parse(await readFile(productsPath, 'utf8'));
const publishedSlugs = new Set(products.map(product => product.slug));
const selected = new Map();
const skipped = new Set();

for (const archiveName of archives) {
  const archivePath = path.join(assetsDir, archiveName);
  for (const entry of listEntries(archivePath)) {
    const filename = path.posix.basename(entry);
    if (!filename.endsWith('__catalogo.webp')) continue;

    const sourceSlug = filename.slice(0, -'__catalogo.webp'.length);
    if (!/^[a-z0-9-]+$/.test(sourceSlug)) {
      throw new Error(`Slug no seguro en ${archiveName}: ${sourceSlug}`);
    }

    const targetSlug = aliases.get(sourceSlug) ?? sourceSlug;
    if (!publishedSlugs.has(targetSlug)) {
      skipped.add(sourceSlug);
      continue;
    }

    selected.set(targetSlug, { archivePath, archiveName, entry, sourceSlug });
  }
}

await mkdir(outputDir, { recursive: true });
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
let totalBytes = 0;

for (const [slug, source] of [...selected.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const image = extractEntry(source.archivePath, source.entry);
  if (!isWebp(image)) {
    throw new Error(`Archivo WebP inválido: ${source.archiveName}/${source.entry}`);
  }

  const outputName = `${slug}.webp`;
  await writeFile(path.join(outputDir, outputName), image);
  manifest[slug] = `/assets/productos/seo/${outputName}`;
  totalBytes += image.length;
}

const sortedManifest = Object.fromEntries(
  Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))
);
await writeFile(manifestPath, `${JSON.stringify(sortedManifest, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      imported: selected.size,
      skipped: [...skipped].sort(),
      bytes: totalBytes,
      outputDir: path.relative(repoRoot, outputDir),
    },
    null,
    2
  )
);
