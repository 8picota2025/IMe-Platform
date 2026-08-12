#!/usr/bin/env node
/** Convierte URLs de producto técnicas en nombres comerciales legibles. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PRODUCTS = path.join(ROOT, 'src/data/mock-productos.json');
const HTACCESS = path.join(ROOT, 'public/.htaccess');
const START = '# Product slug migrations — generated';
const END = '# End product slug migrations';

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function isOpaque(slug) {
  return /^(?:[a-z]{1,5}[\d-]*|[a-z]+-\d+(?:-[a-z0-9]+)*)$/i.test(slug) || slug.split('-').length < 3;
}

function canonicalName(producto) {
  let name = String(producto.nombre_es ?? '').split('|')[0].trim().replace(/\+/g, ' Plus ');
  const brand = String(producto.marca ?? '').trim();
  const brandIsUseful = brand.length > 2 && !/^(monitor de|circuito desechable|autoclave \d+)/i.test(brand);
  if (brandIsUseful && !name.toLowerCase().includes(brand.toLowerCase())) name += ` ${brand}`;
  return name;
}

const products = JSON.parse(await readFile(PRODUCTS, 'utf8'));
const occupied = new Set(products.map(producto => producto.slug));
const migrations = [];

for (const producto of products) {
  const hasFallbackSuffix = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{2}$/i.test(producto.slug);
  const lostPlus = String(producto.nombre_es ?? '').includes('+') && !producto.slug.includes('plus');
  if (producto.marca === 'Saikang Medical' || (!isOpaque(producto.slug) && !hasFallbackSuffix && !lostPlus)) continue;
  const oldSlug = producto.slug;
  const base = slugify(canonicalName(producto));
  if (!base) continue;
  let newSlug = base;
  if (newSlug !== oldSlug && occupied.has(newSlug)) {
    newSlug = `${base}-${slugify(producto.sku ?? producto.id).slice(0, 16)}`;
  }
  if (newSlug === oldSlug || occupied.has(newSlug)) continue;
  occupied.delete(oldSlug);
  occupied.add(newSlug);
  producto.slug = newSlug;
  producto.atributos = {
    ...(producto.atributos ?? {}),
    legacy_slugs: [...new Set([...(producto.atributos?.legacy_slugs ?? []), oldSlug])].filter(slug => slug !== newSlug),
  };
  migrations.push({ oldSlug, newSlug });
}

let htaccess = await readFile(HTACCESS, 'utf8');
const oldBlock = new RegExp(`${START}[\\s\\S]*?${END}\\n?`, 'g');
const rules = products
  .filter(producto => producto.marca !== 'Saikang Medical')
  .flatMap(producto =>
    (producto.atributos?.legacy_slugs ?? [])
      .filter(oldSlug => oldSlug && oldSlug !== producto.slug)
      .flatMap(oldSlug => [
        `RewriteRule ^es/productos/${oldSlug}/?$ /es/productos/${producto.slug}/ [R=301,L]`,
        `RewriteRule ^en/products/${oldSlug}/?$ /en/products/${producto.slug}/ [R=301,L]`,
      ])
  );
htaccess = htaccess.replace(oldBlock, '').trimEnd() + `\n\n${START}\n${rules.join('\n')}\n${END}\n`;
await writeFile(PRODUCTS, `${JSON.stringify(products, null, 2)}\n`);
await writeFile(HTACCESS, htaccess);
console.log(JSON.stringify({ renamed: migrations.length, sample: migrations.slice(0, 12) }, null, 2));
