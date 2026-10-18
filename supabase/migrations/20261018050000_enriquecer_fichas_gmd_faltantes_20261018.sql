-- Enriquecimiento de landings desde fichas técnicas oficiales del fabricante (gmd-faltantes-20261018).
-- Contenido redactado solo con datos presentes en la ficha; ver informe docs/informe-fichas-fabricantes-2026-10-02.md.
-- Se aplica con el workflow manual "Deploy Supabase Migrations". Idempotente (UPDATE por slug).

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/kit-de-nebulizacion-pediatrico-nube-3000-ref-gmrn211-ki-90dd454d58.pdf',
  descripcion_larga_es = $d$El Kit de Nebulización Pediátrico NUBE 3000 de GMD forma parte del catálogo IME para instituciones de salud.

Kit de Nebulización Pediátrico NUBE 3000.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The Pediatric Nebulization Kit NUBE 3000 from GMD is listed in the IME catalog for healthcare institutions.

Pediatric Nebulization Kit NUBE 3000.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Kit de Nebulización Pediátrico NUBE 3000"],"beneficios_en":["Kit de Nebulización Pediátrico NUBE 3000"],"valor_es":"Kit de Nebulización Pediátrico NUBE 3000 (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"Pediatric Nebulization Kit NUBE 3000 (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Kit de Nebulización Pediátrico NUBE 3000?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Kit de Nebulización Pediátrico NUBE 3000"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Kit de Nebulización Pediátrico NUBE 3000) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Kit de Nebulización Pediátrico NUBE 3000?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the Pediatric Nebulization Kit NUBE 3000?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"Kit de Nebulización Pediátrico NUBE 3000"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (Pediatric Nebulization Kit NUBE 3000) and clinical area; IME confirms availability."},{"q":"Where can I download the Pediatric Nebulization Kit NUBE 3000 datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Kit de Nebulización Pediátrico NUBE 3000","Kit de Nebulización Pediátrico NUBE 3000 GMD","ficha técnica Kit de Nebulización Pediátrico NUBE 3000","equipo médico Colombia","IME"],"seo_keywords_en":["Pediatric Nebulization Kit NUBE 3000","Pediatric Nebulization Kit NUBE 3000 GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'kit-de-nebulizacion-pediatrico-nube-3000-ref-gmrn211-kitpe';

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/kit-de-nebulizacion-pediatrico-nube-3000-ref-gmrn211-ki-90dd454d58.pdf',
  descripcion_larga_es = $d$El Kit de Nebulización Adulto NUBE 3000 de GMD forma parte del catálogo IME para instituciones de salud.

Kit de Nebulización Adulto NUBE 3000.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The Adult Nebulization Kit NUBE 3000 from GMD is listed in the IME catalog for healthcare institutions.

Adult Nebulization Kit NUBE 3000.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Kit de Nebulización Adulto NUBE 3000"],"beneficios_en":["Kit de Nebulización Adulto NUBE 3000"],"valor_es":"Kit de Nebulización Adulto NUBE 3000 (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"Adult Nebulization Kit NUBE 3000 (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Kit de Nebulización Adulto NUBE 3000?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Kit de Nebulización Adulto NUBE 3000"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Kit de Nebulización Adulto NUBE 3000) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Kit de Nebulización Adulto NUBE 3000?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the Adult Nebulization Kit NUBE 3000?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"Kit de Nebulización Adulto NUBE 3000"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (Adult Nebulization Kit NUBE 3000) and clinical area; IME confirms availability."},{"q":"Where can I download the Adult Nebulization Kit NUBE 3000 datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Kit de Nebulización Adulto NUBE 3000","Kit de Nebulización Adulto NUBE 3000 GMD","ficha técnica Kit de Nebulización Adulto NUBE 3000","equipo médico Colombia","IME"],"seo_keywords_en":["Adult Nebulization Kit NUBE 3000","Adult Nebulization Kit NUBE 3000 GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'kit-de-nebulizacion-adulto-nube-3000-ref-gmrn211-kita';

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/kit-de-nebulizacion-del-nube-5000-ref-gmrn846-kitmn-079f5056a9.pdf',
  descripcion_larga_es = $d$El Kit De Nebulización Del Nube 5000 de GMD forma parte del catálogo IME para instituciones de salud.

Kit De Nebulización Del Nube 5000.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The Nube 5000 Nebulization Kit from GMD is listed in the IME catalog for healthcare institutions.

