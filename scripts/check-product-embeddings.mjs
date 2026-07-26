import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const total = await supabase
  .from('productos')
  .select('id', { count: 'exact', head: true })
  .eq('activo', true);

if (total.error) throw total.error;

const missing = await supabase
  .from('productos')
  .select('id', { count: 'exact', head: true })
  .eq('activo', true)
  .is('embedding', null);

if (missing.error) throw missing.error;

console.log(JSON.stringify({
  activeProducts: total.count,
  activeProductsWithoutEmbedding: missing.count,
}, null, 2));
