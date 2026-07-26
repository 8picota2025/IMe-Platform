import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fields = [
  'nombre_es',
  'nombre_en',
  'descripcion_corta_es',
  'descripcion_corta_en',
  'descripcion_larga_es',
  'descripcion_larga_en',
  'aplicaciones_es',
  'aplicaciones_en',
  'gtin',
  'dian_codigo',
];

const counts = {};

for (const field of fields) {
  const empty =
    field === 'aplicaciones_es' || field === 'aplicaciones_en'
      ? await countArrayEmpty(field)
      : await countEmpty(field);
  counts[field] = empty;
}

const { count: total, error } = await supabase
  .from('productos')
  .select('id', { count: 'exact', head: true })
  .eq('activo', true);

if (error) throw error;

console.log(JSON.stringify({ total_activos: total, campos_vacios: counts }, null, 2));

async function countEmpty(field) {
  const { count, error } = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true)
    .or(`${field}.is.null,${field}.eq.`);
  if (error) throw error;
  return count;
}

async function countArrayEmpty(field) {
  const { count, error } = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true)
    .or(`${field}.is.null,${field}.eq.{}`);
  if (error) throw error;
  return count;
}
