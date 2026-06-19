#!/usr/bin/env node
/**
 * Sube las imágenes importadas de GMD al bucket público `productos`
 * y reescribe `productos.imagen_principal` / `productos.galeria`
 * para apuntar al storage de Supabase.
 *
 * Idempotente:
 * - Si una URL ya es del bucket `productos`, se conserva.
 * - Si dos productos usan la misma imagen fuente, se sube una sola vez.
 */

import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BUCKET = 'productos'
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`
const GMD_ORIGIN = 'https://www.gmd.com.co'
const GMD_IMAGE_PREFIX = '/cdn-cgi/image/fit=scale-down,format=auto,onerror=redirect,width=1600'
const GMD_MEDIA_PATH = '/sfsites/c/cms/delivery/media/'
const PLACEHOLDER_PATH = 'gmd/placeholders/manual-review.svg'
const PLACEHOLDER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="800" viewBox="0 0 1200 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="800" rx="48" fill="#F3F6F8"/>
  <rect x="120" y="120" width="960" height="560" rx="36" fill="#FFFFFF" stroke="#D6DEE6" stroke-width="8" stroke-dasharray="20 18"/>
  <circle cx="600" cy="330" r="92" fill="#DDE5EC"/>
  <path d="M512 330C512 281.817 551.817 242 600 242C648.183 242 688 281.817 688 330C688 378.183 648.183 418 600 418C551.817 418 512 378.183 512 330Z" stroke="#A6B4C2" stroke-width="12"/>
  <path d="M600 278V362" stroke="#7C8A99" stroke-width="16" stroke-linecap="round"/>
  <circle cx="600" cy="388" r="12" fill="#7C8A99"/>
  <text x="600" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" fill="#61707F">Imagen pendiente de revisión</text>
</svg>`

function isStorageUrl(url) {
  return typeof url === 'string' && url.startsWith(STORAGE_PREFIX)
}

function normalizeUrl(url) {
  return String(url ?? '').trim()
}

function buildDownloadUrl(sourceUrl) {
  const raw = normalizeUrl(sourceUrl)
  if (!raw) return null

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const parsed = new URL(raw)
      if (parsed.origin !== GMD_ORIGIN) return raw
      if (parsed.pathname.startsWith('/cdn-cgi/image/')) return raw
      if (parsed.pathname.startsWith('/cms/delivery/media/')) {
        return `${GMD_ORIGIN}${GMD_IMAGE_PREFIX}${GMD_MEDIA_PATH}${parsed.pathname.slice('/cms/delivery/media/'.length)}${parsed.search}`
      }
      if (parsed.pathname.startsWith('/sfsites/c/cms/delivery/media/')) {
        return `${GMD_ORIGIN}${GMD_IMAGE_PREFIX}${parsed.pathname}${parsed.search}`
      }
      return raw
    } catch {
      return raw
    }
  }

  if (raw.startsWith('/sfsites/c/cms/delivery/media/')) {
    return `${GMD_ORIGIN}${GMD_IMAGE_PREFIX}${raw}`
  }

  if (raw.startsWith('/cms/delivery/media/')) {
    return `${GMD_ORIGIN}${GMD_IMAGE_PREFIX}${GMD_MEDIA_PATH}${raw.slice('/cms/delivery/media/'.length)}`
  }

  return raw
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function extFromContentType(contentType) {
  const base = String(contentType ?? '').toLowerCase().split(';')[0].trim()
  if (base === 'image/jpeg') return 'jpg'
  if (base === 'image/png') return 'png'
  if (base === 'image/webp') return 'webp'
  if (base === 'image/gif') return 'gif'
  if (base === 'image/avif') return 'avif'
  if (base === 'image/svg+xml') return 'svg'
  return 'jpg'
}

