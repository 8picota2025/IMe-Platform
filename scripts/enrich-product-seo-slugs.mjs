#!/usr/bin/env node
/**
 * Enriquece URLs de producto con modelo/referencia + fabricante, además de la
 * descripción comercial ya presente.
 *
 * Uso:
 *   node --env-file=.env scripts/enrich-product-seo-slugs.mjs            # dry-run
 *   node --env-file=.env scripts/enrich-product-seo-slugs.mjs --apply    # escribe
 *   node --env-file=.env scripts/enrich-product-seo-slugs.mjs --strict-ref --apply
 *
 * Efectos con --apply:
 * - Actualiza `productos.slug` y `atributos.legacy_slugs` en Supabase
 * - Actualiza `src/data/mock-productos.json` y claves de image manifest
 * - Reescribe el bloque de redirects en `public/.htaccess`
 * - Sustituye slugs hardcodeados en fuentes del repo
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  ensureUniqueProductoSeoSlug,
  mergeLegacySlugs,
  planProductoSeoSlug,
} from '../src/lib/producto-seo-slug.ts';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');
const STRICT_REF = process.argv.includes('--strict-ref');
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : Infinity;

const PRODUCTS_MOCK = path.join(ROOT, 'src/data/mock-productos.json');
const IMAGE_MANIFEST = path.join(ROOT, 'src/data/product-image-manifest.json');
const HTACCESS = path.join(ROOT, 'public/.htaccess');
const START = '# SEO product slug migrations (modelo+fabricante) — generated';
const END = '# End SEO product slug migrations (modelo+fabricante)';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadActiveProducts() {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from('productos')
      .select('id,slug,nombre_es,sku,atributos,activo')
      .eq('activo', true)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function buildPlans(products) {
  const occupied = new Set(products.map(product => product.slug));
  const plans = [];

  for (const product of products) {
    const draft = planProductoSeoSlug(
      {
        slug: product.slug,
        nombre_es: product.nombre_es,
        sku: product.sku,
        atributos: product.atributos,
      },
      { strictRef: STRICT_REF }
    );
    if (!draft.changed) continue;

    occupied.delete(draft.oldSlug);
    const unique = ensureUniqueProductoSeoSlug(
      draft.newSlug,
      occupied,
      draft.model || product.sku || product.id
    );
    occupied.add(unique);
    plans.push({
      id: product.id,
      ...draft,
      newSlug: unique,
      atributos: product.atributos ?? {},
    });
    if (plans.length >= LIMIT) break;
  }
  return plans;
}

async function applySupabase(plans) {
  let updated = 0;
  for (const plan of plans) {
    const legacy = mergeLegacySlugs(plan.atributos.legacy_slugs, plan.oldSlug, plan.newSlug);
    const atributos = {
      ...plan.atributos,
      legacy_slugs: legacy,
    };
    const { error } = await supabase
      .from('productos')
      .update({ slug: plan.newSlug, atributos })
      .eq('id', plan.id);
    if (error) {
      console.error(`Error actualizando ${plan.oldSlug}:`, error.message);
      process.exitCode = 1;
      continue;
    }
    updated += 1;
  }
  return updated;
}

async function updateMock(plans) {
  const byOld = new Map(plans.map(plan => [plan.oldSlug, plan]));
  const products = JSON.parse(await readFile(PRODUCTS_MOCK, 'utf8'));
  let touched = 0;
  for (const product of products) {
    const plan = byOld.get(product.slug);
    if (!plan) continue;
    product.atributos = {
      ...(product.atributos ?? {}),
      legacy_slugs: mergeLegacySlugs(
        product.atributos?.legacy_slugs,
        plan.oldSlug,
        plan.newSlug
      ),
    };
    product.slug = plan.newSlug;
    touched += 1;
  }
  if (APPLY) {
    await writeFile(PRODUCTS_MOCK, `${JSON.stringify(products, null, 2)}\n`);
  }
  return touched;
}

async function updateImageManifest(plans) {
  const manifest = JSON.parse(await readFile(IMAGE_MANIFEST, 'utf8'));
  let touched = 0;
  for (const plan of plans) {
    if (manifest[plan.oldSlug] && !manifest[plan.newSlug]) {
      manifest[plan.newSlug] = manifest[plan.oldSlug];
      touched += 1;
    }
  }
  if (APPLY && touched > 0) {
    await writeFile(IMAGE_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return touched;
}

async function updateHtaccess(allProductsWithLegacy) {
  let htaccess = await readFile(HTACCESS, 'utf8');
  const previous = new RegExp(`${START}[\\s\\S]*?${END}\\n?`, 'g');
  const rules = allProductsWithLegacy.flatMap(product => {
    const legacy = Array.isArray(product.atributos?.legacy_slugs)
      ? product.atributos.legacy_slugs
      : [];
    return legacy
      .filter(oldSlug => oldSlug && oldSlug !== product.slug)
      .flatMap(oldSlug => [
        `RewriteRule ^es/productos/${oldSlug}/?$ /es/productos/${product.slug}/ [R=301,L]`,
        `RewriteRule ^en/products/${oldSlug}/?$ /en/products/${product.slug}/ [R=301,L]`,
      ]);
  });
  const block = `\n\n${START}\n${rules.join('\n')}\n${END}\n`;
  htaccess = htaccess.replace(previous, '').trimEnd() + block;
  if (APPLY) await writeFile(HTACCESS, htaccess);
  return rules.length;
}

function rewriteSlugMentions(text, oldSlug, newSlug) {
  if (!text.includes(oldSlug)) return text;
  const escaped = oldSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Solo contextos de URL o literales exactos — evita colisiones con substrings cortos.
  const patterns = [
    new RegExp(`(/es/productos/)${escaped}(?=/|"|'|\\s|$)`, 'g'),
    new RegExp(`(/en/products/)${escaped}(?=/|"|'|\\s|$)`, 'g'),
    new RegExp(`(['"\`])${escaped}\\1`, 'g'),
  ];
  let next = text;
  for (const pattern of patterns) {
    next = next.replace(pattern, (match, prefixOrQuote) => {
      if (prefixOrQuote === "'" || prefixOrQuote === '"' || prefixOrQuote === '`') {
        return `${prefixOrQuote}${newSlug}${prefixOrQuote}`;
      }
      return `${prefixOrQuote}${newSlug}`;
    });
  }
  return next;
}

async function rewriteSourceReferences(plans) {
  const map = new Map(plans.map(plan => [plan.oldSlug, plan.newSlug]));
  if (map.size === 0) return 0;

  const roots = ['src', 'scripts', 'supabase', 'docs'];
  const exts = new Set(['.ts', '.tsx', '.astro', '.mjs', '.js', '.md', '.json', '.sql']);
  let filesTouched = 0;

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
          continue;
        }
        await walk(full);
        continue;
      }
      if (!exts.has(path.extname(entry.name))) continue;
      if (
        full.endsWith('mock-productos.json') ||
        full.endsWith('product-image-manifest.json') ||
        full.endsWith('producto-seo-slug.test.ts') ||
        full.endsWith('producto-seo-slug.ts')
      ) {
        continue;
      }
      const text = await readFile(full, 'utf8');
      let next = text;
      for (const [oldSlug, newSlug] of map) {
        next = rewriteSlugMentions(next, oldSlug, newSlug);
      }
      if (next !== text) {
        filesTouched += 1;
        if (APPLY) await writeFile(full, next);
      }
    }
  }

  for (const root of roots) {
    await walk(path.join(ROOT, root));
  }
  return filesTouched;
}

const products = await loadActiveProducts();
const plans = buildPlans(products);

console.log(
  JSON.stringify(
    {
      mode: APPLY ? 'apply' : 'dry-run',
      strictRef: STRICT_REF,
      activeProducts: products.length,
      renames: plans.length,
      sample: plans.slice(0, 25).map(plan => ({
        from: plan.oldSlug,
        to: plan.newSlug,
        brand: plan.brand,
        model: plan.model,
      })),
    },
    null,
    2
  )
);

if (!APPLY) {
  console.log('\nDry-run OK. Re-ejecuta con --apply para escribir Supabase + repo.');
  process.exit(0);
}

const supabaseUpdated = await applySupabase(plans);
const mockUpdated = await updateMock(plans);
const manifestUpdated = await updateImageManifest(plans);

const refreshed = await loadActiveProducts();
const redirectCount = await updateHtaccess(refreshed);
const sourcesTouched = await rewriteSourceReferences(plans);

console.log(
  JSON.stringify(
    {
      supabaseUpdated,
      mockUpdated,
      manifestUpdated,
      redirectRules: redirectCount,
      sourcesTouched,
    },
    null,
    2
  )
);
