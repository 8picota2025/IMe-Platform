-- Copy SEO de imagenología, esterilización, ultrasonido y Medellín.
-- Idempotente: no sube versión si el texto ya es el publicado.
-- modalityLinks no va en el JSON: es un campo bloqueado y sale del código.

UPDATE public.landings AS landing
SET contenido_es = landing.contenido_es || jsonb_build_object(
      'name', 'Equipos de ultrasonido y ecógrafos en Colombia',
      'title', 'Ecógrafos Colombia: equipos de ultrasonido hospitalario | I-ME',
      'description', 'Equipos de ultrasonido y ecógrafos en Colombia para hospitales y clínicas. Compare las referencias del catálogo I-ME y solicite cotización por modelo.',
      'intro', 'Equipos de ultrasonido y ecógrafos en Colombia se cotizan por referencia: el catálogo reúne los sistemas DUS y los ecógrafos portátiles publicados. El precio, la sonda y la documentación se confirman en cada ficha, no en un texto genérico.',
      'body', jsonb_build_array(
        'En el catálogo activo están DUS-3000, DUS-5000, DUS-5000 Plus, DUS-6000 y DUS-7000, el ecógrafo Color Doppler diagnóstico vascular, el ecógrafo portátil con WiFi y DICOM y el ultrasonido point-of-care pocket.',
        'Separar ecógrafo de consulta y equipo point-of-care evita mezclar fichas. Lo que cada modelo hace está en su página.'
      )
    ),
    contenido_en = landing.contenido_en || jsonb_build_object(
      'name', 'Ultrasound equipment and scanners in Colombia',
      'title', 'Hospital ultrasound equipment and scanners in Colombia | I-ME',
      'description', 'Ultrasound equipment and scanners for hospitals and clinics in Colombia. Compare I-ME catalog references and request a quote by model.',
      'intro', 'Ultrasound equipment in Colombia is quoted by reference: the catalog lists the published DUS systems and portable scanners. Price, probe and documentation are confirmed on each sheet, not in a generic paragraph.',
      'body', jsonb_build_array(
        'The active catalog includes DUS-3000, DUS-5000, DUS-5000 Plus, DUS-6000 and DUS-7000, the color Doppler vascular scanner, the portable WiFi DICOM scanner and the pocket point-of-care ultrasound.',
        'Separating a clinic scanner from a point-of-care unit avoids mixing sheets. What each model does stays on its page.'
      )
    ),
    version = landing.version + 1,
    publicado_at = NOW()
WHERE landing.tipo = 'familia'
  AND landing.clave = 'ultrasonido'
  AND (
    landing.contenido_es->>'title' IS DISTINCT FROM 'Ecógrafos Colombia: equipos de ultrasonido hospitalario | I-ME'
    OR landing.contenido_es->>'name' IS DISTINCT FROM 'Equipos de ultrasonido y ecógrafos en Colombia'
    OR landing.contenido_es->>'description' IS DISTINCT FROM 'Equipos de ultrasonido y ecógrafos en Colombia para hospitales y clínicas. Compare las referencias del catálogo I-ME y solicite cotización por modelo.'
    OR landing.contenido_en->>'title' IS DISTINCT FROM 'Hospital ultrasound equipment and scanners in Colombia | I-ME'
    OR landing.contenido_en->>'name' IS DISTINCT FROM 'Ultrasound equipment and scanners in Colombia'
  );

UPDATE public.landings AS landing
SET contenido_es = landing.contenido_es || jsonb_build_object(
      'title', 'Equipos de imagenología: rayos X digital, arco en C, mamografía y ecografía en Colombia',
      'description', 'Equipos de imagenología en Colombia: rayos X digital, arco en C, mamografía y ecografía. I-ME cotiza cada referencia; el precio va en la propuesta.',
      'h1', 'Equipos de imagenología: rayos X digital, arco en C, mamografía y ecografía en Colombia',
      'lead', 'Elija la modalidad — rayos X digital, arco en C, mamografía o ecografía — y abra solo referencias del catálogo. El precio no se publica en esta página.'
    ),
    contenido_en = landing.contenido_en || jsonb_build_object(
      'title', 'Imaging equipment: digital X-ray, C-arm, mammography and ultrasound in Colombia',
      'description', 'Imaging equipment in Colombia: digital X-ray, C-arm, mammography and ultrasound. I-ME quotes each reference; the price is in the proposal.',
      'h1', 'Imaging equipment: digital X-ray, C-arm, mammography and ultrasound in Colombia',
      'lead', 'Choose the modality — digital X-ray, C-arm, mammography or ultrasound — and open only catalog references. The price is not published on this page.'
    ),
    version = landing.version + 1,
    publicado_at = NOW()
