#!/usr/bin/env node
/**
 * Descarga de recursos (datasheets PDF y fotos) para productos I-ME.
 *
 * Uso:
 *   node scripts/resources-download.mjs [--dry-run] [--prod-id prod-25] [--tipo foto|datasheet]
 *
 * Flags:
 *   --dry-run      Muestra qué descargaría sin ejecutar
 *   --prod-id X    Limita a un producto específico
 *   --tipo         Descarga sólo fotos o sólo datasheets
 *
 * Requisitos:
 *   - El manifest i-me-content/manifest-angell.json debe tener URLs completas
 *   - Para fotos: mínimo 1200×900px, perspectiva frontal (verificar manualmente)
 *   - Para PDFs: sólo desde sitio oficial del fabricante o distribuidor autorizado
 *
 * Log de resultados:
 *   i-me-content/download-log.json
 */

import { createWriteStream, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = resolve(ROOT, 'i-me-content/manifest-angell.json');
const LOG_PATH = resolve(ROOT, 'i-me-content/download-log.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PROD_ID_FILTER = args.includes('--prod-id') ? args[args.indexOf('--prod-id') + 1] : null;
const TIPO_FILTER = args.includes('--tipo') ? args[args.indexOf('--tipo') + 1] : null; // 'foto' | 'datasheet'

function get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'IMePlatform-ResourceBot/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} para ${url}`));
      }
      resolve(res);
    }).on('error', reject);
  });
}

async function descargar(url, destPath, descripcion) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] ${descripcion}`);
    console.log(`    Origen : ${url}`);
    console.log(`    Destino: ${destPath}`);
    return { estado: 'dry_run', url, destino: destPath };
  }

  const dir = destPath.substring(0, destPath.lastIndexOf('/'));
  mkdirSync(resolve(ROOT, dir), { recursive: true });
  const fullDest = resolve(ROOT, destPath);

  if (existsSync(fullDest)) {
    console.log(`  ⏭  YA EXISTE: ${destPath}`);
    return { estado: 'ya_existe', url, destino: destPath };
  }

  try {
    const stream = await get(url);
    await new Promise((res, rej) => {
      const file = createWriteStream(fullDest);
      stream.pipe(file);
      file.on('finish', res);
      file.on('error', rej);
    });
    console.log(`  ✅ DESCARGADO: ${destPath}`);
    return { estado: 'descargado', url, destino: destPath, fuente: url };
  } catch (err) {
    console.error(`  ❌ ERROR: ${descripcion} — ${err.message}`);
    return { estado: 'error', url, destino: destPath, error: err.message };
  }
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const log = { generado: new Date().toISOString(), dry_run: DRY_RUN, resultados: [] };

  const productos = manifest.productos.filter((p) => {
    if (PROD_ID_FILTER && p.prod_id !== PROD_ID_FILTER) return false;
    return true;
  });

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  DESCARGA DE RECURSOS — I-ME Platform`);
  if (DRY_RUN) console.log('  MODO: DRY-RUN (sin descarga real)');
  console.log(`  Fabricante: ${manifest._meta.fabricante}`);
  console.log(`  Productos en manifest: ${productos.length}`);
  console.log('═══════════════════════════════════════════════════\n');

  for (const prod of productos) {
    console.log(`\n▶ ${prod.prod_id}  ${prod.serie}`);

    // --- FOTO ---
    if (TIPO_FILTER !== 'datasheet') {
      if (prod.url_foto_oficial && prod.foto_estado === 'verificar_en_sitio') {
        console.log('  ⚠  Foto: URL del producto conocida pero imagen HD debe extraerse manualmente');
        console.log(`     Visitar: ${prod.url_foto_oficial}`);
        console.log(`     Guardar en: ${prod.ruta_destino_foto}`);
        console.log('     Criterio: 1200×900px mínimo, perspectiva frontal');
        log.resultados.push({
          prod_id: prod.prod_id,
          tipo: 'foto',
          estado: 'manual_requerido',
          url_producto: prod.url_foto_oficial,
          destino: prod.ruta_destino_foto,
          motivo: 'Las imágenes del sitio web del fabricante requieren extracción manual (no hay URL directa de imagen).',
        });
      } else if (!prod.url_foto_oficial) {
        console.log('  ⚠  Foto: URL oficial no encontrada — buscar en sitio del fabricante');
        log.resultados.push({
          prod_id: prod.prod_id,
          tipo: 'foto',
          estado: 'url_no_encontrada',
          destino: prod.ruta_destino_foto,
          motivo: prod.notas,
        });
      } else if (prod.url_foto_oficial && prod.foto_estado === 'buscar_en_sitio') {
        console.log(`  ⚠  Foto: URL exacta pendiente. Buscar en: ${prod.url_producto_oficial}`);
        log.resultados.push({
          prod_id: prod.prod_id,
          tipo: 'foto',
          estado: 'buscar_en_sitio',
          url_sitio: prod.url_producto_oficial,
          destino: prod.ruta_destino_foto,
        });
      }
    }

    // --- DATASHEET ---
    if (TIPO_FILTER !== 'foto') {
      if (prod.datasheet_url_conocida) {
        const ext = prod.datasheet_url_conocida.endsWith('.pdf') ? '.pdf' : '.html';
        const filename = `${prod.serie.toLowerCase().replace(/\s+/g, '-')}${ext}`;
        const destPath = `${prod.ruta_destino_datasheet}${filename}`;
        const resultado = await descargar(
          prod.datasheet_url_conocida,
          destPath,
          `Datasheet ${prod.serie}`
        );
        resultado.prod_id = prod.prod_id;
        resultado.tipo = 'datasheet';
        log.resultados.push(resultado);
      } else if (prod.datasheet_estado === 'verificar_en_sitio' || prod.datasheet_estado === 'buscar_en_sitio') {
        console.log(`  ⚠  Datasheet: buscar PDF en ${prod.url_producto_oficial}`);
        log.resultados.push({
          prod_id: prod.prod_id,
          tipo: 'datasheet',
          estado: prod.datasheet_estado,
          url_sitio: prod.url_producto_oficial,
          destino: prod.ruta_destino_datasheet,
          accion: 'Visitar página del producto, descargar PDF si disponible, guardar en ruta destino',
        });
      }
    }
  }

  // Resumen
  const descargados = log.resultados.filter((r) => r.estado === 'descargado').length;
  const manuales = log.resultados.filter((r) => ['manual_requerido', 'buscar_en_sitio', 'verificar_en_sitio', 'url_no_encontrada'].includes(r.estado)).length;
  const errores = log.resultados.filter((r) => r.estado === 'error').length;

  console.log('\n─────────────────────────────────────────────────────────');
  console.log('RESUMEN DE DESCARGA:');
  console.log(`  Descargados automáticamente : ${descargados}`);
  console.log(`  Requieren acción manual      : ${manuales}`);
  console.log(`  Errores                      : ${errores}`);
  console.log(`  Log guardado en              : i-me-content/download-log.json`);
  console.log('─────────────────────────────────────────────────────────\n');

  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n');
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
