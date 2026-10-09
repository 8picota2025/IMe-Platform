#!/usr/bin/env node
/**
 * Espejo de fichas técnicas PDF: Supabase Storage → hosting (Hostinger).
 *
 * Fuente de verdad = `productos.ficha_pdf` (URL pública de Supabase Storage).
 * Antes de `astro build` descarga cada PDF de productos activos y lo deja en
 * public/assets/productos/<slug>/ficha-tecnica.pdf, para que la landing ofrezca
 * la descarga desde https://i-me.com.co. El manifest
 * src/data/generated/fichas-pdf.json dice a la landing qué slugs tienen espejo.
 *
 * Nunca pisa un fichero versionado en el repo: si el destino existe y no lo
 * creó una ejecución anterior de este script, se respeta y se omite.
 * Si falta Supabase o algo falla, escribe manifest vacío y el build sigue
 * (la landing usa entonces la URL de Supabase).
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OUT_ROOT = path.resolve('public/assets/productos');
const MANIFEST_PATH = path.resolve('src/data/generated/fichas-pdf.json');
const MAX_BYTES = 25 * 1024 * 1024;
const STORAGE_MARK = '/storage/v1/object/public/';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function destinoFicha(slug) {
  return {
    file: path.join(OUT_ROOT, slug, 'ficha-tecnica.pdf'),
    src: `/assets/productos/${slug}/ficha-tecnica.pdf`,
  };
}

export function esFichaEnStorage(url, supabaseUrl) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    const base = supabaseUrl ? new URL(supabaseUrl) : null;
    if (base && parsed.host !== base.host) return false;
    return parsed.pathname.includes(STORAGE_MARK) && parsed.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

function leerManifestPrevio() {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeManifest(manifest) {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

async function limpiarPrevios(previo) {
  for (const slug of Object.keys(previo)) {
    if (!SLUG_RE.test(slug)) continue;
    await unlink(destinoFicha(slug).file).catch(() => {});
  }
}

async function mirrorOne(slug, url) {
  const response = await fetch(url, { headers: { Accept: 'application/pdf' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) throw new Error(`demasiado grande (${declared} B)`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) throw new Error(`demasiado grande (${buffer.byteLength} B)`);
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('no es un PDF');
  const { file, src } = destinoFicha(slug);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  return {
    src,
    source_url: url,
    bytes: buffer.byteLength,
    sha1: createHash('sha1').update(buffer).digest('hex').slice(0, 12),
  };
}

async function main() {
  const previo = leerManifestPrevio();
  await limpiarPrevios(previo);

  if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
    console.log('[mirror-fichas-pdf] Sin PUBLIC_SUPABASE_URL / keys: se omite (manifest vacío).');
    await writeManifest({});
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('productos')
    .select('slug, ficha_pdf')
    .eq('activo', true)
    .not('ficha_pdf', 'is', null);
  if (error) {
    console.error(`[mirror-fichas-pdf] Error consultando productos: ${error.message}`);
    await writeManifest({});
    return;
  }

  const manifest = {};
  let ok = 0;
  let omitidos = 0;
  let fallos = 0;
  for (const row of data ?? []) {
    const slug = String(row.slug ?? '').trim();
    const url = String(row.ficha_pdf ?? '').trim();
    if (!SLUG_RE.test(slug) || !esFichaEnStorage(url, SUPABASE_URL)) continue;
    if (existsSync(destinoFicha(slug).file)) {
      omitidos += 1;
      console.warn(`[mirror-fichas-pdf] Omitido ${slug}: el destino ya existe en el repo.`);
      continue;
    }
    try {
      manifest[slug] = await mirrorOne(slug, url);
      ok += 1;
    } catch (err) {
      fallos += 1;
      console.error(
        `[mirror-fichas-pdf] Fallo con "${slug}": ${err instanceof Error ? err.message : err}`
      );
    }
  }

  await writeManifest(manifest);
  console.log(
    `[mirror-fichas-pdf] ${ok} ficha(s) copiadas, ${omitidos} omitida(s), ${fallos} fallo(s).`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async err => {
    console.error('[mirror-fichas-pdf] Error inesperado, se continúa con manifest vacío:', err);
    await writeManifest({}).catch(() => {});
  });
}
