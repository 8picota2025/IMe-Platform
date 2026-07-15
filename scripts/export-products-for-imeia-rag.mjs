import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from('productos')
  .select(`
    id,slug,sku,gtin,nombre_es,nombre_en,
    descripcion_corta_es,descripcion_corta_en,descripcion_larga_es,descripcion_larga_en,
    especificaciones,aplicaciones_es,aplicaciones_en,
    imagen_principal,galeria,ficha_pdf,tipo_comercial,fulfillment_mode,
    moneda,stock,disponible,destacado,nuevo,activo,orden,peso_kg,dimensiones_cm,
    familias(slug,nombre_es,nombre_en),
    tipos(slug,nombre_es,nombre_en)
  `)
  .eq('activo', true)
  .order('orden', { ascending: true, nullsFirst: false })
  .order('slug', { ascending: true })
  .range(0, 999);

if (error) throw error;

const rows = (data ?? []).map((p) => ({
  id: p.id,
  slug: p.slug,
  sku: p.sku || p.slug,
  gtin: p.gtin || null,
  nombre_es: p.nombre_es,
  nombre_en: p.nombre_en,
  familia: p.familias?.nombre_es || '',
  familia_slug: p.familias?.slug || '',
  tipo: p.tipos?.nombre_es || '',
  tipo_slug: p.tipos?.slug || '',
  descripcion_corta_es: p.descripcion_corta_es,
  descripcion_corta_en: p.descripcion_corta_en,
  descripcion_larga_es: p.descripcion_larga_es,
  descripcion_larga_en: p.descripcion_larga_en,
  especificaciones: p.especificaciones || [],
  aplicaciones_es: p.aplicaciones_es || [],
  aplicaciones_en: p.aplicaciones_en || [],
  imagen_principal: p.imagen_principal,
  galeria: p.galeria || [],
  ficha_pdf: p.ficha_pdf,
  tipo_comercial: p.tipo_comercial,
  fulfillment_mode: p.fulfillment_mode,
  moneda: p.moneda,
  stock: p.stock,
  disponible: p.disponible,
  destacado: p.destacado,
  nuevo: p.nuevo,
  activo: p.activo,
  orden: p.orden,
  peso_kg: p.peso_kg,
  dimensiones_cm: p.dimensiones_cm || {},
}));

fs.mkdirSync('/home/shoky/CAT', { recursive: true });
fs.writeFileSync('/home/shoky/CAT/productos_estructurados.json', JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ exported: rows.length }, null, 2));
