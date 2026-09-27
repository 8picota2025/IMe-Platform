-- Fase 2 (Knowledge Hub): asigna tema (topic_clusters, ADR-0014) a los
-- artículos ya publicados. Es la asignación revisada en el preview local
-- (PREVIEW_DRAFTS) antes de aplicar esto.
--
-- Sólo toca artículos sin tema (cluster_id IS NULL): no pisa una asignación
-- hecha a mano después. Sin tema a propósito: páginas institucionales (ime-*),
-- artículos que no encajan en ningún tema piloto, y la guía de distribuidores
-- 2025 (se despublica en 20260924130100).

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
