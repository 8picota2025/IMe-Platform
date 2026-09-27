-- Fase 2 (Knowledge Hub): despublica la "Guía Actualizada para Distribuidores,
-- Importación y Regulación (2025)". Decisión del usuario (2026-09-24), tras
-- la revisión del contenido:
-- - tabla de clases de riesgo INVIMA con tiempos de trámite, contenido que se
--   decidió no publicar por ahora (2026-09-23);
-- - cifras de mercado, porcentajes de costo total y cuotas de compra pública
--   sin fuente;
-- - competidores citados por nombre;
-- - errores regulatorios (atribuye a ANLA la habilitación de salas de
--   radiología; menciona una "acreditación HIMA").
-- La cubren con fuentes los dos artículos publicados en
-- 20260924130000_publicar_articulos_invima.sql.
--
-- No borra nada: sólo publicado = false. Para revertir:
--   UPDATE articulos SET publicado = true
--   WHERE slug = 'guia-actualizada-distribuidores-importacion-y-regulacion-2025-biomedicos';

UPDATE articulos
SET publicado = false
WHERE slug = 'guia-actualizada-distribuidores-importacion-y-regulacion-2025-biomedicos';
