-- Catálogo Zuowei: 9 modelos, precio bajo cotización, nuevo y destacado.
INSERT INTO tipos (id, familia_id, slug, nombre_es, nombre_en, orden, activo)
VALUES
('a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b01'::uuid, 'd026ac8a-6d63-4fb7-8953-a7aa7a32e627'::uuid, 'exoesqueletos', 'Exoesqueletos', 'Exoskeletons', 70, true),
('a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b02'::uuid, 'd026ac8a-6d63-4fb7-8953-a7aa7a32e627'::uuid, 'bipedestacion-y-marcha', 'Bipedestación y marcha', 'Standing and gait', 80, true),
('a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b03'::uuid, '01a7591f-3603-4342-a698-d626fb8756e9'::uuid, 'sillas-de-transferencia', 'Sillas de transferencia', 'Transfer chairs', 70, true),
('a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b04'::uuid, '01a7591f-3603-4342-a698-d626fb8756e9'::uuid, 'scooters-electricos', 'Scooters eléctricos', 'Mobility scooters', 80, true),
('a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b05'::uuid, 'de5498d0-4a86-43d8-a7a8-34cdf21e76ab'::uuid, 'higiene-en-cama', 'Higiene en cama', 'Bed bathing', 70, true)
ON CONFLICT (familia_id, slug) DO UPDATE SET
  nombre_es = EXCLUDED.nombre_es,
  nombre_en = EXCLUDED.nombre_en,
  orden = EXCLUDED.orden,
  activo = true;

