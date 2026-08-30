#!/usr/bin/env node
/**
 * Copia heroes editoriales GSC desde ~/0mktime/assets (WebP por URL/locale).
 * No recorta ni compone sobre fotos de producto.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve('.');
const IMG = path.join(ROOT, 'public/assets/img');
const SRC = path.join(os.homedir(), '0mktime/assets');

const FILES = [
  'adult-walkers-en.webp',
  'alto-flujo-fisher-paykel-es.webp',
  'biolight-icu-monitors-en.webp',
  'buying-guide-adult-walkers-en.webp',
  'camillas-medicas-es.webp',
  'caminadores-para-adultos-es.webp',
  'desfibriladores-hospitalarios-es.webp',
  'fisher-paykel-high-flow-en.webp',
  'guia-compra-caminadores-es.webp',
  'hospital-defibrillators-en.webp',
  'mechanical-ventilators-icu-en.webp',
  'medical-stretchers-en.webp',
  'monitores-biolight-uci-es.webp',
  'sillas-de-ruedas-es.webp',
  'ventiladores-mecanicos-uci-es.webp',
  'wheelchairs-en.webp',
];

async function main() {
  await mkdir(IMG, { recursive: true });
  if (!existsSync(SRC)) {
    console.warn(`[hero] skip: missing ${SRC}`);
    return;
  }
  for (const name of FILES) {
    const from = path.join(SRC, name);
    if (!existsSync(from)) {
      console.warn(`[hero] missing ${name}`);
      continue;
    }
    await copyFile(from, path.join(IMG, name));
    console.log(`[hero] copied ${name}`);
  }
  console.log('[hero] done');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
