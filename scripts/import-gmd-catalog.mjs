#!/usr/bin/env node
/**
 * Importa el catálogo público de GMD a Supabase.
 *
 * Fuente:
 * - sitemap de productos público
 * - Commerce API de la página cargada en Chrome con sesión de invitado
 *
 * Requisitos:
 * - PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - Chrome con remote debugging en http://127.0.0.1:9222
 *
 * Estrategia:
 * - toma URLs de producto desde sitemap
 * - consulta el JSON de detalle desde el storefront autenticado por sesión de navegador
 * - omite productos cuyo nombre contiene "GMD"
 * - upsert de familias, tipos y productos
 */

const BASE_URL = 'https://www.gmd.com.co'
const WEBSTORE_ID = '0ZEVT0000001T9d4AE'
const API_BASE = `${BASE_URL}/webruntime/api/services/data/v66.0/commerce/webstores/${WEBSTORE_ID}`
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CHROME_DEBUG_URL = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9222'
const PRODUCT_LIMIT = Number.parseInt(process.env.GMD_LIMIT ?? '', 10)
const PRODUCT_TIMEOUT_MS = Number.parseInt(process.env.GMD_PRODUCT_TIMEOUT_MS ?? '', 10) || 20000

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return null
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${BASE_URL}${pathOrUrl}`
}

function firstSentence(text, limit = 180) {
  const value = String(text ?? '').trim()
  if (!value) return null
  const sentence = value.split(/(?<=[.!?])\s+/)[0].trim()
  if (sentence.length <= limit) return sentence
  return `${sentence.slice(0, limit - 1).trimEnd()}…`
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function hasGmdInName(product) {
  const candidates = [
    product?.fields?.Nombre_comercial__c,
    product?.fields?.Name,
    product?.fields?.ProductCode,
    product?.fields?.StockKeepingUnit,
  ].filter(Boolean)
  return candidates.some((value) => normalizeText(value).includes('gmd'))
}

function deriveCommercialType(product) {
  const fields = product?.fields ?? {}
  const text = normalizeText(
    [
      fields.Family,
      fields.L_nea__c,
      fields.Categor_a__c,
      fields.Subl_nea__c,
    ]
      .filter(Boolean)
      .join(' ')
  )

  const consumableLike =
    /repuesto|repuestos|kit|kits|accesorio|accesorios|consumib|insumo|insumos|reemplazo|spare/.test(text)

  return consumableLike ? 'consumible' : 'equipo'
}

function deriveFulfillmentMode(product) {
  const fields = product?.fields ?? {}
  const text = normalizeText(
    [
      fields.Family,
      fields.L_nea__c,
      fields.Categor_a__c,
      fields.Subl_nea__c,
    ]
      .filter(Boolean)
      .join(' ')
  )

  if (fields.ProductClass === 'Variation') return 'individualizado'
  if (/repuesto|repuestos|kit|kits|accesorio|accesorios|consumib|insumo|insumos|reemplazo|spare/.test(text)) {
    return 'dropship'
  }
  if (fields.ProductClass === 'Set') return 'individualizado'
  return 'cotizacion'
}

function toSpecItems(product) {
  const fields = product?.fields ?? {}
  const items = [
    ['Línea', fields.L_nea__c],
    ['Categoría', fields.Categor_a__c],
    ['Sublinea', fields.Subl_nea__c],
    ['Familia', fields.Family],
    ['Marca', fields.Marca__c],
    ['Código', fields.ProductCode],
    ['SKU', fields.StockKeepingUnit],
    ['Clase', fields.ProductClass],
    ['IVA', fields.Iva__c],
    ['Unidad de medida', fields.QuantityUnitOfMeasure],
    ['B32', fields.B32__c],
  ]
  return items
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([clave, valor]) => ({ clave, valor: String(valor), grupo: 'GMD' }))
}

function pickImages(product) {
  const mediaGroups = Array.isArray(product?.mediaGroups) ? product.mediaGroups : []
  const detailGroup = mediaGroups.find((group) => group.developerName === 'productDetailImage')
  const listGroup = mediaGroups.find((group) => group.developerName === 'productListImage')
  const images = []

  for (const group of [detailGroup, listGroup]) {
    for (const item of group?.mediaItems ?? []) {
      if (item?.mediaType === 'Image' && item.url) {
        images.push(absoluteUrl(item.url))
      }
    }
  }

  if (images.length === 0 && product?.defaultImage?.url) {
    images.push(absoluteUrl(product.defaultImage.url))
  }

  return [...new Set(images.filter(Boolean))]
}

function pickPdf(product) {
  const mediaGroups = Array.isArray(product?.mediaGroups) ? product.mediaGroups : []
  const attachment = mediaGroups.find((group) => group.developerName === 'attachment')
  const doc = attachment?.mediaItems?.find((item) => item?.mediaType === 'Document' && item.url)
  return doc ? absoluteUrl(doc.url) : null
}

function buildRows(product, sourceOrder) {
  const fields = product?.fields ?? {}
  const line = fields.L_nea__c || fields.Categor_a__c || fields.Family || 'Sin línea'
  const family = fields.Family || fields.Subl_nea__c || fields.Categor_a__c || null
  const productCode = fields.StockKeepingUnit || fields.Name || product?.id
  const productSlug = product?.urlName || slugify(productCode)
  const rowSlug = `gmd-${slugify(productSlug || product?.id)}`
  const familySlug = `gmd-${slugify(line)}`
  const tipoSlug = family ? `gmd-${slugify(family)}` : null
  const images = pickImages(product)
  const fichaPdf = pickPdf(product)
  const nombreEs = fields.Nombre_comercial__c || fields.ProductCode || fields.Name || productCode
  const descripcionLarga = fields.Descripci_n_general__c || null
  const descripcionCorta = firstSentence(descripcionLarga) || nombreEs
  const tipoComercial = deriveCommercialType(product)
  const fulfillmentMode = deriveFulfillmentMode(product)

  return {
    producto: {
      slug: rowSlug,
      sku: fields.StockKeepingUnit || null,
      gtin: null,
      familia_slug: familySlug,
      tipo_slug: tipoSlug,
      nombre_es: nombreEs,
      nombre_en: null,
      descripcion_corta_es: descripcionCorta,
      descripcion_corta_en: null,
      descripcion_larga_es: descripcionLarga,
      descripcion_larga_en: null,
      especificaciones: toSpecItems(product),
      aplicaciones_es: null,
      aplicaciones_en: null,
      imagen_principal: images[0] ?? null,
      galeria: images,
      ficha_pdf: fichaPdf,
      atributos: {
        source: 'gmd',
        gmd_id: product?.id ?? null,
        gmd_url: `${BASE_URL}/product/${product?.urlName ?? productSlug}/${product?.id ?? ''}`,
        gmd_product_code: fields.ProductCode || null,
        gmd_product_class: fields.ProductClass || null,
        gmd_name: fields.Name || null,
        gmd_family: fields.Family || null,
        gmd_line: fields.L_nea__c || null,
        gmd_category: fields.Categor_a__c || null,
        gmd_subline: fields.Subl_nea__c || null,
        gmd_brand: fields.Marca__c || null,
        gmd_currency: fields.CurrencyIsoCode || null,
        gmd_iva: fields.Iva__c || null,
        gmd_b32: fields.B32__c || null,
        gmd_created_at: fields.CreatedDate || null,
        gmd_modified_at: fields.LastModifiedDate || null,
      },
      peso_kg: null,
      dimensiones_cm: {},
      tipo_comercial: tipoComercial,
      fulfillment_mode: fulfillmentMode,
      precio: null,
      precio_regular: null,
      precio_oferta: null,
      oferta_inicio: null,
      oferta_fin: null,
      moneda: fields.CurrencyIsoCode || 'COP',
      stock: null,
      gestionar_stock: false,
      stock_estado: 'instock',
      backorder_policy: 'no',
      disponible: fields.IsActive !== 'false' && fields.IsDeleted !== 'true',
      disponible_actualizado_at: fields.LastModifiedDate || null,
      destacado: false,
      nuevo: false,
      activo: fields.IsActive !== 'false' && fields.IsDeleted !== 'true',
      orden: sourceOrder,
    },
    familia: {
      slug: familySlug,
      nombre_es: line,
      nombre_en: null,
      descripcion_es: fields.Categor_a__c || null,
      descripcion_en: null,
      orden: sourceOrder,
      activo: true,
    },
    tipo: family
      ? {
          slug: tipoSlug,
          nombre_es: family,
          nombre_en: null,
          orden: 0,
          activo: true,
        }
      : null,
  }
}

async function upsertRows(table, rows, onConflict, chunkSize = 50) {
  const inserted = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(chunk),
    })
    if (!res.ok) {
      throw new Error(`${table}: HTTP ${res.status} — ${await res.text()}`)
    }
    inserted.push(...(await res.json()))
  }
  return inserted
}

async function getText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function getPageTarget() {
  const targets = await getJson(`${CHROME_DEBUG_URL}/json/list`)
  const page =
    targets.find((t) => t.type === 'page' && /gmd\.com\.co/i.test(t.url)) ||
    targets.find((t) => t.type === 'page')
  if (!page?.webSocketDebuggerUrl) {
    throw new Error('No se encontró un target de página en Chrome con remote debugging.')
  }
  return page.webSocketDebuggerUrl
}

async function createPageFetcher() {
  const wsUrl = await getPageTarget()
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let nextId = 1
  const pending = new Map()

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  }

  async function evaluate(expression) {
    const id = nextId++
    const result = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      ws.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
        })
      )
    })
    return result
  }

  async function fetchJson(url) {
    const expr = `(async () => { const res = await fetch(${JSON.stringify(url)}); const text = await res.text(); return { ok: res.ok, status: res.status, text }; })()`
    const result = await Promise.race([
      evaluate(expr),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout tras ${PRODUCT_TIMEOUT_MS}ms: ${url}`)), PRODUCT_TIMEOUT_MS)
      ),
    ])
    const payload = result?.result?.value
    if (!payload) throw new Error(`Sin payload para ${url}`)
    if (!payload.ok) {
      throw new Error(`HTTP ${payload.status} for ${url}: ${payload.text.slice(0, 500)}`)
    }
    return JSON.parse(payload.text)
  }

  return {
    fetchJson,
    close: () => ws.close(),
  }
}

