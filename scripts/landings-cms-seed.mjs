#!/usr/bin/env node
/**
 * Genera la migración de seed de un tipo de landings (Fase 3B: tanda 1 campaña, tanda 2
 * fabricante) desde el TypeScript actual: el contenido migrado es idéntico por construcción.
 * Valida cada landing con el mismo esquema que la build y aborta si alguna no cumple.
 *
 *   node scripts/landings-cms-seed.mjs campana supabase/migrations/<ts>_seed_landings_campana.sql
 *   node scripts/landings-cms-seed.mjs fabricante supabase/migrations/<ts>_seed_landings_fabricante.sql
 */
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { createJiti } from 'jiti';

const [tipo, salida] = process.argv.slice(2);
if (!['campana', 'fabricante'].includes(tipo) || !salida) {
  console.error('Uso: node scripts/landings-cms-seed.mjs <campana|fabricante> <ruta de la migración>');
  process.exit(1);
}

const jiti = createJiti(import.meta.url);
const esquema = await jiti.import('../src/lib/landings-cms-schema.ts');
const FUENTES = {
  campana: {
    archivo: 'src/data/comercial-landings.ts',
    nombre: 'de campaña',
    ids: async () => (await jiti.import('../src/data/comercial-landings.ts')).listCampaignLandingIds(),
    get: async (id, locale) =>
      (await jiti.import('../src/data/comercial-landings.ts')).getCampaignLanding(id, locale),
  },
  fabricante: {
    archivo: 'src/data/fabricante-landings.ts',
    nombre: 'de fabricante',
    ids: async () => (await jiti.import('../src/data/fabricante-landings.ts')).listFabricanteLandingIds(),
    get: async (id, locale) =>
      (await jiti.import('../src/data/fabricante-landings.ts')).getFabricanteLanding(id, locale),
  },
};
const fuente = FUENTES[tipo];

const TAG = '$ime_landing$';
const literal = obj => {
  const json = JSON.stringify(obj);
  if (json.includes(TAG)) throw new Error(`El contenido contiene el delimitador ${TAG}`);
  return `${TAG}${json}${TAG}::jsonb`;
};

const errores = [];
const filas = [];
for (const id of await fuente.ids()) {
  const copia = {};
  for (const locale of ['es', 'en']) {
    const copy = esquema.copyEditableDesdeTs(await fuente.get(id, locale));
    for (const e of esquema.validarCopyLanding(copy, tipo)) errores.push(`${id} (${locale}): ${e}`);
    copia[locale] = copy;
  }
  filas.push(`  ('${tipo}', '${id}', ${literal(copia.es)}, ${literal(copia.en)})`);
}

if (errores.length > 0) {
  console.error(`Landings inválidas:\n- ${errores.join('\n- ')}`);
  process.exit(1);
}

const tanda = tipo === 'campana' ? 1 : 2;
const sql = `-- Fase 3B, tanda ${tanda}: seed de las ${filas.length} landings ${fuente.nombre}, generado por
-- scripts/landings-cms-seed.mjs desde ${fuente.archivo} (no editar a mano).
-- ON CONFLICT DO NOTHING: nunca pisa lo que ya se haya editado en el CMS.

INSERT INTO public.landings (tipo, clave, contenido_es, contenido_en)
VALUES
${filas.join(',\n')}
ON CONFLICT (tipo, clave) DO NOTHING;

-- Versión 1 en el historial, para poder volver al contenido original.
INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE tipo = '${tipo}'
ON CONFLICT (landing_id, version) DO NOTHING;
`;

writeFileSync(salida, sql);
console.log(`OK ${salida}: ${filas.length} landings ${fuente.nombre}`);
