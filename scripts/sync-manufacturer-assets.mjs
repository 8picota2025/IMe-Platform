#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const repoRoot = process.cwd()
const targetRoot = path.join(repoRoot, 'public/assets/productos/importados')

const sources = [
  {
    sku: 'SK-C1-V2k',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/v2k-manual-hospital-bed/',
    images: [
      'https://saikangmedical.com/wp-content/uploads/2025/07/V2k5c1-1.jpg',
      'https://saikangmedical.com/wp-content/uploads/2025/07/V2k5c1-2.jpg',
      'https://saikangmedical.com/wp-content/uploads/2025/07/V2k5c1-3.jpg',
    ],
  },
  {
    sku: 'SK-CD1-V4w',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/v4w-manual-bed/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/10/S2-18.jpg'],
  },
  {
    sku: 'SKH046-11',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skh046-11-table-a-manger-amovible/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/2_-30.jpg'],
  },
  {
    sku: 'SKH046-2',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skh046-2-overbed-table/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/2_-29.jpg'],
  },
  {
    sku: 'SKH042',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skh042-overbed-table/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/SKH042-2-_-1.jpg'],
  },
  {
    sku: 'SKM-B-SKH006-1',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skh006c-instrument-trolley/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/09/S2-5.jpg'],
  },
  {
    sku: 'SKM-B-SKH041-5',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skh04115-iv-stand/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/10/S2-11.jpg'],
  },
  {
    sku: 'SKS008',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/sks008-abssteel-hospital-bedside-cabinet/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/2-32.png'],
  },
  {
    sku: 'SKS009-2',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/sks009-2-phenolic-resin-hospital-bedside-cabinet/',
    images: [
      'https://saikangmedical.com/wp-content/uploads/2025/08/3_-26.jpg',
      'https://saikangmedical.com/wp-content/uploads/2025/08/4_-25.jpg',
    ],
  },
  {
    sku: 'SKS036',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/sks036-hospital-bedside-cabinet/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/1_-35.jpg'],
  },
  {
    sku: 'SKM-B-SK-CT75077C2',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/sk-ct75077c2-treatment-trolley/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/S2-2.jpg'],
  },
  {
    sku: 'SKB3A104',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skb3a104-soft-stretcher/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/a_-17.jpg'],
  },
  {
    sku: 'SKM-A-SKR-IB00',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skr-ib00-simple-laptop-cart/',
    images: [
      'https://saikangmedical.com/wp-content/uploads/2025/08/SKR-IB00-S1.jpg',
      'https://saikangmedical.com/wp-content/uploads/2025/08/SKR-IB00-S2.jpg',
      'https://saikangmedical.com/wp-content/uploads/2025/08/SKR-IB00-S3.jpg',
    ],
  },
  {
    sku: 'SKE011',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/ske011-treat-waiting-chair/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/SKE011-1.jpg'],
  },
  {
    sku: 'SKE011-1',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/ske011-1-treat-waiting-chair/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/SKE011-1-2-.jpg'],
  },
  {
    sku: 'SKE020-1',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/ske020-1-step-stool/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/SKE020-1_1.jpg'],
  },
  {
    sku: 'SKE001',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/ske001-attendant-chair/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/2-33.png'],
  },
  {
    sku: 'SKP011',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skp011-sectional-memory-foam-mattress/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/9_-16.jpg'],
  },
  {
    sku: 'SKR-AT625-1',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skr-at625-1-anesthesia-trolley/',
    images: [
      'https://saikangmedical.com/wp-content/uploads/2025/08/S2-5.jpg',
      'https://saikangmedical.com/wp-content/uploads/2025/08/S3-2.jpg',
    ],
  },
  {
    sku: 'SKR058-CT',
    manufacturer: 'Saikang',
    page: 'https://saikangmedical.com/en/product/skr058-ct-nursing-trolley/',
    images: ['https://saikangmedical.com/wp-content/uploads/2025/08/SKR058-CT-S2.jpg'],
  },
  {
    sku: 'AM-6000-PLUS',
    manufacturer: 'Advanced',
    page: 'https://advanced-inst.com/am-6000/',
    images: ['https://advanced-inst.com/wp-content/uploads/2019/11/am-6000-1.png'],
    pdfs: ['https://advanced-inst.com/wp-content/uploads/2019/11/AM-6000.-pdf.pdf'],
  },
  {
    sku: 'DM156',
    manufacturer: 'Angell Technology',
    page: 'https://medsyst.kz/catalog/mammografy/angell-dm156a/',
    images: [
      'https://medsyst.kz/upload/iblock/849/j2g3i87f09qhtjp2doaxgue230bf5gvy/202008101758515851.png',
    ],
    pdfs: ['https://medsyst.kz/upload/iblock/70e/ng8pn7134j85nnc335xhorpqcch4nu4i/Broshyura-Angell-DM156A.pdf'],
  },
  {
    sku: 'OT-300C',
    manufacturer: 'Advanced',
    page: 'https://advanced-inst.com/electric-operating-table/',
    images: [
      'https://advanced-inst.com/wp-content/uploads/2019/11/OT-300C.png',
      'https://advanced-inst.com/wp-content/uploads/2019/11/OT-300C-2.png',
    ],
    pdfs: ['https://advanced-inst.com/wp-content/uploads/2019/11/OT-300C.pdf'],
  },
  {
    sku: 'DUS-7000',
    manufacturer: 'Advanced',
    page: 'https://advanced-inst.com/ultrasound-system-dus-7000/',
    images: ['https://advanced-inst.com/wp-content/uploads/2019/11/DUS-7000-1.png'],
  },
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

function extensionFrom(url, contentType) {
  const ext = path.extname(new URL(url).pathname).toLowerCase()
  if (ext) return ext
  const type = String(contentType ?? '').toLowerCase()
  if (type.includes('pdf')) return '.pdf'
  if (type.includes('png')) return '.png'
  if (type.includes('webp')) return '.webp'
  return '.jpg'
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

async function download(url, slug, index, kind = 'manufacturer') {
  const res = await fetch(url, {
    headers: {
      accept: kind === 'datasheet' ? 'application/pdf,*/*;q=0.8' : 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      referer: new URL(url).origin,
      'user-agent': 'Mozilla/5.0 I-ME catalog asset importer',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} descargando ${url}`)
  const ext = extensionFrom(url, res.headers.get('content-type'))
  const filename = `${kind}-${String(index + 1).padStart(2, '0')}${ext}`
  const bytes = Buffer.from(await res.arrayBuffer())
  if (!DRY_RUN) {
    await mkdir(path.join(targetRoot, slug), { recursive: true })
    await writeFile(path.join(targetRoot, slug, filename), bytes)
  }
  return publicAsset(slug, filename)
}

const { data: rows, error } = await supabase
  .from('productos')
  .select('id,slug,sku,imagen_principal,galeria,atributos')

if (error) throw error

const bySku = new Map((rows ?? []).map((row) => [normalizeSku(row.sku || row.slug), row]))
let matched = 0
let downloaded = 0
let downloadedPdfs = 0
let updated = 0
let failed = 0
const failures = []

for (const source of sources) {
  const row = bySku.get(normalizeSku(source.sku))
  if (!row) continue
  matched += 1
  const publicFiles = []
  for (let i = 0; i < source.images.length; i += 1) {
    try {
      publicFiles.push(await download(source.images[i], row.slug, i))
      downloaded += 1
    } catch (error) {
      failed += 1
      failures.push({ sku: source.sku, url: source.images[i], error: error.message })
    }
  }
  const publicPdfs = []
  for (let i = 0; i < (source.pdfs ?? []).length; i += 1) {
    try {
      publicPdfs.push(await download(source.pdfs[i], row.slug, i, 'datasheet'))
      downloadedPdfs += 1
    } catch (error) {
      failed += 1
      failures.push({ sku: source.sku, url: source.pdfs[i], error: error.message })
    }
  }
  if (publicFiles.length === 0) continue

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
      fabricante: atributos.fabricante ?? source.manufacturer,
      manufacturer_asset_source: source.page,
      manufacturer_asset_synced_at: new Date().toISOString(),
    },
  }
  if (publicPdfs.length > 0) payload.ficha_pdf = publicPdfs[0]
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
      fuentes: sources.length,
      productos_con_match: matched,
      archivos_descargados: downloaded,
      fichas_pdf_descargadas: downloadedPdfs,
      descargas_fallidas: failed,
      productos_actualizados: updated,
      failures,
    },
    null,
    2
  )
)