Nebulization kit for Nube 5000 compressor.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Kit De Nebulización Del Nube 5000"],"beneficios_en":["Kit De Nebulización Del Nube 5000"],"valor_es":"Kit De Nebulización Del Nube 5000 (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"Nube 5000 Nebulization Kit (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Kit De Nebulización Del Nube 5000?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Kit De Nebulización Del Nube 5000"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Kit De Nebulización Del Nube 5000) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Kit De Nebulización Del Nube 5000?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the Nube 5000 Nebulization Kit?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"Kit De Nebulización Del Nube 5000"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (Nube 5000 Nebulization Kit) and clinical area; IME confirms availability."},{"q":"Where can I download the Nube 5000 Nebulization Kit datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Kit De Nebulización Del Nube 5000","Kit De Nebulización Del Nube 5000 GMD","ficha técnica Kit De Nebulización Del Nube 5000","equipo médico Colombia","IME"],"seo_keywords_en":["Nube 5000 Nebulization Kit","Nube 5000 Nebulization Kit GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'kit-de-nebulizacion-del-nube-5000-ref-gmrn846-kitmn';

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/kit-de-nebulizacion-del-nube-5000-ref-gmrn846-kitmn-079f5056a9.pdf',
  descripcion_larga_es = $d$El Kit De Nebulización Smart Del Nube 5000 de GMD forma parte del catálogo IME para instituciones de salud.

Kit De Nebulización Smart Del Nube 5000.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The Smart Nube 5000 Nebulization Kit from GMD is listed in the IME catalog for healthcare institutions.

Smart nebulization kit for Nube 5000 compressor with control features.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Kit De Nebulización Smart Del Nube 5000"],"beneficios_en":["Kit De Nebulización Smart Del Nube 5000"],"valor_es":"Kit De Nebulización Smart Del Nube 5000 (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"Smart Nube 5000 Nebulization Kit (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Kit De Nebulización Smart Del Nube 5000?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Kit De Nebulización Smart Del Nube 5000"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Kit De Nebulización Smart Del Nube 5000) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Kit De Nebulización Smart Del Nube 5000?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the Smart Nube 5000 Nebulization Kit?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"Kit De Nebulización Smart Del Nube 5000"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (Smart Nube 5000 Nebulization Kit) and clinical area; IME confirms availability."},{"q":"Where can I download the Smart Nube 5000 Nebulization Kit datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Kit De Nebulización Smart Del Nube 5000","Kit De Nebulización Smart Del Nube 5000 GMD","ficha técnica Kit De Nebulización Smart Del Nube 5000","equipo médico Colombia","IME"],"seo_keywords_en":["Smart Nube 5000 Nebulization Kit","Smart Nube 5000 Nebulization Kit GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'kit-de-nebulizacion-smart-del-nube-5000-ref-gmrn846-kit';

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/rueda-trasera-con-freno-de-4-para-grua-hidraulica-ref-j-3de23001b7.pdf',
  descripcion_larga_es = $d$El Rueda Trasera Con Freno De 4" Para Grúa Hidráulica Konfort Plus de GMD forma parte del catálogo IME para instituciones de salud.

REPUESTOS PARA GRUAS HIDRAULICAS.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The Rear Wheel with 4" Brake for Konfort Plus Hydraulic Crane from GMD is listed in the IME catalog for healthcare institutions.

