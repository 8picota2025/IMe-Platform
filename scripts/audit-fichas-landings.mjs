import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
const sb = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
let all=[], from=0;
for(;;){
  const {data,error}=await sb.from('productos').select('id,slug,sku,nombre_es,activo,ficha_pdf,imagen_principal,descripcion_larga_es,aplicaciones_es,especificaciones,atributos,familias(nombre_es,slug)').range(from,from+499);
  if(error) throw error; all.push(...data); if(data.length<500) break; from+=500;
}
const act=all.filter(p=>p.activo);
const has=v=>typeof v==='string'&&v.trim().length>0;
const rows=act.map(p=>{
  const a=p.atributos??{};
  const benef=Array.isArray(a.beneficios_es)&&a.beneficios_es.length>0;
  const valor=has(a.valor_es);
  const faq=Array.isArray(a.preguntas_frecuentes_es)&&a.preguntas_frecuentes_es.length>0;
  const kw=Array.isArray(a.seo_keywords_es)&&a.seo_keywords_es.length>0;
  const enr=benef||valor||faq;
  return {slug:p.slug,sku:p.sku,nombre:p.nombre_es,familia:p.familias?.slug,marca:a.marca??a.fabricante??null,
    ficha:has(p.ficha_pdf),ficha_url:p.ficha_pdf,enriquecida:enr,benef,valor,faq,kw,
    nspecs:Array.isArray(p.especificaciones)?p.especificaciones.length:0,
    larga:has(p.descripcion_larga_es),apps:(p.aplicaciones_es??[]).length,img:has(p.imagen_principal)};
});
writeFileSync(process.argv[2],JSON.stringify(rows,null,1));
const c=f=>rows.filter(f).length;
console.log({total_all:all.length,activos:act.length,con_ficha:c(r=>r.ficha),enriquecida:c(r=>r.enriquecida),sin_ficha:c(r=>!r.ficha),
 sin_enriq:c(r=>!r.enriquecida),sin_ambos:c(r=>!r.ficha&&!r.enriquecida)});
const fam={};rows.filter(r=>!r.ficha&&!r.enriquecida).forEach(r=>fam[r.familia]=(fam[r.familia]||0)+1);console.log(fam);
const ma={};rows.filter(r=>!r.ficha&&!r.enriquecida).forEach(r=>ma[r.marca]=(ma[r.marca]||0)+1);console.log(Object.entries(ma).sort((a,b)=>b[1]-a[1]).slice(0,40));
