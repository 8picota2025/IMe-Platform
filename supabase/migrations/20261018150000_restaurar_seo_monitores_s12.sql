-- Restaura el texto de /en/families/monitores/ que rankeaba antes del
-- 2026-10-11 (title con Biolight y multiparamétricos de UCI) y mantiene
-- S12 y M12, que sí están en el catálogo activo. P15 no se vuelve a afirmar.
-- También quita la keyword «quote» del S12: el title del PDP salía «| quote |».

UPDATE public.landings AS landing
SET contenido_es = $ime_seo${"name":"Monitores de signos vitales","title":"Monitores Biolight S12/M12 y multiparamétricos UCI | I-ME","description":"Monitores de paciente Biolight S12, M12 y multiparamétricos UCI para hospitales. Orientación I-ME: parámetros, modularidad y soporte en Colombia.","intro":"Elegir un monitor no es solo “pantalla grande”. En UCI, urgencias o transporte el criterio cambia: parámetros base, modularidad, alarma usable y cómo se integra a la estación central.","body":["En Colombia, las instituciones suelen pedir monitores multiparamétricos con ECG, SpO₂ y NIBP como mínimo, y opciones de capnografía o presión invasiva según el servicio. I-ME ayuda a mapear el uso previsto antes de cotizar referencias.","También importa el flujo operativo: ¿quién responde alarmas?, ¿hay central multicama?, ¿se necesita transporte inter-área sin perder trazo? Esas preguntas evitan comprar potencia que no se usa o quedar cortos en criticidad.","Los monitores de paciente Biolight S12 y M12 están a la venta, con precio bajo cotización. También está el Advanced PM-2000A PRO. La documentación y el soporte se confirman por referencia."],"faq":[{"q":"¿Qué diferencia un monitor básico de uno de UCI?","a":"La criticidad del servicio: parámetros expandibles, alarmas, autonomía y capacidad de central. Lo básico cubre observación; UCI suele exigir más modularidad y continuidad."},{"q":"¿I-ME instala y capacita?","a":"Sí, el alcance de instalación y capacitación se acuerda en la cotización según sede y cantidad de puntos."},{"q":"¿Tienen el monitor Biolight S12 y el M12?","a":"Sí. El S12 y el M12 están en el catálogo activo, con precio bajo cotización. Otros monitores Biolight retirados no se publican."}]}$ime_seo$::jsonb,
    contenido_en = $ime_seo${"name":"Patient monitors","title":"Biolight S12/M12 & ICU multiparameter monitors | I-ME","description":"Biolight S12, M12 and ICU multiparameter patient monitors for hospitals. I-ME guidance on parameters, modularity and support in Colombia.","intro":"Choosing a monitor is not just “a bigger screen”. ICU, ER or transport change the brief: core parameters, modularity, usable alarms and how it joins a central station.","body":["Colombian hospitals often need multiparameter monitors with ECG, SpO₂ and NIBP as a baseline, plus capnography or invasive pressure by service. I-ME maps intended use before quoting SKUs.","Operations matter too: who owns alarms, whether a multi-bed central exists, and whether transport must keep the trace. That prevents overbuying or under-specifying critical care.","Biolight S12 and M12 patient monitors are for sale, with price on request. The Advanced PM-2000A PRO is also published. Documentation and support are confirmed per reference."],"faq":[{"q":"What separates a basic monitor from an ICU monitor?","a":"Service criticality: expandable parameters, alarms, autonomy and central-station readiness. Basic units fit observation; ICU usually needs modularity and continuity."},{"q":"Does I-ME install and train?","a":"Yes — installation and training scope are agreed in the quote by site and number of points."},{"q":"Do you carry the Biolight S12 and M12 monitors?","a":"Yes. The S12 and the M12 are in the active catalog, with price on request. Other withdrawn Biolight monitors are not published."}]}$ime_seo$::jsonb,
    version = landing.version + 1,
    publicado_at = NOW()
WHERE landing.tipo = 'familia'
  AND landing.clave = 'monitores'
  AND landing.contenido_en->>'title' IS DISTINCT FROM 'Biolight S12/M12 & ICU multiparameter monitors | I-ME';

INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE tipo = 'familia'
  AND clave = 'monitores'
ON CONFLICT (landing_id, version) DO NOTHING;

UPDATE public.productos
SET atributos = jsonb_set(
  jsonb_set(
    COALESCE(atributos, '{}'::jsonb),
    '{seo_keywords_es}',
    '["monitor de paciente biolight s12","monitor multiparamétrico S12","monitor de paciente hospital Colombia"]'::jsonb,
    true
  ),
  '{seo_keywords_en}',
  '["biolight s12 patient monitor","S12 multiparameter monitor","hospital patient monitor Colombia"]'::jsonb,
  true
)
WHERE slug = 'monitor-de-paciente-ref-s12-biolight'
  AND (
    COALESCE(atributos->'seo_keywords_en', '[]'::jsonb) ? 'quote'
    OR COALESCE(atributos->'seo_keywords_es', '[]'::jsonb) ? 'cotización'
  );