async function uploadImage(sourceUrl, cache) {
  const url = normalizeUrl(sourceUrl)
  if (!url) return null
  if (isStorageUrl(url)) {
    cache.set(url, url)
    return url
  }
  if (cache.has(url)) return cache.get(url)

  const downloadUrl = buildDownloadUrl(url)
  if (!downloadUrl) return null

  const res = await fetch(downloadUrl, {
    headers: {
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      referer: `${GMD_ORIGIN}/`,
    },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} descargando ${downloadUrl}`)
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const ext = extFromContentType(contentType)
  const path = `gmd/${sha256(url)}.${ext}`
  const bytes = Buffer.from(await res.arrayBuffer())

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  })
  if (error) {
    throw new Error(`storage upload ${path}: ${error.message}`)
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  cache.set(url, publicUrl)
  return publicUrl
}

async function ensurePlaceholderImage() {
  const { error } = await supabase.storage.from(BUCKET).upload(PLACEHOLDER_PATH, Buffer.from(PLACEHOLDER_SVG), {
    contentType: 'image/svg+xml',
    upsert: true,
  })
  if (error && !String(error.message).includes('already exists')) {
    throw new Error(`storage placeholder ${PLACEHOLDER_PATH}: ${error.message}`)
  }
  return supabase.storage.from(BUCKET).getPublicUrl(PLACEHOLDER_PATH).data.publicUrl
}

function dedupeKeepOrder(values) {
  const out = []
  const seen = new Set()
  for (const value of values) {
    const normalized = normalizeUrl(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

async function main() {
  const { data: products, error } = await supabase
    .from('productos')
    .select('id, slug, imagen_principal, galeria, atributos')
    .ilike('slug', 'gmd-%')

  if (error) throw error
  const rows = products ?? []
  console.log(`Productos GMD encontrados: ${rows.length}`)
  const placeholderUrl = await ensurePlaceholderImage()

  const allSourceImages = dedupeKeepOrder(
    rows.flatMap((row) => [row.imagen_principal, ...(Array.isArray(row.galeria) ? row.galeria : [])])
  )
  console.log(`Imágenes fuente únicas: ${allSourceImages.length}`)

  const urlCache = new Map()
  let uploaded = 0
  let skipped = 0

  for (let i = 0; i < allSourceImages.length; i += 1) {
    const sourceUrl = allSourceImages[i]
    try {
      const publicUrl = await uploadImage(sourceUrl, urlCache)
      if (publicUrl) uploaded += 1
      else skipped += 1
      if ((i + 1) % 20 === 0 || i === allSourceImages.length - 1) {
        console.log(`  imágenes procesadas ${i + 1}/${allSourceImages.length}`)
      }
    } catch (err) {
      skipped += 1
      console.warn(`Saltando imagen ${sourceUrl}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  let updated = 0
  let unresolved = 0
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25)
    for (const row of chunk) {
      const principal = normalizeUrl(row.imagen_principal)
      const galeria = Array.isArray(row.galeria) ? row.galeria : []
      const atributos = row.atributos && typeof row.atributos === 'object' && !Array.isArray(row.atributos)
        ? { ...row.atributos }
        : null
      let manualReview = false
      let mappedPrincipal = null
      try {
        mappedPrincipal = principal ? await uploadImage(principal, urlCache) : null
      } catch (err) {
        unresolved += 1
        manualReview = true
        console.warn(`No se pudo persistir imagen principal ${principal}: ${err instanceof Error ? err.message : String(err)}`)
      }

      const mappedGaleria = []
      for (const url of dedupeKeepOrder(galeria)) {
        const cached = urlCache.get(url)
        if (cached) {
          mappedGaleria.push(cached)
          continue
        }
        try {
          const persisted = await uploadImage(url, urlCache)
          if (persisted) {
            mappedGaleria.push(persisted)
          }
        } catch (err) {
          unresolved += 1
          manualReview = true
          console.warn(`No se pudo persistir imagen de galeria ${url}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      let finalGaleria = dedupeKeepOrder([
        ...(mappedPrincipal ? [mappedPrincipal] : []),
        ...mappedGaleria,
      ])
      if (finalGaleria.length === 0) {
        finalGaleria = [placeholderUrl]
        mappedPrincipal = placeholderUrl
        manualReview = true
      } else if (!mappedPrincipal) {
        mappedPrincipal = finalGaleria[0]
      }

      const atributosActualizados = manualReview && atributos
        ? {
            ...atributos,
            gmd_image_manual_review: true,
            gmd_image_placeholder: placeholderUrl,
            gmd_image_manual_review_reason: 'source_image_unavailable',
          }
        : atributos

      const payload = {
        imagen_principal: mappedPrincipal,
        galeria: finalGaleria,
      }
      if (atributosActualizados) {
        payload.atributos = atributosActualizados
      }

      const { error: updateError } = await supabase.from('productos').update(payload).eq('id', row.id)

      if (updateError) {
        throw updateError
      }
      updated += 1
    }
    console.log(`  productos actualizados ${Math.min(i + 25, rows.length)}/${rows.length}`)
  }

  console.log(
    JSON.stringify(
      {
        productos: rows.length,
        imagenes_unicas: allSourceImages.length,
        imagenes_subidas: uploaded,
        imagenes_saltadas: skipped,
        imagenes_no_resueltas: unresolved,
        productos_actualizados: updated,
      },
      null,
      2
    )
  )
}

await main()
