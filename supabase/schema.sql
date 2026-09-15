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
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

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
  sku                   TEXT UNIQUE,
  gtin                  TEXT,
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
  atributos             JSONB NOT NULL DEFAULT '{}',
  peso_kg               NUMERIC,
  dimensiones_cm        JSONB NOT NULL DEFAULT '{}',
  tipo_comercial        TEXT NOT NULL DEFAULT 'equipo'
                        CHECK (tipo_comercial IN ('consumible', 'equipo')),
  fulfillment_mode      TEXT NOT NULL DEFAULT 'cotizacion'
                        CHECK (fulfillment_mode IN ('dropship', 'cotizacion', 'individualizado')),
  precio                NUMERIC,           -- COP, CONFIDENCIAL si es precio_costo
  precio_regular        NUMERIC,
  precio_oferta         NUMERIC,
  oferta_inicio         TIMESTAMPTZ,
  oferta_fin            TIMESTAMPTZ,
  moneda                TEXT NOT NULL DEFAULT 'COP',
  stock                 INT,
  gestionar_stock       BOOLEAN NOT NULL DEFAULT false,
  stock_estado          TEXT NOT NULL DEFAULT 'instock'
                        CHECK (stock_estado IN ('instock', 'outofstock', 'onbackorder')),
  backorder_policy      TEXT NOT NULL DEFAULT 'no'
                        CHECK (backorder_policy IN ('no', 'notify', 'yes')),
  dian_codigo           TEXT,
  tarifa_iva_pct        NUMERIC,
  retencion_fuente_pct  NUMERIC,
  retencion_iva_pct     NUMERIC,
  retencion_ica_pct     NUMERIC,
  excluido_iva          BOOLEAN NOT NULL DEFAULT false,
  -- Escenario A: el proveedor flaguea disponibilidad en tiempo real.
  -- false → fuera de catálogo activo para venta, carrito y crear-pago (422).
  disponible              BOOLEAN NOT NULL DEFAULT true,
  disponible_actualizado_at TIMESTAMPTZ,
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
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.busqueda_tsv =
    to_tsvector('spanish', COALESCE(NEW.nombre_es, ''))      ||
    to_tsvector('spanish', COALESCE(NEW.descripcion_corta_es, '')) ||
    to_tsvector('english', COALESCE(NEW.nombre_en, ''))       ||
    to_tsvector('english', COALESCE(NEW.descripcion_corta_en, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS productos_tsv_update ON productos;
CREATE TRIGGER productos_tsv_update
  BEFORE INSERT OR UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_productos_tsv();

-- Columnas F4.1 (Escenario A) — ver huecos F1 §8.3/§8.5.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS disponible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS disponible_actualizado_at TIMESTAMPTZ;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dian_codigo TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tarifa_iva_pct NUMERIC;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS retencion_fuente_pct NUMERIC;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS retencion_iva_pct NUMERIC;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS retencion_ica_pct NUMERIC;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS excluido_iva BOOLEAN NOT NULL DEFAULT false;

-- Columnas agregadas post-F4 para paridad WooCommerce/B2B-B2C.
-- Deben ir antes de los índices de productos: en una BD existente
-- CREATE TABLE IF NOT EXISTS es un no-op, así que estas columnas
-- (incluida sku, referenciada por los índices de abajo) solo existen
-- tras ejecutar estos ALTER TABLE.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS gtin TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS atributos JSONB NOT NULL DEFAULT '{}';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS peso_kg NUMERIC;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dimensiones_cm JSONB NOT NULL DEFAULT '{}';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_regular NUMERIC;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_oferta NUMERIC;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS oferta_inicio TIMESTAMPTZ;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS oferta_fin TIMESTAMPTZ;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS gestionar_stock BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_estado TEXT NOT NULL DEFAULT 'instock';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS backorder_policy TEXT NOT NULL DEFAULT 'no';

DO $$
BEGIN
  ALTER TABLE productos ADD CONSTRAINT productos_stock_estado_check
    CHECK (stock_estado IN ('instock', 'outofstock', 'onbackorder'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE productos ADD CONSTRAINT productos_backorder_policy_check
    CHECK (backorder_policy IN ('no', 'notify', 'yes'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Índices productos
CREATE INDEX IF NOT EXISTS idx_productos_slug        ON productos(slug);
CREATE INDEX IF NOT EXISTS idx_productos_sku         ON productos(sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_sku_unique
  ON productos(sku)
  WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_productos_familia_id  ON productos(familia_id);
CREATE INDEX IF NOT EXISTS idx_productos_tipo_id     ON productos(tipo_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo      ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_destacado   ON productos(destacado);
CREATE INDEX IF NOT EXISTS idx_productos_specs_gin   ON productos USING GIN (especificaciones);
CREATE INDEX IF NOT EXISTS idx_productos_tsv_gin     ON productos USING GIN (busqueda_tsv);
-- HNSW para búsqueda vectorial (activo cuando vector extension disponible)
CREATE INDEX IF NOT EXISTS idx_productos_embedding_hnsw
  ON productos USING hnsw (embedding vector_cosine_ops);

-- ── 3b. producto_variantes ─────────────────────────────────
CREATE TABLE IF NOT EXISTS producto_variantes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id           UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  sku                   TEXT UNIQUE,
  nombre                TEXT NOT NULL,
  atributos             JSONB NOT NULL DEFAULT '{}',
  precio                NUMERIC,
  precio_regular        NUMERIC,
  precio_oferta         NUMERIC,
  moneda                TEXT NOT NULL DEFAULT 'COP',
  stock                 INT,
  gestionar_stock       BOOLEAN NOT NULL DEFAULT false,
  stock_estado          TEXT NOT NULL DEFAULT 'instock'
                        CHECK (stock_estado IN ('instock', 'outofstock', 'onbackorder')),
  activo                BOOLEAN NOT NULL DEFAULT true,
  orden                 INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_producto_variantes_updated_at ON producto_variantes;
CREATE TRIGGER set_producto_variantes_updated_at
  BEFORE UPDATE ON producto_variantes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_producto_variantes_producto ON producto_variantes(producto_id);
CREATE INDEX IF NOT EXISTS idx_producto_variantes_sku ON producto_variantes(sku);

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
  -- Seguimiento comercial (F4.1 / IME_F4_Commerce_Pasarelas_v1.1 TAREA 6/8)
  estado                   TEXT NOT NULL DEFAULT 'nueva'
                           CHECK (estado IN (
                             'nueva', 'en_revision', 'respondida',
                             'enviada', 'convertida', 'expirada'
                           )),
  notas_internas           TEXT,
  condiciones              TEXT,
  validez_hasta            DATE,
  precio_total_ofertado    NUMERIC,
  oferta_enviada_at        TIMESTAMPTZ,
  formalizacion_token_hash TEXT,
  formalizacion_token_expira_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columnas F4.1 (Escenario A) — seguimiento comercial de cotizaciones.
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'nueva';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS notas_internas TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS condiciones TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS validez_hasta DATE;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS precio_total_ofertado NUMERIC;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS oferta_enviada_at TIMESTAMPTZ;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS formalizacion_token_hash TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS formalizacion_token_expira_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE solicitudes_cotizacion DROP CONSTRAINT IF EXISTS solicitudes_cotizacion_estado_check;
  ALTER TABLE solicitudes_cotizacion ADD CONSTRAINT solicitudes_cotizacion_estado_check
    CHECK (estado IN (
      'nueva', 'en_revision', 'respondida',
      'enviada', 'convertida', 'expirada'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4b. clientes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    TEXT NOT NULL UNIQUE,
  nombre                   TEXT,
  apellido                 TEXT,
  telefono                 TEXT,
  institucion              TEXT,
  tipo_cliente             TEXT NOT NULL DEFAULT 'b2b'
                           CHECK (tipo_cliente IN ('b2b', 'b2c', 'mixto')),
  documento_tipo           TEXT,
  documento_numero         TEXT,
  razon_social             TEXT,
  tipo_documento           TEXT,
  numero_documento         TEXT,
  tipo_persona             TEXT CHECK (tipo_persona IN ('natural', 'juridica')),
  responsable_iva          BOOLEAN NOT NULL DEFAULT false,
  agente_retencion         BOOLEAN NOT NULL DEFAULT false,
  agente_reteica           BOOLEAN NOT NULL DEFAULT false,
  email_facturacion        TEXT,
  direccion_facturacion    JSONB,
  consentimiento_datos     BOOLEAN NOT NULL DEFAULT false,
  consentimiento_timestamp TIMESTAMPTZ,
  notas                    TEXT,
  total_pedidos            INT NOT NULL DEFAULT 0,
  total_gastado            NUMERIC NOT NULL DEFAULT 0,
  ultimo_pedido_at         TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_clientes_updated_at ON clientes;
CREATE TRIGGER set_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON clientes(tipo_cliente);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS razon_social TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_documento TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero_documento TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_persona TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS responsable_iva BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS agente_retencion BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS agente_reteica BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email_facturacion TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion_facturacion JSONB;

CREATE TABLE IF NOT EXISTS cliente_direcciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL DEFAULT 'facturacion'
                  CHECK (tipo IN ('facturacion', 'envio', 'legal')),
  nombre          TEXT,
  telefono        TEXT,
  pais            TEXT NOT NULL DEFAULT 'CO',
  departamento    TEXT,
  ciudad          TEXT,
  direccion       TEXT NOT NULL,
  codigo_postal   TEXT,
  principal       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_cliente_direcciones_updated_at ON cliente_direcciones;
CREATE TRIGGER set_cliente_direcciones_updated_at
  BEFORE UPDATE ON cliente_direcciones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cliente_direcciones_cliente ON cliente_direcciones(cliente_id);

-- ── 5. pedidos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id               UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cliente                  JSONB NOT NULL,
  items                    JSONB NOT NULL,
  subtotal                 NUMERIC NOT NULL,
  subtotal_sin_impuestos   NUMERIC NOT NULL DEFAULT 0,
  descuento_total          NUMERIC NOT NULL DEFAULT 0,
  impuesto_total           NUMERIC NOT NULL DEFAULT 0,
  retencion_total          NUMERIC NOT NULL DEFAULT 0,
  envio_total              NUMERIC NOT NULL DEFAULT 0,
  total                    NUMERIC NOT NULL,
  moneda                   TEXT NOT NULL DEFAULT 'COP',
  mercado                  TEXT NOT NULL DEFAULT 'CO'
                           CHECK (mercado IN ('CO', 'INTL')),
  proveedor_pago           TEXT NOT NULL
                           CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi', 'transferencia')),
  -- valores: pendiente|pendiente_validacion|pagado|rechazado|expirado|cancelado|reembolsado|error_verificacion
  --          |procesando|enviado|entregado|retrasado
  -- (retrasado = rotura de stock post-pago, Escenario A; corresponde al ENUM
  --  estado_pedido de plataforma/prompts/IME_F4_Commerce_Pasarelas_v1.1.md)
  estado                   TEXT NOT NULL DEFAULT 'pendiente',
  referencia_pasarela      TEXT UNIQUE,
  checkout_url             TEXT,
  cupon_codigo             TEXT,
  direccion_facturacion    JSONB,
  direccion_envio          JSONB,
  facturacion_electronica_solicitada BOOLEAN NOT NULL DEFAULT false,
  facturacion_electronica_estado TEXT NOT NULL DEFAULT 'no_solicitada',
  fulfillment_id           UUID,  -- FK a fulfillments (ver tabla 11)
  metadata                 JSONB NOT NULL DEFAULT '{}',
  comprobante_pago_path    TEXT,
  comprobante_pago_nombre  TEXT,
  comprobante_subido_at    TIMESTAMPTZ,
  pago_validado_at         TIMESTAMPTZ,
  pago_validado_por        TEXT,
  consentimiento_datos     BOOLEAN NOT NULL DEFAULT false,
  consentimiento_timestamp TIMESTAMPTZ,
  leida                    BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cotizacion → pedido (FK despues de crear pedidos)
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_pedido_id
  ON solicitudes_cotizacion (pedido_id)
  WHERE pedido_id IS NOT NULL;

-- Quote PDF + send integrity (20260814170000)
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS pdf_sha256 TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS pdf_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS send_claimed_at TIMESTAMPTZ;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS send_error TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_cotizacion_numero_uidx
  ON solicitudes_cotizacion (numero)
  WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_created_by
  ON solicitudes_cotizacion (created_by);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_estado_created
  ON solicitudes_cotizacion (estado, created_at DESC);

DROP TRIGGER IF EXISTS set_solicitudes_cotizacion_updated_at ON solicitudes_cotizacion;
CREATE TRIGGER set_solicitudes_cotizacion_updated_at
  BEFORE UPDATE ON solicitudes_cotizacion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE SEQUENCE IF NOT EXISTS cotizacion_numero_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION next_cotizacion_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('cotizacion_numero_seq');
  RETURN 'IME-Q-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION ensure_cotizacion_numero(p_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_num TEXT;
BEGIN
  SELECT numero INTO current_num
  FROM solicitudes_cotizacion
  WHERE id = p_id
  FOR UPDATE;

  IF current_num IS NOT NULL AND btrim(current_num) <> '' THEN
    RETURN current_num;
  END IF;

  UPDATE solicitudes_cotizacion
  SET numero = next_cotizacion_numero()
  WHERE id = p_id
    AND (numero IS NULL OR btrim(numero) = '')
  RETURNING numero INTO current_num;

  RETURN current_num;
END;
$$;

CREATE OR REPLACE FUNCTION claim_cotizacion_send(p_id uuid)
RETURNS SETOF solicitudes_cotizacion
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE solicitudes_cotizacion
  SET
    send_claimed_at = NOW(),
    send_error = NULL,
    pdf_revision = COALESCE(pdf_revision, 0) + 1
  WHERE id = p_id
    AND pedido_id IS NULL
    AND estado IS DISTINCT FROM 'convertida'
    AND (
      send_claimed_at IS NULL
      OR send_claimed_at < NOW() - INTERVAL '2 minutes'
    )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION next_cotizacion_numero() FROM PUBLIC;
REVOKE ALL ON FUNCTION ensure_cotizacion_numero(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_cotizacion_send(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_cotizacion_numero() TO service_role;
GRANT EXECUTE ON FUNCTION ensure_cotizacion_numero(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION claim_cotizacion_send(uuid) TO service_role;
GRANT USAGE, SELECT ON SEQUENCE cotizacion_numero_seq TO service_role;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS subtotal_sin_impuestos NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descuento_total NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS impuesto_total NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS retencion_total NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio_total NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupon_codigo TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS direccion_facturacion JSONB;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS direccion_envio JSONB;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS facturacion_electronica_solicitada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS facturacion_electronica_estado TEXT NOT NULL DEFAULT 'no_solicitada';
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_proveedor_pago_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_proveedor_pago_check
  CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi', 'transferencia'));

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante_pago_path TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante_pago_nombre TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante_subido_at TIMESTAMPTZ;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_validado_at TIMESTAMPTZ;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_validado_por TEXT;
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_facturacion_electronica_estado_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_facturacion_electronica_estado_check
  CHECK (
    facturacion_electronica_estado IN (
      'no_solicitada',
      'pendiente_pago',
      'pendiente_envio',
      'emitida',
      'rechazada',
      'error'
    )
  );

DROP TRIGGER IF EXISTS set_pedidos_updated_at ON pedidos;
CREATE TRIGGER set_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS facturas_electronicas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
  proveedor       TEXT NOT NULL DEFAULT 'pendiente_configuracion',
  estado          TEXT NOT NULL DEFAULT 'pendiente_pago'
                  CHECK (estado IN ('pendiente_pago', 'pendiente_envio', 'emitida', 'rechazada', 'error')),
  numero_factura  TEXT,
  cufe            TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  respuesta       JSONB NOT NULL DEFAULT '{}',
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_facturas_electronicas_updated_at ON facturas_electronicas;
CREATE TRIGGER set_facturas_electronicas_updated_at
  BEFORE UPDATE ON facturas_electronicas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── 6. eventos_pago ─────────────────────────────────────────
-- Equivalente funcional a la tabla 'eventos_procesados' de
-- IME_F4_Commerce_Pasarelas_v1.1.md: idempotencia de webhooks por
-- (proveedor_pago, event_id). No se renombra.
CREATE TABLE IF NOT EXISTS eventos_pago (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_pago      TEXT NOT NULL CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi')),
  event_id            TEXT NOT NULL,
  referencia_pasarela TEXT,
  payload             JSONB NOT NULL,
  procesado           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proveedor_pago, event_id)
);
ALTER TABLE eventos_pago DROP CONSTRAINT IF EXISTS eventos_pago_proveedor_pago_check;
ALTER TABLE eventos_pago
  ADD CONSTRAINT eventos_pago_proveedor_pago_check
  CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi', 'transferencia'));

-- ── 6b. cupones y uso ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS cupones (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                  TEXT NOT NULL UNIQUE,
  descripcion             TEXT,
  tipo_descuento          TEXT NOT NULL
                          CHECK (tipo_descuento IN ('porcentaje', 'monto_carrito', 'monto_producto')),
  valor                   NUMERIC NOT NULL,
  moneda                  TEXT NOT NULL DEFAULT 'COP',
  activo                  BOOLEAN NOT NULL DEFAULT true,
  uso_individual          BOOLEAN NOT NULL DEFAULT false,
  excluir_ofertas         BOOLEAN NOT NULL DEFAULT false,
  envio_gratis            BOOLEAN NOT NULL DEFAULT false,
  monto_minimo            NUMERIC,
  monto_maximo            NUMERIC,
  productos_incluidos     TEXT[] NOT NULL DEFAULT '{}',
  productos_excluidos     TEXT[] NOT NULL DEFAULT '{}',
  familias_incluidas      TEXT[] NOT NULL DEFAULT '{}',
  familias_excluidas      TEXT[] NOT NULL DEFAULT '{}',
  emails_permitidos       TEXT[] NOT NULL DEFAULT '{}',
  limite_uso_total        INT,
  limite_uso_por_usuario  INT,
  usos                    INT NOT NULL DEFAULT 0,
  empieza_at              TIMESTAMPTZ,
  expira_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_cupones_updated_at ON cupones;
CREATE TRIGGER set_cupones_updated_at
  BEFORE UPDATE ON cupones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cupones_codigo ON cupones(codigo);
CREATE INDEX IF NOT EXISTS idx_cupones_activo ON cupones(activo);

CREATE TABLE IF NOT EXISTS cupon_usos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cupon_id     UUID NOT NULL REFERENCES cupones(id) ON DELETE CASCADE,
  pedido_id    UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  cliente_id   UUID REFERENCES clientes(id) ON DELETE SET NULL,
  email        TEXT,
  descuento    NUMERIC NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cupon_usos_cupon ON cupon_usos(cupon_id);
CREATE INDEX IF NOT EXISTS idx_cupon_usos_email ON cupon_usos(email);

-- ── 6c. notas/eventos de pedido ─────────────────────────────
CREATE TABLE IF NOT EXISTS pedido_notas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  autor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_email  TEXT,
  tipo         TEXT NOT NULL DEFAULT 'interna'
               CHECK (tipo IN ('interna', 'cliente', 'sistema')),
  nota         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_notas_pedido ON pedido_notas(pedido_id);

CREATE TABLE IF NOT EXISTS pedido_eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  tipo        TEXT NOT NULL,
  de_estado   TEXT,
  a_estado    TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_eventos_pedido ON pedido_eventos(pedido_id);

-- ── 7. articulos (CMS básico) ────────────────────────────────
CREATE TABLE IF NOT EXISTS articulos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  titulo_es  TEXT NOT NULL,
  titulo_en  TEXT,
  cuerpo_es  TEXT,
  cuerpo_en  TEXT,
  imagen     TEXT,
  publicado  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_articulos_updated_at ON articulos;
CREATE TRIGGER set_articulos_updated_at
  BEFORE UPDATE ON articulos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

INSERT INTO articulos (slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, publicado, created_at, updated_at)
VALUES
  (
    'como-elegir-un-monitor-biomedico',
    'Cómo elegir un monitor biomédico sin perder trazabilidad',
    'How to choose a biomedical monitor without losing traceability',
    '# Punto de partida

Antes de comparar especificaciones, define el contexto de uso: sala, UCI, transporte o quirófano.

- Verifica compatibilidad con la instalación clínica.
- Revisa servicio técnico y disponibilidad de consumibles.
- Documenta la decisión comercial y clínica.

> Una compra clara empieza por un caso de uso claro.

## Siguiente paso

Si necesitas apoyo, el equipo de I-ME puede ayudarte a estructurar el requerimiento.',
    '# Starting point

Before comparing specifications, define the operating context: ward, ICU, transport, or OR.

- Check compatibility with the clinical installation.
- Review technical support and consumables availability.
- Document the commercial and clinical decision.

> A clear purchase starts with a clear use case.

## Next step

If you need help, the I-ME team can help structure the requirement.',
    true,
    NOW(),
    NOW()
  ),
  (
    'rutina-basica-de-mantenimiento-preventivo',
    'Rutina básica de mantenimiento preventivo',
    'Basic preventive maintenance routine',
    '## Checklist operativo

1. Inspecciona el equipo antes de cada turno.
2. Registra alertas, fallas y consumibles.
3. Programa calibración y revisión técnica periódica.

Mantener una rutina simple evita paradas innecesarias.',
    '## Operational checklist

1. Inspect the device before each shift.
2. Record alerts, failures, and consumables.
3. Schedule calibration and periodic technical review.

Keeping a simple routine helps avoid unnecessary downtime.',
    true,
    NOW(),
    NOW()
  ),
  (
    'como-preparar-una-solicitud-de-cotizacion',
    'Cómo preparar una solicitud de cotización más precisa',
    'How to prepare a more accurate quote request',
    '### Incluye siempre

- Necesidad clínica concreta.
- Cantidad estimada.
- Condiciones de instalación.
- Restricciones de presupuesto o plazo.

Cuanto más clara sea la solicitud, mejor será la comparación entre alternativas.',
    '### Always include

- A concrete clinical need.
- Estimated quantity.
- Installation conditions.
- Budget or timeline constraints.

The clearer the request, the better the comparison between alternatives.',
    true,
    NOW(),
    NOW()
  ),
  (
    'clasificacion-de-dispositivos-medicos-invima',
    'Clasificación de dispositivos médicos según INVIMA (Colombia)',
    'Medical device classification under INVIMA (Colombia)',
    '# Clasificación por riesgo (Decreto 4725 de 2005)

INVIMA (Instituto Nacional de Vigilancia de Medicamentos y Alimentos) clasifica los dispositivos médicos en 4 clases según su nivel de riesgo. La clase determina la certificación exigida y el tiempo estimado de registro sanitario.

## Clase I — riesgo mínimo (registro en 60-90 días)
Ejemplos: equipos de protección personal, instrumentos simples, vendajes.
Certificación requerida: presunción de conformidad.
Requisitos: declaración de conformidad del fabricante, descripción del dispositivo, certificación del sistema de gestión de calidad (BPM).

## Clase II — riesgo moderado (4-6 meses)
Ejemplos: equipos de diagnóstico, monitores de presión, equipos de electrocardiografía.
Certificación requerida: conformidad evaluada.
Requisitos: estudio técnico de biocompatibilidad, certificación de sistema de gestión de calidad, evaluación de conformidad con estándares aplicables, descripción técnica del dispositivo, comprobaciones analíticas.

## Clase IIB — riesgo moderado-alto (8-12 meses)
Ejemplos: equipos quirúrgicos con energía, implantes óseos, sistemas de infusión.
Certificación requerida: conformidad evaluada con tercero notificado.
Requisitos: ensayos clínicos o pruebas de desempeño, evaluación de riesgos completa, certificación de calidad por terceros, estudios técnicos exhaustivos, declaración de conformidad.

## Clase III — riesgo alto (12-24 meses)
Ejemplos: implantes cardiovasculares, dispositivos neurales, implantes articulares.
Certificación requerida: aprobación previa de registro sanitario.
Requisitos: ensayos clínicos completos, evaluación de riesgos exhaustiva, certificación de organismo notificado, seguimiento post-comercialización, estudios de biocompatibilidad, pruebas de esterilidad y pirógenos.

> Esta clasificación es orientativa por tipo de dispositivo. La validación regulatoria final depende del producto específico y su documentación vigente ante INVIMA.

Fuente: invima.gov.co, sección dispositivos médicos y equipos biomédicos.',
    '# Risk classification (Decreto 4725 of 2005)

INVIMA (Colombia''s national health surveillance authority) classifies medical devices into 4 risk classes. The class determines the required certification and the estimated sanitary registration timeline.

## Class I — minimal risk (registration in 60-90 days)
Examples: personal protective equipment, simple instruments, bandages.
Required certification: presumption of conformity.
Requirements: manufacturer''s declaration of conformity, device description, quality management system certification (GMP).

## Class II — moderate risk (4-6 months)
Examples: diagnostic equipment, pressure monitors, electrocardiography equipment.
Required certification: evaluated conformity.
Requirements: biocompatibility technical study, quality management system certification, conformity evaluation against applicable standards, technical device description, analytical testing.

## Class IIB — moderate-high risk (8-12 months)
Examples: powered surgical equipment, bone implants, infusion systems.
Required certification: conformity evaluated by a notified third party.
Requirements: clinical trials or performance testing, complete risk assessment, third-party quality certification, exhaustive technical studies, declaration of conformity.

## Class III — high risk (12-24 months)
Examples: cardiovascular implants, neural devices, joint implants.
Required certification: prior approval of sanitary registration.
Requirements: complete clinical trials, exhaustive risk assessment, notified body certification, post-market surveillance, biocompatibility studies, sterility and pyrogen testing.

> This classification is indicative per device type. Final regulatory validation depends on the specific product and its current documentation before INVIMA.

Source: invima.gov.co, medical devices and biomedical equipment section.',
    true,
    NOW(),
    NOW()
  ),
  (
    'normatividad-y-registro-sanitario-invima',
    'Normatividad y procedimiento de registro sanitario INVIMA',
    'INVIMA regulations and sanitary registration procedure',
    '# Registro sanitario INVIMA

El registro sanitario es el documento público expedido por INVIMA que autoriza la fabricación, comercialización, importación, exportación y distribución de dispositivos médicos en Colombia. Su vigencia varía según la clasificación de riesgo del dispositivo.

## Normatividad clave

- **Decreto 4725 de 21 de diciembre de 2005**: reglamenta el régimen de registros sanitarios, permiso de comercialización y vigilancia sanitaria de dispositivos médicos para uso humano.
- **Resolución 4002 de 2007**: manual de requisitos de capacidad de almacenamiento y/o acondicionamiento para dispositivos médicos.
- **Resolución 0214 de 2022**: requisitos sanitarios para dispositivos médicos sobre medida bucal.

## Procedimiento de registro (pasos generales)

1. Solicitar el registro sanitario ante INVIMA.
2. Presentar documentación técnica y regulatoria completa.
3. Auditoría/evaluación de conformidad.
4. Obtención del registro sanitario.
5. Vigilancia post-comercialización (tecnovigilancia).

Tiempo promedio estimado por clase: Clase I 60-90 días, Clase II 4-6 meses, Clase IIB 8-12 meses, Clase III 12-24 meses.

## Requisitos generales

Fabricante e importador registrados, cumplimiento de normas técnicas, certificación de calidad, estudios técnicos y clínicos según clase, declaraciones de conformidad, documentación regulatoria completa.

> Este resumen orienta sobre el marco normativo; no reemplaza asesoría legal ni la validación puntual de cada producto ante INVIMA.

Fuente: invima.gov.co, sección dispositivos médicos y equipos biomédicos.',
    '# INVIMA sanitary registration

The sanitary registration is the public document issued by INVIMA that authorizes the manufacturing, marketing, import, export and distribution of medical devices in Colombia. Its validity period varies according to the device''s risk classification.

## Key regulations

- **Decreto 4725 of December 21, 2005**: regulates the sanitary registration regime, marketing permits and sanitary surveillance of medical devices for human use.
- **Resolución 4002 of 2007**: manual of storage and/or conditioning capacity requirements for medical devices.
- **Resolución 0214 of 2022**: sanitary requirements for custom-made oral medical devices.

## Registration procedure (general steps)

1. Request the sanitary registration before INVIMA.
2. Submit complete technical and regulatory documentation.
3. Conformity audit/evaluation.
4. Obtain the sanitary registration.
5. Post-market surveillance (technovigilance).

Estimated average timeline per class: Class I 60-90 days, Class II 4-6 months, Class IIB 8-12 months, Class III 12-24 months.

## General requirements

Registered manufacturer and importer, compliance with technical standards, quality certification, technical and clinical studies per class, declarations of conformity, complete regulatory documentation.

> This summary provides regulatory orientation; it does not replace legal advice or the specific validation of each product before INVIMA.

Source: invima.gov.co, medical devices and biomedical equipment section.',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO UPDATE
SET
  titulo_es = EXCLUDED.titulo_es,
  titulo_en = EXCLUDED.titulo_en,
  cuerpo_es = EXCLUDED.cuerpo_es,
  cuerpo_en = EXCLUDED.cuerpo_en,
  publicado = EXCLUDED.publicado,
  updated_at = NOW();

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

-- Reserva atomica de presupuesto LLM mensual (BUDGET_MENSUAL_USD).
-- Sin esto, dos solicitudes concurrentes cerca del limite pueden leer el mismo
-- `gastado` acumulado (SELECT SUM) antes de que cualquiera registre su fila,
-- dejando pasar a ambas juntas por encima del limite (condicion de carrera
-- detectada en la auditoria del Asesor). pg_advisory_xact_lock serializa las
-- solicitudes del mismo periodo y se libera solo al terminar la transaccion
-- de este RPC (una llamada = una transaccion implicita).
-- Uso: reservarPresupuesto()/confirmarUsoLlm() en
-- supabase/functions/_shared/llm-gateway.ts.
CREATE OR REPLACE FUNCTION reservar_presupuesto_llm(
  p_periodo    TEXT,
  p_limite     NUMERIC,
  p_estimado   NUMERIC,
  p_proveedor  TEXT,
  p_modelo     TEXT,
  p_tipo       TEXT,
  p_session_id TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, disponible BOOLEAN, gastado NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gastado NUMERIC;
  v_id      UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('llm_uso_budget:' || p_periodo));

  SELECT COALESCE(SUM(coste_estimado), 0) INTO v_gastado
  FROM llm_uso
  WHERE periodo_yyyy_mm = p_periodo;

  IF v_gastado + p_estimado > p_limite THEN
    RETURN QUERY SELECT NULL::UUID, false, v_gastado;
    RETURN;
  END IF;

  INSERT INTO llm_uso (
    periodo_yyyy_mm, proveedor, modelo, tipo, input_tokens, output_tokens, coste_estimado, session_id
  )
  VALUES (p_periodo, p_proveedor, p_modelo, p_tipo, 0, 0, p_estimado, p_session_id)
  RETURNING llm_uso.id INTO v_id;

  RETURN QUERY SELECT v_id, true, v_gastado + p_estimado;
END;
$$;

REVOKE ALL ON FUNCTION reservar_presupuesto_llm(TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reservar_presupuesto_llm(TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;

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

-- ── 8b. perfiles administrativos / RBAC ─────────────────────
CREATE TABLE IF NOT EXISTS admin_profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  rol         TEXT NOT NULL DEFAULT 'ventas'
              CHECK (rol IN ('owner', 'admin', 'catalogo', 'ventas', 'operaciones', 'lectura')),
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_admin_profiles_updated_at ON admin_profiles;
CREATE TRIGGER set_admin_profiles_updated_at
  BEFORE UPDATE ON admin_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Helper RBAC. Usa SECURITY DEFINER para evitar recursion RLS sobre admin_profiles.
CREATE OR REPLACE FUNCTION is_admin(required_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_profiles ap
    WHERE ap.user_id = (select auth.uid())
      AND ap.activo = true
      AND (
        required_roles IS NULL
        OR ap.rol = ANY(required_roles)
        OR ap.rol IN ('owner', 'admin')
      )
  );
$$;

REVOKE ALL ON FUNCTION is_admin(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin(TEXT[]) TO authenticated;

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
  api_token          TEXT UNIQUE, -- Token para autenticar requests de actualización de fulfillments
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

-- ── 12. notification_log (auditoría de notificaciones) ──────────
CREATE TABLE IF NOT EXISTS notification_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id   UUID REFERENCES proveedores(id) ON DELETE CASCADE,
  fulfillment_id UUID REFERENCES fulfillments(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL
                 CHECK (tipo IN ('notificacion', 'reintento', 'confirmacion', 'fallo')),
  status         TEXT NOT NULL
                 CHECK (status IN ('enviado', 'confirmado', 'rechazado', 'fallido')),
  metadatos      JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_proveedor
  ON notification_log(proveedor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_fulfillment
  ON notification_log(fulfillment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_created
  ON notification_log(created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_log_admin_select" ON notification_log;
CREATE POLICY "notification_log_admin_select"
  ON notification_log FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['operaciones', 'admin', 'owner']));

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

INSERT INTO storage.buckets (id, name, public)
  VALUES ('comprobantes-pago', 'comprobantes-pago', false)
  ON CONFLICT (id) DO NOTHING;

-- ── RLS ─────────────────────────────────────────────────────

-- familias: SELECT público (activo); escritura solo admin
ALTER TABLE familias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "familias_select_public" ON familias;
CREATE POLICY "familias_select_public"
  ON familias FOR SELECT
  TO anon, authenticated
  USING (activo = true);
DROP POLICY IF EXISTS "familias_write_auth" ON familias;
DROP POLICY IF EXISTS "familias_admin_all" ON familias;
CREATE POLICY "familias_admin_all"
  ON familias FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo']))
  WITH CHECK (is_admin(ARRAY['catalogo']));

-- tipos: SELECT público; escritura solo admin
ALTER TABLE tipos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tipos_select_public" ON tipos;
CREATE POLICY "tipos_select_public"
  ON tipos FOR SELECT
  TO anon, authenticated
  USING (activo = true);
DROP POLICY IF EXISTS "tipos_write_auth" ON tipos;
DROP POLICY IF EXISTS "tipos_admin_all" ON tipos;
CREATE POLICY "tipos_admin_all"
  ON tipos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo']))
  WITH CHECK (is_admin(ARRAY['catalogo']));

-- productos: SELECT público (activo); escritura solo admin
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "productos_select_public" ON productos;
CREATE POLICY "productos_select_public"
  ON productos FOR SELECT
  TO anon, authenticated
  USING (activo = true);
DROP POLICY IF EXISTS "productos_write_auth" ON productos;
DROP POLICY IF EXISTS "productos_admin_all" ON productos;
CREATE POLICY "productos_admin_all"
  ON productos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo']))
  WITH CHECK (is_admin(ARRAY['catalogo']));

-- variantes: lectura pública si producto padre activo; escritura admin
ALTER TABLE producto_variantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "producto_variantes_select_public" ON producto_variantes;
CREATE POLICY "producto_variantes_select_public"
  ON producto_variantes FOR SELECT
  TO anon, authenticated
  USING (
    activo = true
    AND EXISTS (
      SELECT 1 FROM productos p WHERE p.id = producto_variantes.producto_id AND p.activo = true
    )
  );
DROP POLICY IF EXISTS "producto_variantes_admin_all" ON producto_variantes;
CREATE POLICY "producto_variantes_admin_all"
  ON producto_variantes FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo']))
  WITH CHECK (is_admin(ARRAY['catalogo']));

-- solicitudes_cotizacion: sin INSERT anon (web → registrar-cotizacion service_role).
-- Ventas inserta borradores; formalizar/token solo vía Edge Functions (service_role).
ALTER TABLE solicitudes_cotizacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotizaciones_insert_public" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_insert_public" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_insert" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_select_auth" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_admin_all" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_select_own" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_ventas_update_own" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_supervisor_all" ON solicitudes_cotizacion;
CREATE POLICY "cotizaciones_ventas_insert"
  ON solicitudes_cotizacion FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(ARRAY['ventas'])
    AND estado = 'nueva'
    AND formalizacion_token_hash IS NULL
    AND formalizacion_token_expira_at IS NULL
    AND oferta_enviada_at IS NULL
    AND pedido_id IS NULL
  );
CREATE POLICY "cotizaciones_ventas_select_own"
  ON solicitudes_cotizacion FOR SELECT
  TO authenticated
  USING (
    is_admin(ARRAY['owner', 'admin'])
    OR (is_admin(ARRAY['ventas']) AND created_by = (SELECT auth.uid()))
  );
CREATE POLICY "cotizaciones_ventas_update_own"
  ON solicitudes_cotizacion FOR UPDATE
  TO authenticated
  USING (
    is_admin(ARRAY['owner', 'admin'])
    OR (is_admin(ARRAY['ventas']) AND created_by = (SELECT auth.uid()))
  )
  WITH CHECK (
    is_admin(ARRAY['owner', 'admin'])
    OR (is_admin(ARRAY['ventas']) AND created_by = (SELECT auth.uid()))
  );
CREATE POLICY "cotizaciones_supervisor_all"
  ON solicitudes_cotizacion FOR DELETE
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin']));

-- clientes: datos personales solo backoffice/admin
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_admin_all" ON clientes;
CREATE POLICY "clientes_admin_all"
  ON clientes FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));

ALTER TABLE cliente_direcciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cliente_direcciones_admin_all" ON cliente_direcciones;
CREATE POLICY "cliente_direcciones_admin_all"
  ON cliente_direcciones FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));

-- pedidos: backoffice solo admin; escritura real por service_role en Edge Functions
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedidos_auth_only" ON pedidos;
DROP POLICY IF EXISTS "pedidos_admin_all" ON pedidos;
CREATE POLICY "pedidos_admin_all"
  ON pedidos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

ALTER TABLE facturas_electronicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facturas_electronicas_admin_all" ON facturas_electronicas;
CREATE POLICY "facturas_electronicas_admin_all"
  ON facturas_electronicas FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

-- eventos_pago: solo service_role/admin
ALTER TABLE eventos_pago ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eventos_pago_auth_only" ON eventos_pago;
DROP POLICY IF EXISTS "eventos_pago_admin_all" ON eventos_pago;
CREATE POLICY "eventos_pago_admin_all"
  ON eventos_pago FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['operaciones']))
  WITH CHECK (is_admin(ARRAY['operaciones']));

-- cupones: gestion de marketing/backoffice
ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cupones_admin_all" ON cupones;
CREATE POLICY "cupones_admin_all"
  ON cupones FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));

ALTER TABLE cupon_usos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cupon_usos_admin_all" ON cupon_usos;
CREATE POLICY "cupon_usos_admin_all"
  ON cupon_usos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));

ALTER TABLE pedido_notas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedido_notas_admin_all" ON pedido_notas;
CREATE POLICY "pedido_notas_admin_all"
  ON pedido_notas FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

ALTER TABLE pedido_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedido_eventos_admin_all" ON pedido_eventos;
CREATE POLICY "pedido_eventos_admin_all"
  ON pedido_eventos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

-- articulos: SELECT público (publicado); escritura solo admin
ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "articulos_select_public" ON articulos;
CREATE POLICY "articulos_select_public"
  ON articulos FOR SELECT
  TO anon, authenticated
  USING (publicado = true);
DROP POLICY IF EXISTS "articulos_write_auth" ON articulos;
DROP POLICY IF EXISTS "articulos_admin_all" ON articulos;
CREATE POLICY "articulos_admin_all"
  ON articulos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo', 'ventas']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'ventas']));

-- llm_uso / asesor_uso: lectura solo admin (panel admin); escritura via service_role
ALTER TABLE llm_uso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "llm_uso_select_auth" ON llm_uso;
DROP POLICY IF EXISTS "llm_uso_admin_select" ON llm_uso;
CREATE POLICY "llm_uso_admin_select"
  ON llm_uso FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']));

ALTER TABLE asesor_uso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asesor_uso_select_auth" ON asesor_uso;
DROP POLICY IF EXISTS "asesor_uso_admin_select" ON asesor_uso;
CREATE POLICY "asesor_uso_admin_select"
  ON asesor_uso FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']));

-- asesor_rate_limit: sin politicas (deny-all a anon/authenticated); solo service_role (bypassa RLS)
ALTER TABLE asesor_rate_limit ENABLE ROW LEVEL SECURITY;

-- perfiles admin: cada usuario ve su perfil; owner/admin gestiona todos
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_profiles_select_self" ON admin_profiles;
CREATE POLICY "admin_profiles_select_self"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin(ARRAY['owner', 'admin']));
DROP POLICY IF EXISTS "admin_profiles_owner_all" ON admin_profiles;
CREATE POLICY "admin_profiles_owner_all"
  ON admin_profiles FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin']))
  WITH CHECK (is_admin(ARRAY['owner', 'admin']));

-- proveedores: solo admin operaciones/catalogo
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proveedores_auth_only" ON proveedores;
DROP POLICY IF EXISTS "proveedores_admin_all" ON proveedores;
CREATE POLICY "proveedores_admin_all"
  ON proveedores FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'operaciones']));

-- proveedor_producto: solo admin (precio_costo NUNCA en APIs públicas)
ALTER TABLE proveedor_producto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proveedor_producto_auth_only" ON proveedor_producto;
DROP POLICY IF EXISTS "proveedor_producto_admin_all" ON proveedor_producto;
CREATE POLICY "proveedor_producto_admin_all"
  ON proveedor_producto FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'operaciones']));

-- fulfillments: solo admin operaciones
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fulfillments_auth_only" ON fulfillments;
DROP POLICY IF EXISTS "fulfillments_admin_all" ON fulfillments;
CREATE POLICY "fulfillments_admin_all"
  ON fulfillments FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['operaciones']))
  WITH CHECK (is_admin(ARRAY['operaciones']));

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
SET search_path = public
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
-- umbral_similitud: score minimo (1 - distancia coseno) para incluir un match.
-- Default 0.0 solo descarta matches anti-correlados (score negativo); en la
-- practica casi no cambia el recall previo, pero ya no es "sin umbral" en
-- sentido estricto. Subir este valor una vez se tengan datos reales de
-- distribucion de scores en produccion (REMEDIACION/auditoria Asesor: antes
-- no habia umbral alguno y siempre se devolvian match_count vecinos aunque
-- el score fuera irrelevante).
CREATE OR REPLACE FUNCTION match_productos(
  query_embedding vector(1024),
  match_count INT DEFAULT 6,
  filtro JSONB DEFAULT NULL,
  umbral_similitud FLOAT DEFAULT 0.0
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
    AND (1 - (p.embedding <=> query_embedding)) >= umbral_similitud
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

-- ── Embeddings para articulos (Asesor RAG) ──────────────────
ALTER TABLE articulos ADD COLUMN IF NOT EXISTS embedding vector(1024);
CREATE INDEX IF NOT EXISTS idx_articulos_embedding_hnsw
  ON articulos USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- match_articulos: busqueda vectorial sobre articulos publicados
-- umbral_similitud: ver nota en match_productos (default 0.0 solo descarta score negativo).
CREATE OR REPLACE FUNCTION match_articulos(
  query_embedding vector(1024),
  match_count INT DEFAULT 3,
  umbral_similitud FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id        UUID,
  slug      TEXT,
  titulo_es TEXT,
  titulo_en TEXT,
  cuerpo_es TEXT,
  cuerpo_en TEXT,
  score     FLOAT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.slug, a.titulo_es, a.titulo_en, a.cuerpo_es, a.cuerpo_en,
    1 - (a.embedding <=> query_embedding) AS score
  FROM articulos a
  WHERE a.publicado = true
    AND a.embedding IS NOT NULL
    AND (1 - (a.embedding <=> query_embedding)) >= umbral_similitud
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- buscar_articulos_keyword: fallback texto cuando no hay vector
CREATE OR REPLACE FUNCTION buscar_articulos_keyword(
  query_text TEXT,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id        UUID,
  slug      TEXT,
  titulo_es TEXT,
  titulo_en TEXT,
  cuerpo_es TEXT,
  cuerpo_en TEXT,
  score     FLOAT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.slug, a.titulo_es, a.titulo_en, a.cuerpo_es, a.cuerpo_en,
    ts_rank(
      to_tsvector('spanish', coalesce(a.titulo_es,'') || ' ' || coalesce(a.cuerpo_es,'')),
      websearch_to_tsquery('spanish', query_text)
    ) AS score
  FROM articulos a
  WHERE a.publicado = true
  ORDER BY score DESC
  LIMIT match_count;
$$;

-- ── Storage RLS ──────────────────────────────────────────────
-- Lectura pública, escritura authenticated
DROP POLICY IF EXISTS "storage_productos_public_read" ON storage.objects;
CREATE POLICY "storage_productos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('productos', 'fichas', 'articulos'));

DROP POLICY IF EXISTS "storage_cms_insert" ON storage.objects;
CREATE POLICY "storage_cms_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('productos', 'fichas')
    AND is_admin(ARRAY['catalogo'])
  );

DROP POLICY IF EXISTS "storage_cms_update" ON storage.objects;
CREATE POLICY "storage_cms_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('productos', 'fichas')
    AND is_admin(ARRAY['catalogo'])
  )
  WITH CHECK (
    bucket_id IN ('productos', 'fichas')
    AND is_admin(ARRAY['catalogo'])
  );

DROP POLICY IF EXISTS "storage_cms_delete" ON storage.objects;
CREATE POLICY "storage_cms_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('productos', 'fichas')
    AND is_admin(ARRAY['catalogo'])
  );

