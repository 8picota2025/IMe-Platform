#!/usr/bin/env node
/**
 * Genera hero WebP con nombres SEO para landings GSC recientes.
 * Fuente: fotos de producto del catálogo + fondos clínicos existentes.
 */
import { execSync } from 'node:child_process';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('.');
const IMG = path.join(ROOT, 'public/assets/img');
const PROD = path.join(ROOT, 'public/assets/productos/importados');

const WEBP_Q = 78;
const HERO_W = 1600;
const HERO_H = 1200;

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function heroCover(source, outName, maxWidth = HERO_W) {
  const out = path.join(IMG, outName);
  const buf = await sharp(source)
    .rotate()
    .resize(maxWidth, null, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: WEBP_Q, effort: 5 })
    .toBuffer();
  const meta = await sharp(buf).metadata();
  await writeFile(out, buf);
  console.log(`[hero] ${outName} (${Math.round(buf.length / 1024)}KB ${meta.width}x${meta.height})`);
  return outName;
}

async function loadProductImage(source) {
  if (typeof source === 'string' && source.startsWith('http')) {
    const buf = await fetchBuffer(source);
    const ext = path.extname(new URL(source).pathname).toLowerCase();
    if (ext === '.avif') {
      const avif = path.join(IMG, '.tmp-hero.avif');
      const png = path.join(IMG, '.tmp-hero.png');
      await writeFile(avif, buf);
      execSync(`ffmpeg -y -i ${avif} ${png}`, { stdio: 'ignore' });
      await unlink(avif).catch(() => {});
      return png;
    }
    const tmp = path.join(IMG, `.tmp-hero${ext || '.bin'}`);
    await writeFile(tmp, buf);
    return tmp;
  }
  return source;
}

async function heroComposite({ bg, product, outName, productScale = 0.62, darken = 0.9 }) {
  const out = path.join(IMG, outName);
  const productPath = await loadProductImage(product);
  const bgBuf = await sharp(bg)
    .rotate()
    .resize(HERO_W, HERO_H, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: darken })
    .toBuffer();

  const prodMeta = await sharp(productPath).rotate().metadata();
  const prodW = Math.round(HERO_W * productScale);
  const prodH = Math.round(prodW * ((prodMeta.height ?? 1) / (prodMeta.width ?? 1)));
  const productBuf = await sharp(productPath)
    .rotate()
    .resize(prodW, prodH, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const placed = await sharp(productBuf).metadata();
  const left = Math.round((HERO_W - (placed.width ?? prodW)) / 2);
  const top = Math.round((HERO_H - (placed.height ?? prodH)) / 2);

  const buf = await sharp(bgBuf)
    .composite([{ input: productBuf, left, top }])
    .webp({ quality: WEBP_Q, effort: 5 })
    .toBuffer();
  await writeFile(out, buf);
  console.log(`[hero] ${outName} composite (${Math.round(buf.length / 1024)}KB)`);
  return outName;
}

async function main() {
  await mkdir(IMG, { recursive: true });

  const uciBg = path.join(IMG, 'hospital-uci-pasillo.webp');
  const rehabBg = path.join(IMG, 'robotica-rehabilitacion-institucional-colombia.webp');

  if (!existsSync(uciBg)) throw new Error('Missing hospital-uci-pasillo.webp');

  await heroComposite({
    bg: uciBg,
    product: path.join(
      PROD,
      'monitor-de-paciente-modular-serie-p-ref-p15-biolight/imagen-principal-monitor-de-paciente-modular-serie-p-ref-p15-biolight.jpg'
    ),
    outName: 'monitores-biolight-p15-uci-colombia.webp',
    productScale: 0.58,
  });

  await heroComposite({
    bg: uciBg,
    product: path.join(
      PROD,
      'sistema-de-alto-flujo-ref-airvo-3-fisher-paykel/imagen-principal-sistema-de-alto-flujo-ref-airvo-3-fisher-paykel.png'
    ),
    outName: 'alto-flujo-fisher-paykel-airvo-uci-colombia.webp',
    productScale: 0.52,
  });

  await heroCover(
    path.join(PROD, 'saikang-skb041-6/imagen-principal.jpg'),
    'camillas-medicas-traslado-hospitalario-colombia.webp'
  );

  const caminadorUrl =
    'https://nnfbucwiasuggyfoyydo.supabase.co/storage/v1/object/public/productos/gmd/dd1d8e366df5613f1277e01c5a779f916cd2c9c05cef758d338f6d3da64fb421.avif';

  if (existsSync(rehabBg)) {
    await heroComposite({
      bg: rehabBg,
      product: caminadorUrl,
      outName: 'caminadores-adultos-konfort-plus-colombia.webp',
      productScale: 0.55,
      darken: 0.95,
    });
  } else {
    const caminadorPath = await loadProductImage(caminadorUrl);
    await heroCover(caminadorPath, 'caminadores-adultos-konfort-plus-colombia.webp');
  }

  await heroComposite({
    bg: uciBg,
    product: path.join(
      PROD,
      'ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide/imagen-principal-ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide.jpg'
    ),
    outName: 'ventiladores-mecanicos-monnal-uci-colombia.webp',
    productScale: 0.54,
  });

  await heroComposite({
    bg: uciBg,
    product: path.join(ROOT, 'public/assets/extraccion/img/Img6.jpg'),
    outName: 'desfibriladores-hospitalarios-reanimacion-colombia.webp',
    productScale: 0.5,
    darken: 0.88,
  });

  console.log('[hero] done');
}

main().catch(err => {
  console.error('[hero] failed:', err);
  process.exit(1);
});