function extractProductUrlsFromSitemap(xml) {
  const urls = []
  for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const loc = match[1].trim()
    if (/\/product\/[^/]+\/[A-Za-z0-9]+\/?$/.test(loc)) {
      urls.push(loc.replace(/\/$/, ''))
    }
  }
  return urls
}

function parseProductUrl(url) {
  const match = url.match(/\/product\/([^/]+)\/([A-Za-z0-9]+)$/)
  if (!match) return null
  return { urlName: match[1], recordId: match[2] }
}

async function getSitemapProductUrls() {
  const sitemapIndex = await getText(`${BASE_URL}/sitemap.xml`)
  const sitemapUrls = [...sitemapIndex.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((url) => /sitemap-product.*\.xml$/i.test(url) && !/productcategory/i.test(url))

  const productUrls = new Set()
  for (const sitemapUrl of sitemapUrls) {
    const xml = await getText(sitemapUrl)
    for (const url of extractProductUrlsFromSitemap(xml)) {
      productUrls.add(url)
    }
  }
  return [...productUrls]
}

function uniqBy(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!map.has(key)) {
      map.set(key, item)
    }
  }
  return [...map.values()]
}

const pageFetcher = await createPageFetcher()

console.log('Leyendo sitemap de productos...')
const productUrls = await getSitemapProductUrls()
console.log(`Encontrados ${productUrls.length} productos en sitemap.`)
const urlsAProcesar = Number.isFinite(PRODUCT_LIMIT) && PRODUCT_LIMIT > 0 ? productUrls.slice(0, PRODUCT_LIMIT) : productUrls

