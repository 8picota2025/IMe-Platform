-- ============================================================
-- CRM NORMALIZADO: captura unica de contactos, cuentas,
-- oportunidades y actividades desde cotizaciones y ventas.
--
-- Objetivo operativo:
-- - Todo formulario/cotizacion genera contacto CRM normalizado.
-- - Toda venta e-commerce genera/actualiza cliente, contacto,
--   oportunidad y actividad CRM.
-- - El dato raw de cotizacion/pedido sigue existiendo como snapshot,
--   pero seguimiento comercial se explota desde tablas CRM.
--
-- ROLLBACK MANUAL:
--   DROP TRIGGER IF EXISTS crm_sync_cotizacion_before_write ON solicitudes_cotizacion;
--   DROP TRIGGER IF EXISTS crm_sync_pedido_before_write ON pedidos;
--   DROP FUNCTION IF EXISTS crm_sync_from_cotizacion();
--   DROP FUNCTION IF EXISTS crm_sync_from_pedido();
--   DROP FUNCTION IF EXISTS crm_stage_from_cotizacion(TEXT);
--   DROP FUNCTION IF EXISTS crm_stage_from_pedido(TEXT);
--   DROP FUNCTION IF EXISTS crm_extract_products_total(JSONB);
--   DROP FUNCTION IF EXISTS crm_normalize_phone(TEXT);
--   DROP FUNCTION IF EXISTS crm_normalize_key(TEXT);
--   DROP FUNCTION IF EXISTS crm_normalize_email(TEXT);
--   DROP TABLE IF EXISTS crm_activities;
--   DROP TABLE IF EXISTS crm_opportunities;
--   DROP TABLE IF EXISTS crm_contacts;
--   DROP TABLE IF EXISTS crm_accounts;
-- ============================================================

