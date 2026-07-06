// scripts/sync-productos-supabase.mjs
// Sincroniza campos de contenido enriquecido (especificaciones, aplicaciones,
// beneficios, valor, ficha_pdf, descripcion_larga_en) desde
// src/data/mock-productos.json hacia la tabla `productos` de Supabase,
// para los slugs indicados. Solo escribe los campos de contenido — nunca
// precio, stock, disponibilidad ni campos comerciales.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const DRY_RUN = process.argv.includes('--dry-run');
const slugsArg = process.argv.find(a => a.startsWith('--slugs='));
if (!slugsArg) {
  throw new Error(
    'Uso: node scripts/sync-productos-supabase.mjs --slugs=slug1,slug2 [--dry-run]'
  );
}
const targetSlugs = new Set(slugsArg.replace('--slugs=', '').split(','));

const mockProductos = JSON.parse(
  readFileSync('src/data/mock-productos.json', 'utf8')
);
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let actualizados = 0;
for (const producto of mockProductos) {
  if (!targetSlugs.has(producto.slug)) continue;

  const payload = {
    especificaciones: producto.especificaciones ?? [],
    aplicaciones_es: producto.aplicaciones_es ?? [],
    aplicaciones_en: producto.aplicaciones_en ?? [],
    descripcion_larga_es: producto.descripcion_larga_es ?? '',
    descripcion_larga_en: producto.descripcion_larga_en ?? '',
    ficha_pdf: producto.ficha_pdf ?? null,
    atributos: {
      beneficios_es: producto.beneficios_es ?? [],
      beneficios_en: producto.beneficios_en ?? [],
      valor_es: producto.valor_es ?? null,
      valor_en: producto.valor_en ?? null,
      marca: producto.marca ?? null,
    },
  };

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Actualizando ${producto.slug}...`);
  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    actualizados += 1;
    continue;
  }

  const { error } = await supabase
    .from('productos')
    .update(payload)
    .eq('slug', producto.slug);
  if (error) {
    console.error(`Error actualizando ${producto.slug}:`, error.message);
    process.exitCode = 1;
    continue;
  }
  actualizados += 1;
}

console.log(
  `${actualizados} producto(s) ${DRY_RUN ? 'listos para actualizar' : 'actualizados'} de ${targetSlugs.size} solicitados.`
);
