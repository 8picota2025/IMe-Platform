#!/usr/bin/env node
/** Reintento: abre cada resultado de búsqueda de gmd.com.co hasta hallar la página cuyo título es exactamente el SKU. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [,, inFile, outFile] = process.argv;
const todo = JSON.parse(readFileSync(inFile, 'utf8'));
const res = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};
const norm = s => s.toLowerCase().replace(/[^a-z0-9+]/g, '');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext();
async function worker(queue) {
  const page = await ctx.newPage();
  while (queue.length) {
    const [sku, hrefs] = queue.shift();
    let found = null;
    for (const h of hrefs) {
      try {
        await page.goto(h, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('a[href*="cms/delivery/media"]', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const title = await page.title();
        if (norm(title.replace('Producto:', '')) === norm(sku)) {
          const links = await page.$$eval('a', els => els.map(x => [x.innerText.trim().slice(0, 80), x.href]).filter(x => /cms\/delivery\/media/.test(x[1]) && x[0]));
          found = { title, url: h, links }; break;
        }
      } catch { /* siguiente */ }
    }
    res[sku] = found ?? { notfound: true };
    writeFileSync(outFile, JSON.stringify(res));
    console.log(sku, found ? found.links.map(l => l[0]).join(',') : 'NO ENCONTRADO');
  }
}
const queue = Object.entries(todo).filter(([s]) => !(s in res));
await Promise.all([worker(queue), worker(queue), worker(queue)]);
await browser.close();
