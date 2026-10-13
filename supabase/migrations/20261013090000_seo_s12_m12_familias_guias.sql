-- SEO familias, S12/M12, tienda y guías.
-- Idempotente: solo escribe cuando el valor nuevo es distinto.

UPDATE public.productos
SET
  activo = true,
  nombre_es = 'Monitor de paciente Biolight S12',
  nombre_en = 'Biolight S12 patient monitor',
  descripcion_corta_es = 'Monitor de paciente Biolight S12 con pantalla multitáctil HD de 12.1 pulgadas. Mide ECG, SpO₂, NIBP, temperatura y frecuencia respiratoria en adultos, pediátricos y neonatales. Precio bajo cotización.',
  descripcion_corta_en = 'Biolight S12 patient monitor with a 12.1-inch HD multitouch display. Measures ECG, SpO₂, NIBP, temperature and respiratory rate for adult, pediatric and neonatal patients. Price on request.',
  especificaciones = CASE
    WHEN jsonb_array_length(COALESCE(especificaciones, '[]'::jsonb)) = 0
      THEN '[{"clave":"Modelo","grupo":"Identificación","valor":"S12"},{"clave":"Pantalla","grupo":"Pantalla y diseño","valor":"Multitáctil HD de 12.1 pulgadas"},{"clave":"Población","grupo":"Uso","valor":"Adultos, pediátricos y neonatales"},{"clave":"Parámetros estándar","grupo":"Parámetros monitoreados","valor":"ECG, SpO₂, presión arterial no invasiva (NIBP), temperatura y frecuencia respiratoria"},{"clave":"Parámetros opcionales","grupo":"Parámetros monitoreados","valor":"CO₂, IBP y gasto cardíaco (C.O.)"}]'::jsonb
    ELSE especificaciones
  END,
  atributos = jsonb_set(COALESCE(atributos, '{}'::jsonb), '{marca}', '"Biolight"'::jsonb, true)
WHERE slug = 'monitor-de-paciente-ref-s12-biolight'
  AND (
    activo IS DISTINCT FROM true
    OR nombre_es IS DISTINCT FROM 'Monitor de paciente Biolight S12'
    OR nombre_en IS DISTINCT FROM 'Biolight S12 patient monitor'
    OR descripcion_corta_es IS DISTINCT FROM 'Monitor de paciente Biolight S12 con pantalla multitáctil HD de 12.1 pulgadas. Mide ECG, SpO₂, NIBP, temperatura y frecuencia respiratoria en adultos, pediátricos y neonatales. Precio bajo cotización.'
    OR (atributos->>'marca') IS DISTINCT FROM 'Biolight'
    OR jsonb_array_length(COALESCE(especificaciones, '[]'::jsonb)) = 0
  );

UPDATE public.productos
SET
  activo = true,
  nombre_es = 'Monitor de paciente Biolight M12',
  nombre_en = 'Biolight M12 patient monitor',
  descripcion_corta_es = 'Monitor de paciente Biolight M12 con pantalla táctil de 12.1 pulgadas (1280×800). ECG, SpO₂, NIBP y temperatura para adultos, pediátricos y neonatales. Precio bajo cotización.',
  descripcion_corta_en = 'Biolight M12 patient monitor with a 12.1-inch touchscreen (1280×800). ECG, SpO₂, NIBP and temperature for adult, pediatric and neonatal patients. Price on request.',
  especificaciones = CASE
    WHEN NOT COALESCE(especificaciones, '[]'::jsonb) @> '[{"clave":"Modelo"}]'::jsonb
      THEN jsonb_build_array(jsonb_build_object('clave','Modelo','grupo','Identificación','valor','M12')) || COALESCE(especificaciones, '[]'::jsonb)
    ELSE especificaciones
  END,
  atributos = jsonb_set(COALESCE(atributos, '{}'::jsonb), '{marca}', '"Biolight"'::jsonb, true)
WHERE slug = 'monitor-de-paciente-ref-m12-biolight'
  AND (
    activo IS DISTINCT FROM true
    OR nombre_es IS DISTINCT FROM 'Monitor de paciente Biolight M12'
    OR nombre_en IS DISTINCT FROM 'Biolight M12 patient monitor'
    OR descripcion_corta_es IS DISTINCT FROM 'Monitor de paciente Biolight M12 con pantalla táctil de 12.1 pulgadas (1280×800). ECG, SpO₂, NIBP y temperatura para adultos, pediátricos y neonatales. Precio bajo cotización.'
    OR (atributos->>'marca') IS DISTINCT FROM 'Biolight'
    OR NOT COALESCE(especificaciones, '[]'::jsonb) @> '[{"clave":"Modelo"}]'::jsonb
  );

UPDATE public.familias
SET nombre_es = 'Bombas de infusión', nombre_en = 'Infusion pumps'
WHERE slug = 'soluciones-iv'
  AND (
    nombre_es IS DISTINCT FROM 'Bombas de infusión'
    OR nombre_en IS DISTINCT FROM 'Infusion pumps'
  );

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'name', 'Monitores de paciente para hospitales',
    'title', 'Monitores de paciente para UCI y hospitales | I-ME',
    'body', jsonb_build_array(
      'En hospitales de Colombia el punto de partida suele ser ECG, oximetría de pulso y presión no invasiva, y se suman capnografía o presión invasiva solo si ese servicio las usa. I-ME revisa alarmas, central y transporte antes de cotizar una referencia.',
      'Los monitores de paciente Biolight S12 y M12 están a la venta, con precio bajo cotización. También está el Advanced PM-2000A PRO. La documentación y el soporte se confirman por referencia.'
    ),
    'faq', jsonb_build_array(
      jsonb_build_object('q','¿Qué diferencia un monitor básico de uno de UCI?','a','La criticidad del servicio: parámetros expandibles, alarmas, autonomía y capacidad de central. Lo básico cubre observación; UCI suele exigir más modularidad y continuidad.'),
      jsonb_build_object('q','¿I-ME instala y capacita?','a','Sí, el alcance de instalación y capacitación se acuerda en la cotización según sede y cantidad de puntos.'),
      jsonb_build_object('q','¿Tienen el monitor Biolight S12 y el M12?','a','Sí. El S12 y el M12 están en el catálogo activo, con precio bajo cotización. Otros monitores Biolight retirados no se publican.')
    )
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'name', 'Patient monitors for hospitals',
    'title', 'Patient monitors for hospitals and ICU in Colombia | I-ME',
    'body', jsonb_build_array(
      'Colombian hospitals usually start with ECG, pulse oximetry and non-invasive blood pressure, and add capnography or invasive pressure only when that service uses them. I-ME reviews alarms, central station and transport before quoting a reference.',
      'Biolight S12 and M12 patient monitors are for sale, with price on request. The Advanced PM-2000A PRO is also published. Documentation and support are confirmed per reference.'
    ),
    'faq', jsonb_build_array(
      jsonb_build_object('q','What separates a basic monitor from an ICU monitor?','a','Service criticality: expandable parameters, alarms, autonomy and central-station readiness. Basic units fit observation; ICU usually needs modularity and continuity.'),
      jsonb_build_object('q','Does I-ME install and train?','a','Yes — installation and training scope are agreed in the quote by site and number of points.'),
      jsonb_build_object('q','Do you carry the Biolight S12 and M12 monitors?','a','Yes. The S12 and the M12 are in the active catalog, with price on request. Other withdrawn Biolight monitors are not published.')
    )
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'familia' AND landing.clave = 'monitores'
  AND (
    landing.contenido_es #>> '{body,1}' IS DISTINCT FROM 'Los monitores de paciente Biolight S12 y M12 están a la venta, con precio bajo cotización. También está el Advanced PM-2000A PRO. La documentación y el soporte se confirman por referencia.'
    OR landing.contenido_en #>> '{body,1}' IS DISTINCT FROM 'Biolight S12 and M12 patient monitors are for sale, with price on request. The Advanced PM-2000A PRO is also published. Documentation and support are confirmed per reference.'
  );

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'title', 'Nebulizadores, aspiradores y terapia respiratoria | I-ME',
    'description', 'Nebulizadores, aspiradores de secreciones, oxígeno y ventiladores publicados para terapia respiratoria en Colombia. El alto flujo Airvo no está en el catálogo activo.'
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'title', 'Nebulizers, suction units and respiratory therapy | I-ME',
    'description', 'Published nebulizers, suction units, oxygen and ventilators for respiratory therapy in Colombia. Airvo high-flow systems are not in the active catalog.'
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'familia' AND landing.clave = 'terapia-respiratoria-soporte-vital'
  AND (
    landing.contenido_es->>'title' IS DISTINCT FROM 'Nebulizadores, aspiradores y terapia respiratoria | I-ME'
    OR landing.contenido_en->>'title' IS DISTINCT FROM 'Nebulizers, suction units and respiratory therapy | I-ME'
  );

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'name', 'Bombas de infusión',
    'title', 'Bomba de infusión hospitalaria | I-ME',
    'description', 'Bombas de infusión y de jeringa para UCI y hospitalización en Colombia. I-ME orienta el parque antes de cotizar.',
    'intro', 'Una bomba de infusión se elige por el servicio — UCI, hospitalización o pediatría —, la biblioteca de fármacos y quién la programa en el turno.'
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'name', 'Infusion pumps',
    'title', 'Hospital infusion pumps | I-ME',
    'description', 'Infusion and syringe pumps for ICU and wards in Colombia. I-ME matches the fleet before a quote.',
    'intro', 'An infusion pump is chosen for the service — ICU, ward or pediatrics —, the drug library and who programs it each shift.'
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'familia' AND landing.clave = 'soluciones-iv'
  AND (
    landing.contenido_es->>'name' IS DISTINCT FROM 'Bombas de infusión'
    OR landing.contenido_en->>'name' IS DISTINCT FROM 'Infusion pumps'
    OR landing.contenido_es->>'title' IS DISTINCT FROM 'Bomba de infusión hospitalaria | I-ME'
  );

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'title', 'Traslado, inmovilización y urgencias hospitalarias | I-ME',
    'description', 'Equipos de traslado, tableros e inmovilización para urgencias. Las camillas de traslado se cotizan en la guía de camillas médicas.'
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'title', 'Hospital transport, immobilization and emergency equipment | I-ME',
    'description', 'Transport equipment, spine boards and immobilization for emergency services. Transfer stretchers are quoted on the medical stretchers guide.'
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'familia' AND landing.clave = 'emergencias-traslado-inmovilizacion'
  AND landing.contenido_es->>'title' IS DISTINCT FROM 'Traslado, inmovilización y urgencias hospitalarias | I-ME';

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'title', 'Cardiología y reanimación hospitalaria | I-ME',
    'description', 'Electrocardiógrafos, Holter y reanimación para hospitales en Colombia. El desfibrilador bifásico se cotiza en su guía.'
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'title', 'Hospital cardiology and resuscitation equipment | I-ME',
    'description', 'Electrocardiographs, Holter and resuscitation equipment for hospitals in Colombia. The biphasic defibrillator is quoted on its guide.'
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'familia' AND landing.clave = 'cardiologia-reanimacion'
  AND landing.contenido_es->>'title' IS DISTINCT FROM 'Cardiología y reanimación hospitalaria | I-ME';

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'title', 'Sillas de ruedas desde $327.250 | envío a Colombia',
    'description', 'Sillas de ruedas en el catálogo I-ME desde $327.250 hasta $2.971.430 COP, IVA incluido. Envío a Colombia. Entrega en menos de 10 días hábiles.',
    'h1', 'Sillas de ruedas con precio publicado'
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'title', 'Wheelchairs from $327.250 | shipping to Colombia',
    'description', 'Wheelchairs in the I-ME catalog from $327.250 to $2.971.430 COP, VAT included. Shipping to Colombia. Delivery in under 10 business days.',
    'h1', 'Wheelchairs with a published price'
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'campana' AND landing.clave = 'sillas_ruedas'
  AND landing.contenido_es->>'title' IS DISTINCT FROM 'Sillas de ruedas desde $327.250 | envío a Colombia';

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'title', 'Caminadores para adultos desde $82.110 | envío a Colombia',
    'description', 'Caminadores para adultos en el catálogo I-ME desde $82.110 hasta $339.150 COP, IVA incluido. Envío a Colombia. Entrega en menos de 10 días hábiles.',
    'h1', 'Caminadores para adultos con precio publicado'
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'title', 'Adult walkers from $82.110 | shipping to Colombia',
    'description', 'Adult walkers in the I-ME catalog from $82.110 to $339.150 COP, VAT included. Shipping to Colombia. Delivery in under 10 business days.',
    'h1', 'Adult walkers with a published price'
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'campana' AND landing.clave = 'caminadores_adultos'
  AND landing.contenido_es->>'title' IS DISTINCT FROM 'Caminadores para adultos desde $82.110 | envío a Colombia';

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'title', 'Ventilador mecánico UCI | Monnal T75 | I-ME',
    'description', 'Ventilador mecánico para UCI adulto y pediátrico: Monnal T75 publicado en el catálogo. TEO y T60 no están activos. Precio bajo cotización.',
    'h1', 'Ventilador mecánico para UCI',
    'lead', 'El ventilador publicado para UCI adulto y pediátrico es el Monnal T75. La configuración se cotiza. TEO y T60 no están en el catálogo activo.'
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'title', 'ICU mechanical ventilator | Monnal T75 | I-ME',
    'description', 'Mechanical ventilator for adult and pediatric ICU: published Monnal T75. TEO and T60 are not active. Price on request.',
    'h1', 'Mechanical ventilator for the ICU',
    'lead', 'The published adult and pediatric ICU ventilator is the Monnal T75. Configuration is quoted. TEO and T60 are not in the active catalog.'
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'campana' AND landing.clave = 'ventiladores_mecanicos'
  AND landing.contenido_es->>'title' IS DISTINCT FROM 'Ventilador mecánico UCI | Monnal T75 | I-ME';

UPDATE public.landings AS landing
SET
  contenido_es = replace(
    landing.contenido_es::text,
    'Ventilador portátil T60 para traslados intrahospitalarios.',
    'El T60 de transporte no está en el catálogo activo. El brief de traslado se cotiza aparte del T75.'
  )::jsonb,
  contenido_en = replace(
    landing.contenido_en::text,
    'T60 portable ventilator for intrahospital transfers.',
    'The T60 transport ventilator is not in the active catalog. A transfer brief is quoted separately from the ICU T75.'
  )::jsonb,
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'campana' AND landing.clave = 'ventiladores_mecanicos'
  AND (
    landing.contenido_es::text LIKE '%Ventilador portátil T60 para traslados intrahospitalarios.%'
    OR landing.contenido_en::text LIKE '%T60 portable ventilator for intrahospital transfers.%'
  );

UPDATE public.landings AS landing
SET
  contenido_es = contenido_es || jsonb_build_object(
    'title', 'Alto flujo Fisher Paykel: fuera del catálogo activo | I-ME',
    'description', 'Airvo y Optiflow no están en el catálogo activo. La terapia respiratoria publicada son nebulizadores, aspiradores, oxígeno y ventiladores.',
    'h1', 'Alto flujo Fisher Paykel'
  ),
  contenido_en = contenido_en || jsonb_build_object(
    'title', 'Fisher Paykel high flow: not in the active catalog | I-ME',
    'description', 'Airvo and Optiflow are not in the active catalog. Published respiratory therapy is nebulizers, suction units, oxygen and ventilators.',
    'h1', 'Fisher Paykel high flow'
  ),
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'campana' AND landing.clave = 'alto_flujo_fisher_paykel'
  AND landing.contenido_es->>'title' IS DISTINCT FROM 'Alto flujo Fisher Paykel: fuera del catálogo activo | I-ME';

INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE (tipo = 'familia' AND clave IN (
    'monitores', 'terapia-respiratoria-soporte-vital', 'soluciones-iv',
    'emergencias-traslado-inmovilizacion', 'cardiologia-reanimacion'
  ))
  OR (tipo = 'campana' AND clave IN (
    'sillas_ruedas', 'caminadores_adultos', 'ventiladores_mecanicos', 'alto_flujo_fisher_paykel'
  ))
ON CONFLICT (landing_id, version) DO NOTHING;

INSERT INTO public.articulos (slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, publicado, autor_tipo, cluster_id, tags)
SELECT nuevo.slug, nuevo.titulo_es, nuevo.titulo_en, nuevo.cuerpo_es, nuevo.cuerpo_en, true, 'ime', nuevo.cluster_id, nuevo.tags
FROM (
  VALUES
  ($ime_art$como-elegir-tensiometro-digital$ime_art$, $ime_art$Cómo elegir un tensiómetro digital$ime_art$, $ime_art$How to choose a digital blood pressure monitor$ime_art$, $ime_art$Guía para comparar los tensiómetros digitales publicados en el catálogo I-ME, con precio con IVA cuando la ficha lo trae.

# Qué hay publicado

Esta guía compara los tensiómetros digitales del catálogo I-ME. No indica diagnóstico ni dice qué cifra es normal.

| Referencia | Uso en la ficha | Precio con IVA |
| --- | --- | --- |
| [Carditek Pulse](/es/productos/tensiometro-digital-de-muneca-carditek-pulse-ref-cdk-bpm-75b/) | Muñeca | $46.410 |
| [Carditek Vital](/es/productos/tensiometro-digital-carditek-vital-ref-cdk-bpm-65r/) | Brazo, uso en el hogar | $51.170 |
| [Carditek Smart](/es/productos/tensiometro-digital-carditek-smart-ref-cdk-bpm-66ep/) | Brazo, pantalla retroiluminada y batería recargable | $88.060 |
| [Carditek Power](/es/productos/tensiometro-digital-carditek-power-ref-cdk-bpm-65b/) | Hogar o cuidado | Precio bajo cotización |

El listado con filtro está en [tensiómetros digitales](/es/tensiometros-digitales/).

## Cómo acotar la compra

1. Muñeca o brazo, según la ficha de cada referencia.
2. Si el precio tiene que verse antes de cotizar, Pulse, Vital y Smart lo publican. Power no.
3. El precio incluye IVA. El envío a Colombia es adicional. La entrega es en menos de 10 días hábiles.

Teléfono: +57 313 724 7353.
$ime_art$, $ime_art$Guide comparing the digital blood pressure monitors published in the I-ME catalog, with VAT-inclusive price when the sheet has one.

# What is published

This guide compares the digital blood pressure monitors in the I-ME catalog. It does not diagnose and it does not say which reading is normal.

| Reference | Use on the sheet | VAT-inclusive price |
| --- | --- | --- |
| [Carditek Pulse](/en/products/tensiometro-digital-de-muneca-carditek-pulse-ref-cdk-bpm-75b/) | Wrist | $46.410 |
| [Carditek Vital](/en/products/tensiometro-digital-carditek-vital-ref-cdk-bpm-65r/) | Upper arm, home use | $51.170 |
| [Carditek Smart](/en/products/tensiometro-digital-carditek-smart-ref-cdk-bpm-66ep/) | Upper arm, backlit display and rechargeable battery | $88.060 |
| [Carditek Power](/en/products/tensiometro-digital-carditek-power-ref-cdk-bpm-65b/) | Home or care settings | Price on request |

The filterable list is on [digital blood pressure monitors](/en/digital-blood-pressure-monitors/).

## How to narrow the purchase

1. Wrist or upper arm, according to each reference sheet.
2. If the price must be visible before a quote, Pulse, Vital and Smart publish it. Power does not.
3. The price includes VAT. Shipping to Colombia is extra. Delivery is in under 10 business days.

Phone: +57 313 724 7353.
$ime_art$, NULL::uuid, ARRAY[$ime_art$tensiometro$ime_art$, $ime_art$diagnostico$ime_art$]::text[]),
  ($ime_art$analizador-hematologico-para-laboratorio$ime_art$, $ime_art$Analizador hematológico para laboratorio$ime_art$, $ime_art$Hematology analyzer for the laboratory$ime_art$, $ime_art$Los analizadores hematológicos Mindray BC-10 y BC-30s están publicados y se cotizan: ninguno tiene precio en el catálogo.

# Dos analizadores publicados

Ninguno de los dos tiene precio en el catálogo. Se cotizan.

## Mindray BC-10

[Analizador hematológico automático Mindray BC-10](/es/productos/analizador-hematologico-automatico-mindray-ref-bc-10-mindray/): 3 partes, 20 parámetros, 3 histogramas y hasta 30 muestras por hora.

## Mindray BC-30s

[Analizador hematológico automático Mindray BC-30s](/es/productos/analizador-hematologico-automatico-mindray-ref-bc-30s-mindray/): 21 parámetros, pantalla de 10,4 pulgadas, hasta 70 muestras por hora y almacenamiento de 500.000 resultados.

## Qué no está en esta guía

No hay precio, registro INVIMA ni garantía publicados para estas dos referencias. Esos datos se confirman en la cotización de la referencia, no se copian de un modelo al otro.

Teléfono: +57 313 724 7353.
$ime_art$, $ime_art$The Mindray BC-10 and BC-30s hematology analyzers are published and quoted: neither has a catalog price.

# Two published analyzers

Neither has a catalog price. Both are quoted.

## Mindray BC-10

[Mindray BC-10 automatic hematology analyzer](/en/products/analizador-hematologico-automatico-mindray-ref-bc-10-mindray/): 3-part, 20 parameters, 3 histograms and up to 30 samples per hour.

## Mindray BC-30s

[Mindray BC-30s automatic hematology analyzer](/en/products/analizador-hematologico-automatico-mindray-ref-bc-30s-mindray/): 21 parameters, 10.4-inch screen, up to 70 samples per hour and storage for 500,000 results.

## What this guide does not include

There is no published price, INVIMA registration or warranty for these two references. Those facts are confirmed in the quote for that reference. They are not copied from one model to the other.

Phone: +57 313 724 7353.
$ime_art$, NULL::uuid, ARRAY[$ime_art$hematologia$ime_art$, $ime_art$laboratorio$ime_art$]::text[]),
  ($ime_art$holter-vs-ecg$ime_art$, $ime_art$Holter y ECG de 12 derivaciones$ime_art$, $ime_art$Holter and 12-lead ECG$ime_art$, $ime_art$Holter de 24 horas y electrocardiógrafo de 12 derivaciones son fichas distintas del catálogo. Ninguno tiene precio publicado.

# Dos fichas distintas

No es una indicación clínica. Es la diferencia que está escrita en el catálogo. Ninguno tiene precio publicado.

## Holter

[Holter 24 horas](/es/productos/holter-24-horas-ritmo-cardiaco/): sistema ambulatorio de 24 horas. La ficha dice análisis automático de arritmias, taquicardias y bloqueos cardíacos.

## ECG

[Electrocardiógrafo de 12 derivaciones digital](/es/productos/electrocardiografo-12-derivaciones-digital/): 12 derivaciones, interpretación automática, impresión térmica integrada y conectividad USB y red.

La familia está en [cardiología](/es/familias/cardiologia/).

Teléfono: +57 313 724 7353.
$ime_art$, $ime_art$The 24-hour Holter and the 12-lead electrocardiograph are different catalog sheets. Neither has a published price.

# Two different sheets

This is not clinical advice. It is the difference written in the catalog. Neither product has a published price.

## Holter

[24-hour Holter](/en/products/holter-24-horas-ritmo-cardiaco/): 24-hour ambulatory system. The sheet says automatic analysis of arrhythmias, tachycardias and heart blocks.

## ECG

[Digital 12-lead electrocardiograph](/en/products/electrocardiografo-12-derivaciones-digital/): 12 leads, automatic interpretation, built-in thermal printing and USB plus network connectivity.

The family page is [cardiology](/en/families/cardiologia/).

Phone: +57 313 724 7353.
$ime_art$, NULL::uuid, ARRAY[$ime_art$holter$ime_art$, $ime_art$ecg$ime_art$]::text[]),
  ($ime_art$desfibrilador-bifasico-que-incluye$ime_art$, $ime_art$Desfibrilador bifásico: qué incluye la ficha$ime_art$, $ime_art$Biphasic defibrillator: what the sheet includes$ime_art$, $ime_art$Qué incluye la ficha publicada del desfibrilador bifásico con monitor. Esa referencia no tiene precio en el catálogo.

# Una referencia publicada

[Desfibrilador bifásico con monitor](/es/productos/desfibrilador-bifasico-con-monitor/). No tiene precio en el catálogo.

La ficha publicada dice:

- Bifásico, de uso hospitalario y prehospitalario.
- Monitoreo ECG continuo.
- Marcapasos externo no invasivo.
- Capnografía.
- Carga en menos de 7 segundos.

No hay registro INVIMA, garantía ni precio en esa ficha. La guía de la familia está en [desfibriladores hospitalarios](/es/desfibriladores-hospitalarios/).

Teléfono: +57 313 724 7353.
$ime_art$, $ime_art$What the published biphasic defibrillator with monitor sheet includes. That reference has no catalog price.

# One published reference

[Biphasic defibrillator with monitor](/en/products/desfibrilador-bifasico-con-monitor/). It has no catalog price.

The published sheet says:

- Biphasic, for hospital and prehospital use.
- Continuous ECG monitoring.
- Non-invasive external pacemaker.
- Capnography.
- Charge in under 7 seconds.

That sheet has no INVIMA registration, warranty or price. The family guide is [hospital defibrillators](/en/hospital-defibrillators/).

Phone: +57 313 724 7353.
$ime_art$, (SELECT id FROM topic_clusters WHERE slug = 'cardiologia-reanimacion'), ARRAY[$ime_art$desfibrilador$ime_art$]::text[])
) AS nuevo(slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, cluster_id, tags)
ON CONFLICT (slug) DO UPDATE SET
  titulo_es = EXCLUDED.titulo_es,
  titulo_en = EXCLUDED.titulo_en,
  cuerpo_es = EXCLUDED.cuerpo_es,
  cuerpo_en = EXCLUDED.cuerpo_en,
  publicado = EXCLUDED.publicado,
  cluster_id = EXCLUDED.cluster_id,
  tags = EXCLUDED.tags
WHERE public.articulos.titulo_es IS DISTINCT FROM EXCLUDED.titulo_es
   OR public.articulos.titulo_en IS DISTINCT FROM EXCLUDED.titulo_en
   OR public.articulos.cuerpo_es IS DISTINCT FROM EXCLUDED.cuerpo_es
   OR public.articulos.cuerpo_en IS DISTINCT FROM EXCLUDED.cuerpo_en
   OR public.articulos.publicado IS DISTINCT FROM EXCLUDED.publicado
   OR public.articulos.cluster_id IS DISTINCT FROM EXCLUDED.cluster_id;

-- Precios de referencia usados en títulos (IVA incluido): sillas $327.250–$2.971.430, caminadores $82.110–$339.150, bastones $26.061–$41.650, lámparas $58.310.000–$65.164.400.

-- Reescribe enlaces internos viejos (legacy_slugs, incluidos /g-…/) hacia el slug canónico.
DO $$
DECLARE
  par record;
  destino_es text;
  destino_en text;
  origen_es text;
  origen_en text;