INSERT INTO productos (
  id, slug, sku, familia_id, tipo_id,
  nombre_es, nombre_en,
  descripcion_corta_es, descripcion_corta_en,
  descripcion_larga_es, descripcion_larga_en,
  especificaciones, aplicaciones_es, aplicaciones_en,
  imagen_principal, galeria, atributos,
  tipo_comercial, fulfillment_mode,
  precio, precio_regular, precio_oferta, moneda,
  stock, gestionar_stock, disponible, destacado, nuevo, activo, orden
) VALUES
(
      '44522403-323a-5610-b089-d65e27884d74'::uuid,
      'exoesqueleto-rehabilitacion-marcha-zuowei-zw568',
      'ZW568',
      'd026ac8a-6d63-4fb7-8953-a7aa7a32e627'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b01'::uuid,
      'Exoesqueleto de asistencia de marcha Zuowei ZW568',
      'Zuowei ZW568 gait assistance exoskeleton',
      'Dispositivo portátil que se ajusta a la cadera. Dos unidades de potencia bilaterales asisten la flexión y extensión del muslo durante la marcha. Pensado para usuarios que pueden ponerse de pie y mantener el equilibrio por sí mismos, y para programas de entrenamiento de marcha en centros de rehabilitación, residencias y hogar.',
      'Portable device that fits at the hip. Two bilateral power units assist thigh flexion and extension during gait. Intended for users who can stand and keep their balance on their own, and for gait-training programs in rehabilitation centers, residences and at home.',
      'Dispositivo portátil que se ajusta a la cadera. Dos unidades de potencia bilaterales asisten la flexión y extensión del muslo durante la marcha. Pensado para usuarios que pueden ponerse de pie y mantener el equilibrio por sí mismos, y para programas de entrenamiento de marcha en centros de rehabilitación, residencias y hogar.

Advertencia del fabricante: no apto para quien no pueda estar de pie, caminar o mantener el equilibrio solo. Indica no usarlo en caso de cardiopatía, hipertensión o embarazo. No es impermeable.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'Portable device that fits at the hip. Two bilateral power units assist thigh flexion and extension during gait. Intended for users who can stand and keep their balance on their own, and for gait-training programs in rehabilitation centers, residences and at home.

Manufacturer warning: not for someone who cannot stand, walk or keep their balance alone. The manufacturer says not to use it with heart disease, hypertension or pregnancy. It is not waterproof.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW568","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Asistencia","valor":"Ajustable en 5 niveles","grupo":"Ficha del fabricante"},{"clave":"Unidades de potencia","valor":"Dos unidades bilaterales, para flexión y extensión del muslo","grupo":"Ficha del fabricante"},{"clave":"Colocación","valor":"Se ajusta a la cadera. El fabricante la describe como fácil de colocar","grupo":"Ficha del fabricante"},{"clave":"Batería","valor":"DC 21,6 V","grupo":"Ficha del fabricante"},{"clave":"Autonomía","valor":"120 min","grupo":"Ficha del fabricante"},{"clave":"Tiempo de carga","valor":"4 h","grupo":"Ficha del fabricante"},{"clave":"Dimensiones","valor":"515 × 345 × 335 mm","grupo":"Ficha del fabricante"},{"clave":"Uso","valor":"Interior y exterior. No usar bajo la lluvia","grupo":"Ficha del fabricante"},{"clave":"Usuario previsto","valor":"Personas que pueden ponerse de pie y mantener el equilibrio por sí mismas","grupo":"Ficha del fabricante"},{"clave":"Advertencia del fabricante","valor":"No apto para personas que no puedan estar de pie, caminar o mantener el equilibrio solas. El fabricante indica no usarlo en caso de cardiopatía, hipertensión o embarazo. No es impermeable.","grupo":"Advertencia del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Entrenamiento de marcha en centros de rehabilitación, residencias y hogar', 'Uso interior y exterior, no bajo la lluvia']::text[],
      ARRAY['Gait training in rehabilitation centers, residences and at home', 'Indoor and outdoor use, not in the rain']::text[],
      '/assets/productos/zuowei/exoesqueleto-rehabilitacion-marcha-zuowei-zw568/principal-zuowei-zw568-exoesqueleto-rehabilitacion-marcha-colombia.webp',
      ARRAY['/assets/productos/zuowei/exoesqueleto-rehabilitacion-marcha-zuowei-zw568/galeria-zuowei-zw568-exoesqueleto-rehabilitacion-marcha-colombia-01.webp', '/assets/productos/zuowei/exoesqueleto-rehabilitacion-marcha-zuowei-zw568/galeria-zuowei-zw568-exoesqueleto-rehabilitacion-marcha-colombia-02.webp', '/assets/productos/zuowei/exoesqueleto-rehabilitacion-marcha-zuowei-zw568/galeria-zuowei-zw568-exoesqueleto-rehabilitacion-marcha-colombia-03.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Asistencia ajustable en 5 niveles","Dos unidades de potencia bilaterales","Autonomía publicada de 120 min"],"beneficios_en":["Assistance adjustable in 5 levels","Two bilateral power units","Published runtime of 120 min"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["exoesqueleto de marcha","Zuowei ZW568","rehabilitación Colombia"],"seo_keywords_en":["gait exoskeleton","Zuowei ZW568","rehabilitation Colombia"],"alt_imagen_es":"Exoesqueleto de rehabilitación de marcha Zuowei ZW568, vista de estudio","alt_imagen_en":"Zuowei ZW568 gait rehabilitation exoskeleton, studio view","galeria_alt_es":["Exoesqueleto de rehabilitación de marcha Zuowei ZW568, vista de estudio","Exoesqueleto Zuowei ZW568, vista frontal de la asistencia de cadera","Exoesqueleto Zuowei ZW568 en entrenamiento de marcha al aire libre","Exoesqueleto Zuowei ZW568 con dos unidades de potencia bilaterales"],"galeria_alt_en":["Zuowei ZW568 gait rehabilitation exoskeleton, studio view","Zuowei ZW568 exoskeleton, front view of the hip assistance","Zuowei ZW568 exoskeleton during outdoor gait training","Zuowei ZW568 exoskeleton with two bilateral power units"],"imagen_ancho":800,"imagen_alto":560,"especificaciones_en":[{"clave":"Model","valor":"ZW568","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Assistance","valor":"Adjustable in 5 levels","grupo":"Manufacturer sheet"},{"clave":"Power units","valor":"Two bilateral units, for thigh flexion and extension","grupo":"Manufacturer sheet"},{"clave":"Fit","valor":"Fits at the hip. The manufacturer describes it as easy to put on","grupo":"Manufacturer sheet"},{"clave":"Battery","valor":"DC 21.6 V","grupo":"Manufacturer sheet"},{"clave":"Runtime","valor":"120 min","grupo":"Manufacturer sheet"},{"clave":"Charge time","valor":"4 h","grupo":"Manufacturer sheet"},{"clave":"Dimensions","valor":"515 × 345 × 335 mm","grupo":"Manufacturer sheet"},{"clave":"Use","valor":"Indoor and outdoor. Do not use in the rain","grupo":"Manufacturer sheet"},{"clave":"Intended user","valor":"People who can stand and keep their balance on their own","grupo":"Manufacturer sheet"},{"clave":"Manufacturer warning","valor":"Not for people who cannot stand, walk or keep their balance on their own. The manufacturer says not to use it with heart disease, hypertension or pregnancy. It is not waterproof.","grupo":"Manufacturer warning"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -9
    ),
(
      '6ff22f71-27fc-5f79-b4d6-07d4410f269f'::uuid,
      'exoesqueleto-portatil-ultraligero-marcha-zuowei-zw598',
      'ZW598',
      'd026ac8a-6d63-4fb7-8953-a7aa7a32e627'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b01'::uuid,
      'Exoesqueleto portátil ultraligero Zuowei ZW598',
      'Zuowei ZW598 ultralight portable exoskeleton',
      'Asistencia de cadera con doble motor y algoritmo que detecta la intención de movimiento en tiempo real. Seis niveles de asistencia y estructura de aleación de aluminio plegable.',
      'Hip assistance with a dual motor and an algorithm that detects movement intention in real time. Six assistance levels and a foldable aluminum-alloy frame.',
      'Asistencia de cadera con doble motor y algoritmo que detecta la intención de movimiento en tiempo real. Seis niveles de asistencia y estructura de aleación de aluminio plegable.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'Hip assistance with a dual motor and an algorithm that detects movement intention in real time. Six assistance levels and a foldable aluminum-alloy frame.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW598","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Peso","valor":"2,4 kg","grupo":"Ficha del fabricante"},{"clave":"Motores","valor":"2 motores, hasta 16 Nm","grupo":"Ficha del fabricante"},{"clave":"Asistencia","valor":"6 niveles","grupo":"Ficha del fabricante"},{"clave":"Estructura","valor":"Aleación de aluminio, plegable","grupo":"Ficha del fabricante"},{"clave":"Temperatura de operación","valor":"−10 °C a 45 °C","grupo":"Ficha del fabricante"},{"clave":"Detección","valor":"Doble motor y algoritmo que detecta la intención de movimiento en tiempo real","grupo":"Ficha del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Asistencia de cadera en uso diario, según la ficha del fabricante']::text[],
      ARRAY['Daily hip assistance, as described on the manufacturer sheet']::text[],
      '/assets/productos/zuowei/exoesqueleto-portatil-ultraligero-marcha-zuowei-zw598/principal-zuowei-zw598-exoesqueleto-portatil-ultraligero-cadera-colombia.webp',
      ARRAY['/assets/productos/zuowei/exoesqueleto-portatil-ultraligero-marcha-zuowei-zw598/galeria-zuowei-zw598-exoesqueleto-portatil-ultraligero-cadera-colombia-01.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Peso publicado de 2,4 kg","Hasta 16 Nm por motor","Estructura plegable"],"beneficios_en":["Published weight of 2.4 kg","Up to 16 Nm per motor","Foldable frame"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["exoesqueleto ultraligero","Zuowei ZW598","asistencia de cadera"],"seo_keywords_en":["ultralight exoskeleton","Zuowei ZW598","hip assistance"],"alt_imagen_es":"Exoesqueleto portátil ultraligero de cadera Zuowei ZW598","alt_imagen_en":"Zuowei ZW598 ultralight portable hip exoskeleton","galeria_alt_es":["Exoesqueleto portátil ultraligero de cadera Zuowei ZW598","Exoesqueleto Zuowei ZW598 con doble motor, vista de estudio"],"galeria_alt_en":["Zuowei ZW598 ultralight portable hip exoskeleton","Zuowei ZW598 exoskeleton with dual motor, studio view"],"imagen_ancho":1031,"imagen_alto":777,"especificaciones_en":[{"clave":"Model","valor":"ZW598","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Weight","valor":"2.4 kg","grupo":"Manufacturer sheet"},{"clave":"Motors","valor":"2 motors, up to 16 Nm","grupo":"Manufacturer sheet"},{"clave":"Assistance","valor":"6 levels","grupo":"Manufacturer sheet"},{"clave":"Frame","valor":"Aluminum alloy, foldable","grupo":"Manufacturer sheet"},{"clave":"Operating temperature","valor":"−10 °C to 45 °C","grupo":"Manufacturer sheet"},{"clave":"Detection","valor":"Dual motor and an algorithm that detects movement intention in real time","grupo":"Manufacturer sheet"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -8
    ),
(
      '0b8291e8-af95-53d5-b34e-723ada3b79b4'::uuid,
      'silla-ruedas-electrica-bipedestacion-entrenamiento-marcha-zuowei-zw518',
      'ZW518',
      'd026ac8a-6d63-4fb7-8953-a7aa7a32e627'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b02'::uuid,
      'Silla de ruedas eléctrica con bipedestación y marcha Zuowei ZW518',
      'Zuowei ZW518 power wheelchair with standing and gait',
      'Un botón cambia entre modo silla eléctrica y modo de bipedestación o entrenamiento de marcha con arnés. Freno electromagnético automático, joystick, batería extraíble y marco de aluminio.',
      'One button switches between power-wheelchair mode and standing or gait-training mode with a harness. Automatic electromagnetic brake, joystick, removable battery and aluminum frame.',
      'Un botón cambia entre modo silla eléctrica y modo de bipedestación o entrenamiento de marcha con arnés. Freno electromagnético automático, joystick, batería extraíble y marco de aluminio.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'One button switches between power-wheelchair mode and standing or gait-training mode with a harness. Automatic electromagnetic brake, joystick, removable battery and aluminum frame.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW518","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Modos","valor":"Silla de ruedas eléctrica y bipedestación / entrenamiento de marcha con arnés. Un botón cambia de modo","grupo":"Ficha del fabricante"},{"clave":"Freno","valor":"Electromagnético automático","grupo":"Ficha del fabricante"},{"clave":"Control","valor":"Joystick","grupo":"Ficha del fabricante"},{"clave":"Batería","valor":"Litio 24 V 15,4 Ah, extraíble","grupo":"Ficha del fabricante"},{"clave":"Autonomía","valor":"Más de 20 km","grupo":"Ficha del fabricante"},{"clave":"Tiempo de carga","valor":"4 h","grupo":"Ficha del fabricante"},{"clave":"Velocidad","valor":"6 km/h, ajustable","grupo":"Ficha del fabricante"},{"clave":"Peso del equipo","valor":"32 kg","grupo":"Ficha del fabricante"},{"clave":"Dimensiones sentado","valor":"1000 × 690 × 1090 mm","grupo":"Ficha del fabricante"},{"clave":"Dimensiones de pie","valor":"1000 × 690 × 2000 mm","grupo":"Ficha del fabricante"},{"clave":"Estatura de usuario","valor":"140–180 cm","grupo":"Ficha del fabricante"},{"clave":"Arnés de seguridad","valor":"Hasta 150 kg","grupo":"Ficha del fabricante"},{"clave":"Marco","valor":"Aluminio","grupo":"Ficha del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Desplazamiento en silla de ruedas eléctrica', 'Bipedestación y entrenamiento de marcha con arnés']::text[],
      ARRAY['Power wheelchair travel', 'Standing and gait training with a harness']::text[],
      '/assets/productos/zuowei/silla-ruedas-electrica-bipedestacion-entrenamiento-marcha-zuowei-zw518/principal-zuowei-zw518-silla-ruedas-electrica-entrenamiento-marcha-colombia.webp',
      ARRAY['/assets/productos/zuowei/silla-ruedas-electrica-bipedestacion-entrenamiento-marcha-zuowei-zw518/galeria-zuowei-zw518-silla-ruedas-electrica-entrenamiento-marcha-colombia-01.webp', '/assets/productos/zuowei/silla-ruedas-electrica-bipedestacion-entrenamiento-marcha-zuowei-zw518/galeria-zuowei-zw518-silla-ruedas-electrica-entrenamiento-marcha-colombia-02.webp', '/assets/productos/zuowei/silla-ruedas-electrica-bipedestacion-entrenamiento-marcha-zuowei-zw518/galeria-zuowei-zw518-silla-ruedas-electrica-entrenamiento-marcha-colombia-03.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Dos modos en el mismo equipo","Freno electromagnético automático","Batería de litio extraíble"],"beneficios_en":["Two modes in the same unit","Automatic electromagnetic brake","Removable lithium battery"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["silla de bipedestación","Zuowei ZW518","entrenamiento de marcha"],"seo_keywords_en":["standing wheelchair","Zuowei ZW518","gait training"],"alt_imagen_es":"Silla de ruedas eléctrica Zuowei ZW518 para entrenamiento de marcha","alt_imagen_en":"Zuowei ZW518 power wheelchair for gait training","galeria_alt_es":["Silla de ruedas eléctrica Zuowei ZW518 para entrenamiento de marcha","Zuowei ZW518 en bipedestación y rehabilitación de marcha","Silla de ruedas de rehabilitación Zuowei ZW518, vista lateral","Arneses de seguridad de la silla de rehabilitación Zuowei ZW518"],"galeria_alt_en":["Zuowei ZW518 power wheelchair for gait training","Zuowei ZW518 in standing position and gait rehabilitation","Zuowei ZW518 rehabilitation wheelchair, side view","Safety harnesses on the Zuowei ZW518 rehabilitation wheelchair"],"imagen_ancho":800,"imagen_alto":560,"especificaciones_en":[{"clave":"Model","valor":"ZW518","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Modes","valor":"Power wheelchair and standing / gait training with a harness. One button switches modes","grupo":"Manufacturer sheet"},{"clave":"Brake","valor":"Automatic electromagnetic brake","grupo":"Manufacturer sheet"},{"clave":"Control","valor":"Joystick","grupo":"Manufacturer sheet"},{"clave":"Battery","valor":"Lithium 24 V 15.4 Ah, removable","grupo":"Manufacturer sheet"},{"clave":"Range","valor":"More than 20 km","grupo":"Manufacturer sheet"},{"clave":"Charge time","valor":"4 h","grupo":"Manufacturer sheet"},{"clave":"Speed","valor":"6 km/h, adjustable","grupo":"Manufacturer sheet"},{"clave":"Unit weight","valor":"32 kg","grupo":"Manufacturer sheet"},{"clave":"Seated size","valor":"1000 × 690 × 1090 mm","grupo":"Manufacturer sheet"},{"clave":"Standing size","valor":"1000 × 690 × 2000 mm","grupo":"Manufacturer sheet"},{"clave":"User height","valor":"140–180 cm","grupo":"Manufacturer sheet"},{"clave":"Safety harness","valor":"Up to 150 kg","grupo":"Manufacturer sheet"},{"clave":"Frame","valor":"Aluminum","grupo":"Manufacturer sheet"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -7
    ),
(
      'bfa1da7b-246b-544b-bbb1-8a8a06b7f6b5'::uuid,
      'silla-transferencia-hidraulica-pacientes-zuowei-zw302',
      'ZW302',
      '01a7591f-3603-4342-a698-d626fb8756e9'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b03'::uuid,
      'Silla de transferencia hidráulica Zuowei ZW302',
      'Zuowei ZW302 hydraulic transfer chair',
      'Silla de transferencia con elevación hidráulica por pedal, carga máxima de 120 kg, recorrido del asiento de 20 cm y asiento dividido de 180°. Para hogar y residencias.',
      'Transfer chair with pedal hydraulic lift, 120 kg maximum load, 20 cm seat travel and a 180° split seat. For home and care residences.',
      'Silla de transferencia con elevación hidráulica por pedal, carga máxima de 120 kg, recorrido del asiento de 20 cm y asiento dividido de 180°. Para hogar y residencias.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'Transfer chair with pedal hydraulic lift, 120 kg maximum load, 20 cm seat travel and a 180° split seat. For home and care residences.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW302","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Elevación","valor":"Hidráulica por pedal","grupo":"Ficha del fabricante"},{"clave":"Carga máxima","valor":"120 kg","grupo":"Ficha del fabricante"},{"clave":"Recorrido del asiento","valor":"20 cm","grupo":"Ficha del fabricante"},{"clave":"Asiento","valor":"Dividido, apertura 180°","grupo":"Ficha del fabricante"},{"clave":"Uso","valor":"Hogar y residencias","grupo":"Ficha del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Traslado de la persona en hogar y residencias']::text[],
      ARRAY['Transfers at home and in care residences']::text[],
      '/assets/productos/zuowei/silla-transferencia-hidraulica-pacientes-zuowei-zw302/principal-zuowei-zw302-silla-transferencia-hidraulica-pacientes-colombia.webp',
      ARRAY['/assets/productos/zuowei/silla-transferencia-hidraulica-pacientes-zuowei-zw302/galeria-zuowei-zw302-silla-transferencia-hidraulica-pacientes-colombia-01.webp', '/assets/productos/zuowei/silla-transferencia-hidraulica-pacientes-zuowei-zw302/galeria-zuowei-zw302-silla-transferencia-hidraulica-pacientes-colombia-02.webp', '/assets/productos/zuowei/silla-transferencia-hidraulica-pacientes-zuowei-zw302/galeria-zuowei-zw302-silla-transferencia-hidraulica-pacientes-colombia-03.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Elevación por pedal","Asiento dividido de 180°","Carga máxima de 120 kg"],"beneficios_en":["Pedal lift","180° split seat","120 kg maximum load"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["silla de transferencia hidráulica","Zuowei ZW302"],"seo_keywords_en":["hydraulic transfer chair","Zuowei ZW302"],"alt_imagen_es":"Silla de transferencia hidráulica Zuowei ZW302","alt_imagen_en":"Zuowei ZW302 hydraulic transfer chair","galeria_alt_es":["Silla de transferencia hidráulica Zuowei ZW302","Zuowei ZW302 con elevación hidráulica por pedal y asiento de 180°","Silla de transferencia Zuowei ZW302 para inodoro y ducha","Silla de elevación hidráulica Zuowei ZW302, vista de estudio"],"galeria_alt_en":["Zuowei ZW302 hydraulic transfer chair","Zuowei ZW302 with pedal hydraulic lift and 180° seat","Zuowei ZW302 transfer chair for toilet and shower","Zuowei ZW302 hydraulic lift chair, studio view"],"imagen_ancho":800,"imagen_alto":560,"especificaciones_en":[{"clave":"Model","valor":"ZW302","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Lift","valor":"Hydraulic, pedal operated","grupo":"Manufacturer sheet"},{"clave":"Maximum load","valor":"120 kg","grupo":"Manufacturer sheet"},{"clave":"Seat travel","valor":"20 cm","grupo":"Manufacturer sheet"},{"clave":"Seat","valor":"Split seat, 180° opening","grupo":"Manufacturer sheet"},{"clave":"Use","valor":"Home and care residences","grupo":"Manufacturer sheet"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -6
    ),
(
      'd4b3b95b-f584-5ca9-94d9-cecb5134a9a7'::uuid,
      'silla-transferencia-electrica-pacientes-asiento-ancho-zuowei-zw365d-2',
      'ZW365D-2',
      '01a7591f-3603-4342-a698-d626fb8756e9'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b03'::uuid,
      'Silla de transferencia eléctrica Zuowei ZW365D-2',
      'Zuowei ZW365D-2 electric transfer chair',
      'Silla de transferencia eléctrica con elevación de 30 cm, asiento de 510 mm, carga máxima de 200 kg, motor de 100 W e indicador LED de batería.',
      'Electric transfer chair with 30 cm lift, 510 mm seat, 200 kg maximum load, 100 W motor and a battery LED indicator.',
      'Silla de transferencia eléctrica con elevación de 30 cm, asiento de 510 mm, carga máxima de 200 kg, motor de 100 W e indicador LED de batería.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'Electric transfer chair with 30 cm lift, 510 mm seat, 200 kg maximum load, 100 W motor and a battery LED indicator.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW365D-2","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Dimensiones","valor":"860 × 621 × 862–1162 mm","grupo":"Ficha del fabricante"},{"clave":"Ruedas","valor":"5 pulgadas delanteras y 3 pulgadas traseras","grupo":"Ficha del fabricante"},{"clave":"Ancho de asiento","valor":"510 mm","grupo":"Ficha del fabricante"},{"clave":"Carga máxima","valor":"200 kg","grupo":"Ficha del fabricante"},{"clave":"Recorrido","valor":"30 cm","grupo":"Ficha del fabricante"},{"clave":"Motor","valor":"100 W","grupo":"Ficha del fabricante"},{"clave":"Entrada del cargador","valor":"110–240 V","grupo":"Ficha del fabricante"},{"clave":"Salida","valor":"29,4 V","grupo":"Ficha del fabricante"},{"clave":"Batería","valor":"25,2 V 3.200 mAh","grupo":"Ficha del fabricante"},{"clave":"Tiempo de carga","valor":"3,5 h","grupo":"Ficha del fabricante"},{"clave":"Velocidad de elevación","valor":"≤4 mm/s","grupo":"Ficha del fabricante"},{"clave":"Indicador","valor":"Pantalla LED de batería","grupo":"Ficha del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Traslado con elevación eléctrica y asiento ancho']::text[],
      ARRAY['Transfers with electric lift and a wide seat']::text[],
      '/assets/productos/zuowei/silla-transferencia-electrica-pacientes-asiento-ancho-zuowei-zw365d-2/principal-zuowei-zw365d-2-silla-transferencia-electrica-pacientes-colombia.webp',
      ARRAY['/assets/productos/zuowei/silla-transferencia-electrica-pacientes-asiento-ancho-zuowei-zw365d-2/galeria-zuowei-zw365d-2-silla-transferencia-electrica-pacientes-colombia-01.webp', '/assets/productos/zuowei/silla-transferencia-electrica-pacientes-asiento-ancho-zuowei-zw365d-2/galeria-zuowei-zw365d-2-silla-transferencia-electrica-pacientes-colombia-02.webp', '/assets/productos/zuowei/silla-transferencia-electrica-pacientes-asiento-ancho-zuowei-zw365d-2/galeria-zuowei-zw365d-2-silla-transferencia-electrica-pacientes-colombia-03.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Asiento de 510 mm","Carga máxima de 200 kg","Indicador LED de batería"],"beneficios_en":["510 mm seat","200 kg maximum load","Battery LED indicator"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["silla de transferencia eléctrica","Zuowei ZW365D-2"],"seo_keywords_en":["electric transfer chair","Zuowei ZW365D-2"],"alt_imagen_es":"Silla de transferencia eléctrica Zuowei ZW365D-2","alt_imagen_en":"Zuowei ZW365D-2 electric transfer chair","galeria_alt_es":["Silla de transferencia eléctrica Zuowei ZW365D-2","Zuowei ZW365D-2 con elevación eléctrica y asiento de 51 cm","Silla de traslado eléctrica Zuowei ZW365D-2 para cuidado domiciliario","Silla de transferencia eléctrica Zuowei ZW365D-2, vista de estudio"],"galeria_alt_en":["Zuowei ZW365D-2 electric transfer chair","Zuowei ZW365D-2 with electric lift and 51 cm seat","Zuowei ZW365D-2 electric transfer chair for home care","Zuowei ZW365D-2 electric transfer chair, studio view"],"imagen_ancho":800,"imagen_alto":560,"especificaciones_en":[{"clave":"Model","valor":"ZW365D-2","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Dimensions","valor":"860 × 621 × 862–1162 mm","grupo":"Manufacturer sheet"},{"clave":"Wheels","valor":"5 in front and 3 in rear","grupo":"Manufacturer sheet"},{"clave":"Seat width","valor":"510 mm","grupo":"Manufacturer sheet"},{"clave":"Maximum load","valor":"200 kg","grupo":"Manufacturer sheet"},{"clave":"Travel","valor":"30 cm","grupo":"Manufacturer sheet"},{"clave":"Motor","valor":"100 W","grupo":"Manufacturer sheet"},{"clave":"Charger input","valor":"110–240 V","grupo":"Manufacturer sheet"},{"clave":"Output","valor":"29.4 V","grupo":"Manufacturer sheet"},{"clave":"Battery","valor":"25.2 V 3,200 mAh","grupo":"Manufacturer sheet"},{"clave":"Charge time","valor":"3.5 h","grupo":"Manufacturer sheet"},{"clave":"Lift speed","valor":"≤4 mm/s","grupo":"Manufacturer sheet"},{"clave":"Indicator","valor":"Battery LED display","grupo":"Manufacturer sheet"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -5
    ),
(
      '774eff3a-2f0e-5908-b35d-6d43fea0b710'::uuid,
      'silla-transferencia-manual-manivela-pacientes-zuowei-zw366s',
      'ZW366S',
      '01a7591f-3603-4342-a698-d626fb8756e9'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b03'::uuid,
      'Silla de transferencia manual con manivela Zuowei ZW366S',
      'Zuowei ZW366S manual crank transfer chair',
      'Silla de transferencia con elevación por manivela, carga máxima de 120 kg, recorrido de 20 cm y asiento dividido de 180°. No usa batería.',
      'Transfer chair with crank lift, 120 kg maximum load, 20 cm travel and a 180° split seat. It does not use a battery.',
      'Silla de transferencia con elevación por manivela, carga máxima de 120 kg, recorrido de 20 cm y asiento dividido de 180°. No usa batería.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'Transfer chair with crank lift, 120 kg maximum load, 20 cm travel and a 180° split seat. It does not use a battery.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW366S","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Elevación","valor":"Manual, por manivela","grupo":"Ficha del fabricante"},{"clave":"Carga máxima","valor":"120 kg","grupo":"Ficha del fabricante"},{"clave":"Recorrido","valor":"20 cm","grupo":"Ficha del fabricante"},{"clave":"Asiento","valor":"Dividido, apertura 180°","grupo":"Ficha del fabricante"},{"clave":"Alimentación","valor":"Sin batería","grupo":"Ficha del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Traslado manual, sin batería']::text[],
      ARRAY['Manual transfers, with no battery']::text[],
      '/assets/productos/zuowei/silla-transferencia-manual-manivela-pacientes-zuowei-zw366s/principal-zuowei-zw366s-silla-transferencia-manual-manivela-pacientes-colombia.webp',
      ARRAY['/assets/productos/zuowei/silla-transferencia-manual-manivela-pacientes-zuowei-zw366s/galeria-zuowei-zw366s-silla-transferencia-manual-manivela-pacientes-colombia-01.webp', '/assets/productos/zuowei/silla-transferencia-manual-manivela-pacientes-zuowei-zw366s/galeria-zuowei-zw366s-silla-transferencia-manual-manivela-pacientes-colombia-02.webp', '/assets/productos/zuowei/silla-transferencia-manual-manivela-pacientes-zuowei-zw366s/galeria-zuowei-zw366s-silla-transferencia-manual-manivela-pacientes-colombia-03.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Elevación por manivela","Sin batería","Asiento dividido de 180°"],"beneficios_en":["Crank lift","No battery","180° split seat"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["silla de transferencia manual","Zuowei ZW366S"],"seo_keywords_en":["manual transfer chair","Zuowei ZW366S"],"alt_imagen_es":"Silla de transferencia manual con manivela Zuowei ZW366S","alt_imagen_en":"Zuowei ZW366S manual crank transfer chair","galeria_alt_es":["Silla de transferencia manual con manivela Zuowei ZW366S","Zuowei ZW366S para traslado manual hacia inodoro o ducha","Silla de elevación manual Zuowei ZW366S, vista frontal de la manivela","Silla de transferencia manual Zuowei ZW366S, vista de estudio"],"galeria_alt_en":["Zuowei ZW366S manual crank transfer chair","Zuowei ZW366S for manual transfer to a toilet or shower","Zuowei ZW366S manual lift chair, front view of the crank","Zuowei ZW366S manual transfer chair, studio view"],"imagen_ancho":800,"imagen_alto":560,"especificaciones_en":[{"clave":"Model","valor":"ZW366S","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Lift","valor":"Manual, crank operated","grupo":"Manufacturer sheet"},{"clave":"Maximum load","valor":"120 kg","grupo":"Manufacturer sheet"},{"clave":"Travel","valor":"20 cm","grupo":"Manufacturer sheet"},{"clave":"Seat","valor":"Split seat, 180° opening","grupo":"Manufacturer sheet"},{"clave":"Power","valor":"No battery","grupo":"Manufacturer sheet"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -4
    ),
(
      '8fd800cf-e89b-56fa-9742-0d78fb228767'::uuid,
      'maquina-ducha-portatil-pacientes-encamados-zuowei-zw186',
      'ZW186',
      'de5498d0-4a86-43d8-a7a8-34cdf21e76ab'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b05'::uuid,
      'Máquina de ducha portátil para pacientes encamados Zuowei ZW186',
      'Zuowei ZW186 portable shower for people in bed',
      'Máquina de ducha portátil para el aseo de pacientes encamados. Está pensada para la higiene en cama y para el cuidado de la dignidad de la persona.',
      'Portable shower machine for bathing people who are in bed. It is intended for in-bed hygiene and for the person’s dignity.',
      'Máquina de ducha portátil para el aseo de pacientes encamados. Está pensada para la higiene en cama y para el cuidado de la dignidad de la persona.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'Portable shower machine for bathing people who are in bed. It is intended for in-bed hygiene and for the person’s dignity.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW186","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Uso","valor":"Aseo de pacientes encamados","grupo":"Ficha del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Higiene en cama de pacientes encamados']::text[],
      ARRAY['In-bed hygiene for people who remain in bed']::text[],
      '/assets/productos/zuowei/maquina-ducha-portatil-pacientes-encamados-zuowei-zw186/principal-zuowei-zw186-maquina-ducha-portatil-pacientes-encamados-colombia.webp',
      ARRAY['/assets/productos/zuowei/maquina-ducha-portatil-pacientes-encamados-zuowei-zw186/galeria-zuowei-zw186-maquina-ducha-portatil-pacientes-encamados-colombia-01.webp', '/assets/productos/zuowei/maquina-ducha-portatil-pacientes-encamados-zuowei-zw186/galeria-zuowei-zw186-maquina-ducha-portatil-pacientes-encamados-colombia-02.webp', '/assets/productos/zuowei/maquina-ducha-portatil-pacientes-encamados-zuowei-zw186/galeria-zuowei-zw186-maquina-ducha-portatil-pacientes-encamados-colombia-03.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Equipo portátil para el aseo en cama"],"beneficios_en":["Portable unit for bathing in bed"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["ducha portátil encamados","Zuowei ZW186","higiene en cama"],"seo_keywords_en":["portable bed shower","Zuowei ZW186","in-bed hygiene"],"alt_imagen_es":"Máquina de ducha portátil Zuowei ZW186 para pacientes encamados","alt_imagen_en":"Zuowei ZW186 portable shower machine for people in bed","galeria_alt_es":["Máquina de ducha portátil Zuowei ZW186 para pacientes encamados","Sistema de ducha en cama Zuowei ZW186","Accesorios de la ducha portátil asistencial Zuowei ZW186","Equipo de higiene en cama Zuowei ZW186"],"galeria_alt_en":["Zuowei ZW186 portable shower machine for people in bed","Zuowei ZW186 in-bed shower system","Accessories of the Zuowei ZW186 portable care shower","Zuowei ZW186 in-bed hygiene unit"],"imagen_ancho":800,"imagen_alto":560,"especificaciones_en":[{"clave":"Model","valor":"ZW186","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Use","valor":"Bathing for people who are in bed","grupo":"Manufacturer sheet"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -3
    ),
(
      'd21edddb-878f-59bb-8269-9722dadcbefc'::uuid,
      'scooter-electrico-movilidad-plegable-zuowei-zw501',
      'ZW501',
      '01a7591f-3603-4342-a698-d626fb8756e9'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b04'::uuid,
      'Scooter eléctrico de movilidad plegable Zuowei ZW501',
      'Zuowei ZW501 foldable mobility scooter',
      'Scooter de movilidad plegable, de 3 ruedas, con modos de conducción, plegado y arrastre. Velocidad máxima de 6,4 km/h, freno electromagnético y batería de litio extraíble.',
      'Foldable 3-wheel mobility scooter with drive, fold and tow modes. Top speed 6.4 km/h, electromagnetic brake and removable lithium battery.',
      'Scooter de movilidad plegable, de 3 ruedas, con modos de conducción, plegado y arrastre. Velocidad máxima de 6,4 km/h, freno electromagnético y batería de litio extraíble.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'Foldable 3-wheel mobility scooter with drive, fold and tow modes. Top speed 6.4 km/h, electromagnetic brake and removable lithium battery.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW501","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Configuración","valor":"Scooter plegable de 3 ruedas","grupo":"Ficha del fabricante"},{"clave":"Plegado","valor":"3 segundos","grupo":"Ficha del fabricante"},{"clave":"Modos","valor":"Conducción, plegado y arrastre","grupo":"Ficha del fabricante"},{"clave":"Velocidades","valor":"4","grupo":"Ficha del fabricante"},{"clave":"Velocidad máxima","valor":"6,4 km/h","grupo":"Ficha del fabricante"},{"clave":"Autonomía","valor":"15 km con una batería; 30 km con dos baterías","grupo":"Ficha del fabricante"},{"clave":"Peso bruto","valor":"27 kg","grupo":"Ficha del fabricante"},{"clave":"Carga máxima","valor":"120 kg","grupo":"Ficha del fabricante"},{"clave":"Freno","valor":"Electromagnético","grupo":"Ficha del fabricante"},{"clave":"Batería","valor":"Litio extraíble","grupo":"Ficha del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Movilidad personal en interiores y exteriores, según la ficha']::text[],
      ARRAY['Personal mobility indoors and outdoors, as described on the sheet']::text[],
      '/assets/productos/zuowei/scooter-electrico-movilidad-plegable-zuowei-zw501/principal-zuowei-zw501-scooter-electrico-movilidad-plegable-colombia.webp',
      ARRAY['/assets/productos/zuowei/scooter-electrico-movilidad-plegable-zuowei-zw501/galeria-zuowei-zw501-scooter-electrico-movilidad-plegable-colombia-01.webp', '/assets/productos/zuowei/scooter-electrico-movilidad-plegable-zuowei-zw501/galeria-zuowei-zw501-scooter-electrico-movilidad-plegable-colombia-02.webp', '/assets/productos/zuowei/scooter-electrico-movilidad-plegable-zuowei-zw501/galeria-zuowei-zw501-scooter-electrico-movilidad-plegable-colombia-03.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Plegado en 3 segundos","Batería de litio extraíble","Freno electromagnético"],"beneficios_en":["Folds in 3 seconds","Removable lithium battery","Electromagnetic brake"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["scooter eléctrico plegable","Zuowei ZW501","movilidad"],"seo_keywords_en":["foldable mobility scooter","Zuowei ZW501"],"alt_imagen_es":"Scooter eléctrico de movilidad plegable Zuowei ZW501","alt_imagen_en":"Zuowei ZW501 foldable electric mobility scooter","galeria_alt_es":["Scooter eléctrico de movilidad plegable Zuowei ZW501","Zuowei ZW501 plegado en 3 segundos","Scooter de movilidad Zuowei ZW501 en un paseo exterior","Batería de litio extraíble del scooter Zuowei ZW501"],"galeria_alt_en":["Zuowei ZW501 foldable electric mobility scooter","Zuowei ZW501 folded in 3 seconds","Zuowei ZW501 mobility scooter on an outdoor path","Removable lithium battery of the Zuowei ZW501 scooter"],"imagen_ancho":800,"imagen_alto":560,"especificaciones_en":[{"clave":"Model","valor":"ZW501","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Configuration","valor":"Foldable 3-wheel scooter","grupo":"Manufacturer sheet"},{"clave":"Folding","valor":"3 seconds","grupo":"Manufacturer sheet"},{"clave":"Modes","valor":"Drive, fold and tow","grupo":"Manufacturer sheet"},{"clave":"Speeds","valor":"4","grupo":"Manufacturer sheet"},{"clave":"Top speed","valor":"6.4 km/h","grupo":"Manufacturer sheet"},{"clave":"Range","valor":"15 km with one battery; 30 km with two batteries","grupo":"Manufacturer sheet"},{"clave":"Gross weight","valor":"27 kg","grupo":"Manufacturer sheet"},{"clave":"Maximum load","valor":"120 kg","grupo":"Manufacturer sheet"},{"clave":"Brake","valor":"Electromagnetic","grupo":"Manufacturer sheet"},{"clave":"Battery","valor":"Removable lithium","grupo":"Manufacturer sheet"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -2
    ),
(
      'fcf7861d-5994-544a-af1b-419f7a171de1'::uuid,
      'scooter-electrico-4-ruedas-plegable-ultraligero-zuowei-zw502',
      'ZW502',
      '01a7591f-3603-4342-a698-d626fb8756e9'::uuid,
      'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b04'::uuid,
      'Scooter eléctrico de 4 ruedas plegable Zuowei ZW502',
      'Zuowei ZW502 foldable 4-wheel electric scooter',
      'Scooter eléctrico de 4 ruedas en aluminio, peso neto de 16 kg, plegado en 1 segundo y velocidad de 8 km/h. El fabricante indica que cabe en el baúl.',
      'Four-wheel aluminum electric scooter, 16 kg net weight, folds in 1 second and travels at 8 km/h. The manufacturer states that it fits in a car trunk.',
      'Scooter eléctrico de 4 ruedas en aluminio, peso neto de 16 kg, plegado en 1 segundo y velocidad de 8 km/h. El fabricante indica que cabe en el baúl.

Precio bajo cotización. Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito. WhatsApp +57 313 724 7353.',
      'Four-wheel aluminum electric scooter, 16 kg net weight, folds in 1 second and travels at 8 km/h. The manufacturer states that it fits in a car trunk.

Price on request. Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing. WhatsApp +57 313 724 7353.',
      '[{"clave":"Modelo","valor":"ZW502","grupo":"Ficha del fabricante"},{"clave":"Fabricante","valor":"Shenzhen Zuowei Technology","grupo":"Ficha del fabricante"},{"clave":"Ruedas","valor":"4","grupo":"Ficha del fabricante"},{"clave":"Material","valor":"Aluminio","grupo":"Ficha del fabricante"},{"clave":"Peso neto","valor":"16 kg","grupo":"Ficha del fabricante"},{"clave":"Plegado","valor":"1 segundo","grupo":"Ficha del fabricante"},{"clave":"Velocidad","valor":"8 km/h","grupo":"Ficha del fabricante"},{"clave":"Motor","valor":"DC","grupo":"Ficha del fabricante"},{"clave":"Pendiente","valor":"≥6°","grupo":"Ficha del fabricante"},{"clave":"Transporte","valor":"Cabe en el baúl","grupo":"Ficha del fabricante"},{"clave":"Garantía","valor":"Garantía del fabricante (Shenzhen Zuowei Technology). El plazo se confirma por escrito.","grupo":"Garantía"}]'::jsonb,
      ARRAY['Movilidad personal. El fabricante indica que cabe en el baúl']::text[],
      ARRAY['Personal mobility. The manufacturer states that it fits in a car trunk']::text[],
      '/assets/productos/zuowei/scooter-electrico-4-ruedas-plegable-ultraligero-zuowei-zw502/principal-zuowei-zw502-scooter-electrico-4-ruedas-plegable-ultraligero-colombia.webp',
      ARRAY['/assets/productos/zuowei/scooter-electrico-4-ruedas-plegable-ultraligero-zuowei-zw502/galeria-zuowei-zw502-scooter-electrico-4-ruedas-plegable-ultraligero-colombia-01.webp', '/assets/productos/zuowei/scooter-electrico-4-ruedas-plegable-ultraligero-zuowei-zw502/galeria-zuowei-zw502-scooter-electrico-4-ruedas-plegable-ultraligero-colombia-02.webp', '/assets/productos/zuowei/scooter-electrico-4-ruedas-plegable-ultraligero-zuowei-zw502/galeria-zuowei-zw502-scooter-electrico-4-ruedas-plegable-ultraligero-colombia-03.webp']::text[],
      '{"marca":"Zuowei","fabricante":"Shenzhen Zuowei Technology","beneficios_es":["Peso neto de 16 kg","Plegado en 1 segundo","Marco de aluminio de 4 ruedas"],"beneficios_en":["16 kg net weight","Folds in 1 second","Four-wheel aluminum frame"],"valor_es":null,"valor_en":null,"preguntas_frecuentes_es":[],"preguntas_frecuentes_en":[],"seo_keywords_es":["scooter 4 ruedas","Zuowei ZW502","plegable"],"seo_keywords_en":["4-wheel scooter","Zuowei ZW502","foldable"],"alt_imagen_es":"Scooter eléctrico de 4 ruedas plegable y ultraligero Zuowei ZW502","alt_imagen_en":"Zuowei ZW502 ultralight foldable 4-wheel electric scooter","galeria_alt_es":["Scooter eléctrico de 4 ruedas plegable y ultraligero Zuowei ZW502","Scooter Zuowei ZW502 de aluminio, 16 kg, plegado","Detalle del maletero con el scooter Zuowei ZW502","Scooter eléctrico Zuowei ZW502 en un paseo exterior"],"galeria_alt_en":["Zuowei ZW502 ultralight foldable 4-wheel electric scooter","Zuowei ZW502 aluminum scooter, 16 kg, folded","Trunk detail with the Zuowei ZW502 scooter","Zuowei ZW502 electric scooter on an outdoor ride"],"imagen_ancho":800,"imagen_alto":800,"especificaciones_en":[{"clave":"Model","valor":"ZW502","grupo":"Manufacturer sheet"},{"clave":"Manufacturer","valor":"Shenzhen Zuowei Technology","grupo":"Manufacturer sheet"},{"clave":"Wheels","valor":"4","grupo":"Manufacturer sheet"},{"clave":"Material","valor":"Aluminum","grupo":"Manufacturer sheet"},{"clave":"Net weight","valor":"16 kg","grupo":"Manufacturer sheet"},{"clave":"Folding","valor":"1 second","grupo":"Manufacturer sheet"},{"clave":"Speed","valor":"8 km/h","grupo":"Manufacturer sheet"},{"clave":"Motor","valor":"DC","grupo":"Manufacturer sheet"},{"clave":"Gradient","valor":"≥6°","grupo":"Manufacturer sheet"},{"clave":"Transport","valor":"Fits in a car trunk","grupo":"Manufacturer sheet"},{"clave":"Warranty","valor":"Manufacturer warranty (Shenzhen Zuowei Technology). The term is confirmed in writing.","grupo":"Warranty"}],"linea":"zuowei-2026-10"}'::jsonb,
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      -1
    )
ON CONFLICT (slug) DO UPDATE SET
  sku = EXCLUDED.sku,
  familia_id = EXCLUDED.familia_id,
  tipo_id = EXCLUDED.tipo_id,
  nombre_es = EXCLUDED.nombre_es,
  nombre_en = EXCLUDED.nombre_en,
  descripcion_corta_es = EXCLUDED.descripcion_corta_es,
  descripcion_corta_en = EXCLUDED.descripcion_corta_en,
  descripcion_larga_es = EXCLUDED.descripcion_larga_es,
  descripcion_larga_en = EXCLUDED.descripcion_larga_en,
  especificaciones = EXCLUDED.especificaciones,
  aplicaciones_es = EXCLUDED.aplicaciones_es,
  aplicaciones_en = EXCLUDED.aplicaciones_en,
  imagen_principal = EXCLUDED.imagen_principal,
  galeria = EXCLUDED.galeria,
  atributos = COALESCE(productos.atributos, '{}'::jsonb) || EXCLUDED.atributos,
  tipo_comercial = EXCLUDED.tipo_comercial,
  fulfillment_mode = EXCLUDED.fulfillment_mode,
  precio = NULL,
  precio_regular = NULL,
  precio_oferta = NULL,
  moneda = EXCLUDED.moneda,
  stock = NULL,
  gestionar_stock = false,
  disponible = true,
  destacado = true,
  nuevo = true,
  activo = true,
  orden = EXCLUDED.orden;

UPDATE public.landings
SET
  version = version + 1,
  publicado_at = NOW(),
  contenido_es = jsonb_set(
    jsonb_set(
      contenido_es,
      '{lead}',
      to_jsonb('I-ME distribuye robots de servicio, limpieza autónoma, recepción, telepresencia y logística AMR para clínicas, hoteles, universidades y empresas en Colombia, y atiende proyectos de ingeniería robótica en Latinoamérica. Ocho robots de servicio están en catálogo. La rehabilitación de la marcha suma los Zuowei ZW568, ZW598 y ZW518. Otras arquitecturas se ingenian bajo proyecto.'::text)
    ),
    '{faqs,0,a}',
    to_jsonb('I-ME (International Medical Enterprise IME S.A.S.) distribuye en Colombia los ocho robots de servicio del catálogo activo: PadBot X3, PadBot X2, PadBot P2, PadBot W2, PadBot W3s, robot C3 de limpieza autónoma, PadBot T2 y Cruzr (AHuman Future). La rehabilitación de la marcha suma el exoesqueleto Zuowei ZW568, el exoesqueleto Zuowei ZW598 y la silla de bipedestación Zuowei ZW518. La cotización y el alcance de instalación se confirman por proyecto. WhatsApp +57 313 724 7353 · info@i-me.com.co.'::text)
  ),
  contenido_en = jsonb_set(
    jsonb_set(
      contenido_en,
      '{lead}',
      to_jsonb('I-ME distributes service, autonomous cleaning, reception, telepresence and AMR logistics robots for clinics, hotels, universities and companies in Colombia, and takes robotics engineering projects across Latin America. Eight service robots are in the catalog. Gait rehabilitation adds the Zuowei ZW568, ZW598 and ZW518. Other architectures are engineered per project.'::text)
    ),
    '{faqs,0,a}',
    to_jsonb('I-ME (International Medical Enterprise IME S.A.S.) distributes in Colombia the eight service robots in the active catalog: PadBot X3, PadBot X2, PadBot P2, PadBot W2, PadBot W3s, the C3 autonomous cleaning robot, PadBot T2 and Cruzr (AHuman Future). Gait rehabilitation adds the Zuowei ZW568 exoskeleton, the Zuowei ZW598 exoskeleton and the Zuowei ZW518 standing chair. Quote and installation scope are confirmed per project. WhatsApp +57 313 724 7353 · info@i-me.com.co.'::text)
  )
WHERE tipo = 'campana' AND clave = 'robotica_rehabilitacion';

INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE tipo = 'campana' AND clave = 'robotica_rehabilitacion'
ON CONFLICT (landing_id, version) DO NOTHING;