const scraped = []
for (let i = 0; i < urlsAProcesar.length; i += 1) {
  const url = urlsAProcesar[i]
  const parsed = parseProductUrl(url)
  if (!parsed) continue

  const apiUrl = `${API_BASE}/products/${parsed.recordId}?language=es-CO&asGuest=true&htmlEncode=false`
  try {
    const product = await pageFetcher.fetchJson(apiUrl)
    if (hasGmdInName(product)) {
      continue
    }
    scraped.push({
      url,
      product,
      order: i + 1,
    })
    if ((i + 1) % 25 === 0 || i === urlsAProcesar.length - 1) {
      console.log(`  scrapeados ${i + 1}/${urlsAProcesar.length}...`)
    }
  } catch (error) {
    console.warn(`Saltando ${parsed.recordId}: ${error.message}`)
  }
}

console.log(`Productos válidos para importación: ${scraped.length}`)

const familySeed = []
const typeSeed = []
const productSeed = []
for (const { product, order } of scraped) {
  const row = buildRows(product, order)
  familySeed.push(row.familia)
  if (row.tipo) {
    typeSeed.push({
      ...row.tipo,
      family_slug: row.familia.slug,
    })
  }
  productSeed.push(row.producto)
}

const familiesBySlug = new Map()
const uniqueFamilies = uniqBy(familySeed, (row) => row.slug)
uniqueFamilies.sort((a, b) => a.orden - b.orden || a.nombre_es.localeCompare(b.nombre_es))

