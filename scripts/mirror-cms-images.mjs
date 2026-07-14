#!/usr/bin/env node
/**
 * Descarga las imágenes de artículos publicadas desde Supabase Storage,
 * las optimiza (resize + WebP) y las copia como assets estáticos de public/.
 *
 * El objetivo: el sitio construido sirve las imágenes directamente desde el
 * dominio de producción (Hostinger), sin depender de Supabase Storage en
 * tiempo de carga (evita latencia/timeouts cruzados y aprovecha el CDN del
 * propio hosting). Supabase sigue siendo el origen/fuente de verdad: el CMS
 * sube ahí, este script "traslada" una copia optimizada a la web en cada
 * build.
 *
 * Se ejecuta como paso previo a `astro build` (ver package.json). No-op
 * silencioso si no hay credenciales de Supabase (build local sin .env): deja
 * un manifest vacío y las páginas caen de vuelta a la URL de Supabase o al
 * fallback por palabra clave.
 */

import { createClient } from '@supabase/supabase-js';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;

const OUT_DIR = path.resolve('public/assets/img/conocimiento');
const MANIFEST_PATH = path.resolve('src/data/generated/articulo-imagenes.json');
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 82;

async function writeManifest(manifest) {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

async function clearOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
  const existing = await readdir(OUT_DIR).catch(() => []);
  await Promise.all(existing.map(name => unlink(path.join(OUT_DIR, name)).catch(() => {})));
}

async function mirrorOne(slug, imagenUrl) {
  const response = await fetch(imagenUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status} al descargar ${imagenUrl}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  const base = sharp(buffer).rotate();
  const metadata = await base.metadata();
  const resized =
    metadata.width && metadata.width > MAX_WIDTH ? base.resize({ width: MAX_WIDTH }) : base;
  const output = await resized.webp({ quality: WEBP_QUALITY }).toBuffer();
  const outputMeta = await sharp(output).metadata();

  const filename = `${slug}.webp`;
  await writeFile(path.join(OUT_DIR, filename), output);

  return {
    src: `/assets/img/conocimiento/${filename}`,
    width: outputMeta.width ?? MAX_WIDTH,
    height: outputMeta.height ?? Math.round((MAX_WIDTH * 9) / 16),
  };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log(
      '[mirror-cms-images] PUBLIC_SUPABASE_URL/PUBLIC_SUPABASE_ANON_KEY no configurados: se omite el mirror.'
    );
    await writeManifest({});
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('articulos')
    .select('slug, imagen')
    .eq('publicado', true)
    .not('imagen', 'is', null);

  if (error) {
    console.error(`[mirror-cms-images] Error consultando articulos: ${error.message}`);
    await writeManifest({});
    return;
  }

  await clearOutDir();
  const manifest = {};
  let ok = 0;
  let failed = 0;

  for (const row of data ?? []) {
    const slug = String(row.slug ?? '').trim();
    const imagenUrl = String(row.imagen ?? '').trim();
    if (!slug || !imagenUrl) continue;

    try {
      manifest[slug] = await mirrorOne(slug, imagenUrl);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `[mirror-cms-images] Fallo con "${slug}": ${err instanceof Error ? err.message : err}`
      );
    }
  }

  await writeManifest(manifest);
  console.log(`[mirror-cms-images] ${ok} imagen(es) trasladadas, ${failed} fallo(s).`);
}

main().catch(async err => {
  console.error('[mirror-cms-images] Error inesperado, se continua con manifest vacio:', err);
  await writeManifest({}).catch(() => {});
});
