#!/usr/bin/env node
/**
 * Siembra las tablas `familias` y `productos` en Supabase con los datos reales
 * extraídos en F0 (src/data/mock-familias.json, src/data/mock-productos.json).
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY (bypassa RLS). No inventa datos: usa
 * exactamente el contenido de los JSON de mock, que es el catálogo real
 * extraído del sitio actual.
 *
 * Idempotente: usa upsert por `slug` (onConflict=slug).
 *
 * Uso: node --env-file=.env scripts/seed-catalogo.mjs
 */

import { readFileSync } from 'fs'

const url = process.env.PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function upsert(table, rows, onConflict) {
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    throw new Error(`${table}: HTTP ${res.status} — ${await res.text()}`)
  }
  return res.json()
}

const mockFamilias = JSON.parse(readFileSync('./src/data/mock-familias.json', 'utf-8'))
const mockProductos = JSON.parse(readFileSync('./src/data/mock-productos.json', 'utf-8'))

const familiasPayload = mockFamilias.map((f) => ({
  slug: f.slug,
  nombre_es: f.nombre_es,
  nombre_en: f.nombre_en,
  descripcion_es: f.descripcion_es,
  descripcion_en: f.descripcion_en,
  orden: f.orden,
  activo: f.activo,
}))

console.log(`Sembrando ${familiasPayload.length} familias...`)
const familiasInsertadas = await upsert('familias', familiasPayload, 'slug')
const familiaIdPorSlug = Object.fromEntries(familiasInsertadas.map((f) => [f.slug, f.id]))
console.log(`OK — ${familiasInsertadas.length} familias.`)

const productosPayload = mockProductos.map((p) => ({
  slug: p.slug,
  familia_id: familiaIdPorSlug[p.familia_slug] ?? null,
  tipo_id: null,
  nombre_es: p.nombre_es,
  nombre_en: p.nombre_en,
  descripcion_corta_es: p.descripcion_corta_es,
  descripcion_corta_en: p.descripcion_corta_en,
  descripcion_larga_es: p.descripcion_larga_es,
  descripcion_larga_en: p.descripcion_larga_en,
  especificaciones: p.especificaciones,
  imagen_principal: p.imagen_principal,
  galeria: p.galeria,
  ficha_pdf: p.ficha_pdf,
  tipo_comercial: p.tipo_comercial,
  fulfillment_mode: p.fulfillment_mode,
  precio: p.precio,
  moneda: p.moneda,
  destacado: p.destacado,
  nuevo: p.nuevo,
  activo: p.activo,
  orden: p.orden,
}))

const sinFamilia = productosPayload.filter((p) => !p.familia_id)
if (sinFamilia.length > 0) {
  console.error(
    `Abortando: ${sinFamilia.length} producto(s) sin familia_id resuelto:`,
    sinFamilia.map((p) => p.slug)
  )
  process.exit(1)
}

console.log(`Sembrando ${productosPayload.length} productos...`)
const productosInsertados = await upsert('productos', productosPayload, 'slug')
console.log(`OK — ${productosInsertados.length} productos.`)