DROP POLICY IF EXISTS "storage_articulos_insert" ON storage.objects;
CREATE POLICY "storage_articulos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'articulos'
    AND is_admin(ARRAY['catalogo', 'ventas'])
  );

DROP POLICY IF EXISTS "storage_articulos_update" ON storage.objects;
CREATE POLICY "storage_articulos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'articulos'
    AND is_admin(ARRAY['catalogo', 'ventas'])
  )
  WITH CHECK (
    bucket_id = 'articulos'
    AND is_admin(ARRAY['catalogo', 'ventas'])
  );

DROP POLICY IF EXISTS "storage_articulos_delete" ON storage.objects;
CREATE POLICY "storage_articulos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'articulos'
    AND is_admin(ARRAY['catalogo', 'ventas'])
  );

-- ============================================================
-- FASE 1 BACKOFFICE: plantillas de email, log de emails, reembolsos
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  clave       TEXT PRIMARY KEY,
  descripcion TEXT NOT NULL DEFAULT '',
  asunto      TEXT NOT NULL,
  html        TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_templates_admin_all" ON email_templates;
CREATE POLICY "email_templates_admin_all"
  ON email_templates FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

CREATE TABLE IF NOT EXISTS email_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario TEXT NOT NULL,
  plantilla    TEXT NOT NULL,
  referencia   TEXT,
  status       TEXT NOT NULL CHECK (status IN ('enviado', 'fallido')),
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_referencia ON email_log (referencia);
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_log_admin_select" ON email_log;
CREATE POLICY "email_log_admin_select"
  ON email_log FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']));

