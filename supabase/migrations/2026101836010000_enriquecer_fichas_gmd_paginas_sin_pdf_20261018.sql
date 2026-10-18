-- Enriquecimiento de landings desde fichas técnicas oficiales del fabricante (gmd-paginas-sin-pdf-20261018).
-- Contenido redactado solo con datos presentes en la ficha; ver informe docs/informe-fichas-fabricantes-2026-10-02.md.
-- Se aplica con el workflow manual "Deploy Supabase Migrations". Idempotente (UPDATE por slug).

UPDATE public.productos SET
  descripcion_larga_es = $d$Adaptador AC-DC para Tensiómetro Latidos (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Adaptador AC-DC para Tensiómetro Latidos» (modelo LATIDOS-C).

Línea comercial visible: Latidos.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/adaptador-para-tensiometro$d$,
  descripcion_larga_en = $d$Adaptador AC-DC para Tensiómetro Latidos (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Adaptador AC-DC para Tensiómetro Latidos» (modelo LATIDOS-C).

Línea comercial visible: Latidos.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/adaptador-para-tensiometro$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"LATIDOS-C"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Latidos"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"latidos-c"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Adaptador AC-DC para Tensiómetro Latidos (LATIDOS-C)"],"beneficios_en":["Official gmd.com.co listing: Adaptador AC-DC para Tensiómetro Latidos (LATIDOS-C)"],"valor_es":"Adaptador AC-DC para Tensiómetro Latidos (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Adaptador AC-DC para Tensiómetro Latidos (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Adaptador AC-DC para Tensiómetro Latidos?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/adaptador-para-tensiometro."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: LATIDOS-C; Línea comercial: Latidos"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo LATIDOS-C (ref IME latidos-c) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Adaptador AC-DC para Tensiómetro Latidos?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/adaptador-para-tensiometro."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: LATIDOS-C; Línea comercial: Latidos"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model LATIDOS-C (IME ref latidos-c) and clinical use; IME validates availability."}],"seo_keywords_es":["Adaptador AC-DC para Tensiómetro Latidos","Adaptador AC-DC para Tensiómetro Latidos GMD","LATIDOS-C","equipo médico Colombia","IME Colombia","GMD","Latidos"],"seo_keywords_en":["Adaptador AC-DC para Tensiómetro Latidos","Adaptador AC-DC para Tensiómetro Latidos GMD","LATIDOS-C","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'adaptador-ac-dc-para-tensiometro-latidos-ref-latidos-c';

UPDATE public.productos SET
  descripcion_larga_es = $d$Nebulizador para Compresor NUBE (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Nebulizador para Compresor NUBE» (modelo GMRN-NB).

Línea comercial visible: NUBE.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/nebulizador-para-compresor-nube$d$,
  descripcion_larga_en = $d$Nebulizador para Compresor NUBE (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Nebulizador para Compresor NUBE» (modelo GMRN-NB).

Línea comercial visible: NUBE.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/nebulizador-para-compresor-nube$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"GMRN-NB"},{"clave":"Línea comercial","grupo":"Identificación","valor":"NUBE"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"gmrn-nb"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Nebulizador para Compresor NUBE (GMRN-NB)"],"beneficios_en":["Official gmd.com.co listing: Nebulizador para Compresor NUBE (GMRN-NB)"],"valor_es":"Nebulizador para Compresor NUBE (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Nebulizador para Compresor NUBE (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Nebulizador para Compresor NUBE?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/nebulizador-para-compresor-nube."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: GMRN-NB; Línea comercial: NUBE"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo GMRN-NB (ref IME gmrn-nb) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Nebulizador para Compresor NUBE?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/nebulizador-para-compresor-nube."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: GMRN-NB; Línea comercial: NUBE"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model GMRN-NB (IME ref gmrn-nb) and clinical use; IME validates availability."}],"seo_keywords_es":["Nebulizador para Compresor NUBE","Nebulizador para Compresor NUBE GMD","GMRN-NB","equipo médico Colombia","IME Colombia","GMD","NUBE"],"seo_keywords_en":["Nebulizador para Compresor NUBE","Nebulizador para Compresor NUBE GMD","GMRN-NB","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'nebulizador-para-compresor-nube-ref-gmrn-nb';

UPDATE public.productos SET
  descripcion_larga_es = $d$Kit de Nebulización Del Nube 7000 (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Kit de Nebulización Del Nube 7000» (modelo GMRN818-KITMN).

Línea comercial visible: Nube.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/kit-nebulizador-nube-7000-818kitmn$d$,
  descripcion_larga_en = $d$Kit de Nebulización Del Nube 7000 (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Kit de Nebulización Del Nube 7000» (modelo GMRN818-KITMN).

Línea comercial visible: Nube.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/kit-nebulizador-nube-7000-818kitmn$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"GMRN818-KITMN"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Nube"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro sanitario GMRN818-KITMN"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"gmrn818-kitmn"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Kit de Nebulización Del Nube 7000 (GMRN818-KITMN)"],"beneficios_en":["Official gmd.com.co listing: Kit de Nebulización Del Nube 7000 (GMRN818-KITMN)"],"valor_es":"Kit de Nebulización Del Nube 7000 (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Kit de Nebulización Del Nube 7000 (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Kit de Nebulización Del Nube 7000?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/kit-nebulizador-nube-7000-818kitmn."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: GMRN818-KITMN; Línea comercial: Nube; Enlace listado: Registro sanitario GMRN818-KITMN"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo GMRN818-KITMN (ref IME gmrn818-kitmn) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Kit de Nebulización Del Nube 7000?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/kit-nebulizador-nube-7000-818kitmn."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: GMRN818-KITMN; Línea comercial: Nube; Enlace listado: Registro sanitario GMRN818-KITMN"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model GMRN818-KITMN (IME ref gmrn818-kitmn) and clinical use; IME validates availability."}],"seo_keywords_es":["Kit de Nebulización Del Nube 7000","Kit de Nebulización Del Nube 7000 GMD","GMRN818-KITMN","equipo médico Colombia","IME Colombia","GMD","Nube"],"seo_keywords_en":["Kit de Nebulización Del Nube 7000","Kit de Nebulización Del Nube 7000 GMD","GMRN818-KITMN","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'kit-de-nebulizacion-del-nube-7000-ref-gmrn818-kitmn';

UPDATE public.productos SET
  descripcion_larga_es = $d$Clenny Kit Para Nube 7000 (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Clenny Kit Para Nube 7000» (modelo GMRN818-KIT).

Línea comercial visible: Nube.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/kit-nebulizador-nube-7000-rn818kit$d$,
  descripcion_larga_en = $d$Clenny Kit Para Nube 7000 (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Clenny Kit Para Nube 7000» (modelo GMRN818-KIT).

Línea comercial visible: Nube.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/kit-nebulizador-nube-7000-rn818kit$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"GMRN818-KIT"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Nube"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro sanitario GMRN818-KIT"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"gmrn818-kit"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Clenny Kit Para Nube 7000 (GMRN818-KIT)"],"beneficios_en":["Official gmd.com.co listing: Clenny Kit Para Nube 7000 (GMRN818-KIT)"],"valor_es":"Clenny Kit Para Nube 7000 (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Clenny Kit Para Nube 7000 (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Clenny Kit Para Nube 7000?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/kit-nebulizador-nube-7000-rn818kit."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: GMRN818-KIT; Línea comercial: Nube; Enlace listado: Registro sanitario GMRN818-KIT"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo GMRN818-KIT (ref IME gmrn818-kit) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Clenny Kit Para Nube 7000?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/kit-nebulizador-nube-7000-rn818kit."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: GMRN818-KIT; Línea comercial: Nube; Enlace listado: Registro sanitario GMRN818-KIT"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model GMRN818-KIT (IME ref gmrn818-kit) and clinical use; IME validates availability."}],"seo_keywords_es":["Clenny Kit Para Nube 7000","Clenny Kit Para Nube 7000 GMD","GMRN818-KIT","equipo médico Colombia","IME Colombia","GMD","Nube"],"seo_keywords_en":["Clenny Kit Para Nube 7000","Clenny Kit Para Nube 7000 GMD","GMRN818-KIT","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'clenny-kit-para-nube-7000-ref-gmrn818-kit';

UPDATE public.productos SET
  descripcion_larga_es = $d$Arnés Móvil para Grúa Hidráulica (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Arnés Móvil para Grúa Hidráulica» (modelo JBS168-00-021).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/arnes-para-personas-con-discapacidad$d$,
  descripcion_larga_en = $d$Arnés Móvil para Grúa Hidráulica (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Arnés Móvil para Grúa Hidráulica» (modelo JBS168-00-021).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/arnes-para-personas-con-discapacidad$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"JBS168-00-021"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro sanitario repuestos grúa"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"jbs168-00-021"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Arnés Móvil para Grúa Hidráulica (JBS168-00-021)"],"beneficios_en":["Official gmd.com.co listing: Arnés Móvil para Grúa Hidráulica (JBS168-00-021)"],"valor_es":"Arnés Móvil para Grúa Hidráulica (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Arnés Móvil para Grúa Hidráulica (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Arnés Móvil para Grúa Hidráulica?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/arnes-para-personas-con-discapacidad."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: JBS168-00-021; Enlace listado: Registro sanitario repuestos grúa"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo JBS168-00-021 (ref IME jbs168-00-021) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Arnés Móvil para Grúa Hidráulica?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/arnes-para-personas-con-discapacidad."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: JBS168-00-021; Enlace listado: Registro sanitario repuestos grúa"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model JBS168-00-021 (IME ref jbs168-00-021) and clinical use; IME validates availability."}],"seo_keywords_es":["Arnés Móvil para Grúa Hidráulica","Arnés Móvil para Grúa Hidráulica GMD","JBS168-00-021","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Arnés Móvil para Grúa Hidráulica","Arnés Móvil para Grúa Hidráulica GMD","JBS168-00-021","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'arnes-movil-para-grua-hidraulica-ref-jbs168-00-021';

UPDATE public.productos SET
  descripcion_larga_es = $d$Reposapiés Elevables para SDR Iron Light (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Reposapiés Elevables para SDR Iron Light» (modelo SRELS-RPE).

Línea comercial visible: Iron Light.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/reposapies-elevables-para-silla-de-ruedas-iron-light$d$,
  descripcion_larga_en = $d$Reposapiés Elevables para SDR Iron Light (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Reposapiés Elevables para SDR Iron Light» (modelo SRELS-RPE).

Línea comercial visible: Iron Light.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/reposapies-elevables-para-silla-de-ruedas-iron-light$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"SRELS-RPE"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Iron Light"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"srels-rpe"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Reposapiés Elevables para SDR Iron Light (SRELS-RPE)"],"beneficios_en":["Official gmd.com.co listing: Reposapiés Elevables para SDR Iron Light (SRELS-RPE)"],"valor_es":"Reposapiés Elevables para SDR Iron Light (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Reposapiés Elevables para SDR Iron Light (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Reposapiés Elevables para SDR Iron Light?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/reposapies-elevables-para-silla-de-ruedas-iron-light."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: SRELS-RPE; Línea comercial: Iron Light"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo SRELS-RPE (ref IME srels-rpe) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Reposapiés Elevables para SDR Iron Light?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/reposapies-elevables-para-silla-de-ruedas-iron-light."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: SRELS-RPE; Línea comercial: Iron Light"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model SRELS-RPE (IME ref srels-rpe) and clinical use; IME validates availability."}],"seo_keywords_es":["Reposapiés Elevables para SDR Iron Light","Reposapiés Elevables para SDR Iron Light GMD","SRELS-RPE","equipo médico Colombia","IME Colombia","GMD","Iron Light"],"seo_keywords_en":["Reposapiés Elevables para SDR Iron Light","Reposapiés Elevables para SDR Iron Light GMD","SRELS-RPE","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'reposapies-elevables-para-sdr-iron-light-ref-srels-rpe';

UPDATE public.productos SET
  descripcion_larga_es = $d$Balde Para Comodo Sanitario (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Balde Para Comodo Sanitario» (modelo KB215SR-AL-B).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/balde-para-comodo-sanitario$d$,
  descripcion_larga_en = $d$Balde Para Comodo Sanitario (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Balde Para Comodo Sanitario» (modelo KB215SR-AL-B).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/balde-para-comodo-sanitario$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"KB215SR-AL-B"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro sanitario repuestos AVD"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"kb215sr-al-b"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Balde Para Comodo Sanitario (KB215SR-AL-B)"],"beneficios_en":["Official gmd.com.co listing: Balde Para Comodo Sanitario (KB215SR-AL-B)"],"valor_es":"Balde Para Comodo Sanitario (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Balde Para Comodo Sanitario (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Balde Para Comodo Sanitario?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/balde-para-comodo-sanitario."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: KB215SR-AL-B; Enlace listado: Registro sanitario repuestos AVD"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo KB215SR-AL-B (ref IME kb215sr-al-b) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Balde Para Comodo Sanitario?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/balde-para-comodo-sanitario."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: KB215SR-AL-B; Enlace listado: Registro sanitario repuestos AVD"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model KB215SR-AL-B (IME ref kb215sr-al-b) and clinical use; IME validates availability."}],"seo_keywords_es":["Balde Para Comodo Sanitario","Balde Para Comodo Sanitario GMD","KB215SR-AL-B","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Balde Para Comodo Sanitario","Balde Para Comodo Sanitario GMD","KB215SR-AL-B","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'balde-para-comodo-sanitario-ref-kb215sr-al-b';

UPDATE public.productos SET
  descripcion_larga_es = $d$Reposapiés Removibles para SDR Iron Light (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Reposapiés Removibles para SDR Iron Light» (modelo SRELS-RPR).

Línea comercial visible: Iron Light.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/reposapies-removibles-para-silla-de-ruedas-iron-light$d$,
  descripcion_larga_en = $d$Reposapiés Removibles para SDR Iron Light (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Reposapiés Removibles para SDR Iron Light» (modelo SRELS-RPR).

Línea comercial visible: Iron Light.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/reposapies-removibles-para-silla-de-ruedas-iron-light$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"SRELS-RPR"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Iron Light"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"srels-rpr"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Reposapiés Removibles para SDR Iron Light (SRELS-RPR)"],"beneficios_en":["Official gmd.com.co listing: Reposapiés Removibles para SDR Iron Light (SRELS-RPR)"],"valor_es":"Reposapiés Removibles para SDR Iron Light (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Reposapiés Removibles para SDR Iron Light (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Reposapiés Removibles para SDR Iron Light?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/reposapies-removibles-para-silla-de-ruedas-iron-light."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: SRELS-RPR; Línea comercial: Iron Light"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo SRELS-RPR (ref IME srels-rpr) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Reposapiés Removibles para SDR Iron Light?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/reposapies-removibles-para-silla-de-ruedas-iron-light."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: SRELS-RPR; Línea comercial: Iron Light"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model SRELS-RPR (IME ref srels-rpr) and clinical use; IME validates availability."}],"seo_keywords_es":["Reposapiés Removibles para SDR Iron Light","Reposapiés Removibles para SDR Iron Light GMD","SRELS-RPR","equipo médico Colombia","IME Colombia","GMD","Iron Light"],"seo_keywords_en":["Reposapiés Removibles para SDR Iron Light","Reposapiés Removibles para SDR Iron Light GMD","SRELS-RPR","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'reposapies-removibles-para-sdr-iron-light-ref-srels-rpr';

UPDATE public.productos SET
  descripcion_larga_es = $d$Pad para SDR Iron Light (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Pad para SDR Iron Light» (modelo SRELS-PAD).

Línea comercial visible: Iron Light.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/almohadillas-para-silla-de-ruedas-iron-light$d$,
  descripcion_larga_en = $d$Pad para SDR Iron Light (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Pad para SDR Iron Light» (modelo SRELS-PAD).

Línea comercial visible: Iron Light.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/almohadillas-para-silla-de-ruedas-iron-light$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"SRELS-PAD"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Iron Light"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"srels-pad"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Pad para SDR Iron Light (SRELS-PAD)"],"beneficios_en":["Official gmd.com.co listing: Pad para SDR Iron Light (SRELS-PAD)"],"valor_es":"Pad para SDR Iron Light (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Pad para SDR Iron Light (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Pad para SDR Iron Light?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/almohadillas-para-silla-de-ruedas-iron-light."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: SRELS-PAD; Línea comercial: Iron Light"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo SRELS-PAD (ref IME srels-pad) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Pad para SDR Iron Light?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/almohadillas-para-silla-de-ruedas-iron-light."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: SRELS-PAD; Línea comercial: Iron Light"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model SRELS-PAD (IME ref srels-pad) and clinical use; IME validates availability."}],"seo_keywords_es":["Pad para SDR Iron Light","Pad para SDR Iron Light GMD","SRELS-PAD","equipo médico Colombia","IME Colombia","GMD","Iron Light"],"seo_keywords_en":["Pad para SDR Iron Light","Pad para SDR Iron Light GMD","SRELS-PAD","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'pad-para-sdr-iron-light-ref-srels-pad';

UPDATE public.productos SET
  descripcion_larga_es = $d$Llanta Trasera para SDR Iron Light (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Llanta Trasera para SDR Iron Light» (modelo SRELS-LT).

Línea comercial visible: Iron Light.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/llanta-trasera-silla-de-ruedas-iron-light$d$,
  descripcion_larga_en = $d$Llanta Trasera para SDR Iron Light (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Llanta Trasera para SDR Iron Light» (modelo SRELS-LT).

Línea comercial visible: Iron Light.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/llanta-trasera-silla-de-ruedas-iron-light$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"SRELS-LT"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Iron Light"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"srels-lt"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Llanta Trasera para SDR Iron Light (SRELS-LT)"],"beneficios_en":["Official gmd.com.co listing: Llanta Trasera para SDR Iron Light (SRELS-LT)"],"valor_es":"Llanta Trasera para SDR Iron Light (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Llanta Trasera para SDR Iron Light (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Llanta Trasera para SDR Iron Light?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/llanta-trasera-silla-de-ruedas-iron-light."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: SRELS-LT; Línea comercial: Iron Light"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo SRELS-LT (ref IME srels-lt) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Llanta Trasera para SDR Iron Light?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/llanta-trasera-silla-de-ruedas-iron-light."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: SRELS-LT; Línea comercial: Iron Light"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model SRELS-LT (IME ref srels-lt) and clinical use; IME validates availability."}],"seo_keywords_es":["Llanta Trasera para SDR Iron Light","Llanta Trasera para SDR Iron Light GMD","SRELS-LT","equipo médico Colombia","IME Colombia","GMD","Iron Light"],"seo_keywords_en":["Llanta Trasera para SDR Iron Light","Llanta Trasera para SDR Iron Light GMD","SRELS-LT","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'llanta-trasera-para-sdr-iron-light-ref-srels-lt';

UPDATE public.productos SET
  descripcion_larga_es = $d$Freno para SDR Estándar color Gris (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: Repuesto para Sillas de Ruedas Estándar KBE de Konfort Basic.

Línea comercial visible: Konfort Basic.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/freno-para-silla-de-ruedas-be1462fr$d$,
  descripcion_larga_en = $d$Freno para SDR Estándar color Gris (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: Repuesto para Sillas de Ruedas Estándar KBE de Konfort Basic.

Línea comercial visible: Konfort Basic.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/freno-para-silla-de-ruedas-be1462fr$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"KBE1462-FR"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Konfort Basic"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"kbe1462-fr"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Freno para SDR Estándar color Gris (KBE1462-FR)"],"beneficios_en":["Official gmd.com.co listing: Freno para SDR Estándar color Gris (KBE1462-FR)"],"valor_es":"Freno para SDR Estándar color Gris (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Freno para SDR Estándar color Gris (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Freno para SDR Estándar color Gris?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/freno-para-silla-de-ruedas-be1462fr."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: KBE1462-FR; Línea comercial: Konfort Basic"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo KBE1462-FR (ref IME kbe1462-fr) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Freno para SDR Estándar color Gris?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/freno-para-silla-de-ruedas-be1462fr."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: KBE1462-FR; Línea comercial: Konfort Basic"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model KBE1462-FR (IME ref kbe1462-fr) and clinical use; IME validates availability."}],"seo_keywords_es":["Freno para SDR Estándar color Gris","Freno para SDR Estándar color Gris GMD","KBE1462-FR","equipo médico Colombia","IME Colombia","GMD","Konfort Basic"],"seo_keywords_en":["Freno para SDR Estándar color Gris","Freno para SDR Estándar color Gris GMD","KBE1462-FR","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'freno-para-sdr-estandar-color-gris-ref-kbe1462-fr';

UPDATE public.productos SET
  descripcion_larga_es = $d$Actuador hidráulico para jbs168-1 (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «JBS168-00-1A» (modelo JBS168-00-1A).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/repuestos-de-grua-para-pacientes-discapacitados$d$,
  descripcion_larga_en = $d$Actuador hidráulico para jbs168-1 (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «JBS168-00-1A» (modelo JBS168-00-1A).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/repuestos-de-grua-para-pacientes-discapacitados$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"JBS168-00-1A"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"jbs168-00-1a"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: JBS168-00-1A (JBS168-00-1A)"],"beneficios_en":["Official gmd.com.co listing: JBS168-00-1A (JBS168-00-1A)"],"valor_es":"Actuador hidráulico para jbs168-1 (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Actuador hidráulico para jbs168-1 (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Actuador hidráulico para jbs168-1?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/repuestos-de-grua-para-pacientes-discapacitados."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: JBS168-00-1A"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo JBS168-00-1A (ref IME jbs168-00-1a) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Actuador hidráulico para jbs168-1?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/repuestos-de-grua-para-pacientes-discapacitados."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: JBS168-00-1A"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model JBS168-00-1A (IME ref jbs168-00-1a) and clinical use; IME validates availability."}],"seo_keywords_es":["JBS168-00-1A","JBS168-00-1A GMD","JBS168-00-1A","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["JBS168-00-1A","JBS168-00-1A GMD","JBS168-00-1A","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'actuador-hidraulico-para-jbs168-1-ref-jbs168-00-1a';

UPDATE public.productos SET
  descripcion_larga_es = $d$Filtro Par Compresor Nebulizador Panda (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Filtro Par Compresor Nebulizador Panda» (modelo GMRN457-1F).

Línea comercial visible: Panda.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/filtro-nebulizador-panda$d$,
  descripcion_larga_en = $d$Filtro Par Compresor Nebulizador Panda (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Filtro Par Compresor Nebulizador Panda» (modelo GMRN457-1F).

Línea comercial visible: Panda.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/filtro-nebulizador-panda$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"GMRN457-1F"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Panda"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"gmrn457-1f"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Filtro Par Compresor Nebulizador Panda (GMRN457-1F)"],"beneficios_en":["Official gmd.com.co listing: Filtro Par Compresor Nebulizador Panda (GMRN457-1F)"],"valor_es":"Filtro Par Compresor Nebulizador Panda (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Filtro Par Compresor Nebulizador Panda (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Filtro Par Compresor Nebulizador Panda?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/filtro-nebulizador-panda."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: GMRN457-1F; Línea comercial: Panda"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo GMRN457-1F (ref IME gmrn457-1f) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Filtro Par Compresor Nebulizador Panda?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/filtro-nebulizador-panda."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: GMRN457-1F; Línea comercial: Panda"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model GMRN457-1F (IME ref gmrn457-1f) and clinical use; IME validates availability."}],"seo_keywords_es":["Filtro Par Compresor Nebulizador Panda","Filtro Par Compresor Nebulizador Panda GMD","GMRN457-1F","equipo médico Colombia","IME Colombia","GMD","Panda"],"seo_keywords_en":["Filtro Par Compresor Nebulizador Panda","Filtro Par Compresor Nebulizador Panda GMD","GMRN457-1F","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'filtro-par-compresor-nebulizador-panda-ref-gmrn457-1f';

UPDATE public.productos SET
  descripcion_larga_es = $d$Tapón para Caminador KP1-816L Color Gris (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: Tapones para caminador Konfort Plus color gris, ?están fabricados en plástico resistente, reducen la fricción y facilitan el movimiento.?

Línea comercial visible: Konfort Plus.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/tapon-para-caminador$d$,
  descripcion_larga_en = $d$Tapón para Caminador KP1-816L Color Gris (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: Tapones para caminador Konfort Plus color gris, ?están fabricados en plástico resistente, reducen la fricción y facilitan el movimiento.?

Línea comercial visible: Konfort Plus.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/tapon-para-caminador$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"KP1-816L-TIP"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Konfort Plus"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"kp1-816l-tip"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Tapón para Caminador KP1-816L Color Gris (KP1-816L-TIP)"],"beneficios_en":["Official gmd.com.co listing: Tapón para Caminador KP1-816L Color Gris (KP1-816L-TIP)"],"valor_es":"Tapón para Caminador KP1-816L Color Gris (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Tapón para Caminador KP1-816L Color Gris (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Tapón para Caminador KP1-816L Color Gris?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/tapon-para-caminador."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: KP1-816L-TIP; Línea comercial: Konfort Plus"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo KP1-816L-TIP (ref IME kp1-816l-tip) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Tapón para Caminador KP1-816L Color Gris?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/tapon-para-caminador."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: KP1-816L-TIP; Línea comercial: Konfort Plus"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model KP1-816L-TIP (IME ref kp1-816l-tip) and clinical use; IME validates availability."}],"seo_keywords_es":["Tapón para Caminador KP1-816L Color Gris","Tapón para Caminador KP1-816L Color Gris GMD","KP1-816L-TIP","equipo médico Colombia","IME Colombia","GMD","Konfort Plus"],"seo_keywords_en":["Tapón para Caminador KP1-816L Color Gris","Tapón para Caminador KP1-816L Color Gris GMD","KP1-816L-TIP","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'tapon-para-caminador-kp1-816l-color-gris-ref-kp1-816l-tip';

UPDATE public.productos SET
  descripcion_larga_es = $d$Kit 2 De Oxígeno Con Cilindro De 416 l (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: El Kit de Oxigenoterapia con Cilindro de 416 Litros es una solución portátil y eficiente para la administración de oxígeno en situaciones de emergencia o para terapias a corto plazo. Este kit incluye un cilindro de aluminio de 416 litros, una maleta de transporte especialmente diseñada para facilitar su movilidad, y un regulador ajustable de 0 a 15 lpm que asegura un control preciso del flujo de oxígeno.

Referencia: https://www.gmd.com.co/product/kit-de-oxigeno-416$d$,
  descripcion_larga_en = $d$Kit 2 De Oxígeno Con Cilindro De 416 l (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: El Kit de Oxigenoterapia con Cilindro de 416 Litros es una solución portátil y eficiente para la administración de oxígeno en situaciones de emergencia o para terapias a corto plazo. Este kit incluye un cilindro de aluminio de 416 litros, una maleta de transporte especialmente diseñada para facilitar su movilidad, y un regulador ajustable de 0 a 15 lpm que asegura un control preciso del flujo de oxígeno.

Referencia: https://www.gmd.com.co/product/kit-de-oxigeno-416$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"KIT 2"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"kit-2"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Cilindro de aluminio ligero con una capacidad de 416 litros, diseñado para proporcionar un suministro eficiente de oxígeno en situaciones de emergencia o para terapias a corto plazo.","Diseño práctico de estuche que facilita el transporte y almacenamiento del equipo, permitiendo tener todo lo necesario al alcance de la mano.","Permite ajustar el flujo de oxígeno de 0 a 15 litros por minuto, ofreciendo flexibilidad en el suministro de oxígeno según los requerimientos del paciente.","El producto opera en un rango de presión de hasta 3000 PSI, garantizando una administración segura y controlada del oxígeno."],"beneficios_en":["Cilindro de aluminio ligero con una capacidad de 416 litros, diseñado para proporcionar un suministro eficiente de oxígeno en situaciones de emergencia o para terapias a corto plazo.","Diseño práctico de estuche que facilita el transporte y almacenamiento del equipo, permitiendo tener todo lo necesario al alcance de la mano.","Permite ajustar el flujo de oxígeno de 0 a 15 litros por minuto, ofreciendo flexibilidad en el suministro de oxígeno según los requerimientos del paciente.","El producto opera en un rango de presión de hasta 3000 PSI, garantizando una administración segura y controlada del oxígeno."],"valor_es":"Kit 2 De Oxígeno Con Cilindro De 416 l (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Kit 2 De Oxígeno Con Cilindro De 416 l (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Kit 2 De Oxígeno Con Cilindro De 416 l?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/kit-de-oxigeno-416."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: KIT 2"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo KIT 2 (ref IME kit-2) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Kit 2 De Oxígeno Con Cilindro De 416 l?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/kit-de-oxigeno-416."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: KIT 2"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model KIT 2 (IME ref kit-2) and clinical use; IME validates availability."}],"seo_keywords_es":["Kit 2 De Oxígeno Con Cilindro De 416 l","Kit 2 De Oxígeno Con Cilindro De 416 l GMD","KIT 2","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Kit 2 De Oxígeno Con Cilindro De 416 l","Kit 2 De Oxígeno Con Cilindro De 416 l GMD","KIT 2","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'de-oxigeno-con-cilindro-de-416-l-ref-kit-2';

UPDATE public.productos SET
  descripcion_larga_es = $d$Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: El Bastón con Empuñadura en T Ergonómico Konfort Plus está diseñado para proporcionar un apoyo elegante y cómodo para quienes necesitan asistencia al caminar. Fabricado en aluminio resistente y ligero, cuenta con una empuñadura de PVC ergonómica que garantiza un agarre cómodo y seguro. Con una altura ajustable entre 70 cm y 93 cm, este bastón se adapta a diferentes estaturas, proporcionando estabilidad y soporte en cada paso.

Línea comercial visible: Konfort Plus.

Referencia: https://www.gmd.com.co/product/baston-con-empunadura-color-cromo$d$,
  descripcion_larga_en = $d$Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: El Bastón con Empuñadura en T Ergonómico Konfort Plus está diseñado para proporcionar un apoyo elegante y cómodo para quienes necesitan asistencia al caminar. Fabricado en aluminio resistente y ligero, cuenta con una empuñadura de PVC ergonómica que garantiza un agarre cómodo y seguro. Con una altura ajustable entre 70 cm y 93 cm, este bastón se adapta a diferentes estaturas, proporcionando estabilidad y soporte en cada paso.

Línea comercial visible: Konfort Plus.

Referencia: https://www.gmd.com.co/product/baston-con-empunadura-color-cromo$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"KP4102-22"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Konfort Plus"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"kp4102-22-konfort-plus"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Soporta un peso máximo de 125 kg, garantizando la seguridad y estabilidad del usuario durante su uso.","Se adapta a la altura del usuario para proporcionar un soporte ergonómico y cómodo.","Contiene una empuñadura en forma de T fabricada en PVC de alta calidad que ofrece un agarre cómodo y seguro.","Incluye una correa para la muñeca que brinda mayor control y seguridad, evitando que el bastón se caiga accidentalmente.","Disponible en múltiples colores, ofreciendo opciones personalizables para los usuarios.","Su estructura en aluminio ofrece durabilidad y ligereza."],"beneficios_en":["Soporta un peso máximo de 125 kg, garantizando la seguridad y estabilidad del usuario durante su uso.","Se adapta a la altura del usuario para proporcionar un soporte ergonómico y cómodo.","Contiene una empuñadura en forma de T fabricada en PVC de alta calidad que ofrece un agarre cómodo y seguro.","Incluye una correa para la muñeca que brinda mayor control y seguridad, evitando que el bastón se caiga accidentalmente.","Disponible en múltiples colores, ofreciendo opciones personalizables para los usuarios.","Su estructura en aluminio ofrece durabilidad y ligereza."],"valor_es":"Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/baston-con-empunadura-color-cromo."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: KP4102-22; Línea comercial: Konfort Plus"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo KP4102-22 (ref IME kp4102-22-konfort-plus) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/baston-con-empunadura-color-cromo."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: KP4102-22; Línea comercial: Konfort Plus"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model KP4102-22 (IME ref kp4102-22-konfort-plus) and clinical use; IME validates availability."}],"seo_keywords_es":["Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus","Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus GMD","KP4102-22","equipo médico Colombia","IME Colombia","GMD","Konfort Plus"],"seo_keywords_en":["Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus","Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus GMD","KP4102-22","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'baston-con-empunadura-en-t-ergonomico-color-cromo-ref-kp4102-22-konfort-plus';

UPDATE public.productos SET
  descripcion_larga_es = $d$Empaque para Regulador de Válvulas GMR (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: Empaque para regulador? de válvulas GMR con referencia GMR540-MDK-001?.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/empaque-regulador-de-valvulas$d$,
  descripcion_larga_en = $d$Empaque para Regulador de Válvulas GMR (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: Empaque para regulador? de válvulas GMR con referencia GMR540-MDK-001?.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/empaque-regulador-de-valvulas$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"GMR540-MDK-001"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro sanitario GMR540-MDK-001"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"gmr540-mdk-001"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Empaque para Regulador de Válvulas GMR (GMR540-MDK-001)"],"beneficios_en":["Official gmd.com.co listing: Empaque para Regulador de Válvulas GMR (GMR540-MDK-001)"],"valor_es":"Empaque para Regulador de Válvulas GMR (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Empaque para Regulador de Válvulas GMR (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Empaque para Regulador de Válvulas GMR?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/empaque-regulador-de-valvulas."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: GMR540-MDK-001; Enlace listado: Registro sanitario GMR540-MDK-001"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo GMR540-MDK-001 (ref IME gmr540-mdk-001) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Empaque para Regulador de Válvulas GMR?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/empaque-regulador-de-valvulas."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: GMR540-MDK-001; Enlace listado: Registro sanitario GMR540-MDK-001"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model GMR540-MDK-001 (IME ref gmr540-mdk-001) and clinical use; IME validates availability."}],"seo_keywords_es":["Empaque para Regulador de Válvulas GMR","Empaque para Regulador de Válvulas GMR GMD","GMR540-MDK-001","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Empaque para Regulador de Válvulas GMR","Empaque para Regulador de Válvulas GMR GMD","GMR540-MDK-001","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'empaque-para-regulador-de-valvulas-gmr-ref-gmr540-mdk-001';

UPDATE public.productos SET
  descripcion_larga_es = $d$Tapón Para Cómodo Sanitario (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Tapón Para Cómodo Sanitario» (modelo KB215SR-AL-TIP).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/tapon-de-repuesto-silla-sanitaria$d$,
  descripcion_larga_en = $d$Tapón Para Cómodo Sanitario (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Tapón Para Cómodo Sanitario» (modelo KB215SR-AL-TIP).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/tapon-de-repuesto-silla-sanitaria$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"KB215SR-AL-TIP"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro sanitario repuestos AVD"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"kb215sr-al-tip"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Tapón Para Cómodo Sanitario (KB215SR-AL-TIP)"],"beneficios_en":["Official gmd.com.co listing: Tapón Para Cómodo Sanitario (KB215SR-AL-TIP)"],"valor_es":"Tapón Para Cómodo Sanitario (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Tapón Para Cómodo Sanitario (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Tapón Para Cómodo Sanitario?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/tapon-de-repuesto-silla-sanitaria."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: KB215SR-AL-TIP; Enlace listado: Registro sanitario repuestos AVD"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo KB215SR-AL-TIP (ref IME kb215sr-al-tip) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Tapón Para Cómodo Sanitario?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/tapon-de-repuesto-silla-sanitaria."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: KB215SR-AL-TIP; Enlace listado: Registro sanitario repuestos AVD"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model KB215SR-AL-TIP (IME ref kb215sr-al-tip) and clinical use; IME validates availability."}],"seo_keywords_es":["Tapón Para Cómodo Sanitario","Tapón Para Cómodo Sanitario GMD","KB215SR-AL-TIP","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Tapón Para Cómodo Sanitario","Tapón Para Cómodo Sanitario GMD","KB215SR-AL-TIP","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'tapon-para-comodo-sanitario-ref-kb215sr-al-tip';

UPDATE public.productos SET
  descripcion_larga_es = $d$Pata Para Cómodo Sanitario En Aluminio (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Pata Para Cómodo Sanitario En Aluminio» (modelo KB215SR-AL-LEG).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/pata-para-comodo-sanitario$d$,
  descripcion_larga_en = $d$Pata Para Cómodo Sanitario En Aluminio (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Pata Para Cómodo Sanitario En Aluminio» (modelo KB215SR-AL-LEG).

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/pata-para-comodo-sanitario$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"KB215SR-AL-LEG"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro sanitario KB215SR-AL-LEG"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"kb215sr-al-leg"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Pata Para Cómodo Sanitario En Aluminio (KB215SR-AL-LEG)"],"beneficios_en":["Official gmd.com.co listing: Pata Para Cómodo Sanitario En Aluminio (KB215SR-AL-LEG)"],"valor_es":"Pata Para Cómodo Sanitario En Aluminio (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Pata Para Cómodo Sanitario En Aluminio (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Pata Para Cómodo Sanitario En Aluminio?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/pata-para-comodo-sanitario."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: KB215SR-AL-LEG; Enlace listado: Registro sanitario KB215SR-AL-LEG"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo KB215SR-AL-LEG (ref IME kb215sr-al-leg) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Pata Para Cómodo Sanitario En Aluminio?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/pata-para-comodo-sanitario."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: KB215SR-AL-LEG; Enlace listado: Registro sanitario KB215SR-AL-LEG"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model KB215SR-AL-LEG (IME ref kb215sr-al-leg) and clinical use; IME validates availability."}],"seo_keywords_es":["Pata Para Cómodo Sanitario En Aluminio","Pata Para Cómodo Sanitario En Aluminio GMD","KB215SR-AL-LEG","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Pata Para Cómodo Sanitario En Aluminio","Pata Para Cómodo Sanitario En Aluminio GMD","KB215SR-AL-LEG","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'pata-para-comodo-sanitario-en-aluminio-ref-kb215sr-al-leg';

UPDATE public.productos SET
  descripcion_larga_es = $d$Llanta Con Freno Para Cómodo Sanitario (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: Repuesto para Cómodo Sanitario FS696 Konfort Basic. ?

Línea comercial visible: Konfort Basic.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/ruedas-de-repuesto-con-freno-silla-sanitaria$d$,
  descripcion_larga_en = $d$Llanta Con Freno Para Cómodo Sanitario (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: Repuesto para Cómodo Sanitario FS696 Konfort Basic. ?

Línea comercial visible: Konfort Basic.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/ruedas-de-repuesto-con-freno-silla-sanitaria$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"FS696-RF"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Konfort Basic"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro sanitario FS696-RF"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"fs696-rf"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Llanta Con Freno Para Cómodo Sanitario (FS696-RF)"],"beneficios_en":["Official gmd.com.co listing: Llanta Con Freno Para Cómodo Sanitario (FS696-RF)"],"valor_es":"Llanta Con Freno Para Cómodo Sanitario (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Llanta Con Freno Para Cómodo Sanitario (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Llanta Con Freno Para Cómodo Sanitario?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/ruedas-de-repuesto-con-freno-silla-sanitaria."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: FS696-RF; Línea comercial: Konfort Basic; Enlace listado: Registro sanitario FS696-RF"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo FS696-RF (ref IME fs696-rf) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Llanta Con Freno Para Cómodo Sanitario?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/ruedas-de-repuesto-con-freno-silla-sanitaria."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: FS696-RF; Línea comercial: Konfort Basic; Enlace listado: Registro sanitario FS696-RF"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model FS696-RF (IME ref fs696-rf) and clinical use; IME validates availability."}],"seo_keywords_es":["Llanta Con Freno Para Cómodo Sanitario","Llanta Con Freno Para Cómodo Sanitario GMD","FS696-RF","equipo médico Colombia","IME Colombia","GMD","Konfort Basic"],"seo_keywords_en":["Llanta Con Freno Para Cómodo Sanitario","Llanta Con Freno Para Cómodo Sanitario GMD","FS696-RF","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'llanta-con-freno-para-comodo-sanitario-ref-fs696-rf';

UPDATE public.productos SET
  descripcion_larga_es = $d$Llanta Sin Freno Para Cómodo Sanitario (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: Repuesto para Cómodo Sanitario FS696 Konfort Basic.

Línea comercial visible: Konfort Basic.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/ruedas-de-repuesto-sin-freno-silla-sanitaria$d$,
  descripcion_larga_en = $d$Llanta Sin Freno Para Cómodo Sanitario (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: Repuesto para Cómodo Sanitario FS696 Konfort Basic.

Línea comercial visible: Konfort Basic.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/ruedas-de-repuesto-sin-freno-silla-sanitaria$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"FS696-R"},{"clave":"Línea comercial","grupo":"Identificación","valor":"Konfort Basic"},{"clave":"Enlace listado","grupo":"Documentos (página GMD)","valor":"Registro Sanitario FS696-R"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"fs696-r"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Llanta Sin Freno Para Cómodo Sanitario (FS696-R)"],"beneficios_en":["Official gmd.com.co listing: Llanta Sin Freno Para Cómodo Sanitario (FS696-R)"],"valor_es":"Llanta Sin Freno Para Cómodo Sanitario (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Llanta Sin Freno Para Cómodo Sanitario (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Llanta Sin Freno Para Cómodo Sanitario?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/ruedas-de-repuesto-sin-freno-silla-sanitaria."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: FS696-R; Línea comercial: Konfort Basic; Enlace listado: Registro Sanitario FS696-R"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo FS696-R (ref IME fs696-r) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Llanta Sin Freno Para Cómodo Sanitario?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/ruedas-de-repuesto-sin-freno-silla-sanitaria."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: FS696-R; Línea comercial: Konfort Basic; Enlace listado: Registro Sanitario FS696-R"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model FS696-R (IME ref fs696-r) and clinical use; IME validates availability."}],"seo_keywords_es":["Llanta Sin Freno Para Cómodo Sanitario","Llanta Sin Freno Para Cómodo Sanitario GMD","FS696-R","equipo médico Colombia","IME Colombia","GMD","Konfort Basic"],"seo_keywords_en":["Llanta Sin Freno Para Cómodo Sanitario","Llanta Sin Freno Para Cómodo Sanitario GMD","FS696-R","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'llanta-sin-freno-para-comodo-sanitario-ref-fs696-r';

UPDATE public.productos SET
  descripcion_larga_es = $d$Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: Combo 600 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 600 Cajas de Lancetas X 50 Und, Obsequio de 200 Glucómetros LTD-B10

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/combo-600-cajas-de-tirillas-600-cajas-de-lancetas-200$d$,
  descripcion_larga_en = $d$Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: Combo 600 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 600 Cajas de Lancetas X 50 Und, Obsequio de 200 Glucómetros LTD-B10

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/combo-600-cajas-de-tirillas-600-cajas-de-lancetas-200$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"LTD-B10-600"},{"clave":"Incluye","grupo":"Combo (página GMD)","valor":"LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"ltd-b10-600"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio (LTD-B10-600)"],"beneficios_en":["Official gmd.com.co listing: Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio (LTD-B10-600)"],"valor_es":"Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/combo-600-cajas-de-tirillas-600-cajas-de-lancetas-200."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: LTD-B10-600; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo LTD-B10-600 (ref IME ltd-b10-600) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/combo-600-cajas-de-tirillas-600-cajas-de-lancetas-200."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: LTD-B10-600; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model LTD-B10-600 (IME ref ltd-b10-600) and clinical use; IME validates availability."}],"seo_keywords_es":["Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio","Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio GMD","LTD-B10-600","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio","Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio GMD","LTD-B10-600","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'combo-600-cajas-de-tirillas-plus-600-cajas-de-lancetas-plus-200-glucometros-en-o-ref-ltd-b10-600';

UPDATE public.productos SET
  descripcion_larga_es = $d$Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio» (modelo Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10).

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/LTD-B10-200/01tVT000006uAsTYAU$d$,
  descripcion_larga_en = $d$Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio» (modelo Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10).

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/LTD-B10-200/01tVT000006uAsTYAU$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10"},{"clave":"Incluye","grupo":"Combo (página GMD)","valor":"LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"200"},{"clave":"Línea","grupo":"GMD","valor":"Control y prevención"},{"clave":"Categoría","grupo":"GMD","valor":"Cuidado en casa"},{"clave":"Sublinea","grupo":"GMD","valor":"Monitoreo"},{"clave":"Familia","grupo":"GMD","valor":"Glucómetros"},{"clave":"Marca","grupo":"GMD","valor":"Latidos"},{"clave":"Código","grupo":"GMD","valor":"Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio"},{"clave":"Clase","grupo":"GMD","valor":"Set"},{"clave":"IVA","grupo":"GMD","valor":"IGV19"},{"clave":"B32","grupo":"GMD","valor":"0.0"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10)"],"beneficios_en":["Official gmd.com.co listing: Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10)"],"valor_es":"Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/LTD-B10-200/01tVT000006uAsTYAU."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10 (ref IME 200) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/LTD-B10-200/01tVT000006uAsTYAU."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10 (IME ref 200) and clinical use; IME validates availability."}],"seo_keywords_es":["Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio","Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio GMD","Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio","Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio GMD","Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200';

UPDATE public.productos SET
  descripcion_larga_es = $d$Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio» (modelo Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10).

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/LTD-B10-200/01tVT000006uAsTYAU$d$,
  descripcion_larga_en = $d$Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio» (modelo Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10).

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/LTD-B10-200/01tVT000006uAsTYAU$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10"},{"clave":"Incluye","grupo":"Combo (página GMD)","valor":"LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"200"},{"clave":"Línea","grupo":"GMD","valor":"Control y prevención"},{"clave":"Categoría","grupo":"GMD","valor":"Cuidado en casa"},{"clave":"Sublinea","grupo":"GMD","valor":"Monitoreo"},{"clave":"Familia","grupo":"GMD","valor":"Glucómetros"},{"clave":"Marca","grupo":"GMD","valor":"Latidos"},{"clave":"Código","grupo":"GMD","valor":"Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio"},{"clave":"Clase","grupo":"GMD","valor":"Set"},{"clave":"IVA","grupo":"GMD","valor":"IGV19"},{"clave":"B32","grupo":"GMD","valor":"0.0"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10)"],"beneficios_en":["Official gmd.com.co listing: Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10)"],"valor_es":"Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/LTD-B10-200/01tVT000006uAsTYAU."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10 (ref IME 200) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/LTD-B10-200/01tVT000006uAsTYAU."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10 (IME ref 200) and clinical use; IME validates availability."}],"seo_keywords_es":["Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio","Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio GMD","Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio","Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio GMD","Combo 200 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 200 Cajas de Lancetas X 50 Und, Obsequio de 67 Glucómetros LTD-B10","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200';

UPDATE public.productos SET
  descripcion_larga_es = $d$Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio» (modelo Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10).

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/LTD-B10-100/01tVT000006u9rZYAQ$d$,
  descripcion_larga_en = $d$Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio» (modelo Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10).

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/LTD-B10-100/01tVT000006u9rZYAQ$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10"},{"clave":"Incluye","grupo":"Combo (página GMD)","valor":"LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"100"},{"clave":"Línea","grupo":"GMD","valor":"Control y prevención"},{"clave":"Categoría","grupo":"GMD","valor":"Cuidado en casa"},{"clave":"Sublinea","grupo":"GMD","valor":"Monitoreo"},{"clave":"Familia","grupo":"GMD","valor":"Glucómetros"},{"clave":"Marca","grupo":"GMD","valor":"Latidos"},{"clave":"Código","grupo":"GMD","valor":"Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio"},{"clave":"Clase","grupo":"GMD","valor":"Set"},{"clave":"IVA","grupo":"GMD","valor":"IGV19"},{"clave":"B32","grupo":"GMD","valor":"0.0"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10)"],"beneficios_en":["Official gmd.com.co listing: Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10)"],"valor_es":"Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/LTD-B10-100/01tVT000006u9rZYAQ."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10 (ref IME 100) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/LTD-B10-100/01tVT000006u9rZYAQ."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10 (IME ref 100) and clinical use; IME validates availability."}],"seo_keywords_es":["Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio","Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio GMD","Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio","Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio GMD","Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100';

UPDATE public.productos SET
  descripcion_larga_es = $d$Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co, producto listado como «Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio» (modelo Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10).

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/LTD-B10-100/01tVT000006u9rZYAQ$d$,
  descripcion_larga_en = $d$Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co, producto listado como «Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio» (modelo Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10).

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/LTD-B10-100/01tVT000006u9rZYAQ$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10"},{"clave":"Incluye","grupo":"Combo (página GMD)","valor":"LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"100"},{"clave":"Línea","grupo":"GMD","valor":"Control y prevención"},{"clave":"Categoría","grupo":"GMD","valor":"Cuidado en casa"},{"clave":"Sublinea","grupo":"GMD","valor":"Monitoreo"},{"clave":"Familia","grupo":"GMD","valor":"Glucómetros"},{"clave":"Marca","grupo":"GMD","valor":"Latidos"},{"clave":"Código","grupo":"GMD","valor":"Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio"},{"clave":"Clase","grupo":"GMD","valor":"Set"},{"clave":"IVA","grupo":"GMD","valor":"IGV19"},{"clave":"B32","grupo":"GMD","valor":"0.0"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10)"],"beneficios_en":["Official gmd.com.co listing: Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10)"],"valor_es":"Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/LTD-B10-100/01tVT000006u9rZYAQ."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10 (ref IME 100) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/LTD-B10-100/01tVT000006u9rZYAQ."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10 (IME ref 100) and clinical use; IME validates availability."}],"seo_keywords_es":["Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio","Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio GMD","Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio","Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio GMD","Combo 100 cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 100 Lancetas x 50 Und, Obsequio de 25 Glucómetros LTD-B10","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100';

UPDATE public.productos SET
  descripcion_larga_es = $d$Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio (GMD) en catálogo IME Colombia para instituciones de salud.

Según gmd.com.co: Combo 50 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 50 Cajas de Lancetas X 50 Und, Obsequio de 10 Glucómetros LTD-B10

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/combo-glucometro-con-50-lancetas$d$,
  descripcion_larga_en = $d$Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio (GMD) in the catalog IME Colombia para instituciones de salud.

Per gmd.com.co: Combo 50 Cajas de Tirillas Reactivas para el LTD-B10 x 50 Und + 50 Cajas de Lancetas X 50 Und, Obsequio de 10 Glucómetros LTD-B10

Componentes publicados en la página del combo: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades.

La ficha web no lista beneficios adicionales en el momento del scrape.

Referencia: https://www.gmd.com.co/product/combo-glucometro-con-50-lancetas$d$,
  especificaciones = $j$[{"clave":"Modelo en gmd.com.co","grupo":"Página fabricante (GMD)","valor":"LTD-B10-50"},{"clave":"Incluye","grupo":"Combo (página GMD)","valor":"LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"clave":"Fabricante","grupo":"Identificación","valor":"GMD"},{"clave":"Modelo / SKU","grupo":"Identificación","valor":"ltd-b10-50"}]$j$::jsonb,
  aplicaciones_es = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  aplicaciones_en = ARRAY(SELECT jsonb_array_elements_text($j$[]$j$::jsonb)),
  atributos = COALESCE(atributos, '{}'::jsonb) || $j${"beneficios_es":["Identificación oficial en gmd.com.co: Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio (LTD-B10-50)"],"beneficios_en":["Official gmd.com.co listing: Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio (LTD-B10-50)"],"valor_es":"Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio (GMD) — contenido SEO desde gmd.com.co, sin PDF en mock IME.","valor_en":"Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio (GMD) — SEO content from gmd.com.co, no PDF in IME mock.","preguntas_frecuentes_es":[{"q":"¿Qué producto es Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio?","a":"Equipo GMD en catálogo IME Colombia. Página del fabricante/distribuidor: https://www.gmd.com.co/product/combo-glucometro-con-50-lancetas."},{"q":"¿Qué datos publica GMD en su página?","a":"Modelo en gmd.com.co: LTD-B10-50; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"¿Hay ficha PDF en IME?","a":"Este landing se enriquece con la página gmd.com.co; IME puede confirmar PDF al cotizar."},{"q":"¿Cómo cotizar con IME Colombia?","a":"Indique el modelo LTD-B10-50 (ref IME ltd-b10-50) y el uso clínico; IME valida disponibilidad."}],"preguntas_frecuentes_en":[{"q":"What is Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio?","a":"GMD device in the IME Colombia catalog. Manufacturer/distributor page: https://www.gmd.com.co/product/combo-glucometro-con-50-lancetas."},{"q":"What does GMD publish on its product page?","a":"Modelo en gmd.com.co: LTD-B10-50; Incluye: LTD-B10-TR — Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades; LTD-B10 — Glucómetro Latidos con 50 lancetas, lancetero y estuche; LTD-B10-L — Lancetas para el glucómetro LTD-B10 x 50 unidades"},{"q":"Is there a PDF datasheet on IME?","a":"This landing uses gmd.com.co; IME can confirm PDF when quoting."},{"q":"How to quote with IME Colombia?","a":"Provide model LTD-B10-50 (IME ref ltd-b10-50) and clinical use; IME validates availability."}],"seo_keywords_es":["Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio","Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio GMD","LTD-B10-50","equipo médico Colombia","IME Colombia","GMD"],"seo_keywords_en":["Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio","Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio GMD","LTD-B10-50","medical equipment Colombia","IME Colombia","GMD"],"ficha_fabricante":{"fabricante":"GMD","idioma":"es","url_origen":"","descargada":null,"sin_pdf":true}}$j$::jsonb
WHERE slug = 'combo-50-cajas-de-tirillas-plus-50-cajas-de-lancetas-plus-10-glucometros-en-obseq-ref-ltd-b10-50';
