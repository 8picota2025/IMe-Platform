#!/usr/bin/env node
/**
 * Sustituye identificadores técnicos Saikang por URLs comerciales legibles.
 * Mantiene rutas de recursos existentes y escribe 301 explícitos para las URLs
 * anteriores, de modo que no se rompan fichas, resultados indexados ni enlaces.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PRODUCTS = path.join(ROOT, 'src/data/mock-productos.json');
const HTACCESS = path.join(ROOT, 'public/.htaccess');
const START = '# Saikang product slug migrations — generated';
const END = '# End Saikang product slug migrations';

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function nombreComercial(producto) {
  const source = `${producto.nombre_en ?? ''} ${producto.nombre_es ?? ''}`.toLowerCase();
  const modelSource = String(producto.nombre_en ?? producto.nombre_es ?? '');
  const detectedModel =
    modelSource.match(/\bAInno\s+(?:L\d+|Light\s*\w+|X\d+)\b/i)?.[0] ??
    modelSource.match(/\b[A-Za-z]{1,5}\d[\w-]*/)?.[0] ??
    modelSource.match(/^[A-Za-z]+[\w-]*/)?.[0];
  const model = String(producto.sku ?? detectedModel ?? '').toUpperCase();
  let type = '';

  if (/electric-hydraulic operating table|electrohydraulic operating table/.test(source)) type = 'Mesa quirúrgica electrohidráulica';
  else if (/electric operating table/.test(source)) type = 'Mesa quirúrgica eléctrica';
  else if (/operating table/.test(source)) type = 'Mesa quirúrgica';
  else if (/gynecological/.test(source)) type = 'Mesa de examen ginecológico';
  else if (/obstetric bed|delivery bed/.test(source)) type = `Cama obstétrica${/electric/.test(source) ? ' eléctrica' : ''}`;
  else if (/baby crib/.test(source)) type = 'Cuna hospitalaria';
  else if (/children bed|child bed|pediatric bed/.test(source)) type = 'Cama pediátrica';
  else if (/icu.*bed|bed.*icu/.test(source)) type = `Cama UCI${/electric/.test(source) ? ' eléctrica' : ''}`;
  else if (/manual bed/.test(source)) type = 'Cama hospitalaria manual';
  else if (/homecare bed/.test(source)) type = 'Cama eléctrica para cuidado domiciliario';
  else if (/electric.*bed/.test(source)) type = 'Cama hospitalaria eléctrica';
  else if (/hospital bed|nursing home bed/.test(source)) type = 'Cama hospitalaria';
  else if (/spinal therapy|chiro table/.test(source)) type = 'Mesa de terapia espinal';
  else if (/examination table|exam couch/.test(source)) type = `Mesa de examen${/hydraulic/.test(source) ? ' hidráulica' : ' clínica'}`;
  else if (/whole-body x-ray/.test(source)) type = 'Camilla de traslado con radiografía de cuerpo completo';
  else if (/backrest x-ray/.test(source)) type = 'Camilla de traslado con radiografía de respaldo';
  else if (/patient transportation trolley|patient trolley|stretcher trolley/.test(source)) type = 'Camilla de traslado';
  else if (/foldable stretcher/.test(source)) type = 'Camilla plegable';
  else if (/stair stretcher/.test(source)) type = 'Camilla para escaleras';
  else if (/scoop stretcher/.test(source)) type = 'Camilla cuchara';
  else if (/spine board/.test(source)) type = 'Tabla espinal';
  else if (/cervical collar/.test(source)) type = 'Collar cervical';
  else if (/emergency trolley|emergency cart/.test(source)) type = 'Carro de emergencias';
  else if (/anesthesia trolley/.test(source)) type = 'Carro de anestesia';
  else if (/medicine trolley/.test(source)) type = 'Carro de medicamentos';
  else if (/nursing trolley/.test(source)) type = 'Carro de enfermería';
  else if (/instrument trolley/.test(source)) type = 'Carro de instrumental';
  else if (/computer|laptop|tablet|workstation|information.*cart/.test(source)) type = 'Carro informático clínico';
  else if (/trolley|cart/.test(source)) type = 'Carro clínico';
  else if (/dialysis chair/.test(source)) type = 'Sillón de diálisis';
  else if (/blood donation chair/.test(source)) type = 'Sillón para donación de sangre';
  else if (/wheelchair|wheel chair/.test(source)) type = 'Silla de ruedas';
  else if (/recliner|attendant sofa|accompany chair|waiting chair/.test(source)) type = 'Sillón hospitalario';
  else if (/nurse chair|nurse stool|surgical stool|lab chair/.test(source)) type = 'Silla clínica';
  else if (/dental chair/.test(source)) type = 'Sillón odontológico';
  else if (/chair/.test(source)) type = 'Sillón clínico';
  else if (/infusion pump/.test(source)) type = 'Bomba de infusión';
  else if (/syringe pump/.test(source)) type = 'Bomba de jeringa';
  else if (/ventilator/.test(source)) type = 'Ventilador médico';
  else if (/suction device/.test(source)) type = 'Aspirador médico';
  else if (/patient monitor/.test(source)) type = 'Monitor de paciente';
  else if (/fetal monitor/.test(source)) type = 'Monitor fetal';
  else if (/ecg/.test(source)) type = 'Electrocardiógrafo';
  else if (/shadowless|operating lamp/.test(source)) type = 'Lámpara quirúrgica';
  else if (/examining lamp/.test(source)) type = 'Lámpara de examen';
  else if (/pendant/.test(source)) type = 'Columna médica de techo';
  else if (/sterilizer|autoclave/.test(source)) type = 'Esterilizador de vapor';
  else if (/mattress/.test(source)) type = 'Colchón hospitalario';
  else if (/bedside table/.test(source)) type = 'Mesa de noche hospitalaria';
  else if (/overbed table/.test(source)) type = 'Mesa de sobrecama';
  else if (/iv stand/.test(source)) type = 'Soporte para infusión';
  else if (/curtain/.test(source)) type = 'Cortina médica';
  else type = String(producto.nombre_es ?? 'Equipo hospitalario').replace(/\s+(?:ref\.?\s*)?[^\s]+\s+saikang$/i, '').trim();

  return model ? `${type} Ref. ${model} Saikang` : `${type} Saikang`;
}

