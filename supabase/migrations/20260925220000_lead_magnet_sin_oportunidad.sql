-- Growth Engine, piloto Monitoreo/UCI: los leads de herramientas (campaign = 'herramienta')
-- no abren oportunidad en el warehouse CRM; sí cuenta, contacto y actividad. El resto de la
-- función es idéntico a 20260809090000_commercial_leads_attribution_crm.sql.

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
    NEW.consentimiento_datos,
    NEW.consentimiento_timestamp,
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

  -- Lead magnets (herramientas): sólo cuenta, contacto y actividad. La oportunidad la crea la
  -- cotización cuando el lead la pida (crm_link_cotizacion_to_lead ya admite lead sin
  -- oportunidad). Decisión del usuario del 2026-09-25; espejo de esCampanaLeadMagnet() en
  -- supabase/functions/_shared/twenty-crm.ts.
  IF NEW.campaign <> 'herramienta' THEN
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
