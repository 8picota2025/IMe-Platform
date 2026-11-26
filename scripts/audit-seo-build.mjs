import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { goneProductSlugs, REDIRECT_ONLY_PRODUCT_PATHS } from './sitemap-indexability.mjs';

const GONE_PRODUCT_SLUGS = goneProductSlugs();

const DIST = join(process.cwd(), 'dist');
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

function normalizePath(value) {
  const withoutQuery = value.split(/[?#]/, 1)[0];
  if (!withoutQuery || withoutQuery === '/') return '/';
  return withoutQuery.endsWith('/') ? withoutQuery : `${withoutQuery}/`;
}

function localFileForPath(pathname) {
  const normalized = normalizePath(pathname);
  return join(DIST, normalized === '/' ? 'index.html' : normalized.slice(1), 'index.html');
}

function localAssetForPath(pathname) {
  return join(DIST, pathname.replace(/^\//, '').split(/[?#]/, 1)[0]);
}

function extractOne(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

async function main() {
  const htmlFiles = (await filesUnder(DIST)).filter(file => file.endsWith('.html'));
  if (htmlFiles.length === 0) fail('dist no contiene HTML');

  const generatedPaths = new Set(
    htmlFiles.map(file => {
      const rel = relative(DIST, file).split(sep).join('/');
      if (rel === 'index.html') return '/';
      return `/${rel.replace(/index\.html$/, '')}`;
    })
  );

  const bannedBrand = /\b(?:Northern|Monnal|Crius|T75)\b/i;
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const brandHit = html.match(bannedBrand);
    if (brandHit) {
      fail(`${relative(DIST, file)}: marca retirada (${brandHit[0]})`);
    }
    const rel = relative(DIST, file).split(sep).join('/');
    const page = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
    const title = extractOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const canonical = extractOne(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
    );
    const robots = extractOne(
      html,
      /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i
    ).toLowerCase();
    const isTechnicalPage = /\.(?:html|json)$/i.test(page) || robots.includes('noindex');
    if (!isTechnicalPage && !title) fail(`${page}: title ausente`);
    if (!isTechnicalPage && !canonical) fail(`${page}: canonical ausente`);
    if (canonical && !/^https:\/\/i-me\.com\.co\//i.test(canonical)) {
      fail(`${page}: canonical fuera de host: ${canonical}`);
    }

    const jsonLdBlocks = [
      ...html.matchAll(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      ),
    ];
    for (const [, block] of jsonLdBlocks) {
      try {
        JSON.parse(block);
      } catch {
        fail(`${page}: JSON-LD inválido`);
      }
    }

    if (/\/pagina\/\d+\/$/.test(page)) {
      if (!robots.includes('noindex') || robots.includes('nofollow')) {
        fail(`${page}: paginación N>1 debe ser noindex, follow`);
      }
    }
    if (html.includes('TollFree')) fail(`${page}: ContactPoint no debe decir TollFree`);
    if (html.includes('Pórtatil')) fail(`${page}: typo Pórtatil`);
    if (
      (page === '/es/' || page === '/en/') &&
      !/<link\b[^>]*href="https:\/\/i-me\.com\.co\/llms\.txt"[^>]*>/i.test(html)
    ) {
      fail(`${page}: falta el enlace a llms.txt`);
    }
    const productMatch = page.match(/^\/(?:es\/productos|en\/products)\/([^/]+)\/$/);
    if (productMatch) {
      const slug = productMatch[1];
      const prefix = page.startsWith('/en/') ? '/en/products/' : '/es/productos/';
      const suppressed =
        GONE_PRODUCT_SLUGS.has(slug) || REDIRECT_ONLY_PRODUCT_PATHS.has(`${prefix}${slug}/`);
      const hasProduct = jsonLdBlocks.some(([, block]) =>
        /"@type":"Product"|"@type":\["Product"/.test(block)
      );
      if (suppressed && hasProduct) fail(`${page}: ficha 410/301 no debe emitir Product`);
      if (!suppressed && !robots.includes('noindex') && !hasProduct) {
        fail(`${page}: ficha indexable sin JSON-LD Product`);
      }
    }

    const hrefTags = [...html.matchAll(/<(?:a|link)\b[^>]*>/gi)];
    for (const match of robots.includes('noindex') ? [] : hrefTags) {
      const tag = match[0];
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? '';
      if (!href) continue;
      if (/\brel=["'][^"']*alternate[^"']*["']/i.test(tag) && /\bhreflang=/i.test(tag)) continue;
      if (!href || /^(?:https?:|mailto:|tel:|javascript:|#|data:)/i.test(href)) continue;
      const rawPath = href.startsWith('/')
        ? href
        : new URL(href, `https://i-me.com.co${page}`).pathname;
      const hasFileExtension = /\.[a-z0-9]{1,8}$/i.test(rawPath.split(/[?#]/, 1)[0]);
      if (hasFileExtension) {
        if (!(await fileExists(localAssetForPath(rawPath)))) {
          fail(`${page}: asset interno sin destino generado: ${rawPath}`);
        }
        continue;
      }
      const pathname = normalizePath(rawPath);
      if (!pathname.startsWith('/')) continue;
      if (!generatedPaths.has(pathname) && !(await fileExists(localFileForPath(pathname)))) {
        fail(`${page}: enlace interno sin destino generado: ${pathname}`);
      }
    }

    if (robots.includes('noindex') && page !== '/' && page.includes('/congreso/')) {
      // Explicitly allowed campaign exclusion; checked again against sitemap below.
    }
  }

  const requiredSeoPaths = [
    '/es/monitores-biolight-uci/',
    '/es/alto-flujo-fisher-paykel/',
    '/es/camillas-medicas/',
    '/es/ventiladores-mecanicos-uci/',
    '/es/desfibriladores-hospitalarios/',
    '/es/dotacion-monitoreo-uci/',
    '/es/caminadores-para-adultos/',
    '/es/conocimiento/caminadores-para-adultos-guia-compra-colombia/',
    '/en/biolight-icu-monitors/',
    '/en/fisher-paykel-high-flow/',
    '/en/medical-stretchers/',
    '/en/mechanical-ventilators-icu/',
    '/en/hospital-defibrillators/',
    '/en/icu-monitoring-projects/',
    '/en/knowledge/caminadores-para-adultos-guia-compra-colombia/',
  ];
  const sitemapPaths = new Set();

  const sitemapFiles = (await filesUnder(DIST)).filter(file =>
    /sitemap(?:-index|-(?:pages|products|knowledge)-\d+|-\d+)?\.xml$/.test(
      file.replace(/\\/g, '/').split('/').pop() ?? ''
    )
  );
  if (!sitemapFiles.some(f => f.endsWith('sitemap-index.xml'))) {
    fail('sitemap-index.xml ausente');
  }
  let sawLastmod = false;
  let sawHreflang = false;
  for (const sitemapFile of sitemapFiles) {
    const xml = await readFile(sitemapFile, 'utf8');
    if (xml.includes('<lastmod>')) sawLastmod = true;
    if (xml.includes('hreflang') || xml.includes('xhtml:link')) sawHreflang = true;
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = match[1];
      const pathname = new URL(url).pathname;
      // sitemap-index.xml lista otros sitemaps (*.xml), no páginas HTML
      if (/\.xml$/i.test(pathname)) continue;
      sitemapPaths.add(pathname);
      const file = localFileForPath(pathname);
      if (!(await fileExists(file))) fail(`sitemap: destino no generado: ${pathname}`);
      const html = await readFile(file, 'utf8').catch(() => '');
      const robots = extractOne(
        html,
        /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i
      ).toLowerCase();
      if (robots.includes('noindex')) fail(`sitemap: URL noindex: ${pathname}`);
      if (pathname === '/congreso/') fail('sitemap: /congreso/ no debe aparecer');
    }
  }
  for (const pathname of requiredSeoPaths) {
    if (!sitemapPaths.has(pathname)) fail(`sitemap: falta URL SEO prioritaria: ${pathname}`);
  }
  if (!sawLastmod) fail('sitemap: falta lastmod en entradas');
  if (!sawHreflang) fail('sitemap: falta hreflang (xhtml:link)');
  for (const pathname of sitemapPaths) {
    if (/\/pagina\/\d+\/$/.test(pathname)) fail(`sitemap: paginación noindex ${pathname}`);
  }
  const indexNowKey = (await readFile(join(DIST, '.well-known/indexnow-key.txt'), 'utf8')).trim();
  const indexNowRoot = (await readFile(join(DIST, `${indexNowKey}.txt`), 'utf8')).trim();
  if (!/^[a-f0-9]{8,128}$/.test(indexNowKey) || indexNowRoot !== indexNowKey) {
    fail('IndexNow: la clave pública de dist/ no coincide');
  }
  const tensiometro = join(DIST, 'en/knowledge/como-elegir-tensiometro-digital/index.html');
  if (await fileExists(tensiometro)) {
    const guide = await readFile(tensiometro, 'utf8');
    if (!guide.includes('How to choose a blood pressure monitor')) {
      fail('guía EN de tensiómetro: el title desplegado no está en el HTML');
    }
  }

  if (errors.length > 0) {
    console.error(`SEO build audit: ${errors.length} error(es)`);
    for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
    if (errors.length > 100) console.error(`- ... y ${errors.length - 100} más`);
    process.exitCode = 1;
    return;
  }
  console.log(`SEO build audit: OK (${htmlFiles.length} HTML, ${sitemapFiles.length} sitemap XML)`);
}

async function fileExists(file) {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

await main();
