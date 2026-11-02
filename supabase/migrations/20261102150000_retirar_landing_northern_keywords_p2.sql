-- Retira la landing del fabricante Northern (fab_northern) del CMS: la ruta ya no existe en el
-- código y el build falla con REQUIRE_LIVE_DATA si la fila sigue en la tabla. Borradores e
-- historial se eliminan en cascada. La URL antigua redirige por 301 en public/.htaccess.
-- Quita también las keywords SEO con telepresencia/telemedicina del PadBot P2.

DELETE FROM public.landings WHERE tipo = 'fabricante' AND clave = 'fab_northern';

UPDATE public.productos
   SET atributos = jsonb_set(
         jsonb_set(atributos,
           '{seo_keywords_es}',
           COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements_text(atributos->'seo_keywords_es') AS k
                      WHERE k !~* 'telepres|telemedic'), '[]'::jsonb), true),
         '{seo_keywords_en}',
         COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements_text(atributos->'seo_keywords_en') AS k
                    WHERE k !~* 'telepres|telemedic'), '[]'::jsonb), true),
       updated_at = now()
 WHERE slug = 'padbot-p2-robot-comunicacion-ref-padbot-p2-padbot';
