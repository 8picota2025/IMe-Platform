#!/usr/bin/env node
/**
 * Regenera src/data/landings-indice.ts: tipo, clave, nombre y rutas de todas las landings,
 * para que el admin las liste sin cargar todo el copy (presupuesto de JS del build).
 * `src/lib/landings-indice.test.ts` falla si el índice no coincide con las fuentes.
 *
 *   node scripts/landings-indice.mjs
 */
import { writeFileSync } from 'node:fs';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { calcularIndiceLandings } = await jiti.import('../src/lib/landings-indice-fuentes.ts');
const indice = calcularIndiceLandings();

const ts = `/**
 * Índice de todas las landings (tipo, clave, nombre y rutas). Generado por
 * scripts/landings-indice.mjs desde src/data/*-landings.ts y familia-seo.ts: no editar a mano.
 */
export interface EntradaIndiceLanding {
  tipo: 'campana' | 'fabricante' | 'ciudad' | 'familia';
  clave: string;
  nombre: string;
  path: string;
  pathEn: string;
}

export const LANDINGS_INDICE: EntradaIndiceLanding[] = ${JSON.stringify(indice, null, 2)};
`;

writeFileSync(new URL('../src/data/landings-indice.ts', import.meta.url), ts);
console.log(`OK src/data/landings-indice.ts: ${indice.length} landings`);
