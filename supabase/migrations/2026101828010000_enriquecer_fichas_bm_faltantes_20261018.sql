-- Enriquecimiento de landings desde fichas técnicas oficiales del fabricante (bm-faltantes-20261018).
-- Contenido redactado solo con datos presentes en la ficha; ver informe docs/informe-fichas-fabricantes-2026-10-02.md.
-- Se aplica con el workflow manual "Deploy Supabase Migrations". Idempotente (UPDATE por slug).

UPDATE public.productos SET
  descripcion_larga_es = $d$El Sillón Reclinable BME002 de BM (Brother Medical) forma parte del catálogo IME. Página oficial del fabricante: Dual Motor Grey Lift Chair (BME002). Solicite ficha PDF al cotizar.$d$,
  descripcion_larga_en = $d$The BME002 reclining chair from BM (Brother Medical) is in the IME catalog. Official manufacturer page: Dual Motor Grey Lift Chair (BME002). Request PDF datasheet when quoting.$d$,
  especificaciones = $j$[{"clave":"Modelo / SKU","grupo":"Identificación","valor":"BME002"},{"clave":"Fabricante","grupo":"Identificación","valor":"BM"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Motor doble"},{"clave":"Capacidad","grupo":"Catálogo IME","valor":"145 kg"},{"clave":"Ancho asiento","grupo":"Catálogo IME","valor":"48 cm"},{"clave":"Altura silla","grupo":"Catálogo IME","valor":"52 cm"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Motor doble"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Capacidad: 145 kg"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Ancho asiento: 48 cm"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Altura silla: 52 cm"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$["Consultorio","Recuperación"]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$["Clinic","Recovery"]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Modelo BME002","Dual motor lift chair","Catálogo IME"],"beneficios_en":["Model BME002","Dual motor lift chair","IME catalog"],"valor_es":"Sillón BME002 BM con ficha de página fabricante.","valor_en":"BME002 BM chair with manufacturer page reference.","preguntas_frecuentes_es":[{"q":"¿Qué es el BME002?","a":"Sillón reclinable BM (Brother Medical) del catálogo IME."},{"q":"¿Dónde está la ficha?","a":"Consulte la página oficial del fabricante; PDF bajo solicitud a IME."},{"q":"¿Cómo cotizo?","a":"Indique BME002 y el área clínica."}],"preguntas_frecuentes_en":[{"q":"What is BME002?","a":"BM (Brother Medical) reclining chair in the IME catalog."},{"q":"Datasheet?","a":"See the official manufacturer page; PDF on request via IME."},{"q":"Quote?","a":"Provide BME002 and clinical area."}],"seo_keywords_es":["sillón BME002","BME002 BM","Brother Medical","IME"],"seo_keywords_en":["BME002 chair","Brother Medical BME002","IME"],"ficha_fabricante":{"fabricante":"BM","idioma":"en","url_origen":"https://www.brothermedical.com/Medical-Dual-Motor-Grey-Lift-Chair-pd40439220.html","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'sillon-reclinable-bme002-bm-ref-bme002';

UPDATE public.productos SET
  descripcion_larga_es = $d$El Silla Reclinable BME006 de BM forma parte del catálogo IME para instituciones de salud.

Silla reclinable con motor doble, capacidad 125 kg.

Según catálogo / documentación de referencia: Característica: Motor doble; Capacidad: 125 kg.$d$,
  descripcion_larga_en = $d$The Reclining Chair BME006 from BM is listed in the IME catalog for healthcare institutions.

Reclining chair with dual motor, 125 kg capacity.

Reference specs: Característica: Motor doble; Capacidad: 125 kg.$d$,
  especificaciones = $j$[{"clave":"Característica","grupo":"Catálogo IME","valor":"Motor doble"},{"clave":"Capacidad","grupo":"Catálogo IME","valor":"125 kg"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Motor doble"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Motor doble"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Capacidad: 125 kg"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$["Descanso","Cuidados"]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$["Descanso","Cuidados"]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Característica: Motor doble","Capacidad: 125 kg"],"beneficios_en":["Característica: Motor doble","Capacidad: 125 kg"],"valor_es":"Silla Reclinable BME006 (BM) con datos de catálogo IME.","valor_en":"Reclining Chair BME006 (BM) with IME catalog data.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Silla Reclinable BME006?","a":"Es un equipo BM del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Característica: Motor doble; Capacidad: 125 kg"},{"q":"¿En qué aplicaciones se usa?","a":"Descanso, Cuidados"},{"q":"¿Dónde obtengo la ficha técnica?","a":"Solicite a IME la ficha técnica oficial del modelo exacto."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Silla Reclinable BME006) y el área clínica; IME confirma disponibilidad y documentación."}],"preguntas_frecuentes_en":[{"q":"What is the Reclining Chair BME006?","a":"It is a BM device in the IME catalog."},{"q":"What key specs are listed?","a":"Característica: Motor doble; Capacidad: 125 kg"},{"q":"Typical applications?","a":"Descanso, Cuidados"},{"q":"Where is the datasheet?","a":"Request the official datasheet from IME."},{"q":"How do I get a quote?","a":"Provide exact model (Reclining Chair BME006) and clinical area; IME confirms availability."}],"seo_keywords_es":["Silla Reclinable BME006","Silla Reclinable BME006 BM","ficha técnica Silla Reclinable BME006","equipo médico Colombia","IME"],"seo_keywords_en":["Reclining Chair BME006","Reclining Chair BME006 BM","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"BM","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'silla-reclinable-bme006-bm-ref-bme006';

UPDATE public.productos SET
  descripcion_larga_es = $d$El Sillón Reclinable BME007 de BM forma parte del catálogo IME para instituciones de salud.

Sillón reclinable con motor doble, capacidad 125 kg.

Según catálogo / documentación de referencia: Característica: Motor doble; Capacidad: 125 kg.$d$,
  descripcion_larga_en = $d$The Recliner Chair BME007 from BM is listed in the IME catalog for healthcare institutions.

Recliner chair with dual motor, 125 kg capacity.

Reference specs: Característica: Motor doble; Capacidad: 125 kg.$d$,
  especificaciones = $j$[{"clave":"Característica","grupo":"Catálogo IME","valor":"Motor doble"},{"clave":"Capacidad","grupo":"Catálogo IME","valor":"125 kg"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Motor doble"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Motor doble"},{"clave":"Característica","grupo":"Catálogo IME","valor":"Capacidad: 125 kg"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$["Descanso","Cuidados"]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$["Descanso","Cuidados"]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Característica: Motor doble","Capacidad: 125 kg"],"beneficios_en":["Característica: Motor doble","Capacidad: 125 kg"],"valor_es":"Sillón Reclinable BME007 (BM) con datos de catálogo IME.","valor_en":"Recliner Chair BME007 (BM) with IME catalog data.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Sillón Reclinable BME007?","a":"Es un equipo BM del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Característica: Motor doble; Capacidad: 125 kg"},{"q":"¿En qué aplicaciones se usa?","a":"Descanso, Cuidados"},{"q":"¿Dónde obtengo la ficha técnica?","a":"Solicite a IME la ficha técnica oficial del modelo exacto."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Sillón Reclinable BME007) y el área clínica; IME confirma disponibilidad y documentación."}],"preguntas_frecuentes_en":[{"q":"What is the Recliner Chair BME007?","a":"It is a BM device in the IME catalog."},{"q":"What key specs are listed?","a":"Característica: Motor doble; Capacidad: 125 kg"},{"q":"Typical applications?","a":"Descanso, Cuidados"},{"q":"Where is the datasheet?","a":"Request the official datasheet from IME."},{"q":"How do I get a quote?","a":"Provide exact model (Recliner Chair BME007) and clinical area; IME confirms availability."}],"seo_keywords_es":["Sillón Reclinable BME007","Sillón Reclinable BME007 BM","ficha técnica Sillón Reclinable BME007","equipo médico Colombia","IME"],"seo_keywords_en":["Recliner Chair BME007","Recliner Chair BME007 BM","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"BM","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'sillon-reclinable-bme007-bm-ref-bme007';
