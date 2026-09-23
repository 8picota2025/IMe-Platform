-- ADR-0014: taxonomia de topic clusters para el Knowledge Hub.
-- Hoy /es/conocimiento/ es un grid plano sin categoria/tag/cluster
-- (supabase/schema.sql, tabla articulos no tenia estos campos). Tabla de
-- referencia + 2 columnas nuevas en articulos, ambas nullable (ningun
-- articulo existente se rompe). Semilla: los clusters con profundidad real
-- ya identificados en el discovery de Fase 0
-- (docs/growth-engine/IMPLEMENTATION_PLAN.md); NO fija cual es el cluster
-- piloto (decision de negocio aparte, seccion 16 del plan).

CREATE TABLE IF NOT EXISTS topic_clusters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  nombre_es    TEXT NOT NULL,
  nombre_en    TEXT NOT NULL,
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE articulos
  ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES topic_clusters(id),
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_articulos_cluster_id ON articulos(cluster_id);
CREATE INDEX IF NOT EXISTS idx_topic_clusters_slug ON topic_clusters(slug);

ALTER TABLE topic_clusters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_clusters_select_public" ON topic_clusters;
CREATE POLICY "topic_clusters_select_public"
  ON topic_clusters FOR SELECT
  TO anon, authenticated
  USING (activo = true);

DROP POLICY IF EXISTS "topic_clusters_admin_all" ON topic_clusters;
CREATE POLICY "topic_clusters_admin_all"
  ON topic_clusters FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo', 'ventas']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'ventas']));

-- Semilla: clusters con profundidad real hoy (landing + keywords +
-- contenido + catalogo), segun el subagente de discovery SEO de Fase 0.
-- ON CONFLICT DO NOTHING: reejecutable, no pisa ediciones manuales.
INSERT INTO topic_clusters (slug, nombre_es, nombre_en, descripcion) VALUES
  ('monitoreo-uci', 'Monitoreo / UCI', 'Monitoring / ICU',
   'Monitores multiparametricos y cardiologia. Cluster con mayor profundidad hoy: family hub, landing /es/monitores-biolight-uci/, keywords top-20, 2 articulos, PDPs.'),
  ('ventilacion-terapia-respiratoria', 'Ventilacion / terapia respiratoria', 'Ventilation / respiratory therapy',
   'Ventiladores y soporte vital respiratorio. Landings /es/ventiladores-mecanicos-uci/ y /es/alto-flujo-fisher-paykel/, 1 articulo.'),
  ('movilidad-rehabilitacion', 'Movilidad / rehabilitacion', 'Mobility / rehabilitation',
   'Caminadores y sillas de ruedas. Unico cluster con hub->articulo ya conectado en FAMILIA_HUB_LINKS.'),
  ('cardiologia-reanimacion', 'Cardiologia / reanimacion', 'Cardiology / resuscitation',
   'Desfibriladores y equipos de reanimacion. Landing /es/desfibriladores-hospitalarios/, 1 articulo.'),
  ('financiacion', 'Financiacion', 'Financing',
   'SimuladorFinanciero.astro en produccion, 1 articulo. Contenido de tasas reales bloqueado por firma legal pendiente (ver PENDIENTES.md) — no publicar contenido nuevo de este cluster hasta resolver ese bloqueante.'),
  ('invima-regulacion', 'INVIMA / regulacion', 'INVIMA / regulatory',
   'Sin contenido publicado hoy; datos ya existen (invima-knowledge-base.json, sin usar). Candidato fuerte solo despues de que exista el modelo de evidencia (ADR-0013) — no antes.')
ON CONFLICT (slug) DO NOTHING;
