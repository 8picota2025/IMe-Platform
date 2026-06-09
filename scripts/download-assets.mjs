/**
 * F0 — Descarga de assets reales del sitio
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ASSETS_DIR = join(ROOT, 'public', 'assets', 'extraccion')
const DATA_DIR = join(ROOT, 'src', 'data')
const BASE_URL = 'https://i-me.com.co/77'

const extraccion = JSON.parse(readFileSync(join(DATA_DIR, 'extraccion_ime.json'), 'utf8'))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

async function descargar(url, destino) {
  const dir = dirname(destino)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  try {
    const resp = await page.request.get(url)
    if (resp.ok()) {
      const buf = await resp.body()
      writeFileSync(destino, buf)
      return { estado: 'ok', bytes: buf.length }
    }
    return { estado: `${resp.status()}` }
  } catch (e) {
    return { estado: 'error', detalle: e.message }
  }
}

const manifest = []

// Imágenes únicas de productos
const imagenesUnicas = [...new Set(
  extraccion.productos.map(p => p.imagen_principal)
)]

console.log(`Descargando ${imagenesUnicas.length} imágenes de productos...`)
for (const url of imagenesUnicas) {
  const nombre = url.split('/').pop()
  const destino = join(ASSETS_DIR, 'img', nombre)
  const result = await descargar(url, destino)
  manifest.push({ nombre, url_origen: url, ruta_local: `public/assets/extraccion/img/${nombre}`, tipo: 'img', uso: 'producto', ...result })
  const estado = result.estado === 'ok' ? `✓ ${nombre} (${result.bytes} bytes)` : `✗ ${nombre} — ${result.estado}`
  console.log(' ', estado)
}

// Assets clave adicionales
const assetsAdicionales = [
  { nombre: 'logo-ime.png',               url: `${BASE_URL}/assets/img/logo-ime.png`,              uso: 'logo' },
  { nombre: 'quirofano-completo.mp4',     url: `${BASE_URL}/assets/video/quirofano-completo.mp4`,  uso: 'video-hero' },
]

for (const asset of assetsAdicionales) {
  const ext = asset.nombre.split('.').pop()
  const tipo = ext === 'mp4' ? 'video' : 'img'
  const subdir = tipo === 'video' ? 'video' : 'img'
  const destino = join(ASSETS_DIR, subdir, asset.nombre)
  const result = await descargar(asset.url, destino)
  manifest.push({
    nombre: asset.nombre,
    url_origen: asset.url,
    ruta_local: `public/assets/extraccion/${subdir}/${asset.nombre}`,
    tipo,
    uso: asset.uso,
    ...result
  })
  console.log(`  ${result.estado === 'ok' ? '✓' : '✗'} ${asset.nombre}`)
}

writeFileSync(join(DATA_DIR, 'assets_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

const ok = manifest.filter(a => a.estado === 'ok').length
const fallos = manifest.filter(a => a.estado !== 'ok')
console.log(`\n✓ Manifest: ${manifest.length} total, ${ok} ok, ${manifest.length - ok} con error`)
if (fallos.length > 0) {
  console.log('Fallidos (TODO_CLIENTE):')
  fallos.forEach(f => console.log(`  - ${f.nombre}: ${f.estado}`))
}

await browser.close()
