#!/usr/bin/env node
/**
 * Localiza en gmd.com.co (titular de Konfort Plus, Carditek, Latidos, Nube)
 * el enlace "FT-<SKU>" (ficha técnica) y "Manual" de cada SKU.
 * Uso: node scripts/gmd-fichas.mjs <skus.json> <salida.json>
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [,, inFile, outFile] = process.argv;
const skus = JSON.parse(readFileSync(inFile, 'utf8')).map(x => x[0]);
const res = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext();
async function worker(queue) {
  const page = await ctx.newPage();
  while (queue.length) {
    const s = queue.shift();
    try {
      await page.goto('https://www.gmd.com.co/global-search/' + encodeURIComponent(s), { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('a[href*="/product/"]', { timeout: 20000 }).catch(() => {});
      const hrefs = await page.$$eval('a[href*="/product/"]', e => [...new Set(e.map(x => x.href))]);
      const r = { search: hrefs.slice(0, 5), title: null, links: [] };
      if (hrefs.length) {
        await page.goto(hrefs[0], { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('a[href*="cms/delivery/media"]', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        r.title = await page.title();
        r.links = await page.$$eval('a', els => els.map(x => [x.innerText.trim().slice(0, 80), x.href]).filter(x => /cms\/delivery\/media/.test(x[1]) && x[0]));
      }
      res[s] = r;
    } catch (e) { res[s] = { err: String(e).slice(0, 100) }; }
    writeFileSync(outFile, JSON.stringify(res));
    console.log(s, res[s].title ?? res[s].err, res[s].links?.map(l => l[0]).join(','));
  }
}
const queue = skus.filter(s => !(s in res));
await Promise.all([worker(queue), worker(queue), worker(queue)]);
await browser.close();
