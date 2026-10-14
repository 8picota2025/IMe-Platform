-- leads_comerciales.consentimiento_datos ya no exige true.
-- NULL = aviso de privacidad pendiente. true = aceptado, con marca de tiempo.
-- false = no aceptado, sin marca. No se inventa una aceptación.
-- Aditiva: no borra filas ni columnas.

DO $$
DECLARE
  cname text;
BEGIN
  IF to_regclass('public.leads_comerciales') IS NULL THEN
    RAISE EXCEPTION 'leads_comerciales no existe';
  END IF;
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'leads_comerciales'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%consentimiento_datos%'
  LOOP
    EXECUTE format('ALTER TABLE public.leads_comerciales DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE public.leads_comerciales
  ALTER COLUMN consentimiento_datos DROP NOT NULL;

ALTER TABLE public.leads_comerciales
  ALTER COLUMN consentimiento_timestamp DROP NOT NULL,
  ALTER COLUMN consentimiento_timestamp DROP DEFAULT;

COMMENT ON COLUMN public.leads_comerciales.consentimiento_datos IS
  'NULL: aviso de privacidad pendiente. true: aceptado. false: no aceptado.';

CREATE OR REPLACE FUNCTION public.leads_comerciales_aplicar_consentimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.consentimiento_datos IS TRUE THEN
    IF NEW.consentimiento_timestamp IS NULL THEN
      NEW.consentimiento_timestamp := now();
    END IF;
  ELSE
    NEW.consentimiento_timestamp := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS a_leads_comerciales_consentimiento ON public.leads_comerciales;
CREATE TRIGGER a_leads_comerciales_consentimiento
  BEFORE INSERT OR UPDATE OF consentimiento_datos, consentimiento_timestamp
  ON public.leads_comerciales
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_comerciales_aplicar_consentimiento();

COMMENT ON FUNCTION public.leads_comerciales_aplicar_consentimiento() IS
  'Marca el momento solo cuando el aviso de privacidad está aceptado. Corre antes que crm_sync_lead_comercial_before_insert.';

-- crm_contacts.consentimiento_datos sigue NOT NULL. Un lead pendiente se
-- sincroniza como false y sin marca de tiempo. Una aceptación previa no se borra.
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
  v_consent_ts TIMESTAMPTZ := CASE
    WHEN p_consentimiento IS TRUE THEN coalesce(p_consentimiento_ts, NOW())
    ELSE NULL
  END;
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
      v_consent_ts, p_origen, NOW()
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
          consentimiento_timestamp = CASE
            WHEN EXCLUDED.consentimiento_datos IS TRUE
              THEN coalesce(EXCLUDED.consentimiento_timestamp, crm_contacts.consentimiento_timestamp)
            ELSE crm_contacts.consentimiento_timestamp
          END,
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
          consentimiento_timestamp = CASE
            WHEN p_consentimiento IS TRUE
              THEN coalesce(v_consent_ts, consentimiento_timestamp)
            ELSE consentimiento_timestamp
          END,
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
    v_consent_ts, p_origen, NOW()
  )
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_upsert_contact(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_upsert_contact(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION crm_sync_from_lead_comercial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_account_key TEXT;
  v_account_id UUID;
  v_contact_id UUID;
  v_opportunity_id UUID;
  v_next_action TIMESTAMPTZ;
BEGIN
  v_email := crm_normalize_email(NEW.email);
  v_phone := crm_normalize_phone(NEW.telefono);
  v_account_key := crm_normalize_key(NEW.institucion);
  v_next_action := CASE NEW.prioridad
    WHEN 'P1' THEN NOW() + INTERVAL '4 hours'
    WHEN 'P2' THEN NOW() + INTERVAL '3 days'
    ELSE NOW() + INTERVAL '7 days'
  END;

  NEW.email := v_email;
  NEW.telefono := coalesce(v_phone, NULLIF(trim(NEW.telefono), ''));

  INSERT INTO crm_accounts (
    nombre, normalized_name, tipo, origen_primario, last_activity_at, metadata
  )
  VALUES (
    NEW.institucion, v_account_key, 'institucion', 'lead_consultivo', NOW(),
    jsonb_build_object('ciudad', NEW.ciudad, 'campaign', NEW.campaign)
  )
  ON CONFLICT (normalized_name) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        last_activity_at = NOW(),
        metadata = crm_accounts.metadata || EXCLUDED.metadata,
        updated_at = NOW()
  RETURNING id INTO v_account_id;

  v_contact_id := crm_upsert_contact(
    NULL,
    v_account_id,
    v_email,
    v_phone,
    NULLIF(trim(NEW.nombre), ''),
    NULL,
    CASE WHEN NEW.prioridad = 'P1' THEN 'sql' ELSE 'lead' END,
    coalesce(NEW.consentimiento_datos, false),
    CASE
      WHEN NEW.consentimiento_datos IS TRUE THEN coalesce(NEW.consentimiento_timestamp, NOW())
      ELSE NULL
    END,
    'lead_consultivo'
  );

  IF v_contact_id IS NOT NULL THEN
    UPDATE crm_contacts
    SET cargo = coalesce(NULLIF(trim(NEW.cargo), ''), cargo),
        lead_score = CASE NEW.prioridad WHEN 'P1' THEN 90 WHEN 'P2' THEN 60 ELSE 30 END,
        metadata = metadata || jsonb_build_object(
          'ciudad', NEW.ciudad,
          'familia_slug', NEW.familia_slug,
          'campaign', NEW.campaign
        ),
        updated_at = NOW()
    WHERE id = v_contact_id;
  END IF;

  -- Lead magnets (herramientas y fichas técnicas): sólo cuenta, contacto y actividad. La oportunidad la crea la
  -- cotización cuando el lead la pida (crm_link_cotizacion_to_lead ya admite lead sin
  -- oportunidad). Decisión del usuario del 2026-09-25; espejo de esCampanaLeadMagnet() en
  -- supabase/functions/_shared/twenty-crm.ts.
  IF NEW.campaign NOT IN ('herramienta', 'pdf_descarga') THEN
    INSERT INTO crm_opportunities (
      account_id, contact_id, source_type, source_table, source_id,
      titulo, etapa, probabilidad, productos, owner_role, next_action_at,
      prioridad, metadata
    )
    VALUES (
      v_account_id, v_contact_id, 'formulario', 'leads_comerciales', NEW.id,
      left(NEW.institucion || ' — ' || NEW.tipo_proyecto, 180),
      'nuevo',
      CASE NEW.prioridad WHEN 'P1' THEN 35 WHEN 'P2' THEN 20 ELSE 10 END,
      jsonb_build_array(jsonb_build_object(
        'familia_slug', NEW.familia_slug,
        'tipo_slug', NEW.tipo_slug,
        'tipo_proyecto', NEW.tipo_proyecto
      )),
      'ventas', v_next_action, NEW.prioridad,
      jsonb_build_object(
        'campaign', NEW.campaign,
        'horizonte', NEW.horizonte,
        'presupuesto_estado', NEW.presupuesto_estado,
        'ciudad', NEW.ciudad,
        'necesidad', NEW.necesidad,
        'landing_path', NEW.landing_path,
        'referrer', NEW.referrer,
        'analytics_session_id', NEW.analytics_session_id,
        'utm_source', NEW.utm_source,
        'utm_medium', NEW.utm_medium,
        'utm_campaign', NEW.utm_campaign,
        'utm_content', NEW.utm_content,
        'utm_term', NEW.utm_term
      )
    )
    RETURNING id INTO v_opportunity_id;
  END IF;

  INSERT INTO crm_activities (
    account_id, contact_id, opportunity_id, event_type, channel,
    source_table, source_id, summary, metadata
  )
  VALUES (
    v_account_id, v_contact_id, v_opportunity_id, 'lead_registrado', 'web',
    'leads_comerciales', NEW.id,
    left(NEW.necesidad, 240),
    jsonb_build_object(
      'prioridad', NEW.prioridad,
      'campaign', NEW.campaign,
      'horizonte', NEW.horizonte,
      'familia_slug', NEW.familia_slug
    )
  );

  NEW.crm_account_id := v_account_id;
  NEW.crm_contact_id := v_contact_id;
  NEW.crm_opportunity_id := v_opportunity_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_sync_from_lead_comercial() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_sync_from_lead_comercial() TO service_role;
