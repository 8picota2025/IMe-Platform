#!/usr/bin/env node
/**
 * Repair Hostinger product 301s that steal live PDP URLs or chain to missing slugs.
 *
 * - Removes RewriteRules whose source is a current mock primary slug
 * - Regenerates the SEO (modelo+fabricante) block from mock legacy_slugs
 * - Drops remaining rules whose final hop is not a live primary
 * - Scrubs legacy_slugs that equal another product's primary
 *
 * Uso: node scripts/repair-product-htaccess-redirects.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PRODUCTS_MOCK = path.join(ROOT, 'src/data/mock-productos.json');
const HTACCESS = path.join(ROOT, 'public/.htaccess');
const SEO_START = '# SEO product slug migrations (modelo+fabricante) — generated';
const SEO_END = '# End SEO product slug migrations (modelo+fabricante)';

const RULE_RE =
  /^RewriteRule \^(es\/productos|en\/products)\/(.+?)\/\?\$ \/\1\/(.+?)\/ \[R=301,L\]$/;

function listLegacySlugs(atributos) {
  const raw = atributos?.legacy_slugs;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(value => typeof value === 'string' && value))];
}

function primaryProductSlugs(products) {
  return new Set(products.map(p => p.slug).filter(slug => typeof slug === 'string' && slug));
}

function sanitizeLegacySlugsAgainstPrimaries(legacy, ownSlug, primaries) {
  return [...new Set(legacy)].filter(slug => slug && slug !== ownSlug && !primaries.has(slug));
}

function buildSafeProductRedirectRules(products) {
  const primaries = primaryProductSlugs(products);
  const owners = new Map();

  for (const product of products) {
    if (!product.slug) continue;
    const legacy = sanitizeLegacySlugsAgainstPrimaries(
      listLegacySlugs(product.atributos),
      product.slug,
      primaries
    );
    for (const oldSlug of legacy) {
      const list = owners.get(oldSlug) ?? [];
      list.push(product.slug);
      owners.set(oldSlug, list);
    }
  }

  const rules = [];
  for (const [oldSlug, targets] of [...owners.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const uniqueTargets = [...new Set(targets)];
    if (uniqueTargets.length !== 1) continue;
    const target = uniqueTargets[0];
    if (!primaries.has(target)) continue;
    rules.push(
      `RewriteRule ^es/productos/${oldSlug}/?$ /es/productos/${target}/ [R=301,L]`,
      `RewriteRule ^en/products/${oldSlug}/?$ /en/products/${target}/ [R=301,L]`
    );
  }
  return rules;
}

function parseProductRules(lines) {
  const rules = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = RULE_RE.exec(lines[i] ?? '');
    if (!match) continue;
    rules.push({
      index: i,
      locale: match[1],
      source: match[2],
      target: match[3],
      line: lines[i],
    });
  }
  return rules;
}

function firstHopMap(rules) {
  const map = new Map();
  for (const rule of rules) {
    if (rule.locale !== 'es/productos') continue;
    if (!map.has(rule.source)) map.set(rule.source, rule.target);
  }
  return map;
}

function resolveFinal(slug, hopMap, maxHops = 12) {
  const hops = [slug];
  let cur = slug;
  const seen = new Set();
  while (hopMap.has(cur) && !seen.has(cur) && hops.length < maxHops) {
    seen.add(cur);
    cur = hopMap.get(cur);
    hops.push(cur);
  }
  return hops;
}

const products = JSON.parse(await readFile(PRODUCTS_MOCK, 'utf8'));
const primaries = primaryProductSlugs(products);

const scrubbedProducts = [];
for (const product of products) {
  if (!product?.slug || !product.atributos) continue;
  const before = listLegacySlugs(product.atributos);
  const after = sanitizeLegacySlugsAgainstPrimaries(before, product.slug, primaries);
  if (after.length !== before.length || after.some((slug, i) => slug !== before[i])) {
    product.atributos = { ...product.atributos, legacy_slugs: after };
    scrubbedProducts.push({ slug: product.slug, before, after });
  }
}

let mockText = await readFile(PRODUCTS_MOCK, 'utf8');
for (const scrub of scrubbedProducts) {
  const beforeLiteral = JSON.stringify(scrub.before);
  const afterLiteral = JSON.stringify(scrub.after);
  // Prefer compact single-line arrays as commonly stored in mock-productos.json
  const compactBefore = `      "legacy_slugs": ${beforeLiteral}`;
  const compactAfter = `      "legacy_slugs": ${afterLiteral}`;
  if (mockText.includes(compactBefore)) {
    mockText = mockText.replace(compactBefore, compactAfter);
    continue;
  }
  throw new Error(
    `Could not surgically scrub legacy_slugs for ${scrub.slug}; refusing to reformat mock JSON`
  );
}
if (scrubbedProducts.length > 0) {
  await writeFile(PRODUCTS_MOCK, mockText);
}

let htaccess = await readFile(HTACCESS, 'utf8');
const lines = htaccess.split('\n');

let droppedPrimarySources = 0;
const keep = lines.map(line => {
  const match = RULE_RE.exec(line);
  if (!match) return line;
  const source = match[2];
  if (primaries.has(source)) {
    droppedPrimarySources += 1;
    return null;
  }
  return line;
});

htaccess = keep.filter(line => line !== null).join('\n');

const seoRules = buildSafeProductRedirectRules(products);
const seoBlock = `\n\n${SEO_START}\n${seoRules.join('\n')}\n${SEO_END}\n`;
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const seoRe = new RegExp(`${escapeRe(SEO_START)}[\\s\\S]*?${escapeRe(SEO_END)}\\n?`, 'g');
htaccess = htaccess.replace(seoRe, '').trimEnd() + seoBlock;

const afterLines = htaccess.split('\n');
const esHops = firstHopMap(parseProductRules(afterLines));
let droppedDeadEnds = 0;
const repaired = afterLines.map(line => {
  const match = RULE_RE.exec(line);
  if (!match) return line;
  const source = match[2];
  const final = resolveFinal(source, esHops).at(-1);
  if (final && primaries.has(final)) return line;
  droppedDeadEnds += 1;
  return null;
});
htaccess = repaired.filter(line => line !== null).join('\n');
htaccess = htaccess.replace(/\n{3,}/g, '\n\n');
if (!htaccess.endsWith('\n')) htaccess += '\n';

await writeFile(HTACCESS, htaccess);

const verifyLines = htaccess.split('\n');
const verifyRules = parseProductRules(verifyLines);
const verifyHops = firstHopMap(verifyRules);
const primaryThefts = [];
const deadEnds = [];
for (const rule of verifyRules) {
  if (rule.locale !== 'es/productos') continue;
  if (primaries.has(rule.source)) primaryThefts.push(rule.source);
  const final = resolveFinal(rule.source, verifyHops).at(-1);
  if (!final || !primaries.has(final)) deadEnds.push(`${rule.source}→${final}`);
}

console.log(
  JSON.stringify(
    {
      legacyScrubbed: scrubbedProducts.length,
      scrubbedSlugs: scrubbedProducts.map(item => item.slug),
      droppedPrimarySources,
      seoRules: seoRules.length,
      droppedDeadEnds,
      remainingProductRules: verifyRules.length,
      primaryThefts,
      deadEnds: deadEnds.slice(0, 20),
      deadEndCount: deadEnds.length,
      samples: {
        ainno: resolveFinal('saikang-ainno', verifyHops).at(-1),
        nube: resolveFinal('g-gmrn-211', verifyHops).at(-1),
        tipoAvionLegacy: resolveFinal('g-kp9806l', verifyHops).at(-1),
        tipoAvionPrimaryStolen: verifyHops.has(
          'silla-de-ruedas-de-transporte-en-aluminio-tipo-avion'
        ),
      },
    },
    null,
    2
  )
);

if (primaryThefts.length || deadEnds.length) {
  console.error('Repair incomplete — remaining invariant violations.');
  process.exitCode = 1;
}