CREATE TABLE IF NOT EXISTS reembolsos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id           UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  monto               NUMERIC NOT NULL CHECK (monto > 0),
  motivo              TEXT NOT NULL,
  metodo              TEXT NOT NULL DEFAULT 'pasarela'
                      CHECK (metodo IN ('pasarela', 'transferencia', 'nota_credito', 'otro')),
  referencia_externa  TEXT,
  estado              TEXT NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'procesado', 'rechazado')),
  nota_credito_dian   BOOLEAN NOT NULL DEFAULT false,
  creado_por          TEXT,
  procesado_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reembolsos_pedido ON reembolsos (pedido_id);
ALTER TABLE reembolsos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reembolsos_admin_all" ON reembolsos;
CREATE POLICY "reembolsos_admin_all"
  ON reembolsos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

-- Seeds de plantillas (no pisan ediciones del admin)
INSERT INTO email_templates (clave, descripcion, asunto, html) VALUES
('venta_interna', 'Aviso interno de nueva venta (root@ y ventas@)',
 'Nueva venta {{referencia}} - {{total}} COP',
 '<h2>Nueva venta confirmada</h2><p>Pedido: <strong>{{referencia}}</strong></p><p>Cliente: {{cliente_nombre}} ({{cliente_email}})</p><p>Total: <strong>{{total}} {{moneda}}</strong></p><p>Productos:</p><ul>{{items_html}}</ul><p>Fecha: {{fecha}}</p>'),
