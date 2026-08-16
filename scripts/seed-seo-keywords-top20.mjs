#!/usr/bin/env node
/**
 * Seed seo_keywords_es/en en productos.atributos (Supabase) para top-20 SEO Phase 1.
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... PUBLIC_SUPABASE_URL=... node scripts/seed-seo-keywords-top20.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const url = (process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Falta PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const kwPath = path.join(root, 'docs/seo/top20-keywords.json');
const pack = JSON.parse(fs.readFileSync(kwPath, 'utf8'));

async function main() {
  let ok = 0;
  let fail = 0;
  for (const [slug, kw] of Object.entries(pack)) {
    const getRes = await fetch(
      `${url}/rest/v1/productos?slug=eq.${encodeURIComponent(slug)}&select=id,slug,atributos`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    );
    if (!getRes.ok) {
      console.error('GET fail', slug, getRes.status, await getRes.text());
      fail++;
      continue;
    }
    const rows = await getRes.json();
    const row = rows[0];
    if (!row) {
      console.warn('missing', slug);
      fail++;
      continue;
    }
    const prev = row.atributos && typeof row.atributos === 'object' ? row.atributos : {};
    const atributos = {
      ...prev,
      seo_keywords_es: kw.es,
      seo_keywords_en: kw.en,
    };
    const patchRes = await fetch(`${url}/rest/v1/productos?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ atributos }),
    });
    if (!patchRes.ok) {
      console.error('PATCH fail', slug, patchRes.status, await patchRes.text());
      fail++;
      continue;
    }
    ok++;
    console.log('ok', slug);
  }
  console.log(JSON.stringify({ ok, fail, total: Object.keys(pack).length }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