BEGIN
  FOR par IN
    SELECT * FROM (VALUES
      ('a3158', 'incubadora-neonatal-de-transporte-ref-a3158-advanced'),
      ('incubadora-neonatal-de-transporte-a3158', 'incubadora-neonatal-de-transporte-ref-a3158-advanced'),
      ('incubadora-neonatal-de-transporte-a3158-advanced', 'incubadora-neonatal-de-transporte-ref-a3158-advanced'),
      ('a3186', 'incubadora-neonatal-ref-a3186-advanced'),
      ('incubadora-neonatal-a3186', 'incubadora-neonatal-ref-a3186-advanced'),
      ('incubadora-neonatal-a3186-advanced', 'incubadora-neonatal-ref-a3186-advanced'),
      ('a3186-plus', 'incubadora-neonatal-ref-a3186-plus-advanced'),
      ('incubadora-neonatal-a3186-d516d2ab-9acf-46', 'incubadora-neonatal-ref-a3186-plus-advanced'),
      ('incubadora-neonatal-a3186-plus', 'incubadora-neonatal-ref-a3186-plus-advanced'),
      ('incubadora-neonatal-a3186-plus-advanced', 'incubadora-neonatal-ref-a3186-plus-advanced'),
      ('a4051', 'cuna-de-calor-radiante-ref-a4051-advanced'),
      ('cuna-de-calor-radiante-a4051', 'cuna-de-calor-radiante-ref-a4051-advanced'),
      ('cuna-de-calor-radiante-a4051-advanced', 'cuna-de-calor-radiante-ref-a4051-advanced'),
      ('acuarius', 'monitor-multiparametro-ref-acuarius-northern'),
      ('monitor-multiparametro-acuarius', 'monitor-multiparametro-ref-acuarius-northern'),
      ('monitor-multiparametro-acuarius-northern', 'monitor-multiparametro-ref-acuarius-northern'),
      ('alc-280', 'arco-en-c-alc-280-series-ref-alc-280-angell'),
      ('arco-en-c-alc-280-series', 'arco-en-c-alc-280-series-ref-alc-280-angell'),
      ('arco-en-c-alc-280-series-angell', 'arco-en-c-alc-280-series-ref-alc-280-angell'),
      ('am-6000-plus', 'maquina-de-anestesia-ref-am-6000-plus-advanced'),
      ('maquina-de-anestesia-am-6000', 'maquina-de-anestesia-ref-am-6000-plus-advanced'),
      ('maquina-de-anestesia-am-6000-plus', 'maquina-de-anestesia-ref-am-6000-plus-advanced'),
      ('maquina-de-anestesia-am-6000-plus-advanced', 'maquina-de-anestesia-ref-am-6000-plus-advanced'),
      ('aquarius-lite', 'oximetro-ref-aquarius-lite-northern'),
      ('oximetro-aquarius-lite', 'oximetro-ref-aquarius-lite-northern'),
      ('oximetro-aquarius-lite-northern', 'oximetro-ref-aquarius-lite-northern'),
      ('atlas-n3', 'maquina-de-anestesia-ref-atlas-n3-northern'),
      ('maquina-de-anestesia-atlas-n3', 'maquina-de-anestesia-ref-atlas-n3-northern'),
      ('maquina-de-anestesia-atlas-n3-northern', 'maquina-de-anestesia-ref-atlas-n3-northern'),
      ('atlas-n5', 'maquina-de-anestesia-ref-atlas-n5-northern'),
      ('maquina-de-anestesia-atlas-n5', 'maquina-de-anestesia-ref-atlas-n5-northern'),
      ('maquina-de-anestesia-atlas-n5-northern', 'maquina-de-anestesia-ref-atlas-n5-northern'),
      ('atlas-n7', 'maquina-de-anestesia-ref-atlas-n7-northern'),
      ('maquina-de-anestesia-atlas-n7', 'maquina-de-anestesia-ref-atlas-n7-northern'),
      ('maquina-de-anestesia-atlas-n7-northern', 'maquina-de-anestesia-ref-atlas-n7-northern'),
      ('autoclave-5075', 'autoclave-horizontal-ref-5075-tuttnauer'),
      ('autoclave-horizontal-5075', 'autoclave-horizontal-ref-5075-tuttnauer'),
      ('autoclave-horizontal-5075-tuttnauer', 'autoclave-horizontal-ref-5075-tuttnauer'),
      ('b-1000-pro', 'cama-hospitalaria-electrica-ref-b-1000-pro-advanced'),
      ('cama-hospitalaria-electrica-b-1000-pro', 'cama-hospitalaria-electrica-ref-b-1000-pro-advanced'),
      ('cama-hospitalaria-electrica-b-1000-pro-advanced', 'cama-hospitalaria-electrica-ref-b-1000-pro-advanced'),
      ('b-2000', 'cama-hospitalaria-manual-ref-b-2000-advanced'),
      ('cama-hospitalaria-manual-b-2000', 'cama-hospitalaria-manual-ref-b-2000-advanced'),
      ('cama-hospitalaria-manual-b-2000-advanced', 'cama-hospitalaria-manual-ref-b-2000-advanced'),
      ('b-2000-plus', 'cama-hospitalaria-electrica-ref-b-2000-plus-advanced'),
      ('cama-hospitalaria-electrica-b-2000-plus', 'cama-hospitalaria-electrica-ref-b-2000-plus-advanced'),
      ('cama-hospitalaria-electrica-b-2000-plus-advanced', 'cama-hospitalaria-electrica-ref-b-2000-plus-advanced'),
      ('bme002', 'sillon-reclinable-bme002-bm-ref-bme002'),
      ('sillon-reclinable-bme002', 'sillon-reclinable-bme002-bm-ref-bme002'),
      ('sillon-reclinable-bme002-bm', 'sillon-reclinable-bme002-bm-ref-bme002'),
      ('bme006', 'silla-reclinable-bme006-bm-ref-bme006'),
      ('silla-reclinable-bme006', 'silla-reclinable-bme006-bm-ref-bme006'),
      ('silla-reclinable-bme006-bm', 'silla-reclinable-bme006-bm-ref-bme006'),
      ('bme007', 'sillon-reclinable-bme007-bm-ref-bme007'),
      ('sillon-reclinable-bme007', 'sillon-reclinable-bme007-bm-ref-bme007'),
      ('sillon-reclinable-bme007-bm', 'sillon-reclinable-bme007-bm-ref-bme007'),
      ('crius-v6', 'ventilador-mecanico-ref-crius-v6-northern'),
      ('ventilador-mecanico-crius-v6', 'ventilador-mecanico-ref-crius-v6-northern'),
      ('ventilador-mecanico-crius-v6-northern', 'ventilador-mecanico-ref-crius-v6-northern'),
      ('dm156', 'mamografo-digital-dm156-series-angell-technology-ref-dm156-angell'),
      ('mamografo-digital-dm156-series-angell-technology', 'mamografo-digital-dm156-series-angell-technology-ref-dm156-angell'),
      ('dm166', 'mamografo-digital-dm166-series-ref-dm166-angell'),
      ('mamografo-digital-dm166-series', 'mamografo-digital-dm166-series-ref-dm166-angell'),
      ('mamografo-digital-dm166-series-angell', 'mamografo-digital-dm166-series-ref-dm166-angell'),
      ('dr-ceiling', 'sistema-de-rayos-x-dr-montado-en-techo-ref-dr-ceiling-angell'),
      ('sistema-de-rayos-x-dr-montado-en-techo', 'sistema-de-rayos-x-dr-montado-en-techo-ref-dr-ceiling-angell'),
      ('dr-floor', 'sistema-de-rayos-x-dr-montado-en-suelo-ref-dr-floor-angell'),
      ('sistema-de-rayos-x-dr-montado-en-suelo', 'sistema-de-rayos-x-dr-montado-en-suelo-ref-dr-floor-angell'),
      ('dr-mobile', 'sistema-de-rayos-x-dr-movil-ref-dr-mobile-angell'),
      ('sistema-de-rayos-x-dr-movil', 'sistema-de-rayos-x-dr-movil-ref-dr-mobile-angell'),
      ('dr-telecomand', 'sistema-dr-de-mesa-telecomandada-ref-dr-telecomand-angell'),
      ('sistema-dr-de-mesa-telecomandada', 'sistema-dr-de-mesa-telecomandada-ref-dr-telecomand-angell'),
      ('sistema-dr-de-mesa-telecomandada-angell', 'sistema-dr-de-mesa-telecomandada-ref-dr-telecomand-angell'),
      ('dr-uc-arm', 'dr-dinamico-de-brazo-ref-dr-uc-arm-angell'),
      ('dr-uc-arm-angell', 'dr-dinamico-de-brazo-ref-dr-uc-arm-angell'),
      ('ref-dr-uc-arm-angell', 'dr-dinamico-de-brazo-ref-dr-uc-arm-angell'),
      ('dinamico-de-brazo-ref-dr-uc-arm-angell', 'dr-dinamico-de-brazo-ref-dr-uc-arm-angell'),
      ('dtp573', 'dr-dinamico-ref-dtp573-angell'),
      ('dr-dinamico-dtp573', 'dr-dinamico-ref-dtp573-angell'),
      ('dr-dinamico-dtp573-angell', 'dr-dinamico-ref-dtp573-angell'),
      ('dus-3000', 'sistema-de-ultrasonido-ref-dus-3000-advanced'),
      ('sistema-de-ultrasonido-dus-3000', 'sistema-de-ultrasonido-ref-dus-3000-advanced'),
      ('sistema-de-ultrasonido-dus-3000-advanced', 'sistema-de-ultrasonido-ref-dus-3000-advanced'),
      ('dus-5000', 'sistema-de-ultrasonido-ref-dus-5000-advanced'),
      ('sistema-de-ultrasonido-dus-5000', 'sistema-de-ultrasonido-ref-dus-5000-advanced'),
      ('sistema-de-ultrasonido-dus-5000-advanced', 'sistema-de-ultrasonido-ref-dus-5000-advanced'),
      ('dus-5000-plus', 'sistema-de-ultrasonido-ref-dus-5000-plus-advanced'),
      ('sistema-de-ultrasonido-dus-5000-plus', 'sistema-de-ultrasonido-ref-dus-5000-plus-advanced'),
      ('sistema-de-ultrasonido-dus-5000-plus-advanced', 'sistema-de-ultrasonido-ref-dus-5000-plus-advanced'),
      ('dus-6000', 'sistema-de-ultrasonido-versatil-ref-dus-6000-advanced'),
      ('sistema-de-ultrasonido-versatil-dus-6000', 'sistema-de-ultrasonido-versatil-ref-dus-6000-advanced'),
      ('sistema-de-ultrasonido-versatil-dus-6000-advanced', 'sistema-de-ultrasonido-versatil-ref-dus-6000-advanced'),
      ('dus-7000', 'sistema-de-ultrasonido-ref-dus-7000-advanced'),
      ('sistema-de-ultrasonido-dus-7000', 'sistema-de-ultrasonido-ref-dus-7000-advanced'),
      ('sistema-de-ultrasonido-dus-7000-advanced', 'sistema-de-ultrasonido-ref-dus-7000-advanced'),
      ('ebsa-20', 'balanza-para-bebe-electronica-ref-ebsa-20-perlong'),
      ('balanza-para-bebe-electronica-ebsa-20', 'balanza-para-bebe-electronica-ref-ebsa-20-perlong'),
      ('balanza-para-bebe-electronica-ebsa-20-perlong', 'balanza-para-bebe-electronica-ref-ebsa-20-perlong'),
      ('ecg-12c', 'electrocardiografo-ref-ecg-12c-advanced'),
      ('electrocardiografo-ecg-12c', 'electrocardiografo-ref-ecg-12c-advanced'),
      ('electrocardiografo-ecg-12c-advanced', 'electrocardiografo-ref-ecg-12c-advanced'),
      ('ecg-3-plus', 'electrocardiografo-ref-ecg-3-plus-advanced'),
      ('electrocardiografo-ecg-3-plus', 'electrocardiografo-ref-ecg-3-plus-advanced'),
      ('electrocardiografo-ecg-3-plus-advanced', 'electrocardiografo-ref-ecg-3-plus-advanced'),
      ('producto-de-ejemplo', 'ejemplo-producto'),
      ('electroencefalografia-ampliada-obm-eega', 'electroencefalografia-ampliada-obm-eega-natus'),
      ('fm-9000', 'monitor-fetal-y-materno-ref-fm-9000-northern'),
      ('monitor-fetal-y-materno-fm-9000', 'monitor-fetal-y-materno-ref-fm-9000-northern'),
      ('monitor-fetal-y-materno-fm-9000-northern', 'monitor-fetal-y-materno-ref-fm-9000-northern'),
      ('fm-9000-plus', 'monitor-fetal-y-materno-ref-fm-9000-plus-advanced'),
      ('monitor-fetal-y-materno-fm-9000-plus', 'monitor-fetal-y-materno-ref-fm-9000-plus-advanced'),
      ('monitor-fetal-y-materno-fm-9000-plus-advanced', 'monitor-fetal-y-materno-ref-fm-9000-plus-advanced'),
      ('gemini', 'monitor-multiparametro-ref-gemini-northern'),
      ('monitor-multiparametro-gemini', 'monitor-multiparametro-ref-gemini-northern'),
      ('monitor-multiparametro-gemini-northern', 'monitor-multiparametro-ref-gemini-northern'),
      ('ip-200', 'bomba-de-infusion-ref-ip-200-advanced'),
      ('bomba-de-infusion-ip-200', 'bomba-de-infusion-ref-ip-200-advanced'),
      ('bomba-de-infusion-ip-200-advanced', 'bomba-de-infusion-ref-ip-200-advanced'),
      ('led-rx18', 'lampara-rodable-ref-led-rx18-ilumitec'),
      ('lampara-rodable-led-rx18', 'lampara-rodable-ref-led-rx18-ilumitec'),
      ('lampara-rodable-led-rx18-ilumitec', 'lampara-rodable-ref-led-rx18-ilumitec'),
      ('led-rx18-100k', 'lampara-rodable-ref-led-rx18-100k-ilumitec'),
      ('led-rx18-100k-ilumitec', 'lampara-rodable-ref-led-rx18-100k-ilumitec'),
      ('ref-led-rx18-100k-ilumitec', 'lampara-rodable-ref-led-rx18-100k-ilumitec'),
      ('led-rx36', 'lampara-rodable-ref-led-rx36-ilumitec'),
      ('lampara-rodable-led-rx36', 'lampara-rodable-ref-led-rx36-ilumitec'),
      ('lampara-rodable-led-rx36-ilumitec', 'lampara-rodable-ref-led-rx36-ilumitec'),
      ('led-rx36-160k', 'lampara-rodable-ref-led-rx36-160k-ilumitec'),
      ('led-rx36-160k-ilumitec', 'lampara-rodable-ref-led-rx36-160k-ilumitec'),
      ('ref-led-rx36-160k-ilumitec', 'lampara-rodable-ref-led-rx36-160k-ilumitec'),
      ('led-x18-100k', 'lampara-cielitica-ref-led-x18-100k-ilumitec'),
      ('led-x18-100k-ilumitec', 'lampara-cielitica-ref-led-x18-100k-ilumitec'),
      ('ref-led-x18-100k-ilumitec', 'lampara-cielitica-ref-led-x18-100k-ilumitec'),
      ('led-x36', 'lampara-cielitica-ref-led-x36-ilumitec'),
      ('lampara-cielitica-led-x36', 'lampara-cielitica-ref-led-x36-ilumitec'),
      ('lampara-cielitica-led-x36-ilumitec', 'lampara-cielitica-ref-led-x36-ilumitec'),
      ('led-x3618', 'lampara-cielitica-led-x3618-con-satelite-ref-led-x3618-ilumitec'),
      ('lampara-cielitica-led-x3618-con-satelite', 'lampara-cielitica-led-x3618-con-satelite-ref-led-x3618-ilumitec'),
      ('lampara-cielitica-led-x3618-con-satelite-ilumitec', 'lampara-cielitica-led-x3618-con-satelite-ref-led-x3618-ilumitec'),
      ('led-x3636', 'lampara-cielitica-led-x3636-con-satelite-ref-led-x3636-ilumitec'),
      ('lampara-cielitica-led-x3636-con-satelite', 'lampara-cielitica-led-x3636-con-satelite-ref-led-x3636-ilumitec'),
      ('lampara-cielitica-led-x3636-con-satelite-ilumitec', 'lampara-cielitica-led-x3636-con-satelite-ref-led-x3636-ilumitec'),
      ('manta-thermowrap-ref-524', 'manta-thermowrap-ref-524-03118-belmont'),
      ('manta-thermowrap-ref-524-ref-524-03118-belmont', 'manta-thermowrap-ref-524-03118-belmont'),
      ('monitor-de-paciente-m12-biolight', 'monitor-de-paciente-ref-m12-biolight'),
      ('monitor-de-paciente-p12-biolight', 'monitor-de-paciente-ref-p12-biolight'),
      ('monitor-de-paciente-s12-biolight', 'monitor-de-paciente-ref-s12-biolight'),
      ('monitor-de-signos-vitales-m10-biolight', 'monitor-de-signos-vitales-ref-m10-biolight'),
      ('monitor-de-signos-vitales-portatil-m860-biolight', 'monitor-de-signos-vitales-portatil-ref-m860-biolight'),
      ('onitor-de-paciente-p22-biolight', 'monitor-de-paciente-ref-p22-biolight'),
      ('monitor-de-paciente-p22-biolight', 'monitor-de-paciente-ref-p22-biolight'),
      ('optiflow-plus-asymmetrical-nasal-cannula-fisher-paykel', 'optiflow-asymmetrical-nasal-cannula-fisher-paykel'),
      ('ot-30', 'mesa-de-operaciones-manual-ref-ot-30-advanced'),
      ('mesa-de-operaciones-manual-ot-30', 'mesa-de-operaciones-manual-ref-ot-30-advanced'),
      ('mesa-de-operaciones-manual-ot-30-advanced', 'mesa-de-operaciones-manual-ref-ot-30-advanced'),
      ('ot-300c', 'mesa-de-operaciones-electrica-ref-ot-300c-advanced'),
      ('mesa-de-operaciones-electrica-ot-300c', 'mesa-de-operaciones-electrica-ref-ot-300c-advanced'),
      ('mesa-de-operaciones-electrica-ot-300c-advanced', 'mesa-de-operaciones-electrica-ref-ot-300c-advanced'),
      ('ot-500', 'mesa-de-operaciones-ref-ot-500-advanced'),
      ('mesa-de-operaciones-ot-500', 'mesa-de-operaciones-ref-ot-500-advanced'),
      ('mesa-de-operaciones-ot-500-advanced', 'mesa-de-operaciones-ref-ot-500-advanced'),
      ('pisces', 'monitor-multiparametro-ref-pisces-northern'),
      ('monitor-multiparametro-pisces', 'monitor-multiparametro-ref-pisces-northern'),
      ('monitor-multiparametro-pisces-northern', 'monitor-multiparametro-ref-pisces-northern'),
      ('pm-2000a-pro', 'monitor-de-paciente-ref-pm-2000a-pro-advanced'),
      ('pm-2000m', 'monitor-modular-ref-pm-2000m-advanced'),
      ('monitor-modular-pm-2000m', 'monitor-modular-ref-pm-2000m-advanced'),
      ('monitor-modular-pm-2000m-advanced', 'monitor-modular-ref-pm-2000m-advanced'),
      ('pm-2000xl', 'sistema-de-monitorizacion-ref-pm-2000xl-advanced'),
      ('sistema-de-monitorizacion-pm-2000xl', 'sistema-de-monitorizacion-ref-pm-2000xl-advanced'),
      ('sistema-de-monitorizacion-pm-2000xl-advanced', 'sistema-de-monitorizacion-ref-pm-2000xl-advanced'),
      ('pm-2000xl-pro', 'sistema-de-monitorizacion-ref-pm-2000xl-pro-advanced'),
      ('pm-200m', 'monitor-modular-de-paciente-ref-pm-200m-advanced'),
      ('monitor-modular-de-paciente-pm-200m', 'monitor-modular-de-paciente-ref-pm-200m-advanced'),
      ('monitor-modular-de-paciente-pm-200m-advanced', 'monitor-modular-de-paciente-ref-pm-200m-advanced'),
      ('pt-2000', 'lampara-de-fototerapia-ref-pt-2000-advanced'),
      ('lampara-de-fototerapia-pt-2000', 'lampara-de-fototerapia-ref-pt-2000-advanced'),
      ('lampara-de-fototerapia-pt-2000-advanced', 'lampara-de-fototerapia-ref-pt-2000-advanced'),
      ('rgt-a-200-rt', 'bascula-corporal-doble-regla-ref-rgt-a-200-rt-perlong'),
      ('rgt-a-200-rt-perlong', 'bascula-corporal-doble-regla-ref-rgt-a-200-rt-perlong'),
      ('ref-rgt-a-200-rt-perlong', 'bascula-corporal-doble-regla-ref-rgt-a-200-rt-perlong'),
      ('bascula-corporal-doble-regla-a-ref-rgt-a-200-rt-perlong', 'bascula-corporal-doble-regla-ref-rgt-a-200-rt-perlong'),
      ('rgt-rt', 'balanza-corporal-con-doble-regla-ref-rgt-rt-perlong'),
      ('balanza-corporal-con-doble-regla-rgt-rt', 'balanza-corporal-con-doble-regla-ref-rgt-rt-perlong'),
      ('balanza-corporal-con-doble-regla-rgt-rt-perlong', 'balanza-corporal-con-doble-regla-ref-rgt-rt-perlong'),
      ('sk-a3-x01', 'cuna-neonatal-x01-ref-sk-a3-x01-saikang'),
      ('sk-ad3-x01-1', 'cuna-neonatal-x01-1-ref-sk-ad3-x01-1-saikang'),
      ('sk-c1', 'cama-de-hospital-ref-sk-c1-saikang'),
      ('cama-de-hospital-sk-c1', 'cama-de-hospital-ref-sk-c1-saikang'),
      ('cama-de-hospital-sk-c1-saikang', 'cama-de-hospital-ref-sk-c1-saikang'),
      ('sk-c1-r00', 'cama-de-hospital-plana-r00-ref-sk-c1-r00-saikang'),
      ('sk-c1-r000w', 'camilla-manual-de-una-funcion-r000w-ref-sk-c1-r000w-saikang'),
      ('sk-c1-v2k', 'camilla-manual-v2k-ref-sk-c1-v2k-saikang'),
      ('sk-cd1-k3k', 'cama-manual-k3k-ref-sk-cd1-k3k-saikang'),
      ('sk-cd1-v3k', 'cama-hospitalaria-manual-v3k-ref-sk-cd1-v3k-saikang'),
      ('sk-cd1-v3v', 'cama-manual-v3v-ref-sk-cd1-v3v-saikang'),
      ('sk-cd1-v4v', 'camilla-manual-v4v-ref-sk-cd1-v4v-saikang'),
      ('sk-cd1-v4w', 'cama-manual-v4w-ref-sk-cd1-v4w-saikang'),
      ('sk-d2c', 'gabinete-dental-ref-sk-d2c-saikang'),
      ('gabinete-dental-sk-d2c', 'gabinete-dental-ref-sk-d2c-saikang'),
      ('gabinete-dental-sk-d2c-saikang', 'gabinete-dental-ref-sk-d2c-saikang'),
      ('ska-1b-skb1a02', 'camilla-transportadora-ref-skb1a02-saikang'),
      ('ska-1c-skb1a01', 'camilla-plegable-ref-skb1a01-saikang'),
      ('skb-1a-skb2a10', 'tablero-espinal-ref-skb2a10-saikang'),
      ('skb-2a-skb2a11', 'tablero-espinal-ref-skb2a11-saikang'),
      ('skb-4a-skb2a12', 'tablero-espinal-ref-skb2a12-saikang'),
      ('skb039-h', 'camilla-transportadora-ref-skb039-h-saikang'),
      ('camilla-transportadora-skb039-h', 'camilla-transportadora-ref-skb039-h-saikang'),
      ('camilla-transportadora-skb039-h-saikang', 'camilla-transportadora-ref-skb039-h-saikang'),
      ('skb3a104', 'camilla-blanda-ref-skb3a104-saikang'),
      ('camilla-blanda-skb3a104', 'camilla-blanda-ref-skb3a104-saikang'),
      ('camilla-blanda-skb3a104-saikang', 'camilla-blanda-ref-skb3a104-saikang'),
      ('skc-3b5-skb039d', 'camilla-para-ambulancia-skb039-d-ref-skb039d-saikang'),
      ('skd-a-z0n', 'cama-de-atencion-pediatrica-z0n-ref-skd-a-z0n-saikang'),
      ('skd-c-cq8k', 'cama-de-atencion-pediatrica-ref-cq8k-saikang'),
      ('skd-c-hb421', 'cama-de-atencion-domiciliaria-ref-hb421-saikang'),
      ('skd-c-hb422', 'cama-de-atencion-domiciliaria-ref-hb422-saikang'),
      ('skd-c-hb424', 'cama-de-atencion-domiciliaria-ref-hb424-saikang'),
      ('skd-d-h6k', 'cama-de-atencion-domiciliaria-vip-h6k-ref-skd-d-h6k-saikang'),
      ('ske001', 'silla-de-asistente-ref-ske001-saikang'),
      ('silla-de-asistente-ske001', 'silla-de-asistente-ref-ske001-saikang'),
      ('silla-de-asistente-ske001-saikang', 'silla-de-asistente-ref-ske001-saikang'),
      ('ske001-19', 'sofa-de-asistente-ref-ske001-19-saikang'),
      ('sofa-de-asistente-ske001-19', 'sofa-de-asistente-ref-ske001-19-saikang'),
      ('sofa-de-asistente-ske001-19-saikang', 'sofa-de-asistente-ref-ske001-19-saikang'),
      ('ske008-1', 'silla-de-espera-ref-ske008-1-saikang'),
      ('silla-de-espera-ske008-1', 'silla-de-espera-ref-ske008-1-saikang'),
      ('silla-de-espera-ske008-1-saikang', 'silla-de-espera-ref-ske008-1-saikang'),
      ('ske011', 'silla-de-espera-ref-ske011-saikang'),
      ('silla-de-espera-ske011', 'silla-de-espera-ref-ske011-saikang'),
      ('silla-de-espera-ske011-saikang', 'silla-de-espera-ref-ske011-saikang'),
      ('ske011-1', 'silla-de-espera-ref-ske011-1-saikang'),
      ('silla-de-espera-ske011-1', 'silla-de-espera-ref-ske011-1-saikang'),
      ('silla-de-espera-ske011-1-saikang', 'silla-de-espera-ref-ske011-1-saikang'),
      ('ske020-1', 'taburete-ref-ske020-1-saikang'),
      ('taburete-ske020-1', 'taburete-ref-ske020-1-saikang'),
      ('taburete-ske020-1-saikang', 'taburete-ref-ske020-1-saikang'),
      ('ske941', 'silla-reclinable-ref-ske941-saikang'),
      ('silla-reclinable-ske941', 'silla-reclinable-ref-ske941-saikang'),
      ('silla-reclinable-ske941-saikang', 'silla-reclinable-ref-ske941-saikang'),
      ('ske942', 'sillon-reclinable-ref-ske942-saikang'),
      ('sillon-reclinable-ske942', 'sillon-reclinable-ref-ske942-saikang'),
      ('sillon-reclinable-ske942-saikang', 'sillon-reclinable-ref-ske942-saikang'),
      ('skh042', 'mesa-de-sobrecama-ref-skh042-saikang'),
      ('mesa-de-sobrecama-skh042', 'mesa-de-sobrecama-ref-skh042-saikang'),
      ('mesa-de-sobrecama-skh042-saikang', 'mesa-de-sobrecama-ref-skh042-saikang'),
      ('skh046-11', 'mesa-de-sobrecama-ref-skh046-11-saikang'),
      ('skh046-2', 'mesita-de-noche-ref-skh046-2-saikang'),
      ('mesita-de-noche-skh046-2', 'mesita-de-noche-ref-skh046-2-saikang'),
      ('mesita-de-noche-skh046-2-saikang', 'mesita-de-noche-ref-skh046-2-saikang'),
      ('skh050', 'estanteria-hospitalaria-ref-skh050-saikang'),
      ('estanteria-hospitalaria-skh050', 'estanteria-hospitalaria-ref-skh050-saikang'),
      ('estanteria-hospitalaria-skh050-saikang', 'estanteria-hospitalaria-ref-skh050-saikang'),
      ('skh061', 'estanteria-hospitalaria-ref-skh061-saikang'),
      ('estanteria-hospitalaria-skh061', 'estanteria-hospitalaria-ref-skh061-saikang'),
      ('estanteria-hospitalaria-skh061-saikang', 'estanteria-hospitalaria-ref-skh061-saikang'),
      ('skh092', 'gabinete-de-almacenamiento-ref-skh092-saikang'),
      ('gabinete-de-almacenamiento-skh092', 'gabinete-de-almacenamiento-ref-skh092-saikang'),
      ('gabinete-de-almacenamiento-skh092-saikang', 'gabinete-de-almacenamiento-ref-skh092-saikang'),
      ('skm-a-skr-ib00', 'carro-de-abs-skr-ref-ib00-saikang'),
      ('skm-b-sk-ct75077c2', 'carrito-abs-sk-ref-ct75077c2-saikang'),
      ('skm-b-sk-et750', 'carro-abs-sk-ref-et750-saikang'),
      ('skm-b-sk-mt650', 'carro-abs-sk-ref-mt650-saikang'),
      ('skm-b-skh001', 'carro-de-acero-inoxidable-ref-skh001-saikang'),
      ('skm-b-skh004', 'carro-de-instrumental-ref-skh004-saikang'),
      ('skm-b-skh006-1', 'carro-de-instrumental-ref-skh006-saikang'),
      ('skm-b-skh006-5', 'carro-de-tratamientos-ref-skh006-5-saikang'),
      ('skm-b-skh029', 'carro-de-acero-inoxidable-ref-skh029-saikang'),
      ('skm-b-skh032', 'carrito-de-infusion-ref-skh032-saikang'),
      ('skm-b-skh041-5', 'carrito-de-lavado-ref-skh041-saikang'),
      ('skm-b-skh078', 'estanteria-de-acero-inoxidable-ref-skh078-saikang'),
      ('skm-b-skr-ct231', 'carro-abs-skr-ref-ct231-saikang'),
      ('skm-b-skr-ct750-1', 'carro-abs-skr-ref-ct750-1-saikang'),
      ('skm-b-skr-et850', 'carro-de-abs-skr-ref-et850-saikang'),
      ('skm-b-skr-iv588', 'carro-de-infusion-skr-ref-iv588-saikang'),
      ('skm-b-skr-mt625', 'carro-de-abs-skr-ref-mt625-saikang'),
      ('skm-b-skr002-3', 'carro-de-abs-ref-skr002-3-saikang'),
      ('skm-b-skr007', 'carro-abs-ref-skr007-saikang'),
      ('skm-b-skr054-at', 'carro-de-anestesia-ref-skr054-at-saikang'),
      ('skm-b-skr054-et', 'carro-de-emergencias-ref-skr054-et-saikang'),
      ('carro-clinico-ref-emergency-saikang', 'carro-de-emergencias-ref-skr054-et-saikang'),
      ('skm-b-skr054-mt', 'carro-de-medicamentos-ref-skr054-mt-saikang'),
      ('skm-c-skb037b', 'camilla-de-hospital-skb037-b-ref-skb037b-saikang'),
      ('skm-g-skb037c', 'camilla-para-pacientes-skb037-c-ref-skb037c-saikang'),
      ('skp001', 'colchon-ref-skp001-saikang'),
      ('colchon-skp001', 'colchon-ref-skp001-saikang'),
      ('skp011', 'colchon-viscoelastico-ref-skp011-saikang'),
      ('colchon-viscoelastico-skp011', 'colchon-viscoelastico-ref-skp011-saikang'),
      ('colchon-viscoelastico-skp011-saikang', 'colchon-viscoelastico-ref-skp011-saikang'),
      ('skr-at625-1', 'carro-de-anestesia-skr-ref-at625-1-saikang'),
      ('skr-at625-1-saikang', 'carro-de-anestesia-skr-ref-at625-1-saikang'),
      ('skr-it625', 'carro-de-infusion-skr-ref-it625-saikang'),
      ('carro-de-infusion-skr-it625', 'carro-de-infusion-skr-ref-it625-saikang'),
      ('carro-de-infusion-skr-it625-saikang', 'carro-de-infusion-skr-ref-it625-saikang'),
      ('skr058-ct', 'carro-de-enfermeria-ref-skr058-ct-saikang'),
      ('carro-de-enfermeria-skr058-ct', 'carro-de-enfermeria-ref-skr058-ct-saikang'),
      ('carro-de-enfermeria-skr058-ct-saikang', 'carro-de-enfermeria-ref-skr058-ct-saikang'),
      ('sks002', 'mesita-de-noche-ref-sks002-saikang'),
      ('mesita-de-noche-sks002', 'mesita-de-noche-ref-sks002-saikang'),
      ('mesita-de-noche-sks002-saikang', 'mesita-de-noche-ref-sks002-saikang'),
      ('sks002-w', 'mesita-de-noche-ref-sks002-w-saikang'),
      ('mesita-de-noche-sks002-w', 'mesita-de-noche-ref-sks002-w-saikang'),
      ('mesita-de-noche-sks002-w-saikang', 'mesita-de-noche-ref-sks002-w-saikang'),
      ('sks008', 'mesita-de-noche-ref-sks008-saikang'),
      ('mesita-de-noche-sks008', 'mesita-de-noche-ref-sks008-saikang'),
      ('mesita-de-noche-sks008-saikang', 'mesita-de-noche-ref-sks008-saikang'),
      ('sks009-2', 'mesita-de-noche-ref-sks009-2-saikang'),
      ('mesita-de-noche-sks009-2', 'mesita-de-noche-ref-sks009-2-saikang'),
      ('mesita-de-noche-sks009-2-saikang', 'mesita-de-noche-ref-sks009-2-saikang'),
      ('sks025', 'mesa-de-noche-hospitalaria-ref-sks025-saikang'),
      ('sks036', 'mesa-de-noche-ref-sks036-saikang'),
      ('mesa-de-noche-sks036', 'mesa-de-noche-ref-sks036-saikang'),
      ('mesa-de-noche-sks036-saikang', 'mesa-de-noche-ref-sks036-saikang'),
      ('sku-b1-skb2c01', 'camilla-de-ambulancia-ref-skb2c01-saikang'),
      ('sku-b1-skb2c01-saikang', 'camilla-de-ambulancia-ref-skb2c01-saikang'),
      ('skw-b2-skb1c02', 'silla-para-subir-escaleras-ref-skb1c02-1-saikang'),
      ('skw-b2-skb1c02-saikang', 'silla-para-subir-escaleras-ref-skb1c02-1-saikang'),
      ('sl-series', 'lampara-quirurgica-halogena-ref-sl-series-advanced'),
      ('lampara-quirurgica-halogena-sl-series', 'lampara-quirurgica-halogena-ref-sl-series-advanced'),
      ('lampara-quirurgica-halogena-sl-series-advanced', 'lampara-quirurgica-halogena-ref-sl-series-advanced'),
      ('st-100', 'camilla-manual-ref-st-100-advanced'),
      ('camilla-manual-st-100', 'camilla-manual-ref-st-100-advanced'),
      ('camilla-manual-st-100-advanced', 'camilla-manual-ref-st-100-advanced'),
      ('st-2000', 'camilla-para-pacientes-ref-st-2000-advanced'),
      ('camilla-para-pacientes-st-2000', 'camilla-para-pacientes-ref-st-2000-advanced'),
      ('camilla-para-pacientes-st-2000-advanced', 'camilla-para-pacientes-ref-st-2000-advanced'),
      ('t-max-6', 'autoclave-ref-t-max-6-tuttnauer'),
      ('t-max-6-tuttnauer', 'autoclave-ref-t-max-6-tuttnauer'),
      ('ref-t-max-6-tuttnauer', 'autoclave-ref-t-max-6-tuttnauer'),
      ('autoclave-t-6-ref-t-max-6-tuttnauer', 'autoclave-ref-t-max-6-tuttnauer'),
      ('taurus', 'monitor-multiparametro-ref-taurus-northern'),
      ('monitor-multiparametro-taurus', 'monitor-multiparametro-ref-taurus-northern'),
      ('monitor-multiparametro-taurus-northern', 'monitor-multiparametro-ref-taurus-northern'),
      ('tcq-iii', 'detector-plano-inalambrico-ref-tcq-iii-angell'),
      ('detector-plano-inalambrico-tcq-iii', 'detector-plano-inalambrico-ref-tcq-iii-angell'),
      ('detector-plano-inalambrico-tcq-iii-angell', 'detector-plano-inalambrico-ref-tcq-iii-angell'),
      ('tcs-200-rt', 'bascula-corporal-electronica-ref-tcs-200-rt-perlong'),
      ('bascula-corporal-electronica-tcs-200-rt', 'bascula-corporal-electronica-ref-tcs-200-rt-perlong'),
      ('bascula-corporal-electronica-tcs-200-rt-perlong', 'bascula-corporal-electronica-ref-tcs-200-rt-perlong'),
      ('tcs-200b-rt', 'balanza-corporal-electronica-ref-tcs-200b-rt-perlong'),
      ('test-de-pasarela-de-pagos', 'test'),
      ('torre-laparoscopia-4k-sonoscape-sv-m4k120', 'torre-laparoscopia-4k-sonoscape-ref-sv-m4k120'),
      ('v-1000', 'ventilador-para-uci-ref-v-1000-advanced'),
      ('ventilador-para-uci-v-1000', 'ventilador-para-uci-ref-v-1000-advanced'),
      ('ventilador-para-uci-v-1000-advanced', 'ventilador-para-uci-ref-v-1000-advanced'),
      ('ventilador-neonatal-pedriatrico-alta-frecuencia-convencional-ref-6000-sle', 'ventilador-neonatal-pediatrico-alta-frecuencia-plus-convencional-ref-6000-sle'),
      ('ventilador-neonatal-pedriatrico-convencional-ref-6000-ref-sle6000-sle', 'ventilador-neonatal-pedriatrico-convencional-ref-6000-sle'),
      ('venus', 'monitor-multiparametro-ref-venus-northern'),
      ('monitor-multiparametro-venus', 'monitor-multiparametro-ref-venus-northern'),
      ('monitor-multiparametro-venus-northern', 'monitor-multiparametro-ref-venus-northern'),
      ('virgo', 'monitor-modular-multiparametro-ref-virgo-northern'),
      ('monitor-modular-multiparametro-virgo', 'monitor-modular-multiparametro-ref-virgo-northern'),
      ('monitor-modular-multiparametro-virgo-northern', 'monitor-modular-multiparametro-ref-virgo-northern'),
      ('vp-50', 'bomba-de-infusion-ref-vp-50'),
      ('bomba-de-infusion-vp-50', 'bomba-de-infusion-ref-vp-50'),
      ('vsm-300', 'monitor-de-signos-vitales-ref-vsm-300-advanced'),
      ('monitor-de-signos-vitales-vsm-300', 'monitor-de-signos-vitales-ref-vsm-300-advanced'),
      ('monitor-de-signos-vitales-vsm-300-advanced', 'monitor-de-signos-vitales-ref-vsm-300-advanced'),
      ('wr-3d', 'sistema-radiografico-3d-wr-3d-angell-technology-ref-wr-3d-angell'),
      ('sistema-radiografico-3d-wr-3d-angell-technology', 'sistema-radiografico-3d-wr-3d-angell-technology-ref-wr-3d-angell'),
      ('yrbb-20', 'balanza-para-bebe-ref-yrbb-20-perlong'),
      ('balanza-para-bebe-yrbb-20', 'balanza-para-bebe-ref-yrbb-20-perlong'),
      ('balanza-para-bebe-yrbb-20-perlong', 'balanza-para-bebe-ref-yrbb-20-perlong'),
      ('zt-120', 'bascula-corporal-ref-zt-120-perlong'),
      ('bascula-corporal-zt-120', 'bascula-corporal-ref-zt-120-perlong'),
      ('bascula-corporal-zt-120-perlong', 'bascula-corporal-ref-zt-120-perlong'),
      ('zt-150a', 'bascula-corporal-ref-zt-150a-perlong'),
      ('bascula-corporal-zt-150a', 'bascula-corporal-ref-zt-150a-perlong'),
      ('bascula-corporal-zt-150a-perlong', 'bascula-corporal-ref-zt-150a-perlong'),
      ('g-kbe-622', 'silla-de-ruedas-estandar-en-acero-con-rin-estrella-22-de-45-7-cm-de-ancho-ref-kbe-622'),
      ('g-kbe-622fr', 'silla-de-ruedas-estandar-en-acero-con-rin-estrella-22-y-freno-de-asistencia-de-45-ref-kbe-622fr'),
      ('g-kp9071-18l', 'silla-de-ruedas-estandar-plus-aluminio-rin-radio-18l-ref-kp9071-18l'),
      ('g-kp9071-16l', 'silla-de-ruedas-estandar-plus-aluminio-rin-radio-16l-ref-kp9071-16l'),
      ('g-kp9071-18', 'silla-de-ruedas-activa-plegable-luna-de-45-7-cm-de-ancho-ref-kp9071-18'),
      ('g-kp9071-16', 'silla-de-ruedas-activa-plegable-luna-de-40-6-cm-de-ancho-ref-kp9071-16'),
      ('g-kp9031-18', 'silla-de-ruedas-iron-move-de-45-7-cm-de-ancho-ref-kp9031-18'),
      ('g-kp9031-20', 'silla-de-ruedas-iron-move-de-50-cm-de-ancho-ref-kp9031-20'),
      ('g-kp9065-12', 'silla-de-ruedas-pediatrica-en-aluminio-uva-de-30-4-cm-de-ancho-ref-kp9065-12'),
      ('g-kp9065-14', 'silla-de-ruedas-pediatrica-en-aluminio-uva-de-35-5-cm-de-ancho-ref-kp9065-14'),
      ('g-kp9031-14', 'silla-de-ruedas-en-acero-pediatrica-lima-de-35-5-cm-de-ancho-ref-kp9031-14'),
      ('g-kp9031-12', 'silla-de-ruedas-en-acero-pediatrica-lima-de-30-5-cm-de-ancho-ref-kp9031-12'),
      ('g-kp140-16', 'silla-de-ruedas-basculante-y-reclinable-de-40-6-cm-de-ancho-ref-kp140-16'),
      ('g-kp140-14', 'silla-de-ruedas-basculante-y-reclinable-enova-de-35-5-cm-de-ancho-ref-kp140-14'),
      ('g-kp-ii', 'silla-de-ruedas-activa-marco-rigido-oliva-16-ref-kp-ii'),
      ('g-kp285-al-19', 'caminador-con-ruedas-rollator-en-aluminio-con-reposapies-ref-kp285-al-19'),
      ('g-kp1-8160l', 'caminador-desarmable-en-aluminio-ref-kp1-8160l-konfort-plus'),
      ('g-cdk-222', 'compresor-nebulizador-carditek-bubu-ref-cdk-222'),
      ('g-cdk-195', 'compresor-nebulizador-zen-ref-cdk-195'),
      ('g-cdk-bpm-75b', 'tensiometro-digital-de-muneca-carditek-pulse-ref-cdk-bpm-75b'),
      ('g-cdk-bpm-66ep', 'tensiometro-digital-carditek-smart-ref-cdk-bpm-66ep'),
      ('g-cdk-bpm-65b', 'tensiometro-digital-carditek-power-ref-cdk-bpm-65b'),
      ('g-cdk-bpm-65r', 'tensiometro-digital-carditek-vital-ref-cdk-bpm-65r'),
      ('g-cdk-bd-2317w', 'balanza-digital-de-peso-corporal-carditek-ref-cdk-bd-2317w'),
      ('g-kbe-9119r', 'silla-de-ruedas-estandar-en-acero-color-rojo-de-46-cm-de-ancho-ref-kbe-9119r'),
      ('sistema-radiografico-3d-wr-3d', 'sistema-radiografico-3d-ref-wr-3d-angell'),
      ('sistema-radiografico-3d-wr-3d-angell', 'sistema-radiografico-3d-ref-wr-3d-angell'),
      ('g-kbe-9119a', 'silla-de-ruedas-estandar-en-acero-color-azul-de-46-cm-de-ancho-ref-kbe-9119a'),
      ('g-kbe-9119v', 'silla-de-ruedas-estandar-en-acero-color-verde-de-46-cm-de-ancho-ref-kbe-9119v'),
      ('telemando-digital-rf-talent-ii', 'telemando-digital-rf-ref-talent-ii-angell'),
      ('telemando-digital-rf-talent-ii-angell', 'telemando-digital-rf-ref-talent-ii-angell'),
      ('g-kbe-9000d', 'silla-de-ruedas-estandar-con-rin-estrella-kp-ref-kbe-9000d'),
      ('rx-multifuncional-uc-arm-dtp580', 'rx-multifuncional-uc-arm-ref-dtp580'),
      ('g-kpc-bd02', 'cama-electrica-3-funciones-ref-kpc-bd02'),
      ('g-kbe-982e', 'silla-de-ruedas-estandar-con-rin-estrella-de-46-cm-de-ancho-ref-kbe-982e'),
      ('g-ltd-b10-l', 'lancetas-para-glucometros-latidos-x-50-unidades-ref-ltd-b10-l'),
      ('g-ltd-b10-tr', 'tirillas-reactivas-para-el-glucometro-ltd-b10-x-50-unidades-ref-ltd-b10-tr'),
      ('g-ltd-b10', 'glucometro-latidos-ref-ltd-b10'),
      ('g-latidos-c', 'adaptador-ac-dc-para-tensiometro-latidos-ref-latidos-c'),
      ('g-gmrn-nb', 'nebulizador-para-compresor-nube-ref-gmrn-nb'),
      ('g-gmrn-235', 'compresor-nebulizador-nube-1000-figura-de-balon-de-futbol-ref-gmrn-235'),
      ('g-gmrn211-kitpe', 'kit-de-nebulizacion-pediatrico-nube-3000-ref-gmrn211-kitpe'),
      ('g-gmrn-222', 'compresor-nebulizador-nube-1000-figura-de-buho-ref-gmrn-222'),
      ('g-gmrn211-kita', 'kit-de-nebulizacion-adulto-nube-3000-ref-gmrn211-kita'),
      ('g-ltd-bd-260', 'balanza-con-monitor-de-grasa-latidos-ref-ltd-bd-260'),
      ('g-gmrn-211', 'compresor-nebulizador-nube-3000-plus-ref-gmrn-211'),
      ('compresor-nebulizador-nube-3000-plus', 'compresor-nebulizador-nube-3000-plus-ref-gmrn-211'),
      ('g-kp-parf-2', 'patas-en-aluminio-para-comodo-sanitario-kp-ref-kp-parf-2'),
      ('g-kp-bal-2', 'balde-para-comodo-sanitario-kp-ref-kp-bal-2'),
      ('g-kbe-9953', 'silla-de-ruedas-estandar-en-acero-reclinable-ref-kbe-9953-konfort-plus'),
      ('g-kbe-9953-iii', 'silla-de-ruedas-estandar-en-acero-bariatrica-de-56-5-cm-ref-kbe-9953-iii-konfort-plus'),
      ('g-kbe-9953-ii', 'silla-de-ruedas-estandar-en-acero-bariatrica-de-61-5-cm-ref-kbe-9953-ii-konfort-plus'),
      ('g-kbe-9125t', 'silla-de-ruedas-de-transporte-basica-en-acero-ref-kbe-9125t-konfort-plus'),
      ('g-kbe-9113', 'silla-de-ruedas-estandar-desarmable-en-acero-con-tapiceria-acolchada-ref-kbe-9113-konfort-plus'),
      ('g-kp1-8440', 'rollator-en-acero-con-reposapies-ref-kp1-8440'),
      ('g-kp1-8437', 'rollator-en-acero-ref-kp1-8437'),
      ('g-kp1-8437-1', 'rollator-en-acero-ref-kp1-8437-1'),
      ('g-kp1-8130g-5', 'caminador-doble-funcion-con-ruedas-ref-kp1-8130g-5'),
      ('g-kp1-8440-i', 'rollator-en-acero-ref-kp1-8440-i'),
      ('g-kbe-9110hc', 'silla-de-ruedas-ref-kbe-9110hc'),
      ('g-kp9806l', 'silla-de-ruedas-de-transporte-en-aluminio-tipo-avion-ref-kp9806l'),
      ('silla-de-ruedas-de-transporte-en-aluminio-tipo-avion', 'silla-de-ruedas-de-transporte-en-aluminio-tipo-avion-ref-kp9806l'),
      ('g-kpm-a8', 'silla-de-ruedas-motorizada-con-bateria-de-litio-de-44-5-cm-de-ancho-ref-kpm-a8'),
      ('g-kpm-a6', 'silla-de-ruedas-motorizada-en-acero-con-bateria-recargable-ref-kpm-a6'),
      ('g-kbe1432rf-mp23l-fr', 'frenos-para-kbe1432rf-mp23l-ref-kbe1432rf-mp23l-fr'),
      ('g-kbe1432rf-mp23l-llt', 'llanta-trasera-para-sdr-kbe1432rf-mp23l-ref-kbe1432rf-mp23l-llt'),
      ('g-kbe1432rf-mp23l-lld', 'llanta-delantera-para-kbe1432rf-mp23l-ref-kbe1432rf-mp23l-lld'),
      ('g-kbe1432rf-mp23l-as', 'asiento-para-kbe1432rf-mp23l-ref-kbe1432rf-mp23l-as'),
      ('g-kbe1432rf-mp23-rp', 'respaldo-para-kbe1432rf-mp23l-ref-kbe1432rf-mp23-rp'),
      ('g-kbo1432rf-mp23-rp', 'reposapies-para-sdr-kbo1432rf-mp23-ref-kbo1432rf-mp23-rp'),
      ('g-kbe-9630l', 'silla-de-ruedas-estandar-y-de-transporte-en-aluminio-ref-kbe-9630l-konfort-plus'),
      ('g-kb-ra', 'rodillera-universal-ref-kb-ra-konfort-plus'),
      ('g-desde-kbe1462ff-m23-d', 'deslizadores-delanteros-para-sdr-kbe1462ff-m23-d-ref-desde-kbe1462ff-m23-d'),
      ('g-des-kbe1462ff-m23-d', 'deslizadores-traseros-para-sdr-kbe1462ff-m23-d-ref-des-kbe1462ff-m23-d'),
      ('g-kb225cr-al19-srf', 'pata-con-rueda-sin-freno-en-aluminio-ref-kb225cr-al19-srf'),
      ('g-kb225cr-ap1-sfr', 'pata-con-rueda-sin-freno-color-blanco-ref-kb225cr-ap1-sfr'),
      ('g-kb3-2010', 'manilares-para-muletas-kp-ref-kb3-2010'),
      ('g-kb3-2001l', 'axilares-para-muletas-ref-kb3-2001l'),
      ('g-kp4-4t-d14', 'tapon-en-forma-de-x-4-apoyos-ref-kp4-4t-d14'),
      ('g-kp4819-21', 'baston-4-apoyos-con-linterna-ref-kp4819-21-konfort-plus'),
      ('g-gmr-sm181', 'aspirador-de-secreciones-portatil-ads100-ref-gmr-sm181'),
      ('g-gmrn846-kitmn', 'kit-de-nebulizacion-del-nube-5000-ref-gmrn846-kitmn'),
      ('g-gmrn846-kit', 'kit-de-nebulizacion-smart-del-nube-5000-ref-gmrn846-kit'),
      ('g-gmrn846', 'compresor-nebulizador-nube-5000-ref-gmrn846'),
      ('compresor-nebulizador-nube-5000', 'compresor-nebulizador-nube-5000-ref-gmrn846'),
      ('g-gmrn818-kitmn', 'kit-de-nebulizacion-del-nube-7000-ref-gmrn818-kitmn'),
      ('g-gmrn818-kit', 'clenny-kit-para-nube-7000-ref-gmrn818-kit'),
      ('g-kp4-4t-20d', 'recaton-color-negro-para-baston-de-4-apoyos-ref-kp4-4t-20d'),
      ('g-kp4-4t-19d', 'recaton-color-gris-para-baston-de-4-apoyos-ref-kp4-4t-19d'),
      ('g-kp4-1t-26d', 'recaton-color-cafe-para-baston-de-1-apoyo-ref-kp4-1t-26d'),
      ('g-kp4-1t-20d', 'recaton-color-negro-para-baston-de-1-apoyo-ref-kp4-1t-20d'),
      ('g-kbe1462ff-m23d-rst', 'rueda-delantera-sin-tenedor-ref-kbe1462ff-m23d-rst'),
      ('g-kb225cr-ap1-rf', 'pata-con-rueda-y-freno-en-acero-color-blanco-ref-kb225cr-ap1-rf'),
      ('g-jbs168-00-021', 'arnes-movil-para-grua-hidraulica-ref-jbs168-00-021'),
      ('g-srels-rpe', 'reposapies-elevables-para-sdr-iron-light-ref-srels-rpe'),
      ('g-kb225cr-ap1-ta', 'aro-y-tapa-para-comodo-sanitario-ref-kb225cr-ap1-ta'),
      ('g-kb215sr-al-b', 'balde-para-comodo-sanitario-ref-kb215sr-al-b'),
      ('g-kp4102-24', 'baston-con-empunadura-en-t-ergonomico-color-madera-nogal-ref-kp4102-24-konfort-plus'),
      ('g-kbo1432rf-mp23', 'silla-de-ruedas-de-transporte-en-acero-ref-kbo1432rf-mp23-konfort-plus'),
      ('g-kp2-6543cr-al19-r', 'respaldo-para-comodo-sanitario-kp-ref-kp2-6543cr-al19-r'),
      ('g-kp2-6542sr-tipn', 'tapon-para-comodo-kp2-6542sr-ref-kp2-6542sr-tipn'),
      ('g-kp2-6542sr-ap1-r', 'espaldar-para-comodo-sanitario-kp2-6542sr-ref-kp2-6542sr-ap1-r'),
      ('g-kp2-6542sr-ap1-a', 'asiento-para-comodo-sanitario-kp2-6542sr-ref-kp2-6542sr-ap1-a'),
      ('g-kbf-ab30-lxl', 'faja-abdominal-de-30-cm-talla-l-xl-ref-kbf-ab30-lxl'),
      ('g-kbe9119f', 'silla-de-ruedas-estandar-en-acero-con-apoyabrazos-abatibles-ref-kbe9119f-konfort-plus'),
      ('silla-de-ruedas-estandar-en-acero-con-apoyabrazos-abatibles-konfort-plus', 'silla-de-ruedas-estandar-en-acero-con-apoyabrazos-abatibles-ref-kbe9119f-konfort-plus'),
      ('g-kb225cr-ap1', 'comodo-sanitario-en-acero-pintado-con-ruedas-ref-kb225cr-ap1-konfort-plus'),
      ('g-srels-rpr', 'reposapies-removibles-para-sdr-iron-light-ref-srels-rpr'),
      ('g-srels-pad', 'pad-para-sdr-iron-light-ref-srels-pad'),
      ('g-srels-lt', 'llanta-trasera-para-sdr-iron-light-ref-srels-lt'),
      ('g-kbe1462re-p23l-rp', 'reposapies-elevables-para-sdr-kbe1462re-pp23l-ref-kbe1462re-p23l-rp'),
      ('g-kbe1462-fr', 'freno-para-sdr-estandar-color-gris-ref-kbe1462-fr'),
      ('g-kbe1462ff-m23d-a', 'asiento-para-sdr-kbe1462ff-m23-d-ref-kbe1462ff-m23d-a'),
      ('g-fs980la-35-a', 'asiento-para-silla-de-ruedas-pediatrica-ref-fs980la-35-a'),
      ('g-fs976abj-43-e', 'espaldar-en-nailon-para-silla-de-transporte-ref-fs976abj-43-e'),
      ('g-jbs168-00-1a', 'actuador-hidraulico-para-jbs168-1-ref-jbs168-00-1a'),
      ('g-jbs168-00-012', 'rueda-trasera-con-freno-de-4-para-grua-hidraulica-ref-jbs168-00-012-konfort-plus'),
      ('g-jbs168-00-011', 'rueda-delantera-de-4-para-grua-hidraulica-ref-jbs168-00-011-konfort-plus'),
      ('g-gmrn457-kitpe', 'kit-de-nebulizacion-pediatrico-nube-ref-gmrn457-kitpe'),
      ('g-gmrn457-kit', 'kit-de-nebulizacion-adulto-nube-ref-gmrn457-kit'),
      ('g-gmrn457-1f', 'filtro-par-compresor-nebulizador-panda-ref-gmrn457-1f'),
      ('g-gmrn457-12f', 'filtro-para-compresor-nebulizador-nube-3000-ref-gmrn457-12f'),
      ('g-kp4-1t-19d', 'recaton-color-gris-para-baston-de-1-apoyo-dc-ref-kp4-1t-19d'),
      ('g-kbe1462ff-m23d-rp', 'reposapies-para-sdr-kbe1452ff-m23-d-ref-kbe1462ff-m23d-rp'),
      ('g-kp1-816l-tip', 'tapon-para-caminador-kp1-816l-color-gris-ref-kp1-816l-tip'),
      ('g-kbo1432rf-mp23-rt', 'rueda-trasera-para-silla-de-transporte-ref-kbo1432rf-mp23-rt'),
      ('g-kbo1432rf-mp23-fr', 'frenos-para-sdr-kbo1432rf-mp23-ref-kbo1432rf-mp23-fr'),
      ('g-srels-44', 'silla-de-ruedas-iron-light-ancho-del-asiento-44-cm-y-reposapies-removi-ref-srels-44-konfort-plus'),
      ('g-kbe1462rr-pp23l', 'silla-de-ruedas-estandar-en-acero-con-reposapies-y-apoyabrazos-ref-kbe1462rr-pp23l-konfort-plus'),
      ('g-kbe1462ff-m23-d', 'silla-de-ruedas-estandar-desarmable-en-acero-con-tapiceria-en-p-ref-kbe1462ff-m23-d-konfort-plus'),
      ('g-kbe1432rf-mp23l', 'silla-de-ruedas-de-transporte-en-aluminio-ref-kbe1432rf-mp23l-konfort-plus'),
      ('g-gmr870-015', 'regulador-para-valvulas-gmr870-ref-gmr870-015'),
      ('g-kit1', 'kit-1-de-oxigeno-con-cilindro-de-680-l-ref-kit1'),
      ('kit-1-de-oxigeno-con-cilindro-de-680-l', 'kit-1-de-oxigeno-con-cilindro-de-680-l-ref-kit1'),
      ('g-kit-2', 'de-oxigeno-con-cilindro-de-416-l-ref-kit-2'),
      ('g-me-2015', 'cilindro-de-oxigeno-680-l-ref-me-2015'),
      ('g-md15-015', 'cilindro-de-oxigeno-416-l-ref-md15-015'),
      ('g-150-0100', 'carra-para-cilindro-680-l-ref-150-0100'),
      ('carra-para-cilindro-680-l', 'carra-para-cilindro-680-l-ref-150-0100'),
      ('g-gmrn457-183', 'compresor-nebulizador-nube-1000-con-diseno-de-pez-payaso-ref-gmrn457-183'),
      ('g-gmrn457-171', 'compresor-nebulizador-nube-1000-con-diseno-de-perro-ref-gmrn457-171'),
      ('g-gmrn457-12', 'compresor-nebulizador-nube-3000-ref-gmrn457-12'),
      ('g-kb311s-al19', 'muleta-convencional-en-aluminio-talla-s-ref-kb311s-al19-konfort-plus'),
      ('g-kb311m-al19', 'muleta-convencional-en-aluminio-talla-m-ref-kb311m-al19-konfort-plus'),
      ('g-kb311l-al19', 'muleta-convencional-en-aluminio-talla-l-ref-kb311l-al19-konfort-plus'),
      ('g-kp3-856m-19', 'muleta-canadiense-doble-regulacion-talla-m-ref-kp3-856m-19-konfort-plus'),
      ('g-kp3-856l-19', 'muleta-canadiense-doble-regulacion-talla-l-ref-kp3-856l-19-konfort-plus'),
      ('g-kp321-al-19', 'muleta-canadiense-adulto-integral-color-plata-ref-kp321-al-19-konfort-plus'),
      ('g-kp1-816l-19', 'caminador-stand-up-doble-funcion-ref-kp1-816l-19-konfort-plus'),
      ('g-kp1-8150l3', 'caminador-doble-funcion-ref-kp1-8150l3'),
      ('g-kp1-8120l', 'caminador-doble-funcion-en-bronce-ref-kp1-8120l-konfort-plus'),
      ('g-kp1342al-19', 'caminador-doble-funcion-ref-kp1342al-19'),
      ('g-kp271-al-2', 'rollator-en-aluminio-ref-kp271-al-2-konfort-plus'),
      ('g-kp153-al-19', 'caminador-con-ruedas-de-5-en-aluminio-color-gris-ref-kp153-al-19-konfort-plus'),
      ('g-kp153-al-12', 'caminador-con-ruedas-de-5-en-aluminio-color-azul-ref-kp153-al-12-konfort-plus'),
      ('g-hy5', 'caminador-5-funciones-ref-hy5'),
      ('caminador-5-funciones-hy5', 'caminador-5-funciones-ref-hy5'),
      ('g-kp4-832l6-20', 'baston-para-invidente-plegable-ref-kp4-832l6-20-konfort-plus'),
      ('g-kp4-76085-28', 'baston-plegable-con-empunadura-en-t-color-bronce-ref-kp4-76085-28-konfort-plus'),
      ('g-kp4-76085-22', 'baston-plegable-con-empunadura-en-t-color-cromo-ref-kp4-76085-22-konfort-plus'),
      ('g-kp4-76085-20', 'baston-plegable-con-empunadura-en-t-color-negro-ref-kp4-76085-20-konfort-plus'),
      ('g-kp4192-28', 'baston-tipo-paraguas-color-bronce-ref-kp4192-28-konfort-plus'),
      ('g-kp4192-22', 'baston-tipo-paraguas-color-cromo-ref-kp4192-22-konfort-plus'),
      ('g-kp4192-20', 'baston-tipo-paraguas-color-negro-ref-kp4192-20-konfort-plus'),
      ('g-kp4152-28', 'baston-cuello-de-cisne-y-correa-de-seguridad-color-bronce-ref-kp4152-28-konfort-plus'),
      ('g-kp4152-22', 'baston-cuello-de-cisne-y-correa-de-seguridad-color-cromo-ref-kp4152-22-konfort-plus'),
      ('g-kp4152-20', 'baston-cuello-de-cisne-y-correa-de-seguridad-color-negro-ref-kp4152-20-konfort-plus'),
      ('g-kp4102-28', 'baston-con-empunadura-en-t-ergonomico-color-bronce-ref-kp4102-28-konfort-plus'),
      ('g-kp4102-22', 'baston-con-empunadura-en-t-ergonomico-color-cromo-ref-kp4102-22-konfort-plus'),
      ('g-kp4102-20', 'baston-con-empunadura-en-t-ergonomico-color-negro-ref-kp4102-20-konfort-plus'),
      ('g-kp4202-28', 'baston-4-apoyos-base-pequena-color-bronce-ref-kp4202-28-konfort-plus'),
      ('g-kp4202-22', 'baston-4-apoyos-base-pequena-color-cromo-ref-kp4202-22-konfort-plus'),
      ('g-kp4202-20', 'baston-4-apoyos-base-pequena-color-negro-ref-kp4202-20-konfort-plus'),
      ('g-kbc-aa', 'cabestrillo-adulto-color-azul-profundo-ref-kbc-aa-konfort-plus'),
      ('g-kpsempa2g1-27', 'superficie-especial-para-el-manejo-de-la-presion-semp-i-ref-kpsempa2g1-27-konfort-plus'),
      ('g-kbf-camp-sm', 'faja-lumbo-sacra-tipo-camp-talla-s-m-ref-kbf-camp-sm'),
      ('g-kbf-camp-lxl', 'faja-lumbo-sacra-tipo-camp-talla-l-xl-ref-kbf-camp-lxl'),
      ('g-kbf-ab30-sm', 'faja-abdominal-de-30-cm-talla-s-m-ref-kbf-ab30-sm'),
      ('g-kbf-ab23-sm', 'faja-abdominal-de-23-cm-talla-s-m-ref-kbf-ab23-sm'),
      ('g-kbf-ab23-lxl', 'faja-abdominal-de-23-cm-talla-l-xl-ref-kbf-ab23-lxl'),
      ('g-kbc-pa', 'cabestrillo-pediatrico-color-azul-ref-kbc-pa-konfort-plus'),
      ('g-kp1-3520l', 'silla-para-ducha-con-brazos-ref-kp1-3520l-konfort-plus'),
      ('g-kb2-798l-t', 'tapon-para-silla-ducha-kb2-798l-ref-kb2-798l-t'),
      ('g-kp2-6543cr-al19', 'comodo-sanitario-en-aluminio-anodizado-con-ruedas-de-120-kg-ref-kp2-6543cr-al19-konfort-plus'),
      ('g-kb225cr-al19', 'comodo-sanitario-en-aluminio-anodizado-con-ruedas-ref-kb225cr-al19-konfort-plus'),
      ('g-kb215sr-al', 'comodo-sanitario-en-aluminio-anodizado-ref-kb215sr-al-konfort-plus'),
      ('g-jbs168-1', 'grua-hidraulica-ref-jbs168-1-konfort-plus'),
      ('g-kp3-67034', 'eleva-sanitario-con-seguro-y-apoyabrazos-ref-kp3-67034-konfort-plus'),
      ('g-kp68083', 'barra-de-seguridad-tamano-60-96-cm-ref-kp68083-konfort-plus'),
      ('barra-de-seguridad-tamano-60-96-cm-konfort-plus', 'barra-de-seguridad-tamano-60-96-cm-ref-kp68083-konfort-plus'),
      ('g-kp68082', 'barra-de-seguridad-tamano-45-72-cm-ref-kp68082-konfort-plus'),
      ('barra-de-seguridad-tamano-45-72-cm-konfort-plus', 'barra-de-seguridad-tamano-45-72-cm-ref-kp68082-konfort-plus'),
      ('g-kp68081', 'barra-de-seguridad-tamano-40-64-cm-ref-kp68081-konfort-plus'),
      ('barra-de-seguridad-tamano-40-64-cm-konfort-plus', 'barra-de-seguridad-tamano-40-64-cm-ref-kp68081-konfort-plus'),
      ('g-kp68080', 'barra-de-seguridad-tamano-30-48-cm-ref-kp68080-konfort-plus'),
      ('barra-de-seguridad-tamano-30-48-cm-konfort-plus', 'barra-de-seguridad-tamano-30-48-cm-ref-kp68080-konfort-plus'),
      ('g-jpd-fr202', 'termometro-digital-de-frente-ref-jpd-fr202'),
      ('g-gmr540-mdk-001', 'empaque-para-regulador-de-valvulas-gmr-ref-gmr540-mdk-001'),
      ('g-kb215sr-al-tip', 'tapon-para-comodo-sanitario-ref-kb215sr-al-tip'),
      ('g-kb215sr-al-leg', 'pata-para-comodo-sanitario-en-aluminio-ref-kb215sr-al-leg'),
      ('g-fs696-rf', 'llanta-con-freno-para-comodo-sanitario-ref-fs696-rf'),
      ('g-fs696-r', 'llanta-sin-freno-para-comodo-sanitario-ref-fs696-r'),
      ('g-ltd-b10-600', 'combo-600-cajas-de-tirillas-plus-600-cajas-de-lancetas-plus-200-glucometros-en-o-ref-ltd-b10-600'),
      ('combo-600-cajas-de-tirillas-plus-600-cajas-de-lancetas-plus-200-glucometros-en-obsequio', 'combo-600-cajas-de-tirillas-plus-600-cajas-de-lancetas-plus-200-glucometros-en-o-ref-ltd-b10-600'),
      ('g-ltd-b10-200', 'combo-cajas-de-tirillas-plus-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ref-200'),
      ('combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio', 'combo-cajas-de-tirillas-plus-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ref-200'),
      ('gmd-ltd-b10-200', 'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200'),
      ('combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ee958bf4-f926-4d', 'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200'),
      ('g-ltd-b10-100', 'combo-cajas-de-tirillas-plus-cajas-de-lancetas-plus-25-glucometros-en-obsequio-ref-100'),
      ('combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio', 'combo-cajas-de-tirillas-plus-cajas-de-lancetas-plus-25-glucometros-en-obsequio-ref-100'),
      ('gmd-ltd-b10-100', 'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100'),
      ('combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-75e09b13-8a2a-48', 'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100'),
      ('g-ltd-b10-50', 'combo-50-cajas-de-tirillas-plus-50-cajas-de-lancetas-plus-10-glucometros-en-obseq-ref-ltd-b10-50'),
      ('combo-50-cajas-de-tirillas-plus-50-cajas-de-lancetas-plus-10-glucometros-en-obsequio', 'combo-50-cajas-de-tirillas-plus-50-cajas-de-lancetas-plus-10-glucometros-en-obseq-ref-ltd-b10-50'),
      ('g-ltd-b10-k', 'kit-de-glucometria-basic-latidos-ref-ltd-b10-k'),
      ('padbot-x3-robot-recepcion', 'padbot-x3-robot-recepcion-ref-padbot-x3-padbot'),
      ('padbot-x2-robot-servicio-interactivo', 'padbot-x2-robot-servicio-interactivo-ref-padbot-x2-padbot'),
      ('padbot-p2-robot-telepresencia', 'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot'),
      ('padbot-w2-robot-delivery-institucional', 'padbot-w2-robot-delivery-institucional-ref-padbot-w2-padbot'),
      ('padbot-w3s-robot-delivery-alimentos', 'padbot-w3s-robot-delivery-alimentos-ref-padbot-w3s-padbot'),
      ('c3-robot-limpieza-autonoma', 'c3-robot-limpieza-autonoma-ref-c3-cleaning-robot'),
      ('padbot-t2-robot-educativo-social', 'padbot-t2-robot-educativo-social-ref-padbot-t2-padbot'),
      ('cruzr-robot-comercial-inteligente-ahuman-future', 'cruzr-robot-comercial-inteligente-ref-cruzr-ahuman-future-ahuman-future'),
      ('saikang-a048', 'mesa-de-examen-ginecologico-ref-a048-saikang'),
      ('saikang-a302', 'mesa-quirurgica-electrica-ref-a302-saikang'),
      ('saikang-a307', 'mesa-quirurgica-electrohidraulica-ref-a307-saikang'),
      ('saikang-a99-5', 'cama-obstetrica-electrica-ref-a99-5-saikang'),
      ('saikang-a99-7', 'cama-obstetrica-electrica-ref-a99-7-saikang'),
      ('saikang-ainno-l21', 'columna-medica-de-techo-ref-ainno-l21-saikang'),
      ('columna-medica-de-techo-ref-ainno-saikang', 'columna-medica-de-techo-ref-ainno-l21-saikang'),
      ('saikang-ainno-light-m', 'lampara-quirurgica-ref-ainno-light-m-saikang'),
      ('lampara-quirurgica-ref-ainno-saikang', 'lampara-quirurgica-ref-ainno-light-m-saikang'),
      ('saikang-ainno-light10', 'lampara-quirurgica-ref-ainno-light10-saikang'),
      ('lampara-quirurgica-ref-ainno-saikang-ainno-light10-led-operating-lamp', 'lampara-quirurgica-ref-ainno-light10-saikang'),
      ('saikang-ainno-light20', 'lampara-quirurgica-ref-ainno-light20-saikang'),
      ('lampara-quirurgica-ref-ainno-saikang-ainno-light20-led-operating-lamp', 'lampara-quirurgica-ref-ainno-light20-saikang'),
      ('saikang-ainno-x22', 'columna-medica-de-techo-ref-ainno-x22-saikang'),
      ('columna-medica-de-techo-ref-ainno-saikang-ainno-x22-double-arm-pendant', 'columna-medica-de-techo-ref-ainno-x22-saikang'),
      ('saikang-ainno-x71', 'columna-medica-de-techo-ref-ainno-x71-saikang'),
      ('columna-medica-de-techo-ref-ainno-saikang-ainno-x71-icu-medical-bridge-ceiling-pendant', 'columna-medica-de-techo-ref-ainno-x71-saikang'),
      ('saikang-d8d-cpr', 'cama-uci-electrica-ref-d8d-cpr-saikang'),
      ('saikang-skb041-3-backrest-x-ray', 'camilla-de-traslado-con-radiografia-de-respaldo-ref-skb041-3-saikang'),
      ('camilla-de-traslado-ref-skb041-3-saikang', 'camilla-de-traslado-con-radiografia-de-respaldo-ref-skb041-3-saikang'),
      ('saikang-skb041-3-whole-body-x-ray', 'camilla-de-traslado-con-radiografia-de-cuerpo-completo-ref-skb041-3-saikang'),
      ('camilla-de-traslado-ref-skb041-3-saikang-skb041-3-patient-transportation-trolley-with-whole-body-x-ray', 'camilla-de-traslado-con-radiografia-de-cuerpo-completo-ref-skb041-3-saikang'),
      ('saikang-skb041-7-backrest-x-ray', 'camilla-de-traslado-con-radiografia-de-respaldo-ref-skb041-7-saikang'),
      ('camilla-de-traslado-ref-skb041-7-saikang', 'camilla-de-traslado-con-radiografia-de-respaldo-ref-skb041-7-saikang'),
      ('saikang-skb041-7-whole-body-x-ray', 'camilla-de-traslado-con-radiografia-de-cuerpo-completo-ref-skb041-7-saikang'),
      ('camilla-de-traslado-ref-skb041-7-saikang-skb041-7-patient-transportation-trolley-with-whole-body-x-ray', 'camilla-de-traslado-con-radiografia-de-cuerpo-completo-ref-skb041-7-saikang'),
      ('saikang-ske-136', 'sillon-de-dialisis-ref-ske-136-saikang'),
      ('saikang-ske091', 'sillon-para-donacion-de-sangre-ref-ske091-saikang'),
      ('saikang-skh046-14', 'mesa-de-sobrecama-ref-skh046-14-saikang'),
      ('saikang-skh046-26', 'mesa-de-sobrecama-ref-skh046-26-saikang'),
      ('saikang-sks02-w', 'mesa-de-noche-hospitalaria-ref-sks02-w-saikang'),
      ('saikang-sks03-w', 'mesa-de-noche-hospitalaria-ref-sks03-w-saikang'),
      ('saikang-v6k', 'cama-hospitalaria-electrica-ref-v6k-saikang'),
      ('cama-hospitalaria-ref-v6k-saikang', 'cama-hospitalaria-electrica-ref-v6k-saikang'),
      ('saikang-v8v', 'cama-uci-electrica-ref-v8v-saikang'),
      ('saikang-x09', 'mesa-de-examen-clinica-ref-x09-saikang'),
      ('saikang-x14', 'mesa-de-examen-hidraulica-ref-x14-saikang'),
      ('mesa-de-examen-clinica-ref-x14-saikang', 'mesa-de-examen-hidraulica-ref-x14-saikang'),
      ('saikang-y8t', 'cama-uci-electrica-ref-y8t-saikang'),
      ('saikang-sk-hd04', 'cama-electrica-para-cuidado-domiciliario-ref-sk-hd04-saikang'),
      ('saikang-sk-hd03', 'cama-electrica-para-cuidado-domiciliario-ref-sk-hd03-saikang'),
      ('saikang-sk-hd02', 'cama-electrica-para-cuidado-domiciliario-ref-sk-hd02-saikang'),
      ('saikang-cq2k', 'cama-pediatrica-ref-cq2k-saikang'),
      ('saikang-cr2q', 'cama-pediatrica-ref-cr2q-saikang'),
      ('saikang-cr2q5s', 'cama-pediatrica-ref-cr2q5s-saikang'),
      ('saikang-cx2x', 'cama-pediatrica-ref-cx2x-saikang'),
      ('saikang-sk-chd01', 'cama-pediatrica-ref-sk-chd01-saikang'),
      ('saikang-cr0q', 'cama-pediatrica-ref-cr0q-saikang'),
      ('saikang-am061t-1', 'mesa-quirurgica-ref-am061t-1-saikang'),
      ('saikang-am052c-1', 'mesa-quirurgica-ref-am052c-1-saikang'),
      ('saikang-q5k', 'equipo-hospitalario-ref-q5k-saikang'),
      ('saikang-sk-pb021', 'cama-hospitalaria-electrica-ref-sk-pb021-saikang'),
      ('mesa-de-terapia-espinal-ref-sk-pb021-saikang', 'cama-hospitalaria-electrica-ref-sk-pb021-saikang'),
      ('saikang-sk-pb023', 'cama-hospitalaria-electrica-ref-sk-pb023-saikang'),
      ('mesa-de-terapia-espinal-ref-sk-pb023-saikang', 'cama-hospitalaria-electrica-ref-sk-pb023-saikang'),
      ('saikang-sk-pb018', 'mesa-de-terapia-espinal-ref-sk-pb018-saikang'),
      ('saikang-sk-pb025', 'mesa-de-terapia-espinal-ref-sk-pb025-saikang'),
      ('saikang-x26', 'mesa-de-examen-clinica-ref-x26-saikang'),
      ('saikang-am061t-2', 'mesa-quirurgica-ref-am061t-2-saikang'),
      ('saikang-x42', 'mesa-de-examen-clinica-ref-x42-saikang'),
      ('saikang-x36-1', 'mesa-de-examen-clinica-ref-x36-1-saikang'),
      ('saikang-x36', 'mesa-de-examen-clinica-ref-x36-saikang'),
      ('saikang-sk-hd05', 'cama-electrica-para-cuidado-domiciliario-ref-sk-hd05-saikang'),
      ('saikang-x41', 'mesa-de-examen-clinica-ref-x41-saikang'),
      ('saikang-x07a', 'mesa-de-examen-clinica-ref-x07a-saikang'),
      ('saikang-x20', 'equipo-hospitalario-ref-x20-saikang'),
      ('saikang-sdl-d0313', 'esterilizador-de-vapor-ref-sdl-d0313-saikang'),
      ('saikang-d7d8y-cpr-cz', 'cama-hospitalaria-electrica-ref-d7d8y-cpr-cz-saikang'),
      ('saikang-skd-a', 'cama-hospitalaria-electrica-ref-skd-a-saikang'),
      ('cama-hospitalaria-ref-skd-a-saikang', 'cama-hospitalaria-electrica-ref-skd-a-saikang'),
      ('saikang-skd-b', 'cama-hospitalaria-electrica-ref-skd-b-saikang'),
      ('cama-hospitalaria-ref-skd-b-saikang', 'cama-hospitalaria-electrica-ref-skd-b-saikang'),
      ('saikang-sdl-d0450', 'carro-informatico-clinico-ref-sdl-d0450-saikang'),
      ('saikang-sk-at75077a2', 'carro-de-anestesia-ref-sk-at75077a2-saikang'),
      ('saikang-skr051-et', 'carro-de-emergencias-ref-skr051-et-saikang'),
      ('saikang-sk-eh302', 'ventilador-medico-ref-sk-eh302-saikang'),
      ('saikang-sk-eh303', 'ventilador-medico-ref-sk-eh303-saikang'),
      ('saikang-x35', 'mesa-de-examen-clinica-ref-x35-saikang'),
      ('saikang-sk-em001', 'monitor-de-paciente-ref-sk-em001-saikang'),
      ('saikang-sk-em005', 'monitor-de-paciente-ref-sk-em005-saikang'),
      ('saikang-sk-em006', 'monitor-fetal-ref-sk-em006-saikang'),
      ('saikang-sk-em201', 'bomba-de-jeringa-ref-sk-em201-saikang'),
      ('saikang-sk-em103', 'electrocardiografo-ref-sk-em103-saikang'),
      ('saikang-sk-em215', 'bomba-de-infusion-ref-sk-em215-saikang'),
      ('saikang-sk-em402', 'monitor-de-paciente-ref-sk-em402-saikang'),
      ('saikang-sk-em401', 'monitor-de-paciente-ref-sk-em401-saikang'),
      ('saikang-sk-em403', 'monitor-de-paciente-ref-sk-em403-saikang'),
      ('saikang-sk-em404', 'monitor-de-paciente-ref-sk-em404-saikang'),
      ('saikang-skr-mt606', 'carro-de-medicamentos-ref-skr-mt606-saikang'),
      ('saikang-sk-ex122', 'aspirador-medico-ref-sk-ex122-saikang'),
      ('saikang-skr-ct232', 'carro-clinico-ref-skr-ct232-saikang'),
      ('saikang-sk-ex121', 'equipo-hospitalario-ref-sk-ex121-saikang'),
      ('saikang-skr-et625', 'carro-de-anestesia-ref-skr-et625-saikang'),
      ('saikang-a2000', 'mesa-quirurgica-electrica-ref-a2000-saikang'),
      ('saikang-sk-et75077a', 'carro-de-emergencias-ref-sk-et75077a-saikang'),
      ('saikang-a202', 'equipo-hospitalario-ref-a202-saikang'),
      ('saikang-a301', 'mesa-quirurgica-electrica-ref-a301-saikang'),
      ('saikang-a306', 'mesa-quirurgica-electrica-ref-a306-saikang'),
      ('saikang-a98-3', 'cama-obstetrica-electrica-ref-a98-3-saikang'),
      ('saikang-a501', 'mesa-quirurgica-electrohidraulica-ref-a501-saikang'),
      ('saikang-a98-4', 'cama-obstetrica-electrica-ref-a98-4-saikang'),
      ('saikang-a99-13', 'cama-obstetrica-electrica-ref-a99-13-saikang'),
      ('saikang-sk-em211', 'bomba-de-infusion-ref-sk-em211-saikang'),
      ('saikang-skr058-mt', 'carro-de-anestesia-ref-skr058-mt-saikang'),
      ('saikang-sk-lld7050z', 'lampara-quirurgica-ref-sk-lld7050z-saikang'),
      ('saikang-skr021-5', 'carro-clinico-ref-skr021-5-saikang'),
      ('saikang-sk-lly700z', 'lampara-quirurgica-ref-sk-lly700z-saikang'),
      ('saikang-sk-lly400z', 'lampara-de-examen-ref-sk-lly400z-saikang'),
      ('saikang-skr-ab00', 'carro-informatico-clinico-ref-skr-ab00-saikang'),
      ('saikang-skr-a01', 'carro-informatico-clinico-ref-skr-a01-saikang'),
      ('saikang-skr-r07', 'carro-informatico-clinico-ref-skr-r07-saikang'),
      ('saikang-z7z', 'cama-uci-ref-z7z-saikang'),
      ('saikang-c8c', 'cama-uci-electrica-ref-c8c-saikang'),
      ('saikang-y8y8t', 'cama-uci-electrica-ref-y8y8t-saikang'),
      ('saikang-sk-tl011', 'equipo-hospitalario-ref-sk-tl011-saikang'),
      ('saikang-y8y8c', 'cama-uci-electrica-ref-y8y8c-saikang'),
      ('saikang-d8d', 'cama-hospitalaria-electrica-ref-d8d-saikang'),
      ('cama-hospitalaria-ref-d8d-saikang', 'cama-hospitalaria-electrica-ref-d8d-saikang'),
      ('saikang-v6v', 'cama-hospitalaria-electrica-ref-v6v-saikang'),
      ('saikang-x9x', 'cama-uci-electrica-ref-x9x-saikang'),
      ('saikang-x01-5', 'cuna-hospitalaria-ref-x01-5-saikang'),
      ('saikang-sk-a2', 'cama-hospitalaria-ref-sk-a2-saikang'),
      ('saikang-x01', 'cuna-hospitalaria-ref-x01-saikang'),
      ('saikang-sk-a3', 'cama-hospitalaria-ref-sk-a3-saikang'),
      ('saikang-a100-4', 'mesa-quirurgica-electrica-ref-a100-4-saikang'),
      ('saikang-a100-4a', 'mesa-quirurgica-electrica-ref-a100-4a-saikang'),
      ('saikang-a105', 'mesa-de-examen-ginecologico-u-obstetrico-ref-a105-saikang'),
      ('saikang-a106-5', 'mesa-quirurgica-electrohidraulica-ref-a106-5-saikang'),
      ('saikang-gb8e', 'cama-hospitalaria-electrica-ref-gb8e-saikang'),
      ('saikang-skb041-10', 'camilla-de-traslado-ref-skb041-10-saikang'),
      ('saikang-skr-r03', 'carro-informatico-clinico-ref-skr-r03-saikang'),
      ('saikang-skr-r10', 'carro-clinico-ref-skr-r10-saikang'),
      ('saikang-skb041-2', 'camilla-de-traslado-ref-skb041-2-saikang'),
      ('saikang-skb041', 'carro-clinico-ref-skb041-saikang'),
      ('saikang-skr-r12-computer', 'carro-informatico-clinico-ref-skr-r12-computer-saikang'),
      ('saikang-cd3q', 'cama-pediatrica-ref-cd3q-saikang'),
      ('saikang-skb041-3s', 'camilla-de-traslado-ref-skb041-3s-saikang'),
      ('saikang-skb037', 'camilla-de-traslado-ref-skb037-saikang'),
      ('saikang-skb038-2', 'camilla-de-traslado-ref-skb038-2-saikang'),
      ('saikang-skb039', 'camilla-de-traslado-ref-skb039-saikang'),
      ('saikang-skb038-4', 'camilla-de-traslado-ref-skb038-4-saikang'),
      ('saikang-skk-b', 'camilla-de-traslado-ref-skk-b-saikang'),
      ('saikang-skb1a04', 'camilla-plegable-ref-skb1a04-saikang'),
      ('saikang-skb1c10', 'camilla-para-escaleras-ref-skb1c10-saikang'),
      ('saikang-v8w5c', 'cama-hospitalaria-electrica-ref-v8w5c-saikang'),
      ('saikang-ske087', 'sillon-hospitalario-ref-ske087-saikang'),
      ('saikang-ske001-10', 'equipo-hospitalario-ref-ske001-10-saikang'),
      ('saikang-ske001-16', 'equipo-hospitalario-ref-ske001-16-saikang'),
      ('saikang-ske001-5', 'sillon-hospitalario-ref-ske001-5-saikang'),
      ('saikang-ske011-2', 'sillon-hospitalario-ref-ske011-2-saikang'),
      ('saikang-se802', 'sillon-odontologico-ref-se802-saikang'),
      ('saikang-ske011-6', 'sillon-hospitalario-ref-ske011-6-saikang'),
      ('saikang-ske013-10', 'silla-clinica-ref-ske013-10-saikang'),
      ('saikang-ske015-2', 'silla-clinica-ref-ske015-2-saikang'),
      ('saikang-ske015-4', 'silla-clinica-ref-ske015-4-saikang'),
      ('saikang-ske801', 'silla-clinica-ref-ske801-saikang'),
      ('saikang-ske801-2', 'silla-clinica-ref-ske801-2-saikang'),
      ('saikang-ske802', 'sillon-odontologico-ref-ske802-saikang'),
      ('saikang-ske052', 'sillon-clinico-ref-ske052-saikang'),
      ('saikang-ske711', 'sillon-clinico-ref-ske711-saikang'),
      ('saikang-ske055-8', 'sillon-clinico-ref-ske055-8-saikang'),
      ('saikang-ske088', 'sillon-clinico-ref-ske088-saikang'),
      ('saikang-ske180', 'silla-de-ruedas-ref-ske180-saikang'),
      ('saikang-ske691', 'silla-de-ruedas-ref-ske691-saikang'),
      ('saikang-ske697', 'silla-de-ruedas-ref-ske697-saikang'),
      ('saikang-ske030', 'silla-de-ruedas-ref-ske030-saikang'),
      ('saikang-ske015-5', 'silla-clinica-ref-ske015-5-saikang'),
      ('saikang-skh002', 'carro-clinico-ref-skh002-saikang'),
      ('saikang-skh005', 'carro-de-instrumental-ref-skh005-saikang'),
      ('saikang-skh006c', 'carro-de-instrumental-ref-skh006c-saikang'),
      ('saikang-k6k', 'cama-hospitalaria-electrica-ref-k6k-saikang'),
      ('saikang-k3k', 'cama-hospitalaria-manual-ref-k3k-saikang'),
      ('saikang-v3k', 'cama-hospitalaria-manual-ref-v3k-saikang'),
      ('saikang-k3k5s', 'cama-hospitalaria-manual-ref-k3k5s-saikang'),
      ('saikang-v3v5c', 'cama-hospitalaria-manual-ref-v3v5c-saikang'),
      ('saikang-v4w', 'cama-hospitalaria-manual-ref-v4w-saikang'),
      ('saikang-sk-hd01', 'cama-electrica-para-cuidado-domiciliario-ref-sk-hd01-saikang'),
      ('saikang-skh042-5', 'mesa-de-sobrecama-ref-skh042-5-saikang'),
      ('saikang-skh046-1', 'equipo-hospitalario-ref-skh046-1-saikang'),
      ('saikang-skh048', 'carro-clinico-ref-skh048-saikang'),
      ('saikang-sk-cl001', 'cortina-medica-ref-sk-cl001-saikang'),
      ('saikang-sk-cl514', 'cortina-medica-ref-sk-cl514-saikang'),
      ('saikang-skeo52', 'sillon-clinico-ref-skeo52-saikang'),
      ('saikang-skh049', 'equipo-hospitalario-ref-skh049-saikang'),
      ('saikang-skh049-7p', 'equipo-hospitalario-ref-skh049-7p-saikang'),
      ('saikang-skh070', 'equipo-hospitalario-ref-skh070-saikang'),
      ('saikang-skh091', 'equipo-hospitalario-ref-skh091-saikang'),
      ('saikang-skh201-4', 'equipo-hospitalario-ref-skh201-4-saikang'),
      ('saikang-skho41', 'soporte-para-infusion-ref-skho41-saikang'),
      ('saikang-skn002-gauze', 'equipo-hospitalario-ref-skn002-gauze-saikang'),
      ('saikang-skn001', 'equipo-hospitalario-ref-skn001-saikang'),
      ('saikang-skh098-4', 'equipo-hospitalario-ref-skh098-4-saikang'),
      ('saikang-skn031-stainless-steel-kidney-dish', 'equipo-hospitalario-ref-skn031-stainless-steel-kidney-dish-saikang'),
      ('saikang-skno31', 'equipo-hospitalario-ref-skno31-saikang'),
      ('saikang-skr-ct625-1', 'carro-de-emergencias-ref-skr-ct625-1-saikang'),
      ('saikang-sk-ex123', 'aspirador-medico-ref-sk-ex123-saikang'),
      ('saikang-skr054-et77a', 'carro-de-emergencias-ref-skr054-et77a-saikang'),
      ('saikang-sk-ex124', 'aspirador-medico-ref-sk-ex124-saikang'),
      ('saikang-skr058-et', 'carro-de-emergencias-ref-skr058-et-saikang'),
      ('saikang-skr-ct600', 'carro-clinico-ref-skr-ct600-saikang'),
      ('saikang-skr054-mt01', 'carro-de-medicamentos-ref-skr054-mt01-saikang'),
      ('saikang-skr058-nt', 'carro-de-enfermeria-ref-skr058-nt-saikang'),
      ('saikang-sk-l032', 'lampara-de-examen-ref-sk-l032-saikang'),
      ('saikang-sk-lld700z', 'lampara-quirurgica-ref-sk-lld700z-saikang'),
      ('saikang-skp040', 'colchon-hospitalario-ref-skp040-saikang'),
      ('saikang-skp028', 'colchon-hospitalario-ref-skp028-saikang'),
      ('saikang-skp041', 'colchon-hospitalario-ref-skp041-saikang'),
      ('saikang-skp006', 'colchon-hospitalario-ref-skp006-saikang'),
      ('saikang-skp012', 'colchon-hospitalario-ref-skp012-saikang'),
      ('saikang-skp015', 'colchon-hospitalario-ref-skp015-saikang'),
      ('saikang-skp013', 'colchon-hospitalario-ref-skp013-saikang'),
      ('saikang-skp003', 'colchon-hospitalario-ref-skp003-saikang'),
      ('saikang-skp008', 'colchon-hospitalario-ref-skp008-saikang'),
      ('saikang-sks013-1', 'mesa-de-noche-hospitalaria-ref-sks013-1-saikang'),
      ('saikang-a99-8', 'mesa-de-examen-ginecologico-ref-a99-8-saikang'),
      ('saikang-skl-c', 'mesa-quirurgica-electrica-ref-skl-c-saikang'),
      ('saikang-a045-1', 'mesa-de-examen-ginecologico-ref-a045-1-saikang'),
      ('saikang-skl-d', 'mesa-quirurgica-electrica-ref-skl-d-saikang'),
      ('saikang-skl-e', 'mesa-quirurgica-electrica-ref-skl-e-saikang'),
      ('saikang-ainno', 'lampara-quirurgica-ref-ainno-saikang'),
      ('lampara-quirurgica-ref-ainno-saikang-ainno', 'lampara-quirurgica-ref-ainno-saikang'),
      ('saikang-skr-j21', 'carro-clinico-ref-skr-j21-saikang'),
      ('saikang-skr-r04', 'carro-clinico-ref-skr-r04-saikang'),
      ('saikang-skr-b00', 'carro-informatico-clinico-ref-skr-b00-saikang'),
      ('saikang-skr-r01', 'carro-informatico-clinico-ref-skr-r01-saikang'),
      ('saikang-skr-r02', 'carro-informatico-clinico-ref-skr-r02-saikang'),
      ('saikang-skr-r05', 'carro-informatico-clinico-ref-skr-r05-saikang'),
      ('saikang-skr-r06', 'carro-clinico-ref-skr-r06-saikang'),
      ('saikang-skb041-6', 'camilla-de-traslado-ref-skb041-6-saikang'),
      ('saikang-skb2a14', 'tabla-espinal-ref-skb2a14-saikang'),
      ('saikang-skb041-1', 'camilla-de-traslado-ref-skb041-1-saikang'),
      ('saikang-skb2b01', 'camilla-cuchara-ref-skb2b01-saikang'),
      ('saikang-skb2d009', 'collar-cervical-ref-skb2d009-saikang'),
      ('saikang-ske-133', 'sillon-de-dialisis-ref-ske-133-saikang'),
      ('saikang-ske-134', 'sillon-de-dialisis-ref-ske-134-saikang'),
      ('saikang-ske-188a', 'sillon-de-dialisis-ref-ske-188a-saikang'),
      ('saikang-ske090', 'sillon-para-donacion-de-sangre-ref-ske090-saikang'),
      ('saikang-skh012', 'carro-clinico-ref-skh012-saikang'),
      ('saikang-skh013', 'carro-clinico-ref-skh013-saikang'),
      ('saikang-skh027', 'carro-clinico-ref-skh027-saikang'),
      ('saikang-skh034', 'equipo-hospitalario-ref-skh034-saikang'),
      ('saikang-skh034-5', 'equipo-hospitalario-ref-skh034-5-saikang'),
      ('saikang-skh036', 'equipo-hospitalario-ref-skh036-saikang'),
      ('saikang-skh040-1g', 'carro-clinico-ref-skh040-1g-saikang'),
      ('saikang-skh040', 'carro-clinico-ref-skh040-saikang'),
      ('saikang-skh041-3', 'equipo-hospitalario-ref-skh041-3-saikang'),
      ('saikang-ske017-4', 'silla-clinica-ref-ske017-4-saikang'),
      ('saikang-sks007-4', 'mesa-de-noche-hospitalaria-ref-sks007-4-saikang'),
      ('saikang-ske943', 'sillon-hospitalario-ref-ske943-saikang'),
      ('saikang-ske-135', 'sillon-de-dialisis-ref-ske-135-saikang'),
      ('saikang-skh038-2', 'carro-clinico-ref-skh038-2-saikang'),
      ('analizador-hematologico-automatico-mindray-bc-10', 'analizador-hematologico-automatico-mindray-ref-bc-10-mindray'),
      ('analizador-hematologico-automatico-mindray-bc-30s', 'analizador-hematologico-automatico-mindray-ref-bc-30s-mindray'),
      ('analizador-bioquimico-semiautomatico-rayto-rt-1904c', 'analizador-bioquimico-semiautomatico-rayto-ref-rt-1904c-rayto'),
      ('analizador-bioquimico-semiautomatico-sunnymed-sy-b010', 'analizador-bioquimico-semiautomatico-sunnymed-ref-sy-b010-sunny')
    ) AS t(legacy_slug, canonical_slug)
  LOOP
    origen_es := '/es/productos/' || par.legacy_slug;
    destino_es := '/es/productos/' || par.canonical_slug;
    origen_en := '/en/products/' || par.legacy_slug;
    destino_en := '/en/products/' || par.canonical_slug;

    UPDATE public.articulos
    SET cuerpo_es = replace(replace(cuerpo_es, origen_es || '/', destino_es || '/'), origen_es || '"', destino_es || '"'),
        cuerpo_en = replace(replace(cuerpo_en, origen_en || '/', destino_en || '/'), origen_en || '"', destino_en || '"')
    WHERE (cuerpo_es LIKE '%' || origen_es || '%' OR cuerpo_en LIKE '%' || origen_en || '%')
      AND (
        cuerpo_es IS DISTINCT FROM replace(replace(cuerpo_es, origen_es || '/', destino_es || '/'), origen_es || '"', destino_es || '"')
        OR cuerpo_en IS DISTINCT FROM replace(replace(cuerpo_en, origen_en || '/', destino_en || '/'), origen_en || '"', destino_en || '"')
      );

    UPDATE public.landings
    SET contenido_es = replace(replace(contenido_es::text, origen_es || '/', destino_es || '/'), origen_es || '"', destino_es || '"')::jsonb,
        contenido_en = replace(replace(contenido_en::text, origen_en || '/', destino_en || '/'), origen_en || '"', destino_en || '"')::jsonb
    WHERE (contenido_es::text LIKE '%' || origen_es || '%' OR contenido_en::text LIKE '%' || origen_en || '%')
      AND (
        contenido_es::text IS DISTINCT FROM replace(replace(contenido_es::text, origen_es || '/', destino_es || '/'), origen_es || '"', destino_es || '"')
        OR contenido_en::text IS DISTINCT FROM replace(replace(contenido_en::text, origen_en || '/', destino_en || '/'), origen_en || '"', destino_en || '"')
      );
  END LOOP;
END $$;
