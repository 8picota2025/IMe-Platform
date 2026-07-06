#!/usr/bin/env node
/**
 * Regenera src/data/mock-{familias,tipos,productos}.json a partir del estado
 * real de Supabase, para que el fallback local de desarrollo deje de estar
 * desincronizado de producción (slugs distintos, 348 productos faltantes,
 * familias/tipos faltantes).
 *
 * Preserva, para los productos que ya tienen contenido enriquecido en el
 * atributos JSONB de Supabase (beneficios_es/en, valor_es/en, marca), su
 * aplanado a campos planos del mock (mismo patrón ya usado por el piloto de
 * landings), en vez de descartarlos.
 *
 * No inventa datos: usa exactamente lo que hay en Supabase.
 *
 * Uso: node --env-file=.env scripts/export-mock-from-supabase.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: familias, error: famError } = await supabase
  .from('familias')
  .select('id, slug, nombre_es, nombre_en, descripcion_es, descripcion_en, orden, activo')
  .order('orden', { ascending: true });
if (famError) throw famError;

const { data: tipos, error: tiposError } = await supabase
  .from('tipos')
  .select('id, familia_id, slug, nombre_es, nombre_en, orden, activo')
  .order('orden', { ascending: true });
if (tiposError) throw tiposError;

const { data: productos, error: prodError } = await supabase
  .from('productos')
  .select('*')
  .order('orden', { ascending: true });
if (prodError) throw prodError;

const familiaSlugPorId = new Map(familias.map(f => [f.id, f.slug]));
const tipoSlugPorId = new Map(tipos.map(t => [t.id, t.slug]));

const mockFamilias = familias.map(f => ({
  id: f.id,
  slug: f.slug,
  nombre_es: f.nombre_es,
  nombre_en: f.nombre_en ?? f.nombre_es,
  descripcion_es: f.descripcion_es ?? '',
  descripcion_en: f.descripcion_en ?? '',
  // Supabase no tiene columna `icono`; se deja vacío para que
  // resolveFamiliaIcono() use su tabla de fallback por slug.
  icono: '',
  orden: f.orden,
  activo: f.activo,
}));

const mockTipos = tipos.map(t => ({
  id: t.id,
  familia_id: t.familia_id,
  familia_slug: familiaSlugPorId.get(t.familia_id) ?? '',
  slug: t.slug,
  nombre_es: t.nombre_es,
  nombre_en: t.nombre_en ?? t.nombre_es,
  orden: t.orden,
  activo: t.activo,
}));

const mockProductos = productos.map(p => {
  const atributos = p.atributos ?? {};
  const base = {
    id: p.id,
    slug: p.slug,
    // Un producto sandbox de pruebas de Wompi no tiene familia asignada en
    // Supabase; se normaliza a cadena vacía para no romper el tipo del mock
    // (el sitio real ya tolera familia_slug vacío).
    familia_id: p.familia_id ?? '',
    familia_slug: familiaSlugPorId.get(p.familia_id) ?? '',
    tipo_id: p.tipo_id,
    nombre_es: p.nombre_es,
    nombre_en: p.nombre_en ?? p.nombre_es,
    descripcion_corta_es: p.descripcion_corta_es ?? '',
    descripcion_corta_en: p.descripcion_corta_en ?? '',
    descripcion_larga_es: p.descripcion_larga_es ?? '',
    descripcion_larga_en: p.descripcion_larga_en ?? '',
    especificaciones: p.especificaciones ?? [],
    imagen_principal: p.imagen_principal,
    galeria: p.galeria ?? [],
    ficha_pdf: p.ficha_pdf,
    tipo_comercial: p.tipo_comercial,
    fulfillment_mode: p.fulfillment_mode,
    precio: p.precio,
    moneda: p.moneda,
    stock: p.stock,
    disponible: p.disponible,
    destacado: p.destacado,
    nuevo: p.nuevo,
    activo: p.activo,
    orden: p.orden,
  };

  if (Array.isArray(p.aplicaciones_es) && p.aplicaciones_es.length > 0) {
    base.aplicaciones_es = p.aplicaciones_es;
  }
  if (Array.isArray(p.aplicaciones_en) && p.aplicaciones_en.length > 0) {
    base.aplicaciones_en = p.aplicaciones_en;
  }
  if (typeof atributos.marca === 'string' && atributos.marca.trim().length > 0) {
    base.marca = atributos.marca;
  }
  if (typeof atributos.origen === 'string') {
    base.proveedor_ref = atributos.origen;
  }
  if (Array.isArray(atributos.beneficios_es) && atributos.beneficios_es.length > 0) {
    base.beneficios_es = atributos.beneficios_es;
  }
  if (Array.isArray(atributos.beneficios_en) && atributos.beneficios_en.length > 0) {
    base.beneficios_en = atributos.beneficios_en;
  }
  if (typeof atributos.valor_es === 'string' && atributos.valor_es.trim().length > 0) {
    base.valor_es = atributos.valor_es;
  }
  if (typeof atributos.valor_en === 'string' && atributos.valor_en.trim().length > 0) {
    base.valor_en = atributos.valor_en;
  }
  return base;
});

const target = process.argv.includes('--dry-run') ? null : 'src/data';

console.log(`Familias: ${mockFamilias.length}`);
console.log(`Tipos: ${mockTipos.length}`);
console.log(`Productos: ${mockProductos.length}`);

if (!target) {
  console.log('[dry-run] no se escribió ningún archivo.');
  process.exit(0);
}

writeFileSync(`${target}/mock-familias.json`, JSON.stringify(mockFamilias, null, 2) + '\n');
writeFileSync(`${target}/mock-tipos.json`, JSON.stringify(mockTipos, null, 2) + '\n');
writeFileSync(`${target}/mock-productos.json`, JSON.stringify(mockProductos, null, 2) + '\n');
console.log('Escrito mock-familias.json, mock-tipos.json y mock-productos.json.');