('cotizacion_interna', 'Aviso interno de nueva solicitud de cotizacion',
 'Nueva cotizacion de {{cliente_nombre}} - I-ME',
 '<h2>Nueva solicitud de cotizacion</h2><p>Nombre: {{cliente_nombre}}</p><p>Empresa: {{empresa}}</p><p>Email: {{cliente_email}}</p><p>Telefono: {{telefono}}</p><p>Productos:</p><ul>{{items_html}}</ul><p>Mensaje: {{mensaje}}</p><p>Fecha: {{fecha}}</p>'),
('pedido_confirmacion_cliente', 'Confirmacion de compra al cliente',
 'Confirmacion de tu pedido {{referencia}} - I-ME',
 '<h2>Gracias por tu compra, {{cliente_nombre}}</h2><p>Hemos recibido el pago de tu pedido <strong>{{referencia}}</strong>.</p><p>Total: <strong>{{total}} {{moneda}}</strong></p><p>Productos:</p><ul>{{items_html}}</ul><p>Puedes consultar el estado en <a href="https://i-me.com.co/es/seguimiento/">i-me.com.co/es/seguimiento</a> con tu referencia.</p><p>Equipo I-ME</p>'),
('cotizacion_confirmacion_cliente', 'Confirmacion de recepcion de cotizacion al cliente',
 'Hemos recibido tu solicitud de cotizacion - I-ME',
 '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu solicitud de presupuesto y te contactaremos en breve.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Resumen solicitado:</strong></p><ul>{{items_html}}</ul><p><strong>Mensaje recibido:</strong></p><pre>{{mensaje}}</pre><p>Equipo I-ME<br>ventas@i-me.com.co</p>'),