const products = JSON.parse(await readFile(PRODUCTS, 'utf8'));
const saikang = products.filter(producto => producto.marca === 'Saikang Medical');
const occupied = new Set(products.filter(producto => producto.marca !== 'Saikang Medical').map(producto => producto.slug));
const migrations = [];

for (const producto of saikang) {
  const oldSlug = producto.slug;
  const nombre = nombreComercial(producto);
  let newSlug = slugify(nombre);
  if (occupied.has(newSlug)) newSlug = `${newSlug}-${slugify(producto.sku ?? producto.nombre_en)}`;
  if (occupied.has(newSlug)) throw new Error(`Slug duplicado: ${newSlug}`);
  occupied.add(newSlug);

  producto.nombre_es = nombre;
  producto.slug = newSlug;
  producto.atributos = {
    ...(producto.atributos ?? {}),
    legacy_slugs: [...new Set([...(producto.atributos?.legacy_slugs ?? []), oldSlug])].filter(
      slug => slug !== newSlug
    ),
  };
  if (oldSlug !== newSlug) migrations.push({ oldSlug, newSlug });
}

let htaccess = await readFile(HTACCESS, 'utf8');
const previous = new RegExp(`${START}[\\s\\S]*?${END}\\n?`, 'g');
const redirectRules = products
  .filter(producto => producto.marca === 'Saikang Medical')
  .flatMap(producto =>
    (producto.atributos?.legacy_slugs ?? [])
      .filter(oldSlug => oldSlug && oldSlug !== producto.slug)
      .flatMap(oldSlug => [
        `RewriteRule ^es/productos/${oldSlug}/?$ /es/productos/${producto.slug}/ [R=301,L]`,
        `RewriteRule ^en/products/${oldSlug}/?$ /en/products/${producto.slug}/ [R=301,L]`,
      ])
  );
htaccess = htaccess.replace(previous, '').trimEnd() + `\n\n${START}\n${redirectRules.join('\n')}\n${END}\n`;

await writeFile(PRODUCTS, `${JSON.stringify(products, null, 2)}\n`);
await writeFile(HTACCESS, htaccess);
console.log(JSON.stringify({ renamed: migrations.length, sample: migrations.slice(0, 10) }, null, 2));
