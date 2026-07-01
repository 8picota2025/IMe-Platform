#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CAT_ROOT = process.env.CAT_ROOT ?? '/home/shoky/CAT'
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const repoRoot = process.cwd()
const sourceProductsDir = path.join(CAT_ROOT, 'Productos')
const structuredPath = path.join(CAT_ROOT, 'productos_estructurados.json')
const targetRoot = path.join(repoRoot, 'public/assets/productos/importados')

const imageExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const pdfExt = new Set(['.pdf'])

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

function normalizeFileName(value) {
  const parsed = path.parse(value)
  return `${slugify(parsed.name)}${parsed.ext.toLowerCase()}`
}

function publicPathFor(slug, filename) {
  return `/assets/productos/importados/${slug}/${filename}`
}

function specItems(entry) {
  const specs = Array.isArray(entry?.especificaciones) ? entry.especificaciones : []
  return specs
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .map((valor) => ({ clave: 'Característica', valor, grupo: 'Catálogo IME' }))
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

function isEmptyText(value) {
  return typeof value !== 'string' || value.trim() === ''
}

function isUsablePublicAsset(value) {
  if (typeof value !== 'string') return false
  const src = value.trim()
  return (
    src.startsWith('/assets/') ||
    src.startsWith('assets/') ||
    src.startsWith('public/') ||
    src.startsWith('http://') ||
    src.startsWith('https://')
  )
}

async function readStructured() {
  const raw = await readFile(structuredPath, 'utf8')
  const entries = JSON.parse(raw)
  const bySku = new Map()
  for (const entry of entries) {
    const key = normalizeSku(entry.sku)
    if (key) bySku.set(key, entry)
  }
  return bySku
}

async function readAssetFolders() {
  const folders = await readdir(sourceProductsDir, { withFileTypes: true })
  const bySku = new Map()
  for (const folder of folders) {
    if (!folder.isDirectory()) continue
    const dir = path.join(sourceProductsDir, folder.name)
    const files = await readdir(dir, { withFileTypes: true })
    const metadataPath = path.join(dir, 'metadata.txt')
    let sku = folder.name.split('_')[0]
    if (existsSync(metadataPath)) {
      const metadata = await readFile(metadataPath, 'utf8')
      const match = metadata.match(/^SKU:\s*(.+)$/im)
      if (match) sku = match[1].trim()
    }
    const images = []
    const pdfs = []
    for (const file of files) {
      if (!file.isFile()) continue
      const ext = path.extname(file.name).toLowerCase()
      const source = path.join(dir, file.name)
      if (imageExt.has(ext)) images.push({ source, name: file.name })
      if (pdfExt.has(ext)) pdfs.push({ source, name: file.name })
    }
    images.sort((a, b) => {
      const ap = a.name.startsWith('imagen_principal') ? 0 : 1
      const bp = b.name.startsWith('imagen_principal') ? 0 : 1
      return ap - bp || a.name.localeCompare(b.name)
    })
    pdfs.sort((a, b) => a.name.localeCompare(b.name))
    const key = normalizeSku(sku)
    if (key) bySku.set(key, { sku, dir, images, pdfs })
  }
  return bySku
}

async function copyAssets(row, assets) {
  const copiedImages = []
  const copiedPdfs = []
  if (!DRY_RUN) await mkdir(path.join(targetRoot, row.slug), { recursive: true })

  for (const image of assets.images) {
    const filename = normalizeFileName(image.name)
    const target = path.join(targetRoot, row.slug, filename)
    if (!DRY_RUN) await copyFile(image.source, target)
    copiedImages.push(publicPathFor(row.slug, filename))
  }

  for (const pdf of assets.pdfs) {
    const filename = normalizeFileName(pdf.name)
    const target = path.join(targetRoot, row.slug, filename)
    if (!DRY_RUN) await copyFile(pdf.source, target)
    copiedPdfs.push(publicPathFor(row.slug, filename))
  }

  return { copiedImages, copiedPdfs }
}

function buildPayload(row, entry, copiedImages, copiedPdfs) {
  const currentGallery = Array.isArray(row.galeria) ? row.galeria : []
  const existingSpecs = Array.isArray(row.especificaciones) ? row.especificaciones : []
  const importedSpecs = specItems(entry)
  const atributos =
    row.atributos && typeof row.atributos === 'object' && !Array.isArray(row.atributos)
      ? { ...row.atributos }
      : {}

  const payload = {
    atributos: {
      ...atributos,
      fabricante: entry?.fabricante ?? atributos.fabricante ?? null,
      local_asset_source: 'CAT',
      local_asset_synced_at: new Date().toISOString(),
    },
  }

  if (copiedImages.length > 0) {
    payload.imagen_principal = isUsablePublicAsset(row.imagen_principal)
      ? row.imagen_principal
      : copiedImages[0]
    payload.galeria = dedupe([payload.imagen_principal, ...copiedImages, ...currentGallery])
  }

  if (copiedPdfs.length > 0 && !row.ficha_pdf) {
    payload.ficha_pdf = copiedPdfs[0]
  }

  if (existingSpecs.length === 0 && importedSpecs.length > 0) {
    payload.especificaciones = importedSpecs
  }

  if (isEmptyText(row.descripcion_corta_es) && entry?.descripcion_corta_es) {
    payload.descripcion_corta_es = entry.descripcion_corta_es
  }

  if (isEmptyText(row.nombre_en) && entry?.nombre_en) {
    payload.nombre_en = entry.nombre_en
  }

  return payload
}

const structuredBySku = await readStructured()
const assetsBySku = await readAssetFolders()
const { data: rows, error } = await supabase
  .from('productos')
  .select(
    'id,slug,sku,nombre_es,nombre_en,descripcion_corta_es,imagen_principal,galeria,ficha_pdf,especificaciones,atributos'
  )
  .order('slug')

if (error) throw error

let matched = 0
let copiedImagesTotal = 0
let copiedPdfsTotal = 0
let updated = 0
let noLocalAssets = 0

for (const row of rows ?? []) {
  const key = normalizeSku(row.sku || row.slug)
  const entry = structuredBySku.get(key)
  const assets = assetsBySku.get(key)
  if (!entry && !assets) {
    noLocalAssets += 1
    continue
  }
  matched += 1
  const { copiedImages, copiedPdfs } = assets
    ? await copyAssets(row, assets)
    : { copiedImages: [], copiedPdfs: [] }
  copiedImagesTotal += copiedImages.length
  copiedPdfsTotal += copiedPdfs.length

  const payload = buildPayload(row, entry ?? {}, copiedImages, copiedPdfs)
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
      productos_leidos: rows?.length ?? 0,
      productos_con_match_local: matched,
      productos_sin_assets_locales: noLocalAssets,
      imagenes_copiadas: copiedImagesTotal,
      fichas_pdf_copiadas: copiedPdfsTotal,
      productos_actualizados: updated,
      destino: '/assets/productos/importados/{slug}/',
    },
    null,
    2
  )
)
