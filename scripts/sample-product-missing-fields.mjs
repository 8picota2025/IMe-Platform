import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from('productos')
  .select(`
    slug,nombre_es,nombre_en,descripcion_corta_es,descripcion_corta_en,
    descripcion_larga_es,descripcion_larga_en,aplicaciones_es,aplicaciones_en,gtin,
    familias(nombre_es),tipos(nombre_es)
  `)
  .eq('activo', true)
  .or(
    [
      'nombre_en.is.null',
      'descripcion_larga_es.is.null',
      'descripcion_larga_en.is.null',
      'aplicaciones_es.is.null',
      'aplicaciones_en.is.null',
    ].join(',')
  )
  .order('slug')
  .limit(8);

if (error) throw error;

console.log(JSON.stringify(data, null, 2));
