-- PadBot P2: renombrado completo del slug y del texto (arreglos011126, ítem 7).
--
-- Quita «telepresencia» del slug y de los textos del producto, y «telemedicina» de las rutas de
-- archivo. Se describe como robot de comunicación y videollamada para recepción y atención.
-- Quita las keywords de uso clínico u hospitalario de atributos.seo_keywords_*.
-- Registra el slug antiguo en atributos.legacy_slugs. Las redirecciones 301 están en public/.htaccess.
--
-- Las tablas de analítica, leads y solicitudes guardan el slug como histórico; no se reescriben.
-- Los archivos ya están renombrados en public/assets/productos/importados/padbot-p2-robot-comunicacion/.
--
-- NO aplicar a producción sin OK explícito.

DO $$
DECLARE
  filas integer;
BEGIN
  UPDATE productos
     SET slug = 'padbot-p2-robot-comunicacion-ref-padbot-p2-padbot',
         nombre_es = 'PadBot P2 Robot de Comunicación y Videollamada',
         nombre_en = 'PadBot P2 Communication and Video Call Robot',
         descripcion_corta_es = replace(descripcion_corta_es,
           'Robot de telepresencia plegable', 'Robot plegable'),
         descripcion_corta_en = replace(descripcion_corta_en,
           'Foldable telepresence robot', 'Foldable communication robot'),
         descripcion_larga_es = replace(descripcion_larga_es,
           'Para presencia remota en Colombia, Latinoamérica y España, este modelo cubre búsquedas de robot de telepresencia',
           'Para comunicación remota en Colombia, Latinoamérica y España, este modelo cubre búsquedas de robot de videollamada'),
         descripcion_larga_en = replace(descripcion_larga_en,
           'For remote presence in Colombia, Latin America and Spain, this model covers searches for telepresence robots',
           'For remote communication in Colombia, Latin America and Spain, this model covers searches for video call robots'),
         aplicaciones_es = ARRAY[
           'Comunicación y videollamada en instalaciones',
           'Rondas administrativas remotas',
           'Visitas remotas',
           'Videollamada y control remoto',
           'Automatización comercial e industrial de servicios'],
         aplicaciones_en = ARRAY[
           'Communication and video calls on site',
           'Remote administrative rounds',
           'Remote visits',
           'Video calls and remote control',
           'Commercial and industrial service automation'],
         imagen_principal = replace(replace(replace(replace(imagen_principal,
           'padbot-p2-robot-telepresencia', 'padbot-p2-robot-comunicacion'),
           'robot-producto-robot-telepresencia-telemedicina-tercera-edad-padbot-p2', 'robot-producto-padbot-p2'),
           'robot-galeria-robot-telepresencia-telemedicina-tercera-edad-padbot-p2', 'robot-galeria-padbot-p2'),
           'ficha-padbot-p2-robot-telepresencia', 'ficha-padbot-p2-robot-comunicacion'),
         ficha_pdf = replace(replace(replace(replace(ficha_pdf,
           'padbot-p2-robot-telepresencia', 'padbot-p2-robot-comunicacion'),
           'robot-producto-robot-telepresencia-telemedicina-tercera-edad-padbot-p2', 'robot-producto-padbot-p2'),
           'robot-galeria-robot-telepresencia-telemedicina-tercera-edad-padbot-p2', 'robot-galeria-padbot-p2'),
           'ficha-padbot-p2-robot-telepresencia', 'ficha-padbot-p2-robot-comunicacion'),
         galeria = ARRAY(
           SELECT replace(replace(replace(replace(g,
             'padbot-p2-robot-telepresencia', 'padbot-p2-robot-comunicacion'),
             'robot-producto-robot-telepresencia-telemedicina-tercera-edad-padbot-p2', 'robot-producto-padbot-p2'),
             'robot-galeria-robot-telepresencia-telemedicina-tercera-edad-padbot-p2', 'robot-galeria-padbot-p2'),
             'ficha-padbot-p2-robot-telepresencia', 'ficha-padbot-p2-robot-comunicacion')
           FROM unnest(galeria) WITH ORDINALITY AS t(g, i)
           ORDER BY i),
         atributos = jsonb_set(
           jsonb_set(
             jsonb_set(
               replace(replace(replace(replace(atributos::text,
                 'padbot-p2-robot-telepresencia', 'padbot-p2-robot-comunicacion'),
                 'robot-producto-robot-telepresencia-telemedicina-tercera-edad-padbot-p2', 'robot-producto-padbot-p2'),
                 'robot-galeria-robot-telepresencia-telemedicina-tercera-edad-padbot-p2', 'robot-galeria-padbot-p2'),
                 'ficha-padbot-p2-robot-telepresencia', 'ficha-padbot-p2-robot-comunicacion')::jsonb,
               '{seo_keywords_es}',
               COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements_text(atributos->'seo_keywords_es') AS k
                          WHERE k !~* 'cl.nica|hospital|centros? m.dico'), '[]'::jsonb),
               true),
             '{seo_keywords_en}',
             COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements_text(atributos->'seo_keywords_en') AS k
                        WHERE k !~* 'clinic|hospital|medical center'), '[]'::jsonb),
             true),
           '{legacy_slugs}',
           COALESCE(atributos->'legacy_slugs', '[]'::jsonb) || '["padbot-p2-robot-telepresencia-ref-padbot-p2-padbot"]'::jsonb,
           true)
     WHERE slug = 'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot';

  GET DIAGNOSTICS filas = ROW_COUNT;
  IF filas <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 fila PadBot P2 y se actualizaron %', filas;
  END IF;
END $$;
