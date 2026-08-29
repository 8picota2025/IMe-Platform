#!/usr/bin/env node
/**
 * Descarga imágenes CMS (articulos.imagen), optimiza a WebP y publica assets
 * estáticos con nombres SEO + hash de contenido (cache-bust).
 *
 * Fuente de verdad = URL en Supabase. El HTML del blog prioriza este mirror
 * solo cuando el artículo tiene imagen CMS; si no, usa fallbacks.
 *
 * Nombre: {slug}-conocimiento-equipos-biomedicos-ime-{hash8}.webp
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OUT_DIR = path.resolve('public/assets/img/conocimiento');
const MANIFEST_PATH = path.resolve('src/data/generated/articulo-imagenes.json');
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 78;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_WEBP_QUALITY = 82;

function sanitizeArticuloSlug(value) {
  let raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      raw = parts[parts.length - 1] ?? '';
    } catch {
      raw = raw.replace(/^https?:\/\//i, '').replace(/^\/+/, '');
    }
  }
  raw = raw.replace(/^\/+|\/+$/g, '');
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const RESERVED_SLUGS = new Set(['conocimiento', 'knowledge', 'publicar', 'publish', 'blog']);

function isValidArticuloSlug(slug) {
  if (!slug || slug.length > 120) return false;
  if (slug.includes('://') || /^https?:/i.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

async function writeManifest(manifest) {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

async function clearOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
  const existing = await readdir(OUT_DIR).catch(() => []);
  await Promise.all(existing.map(name => unlink(path.join(OUT_DIR, name)).catch(() => {})));
}

function seoFilename(slug, hash8, suffix = 'conocimiento-equipos-biomedicos-ime') {
  const safe = String(slug)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe}-${suffix}-${hash8}.webp`;
}

async function mirrorOne(slug, imagenUrl) {
  const response = await fetch(imagenUrl, {
    headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} al descargar ${imagenUrl}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const hash8 = createHash('sha1').update(buffer).digest('hex').slice(0, 8);

  const base = sharp(buffer).rotate();
  const metadata = await base.metadata();
  const resized =
    metadata.width && metadata.width > MAX_WIDTH ? base.resize({ width: MAX_WIDTH }) : base;
  const output = await resized.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
  const outputMeta = await sharp(output).metadata();

  const filename = seoFilename(slug, hash8);
  await writeFile(path.join(OUT_DIR, filename), output);

  const ogOutput = await sharp(buffer)
    .rotate()
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: OG_WEBP_QUALITY, effort: 4 })
    .toBuffer();
  const ogFilename = seoFilename(slug, hash8, 'og-red-social-equipos-biomedicos-ime');
  await writeFile(path.join(OUT_DIR, ogFilename), ogOutput);

  return {
    src: `/assets/img/conocimiento/${filename}`,
    width: outputMeta.width ?? MAX_WIDTH,
    height: outputMeta.height ?? Math.round((MAX_WIDTH * 9) / 16),
    og_src: `/assets/img/conocimiento/${ogFilename}`,
    og_width: OG_WIDTH,
    og_height: OG_HEIGHT,
    source_url: imagenUrl,
    hash: hash8,
  };
}

async function main() {
  if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
    console.log(
      '[mirror-cms-images] Sin PUBLIC_SUPABASE_URL / keys: se omite el mirror (manifest vacío).'
    );
    await writeManifest({});
    return;
  }

  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, key, {
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
    const slug = sanitizeArticuloSlug(row.slug);
    const imagenUrl = String(row.imagen ?? '').trim();
    if (!isValidArticuloSlug(slug) || !imagenUrl) continue;

    try {
      manifest[slug] = await mirrorOne(slug, imagenUrl);
      ok += 1;
      console.log(`[mirror-cms-images] OK ${slug} → ${manifest[slug].src}`);
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
