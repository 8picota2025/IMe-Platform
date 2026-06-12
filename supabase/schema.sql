-- ============================================================
-- I-ME Platform — Schema SQL idempotente
-- Ejecutar en Supabase SQL Editor
-- TODO_CLIENTE: Ejecutar en proyecto Supabase real
-- ============================================================

-- ── Extensiones ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Helper: updated_at trigger ──────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1. familias ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS familias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  nombre_es   TEXT NOT NULL,
  nombre_en   TEXT,
  descripcion_es TEXT,
  descripcion_en TEXT,
  orden       INT NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_familias_updated_at ON familias;
CREATE TRIGGER set_familias_updated_at
  BEFORE UPDATE ON familias
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── 2. tipos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tipos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id  UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  nombre_es   TEXT NOT NULL,
  nombre_en   TEXT,
  orden       INT NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(familia_id, slug)
);

-- ── 3. productos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE,
  familia_id            UUID REFERENCES familias(id) ON DELETE SET NULL,
  tipo_id               UUID REFERENCES tipos(id) ON DELETE SET NULL,
  nombre_es             TEXT NOT NULL,
  nombre_en             TEXT,
  descripcion_corta_es  TEXT,
  descripcion_corta_en  TEXT,
  descripcion_larga_es  TEXT,
  descripcion_larga_en  TEXT,
  especificaciones      JSONB NOT NULL DEFAULT '[]',
  aplicaciones_es       TEXT[],
  aplicaciones_en       TEXT[],
  imagen_principal      TEXT,
  galeria               TEXT[] NOT NULL DEFAULT '{}',
  ficha_pdf             TEXT,
  tipo_comercial        TEXT NOT NULL DEFAULT 'equipo'
                        CHECK (tipo_comercial IN ('consumible', 'equipo')),
  fulfillment_mode      TEXT NOT NULL DEFAULT 'cotizacion'
                        CHECK (fulfillment_mode IN ('dropship', 'cotizacion', 'individualizado')),
  precio                NUMERIC,           -- COP, CONFIDENCIAL si es precio_costo
  moneda                TEXT NOT NULL DEFAULT 'COP',
  stock                 INT,
  destacado             BOOLEAN NOT NULL DEFAULT false,
  nuevo                 BOOLEAN NOT NULL DEFAULT false,
  activo                BOOLEAN NOT NULL DEFAULT true,
  orden                 INT NOT NULL DEFAULT 0,
  -- Embeddings Voyage voyage-3 (1024 dims). Cambiar proveedor = re-embeber todo.
  embedding             vector(1024),
  busqueda_tsv          TSVECTOR,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_productos_updated_at ON productos;
