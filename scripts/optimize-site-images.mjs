#!/usr/bin/env node
/**
 * Optimiza assets estáticos en public/assets/img:
 * - Convierte JPG/PNG referenciados a WebP (calidad ~78, max width 1600)
 * - Nombres SEO descriptivos cuando aplica
 * - Elimina huérfanos pesados (PNG/JPG con gemelo WebP no referenciado)
 *
 * No toca: logo-ime-pdf.png, whatsapp-pdf.png, favicon/apple-touch, portfolio legacy.
 */
import { unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const IMG = path.resolve('public/assets/img');
const MAX_WIDTH = 1600;
const WEBP_Q = 78;
const PNG_Q = 80;

/** Conversiones: origen → destino SEO WebP (y opcionalmente PNG OG comprimido). */
const CONVERT = [
  {
    from: 'surgery-room.jpg',
    to: 'sala-cirugia-hospitalaria-ime-colombia.webp',
    maxWidth: 1600,
  },
  {
    from: 'soluciones-biomedicas-opt.jpg',
    to: 'soluciones-biomedicas-opt.webp',
    maxWidth: 1200,
    skipIfTargetExists: true,
  },
];

/** PNG OG: recomprimir in-place (crawlers prefieren PNG/JPEG). */
const COMPRESS_PNG = ['og-default-ime.png', 'og-institutional-ime.png', 'logo-ime.png'];

/**
 * Huérfanos a borrar si existen (ya hay WebP o no se referencian en src/).
 * PDF assets y favicons NO van aquí.
 */
const DELETE_ORPHANS = [
  'hospital-uci-pasillo.png',
  'quirofano-inteligente.png',
  'tienda-material-biomedico.png',
  'soporte-tecnico-especializado.png',
  'equipamiento-biomedico-vanguardia.png',
  'venta-distribucion-equipos-biomedicos.png',
  'asesoramiento-tecnico-especializado.png',
  'equipamiento-biomedico.png',
  'soluciones-biomedicas-opt.jpg',
  'sala-cirugia-robotica.jpg',
  'sala-radiologia-diagnostica.jpg',
  'surgery-room.jpg',
  'javier-fundador-ime.png',
  'javier-fundador-ime-equipos-biomedicos-colombia.webp',
  'equipos-biomedicos-vanguardia.webp', // pages use *-opt.webp
  'soluciones-biomedicas.webp', // pages use *-opt.webp
  'quirofanos-inteligentes.webp', // pages use *-opt.webp
  'tienda-material-biomedico.webp', // pages use *-opt.webp
  'wr3d-equipo-multifuncional.jpg',
  'wr3d-equipo-multifuncional-3en1.jpg',
  'wr3d-equipo-vertical.jpg',
];

async function toWebp(fromName, toName, maxWidth = MAX_WIDTH) {
  const from = path.join(IMG, fromName);
  const to = path.join(IMG, toName);
  if (!existsSync(from)) {
    console.log(`[optimize] skip missing ${fromName}`);
    return null;
  }
  const base = sharp(from).rotate();
  const meta = await base.metadata();
  const pipeline =
    meta.width && meta.width > maxWidth ? base.resize({ width: maxWidth }) : base;
  const buf = await pipeline.webp({ quality: WEBP_Q, effort: 5 }).toBuffer();
  await writeFile(to, buf);
  const out = await sharp(buf).metadata();
  console.log(
    `[optimize] ${fromName} → ${toName} (${Math.round(buf.length / 1024)}KB ${out.width}x${out.height})`
  );
  return toName;
}

async function compressPng(name) {
  const file = path.join(IMG, name);
  if (!existsSync(file)) return;
  const { statSync } = await import('node:fs');
  const before = statSync(file).size;
  const buf = await sharp(file)
    .png({ quality: PNG_Q, compressionLevel: 9, palette: false })
    .toBuffer();
  if (buf.length < before) {
    await writeFile(file, buf);
    console.log(
      `[optimize] compress ${name}: ${Math.round(before / 1024)}KB → ${Math.round(buf.length / 1024)}KB`
    );
  } else {
    console.log(`[optimize] keep ${name} (no size win)`);
  }
}

async function main() {
  for (const job of CONVERT) {
    const target = path.join(IMG, job.to);
    if (job.skipIfTargetExists && existsSync(target)) {
      console.log(`[optimize] keep existing ${job.to}`);
      continue;
    }
    await toWebp(job.from, job.to, job.maxWidth);
  }

  for (const name of COMPRESS_PNG) {
    await compressPng(name);
  }

  // Re-encode oversized page WebPs that are still referenced
  const reencode = [{ name: 'equipamiento-biomedico-vanguardia.webp', maxWidth: 1400 }];
  for (const { name, maxWidth } of reencode) {
    const file = path.join(IMG, name);
    if (!existsSync(file)) continue;
    const before = (await import('node:fs')).statSync(file).size;
    const buf = await sharp(file)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: WEBP_Q, effort: 5 })
      .toBuffer();
    if (buf.length < before * 0.92) {
      await writeFile(file, buf);
      console.log(
        `[optimize] reencode ${name}: ${Math.round(before / 1024)}KB → ${Math.round(buf.length / 1024)}KB`
      );
    }
  }

  for (const name of DELETE_ORPHANS) {
    const file = path.join(IMG, name);
    if (!existsSync(file)) continue;
    await unlink(file);
    console.log(`[optimize] deleted orphan ${name}`);
  }

  console.log('[optimize] done');
}

main().catch(err => {
  console.error('[optimize] failed:', err);
  process.exit(1);
});
