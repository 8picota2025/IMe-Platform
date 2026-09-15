/**
 * Deterministic SEO build validation (no network).
 * Fails if robots/sitemap hygiene or blocked URL inventory is wrong.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isIndexableSitemapUrl } from './sitemap-indexability.mjs';

const DIST = join(process.cwd(), 'dist');
const SITE_HOST = 'i-me.com.co';
const errors = [];

function fail(message) {
  errors.push(message);
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

function isSitemapXmlName(name) {
  return /^(?:sitemap-index|sitemap-(?:pages|products|knowledge)-\d+|sitemap-\d+)\.xml$/.test(
    name
  );
}

async function main() {
  let robots;
  try {
    robots = await readFile(join(DIST, 'robots.txt'), 'utf8');
  } catch {
    fail('robots.txt ausente en dist/');
    reportAndExit();
    return;
  }

  if (/User-agent:\s*Googlebot/i.test(robots) || /User-agent:\s*Bingbot/i.test(robots)) {
    fail('robots.txt: grupos Googlebot/Bingbot prohibidos (pueden eludir Disallow de *)');
  }
  if (/Disallow:\s*\/_astro/i.test(robots)) {
    fail('robots.txt: no bloquear /_astro/ (recursos de renderizado)');
  }
  if (!/Sitemap:\s*https:\/\/i-me\.com\.co\/sitemap-index\.xml/i.test(robots)) {
    fail('robots.txt: falta Sitemap canónico sitemap-index.xml');
  }
  if (/Sitemap:\s*https:\/\/i-me\.com\.co\/sitemap-0\.xml/i.test(robots)) {
    fail('robots.txt: no referenciar sitemap-0.xml además del index');
  }
  for (const path of ['/admin', '/77/', '/1old/', '/es/pago/', '/en/payment/']) {
    if (!robots.includes(`Disallow: ${path}`)) {
      fail(`robots.txt: falta Disallow ${path}`);
    }
  }

  const allFiles = await filesUnder(DIST);
  const sitemapFiles = allFiles.filter(file => isSitemapXmlName(file.split(/[\\/]/).pop() ?? ''));
  const indexFile = sitemapFiles.find(f => f.endsWith('sitemap-index.xml'));
  if (!indexFile) fail('sitemap-index.xml ausente en dist/');

  const locUrls = [];
  const seen = new Set();
  for (const file of sitemapFiles) {
    const xml = await readFile(file, 'utf8');
    if (!xml.includes('<') || xml.includes('<html')) {
      fail(`${file.split(/[\\/]/).pop()}: no parece XML válido`);
      continue;
    }
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = match[1].trim();
      locUrls.push({ url, file: file.split(/[\\/]/).pop() });
    }
  }

  let pageCount = 0;
  let knowledgeFound = false;
  for (const { url, file } of locUrls) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      fail(`URL inválida en ${file}: ${url}`);
      continue;
    }
    if (parsed.hostname !== SITE_HOST) {
      fail(`host incorrecto en ${file}: ${url}`);
      continue;
    }
    if (/\.xml$/i.test(parsed.pathname)) continue; // index → child sitemaps

    pageCount += 1;
    if (seen.has(url)) fail(`duplicado exacto: ${url}`);
    seen.add(url);

    if (!isIndexableSitemapUrl(url)) {
      fail(`URL no indexable en sitemap (${file}): ${parsed.pathname}`);
    }
    if (
      /\/(?:es\/conocimiento|en\/knowledge)\/?$/.test(parsed.pathname) ||
      /\/(?:es\/conocimiento|en\/knowledge)\//.test(parsed.pathname)
    ) {
      knowledgeFound = true;
    }
    if (parsed.pathname === '/blog' || parsed.pathname === '/blog/') {
      fail('sitemap contiene /blog');
    }
  }

  if (pageCount === 0) fail('sitemap sin URLs de página');
  if (!knowledgeFound) {
    fail('sitemap sin rutas editoriales conocimiento/knowledge');
  }

  reportAndExit();
  if (errors.length === 0) {
    console.log(
      `validate-seo: OK (robots + ${sitemapFiles.length} sitemap XML, ${pageCount} URLs página)`
    );
  }
}

function reportAndExit() {
  if (errors.length === 0) return;
  console.error(`validate-seo: ${errors.length} error(es)`);
  for (const error of errors.slice(0, 80)) console.error(`- ${error}`);
  if (errors.length > 80) console.error(`- ... y ${errors.length - 80} más`);
  process.exitCode = 1;
}

await main();