WHERE landing.tipo = 'campana'
  AND landing.clave = 'imagenologia'
  AND (
    landing.contenido_es->>'title' IS DISTINCT FROM 'Equipos de imagenología: rayos X digital, arco en C, mamografía y ecografía en Colombia'
    OR landing.contenido_es->>'h1' IS DISTINCT FROM 'Equipos de imagenología: rayos X digital, arco en C, mamografía y ecografía en Colombia'
    OR landing.contenido_es->>'description' IS DISTINCT FROM 'Equipos de imagenología en Colombia: rayos X digital, arco en C, mamografía y ecografía. I-ME cotiza cada referencia; el precio va en la propuesta.'
    OR landing.contenido_en->>'title' IS DISTINCT FROM 'Imaging equipment: digital X-ray, C-arm, mammography and ultrasound in Colombia'
    OR landing.contenido_en->>'h1' IS DISTINCT FROM 'Imaging equipment: digital X-ray, C-arm, mammography and ultrasound in Colombia'
    OR landing.contenido_en->>'description' IS DISTINCT FROM 'Imaging equipment in Colombia: digital X-ray, C-arm, mammography and ultrasound. I-ME quotes each reference; the price is in the proposal.'
  );

UPDATE public.landings AS landing
SET contenido_es = landing.contenido_es || jsonb_build_object(
      'h1', 'Equipos de esterilización y autoclaves hospitalarios en Colombia',
      'lead', 'Si la carga se atasca, el equipo espera canastas o están abriendo o ampliando la central, le ayudamos a dimensionar vapor y flujo con las referencias publicadas. La instalación y el soporte se escriben en la propuesta.'
    ),
    contenido_en = landing.contenido_en || jsonb_build_object(
      'h1', 'Hospital sterilization equipment and autoclaves in Colombia',
      'lead', 'If loads backlog, staff wait on baskets, or you are opening or expanding a central, we help size steam and workflow with the published references. Installation and support are written in the proposal.'
    ),
    version = landing.version + 1,
    publicado_at = NOW()
WHERE landing.tipo = 'campana'
  AND landing.clave = 'esterilizacion'
  AND (
    landing.contenido_es->>'h1' IS DISTINCT FROM 'Equipos de esterilización y autoclaves hospitalarios en Colombia'
    OR landing.contenido_en->>'h1' IS DISTINCT FROM 'Hospital sterilization equipment and autoclaves in Colombia'
  );

UPDATE public.landings AS landing
SET contenido_es = jsonb_set(
      landing.contenido_es,
      '{body,0}',
      to_jsonb('Para Medellín priorizamos tiempos de respuesta en soporte y claridad de tipología (monitores, anestesia, neonatología, esterilización y equipos de ultrasonido).'::text)
    ),
    contenido_en = jsonb_set(
      landing.contenido_en,
      '{body,0}',
      to_jsonb('For Medellín we prioritize support response and clear typology (monitors, anesthesia, neonatology, sterilization and ultrasound equipment).'::text)
    ),
    version = landing.version + 1,
    publicado_at = NOW()
WHERE landing.tipo = 'ciudad'
  AND landing.clave = 'medellin'
  AND (
    landing.contenido_es#>>'{body,0}' IS DISTINCT FROM 'Para Medellín priorizamos tiempos de respuesta en soporte y claridad de tipología (monitores, anestesia, neonatología, esterilización y equipos de ultrasonido).'
    OR landing.contenido_en#>>'{body,0}' IS DISTINCT FROM 'For Medellín we prioritize support response and clear typology (monitors, anesthesia, neonatology, sterilization and ultrasound equipment).'
  );

INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE (tipo = 'familia' AND clave = 'ultrasonido')
   OR (tipo = 'campana' AND clave IN ('imagenologia', 'esterilizacion'))
   OR (tipo = 'ciudad' AND clave = 'medellin')
ON CONFLICT (landing_id, version) DO NOTHING;
