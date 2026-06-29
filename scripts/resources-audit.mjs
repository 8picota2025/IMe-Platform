#!/usr/bin/env node
/**
 * Auditoría de recursos faltantes para productos I-ME.
 * Genera un log clasificado de imágenes y fichas PDF ausentes o genéricas.
 *
 * Uso:
 *   node scripts/resources-audit.mjs
 *   node scripts/resources-audit.mjs --json   (salida JSON pura)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PRODUCTOS_PATH = resolve(ROOT, 'src/data/mock-productos.json');
const MANIFEST_ANGELL = resolve(ROOT, 'i-me-content/manifest-angell.json');
const OUTPUT_PATH = resolve(ROOT, 'i-me-content/audit-resources.json');

// Imágenes conocidas como genéricas/reutilizadas (stock de extracción)
const IMAGENES_GENERICAS = new Set([
  '/assets/extraccion/img/Img1.jpg',
  '/assets/extraccion/img/Img2.jpg',
  '/assets/extraccion/img/Img4.jpg',
  '/assets/extraccion/img/Img6.jpg',
  '/assets/extraccion/img/Img7.jpg',
  '/assets/extraccion/img/Img11.jpg',
  '/assets/extraccion/img/Img14.jpg',
  '/assets/extraccion/img/Img18.jpg',
  '/assets/extraccion/img/Img19.jpg',
  '/assets/extraccion/img/Img21.jpg',
  '/assets/extraccion/img/Img22.jpg',
  '/assets/extraccion/img/Img25.jpg',
  '/assets/extraccion/img/Img26.jpg',
  '/assets/extraccion/img/Img27.jpg',
  '/assets/extraccion/img/Img28.jpg',
]);

// Fabricante conocido por prod_id
const FABRICANTE_MAP = {
  'prod-25': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
  'prod-26': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
  'prod-27': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
  'prod-28': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
  'prod-29': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
  'prod-30': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
  'prod-31': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
  'prod-32': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
  'prod-33': { fabricante: 'Angell Technology', sitio: 'https://en.szangell.com' },
};

function clasificarFoto(prod) {
  if (!prod.imagen_principal) return 'FALTANTE';
  if (IMAGENES_GENERICAS.has(prod.imagen_principal)) return 'GENERICA_STOCK';
  return 'OK';
}

function clasificarDatasheet(prod) {
  if (!prod.ficha_pdf) return 'FALTANTE';
  return 'OK';
}

function prioridad(fotoEstado, dsEstado, fabricanteConocido) {
  if (dsEstado === 'FALTANTE' && fabricanteConocido) return 'ALTA';
  if (dsEstado === 'FALTANTE' && !fabricanteConocido) return 'BLOQUEANTE_CONTENIDO';
  if (fotoEstado !== 'OK' && fabricanteConocido) return 'MEDIA';
  return 'BAJA';
}

function main() {
  const productos = JSON.parse(readFileSync(PRODUCTOS_PATH, 'utf8'));
  const manifestAngell = JSON.parse(readFileSync(MANIFEST_ANGELL, 'utf8'));
  const angellMap = Object.fromEntries(
    manifestAngell.productos.map((p) => [p.prod_id, p])
  );

  const ahora = new Date().toISOString();
  const filas = [];

  for (const prod of productos) {
    const fotoEstado = clasificarFoto(prod);
    const dsEstado = clasificarDatasheet(prod);
    const fabricanteInfo = FABRICANTE_MAP[prod.id] ?? null;
    const angell = angellMap[prod.id] ?? null;

    // Sólo registrar si hay algo faltante
    const hayProblema =
      fotoEstado !== 'OK' || dsEstado !== 'OK';

    const fila = {
      prod_id: prod.id,
      slug: prod.slug,
      nombre_es: prod.nombre_es,
      familia: prod.familia_slug ?? prod.familia_id,
      fabricante: fabricanteInfo?.fabricante ?? 'DESCONOCIDO — TODO_CLIENTE',
      fabricante_sitio: fabricanteInfo?.sitio ?? null,
      foto_estado: fotoEstado,
      foto_actual: prod.imagen_principal,
      datasheet_estado: dsEstado,
      datasheet_actual: prod.ficha_pdf,
      prioridad: prioridad(fotoEstado, dsEstado, !!fabricanteInfo),
      fuente_foto: angell?.url_foto_oficial ?? null,
      fuente_datasheet: angell?.datasheet_url_conocida ?? null,
      ruta_destino_foto: angell?.ruta_destino_foto ?? `i-me-content/photos/_pendiente-fabricante/${prod.slug}/`,
      ruta_destino_datasheet: angell?.ruta_destino_datasheet ?? `i-me-content/datasheets/_pendiente-fabricante/${prod.slug}/`,
      notas: angell?.notas ?? (fabricanteInfo ? null : 'BLOQUEANTE_CONTENIDO: solicitar fabricante y modelo al cliente'),
    };

    filas.push(fila);
  }

  const resumen = {
    total_productos: productos.length,
    foto_ok: filas.filter((f) => f.foto_estado === 'OK').length,
    foto_generica: filas.filter((f) => f.foto_estado === 'GENERICA_STOCK').length,
    foto_faltante: filas.filter((f) => f.foto_estado === 'FALTANTE').length,
    datasheet_ok: filas.filter((f) => f.datasheet_estado === 'OK').length,
    datasheet_faltante: filas.filter((f) => f.datasheet_estado === 'FALTANTE').length,
    prioridad_alta: filas.filter((f) => f.prioridad === 'ALTA').length,
    prioridad_media: filas.filter((f) => f.prioridad === 'MEDIA').length,
    bloqueante_contenido: filas.filter((f) => f.prioridad === 'BLOQUEANTE_CONTENIDO').length,
    fabricante_conocido: filas.filter((f) => f.fabricante !== 'DESCONOCIDO — TODO_CLIENTE').length,
    fabricante_desconocido: filas.filter((f) => f.fabricante === 'DESCONOCIDO — TODO_CLIENTE').length,
  };

  const salida = {
    _meta: {
      generado: ahora,
      fuente_datos: 'src/data/mock-productos.json',
      nota: 'Este archivo documenta el estado de recursos (fotos y datasheets) de todos los productos I-ME. Actualizar tras cada descarga exitosa.',
    },
    resumen,
    productos: filas,
  };

  const jsonFlag = process.argv.includes('--json');

  if (jsonFlag) {
    process.stdout.write(JSON.stringify(salida, null, 2) + '\n');
  } else {
    // Salida legible por consola
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  AUDITORÍA DE RECURSOS — I-ME Platform');
    console.log(`  Generado: ${ahora}`);
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('RESUMEN:');
    console.log(`  Total productos   : ${resumen.total_productos}`);
    console.log(`  Foto OK           : ${resumen.foto_ok}`);
    console.log(`  Foto genérica     : ${resumen.foto_generica}  ← reutilizadas, reemplazar`);
    console.log(`  Foto faltante     : ${resumen.foto_faltante}`);
    console.log(`  Datasheet OK      : ${resumen.datasheet_ok}`);
    console.log(`  Datasheet faltante: ${resumen.datasheet_faltante}  ← todos`);
    console.log(`  Fabricante conocido   : ${resumen.fabricante_conocido} (Angell Technology)`);
    console.log(`  Fabricante desconocido: ${resumen.fabricante_desconocido}  ← TODO_CLIENTE`);
    console.log('');
    console.log('PRIORIDADES:');
    console.log(`  🔴 ALTA               : ${resumen.prioridad_alta} productos — fabricante conocido, datasheet faltante`);
    console.log(`  🟡 MEDIA              : ${resumen.prioridad_media} productos — foto genérica, fabricante conocido`);
    console.log(`  ⛔ BLOQUEANTE_CONTENIDO: ${resumen.bloqueante_contenido} productos — fabricante desconocido`);

    console.log('\n─────────────────────────────────────────────────────────');
    console.log('DETALLE POR PRIORIDAD:\n');

    const grupos = ['ALTA', 'MEDIA', 'BLOQUEANTE_CONTENIDO', 'BAJA'];
    const etiqueta = { ALTA: '🔴', MEDIA: '🟡', BLOQUEANTE_CONTENIDO: '⛔', BAJA: '⚪' };
    for (const p of grupos) {
      const grupo = filas.filter((f) => f.prioridad === p);
      if (!grupo.length) continue;
      console.log(`${etiqueta[p]} ${p} (${grupo.length}):`);
      for (const f of grupo) {
        console.log(`   ${f.prod_id}  ${f.nombre_es}`);
        console.log(`         Fabricante : ${f.fabricante}`);
        console.log(`         Foto       : ${f.foto_estado} → ${f.foto_actual ?? '—'}`);
        console.log(`         Datasheet  : ${f.datasheet_estado}`);
        if (f.fuente_datasheet) console.log(`         Fuente DS  : ${f.fuente_datasheet}`);
        if (f.notas) console.log(`         Notas      : ${f.notas}`);
        console.log('');
      }
    }

    console.log('─────────────────────────────────────────────────────────');
    console.log(`Audit guardado en: i-me-content/audit-resources.json\n`);
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(salida, null, 2) + '\n');
}

main();
