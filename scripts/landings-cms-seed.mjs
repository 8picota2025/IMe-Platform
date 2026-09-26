#!/usr/bin/env node
/**
 * Genera la migración de seed de las landings de campaña (Fase 3B, tanda 1) desde el
 * TypeScript actual: el contenido migrado es idéntico por construcción. Valida cada landing
 * con el mismo esquema que la build y aborta si alguna no cumple.
 *
 *   node scripts/landings-cms-seed.mjs supabase/migrations/<timestamp>_seed_landings_campana.sql
 */
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { createJiti } from 'jiti';

const salida = process.argv[2];
if (!salida) {
  console.error('Uso: node scripts/landings-cms-seed.mjs <ruta de la migración>');
  process.exit(1);
}

const jiti = createJiti(import.meta.url);
const landings = await jiti.import('../src/data/comercial-landings.ts');
const esquema = await jiti.import('../src/lib/landings-cms-schema.ts');

const TAG = '$ime_landing$';
const literal = obj => {
  const json = JSON.stringify(obj);
  if (json.includes(TAG)) throw new Error(`El contenido contiene el delimitador ${TAG}`);
  return `${TAG}${json}${TAG}::jsonb`;
};

const errores = [];
const filas = landings.listCampaignLandingIds().map(id => {
  const copia = {};
  for (const locale of ['es', 'en']) {
    const copy = esquema.copyEditableDesdeTs(landings.getCampaignLanding(id, locale));
    for (const e of esquema.validarCopyCampana(copy)) errores.push(`${id} (${locale}): ${e}`);
    copia[locale] = copy;
  }
  return `  ('campana', '${id}', ${literal(copia.es)}, ${literal(copia.en)})`;
});

if (errores.length > 0) {
  console.error(`Landings inválidas:\n- ${errores.join('\n- ')}`);
  process.exit(1);
}

const sql = `-- Fase 3B, tanda 1: seed de las ${filas.length} landings de campaña, generado por
-- scripts/landings-cms-seed.mjs desde src/data/comercial-landings.ts (no editar a mano).
-- ON CONFLICT DO NOTHING: nunca pisa lo que ya se haya editado en el CMS.

INSERT INTO public.landings (tipo, clave, contenido_es, contenido_en)
VALUES
${filas.join(',\n')}
ON CONFLICT (tipo, clave) DO NOTHING;

-- Versión 1 en el historial, para poder volver al contenido original.
INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE tipo = 'campana'
ON CONFLICT (landing_id, version) DO NOTHING;
`;

writeFileSync(salida, sql);
console.log(`OK ${salida}: ${filas.length} landings de campaña`);