console.log(`Upserting ${uniqueFamilies.length} familias...`)
const familiesInserted = await upsertRows(
  'familias',
  uniqueFamilies.map((family) => ({
    slug: family.slug,
    nombre_es: family.nombre_es,
    nombre_en: family.nombre_en,
    descripcion_es: family.descripcion_es,
    descripcion_en: family.descripcion_en,
    orden: family.orden,
    activo: family.activo,
  })),
  'slug'
)
for (const family of familiesInserted) {
  familiesBySlug.set(family.slug, family.id)
}
console.log(`OK — ${familiesInserted.length} familias.`)

const typesByKey = new Map()
const uniqueTypes = uniqBy(typeSeed, (row) => `${row.family_slug}::${row.slug}`)
uniqueTypes.sort((a, b) => a.family_slug.localeCompare(b.family_slug) || a.nombre_es.localeCompare(b.nombre_es))

const typesPayload = uniqueTypes.map((type) => ({
  family_slug: type.family_slug,
  familia_id: familiesBySlug.get(type.family_slug),
  slug: type.slug,
  nombre_es: type.nombre_es,
  nombre_en: type.nombre_en,
  orden: type.orden,
  activo: type.activo,
}))

const unresolvedFamilies = typesPayload.filter((type) => !type.familia_id)
if (unresolvedFamilies.length > 0) {
  throw new Error(`Hay tipos sin family_id resuelto: ${unresolvedFamilies.map((t) => t.slug).join(', ')}`)
}

console.log(`Upserting ${typesPayload.length} tipos...`)
const typesInserted = await upsertRows(
  'tipos',
  typesPayload.map(({ familia_id, slug, nombre_es, nombre_en, orden, activo }) => ({
    familia_id,
    slug,
    nombre_es,
    nombre_en,
    orden,
    activo,
  })),
  'familia_id,slug'
)
for (const type of typesInserted) {
  typesByKey.set(`${type.familia_id}::${type.slug}`, type.id)
}
console.log(`OK — ${typesInserted.length} tipos.`)

const productRows = productSeed.map((product) => {
  const familyId = familiesBySlug.get(product.familia_slug)
  const tipoId = product.tipo_slug ? typesByKey.get(`${familyId}::${product.tipo_slug}`) : null
  return {
    slug: product.slug,
    sku: product.sku,
    gtin: product.gtin,
    familia_id: familyId ?? null,
    tipo_id: tipoId ?? null,
    nombre_es: product.nombre_es,
    nombre_en: product.nombre_en,
    descripcion_corta_es: product.descripcion_corta_es,
    descripcion_corta_en: product.descripcion_corta_en,
    descripcion_larga_es: product.descripcion_larga_es,
    descripcion_larga_en: product.descripcion_larga_en,
    especificaciones: product.especificaciones,
    aplicaciones_es: product.aplicaciones_es,
    aplicaciones_en: product.aplicaciones_en,
    imagen_principal: product.imagen_principal,
    galeria: product.galeria,
    ficha_pdf: product.ficha_pdf,
    atributos: product.atributos,
    peso_kg: product.peso_kg,
    dimensiones_cm: product.dimensiones_cm,
    tipo_comercial: product.tipo_comercial,
    fulfillment_mode: product.fulfillment_mode,
    precio: product.precio,
    precio_regular: product.precio_regular,
    precio_oferta: product.precio_oferta,
    oferta_inicio: product.oferta_inicio,
    oferta_fin: product.oferta_fin,
    moneda: product.moneda,
    stock: product.stock,
    gestionar_stock: product.gestionar_stock,
    stock_estado: product.stock_estado,
    backorder_policy: product.backorder_policy,
    disponible: product.disponible,
    disponible_actualizado_at: product.disponible_actualizado_at,
    destacado: product.destacado,
    nuevo: product.nuevo,
    activo: product.activo,
    orden: product.orden,
  }
})

const unresolvedProducts = productRows.filter((row) => !row.familia_id)
if (unresolvedProducts.length > 0) {
  throw new Error(`Hay productos sin family_id resuelto: ${unresolvedProducts.map((p) => p.slug).join(', ')}`)
}

console.log(`Upserting ${productRows.length} productos...`)
const productsInserted = await upsertRows('productos', productRows, 'slug', 25)
console.log(`OK — ${productsInserted.length} productos.`)

const resumen = {
  sitemap_products: productUrls.length,
  scraped_products: scraped.length,
  inserted_families: familiesInserted.length,
  inserted_types: typesInserted.length,
  inserted_products: productsInserted.length,
}

console.log(JSON.stringify(resumen, null, 2))

pageFetcher.close()
