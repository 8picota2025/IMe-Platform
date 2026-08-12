#!/usr/bin/env node
/** Vincula imágenes verificadas de fabricante a productos sin imagen. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/data/mock-productos.json');
const products = JSON.parse(await readFile(file, 'utf8'));

// SKR007 aparece en el catálogo técnico de Jiangsu Saikang publicado por
// MedicalExpo. La página antigua del fabricante ya no entrega el JPG, por
// eso se conserva también la URL de referencia oficial para trazabilidad.
const sources = {
  'skm-b-skr007': {
    local: '/assets/productos/fabricante/saikang/skm-b-skr007.jpg',
    source: 'https://img.medicalexpo.com/pdf/repository_me/76520/skr007-abs-trolley-saikangmedical-238299_1mg.jpg',
    manufacturer: 'https://saikangmedical.co/English/Products/Carts/ABS-cart/index_2.html',
  },
};

let updated = 0;
for (const product of products) {
  const entry = sources[product.slug];
  if (!entry) continue;
  product.imagen_principal = entry.local;
  product.galeria = [entry.local];
  product.marca ??= 'Saikang Medical';
  product.atributos = {
    ...(product.atributos ?? {}),
    image_source: entry.source,
    manufacturer_image_source: entry.manufacturer,
    image_source_type: 'manufacturer-catalog',
  };
  updated += 1;
}

await writeFile(file, `${JSON.stringify(products, null, 2)}\n`);
console.log(`Imágenes de fabricante incorporadas: ${updated}`);