('cotizacion_confirmacion_cliente_es', 'Confirmacion de recepcion de presupuesto al cliente en espanol',
 'Hemos recibido tu solicitud de presupuesto - I-ME',
 '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu solicitud de presupuesto y te contactaremos en breve.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Resumen solicitado:</strong></p><ul>{{items_html}}</ul><p><strong>Mensaje recibido:</strong></p><pre>{{mensaje}}</pre><p>Equipo I-ME<br>ventas@i-me.com.co</p>'),
('cotizacion_confirmacion_cliente_en', 'Customer quote request receipt confirmation in English',
 'We received your quote request - I-ME',
 '<h2>Hello {{cliente_nombre}}</h2><p>We received your quote request and our commercial team will contact you shortly.</p><p><strong>Reference:</strong> {{referencia}}</p><p><strong>Request summary:</strong></p><ul>{{items_html}}</ul><p><strong>Message received:</strong></p><pre>{{mensaje}}</pre><p>I-ME Team<br>ventas@i-me.com.co</p>'),
('pedido_estado_cliente', 'Notificacion de cambio de estado del pedido al cliente',
 'Tu pedido {{referencia}} esta {{estado_label}} - I-ME',
 '<h2>Hola {{cliente_nombre}}</h2><p>Tu pedido <strong>{{referencia}}</strong> cambio de estado: <strong>{{estado_label}}</strong>.</p>{{tracking_html}}<p>Puedes consultar el detalle en <a href="https://i-me.com.co/es/seguimiento/">i-me.com.co/es/seguimiento</a>.</p><p>Equipo I-ME</p>'),