CREATE TRIGGER set_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Trigger busqueda_tsv
CREATE OR REPLACE FUNCTION update_productos_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.busqueda_tsv =
    to_tsvector('spanish', COALESCE(NEW.nombre_es, ''))      ||
    to_tsvector('spanish', COALESCE(NEW.descripcion_corta_es, '')) ||
    to_tsvector('english', COALESCE(NEW.nombre_en, ''))       ||
    to_tsvector('english', COALESCE(NEW.descripcion_corta_en, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS productos_tsv_update ON productos;
CREATE TRIGGER productos_tsv_update
  BEFORE INSERT OR UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_productos_tsv();

-- Índices productos
CREATE INDEX IF NOT EXISTS idx_productos_slug        ON productos(slug);
CREATE INDEX IF NOT EXISTS idx_productos_familia_id  ON productos(familia_id);
CREATE INDEX IF NOT EXISTS idx_productos_tipo_id     ON productos(tipo_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo      ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_destacado   ON productos(destacado);
CREATE INDEX IF NOT EXISTS idx_productos_specs_gin   ON productos USING GIN (especificaciones);
CREATE INDEX IF NOT EXISTS idx_productos_tsv_gin     ON productos USING GIN (busqueda_tsv);
-- HNSW para búsqueda vectorial (activo cuando vector extension disponible)
CREATE INDEX IF NOT EXISTS idx_productos_embedding_hnsw
  ON productos USING hnsw (embedding vector_cosine_ops);

-- ── 4. solicitudes_cotizacion ────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes_cotizacion (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                   TEXT NOT NULL,
  empresa                  TEXT,
  email                    TEXT NOT NULL,
  telefono                 TEXT NOT NULL,
  productos                JSONB NOT NULL DEFAULT '[]',
  mensaje                  TEXT,
  consentimiento_datos     BOOLEAN NOT NULL DEFAULT false,
  consentimiento_timestamp TIMESTAMPTZ,
  leida                    BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. pedidos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente                  JSONB NOT NULL,
  items                    JSONB NOT NULL,
  subtotal                 NUMERIC NOT NULL,
  total                    NUMERIC NOT NULL,
  moneda                   TEXT NOT NULL DEFAULT 'COP',
  mercado                  TEXT NOT NULL DEFAULT 'CO'
                           CHECK (mercado IN ('CO', 'INTL')),
  proveedor_pago           TEXT NOT NULL
                           CHECK (proveedor_pago IN ('wompi', 'stripe')),
  estado                   TEXT NOT NULL DEFAULT 'pendiente',
  referencia_pasarela      TEXT UNIQUE,
  checkout_url             TEXT,
  fulfillment_id           UUID,  -- FK a fulfillments (ver tabla 11)
  metadata                 JSONB NOT NULL DEFAULT '{}',
  consentimiento_datos     BOOLEAN NOT NULL DEFAULT false,
  consentimiento_timestamp TIMESTAMPTZ,
  leida                    BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_pedidos_updated_at ON pedidos;
CREATE TRIGGER set_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── 6. eventos_pago ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos_pago (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_pago      TEXT NOT NULL CHECK (proveedor_pago IN ('wompi', 'stripe')),
  event_id            TEXT NOT NULL,
  referencia_pasarela TEXT,
  payload             JSONB NOT NULL,
  procesado           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proveedor_pago, event_id)
);

-- ── 7. articulos (CMS básico) ────────────────────────────────
CREATE TABLE IF NOT EXISTS articulos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  titulo_es  TEXT NOT NULL,
  titulo_en  TEXT,
  cuerpo_es  TEXT,
  cuerpo_en  TEXT,
  publicado  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_articulos_updated_at ON articulos;
CREATE TRIGGER set_articulos_updated_at
  BEFORE UPDATE ON articulos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── 8. llm_uso, asesor_uso, asesor_rate_limit (Fase Asesor) ──
CREATE TABLE IF NOT EXISTS llm_uso (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_yyyy_mm TEXT NOT NULL,
  proveedor       TEXT NOT NULL,
  modelo          TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('chat', 'ingesta', 'embedding')),
  input_tokens    INT NOT NULL DEFAULT 0,
  output_tokens   INT NOT NULL DEFAULT 0,
  coste_estimado  NUMERIC NOT NULL DEFAULT 0,
  session_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_uso_periodo ON llm_uso(periodo_yyyy_mm);
CREATE INDEX IF NOT EXISTS idx_llm_uso_tipo    ON llm_uso(tipo);

CREATE TABLE IF NOT EXISTS asesor_uso (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL,
  locale          TEXT NOT NULL CHECK (locale IN ('es', 'en')),
  modo            TEXT NOT NULL CHECK (modo IN ('rag', 'keyword_degradado', 'sin_resultados')),
  turnos          INT NOT NULL DEFAULT 1,
  tokens_totales  INT NOT NULL DEFAULT 0,
  coste_estimado  NUMERIC NOT NULL DEFAULT 0,
  latencia_ms     INT NOT NULL DEFAULT 0,
  hubo_handoff    BOOLEAN NOT NULL DEFAULT false,
  tipo_handoff    TEXT CHECK (tipo_handoff IN ('whatsapp', 'cotizacion', 'compra')),
  periodo_yyyy_mm TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asesor_uso_periodo ON asesor_uso(periodo_yyyy_mm);
CREATE INDEX IF NOT EXISTS idx_asesor_uso_session ON asesor_uso(session_id);

-- Rate-limit por identificador ('ip:<ip>' o 'session:<id>'): ventana corta + tope diario
CREATE TABLE IF NOT EXISTS asesor_rate_limit (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador    TEXT NOT NULL UNIQUE,
  ventana_inicio   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contador_ventana INT NOT NULL DEFAULT 0,
  dia              DATE NOT NULL DEFAULT CURRENT_DATE,
  contador_dia     INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asesor_rate_limit_identificador ON asesor_rate_limit(identificador);

-- ── 9. proveedores (módulo dropshipping) ────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,
  nombre             TEXT NOT NULL,
  contacto_email     TEXT,
  contacto_whatsapp  TEXT,
  canal              TEXT NOT NULL DEFAULT 'email'
                     CHECK (canal IN ('email', 'whatsapp', 'webhook', 'api', 'manual')),
  webhook_url        TEXT,
  api_config         JSONB,
  notas              TEXT,
  activo             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_proveedores_updated_at ON proveedores;
CREATE TRIGGER set_proveedores_updated_at
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── 10. proveedor_producto (precio CONFIDENCIAL) ─────────────
CREATE TABLE IF NOT EXISTS proveedor_producto (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id   UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  producto_id    UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  -- CONFIDENCIAL: precio_costo NUNCA en APIs públicas ni cliente
  precio_costo   NUMERIC NOT NULL,
  moneda_costo   TEXT NOT NULL DEFAULT 'COP',
  prioridad      INT NOT NULL DEFAULT 1, -- 1 = proveedor preferente
  activo         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(proveedor_id, producto_id)
);

-- ── 11. fulfillments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fulfillments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id        UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  proveedor_id     UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','notificado','preparando','enviado','entregado','cancelado','error')),
  tracking_number  TEXT,
  tracking_url     TEXT,
  notas            TEXT,
  notificado_at    TIMESTAMPTZ,
  enviado_at       TIMESTAMPTZ,
  entregado_at     TIMESTAMPTZ,
  error_detalle    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK pedidos.fulfillment_id → fulfillments (añadir después de crear fulfillments)
ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS fk_pedidos_fulfillment;
ALTER TABLE pedidos
  ADD CONSTRAINT fk_pedidos_fulfillment
  FOREIGN KEY (fulfillment_id) REFERENCES fulfillments(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_fulfillments_updated_at ON fulfillments;
CREATE TRIGGER set_fulfillments_updated_at
  BEFORE UPDATE ON fulfillments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── Storage buckets ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('productos', 'productos', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('fichas', 'fichas', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('articulos', 'articulos', true)
  ON CONFLICT (id) DO NOTHING;

-- ── RLS ─────────────────────────────────────────────────────

-- familias: SELECT público (activo); escritura solo authenticated
ALTER TABLE familias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "familias_select_public" ON familias;
CREATE POLICY "familias_select_public"
  ON familias FOR SELECT
  USING (activo = true);
DROP POLICY IF EXISTS "familias_write_auth" ON familias;
CREATE POLICY "familias_write_auth"
  ON familias FOR ALL
  USING (auth.role() = 'authenticated');

-- tipos: SELECT público; escritura solo authenticated
ALTER TABLE tipos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tipos_select_public" ON tipos;
CREATE POLICY "tipos_select_public"
  ON tipos FOR SELECT
  USING (activo = true);
DROP POLICY IF EXISTS "tipos_write_auth" ON tipos;
CREATE POLICY "tipos_write_auth"
  ON tipos FOR ALL
  USING (auth.role() = 'authenticated');

-- productos: SELECT público (activo); escritura solo authenticated
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "productos_select_public" ON productos;
CREATE POLICY "productos_select_public"
  ON productos FOR SELECT
  USING (activo = true);
DROP POLICY IF EXISTS "productos_write_auth" ON productos;
CREATE POLICY "productos_write_auth"
  ON productos FOR ALL
  USING (auth.role() = 'authenticated');

-- solicitudes_cotizacion: INSERT público; SELECT solo authenticated
ALTER TABLE solicitudes_cotizacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotizaciones_insert_public" ON solicitudes_cotizacion;
CREATE POLICY "cotizaciones_insert_public"
  ON solicitudes_cotizacion FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "cotizaciones_select_auth" ON solicitudes_cotizacion;
CREATE POLICY "cotizaciones_select_auth"
  ON solicitudes_cotizacion FOR SELECT
  USING (auth.role() = 'authenticated');

-- pedidos: INSERT/UPDATE/SELECT solo authenticated (escritura real por service_role en EF)
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedidos_auth_only" ON pedidos;
CREATE POLICY "pedidos_auth_only"
  ON pedidos FOR ALL
  USING (auth.role() = 'authenticated');

-- eventos_pago: solo service_role / authenticated
ALTER TABLE eventos_pago ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eventos_pago_auth_only" ON eventos_pago;
CREATE POLICY "eventos_pago_auth_only"
  ON eventos_pago FOR ALL
  USING (auth.role() = 'authenticated');

-- articulos: SELECT público (publicado); escritura solo authenticated
ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "articulos_select_public" ON articulos;
CREATE POLICY "articulos_select_public"
  ON articulos FOR SELECT
  USING (publicado = true);
DROP POLICY IF EXISTS "articulos_write_auth" ON articulos;
CREATE POLICY "articulos_write_auth"
  ON articulos FOR ALL
  USING (auth.role() = 'authenticated');

-- llm_uso / asesor_uso: lectura solo authenticated (panel admin); escritura via service_role
ALTER TABLE llm_uso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "llm_uso_select_auth" ON llm_uso;
CREATE POLICY "llm_uso_select_auth"
  ON llm_uso FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE asesor_uso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asesor_uso_select_auth" ON asesor_uso;
CREATE POLICY "asesor_uso_select_auth"
  ON asesor_uso FOR SELECT
  USING (auth.role() = 'authenticated');

-- asesor_rate_limit: sin politicas (deny-all a anon/authenticated); solo service_role (bypassa RLS)
ALTER TABLE asesor_rate_limit ENABLE ROW LEVEL SECURITY;

-- proveedores: solo authenticated
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proveedores_auth_only" ON proveedores;
CREATE POLICY "proveedores_auth_only"
  ON proveedores FOR ALL
  USING (auth.role() = 'authenticated');

-- proveedor_producto: solo authenticated (precio_costo NUNCA en APIs públicas)
ALTER TABLE proveedor_producto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proveedor_producto_auth_only" ON proveedor_producto;
CREATE POLICY "proveedor_producto_auth_only"
  ON proveedor_producto FOR ALL
  USING (auth.role() = 'authenticated');

-- fulfillments: solo authenticated
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fulfillments_auth_only" ON fulfillments;
CREATE POLICY "fulfillments_auth_only"
  ON fulfillments FOR ALL
  USING (auth.role() = 'authenticated');

-- ── RPC get_proveedor_para_producto ─────────────────────────
-- Devuelve proveedor preferente para un producto.
-- security definer: corre con permisos elevados.
-- NO expone precio_costo.
CREATE OR REPLACE FUNCTION get_proveedor_para_producto(p_producto_id UUID)
RETURNS TABLE (
  proveedor_id       UUID,
  canal              TEXT,
  contacto_email     TEXT,
  contacto_whatsapp  TEXT,
  webhook_url        TEXT,
  api_config         JSONB
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    pp.proveedor_id,
    p.canal,
    p.contacto_email,
    p.contacto_whatsapp,
    p.webhook_url,
    p.api_config
  FROM proveedor_producto pp
  JOIN proveedores p ON p.id = pp.proveedor_id
  WHERE pp.producto_id = p_producto_id
    AND pp.activo = true
    AND p.activo = true
  ORDER BY pp.prioridad ASC
  LIMIT 1;
$$;

-- ── RPC match_productos (Asesor RAG) ────────────────────────
-- Busqueda vectorial sobre productos.embedding (Voyage voyage-3, 1024 dims).
-- security definer: solo expone productos activos, sin precio_costo.
-- filtro jsonb opcional: {"familia_id":"...","tipo_id":"...","tipo_comercial":"..."}
CREATE OR REPLACE FUNCTION match_productos(
  query_embedding vector(1024),
  match_count INT DEFAULT 6,
  filtro JSONB DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  slug                 TEXT,
  nombre_es            TEXT,
  nombre_en            TEXT,
  descripcion_corta_es TEXT,
  descripcion_corta_en TEXT,
  imagen_principal     TEXT,
  tipo_comercial       TEXT,
  familia_id           UUID,
  tipo_id              UUID,
  score                FLOAT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.slug, p.nombre_es, p.nombre_en, p.descripcion_corta_es, p.descripcion_corta_en,
    p.imagen_principal, p.tipo_comercial, p.familia_id, p.tipo_id,
    1 - (p.embedding <=> query_embedding) AS score
  FROM productos p
  WHERE p.activo = true
    AND p.embedding IS NOT NULL
    AND (
      filtro IS NULL OR filtro = '{}'::jsonb OR (
        (NOT (filtro ? 'familia_id') OR p.familia_id::text = filtro->>'familia_id')
        AND (NOT (filtro ? 'tipo_id') OR p.tipo_id::text = filtro->>'tipo_id')
        AND (NOT (filtro ? 'tipo_comercial') OR p.tipo_comercial = filtro->>'tipo_comercial')
      )
    )
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── RPC buscar_productos_keyword (fallback Asesor) ──────────
-- Fallback por texto (busqueda_tsv) cuando falla el vector o se agota presupuesto.
-- security definer: solo expone productos activos, sin precio_costo.
CREATE OR REPLACE FUNCTION buscar_productos_keyword(
  query_text TEXT,
  match_count INT DEFAULT 6,
  filtro JSONB DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  slug                 TEXT,
  nombre_es            TEXT,
  nombre_en            TEXT,
  descripcion_corta_es TEXT,
  descripcion_corta_en TEXT,
  imagen_principal     TEXT,
  tipo_comercial       TEXT,
  familia_id           UUID,
  tipo_id              UUID,
  score                FLOAT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.slug, p.nombre_es, p.nombre_en, p.descripcion_corta_es, p.descripcion_corta_en,
    p.imagen_principal, p.tipo_comercial, p.familia_id, p.tipo_id,
    ts_rank(p.busqueda_tsv, q.query) AS score
  FROM productos p,
       LATERAL (
         SELECT
           websearch_to_tsquery('spanish', query_text) ||
           websearch_to_tsquery('english', query_text) AS query
       ) q
  WHERE p.activo = true
    AND p.busqueda_tsv @@ q.query
    AND (
      filtro IS NULL OR filtro = '{}'::jsonb OR (
        (NOT (filtro ? 'familia_id') OR p.familia_id::text = filtro->>'familia_id')
        AND (NOT (filtro ? 'tipo_id') OR p.tipo_id::text = filtro->>'tipo_id')
        AND (NOT (filtro ? 'tipo_comercial') OR p.tipo_comercial = filtro->>'tipo_comercial')
      )
    )
  ORDER BY score DESC
  LIMIT match_count;
$$;

-- ── Storage RLS ──────────────────────────────────────────────
-- Lectura pública, escritura authenticated
CREATE POLICY "storage_productos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'productos')
  ;
-- (Supabase aplica estas políticas automáticamente si el bucket es public)
