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
  return /^(?:sitemap-index|sitemap-(?:pages|products|knowledge)-\d+|sitemap-\d+)\.xml$/.test(name);
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

  await checkFichasUnix();

  reportAndExit();
  if (errors.length === 0) {
    console.log(
      `validate-seo: OK (robots + ${sitemapFiles.length} sitemap XML, ${pageCount} URLs página)`
    );
  }
}

/**
 * Fichas UniX: sin stock documentado ni precio público, el HTML no puede afirmar
 * disponibilidad; el título lleva un único sufijo de marca; la meta cabe en 155 caracteres;
 * la ficha EN emite FAQPage y sus grupos de especificaciones están en inglés.
 */
const FICHAS_UNIX = [
  {
    locale: 'es',
    segmento: 'productos',
    slug: 'unix-wanda-2-0-pro-robot-humanoide-ref-wanda-2-0-pro-unix',
  },
  {
    locale: 'es',
    segmento: 'productos',
    slug: 'unix-panther-pro-robot-humanoide-ref-panther-pro-unix',
  },
  {
    locale: 'es',
    segmento: 'productos',
    slug: 'unix-pioneer-h-robot-cuadrupedo-ref-pioneer-h-unix',
  },
  {
    locale: 'en',
    segmento: 'products',
    slug: 'unix-wanda-2-0-pro-robot-humanoide-ref-wanda-2-0-pro-unix',
  },
  {
    locale: 'en',
    segmento: 'products',
    slug: 'unix-panther-pro-robot-humanoide-ref-panther-pro-unix',
  },
  {
    locale: 'en',
    segmento: 'products',
    slug: 'unix-pioneer-h-robot-cuadrupedo-ref-pioneer-h-unix',
  },
];
const DISPONIBILIDAD_SIN_STOCK =
  />\s*(?:Disponible|Available|Stock disponible|Stock Disponible|Stock Available)\s*</;
const GRUPOS_EN_ESPANOL =
  /^(?:Básicos|Rendimiento|Articulaciones|Percepción|Inteligencia|Comunicación|Accesorios|Sistema|Batería|Movilidad|Seguridad|Teleoperación|Cabeza|Cómputo|Conectividad|Funciones|Brazo biónico|Cámaras)$/;

async function checkFichasUnix() {
  for (const { locale, segmento, slug } of FICHAS_UNIX) {
    const archivo = join(DIST, locale, segmento, slug, 'index.html');
    const etiqueta = `${locale}/${segmento}/${slug}`;
    let html;
    try {
      html = await readFile(archivo, 'utf8');
    } catch {
      fail(`ficha UniX ausente en dist/: ${etiqueta}`);
      continue;
    }

    if (DISPONIBILIDAD_SIN_STOCK.test(html)) {
      fail(`ficha UniX afirma disponibilidad sin stock documentado: ${etiqueta}`);
    }
    const frase = locale === 'es' ? 'Disponibilidad bajo cotización' : 'Availability on request';
    if (!html.includes(frase)) fail(`ficha UniX sin «${frase}»: ${etiqueta}`);

    const titulo = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const sufijos = titulo.match(/\| I-ME/g)?.length ?? 0;
    if (sufijos !== 1 || !titulo.endsWith('| I-ME')) {
      fail(`título UniX con sufijo de marca repetido o ausente (${sufijos}): ${etiqueta}`);
    }

    const meta = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    if (!meta || meta.length > 155) {
      fail(`meta description UniX vacía o de ${meta.length} caracteres (máx. 155): ${etiqueta}`);
    }

    if (!html.includes('"@type":"FAQPage"')) fail(`ficha UniX sin FAQPage JSON-LD: ${etiqueta}`);

    if (locale === 'en') {
      const grupos = [...html.matchAll(/specs-grupo__titulo"[^>]*>([^<]*)</g)].map(m =>
        m[1].trim()
      );
      const enEspanol = grupos.filter(g => GRUPOS_EN_ESPANOL.test(g));
      if (enEspanol.length > 0) {
        fail(`grupos de especificaciones en español en EN (${enEspanol.join(', ')}): ${etiqueta}`);
      }
    }
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
