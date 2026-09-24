-- Fase 2 (Knowledge Hub): la semilla de topic_clusters (20260922210000) dejó
-- los nombres en español sin tildes. El sitio usa los nombres públicos de
-- src/data/temas-conocimiento.ts; esto corrige la BD para el admin y para
-- cualquier tema sin entrada en ese archivo. Sólo cambia filas que siguen
-- con el nombre exacto de la semilla (no pisa ediciones manuales).

UPDATE topic_clusters tc
SET nombre_es = correccion.nombre_nuevo
FROM (
  VALUES
    ('ventilacion-terapia-respiratoria', 'Ventilacion / terapia respiratoria', 'Ventilación / terapia respiratoria'),
    ('movilidad-rehabilitacion', 'Movilidad / rehabilitacion', 'Movilidad / rehabilitación'),
    ('cardiologia-reanimacion', 'Cardiologia / reanimacion', 'Cardiología / reanimación'),
    ('financiacion', 'Financiacion', 'Financiación'),
    ('invima-regulacion', 'INVIMA / regulacion', 'INVIMA / regulación')
) AS correccion(slug, nombre_semilla, nombre_nuevo)
WHERE tc.slug = correccion.slug
  AND tc.nombre_es = correccion.nombre_semilla;
