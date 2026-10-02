import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
const sb = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
let all=[], from=0;
for(;;){
  const {data,error}=await sb.from('productos').select('id,slug,sku,nombre_es,nombre_en,activo,ficha_pdf,imagen_principal,descripcion_corta_es,descripcion_corta_en,descripcion_larga_es,descripcion_larga_en,aplicaciones_es,especificaciones,atributos,galeria,familias(nombre_es,slug)').range(from,from+499);
  if(error) throw error; all.push(...data); if(data.length<500) break; from+=500;
}
writeFileSync(process.argv[2],JSON.stringify(all));
console.log(all.length);
