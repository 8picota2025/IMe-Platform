-- PadBot es un robot de comunicación y recepción. Quita «telepresencia» del
-- texto visible (artículo, tipo y descripción de familia). El slug del tipo
-- se conserva: no hay URL pública que lo use como titular.

UPDATE public.articulos
   SET cuerpo_es = replace(
         replace(
           replace(
             cuerpo_es,
             'Los **robots de servicio** (recepción, telepresencia, delivery institucional)',
             'Los **robots de servicio** (recepción, comunicación en la sede, delivery institucional)'
           ),
           '- **Telepresencia**: acompañamiento remoto, rondas administrativas, soporte a distancia.',
           '- **Comunicación en la sede**: video llamada y orientación. No diagnostica ni atiende pacientes.'
         ),
         '(recepción, telepresencia, delivery)',
         '(recepción, comunicación en la sede, delivery)'
       ),
       cuerpo_en = replace(
         replace(
           replace(
             cuerpo_en,
             '**Service robots** (reception, telepresence, institutional delivery)',
             '**Service robots** (reception, on-site communication, institutional delivery)'
           ),
           '- **Telepresence**: remote accompaniment, administrative rounds, distant support.',
           '- **On-site communication**: video calling and wayfinding. It does not diagnose or treat patients.'
         ),
         '(reception, telepresence, delivery)',
         '(reception, on-site communication, delivery)'
       ),
       updated_at = now()
 WHERE slug = 'robots-asistenciales-atencion-reduccion-carga-personal';

UPDATE public.articulos
   SET cuerpo_es = replace(replace(cuerpo_es, 'Telepresencia', 'Comunicación en la sede'), 'telepresencia', 'comunicación en la sede'),
       cuerpo_en = replace(replace(cuerpo_en, 'Telepresence', 'On-site communication'), 'telepresence', 'on-site communication'),
       updated_at = now()
 WHERE slug = 'robots-asistenciales-atencion-reduccion-carga-personal'
   AND (cuerpo_es ~* 'telepresencia' OR cuerpo_en ~* 'telepresence');

UPDATE public.tipos
   SET nombre_es = 'Robots de comunicación y recepción',
       nombre_en = 'Communication and reception robots'
 WHERE slug = 'robots-telepresencia';

UPDATE public.familias
   SET descripcion_es = 'Robots de servicio, recepción, comunicación, delivery, educación, limpieza y automatización operativa para instituciones de salud, hoteles, universidades, centros comerciales y empresas.',
       descripcion_en = 'Service, reception, on-site communication, delivery, education, cleaning and operational automation robots for healthcare institutions, hotels, universities, shopping centers and companies.'
 WHERE slug = 'robots';
