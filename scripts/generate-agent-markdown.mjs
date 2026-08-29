#!/usr/bin/env node
/**
 * Post-build: emit index.md siblings + 404.md for acceptmarkdown.com negotiation.
 */
import { readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import mockProductos from '../src/data/mock-productos.json' with { type: 'json' };

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const SITE = 'https://i-me.com.co';

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractTitle(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
}

function extractCanonical(html) {
  return (
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim() ?? ''
  );
}

function pageMarkdownFromHtml(html, fallbackPath) {
  const title = extractTitle(html) || 'I-ME';
  const description = extractMeta(html, 'description') || '';
  const canonical = extractCanonical(html) || `${SITE}${fallbackPath}`;
  const body = stripHtml(html).slice(0, 4000);
  return `# ${title}\n\n${description}\n\nCanonical: ${canonical}\n\n${body}\n`;
}

function productMarkdown(product, locale) {
  const prefix = locale === 'en' ? '/en/products/' : '/es/productos/';
  const nombre = locale === 'en' ? product.nombre_en || product.nombre_es : product.nombre_es;
  const desc =
    locale === 'en'
      ? product.descripcion_corta_en || product.descripcion_corta_es
      : product.descripcion_corta_es;
  const longDesc =
    locale === 'en'
      ? product.descripcion_larga_en || product.descripcion_larga_es
      : product.descripcion_larga_es;
  const canonical = `${SITE}${prefix}${product.slug}/`;
  const lines = [
    `# ${nombre}`,
    '',
    desc,
    '',
    `Canonical: ${canonical}`,
    product.sku ? `SKU: ${product.sku}` : '',
    product.marca ? `Manufacturer: ${product.marca}` : '',
    '',
  ].filter(Boolean);
  if (longDesc) lines.push('## Description', '', longDesc.trim(), '');
  lines.push(
    '## Note for agents',
    '',
    'Confirm specifications, regulatory status, price, and availability with I-ME before presenting as commitments.',
    ''
  );
  return lines.join('\n');
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(absolute)));
    else files.push(absolute);
  }
  return files;
}

async function writeMarkdownSibling(htmlPath) {
  const rel = relative(DIST, htmlPath).split(sep).join('/');
  const pagePath =
    rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
  const html = await readFile(htmlPath, 'utf8');

  let markdown = pageMarkdownFromHtml(html, pagePath);

  const productMatch = pagePath.match(/^\/(es\/productos|en\/products)\/([^/]+)\/$/);
  if (productMatch) {
    const locale = productMatch[1].startsWith('/en') ? 'en' : 'es';
    const slug = productMatch[2];
    const product = mockProductos.find(item => item.slug === slug);
    if (product) markdown = productMarkdown(product, locale);
  }

  const mdPath = htmlPath.replace(/index\.html$/, 'index.md');
  await writeFile(mdPath, markdown, 'utf8');
}

async function main() {
  const htmlFiles = (await filesUnder(DIST)).filter(
    file => file.endsWith('index.html') && !file.includes('/admin/') && !file.includes('/comercial/')
  );

  await Promise.all(htmlFiles.map(writeMarkdownSibling));

  const notFoundMd = `# Page not found (404)

The requested URL does not exist on I-ME International Medical Enterprise.

## Where to look next

- Sitemap index: ${SITE}/sitemap-index.xml
- Agent instructions: ${SITE}/llms.txt
- Spanish catalog: ${SITE}/es/catalogo/
- English catalog: ${SITE}/en/catalog/
- Contact (ES): ${SITE}/es/contacto/
- Contact (EN): ${SITE}/en/contact/

## About I-ME

I-ME distributes certified biomedical equipment, technical support, and financing for hospitals and clinics in Colombia. Confirm specifications, availability, and pricing with I-ME before citing product details as commitments.
`;

  await writeFile(join(DIST, '404.md'), notFoundMd, 'utf8');

  const public404 = join(ROOT, 'public', '404.md');
  try {
    await copyFile(join(DIST, '404.md'), public404);
  } catch {
    await writeFile(public404, notFoundMd, 'utf8');
  }

  console.log(`agent-markdown: wrote ${htmlFiles.length} index.md files + 404.md`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
