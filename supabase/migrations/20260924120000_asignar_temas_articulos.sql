-- Fase 2 (Knowledge Hub): asigna tema (topic_clusters, ADR-0014) a los
-- artículos ya publicados. Debe coincidir con
-- src/data/conocimiento-borradores/asignacion-temas.json, que es lo que el
-- preview local muestra antes de aplicar esto (lo verifica
-- src/lib/conocimiento-clusters.test.ts).
--
-- Sólo toca artículos sin tema (cluster_id IS NULL): no pisa una asignación
-- hecha a mano después. Sin tema a propósito: páginas institucionales (ime-*),
-- artículos que no encajan en ningún tema piloto, y la guía de distribuidores
-- 2025 (pendiente de decisión por su contenido).

UPDATE articulos a
SET cluster_id = tc.id
FROM (
  VALUES
    ('guia-monitores-multiparametricos-uci', 'monitoreo-uci'),
    ('checklist-compra-desfibrilador-documentacion', 'cardiologia-reanimacion'),
    ('criterios-hospitalarios-ventilacion-mecanica', 'ventilacion-terapia-respiratoria'),
    ('caminadores-para-adultos-guia-compra-colombia', 'movilidad-rehabilitacion'),
    ('financiamiento-equipos-medicos-colombia', 'financiacion'),
    ('ime-financiamiento', 'financiacion')
) AS asignacion(articulo_slug, tema_slug)
JOIN topic_clusters tc ON tc.slug = asignacion.tema_slug
WHERE a.slug = asignacion.articulo_slug
  AND a.cluster_id IS NULL;
