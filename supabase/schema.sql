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
                           CHECK (estado IN ('nueva', 'en_revision', 'respondida')),
  notas_internas           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columnas F4.1 (Escenario A) — seguimiento comercial de cotizaciones.
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'nueva';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS notas_internas TEXT;

DO $$
BEGIN
  ALTER TABLE solicitudes_cotizacion ADD CONSTRAINT solicitudes_cotizacion_estado_check
    CHECK (estado IN ('nueva', 'en_revision', 'respondida'));
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
                           CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi')),
  -- valores: pendiente|pagado|rechazado|expirado|cancelado|reembolsado|error_verificacion
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
  consentimiento_datos     BOOLEAN NOT NULL DEFAULT false,
  consentimiento_timestamp TIMESTAMPTZ,
  leida                    BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi'));
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
  CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi'));

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

-- solicitudes_cotizacion: INSERT público; backoffice solo admin
ALTER TABLE solicitudes_cotizacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotizaciones_insert_public" ON solicitudes_cotizacion;
CREATE POLICY "cotizaciones_insert_public"
  ON solicitudes_cotizacion FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS "cotizaciones_select_auth" ON solicitudes_cotizacion;
DROP POLICY IF EXISTS "cotizaciones_admin_all" ON solicitudes_cotizacion;
CREATE POLICY "cotizaciones_admin_all"
  ON solicitudes_cotizacion FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));

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
  USING (is_admin(ARRAY['catalogo']))
  WITH CHECK (is_admin(ARRAY['catalogo']));

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
  USING (bucket_id = 'productos')
  ;
-- (Supabase aplica estas políticas automáticamente si el bucket es public)