Spare parts for hydraulic cranes.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["REPUESTOS PARA GRUAS HIDRAULICAS"],"beneficios_en":["REPUESTOS PARA GRUAS HIDRAULICAS"],"valor_es":"Rueda Trasera Con Freno De 4\" Para Grúa Hidráulica Konfort Plus (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"Rear Wheel with 4\" Brake for Konfort Plus Hydraulic Crane (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Rueda Trasera Con Freno De 4\" Para Grúa Hidráulica Konfort Plus?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"REPUESTOS PARA GRUAS HIDRAULICAS"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Rueda Trasera Con Freno De 4\" Para Grúa Hidráulica Konfort Plus) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Rueda Trasera Con Freno De 4\" Para Grúa Hidráulica Konfort Plus?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the Rear Wheel with 4\" Brake for Konfort Plus Hydraulic Crane?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"REPUESTOS PARA GRUAS HIDRAULICAS"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (Rear Wheel with 4\" Brake for Konfort Plus Hydraulic Crane) and clinical area; IME confirms availability."},{"q":"Where can I download the Rear Wheel with 4\" Brake for Konfort Plus Hydraulic Crane datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Rueda Trasera Con Freno De 4\" Para Grúa Hidráulica Konfort Plus","Rueda Trasera Con Freno De 4\" Para Grúa Hidráulica Konfort Plus GMD","ficha técnica Rueda Trasera Con Freno De 4\" Para Grúa Hidráulica Konfort Plus","equipo médico Colombia","IME"],"seo_keywords_en":["Rear Wheel with 4\" Brake for Konfort Plus Hydraulic Crane","Rear Wheel with 4\" Brake for Konfort Plus Hydraulic Crane GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'rueda-trasera-con-freno-de-4-para-grua-hidraulica-ref-jbs168-00-012-konfort-plus';

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/rueda-trasera-con-freno-de-4-para-grua-hidraulica-ref-j-3de23001b7.pdf',
  descripcion_larga_es = $d$El Rueda Delantera de 4" Para Grúa Hidráulica Konfort Plus de GMD forma parte del catálogo IME para instituciones de salud.

REPUESTOS PARA GRUAS HIDRAULICAS.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The Front Wheel of 4" for Konfort Plus Hydraulic Crane from GMD is listed in the IME catalog for healthcare institutions.

Spare parts for hydraulic cranes.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["REPUESTOS PARA GRUAS HIDRAULICAS"],"beneficios_en":["REPUESTOS PARA GRUAS HIDRAULICAS"],"valor_es":"Rueda Delantera de 4\" Para Grúa Hidráulica Konfort Plus (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"Front Wheel of 4\" for Konfort Plus Hydraulic Crane (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Rueda Delantera de 4\" Para Grúa Hidráulica Konfort Plus?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"REPUESTOS PARA GRUAS HIDRAULICAS"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Rueda Delantera de 4\" Para Grúa Hidráulica Konfort Plus) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Rueda Delantera de 4\" Para Grúa Hidráulica Konfort Plus?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the Front Wheel of 4\" for Konfort Plus Hydraulic Crane?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"REPUESTOS PARA GRUAS HIDRAULICAS"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (Front Wheel of 4\" for Konfort Plus Hydraulic Crane) and clinical area; IME confirms availability."},{"q":"Where can I download the Front Wheel of 4\" for Konfort Plus Hydraulic Crane datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Rueda Delantera de 4\" Para Grúa Hidráulica Konfort Plus","Rueda Delantera de 4\" Para Grúa Hidráulica Konfort Plus GMD","ficha técnica Rueda Delantera de 4\" Para Grúa Hidráulica Konfort Plus","equipo médico Colombia","IME"],"seo_keywords_en":["Front Wheel of 4\" for Konfort Plus Hydraulic Crane","Front Wheel of 4\" for Konfort Plus Hydraulic Crane GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'rueda-delantera-de-4-para-grua-hidraulica-ref-jbs168-00-011-konfort-plus';

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/kit-de-nebulizacion-pediatrico-nube-ref-gmrn457-kitpe-b2bead9321.pdf',
  descripcion_larga_es = $d$El Kit de Nebulización Pediátrico NUBE de GMD forma parte del catálogo IME para instituciones de salud.

Kit de Nebulización Pediátrico NUBE.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The NUBE Pediatric Nebulization Kit from GMD is listed in the IME catalog for healthcare institutions.

NUBE Pediatric Nebulization Kit.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Kit de Nebulización Pediátrico NUBE"],"beneficios_en":["Kit de Nebulización Pediátrico NUBE"],"valor_es":"Kit de Nebulización Pediátrico NUBE (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"NUBE Pediatric Nebulization Kit (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Kit de Nebulización Pediátrico NUBE?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Kit de Nebulización Pediátrico NUBE"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Kit de Nebulización Pediátrico NUBE) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Kit de Nebulización Pediátrico NUBE?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the NUBE Pediatric Nebulization Kit?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"Kit de Nebulización Pediátrico NUBE"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (NUBE Pediatric Nebulization Kit) and clinical area; IME confirms availability."},{"q":"Where can I download the NUBE Pediatric Nebulization Kit datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Kit de Nebulización Pediátrico NUBE","Kit de Nebulización Pediátrico NUBE GMD","ficha técnica Kit de Nebulización Pediátrico NUBE","equipo médico Colombia","IME"],"seo_keywords_en":["NUBE Pediatric Nebulization Kit","NUBE Pediatric Nebulization Kit GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'kit-de-nebulizacion-pediatrico-nube-ref-gmrn457-kitpe';

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/kit-de-nebulizacion-adulto-nube-ref-gmrn457-kit-511b6d6a20.pdf',
  descripcion_larga_es = $d$El Kit de Nebulización Adulto NUBE de GMD forma parte del catálogo IME para instituciones de salud.

Kit de Nebulización Adulto NUBE.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The NUBE Adult Nebulization Kit from GMD is listed in the IME catalog for healthcare institutions.

NUBE Adult Nebulization Kit.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Kit de Nebulización Adulto NUBE"],"beneficios_en":["Kit de Nebulización Adulto NUBE"],"valor_es":"Kit de Nebulización Adulto NUBE (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"NUBE Adult Nebulization Kit (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Kit de Nebulización Adulto NUBE?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Kit de Nebulización Adulto NUBE"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Kit de Nebulización Adulto NUBE) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Kit de Nebulización Adulto NUBE?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the NUBE Adult Nebulization Kit?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"Kit de Nebulización Adulto NUBE"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (NUBE Adult Nebulization Kit) and clinical area; IME confirms availability."},{"q":"Where can I download the NUBE Adult Nebulization Kit datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Kit de Nebulización Adulto NUBE","Kit de Nebulización Adulto NUBE GMD","ficha técnica Kit de Nebulización Adulto NUBE","equipo médico Colombia","IME"],"seo_keywords_en":["NUBE Adult Nebulization Kit","NUBE Adult Nebulization Kit GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'kit-de-nebulizacion-adulto-nube-ref-gmrn457-kit';

UPDATE public.productos SET
  ficha_pdf = '/assets/productos/fichas/gmd/filtro-para-compresor-nebulizador-nube-3000-ref-gmrn457-0b8e674b33.pdf',
  descripcion_larga_es = $d$El Filtro para Compresor Nebulizador NUBE 3000 de GMD forma parte del catálogo IME para instituciones de salud.

Filtro para Compresor Nebulizador NUBE 3000.

La ficha técnica PDF está disponible para descarga en esta landing.$d$,
  descripcion_larga_en = $d$The Filter for NUBE 3000 Nebulizer Compressor from GMD is listed in the IME catalog for healthcare institutions.

Filter for NUBE 3000 Nebulizer Compressor.$d$,
  especificaciones = $j$[]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Filtro para Compresor Nebulizador NUBE 3000"],"beneficios_en":["Filtro para Compresor Nebulizador NUBE 3000"],"valor_es":"Filtro para Compresor Nebulizador NUBE 3000 (GMD) con datos de catálogo IME y ficha PDF.","valor_en":"Filter for NUBE 3000 Nebulizer Compressor (GMD) with IME catalog data and PDF datasheet.","preguntas_frecuentes_es":[{"q":"¿Qué producto es el Filtro para Compresor Nebulizador NUBE 3000?","a":"Es un equipo GMD del catálogo IME."},{"q":"¿Qué características principales declara el catálogo?","a":"Filtro para Compresor Nebulizador NUBE 3000"},{"q":"¿En qué aplicaciones se usa?","a":"Según indicación clínica del fabricante y evaluación hospitalaria."},{"q":"¿Dónde obtengo la ficha técnica?","a":"Descargue el PDF en esta página."},{"q":"¿Cómo solicito cotización a IME?","a":"Indique el modelo exacto (Filtro para Compresor Nebulizador NUBE 3000) y el área clínica; IME confirma disponibilidad y documentación."},{"q":"¿Dónde descargo la ficha técnica de Filtro para Compresor Nebulizador NUBE 3000?","a":"En esta página, con el botón «Descargar ficha técnica»: es el PDF oficial de GMD (en español)."}],"preguntas_frecuentes_en":[{"q":"What is the Filter for NUBE 3000 Nebulizer Compressor?","a":"It is a GMD device in the IME catalog."},{"q":"What key specs are listed?","a":"Filtro para Compresor Nebulizador NUBE 3000"},{"q":"Typical applications?","a":"Per manufacturer indication and hospital evaluation."},{"q":"Where is the datasheet?","a":"Download the PDF on this page."},{"q":"How do I get a quote?","a":"Provide exact model (Filter for NUBE 3000 Nebulizer Compressor) and clinical area; IME confirms availability."},{"q":"Where can I download the Filter for NUBE 3000 Nebulizer Compressor datasheet?","a":"On this page, with the “Download datasheet” button: it is the official GMD PDF (in Spanish)."}],"seo_keywords_es":["Filtro para Compresor Nebulizador NUBE 3000","Filtro para Compresor Nebulizador NUBE 3000 GMD","ficha técnica Filtro para Compresor Nebulizador NUBE 3000","equipo médico Colombia","IME"],"seo_keywords_en":["Filter for NUBE 3000 Nebulizer Compressor","Filter for NUBE 3000 Nebulizer Compressor GMD","medical equipment Colombia","IME datasheet"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":"2026-10-18","sin_pdf":false}}$j$::jsonb
WHERE slug = 'filtro-para-compresor-nebulizador-nube-3000-ref-gmrn457-12f';
