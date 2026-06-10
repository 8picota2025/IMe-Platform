import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

page.on('response', async (response) => {
  const url = response.url()
  const ct = response.headers()['content-type'] || ''
  if (url.includes('i-me.com.co') && (ct.includes('javascript') || url.endsWith('.js'))) {
    try {
      const text = await response.text()
      if (
        text.includes('productos') ||
        text.includes('catalogo') ||
        text.includes('Monitor') ||
        text.includes('Ecógrafo')
      ) {
        const nombre = url.split('/').pop()?.split('?')[0] || 'script.js'
        writeFileSync(join(ROOT, 'src', 'data', `raw_js_${nombre}`), text, 'utf8')
        console.log('JS capturado:', url, '— bytes:', text.length)
      }
    } catch { /* ignorar */ }
  }
})

await page.goto('https://i-me.com.co/77/catalogo.html', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)

// Extraer todos los productos visibles con su categoría
const data = await page.evaluate(() => {
  // Buscar en window por arrays con objetos
  const keys = Object.keys(window).filter(k => {
    try {
      const v = window[k]
      return Array.isArray(v) && v.length > 5 && v[0] && typeof v[0] === 'object'
    } catch { return false }
  })

  // JSON-LD
  const jsonLDs = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map(s => { try { return JSON.parse(s.textContent || '') } catch { return null } })
    .filter(Boolean)

  // HTML completo del catálogo con contexto de familia
  const familiasSections = Array.from(
    document.querySelectorAll('[data-categoria], [data-familia], .categoria, .familia-section, .cat-section')
  ).map(el => ({
    familia: el.dataset.categoria || el.dataset.familia || el.className,
    html: el.innerHTML.slice(0, 3000)
  }))

  // Todos los productos visibles con su contenedor
  const todosCards = Array.from(
    document.querySelectorAll('.card, .producto-card, article.item, .product-item')
  ).map(card => {
    const nombre = card.querySelector('h2, h3, h4, .titulo, .card-title')?.textContent?.trim() || ''
    const desc = card.querySelector('p, .descripcion, .card-text')?.textContent?.trim() || ''
    const img = card.querySelector('img')?.src || ''
    const link = card.querySelector('a')?.href || ''
    // Buscar el contenedor padre para inferir familia
    const container = card.closest('[data-categoria], [data-familia], [class*="cat-"], [class*="familia-"]')
    const familia = container?.dataset?.categoria || container?.dataset?.familia || ''
    return { nombre, descripcion: desc.slice(0, 200), imagen: img, link, familia_inferida: familia }
  }).filter(c => c.nombre.length > 3)

  return {
    windowArrayKeys: keys.slice(0, 10),
    jsonLDs,
    familiasSections: familiasSections.slice(0, 5),
    todosCards
  }
})

console.log('Window arrays:', data.windowArrayKeys)
console.log('JSON-LDs:', data.jsonLDs.length)
console.log('Familia sections:', data.familiasSections.length)
console.log('Todos cards:', data.todosCards.length)
data.todosCards.slice(0, 10).forEach(c => console.log(' -', c.nombre, '|', c.familia_inferida))

writeFileSync(join(ROOT, 'src', 'data', 'raw_inspect_result.json'), JSON.stringify(data, null, 2), 'utf8')

await browser.close()