('cotizacion_oferta_cliente', 'Oferta formal de cotizacion enviada al cliente con CTA Formalizar',
 'Tu cotizacion I-ME lista para formalizar — {{referencia}}',
 '<h2>Hola {{cliente_nombre}}</h2><p>Hemos preparado tu cotizacion. Revisa el detalle y formaliza el pedido cuando estes listo.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Total ofertado:</strong> {{total}} {{moneda}}</p><p><strong>Validez:</strong> {{validez}}</p><p><strong>Productos:</strong></p><ul>{{items_html}}</ul><p><strong>Condiciones:</strong></p><pre>{{condiciones}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Formalizar pedido</a></p><p>Si el boton no funciona, copia este enlace:<br>{{formalizar_url}}</p><p>Equipo I-ME<br>ventas@i-me.com.co</p>'),
('cotizacion_oferta_cliente_es', 'Oferta formal de cotizacion (ES) con CTA Formalizar',
 'Tu cotizacion I-ME lista para formalizar — {{referencia}}',
 '<h2>Hola {{cliente_nombre}}</h2><p>Hemos preparado tu cotizacion. Revisa el detalle y formaliza el pedido cuando estes listo.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Total ofertado:</strong> {{total}} {{moneda}}</p><p><strong>Validez:</strong> {{validez}}</p><p><strong>Productos:</strong></p><ul>{{items_html}}</ul><p><strong>Condiciones:</strong></p><pre>{{condiciones}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Formalizar pedido</a></p><p>Si el boton no funciona, copia este enlace:<br>{{formalizar_url}}</p><p>Equipo I-ME<br>ventas@i-me.com.co</p>'),
