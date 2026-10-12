#!/usr/bin/env node
/**
 * Post-build: los productos despublicados (activo=false) no generan página, pero
 * textos editoriales (familias, guías del Centro de Conocimiento, campañas) pueden
 * seguir enlazándolos. Aquí se retiran esos enlaces del HTML para no dejar 404:
 *  - botones (`class="btn …"`): se elimina el enlace completo;
 *  - enlaces en texto: se conserva el texto sin enlace.
 * Solo toca enlaces internos a /es/productos/<slug>/ o /en/products/<slug>/ cuya
 * página no existe en dist/.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? 'dist';
const ANCHOR =
  /<a\b([^>]*?)href="(\/(?:es\/productos|en\/products)\/[^"#?]+?)\/?"([^>]*)>([\s\S]*?)<\/a>/g;

function* htmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

const existe = new Map();
function paginaExiste(href) {
  if (!existe.has(href)) existe.set(href, fs.existsSync(path.join(root, href, 'index.html')));
  return existe.get(href);
}

let archivos = 0;
let enlaces = 0;
const rotos = new Set();
for (const file of htmlFiles(root)) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('/productos/') && !html.includes('/products/')) continue;
  let cambiado = false;
  const nuevo = html.replace(ANCHOR, (completo, antes, href, despues, interior) => {
    if (paginaExiste(href)) return completo;
    cambiado = true;
    enlaces += 1;
    rotos.add(href);
    return /class="[^"]*\bbtn\b/.test(`${antes}${despues}`) ? '' : interior;
  });
  if (cambiado) {
    fs.writeFileSync(file, nuevo);
    archivos += 1;
  }
}
console.log(
  `prune-enlaces-inactivos: ${enlaces} enlaces a ${rotos.size} productos sin página retirados en ${archivos} archivos`
);
