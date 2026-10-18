#!/usr/bin/env node
/**
 * Download Saikang datasheet PDFs via Playwright (site returns 403 to plain curl).
 * Usage: node scripts/download-saikang-fichas.mjs
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const playwrightPaths = [
  '/home/shoky/.cursor/skills/playwright-skill/node_modules/playwright',
  '/home/shoky/.agents/skills/playwright-skill/node_modules/playwright',
  '/home/shoky/.claude/skills/gstack/node_modules/playwright',
  '/home/shoky/Grok-Build-Desktop-App/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright',
];

let chromium;
for (const p of playwrightPaths) {
  try {
    ({ chromium } = require(p));
    break;
  } catch {
    /* try next */
  }
}
if (!chromium) {
  console.error('playwright not found');
  process.exit(1);
}

const hall = JSON.parse(
  readFileSync(path.join(root, 'docs/audits/fichas-faltantes-2026-10-18/hallazgos-saikang.json'), 'utf8'),
);
const items = hall.items.filter((it) => it.ficha_url);
const destDir = path.join(root, 'public/assets/productos/fichas/saikang');
mkdirSync(destDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
const page = await context.newPage();
await page.goto('https://saikangmedical.com/en/', { waitUntil: 'domcontentloaded', timeout: 60000 });

const results = [];
for (const it of items) {
  try {
    const resp = await context.request.get(it.ficha_url, {
      headers: { Referer: 'https://saikangmedical.com/en/', Accept: 'application/pdf,*/*' },
      timeout: 120000,
    });
    const status = resp.status();
    const buf = Buffer.from(await resp.body());
    const ok = status === 200 && buf.subarray(0, 4).toString() === '%PDF';
    let outPath = null;
    if (ok) {
      const h = createHash('sha1').update(buf).digest('hex').slice(0, 10);
      outPath = path.join(destDir, `${it.slug.slice(0, 55)}-${h}.pdf`);
      if (!existsSync(outPath)) writeFileSync(outPath, buf);
    }
    results.push({ slug: it.slug, ok, status, bytes: buf.length, path: outPath, url: it.ficha_url });
    console.log(ok ? 'OK' : 'FAIL', status, it.slug.slice(0, 40), buf.length);
  } catch (e) {
    results.push({ slug: it.slug, ok: false, error: String(e), url: it.ficha_url });
    console.log('ERR', it.slug.slice(0, 40), e.message);
  }
}

await browser.close();
const out = path.join(root, 'docs/audits/fichas-faltantes-2026-10-18/download-saikang-playwright.json');
writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
console.log('SUMMARY', results.filter((r) => r.ok).length, '/', results.length);