('cotizacion_oferta_cliente_en', 'Formal quote offer (EN) with Formalize CTA',
 'Your I-ME quote is ready to formalize — {{referencia}}',
 '<h2>Hello {{cliente_nombre}}</h2><p>We prepared your quote. Review the details and formalize the order when ready.</p><p><strong>Reference:</strong> {{referencia}}</p><p><strong>Quoted total:</strong> {{total}} {{moneda}}</p><p><strong>Valid until:</strong> {{validez}}</p><p><strong>Products:</strong></p><ul>{{items_html}}</ul><p><strong>Terms:</strong></p><pre>{{condiciones}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Formalize order</a></p><p>If the button does not work, copy this link:<br>{{formalizar_url}}</p><p>I-ME Team<br>ventas@i-me.com.co</p>')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO email_templates (clave, descripcion, asunto, html) VALUES
('compra_valorar_interna', 'Aviso a compras cuando el carrito se convierte en compra a valorar',
 'Compra a valorar {{referencia}} - {{total}} {{moneda}}',
 '<h2>Compra a valorar desde carrito</h2><p><strong>Accion requerida:</strong> validar precio unitario, disponibilidad, impuestos, envio y total final.</p><p>Referencia: <strong>{{referencia}}</strong></p><p>Cliente: {{cliente_nombre}} ({{cliente_email}})</p><p>Empresa: {{empresa}}</p><p>Telefono: {{telefono}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Productos:</p><ul>{{items_html}}</ul><p>Mensaje:</p><pre>{{mensaje}}</pre><p>Fecha: {{fecha}}</p>'),
('compra_valorar_confirmacion_cliente', 'Confirmacion al cliente cuando el carrito se convierte en compra a valorar',
 'Recibimos tu solicitud de compra a valorar - I-ME',
 '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu carrito. El pago online esta temporalmente no disponible, por eso nuestro equipo validara precio unitario, disponibilidad, impuestos, envio y total final antes de confirmar.</p><p><strong>Referencia:</strong> {{referencia}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Resumen solicitado:</p><ul>{{items_html}}</ul><p>Te contactaremos con la valoracion final.</p><p>Equipo I-ME</p>'),
