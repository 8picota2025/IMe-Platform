#!/usr/bin/env node
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LEGACY_PORTFOLIO_DIR =
  process.env.LEGACY_PORTFOLIO_DIR ?? '/home/shoky/bacups/1 old web frist/images/portfolio'
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const repoRoot = process.cwd()
const targetRoot = path.join(repoRoot, 'public/assets/productos/importados')

const legacyProducts = [
  ['VSM-300', 'Img1.jpg', 'Img1-Zoom.jpg'],
  ['IP-200', 'Img2.jpg', 'Img2-Zoom.png'],
  ['OT-500', 'Img4.jpg', 'Img4-Zoom.jpg'],
  ['ECG-3-Plus', 'Img5.jpg', 'Img5-Zoom.jpg'],
  ['ECG-12C', 'Img6.jpg', 'Img6-Zoom.jpg'],
  ['B-1000-PRO', 'Img7.jpg', 'Img7-Zoom.jpg'],
  ['B-2000', 'Img8.jpg', 'Img8-Zoom.jpg'],
  ['B-2000-PLUS', 'Img9.jpg', 'Img9-Zoom.jpg'],
  ['OT-30', 'Img10.jpg', 'Img10-Zoom.jpg'],
  ['PM-2000XL-PRO', 'Img11.jpg', 'Img11.jpg'],
  ['A3186', 'Img12.jpg', 'Img12-Zoom.jpg'],
  ['A3186-Plus', 'Img13.jpg', 'Img13-Zoom.jpg'],
  ['A4051', 'Img14.jpg', 'Img14-Zoom.jpg'],
  ['ST-100', 'Img15.jpg', 'Img15-Zoom.jpg'],
  ['PM-200M', 'Img16.jpg', 'Img16-Zoom.jpg'],
  ['PM-2000A-PRO', 'Img17.jpg', 'Img17-Zoom.jpg'],
  ['PM-2000M', 'Img18.jpg', 'Img18-Zoom.jpg'],
  ['PM-2000XL', 'Img19.jpg', 'Img19-Zoom.jpg'],
  ['ST-2000', 'Img20.jpg', 'Img20-Zoom.jpg'],
  ['PT-2000', 'Img21.jpg', 'Img21-Zoom.jpg'],
  ['SL-Series', 'Img22.jpg', 'Img22-Zoom.jpg'],
  ['OT-500', 'Img24.jpg', 'Img24-Zoom.jpg'],
  ['A3158', 'Img25.jpg', 'Img25-Zoom.jpg'],
  ['DUS-5000-PLUS', 'Img26.jpg', 'Img26-Zoom.jpg'],
  ['DUS-5000', 'Img27.jpg', 'Img27-Zoom.jpg'],
  ['DUS-6000', 'Img28.jpg', 'Img28-Zoom.jpg'],
]

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeSku(value) {
  return slugify(value).replace(/-/g, '')
}

function normalizedName(name) {
  const parsed = path.parse(name)
  return `${slugify(parsed.name)}${parsed.ext.toLowerCase()}`
}

function publicAsset(slug, filename) {
  return `/assets/productos/importados/${slug}/${filename}`
}

function dedupe(values) {
  const out = []
  const seen = new Set()
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

const { data: rows, error } = await supabase
  .from('productos')
  .select('id,slug,sku,imagen_principal,galeria,atributos')

if (error) throw error

const bySku = new Map((rows ?? []).map((row) => [normalizeSku(row.sku || row.slug), row]))
let matched = 0
let copied = 0
let updated = 0
let skipped = 0

for (const [sku, imageName, zoomName] of legacyProducts) {
  const row = bySku.get(normalizeSku(sku))
  if (!row) {
    skipped += 1
    continue
  }
  matched += 1
  const targetDir = path.join(targetRoot, row.slug)
  if (!DRY_RUN) await mkdir(targetDir, { recursive: true })

  const files = dedupe([imageName, zoomName])
  const publicFiles = []
  for (const file of files) {
    const filename = `legacy-${normalizedName(file)}`
    if (!DRY_RUN) {
      await copyFile(path.join(LEGACY_PORTFOLIO_DIR, file), path.join(targetDir, filename))
    }
    copied += 1
    publicFiles.push(publicAsset(row.slug, filename))
  }

  const galeria = Array.isArray(row.galeria) ? row.galeria : []
  const atributos =
    row.atributos && typeof row.atributos === 'object' && !Array.isArray(row.atributos)
      ? { ...row.atributos }
      : {}
  const payload = {
    imagen_principal: publicFiles[0],
    galeria: dedupe([publicFiles[0], ...publicFiles.slice(1), ...galeria]),
    atributos: {
      ...atributos,
      legacy_portfolio_source: 'i-me backup portfolio',
      legacy_portfolio_synced_at: new Date().toISOString(),
    },
  }

  if (!DRY_RUN) {
    const { error: updateError } = await supabase.from('productos').update(payload).eq('id', row.id)
    if (updateError) throw updateError
  }
  updated += 1
}

console.log(
  JSON.stringify(
    {
      dry_run: DRY_RUN,
      productos_mapeados: legacyProducts.length,
      productos_con_match: matched,
      productos_sin_match: skipped,
      archivos_copiados: copied,
      productos_actualizados: updated,
    },
    null,
    2
  )
)
