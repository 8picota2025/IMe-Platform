-- ─────────────────────────────────────────────────────────────
-- Fix: crm_contacts.telefono_e164 es UNIQUE, pero los triggers de
-- sincronizacion hacian ON CONFLICT (email_norm) y reasignaban el
-- telefono. Si ese telefono ya pertenecia a otro contacto (otro email),
-- cualquier INSERT/UPDATE sobre solicitudes_cotizacion o pedidos fallaba
-- con 23505 (duplicate key crm_contacts_telefono_e164_key), bloqueando
-- el guardado de ofertas y el envio de cotizaciones desde el CMS.
--
-- Solucion: helper crm_upsert_contact() que respeta la propiedad del
-- telefono (no lo roba a otro contacto) y que identifica por telefono
-- cuando no hay email.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION crm_upsert_contact(
  p_cliente_id UUID,
  p_account_id UUID,
  p_email TEXT,
  p_phone TEXT,
  p_nombre TEXT,
  p_apellido TEXT,
  p_lifecycle_stage TEXT,
  p_consentimiento BOOLEAN,
  p_consentimiento_ts TIMESTAMPTZ,
  p_origen TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT := p_phone;
  v_phone_owner_id UUID;
  v_phone_owner_email TEXT;
  v_contact_id UUID;
BEGIN
  IF p_email IS NULL AND v_phone IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT id, email_norm
      INTO v_phone_owner_id, v_phone_owner_email
      FROM crm_contacts
      WHERE telefono_e164 = v_phone
      LIMIT 1;

    -- Telefono compartido con otro contacto: no se reasigna (UNIQUE).
    IF v_phone_owner_id IS NOT NULL
       AND (p_email IS NULL OR v_phone_owner_email IS DISTINCT FROM p_email) THEN
      v_phone := NULL;
    END IF;
  END IF;

  IF p_email IS NOT NULL THEN
    INSERT INTO crm_contacts (
      cliente_id, account_id, email_norm, telefono_e164, nombre, apellido,
      lifecycle_stage, consentimiento_datos, consentimiento_timestamp,
      origen_primario, last_activity_at
    )
    VALUES (
      p_cliente_id, p_account_id, p_email, v_phone, p_nombre, p_apellido,
      p_lifecycle_stage, coalesce(p_consentimiento, false),
      coalesce(p_consentimiento_ts, NOW()), p_origen, NOW()
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

    RETURN v_contact_id;
  END IF;

  -- Sin email: el telefono es la identidad del contacto.
  IF v_phone_owner_id IS NOT NULL THEN
    UPDATE crm_contacts
      SET cliente_id = coalesce(p_cliente_id, cliente_id),
          account_id = coalesce(p_account_id, account_id),
          nombre = coalesce(p_nombre, nombre),
          apellido = coalesce(p_apellido, apellido),
          lifecycle_stage = CASE
            WHEN p_lifecycle_stage = 'cliente' THEN 'cliente'
            ELSE lifecycle_stage
          END,
          consentimiento_datos = consentimiento_datos OR coalesce(p_consentimiento, false),
          consentimiento_timestamp = coalesce(p_consentimiento_ts, consentimiento_timestamp),
          last_activity_at = NOW(),
          updated_at = NOW()
      WHERE id = v_phone_owner_id
    RETURNING id INTO v_contact_id;

    RETURN v_contact_id;
  END IF;

  INSERT INTO crm_contacts (
    cliente_id, account_id, email_norm, telefono_e164, nombre, apellido,
    lifecycle_stage, consentimiento_datos, consentimiento_timestamp,
    origen_primario, last_activity_at
  )
  VALUES (
    p_cliente_id, p_account_id, NULL, p_phone, p_nombre, p_apellido,
    p_lifecycle_stage, coalesce(p_consentimiento, false),
    coalesce(p_consentimiento_ts, NOW()), p_origen, NOW()
  )
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION crm_upsert_contact(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TEXT
) FROM PUBLIC;

-- ── Trigger cotizaciones ────────────────────────────────────
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

  v_contact_id := crm_upsert_contact(
    v_cliente_id,
    v_account_id,
    v_email,
    v_phone,
    NULLIF(trim(NEW.nombre), ''),
    NULL,
    'lead',
    NEW.consentimiento_datos,
    coalesce(NEW.consentimiento_timestamp, NOW()),
    'cotizacion'
  );

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

-- ── Trigger pedidos ─────────────────────────────────────────
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

  v_contact_id := crm_upsert_contact(
    coalesce(v_cliente_id, NEW.cliente_id),
    v_account_id,
    v_email,
    v_phone,
    v_nombre,
    v_apellido,
    CASE WHEN v_stage IN ('ganado', 'posventa') THEN 'cliente' ELSE 'lead' END,
    NEW.consentimiento_datos,
    coalesce(NEW.consentimiento_timestamp, NOW()),
    'venta_ecommerce'
  );

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