('compra_valorar_confirmacion_cliente_es', 'Confirmacion al cliente en espanol cuando el carrito se convierte en compra a valorar',
 'Recibimos tu solicitud de compra a valorar - I-ME',
 '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu carrito. El pago online esta temporalmente no disponible, por eso nuestro equipo validara precio unitario, disponibilidad, impuestos, envio y total final antes de confirmar.</p><p><strong>Referencia:</strong> {{referencia}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Resumen solicitado:</p><ul>{{items_html}}</ul><p>Te contactaremos con la valoracion final.</p><p>Equipo I-ME</p>'),
('compra_valorar_confirmacion_cliente_en', 'Customer purchase valuation receipt confirmation in English',
 'We received your purchase valuation request - I-ME',
 '<h2>Hello {{cliente_nombre}}</h2><p>We received your cart. Online payment is temporarily unavailable, so our team will validate unit prices, availability, taxes, shipping and final total before confirmation.</p><p><strong>Reference:</strong> {{referencia}}</p><p>Estimated total: <strong>{{total}} {{moneda}}</strong></p><p>Request summary:</p><ul>{{items_html}}</ul><p>We will contact you with the final valuation.</p><p>I-ME Team</p>')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- FASE 2/3 BACKOFFICE: portal cliente (RLS), listas de precio B2B,
-- carrito abandonado, tarifas de envio, resenas
-- ============================================================

-- Portal de cliente: el usuario autenticado ve SUS pedidos/cotizaciones/datos
DROP POLICY IF EXISTS "pedidos_cliente_select" ON pedidos;
CREATE POLICY "pedidos_cliente_select"
  ON pedidos FOR SELECT
  TO authenticated
  USING ((cliente->>'email') = (select auth.email()));

DROP POLICY IF EXISTS "cotizaciones_cliente_select" ON solicitudes_cotizacion;
CREATE POLICY "cotizaciones_cliente_select"
  ON solicitudes_cotizacion FOR SELECT
  TO authenticated
  USING (email = (select auth.email()));

DROP POLICY IF EXISTS "clientes_self_select" ON clientes;
CREATE POLICY "clientes_self_select"
  ON clientes FOR SELECT
  TO authenticated
  USING (email = (select auth.email()));

DROP POLICY IF EXISTS "direcciones_self_select" ON cliente_direcciones;
CREATE POLICY "direcciones_self_select"
  ON cliente_direcciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = cliente_direcciones.cliente_id AND c.email = (select auth.email())
    )
  );

-- Listas de precio B2B
CREATE TABLE IF NOT EXISTS listas_precio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  descripcion   TEXT NOT NULL DEFAULT '',
  descuento_pct NUMERIC NOT NULL DEFAULT 0 CHECK (descuento_pct >= 0 AND descuento_pct <= 90),
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lista_precio_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id    UUID NOT NULL REFERENCES listas_precio(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio      NUMERIC NOT NULL CHECK (precio > 0),
  UNIQUE (lista_id, producto_id)
);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS lista_precio_id UUID REFERENCES listas_precio(id) ON DELETE SET NULL;

ALTER TABLE listas_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_precio_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "listas_precio_admin_all" ON listas_precio;
CREATE POLICY "listas_precio_admin_all"
  ON listas_precio FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));
DROP POLICY IF EXISTS "listas_precio_cliente_select" ON listas_precio;
CREATE POLICY "listas_precio_cliente_select"
  ON listas_precio FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.lista_precio_id = listas_precio.id AND c.email = (select auth.email())
    )
  );
DROP POLICY IF EXISTS "lista_precio_items_admin_all" ON lista_precio_items;
CREATE POLICY "lista_precio_items_admin_all"
  ON lista_precio_items FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));

-- Carrito abandonado (escritura solo via Edge Functions con service_role)
CREATE TABLE IF NOT EXISTS carritos_abandonados (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    TEXT NOT NULL,
  nombre                   TEXT,
  items                    JSONB NOT NULL,
  subtotal                 NUMERIC NOT NULL DEFAULT 0,
  estado                   TEXT NOT NULL DEFAULT 'activo'
                           CHECK (estado IN ('activo', 'recordado', 'convertido')),
  recordatorio_enviado_at  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_carritos_abandonados_email_activo
  ON carritos_abandonados (email) WHERE estado = 'activo';
ALTER TABLE carritos_abandonados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "carritos_admin_select" ON carritos_abandonados;
CREATE POLICY "carritos_admin_select"
  ON carritos_abandonados FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas']));

-- Tarifas de envio por zona (departamentos de Colombia)
CREATE TABLE IF NOT EXISTS tarifas_envio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona          TEXT NOT NULL UNIQUE,
  departamentos TEXT[] NOT NULL DEFAULT '{}',
  tarifa        NUMERIC NOT NULL CHECK (tarifa >= 0),
  gratis_desde  NUMERIC,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tarifas_envio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tarifas_envio_select_public" ON tarifas_envio;
CREATE POLICY "tarifas_envio_select_public"
  ON tarifas_envio FOR SELECT
  TO anon, authenticated
  USING (activo = true);
DROP POLICY IF EXISTS "tarifas_envio_admin_all" ON tarifas_envio;
CREATE POLICY "tarifas_envio_admin_all"
  ON tarifas_envio FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['operaciones']))
  WITH CHECK (is_admin(ARRAY['operaciones']));

-- Resenas de productos (insert solo via Edge Function; select publico si aprobada)
CREATE TABLE IF NOT EXISTS resenas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comentario  TEXT NOT NULL DEFAULT '',
  aprobada    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resenas_producto ON resenas (producto_id) WHERE aprobada = true;
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resenas_select_public" ON resenas;
CREATE POLICY "resenas_select_public"
  ON resenas FOR SELECT
  TO anon, authenticated
  USING (aprobada = true);
DROP POLICY IF EXISTS "resenas_admin_all" ON resenas;
CREATE POLICY "resenas_admin_all"
  ON resenas FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

-- Analitica marketing first-party (sin PII; insert solo via Edge Function)
CREATE TABLE IF NOT EXISTS analytics_eventos (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  event_name text not null check (char_length(event_name) between 2 and 80),
  session_id text not null check (char_length(session_id) between 8 and 80),
  page_path text,
  page_title text,
  referrer text,
  locale text,
  device_type text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  scroll_depth integer check (scroll_depth is null or scroll_depth between 0 and 100),
  value numeric,
  item_count integer check (item_count is null or item_count >= 0),
  product_slug text,
  search_term text,
  properties jsonb not null default '{}'
);

CREATE INDEX IF NOT EXISTS analytics_eventos_ts_idx
  ON analytics_eventos (ts desc);
CREATE INDEX IF NOT EXISTS analytics_eventos_event_ts_idx
  ON analytics_eventos (event_name, ts desc);
CREATE INDEX IF NOT EXISTS analytics_eventos_page_ts_idx
  ON analytics_eventos (page_path, ts desc);
CREATE INDEX IF NOT EXISTS analytics_eventos_session_ts_idx
  ON analytics_eventos (session_id, ts desc);

ALTER TABLE analytics_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_eventos_admin_select" ON analytics_eventos;
CREATE POLICY "analytics_eventos_admin_select"
  ON analytics_eventos FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'lectura']));

GRANT SELECT ON analytics_eventos TO authenticated;

-- Plantilla de email para carrito abandonado
INSERT INTO email_templates (clave, descripcion, asunto, html) VALUES
('carrito_abandonado_cliente', 'Recordatorio de carrito abandonado (24h)',
 'Tu carrito en I-ME te espera',
 '<h2>Hola {{cliente_nombre}}</h2><p>Dejaste estos productos en tu carrito:</p><ul>{{items_html}}</ul><p>Subtotal: <strong>{{total}} COP</strong></p><p><a href="https://i-me.com.co/es/carrito/">Completar mi compra</a></p><p>Si necesitas asesoria, responde a este correo.</p><p>Equipo I-ME</p>')
ON CONFLICT (clave) DO NOTHING;

-- Programacion del recordatorio de carritos (requiere extensiones pg_cron + pg_net
-- activas en Supabase; ejecutar una vez, ajustando el service key en Vault):
-- SELECT cron.schedule('recordatorio-carritos', '0 * * * *', $$
--   SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/recordatorio-carritos',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_key'))
--   );
-- $$);
