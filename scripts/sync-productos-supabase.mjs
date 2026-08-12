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
const targetSlugs = slugsArg
  ? new Set(slugsArg.replace('--slugs=', '').split(',').filter(Boolean))
  : null;

const mockProductos = JSON.parse(
  readFileSync('src/data/mock-productos.json', 'utf8')
);
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let actualizados = 0;
let saltados = 0;
for (const producto of mockProductos) {
  if (targetSlugs && !targetSlugs.has(producto.slug)) continue;

  // Guard: solo sincronizamos productos que tengan contenido enriquecido en el
  // mock. Consideramos "enriquecido" si especificaciones o beneficios_es tienen
  // al menos un elemento; si ambos están vacíos, es señal de que el producto
  // nunca fue enriquecido en el mock y sincronizarlo destruiría en silencio el
  // contenido real que ya existe en la fila de Supabase.
  const tieneContenidoEnriquecido =
    (Array.isArray(producto.especificaciones) && producto.especificaciones.length > 0) ||
    (Array.isArray(producto.beneficios_es) && producto.beneficios_es.length > 0);

  if (!tieneContenidoEnriquecido) {
    console.warn(
      `⚠️  Saltando ${producto.slug}: no tiene contenido enriquecido en el mock (especificaciones/beneficios vacíos)`
    );
    saltados += 1;
    continue;
  }

  // Leemos primero el `atributos` actual de la fila en Supabase para poder
  // fusionar las claves nuevas (beneficios_es, beneficios_en, valor_es,
  // valor_en, marca) sin pisar otras claves que ya pudieran existir en esa
  // columna JSONB. Esta lectura es de solo consulta, así que también se
  // ejecuta en --dry-run para que la previsualización refleje el merge real.
  const { data: filaActual, error: fetchError } = await supabase
    .from('productos')
    .select('id,atributos')
    .eq('slug', producto.slug)
    .maybeSingle();
  if (fetchError) {
    console.error(`Error leyendo atributos actuales de ${producto.slug}:`, fetchError.message);
    process.exitCode = 1;
    continue;
  }
  const atributosActuales = (filaActual && filaActual.atributos) || {};

  const payload = {
    descripcion_corta_es: producto.descripcion_corta_es ?? '',
    descripcion_corta_en: producto.descripcion_corta_en ?? '',
    especificaciones: producto.especificaciones ?? [],
    aplicaciones_es: producto.aplicaciones_es ?? [],
    aplicaciones_en: producto.aplicaciones_en ?? [],
    descripcion_larga_es: producto.descripcion_larga_es ?? '',
    descripcion_larga_en: producto.descripcion_larga_en ?? '',
    ficha_pdf: producto.ficha_pdf ?? null,
    atributos: {
      ...atributosActuales,
      beneficios_es: producto.beneficios_es ?? [],
      beneficios_en: producto.beneficios_en ?? [],
      valor_es: producto.valor_es ?? null,
      valor_en: producto.valor_en ?? null,
      preguntas_frecuentes_es: producto.preguntas_frecuentes_es ?? [],
      preguntas_frecuentes_en: producto.preguntas_frecuentes_en ?? [],
      seo_keywords_es: producto.seo_keywords_es ?? [],
      seo_keywords_en: producto.seo_keywords_en ?? [],
      marca: producto.marca ?? null,
    },
  };

  const esNuevo = !filaActual;
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}${esNuevo ? 'Creando' : 'Actualizando'} ${producto.slug}...`);
  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    actualizados += 1;
    continue;
  }

  const { error } = esNuevo
    ? await supabase.from('productos').insert({
        id: producto.id,
        slug: producto.slug,
        familia_id: producto.familia_id,
        tipo_id: producto.tipo_id,
        nombre_es: producto.nombre_es,
        nombre_en: producto.nombre_en,
        descripcion_corta_es: producto.descripcion_corta_es,
        descripcion_corta_en: producto.descripcion_corta_en,
        imagen_principal: producto.imagen_principal,
        galeria: producto.galeria ?? [],
        tipo_comercial: producto.tipo_comercial,
        fulfillment_mode: producto.fulfillment_mode,
        precio: producto.precio,
        moneda: producto.moneda,
        stock: producto.stock,
        disponible: producto.disponible,
        destacado: producto.destacado,
        nuevo: producto.nuevo,
        activo: producto.activo,
        orden: producto.orden,
        ...payload,
      })
    : await supabase.from('productos').update(payload).eq('slug', producto.slug);
  if (error) {
    console.error(`Error actualizando ${producto.slug}:`, error.message);
    process.exitCode = 1;
    continue;
  }
  actualizados += 1;
}

console.log(
  `${actualizados} producto(s) ${DRY_RUN ? 'listos para sincronizar' : 'sincronizados'}, ${saltados} saltado(s) por falta de contenido enriquecido, de ${targetSlugs?.size ?? mockProductos.length} solicitados.`
);