-- ── 1. Helpers de normalizacion ─────────────────────────────
CREATE OR REPLACE FUNCTION crm_normalize_email(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT NULLIF(lower(trim(value)), '');
$$;

CREATE OR REPLACE FUNCTION crm_normalize_key(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(lower(trim(value)), '\s+', ' ', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION crm_normalize_phone(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  WITH raw AS (
    SELECT regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g') AS digits
  )
  SELECT CASE
    WHEN length(digits) < 8 OR length(digits) > 15 THEN NULL
    WHEN digits LIKE '57%' AND length(digits) > 10 THEN '+' || digits
    ELSE '+57' || digits
  END
  FROM raw;
$$;

CREATE OR REPLACE FUNCTION crm_extract_products_total(products JSONB)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT coalesce(sum(
    CASE
      WHEN jsonb_typeof(item->'subtotal') = 'number' THEN (item->>'subtotal')::numeric
      WHEN (item->>'subtotal') ~ '^[0-9]+(\.[0-9]+)?$' THEN (item->>'subtotal')::numeric
      WHEN jsonb_typeof(item->'precio_unitario') = 'number'
        OR (item->>'precio_unitario') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (item->>'precio_unitario')::numeric * greatest(
          CASE
            WHEN (item->>'cantidad') ~ '^[0-9]+(\.[0-9]+)?$' THEN (item->>'cantidad')::numeric
            ELSE 1
          END,
          1
        )
      ELSE 0
    END
  ), 0)
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(products) = 'array' THEN products ELSE '[]'::jsonb END
  ) AS item;
$$;

CREATE OR REPLACE FUNCTION crm_stage_from_cotizacion(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE value
    WHEN 'respondida' THEN 'cotizando'
    WHEN 'en_revision' THEN 'calificacion'
    ELSE 'nuevo'
  END;
$$;

CREATE OR REPLACE FUNCTION crm_stage_from_pedido(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IN ('pagado', 'procesando', 'enviado') THEN 'ganado'
    WHEN value = 'entregado' THEN 'posventa'
    WHEN value IN ('rechazado', 'expirado', 'cancelado', 'reembolsado', 'error_verificacion') THEN 'perdido'
    ELSE 'checkout_pendiente'
  END;
$$;

-- ── 2. Entidades CRM normalizadas ───────────────────────────
CREATE TABLE IF NOT EXISTS crm_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             TEXT NOT NULL,
  normalized_name    TEXT NOT NULL UNIQUE,
  tipo               TEXT NOT NULL DEFAULT 'institucion'
                     CHECK (tipo IN ('institucion', 'empresa', 'persona', 'proveedor')),
  pais               TEXT,
  ciudad             TEXT,
  origen_primario    TEXT,
  last_activity_at   TIMESTAMPTZ,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_crm_accounts_updated_at ON crm_accounts;
CREATE TRIGGER set_crm_accounts_updated_at
  BEFORE UPDATE ON crm_accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS crm_contacts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id               UUID REFERENCES clientes(id) ON DELETE SET NULL,
  account_id               UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  email_norm               TEXT UNIQUE,
  telefono_e164            TEXT UNIQUE,
  nombre                   TEXT,
  apellido                 TEXT,
  cargo                    TEXT,
  lifecycle_stage          TEXT NOT NULL DEFAULT 'lead'
                           CHECK (lifecycle_stage IN ('suscriptor', 'lead', 'mql', 'sql', 'cliente', 'evangelista')),
  lead_score               INT NOT NULL DEFAULT 0,
  consentimiento_datos     BOOLEAN NOT NULL DEFAULT false,
  consentimiento_timestamp TIMESTAMPTZ,
  origen_primario          TEXT,
  last_activity_at         TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_contacts_identity_check CHECK (email_norm IS NOT NULL OR telefono_e164 IS NOT NULL)
);

DROP TRIGGER IF EXISTS set_crm_contacts_updated_at ON crm_contacts;
CREATE TRIGGER set_crm_contacts_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_crm_contacts_account ON crm_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts(lifecycle_stage);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  contact_id           UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  cliente_id           UUID REFERENCES clientes(id) ON DELETE SET NULL,
  source_type          TEXT NOT NULL
                       CHECK (source_type IN ('cotizacion', 'venta_ecommerce', 'formulario', 'comercial_share')),
  source_table         TEXT NOT NULL,
  source_id            UUID NOT NULL,
  titulo               TEXT NOT NULL,
  etapa                TEXT NOT NULL DEFAULT 'nuevo'
                       CHECK (etapa IN ('nuevo', 'calificacion', 'cotizando', 'checkout_pendiente', 'ganado', 'perdido', 'posventa')),
  valor_estimado       NUMERIC,
  moneda               TEXT NOT NULL DEFAULT 'COP',
  probabilidad         INT NOT NULL DEFAULT 10 CHECK (probabilidad BETWEEN 0 AND 100),
  productos            JSONB NOT NULL DEFAULT '[]',
  owner_role           TEXT NOT NULL DEFAULT 'ventas',
  next_action_at       TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_table, source_id)
);

DROP TRIGGER IF EXISTS set_crm_opportunities_updated_at ON crm_opportunities;
CREATE TRIGGER set_crm_opportunities_updated_at
  BEFORE UPDATE ON crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON crm_opportunities(etapa, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_contact ON crm_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_account ON crm_opportunities(account_id);

CREATE TABLE IF NOT EXISTS crm_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  cliente_id      UUID REFERENCES clientes(id) ON DELETE SET NULL,
  opportunity_id  UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'web'
                  CHECK (channel IN ('web', 'email', 'whatsapp', 'phone', 'admin', 'payment')),
  source_table    TEXT NOT NULL,
  source_id       UUID NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary         TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_table, source_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_time ON crm_activities(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity_time ON crm_activities(opportunity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_source ON crm_activities(source_table, source_id);

-- ── 3. Vinculos desde tablas operativas ─────────────────────
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS tipo_solicitud TEXT NOT NULL DEFAULT 'cotizacion';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'web';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS mercado TEXT NOT NULL DEFAULT 'CO';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'COP';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS total_estimado NUMERIC;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS cupon_codigo TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS crm_account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS crm_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS crm_opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL;

ALTER TABLE solicitudes_cotizacion DROP CONSTRAINT IF EXISTS solicitudes_cotizacion_tipo_solicitud_check;
ALTER TABLE solicitudes_cotizacion
  ADD CONSTRAINT solicitudes_cotizacion_tipo_solicitud_check
  CHECK (tipo_solicitud IN ('cotizacion', 'compra_a_valorar', 'contacto', 'asesor'));

CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_cliente ON solicitudes_cotizacion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_crm_contact ON solicitudes_cotizacion(crm_contact_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_crm_opportunity ON solicitudes_cotizacion(crm_opportunity_id);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS crm_account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS crm_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS crm_opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_crm_contact ON pedidos(crm_contact_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_crm_opportunity ON pedidos(crm_opportunity_id);

-- ── 4. Sincronizacion de cotizaciones ───────────────────────
CREATE OR REPLACE FUNCTION crm_sync_from_cotizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_account_name TEXT;
  v_account_key TEXT;
  v_account_id UUID;
  v_cliente_id UUID;
  v_contact_id UUID;
  v_opportunity_id UUID;
  v_valor NUMERIC;
BEGIN
  v_email := crm_normalize_email(NEW.email);
  v_phone := crm_normalize_phone(NEW.telefono);
  v_account_name := NULLIF(trim(coalesce(NEW.empresa, '')), '');
  v_account_key := crm_normalize_key(v_account_name);
  v_valor := coalesce(NULLIF(NEW.total_estimado, 0), NULLIF(crm_extract_products_total(NEW.productos), 0));

  IF v_email IS NOT NULL THEN
    NEW.email := v_email;
  END IF;
  IF v_phone IS NOT NULL THEN
    NEW.telefono := v_phone;
  END IF;

  IF v_account_key IS NOT NULL THEN
    INSERT INTO crm_accounts (nombre, normalized_name, tipo, origen_primario, last_activity_at)
    VALUES (v_account_name, v_account_key, 'institucion', 'cotizacion', NOW())
    ON CONFLICT (normalized_name) DO UPDATE
      SET nombre = EXCLUDED.nombre,
          last_activity_at = NOW(),
          updated_at = NOW()
    RETURNING id INTO v_account_id;
  END IF;

  IF v_email IS NOT NULL THEN
    INSERT INTO clientes (
      email, nombre, telefono, institucion, tipo_cliente,
      consentimiento_datos, consentimiento_timestamp
    )
    VALUES (
      v_email, NULLIF(trim(NEW.nombre), ''), coalesce(v_phone, NEW.telefono), v_account_name,
      CASE WHEN v_account_name IS NULL THEN 'b2c' ELSE 'b2b' END,
      NEW.consentimiento_datos,
      coalesce(NEW.consentimiento_timestamp, NOW())
    )
    ON CONFLICT (email) DO UPDATE
      SET nombre = coalesce(EXCLUDED.nombre, clientes.nombre),
          telefono = coalesce(EXCLUDED.telefono, clientes.telefono),
          institucion = coalesce(EXCLUDED.institucion, clientes.institucion),
          consentimiento_datos = clientes.consentimiento_datos OR EXCLUDED.consentimiento_datos,
          consentimiento_timestamp = coalesce(EXCLUDED.consentimiento_timestamp, clientes.consentimiento_timestamp),
          updated_at = NOW()
    RETURNING id INTO v_cliente_id;
  END IF;

  IF v_email IS NOT NULL OR v_phone IS NOT NULL THEN
    INSERT INTO crm_contacts (
      cliente_id, account_id, email_norm, telefono_e164, nombre,
      lifecycle_stage, consentimiento_datos, consentimiento_timestamp,
      origen_primario, last_activity_at
    )
    VALUES (
      v_cliente_id, v_account_id, v_email, v_phone, NULLIF(trim(NEW.nombre), ''),
      'lead', NEW.consentimiento_datos, coalesce(NEW.consentimiento_timestamp, NOW()),
      'cotizacion', NOW()
    )
    ON CONFLICT (email_norm) DO UPDATE
      SET cliente_id = coalesce(EXCLUDED.cliente_id, crm_contacts.cliente_id),
          account_id = coalesce(EXCLUDED.account_id, crm_contacts.account_id),
          telefono_e164 = coalesce(EXCLUDED.telefono_e164, crm_contacts.telefono_e164),
          nombre = coalesce(EXCLUDED.nombre, crm_contacts.nombre),
          consentimiento_datos = crm_contacts.consentimiento_datos OR EXCLUDED.consentimiento_datos,
          consentimiento_timestamp = coalesce(EXCLUDED.consentimiento_timestamp, crm_contacts.consentimiento_timestamp),
          last_activity_at = NOW(),
          updated_at = NOW()
    RETURNING id INTO v_contact_id;
  END IF;

  INSERT INTO crm_opportunities (
    account_id, contact_id, cliente_id, source_type, source_table, source_id,
    titulo, etapa, valor_estimado, moneda, probabilidad, productos, metadata
  )
  VALUES (
    v_account_id, v_contact_id, v_cliente_id,
    CASE WHEN NEW.tipo_solicitud = 'contacto' THEN 'formulario' ELSE 'cotizacion' END,
    'solicitudes_cotizacion', NEW.id,
    CASE
      WHEN NEW.tipo_solicitud = 'compra_a_valorar' THEN 'Compra a valorar - '
      WHEN NEW.tipo_solicitud = 'contacto' THEN 'Formulario contacto - '
      ELSE 'Cotizacion - '
    END || coalesce(NULLIF(trim(NEW.empresa), ''), NULLIF(trim(NEW.nombre), ''), v_email, NEW.id::text),
    crm_stage_from_cotizacion(NEW.estado),
    v_valor,
    coalesce(NULLIF(NEW.moneda, ''), (NEW.productos->0->>'moneda'), 'COP'),
    CASE crm_stage_from_cotizacion(NEW.estado)
      WHEN 'cotizando' THEN 45
      WHEN 'calificacion' THEN 25
      ELSE 10
    END,
    coalesce(NEW.productos, '[]'::jsonb),
    jsonb_build_object(
      'estado_cotizacion', NEW.estado,
      'tipo_solicitud', NEW.tipo_solicitud,
      'origen', NEW.origen,
      'locale', NEW.locale,
      'mercado', NEW.mercado,
      'cupon_codigo', NEW.cupon_codigo
    ) || coalesce(NEW.metadata, '{}'::jsonb)
  )
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET account_id = EXCLUDED.account_id,
        contact_id = EXCLUDED.contact_id,
        cliente_id = EXCLUDED.cliente_id,
        titulo = EXCLUDED.titulo,
        etapa = EXCLUDED.etapa,
        valor_estimado = EXCLUDED.valor_estimado,
        moneda = EXCLUDED.moneda,
        probabilidad = EXCLUDED.probabilidad,
        productos = EXCLUDED.productos,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
  RETURNING id INTO v_opportunity_id;

  INSERT INTO crm_activities (
    account_id, contact_id, cliente_id, opportunity_id,
    event_type, channel, source_table, source_id, summary, metadata
  )
  VALUES (
    v_account_id, v_contact_id, v_cliente_id, v_opportunity_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'cotizacion_registrada' ELSE 'cotizacion_actualizada' END,
    'web',
    'solicitudes_cotizacion',
    NEW.id,
    left(coalesce(NULLIF(trim(NEW.mensaje), ''), 'Solicitud de cotizacion'), 240),
    jsonb_build_object(
      'productos_count', jsonb_array_length(coalesce(NEW.productos, '[]'::jsonb)),
      'estado', NEW.estado,
      'valor_estimado', v_valor,
      'tipo_solicitud', NEW.tipo_solicitud,
      'origen', NEW.origen,
      'locale', NEW.locale
    ) || coalesce(NEW.metadata, '{}'::jsonb)
  )
  ON CONFLICT (source_table, source_id, event_type) DO UPDATE
    SET account_id = EXCLUDED.account_id,
        contact_id = EXCLUDED.contact_id,
        cliente_id = EXCLUDED.cliente_id,
        opportunity_id = EXCLUDED.opportunity_id,
        summary = EXCLUDED.summary,
        metadata = EXCLUDED.metadata,
        occurred_at = NOW();

  NEW.cliente_id := coalesce(v_cliente_id, NEW.cliente_id);
  NEW.crm_account_id := v_account_id;
  NEW.crm_contact_id := v_contact_id;
  NEW.crm_opportunity_id := v_opportunity_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION crm_sync_from_cotizacion() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_sync_cotizacion_before_write ON solicitudes_cotizacion;
CREATE TRIGGER crm_sync_cotizacion_before_write
  BEFORE INSERT OR UPDATE OF nombre, empresa, email, telefono, productos, mensaje, estado, consentimiento_datos, tipo_solicitud, origen, locale, mercado, moneda, total_estimado, cupon_codigo, metadata
  ON solicitudes_cotizacion
  FOR EACH ROW EXECUTE FUNCTION crm_sync_from_cotizacion();

-- ── 5. Sincronizacion de ventas e-commerce ──────────────────
CREATE OR REPLACE FUNCTION crm_sync_from_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_nombre TEXT;
  v_apellido TEXT;
  v_account_name TEXT;
  v_account_key TEXT;
  v_account_id UUID;
  v_cliente_id UUID;
  v_contact_id UUID;
  v_opportunity_id UUID;
  v_stage TEXT;
BEGIN
  v_email := crm_normalize_email(NEW.cliente->>'email');
  v_phone := crm_normalize_phone(NEW.cliente->>'telefono');
  v_nombre := NULLIF(trim(coalesce(NEW.cliente->>'nombre', '')), '');
  v_apellido := NULLIF(trim(coalesce(NEW.cliente->>'apellido', '')), '');
  v_account_name := NULLIF(trim(coalesce(NEW.cliente->>'institucion', NEW.metadata #>> '{fiscal,razon_social}', '')), '');
  v_account_key := crm_normalize_key(v_account_name);
  v_stage := crm_stage_from_pedido(NEW.estado);

  IF v_email IS NOT NULL THEN
    NEW.cliente := jsonb_set(coalesce(NEW.cliente, '{}'::jsonb), '{email}', to_jsonb(v_email), true);
  END IF;
  IF v_phone IS NOT NULL THEN
    NEW.cliente := jsonb_set(NEW.cliente, '{telefono}', to_jsonb(coalesce(v_phone, NEW.cliente->>'telefono')), true);
  END IF;

  IF v_account_key IS NOT NULL THEN
    INSERT INTO crm_accounts (nombre, normalized_name, tipo, origen_primario, last_activity_at)
    VALUES (v_account_name, v_account_key, 'institucion', 'venta_ecommerce', NOW())
    ON CONFLICT (normalized_name) DO UPDATE
      SET nombre = EXCLUDED.nombre,
          last_activity_at = NOW(),
          updated_at = NOW()
    RETURNING id INTO v_account_id;
  END IF;

  IF v_email IS NOT NULL THEN
    INSERT INTO clientes (
      email, nombre, apellido, telefono, institucion, tipo_cliente,
      razon_social, tipo_documento, numero_documento, tipo_persona,
      responsable_iva, agente_retencion, agente_reteica, email_facturacion,
      consentimiento_datos, consentimiento_timestamp
    )
    VALUES (
      v_email, v_nombre, v_apellido, coalesce(v_phone, NEW.cliente->>'telefono'), v_account_name,
      CASE WHEN v_account_name IS NULL THEN 'b2c' ELSE 'b2b' END,
      NEW.metadata #>> '{fiscal,razon_social}',
      NEW.metadata #>> '{fiscal,tipo_documento}',
      NEW.metadata #>> '{fiscal,numero_documento}',
      NEW.metadata #>> '{fiscal,tipo_persona}',
      coalesce((NEW.metadata #>> '{fiscal,responsable_iva}')::boolean, false),
      coalesce((NEW.metadata #>> '{fiscal,agente_retencion}')::boolean, false),
      coalesce((NEW.metadata #>> '{fiscal,agente_reteica}')::boolean, false),
      coalesce(NEW.metadata #>> '{fiscal,email_facturacion}', v_email),
      NEW.consentimiento_datos,
      coalesce(NEW.consentimiento_timestamp, NOW())
    )
    ON CONFLICT (email) DO UPDATE
      SET nombre = coalesce(EXCLUDED.nombre, clientes.nombre),
          apellido = coalesce(EXCLUDED.apellido, clientes.apellido),
          telefono = coalesce(EXCLUDED.telefono, clientes.telefono),
          institucion = coalesce(EXCLUDED.institucion, clientes.institucion),
          razon_social = coalesce(EXCLUDED.razon_social, clientes.razon_social),
          tipo_documento = coalesce(EXCLUDED.tipo_documento, clientes.tipo_documento),
          numero_documento = coalesce(EXCLUDED.numero_documento, clientes.numero_documento),
          tipo_persona = coalesce(EXCLUDED.tipo_persona, clientes.tipo_persona),
          email_facturacion = coalesce(EXCLUDED.email_facturacion, clientes.email_facturacion),
          consentimiento_datos = clientes.consentimiento_datos OR EXCLUDED.consentimiento_datos,
          consentimiento_timestamp = coalesce(EXCLUDED.consentimiento_timestamp, clientes.consentimiento_timestamp),
          updated_at = NOW()
    RETURNING id INTO v_cliente_id;
  END IF;

  IF v_email IS NOT NULL OR v_phone IS NOT NULL THEN
    INSERT INTO crm_contacts (
      cliente_id, account_id, email_norm, telefono_e164, nombre, apellido,
      lifecycle_stage, consentimiento_datos, consentimiento_timestamp,
      origen_primario, last_activity_at
    )
    VALUES (
      coalesce(v_cliente_id, NEW.cliente_id), v_account_id, v_email, v_phone, v_nombre, v_apellido,
      CASE WHEN v_stage IN ('ganado', 'posventa') THEN 'cliente' ELSE 'lead' END,
      NEW.consentimiento_datos, coalesce(NEW.consentimiento_timestamp, NOW()),
      'venta_ecommerce', NOW()
    )
    ON CONFLICT (email_norm) DO UPDATE
      SET cliente_id = coalesce(EXCLUDED.cliente_id, crm_contacts.cliente_id),
          account_id = coalesce(EXCLUDED.account_id, crm_contacts.account_id),
          telefono_e164 = coalesce(EXCLUDED.telefono_e164, crm_contacts.telefono_e164),
          nombre = coalesce(EXCLUDED.nombre, crm_contacts.nombre),
          apellido = coalesce(EXCLUDED.apellido, crm_contacts.apellido),
          lifecycle_stage = CASE
            WHEN EXCLUDED.lifecycle_stage = 'cliente' THEN 'cliente'
            ELSE crm_contacts.lifecycle_stage
          END,
          consentimiento_datos = crm_contacts.consentimiento_datos OR EXCLUDED.consentimiento_datos,
          consentimiento_timestamp = coalesce(EXCLUDED.consentimiento_timestamp, crm_contacts.consentimiento_timestamp),
          last_activity_at = NOW(),
          updated_at = NOW()
    RETURNING id INTO v_contact_id;
  END IF;

  INSERT INTO crm_opportunities (
    account_id, contact_id, cliente_id, source_type, source_table, source_id,
    titulo, etapa, valor_estimado, moneda, probabilidad, productos, closed_at, metadata
  )
  VALUES (
    v_account_id, v_contact_id, coalesce(v_cliente_id, NEW.cliente_id),
    'venta_ecommerce', 'pedidos', NEW.id,
    'Pedido e-commerce - ' || coalesce(NEW.referencia_pasarela, NEW.id::text),
    v_stage,
    NEW.total,
    NEW.moneda,
    CASE v_stage
      WHEN 'ganado' THEN 100
      WHEN 'posventa' THEN 100
      WHEN 'perdido' THEN 0
      ELSE 60
    END,
    coalesce(NEW.items, '[]'::jsonb),
    CASE WHEN v_stage IN ('ganado', 'perdido', 'posventa') THEN NOW() ELSE NULL END,
    jsonb_build_object('estado_pedido', NEW.estado, 'proveedor_pago', NEW.proveedor_pago, 'mercado', NEW.mercado)
  )
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET account_id = EXCLUDED.account_id,
        contact_id = EXCLUDED.contact_id,
        cliente_id = EXCLUDED.cliente_id,
        titulo = EXCLUDED.titulo,
        etapa = EXCLUDED.etapa,
        valor_estimado = EXCLUDED.valor_estimado,
        moneda = EXCLUDED.moneda,
        probabilidad = EXCLUDED.probabilidad,
        productos = EXCLUDED.productos,
        closed_at = EXCLUDED.closed_at,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
  RETURNING id INTO v_opportunity_id;

  INSERT INTO crm_activities (
    account_id, contact_id, cliente_id, opportunity_id,
    event_type, channel, source_table, source_id, summary, metadata
  )
  VALUES (
    v_account_id, v_contact_id, coalesce(v_cliente_id, NEW.cliente_id), v_opportunity_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'pedido_creado' ELSE 'pedido_' || NEW.estado END,
    CASE WHEN NEW.estado = 'pendiente' THEN 'web' ELSE 'payment' END,
    'pedidos',
    NEW.id,
    'Pedido ' || coalesce(NEW.referencia_pasarela, NEW.id::text) || ' - ' || NEW.estado,
    jsonb_build_object(
      'items_count', jsonb_array_length(coalesce(NEW.items, '[]'::jsonb)),
      'total', NEW.total,
      'moneda', NEW.moneda,
      'estado', NEW.estado
    )
  )
  ON CONFLICT (source_table, source_id, event_type) DO UPDATE
    SET account_id = EXCLUDED.account_id,
        contact_id = EXCLUDED.contact_id,
        cliente_id = EXCLUDED.cliente_id,
        opportunity_id = EXCLUDED.opportunity_id,
        summary = EXCLUDED.summary,
        metadata = EXCLUDED.metadata,
        occurred_at = NOW();

  NEW.cliente_id := coalesce(v_cliente_id, NEW.cliente_id);
  NEW.crm_account_id := v_account_id;
  NEW.crm_contact_id := v_contact_id;
  NEW.crm_opportunity_id := v_opportunity_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION crm_sync_from_pedido() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_sync_pedido_before_write ON pedidos;
CREATE TRIGGER crm_sync_pedido_before_write
  BEFORE INSERT OR UPDATE OF cliente, items, total, moneda, estado, consentimiento_datos, metadata
  ON pedidos
  FOR EACH ROW EXECUTE FUNCTION crm_sync_from_pedido();

-- ── 6. RLS y exposicion controlada ──────────────────────────
ALTER TABLE crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_accounts_backoffice_all" ON crm_accounts;
CREATE POLICY "crm_accounts_backoffice_all"
  ON crm_accounts FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'admin', 'owner']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones', 'admin', 'owner']));

DROP POLICY IF EXISTS "crm_contacts_backoffice_all" ON crm_contacts;
CREATE POLICY "crm_contacts_backoffice_all"
  ON crm_contacts FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'admin', 'owner']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones', 'admin', 'owner']));

DROP POLICY IF EXISTS "crm_opportunities_backoffice_all" ON crm_opportunities;
CREATE POLICY "crm_opportunities_backoffice_all"
  ON crm_opportunities FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'admin', 'owner']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones', 'admin', 'owner']));

DROP POLICY IF EXISTS "crm_activities_backoffice_all" ON crm_activities;
CREATE POLICY "crm_activities_backoffice_all"
  ON crm_activities FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'admin', 'owner']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones', 'admin', 'owner']));

GRANT SELECT, INSERT, UPDATE ON crm_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON crm_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON crm_opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON crm_activities TO authenticated;
