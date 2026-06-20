#!/usr/bin/env node
/**
 * Reindexa embeddings con Voyage en Supabase remoto.
 *
 * Modos:
 *   node --env-file=.env scripts/reindex-voyage-embeddings.mjs products
 *   node --env-file=.env scripts/reindex-voyage-embeddings.mjs articles
 *   node --env-file=.env scripts/reindex-voyage-embeddings.mjs all
 */

import { createClient } from '@supabase/supabase-js'

const mode = (process.argv[2] ?? 'products').toLowerCase()
const url = process.env.PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const voyageKey = process.env.VOYAGE_API_KEY
const model = process.env.EMBEDDING_MODEL ?? 'voyage-3'
const batchSize = Number(process.env.REINDEX_BATCH_SIZE ?? 20)
const requestGapMs = Number(process.env.REINDEX_REQUEST_GAP_MS ?? 21000)
const maxRetries = Number(process.env.REINDEX_MAX_RETRIES ?? 4)

if (!url || !serviceKey) {
  throw new Error('PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos')
}

if (!voyageKey) {
  throw new Error('VOYAGE_API_KEY es requerido')
}

if (!['products', 'articles', 'all'].includes(mode)) {
  throw new Error(`Modo invalido: ${mode}`)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

if (mode === 'products' || mode === 'all') {
  await reindexProducts()
}

if (mode === 'articles' || mode === 'all') {
  await reindexArticles()
}

async function reindexProducts() {
  const query = `
    id, slug, nombre_es, nombre_en, descripcion_corta_es, descripcion_corta_en,
    descripcion_larga_es, descripcion_larga_en, especificaciones, aplicaciones_es, aplicaciones_en,
    familias(nombre_es, nombre_en), tipos(nombre_es, nombre_en)
  `

  const { data: productos, error: selectError } = await supabase
    .from('productos')
    .select(query)
    .eq('activo', true)
    .order('orden', { ascending: true })

  if (selectError) {
    throw new Error(`No se pudieron leer productos: ${selectError.message}`)
  }

  const rows = productos ?? []
  if (!rows.length) {
    console.log('No hay productos activos para reindexar.')
    return
  }

  console.log(`Reindexando ${rows.length} productos con Voyage (${model})...`)
  await reindexRows(rows, 'productos', normalizeProductText)
}

async function reindexArticles() {
  const { data: articulos, error: selectError } = await supabase
    .from('articulos')
    .select('id, slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en')
    .eq('publicado', true)
    .order('updated_at', { ascending: false })

  if (selectError) {
    throw new Error(`No se pudieron leer articulos: ${selectError.message}`)
  }

  const rows = articulos ?? []
  if (!rows.length) {
    console.log('No hay articulos publicados para reindexar.')
    return
  }

  console.log(`Reindexando ${rows.length} articulos publicados con Voyage (${model})...`)
  await reindexRows(rows, 'articulos', normalizeArticleText)
}

async function reindexRows(rows, tableName, buildText) {
  let procesados = 0
  let errores = 0
  const fallos = []

  for (let i = 0; i < rows.length; i += batchSize) {
    const lote = rows.slice(i, i + batchSize)
    const textos = lote.map(buildText)
    const json = await fetchVoyageEmbeddings(textos)
    const vectors = json?.data?.map(item => item?.embedding ?? []) ?? []

    if (vectors.length !== lote.length) {
      throw new Error(
        `Longitud inesperada de embeddings: esperaba ${lote.length}, recibi ${vectors.length}`
      )
    }

    for (let j = 0; j < lote.length; j += 1) {
      const row = lote[j]
      const vector = vectors[j]
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ embedding: vector })
        .eq('id', row.id)

      if (updateError) {
        errores += 1
        fallos.push({ slug: row.slug, error: updateError.message })
        continue
      }

      procesados += 1
    }

    console.log(`Lote ${Math.floor(i / batchSize) + 1}: ${procesados}/${rows.length} procesados`)

    if (i + batchSize < rows.length) {
      await sleep(requestGapMs)
    }
  }

  console.log(`Terminado ${tableName}: ${procesados} procesados, ${errores} errores.`)

  if (fallos.length) {
    console.log('Primeros fallos:')
    for (const fallo of fallos.slice(0, 10)) {
      console.log(`- ${fallo.slug}: ${fallo.error}`)
    }
    process.exitCode = 1
  }
}

function normalizeProductText(producto) {
  const partes = [
    producto.nombre_es,
    producto.nombre_en,
    producto.familias?.nombre_es ?? null,
    producto.familias?.nombre_en ?? null,
    producto.tipos?.nombre_es ?? null,
    producto.tipos?.nombre_en ?? null,
    producto.descripcion_corta_es,
    producto.descripcion_corta_en,
    producto.descripcion_larga_es,
    producto.descripcion_larga_en,
  ]

  for (const spec of producto.especificaciones ?? []) {
    const clave = String(spec?.clave ?? '').trim()
    const valor = String(spec?.valor ?? '').trim()
    if (clave || valor) partes.push(`${clave}: ${valor}`.trim())
  }

  for (const aplicacion of producto.aplicaciones_es ?? []) partes.push(aplicacion)
  for (const aplicacion of producto.aplicaciones_en ?? []) partes.push(aplicacion)

  return partes
    .filter(parte => Boolean(parte && String(parte).trim().length > 0))
    .join('\n')
    .slice(0, 6000)
}

function normalizeArticleText(articulo) {
  return [articulo.titulo_es, articulo.titulo_en, articulo.cuerpo_es, articulo.cuerpo_en]
    .filter(parte => Boolean(parte && String(parte).trim().length > 0))
    .join('\n')
    .slice(0, 6000)
}

async function fetchVoyageEmbeddings(texts) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${voyageKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model,
        input_type: 'document',
      }),
    })

    if (res.ok) {
      return res.json()
    }

    const body = await res.text()
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = res.headers.get('retry-after')
      const retryAfterSeconds = Number(retryAfterHeader)
      const waitMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : requestGapMs
      console.warn(
        `Voyage 429 en intento ${attempt}/${maxRetries}; reintentando en ${Math.ceil(waitMs / 1000)}s`
      )
      await sleep(waitMs)
      continue
    }

    throw new Error(`Voyage error ${res.status}: ${body}`)
  }

  throw new Error('Voyage: reintentos agotados')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
