-- Captura consultiva B2B + atribucion comercial + continuidad de oportunidad.
-- Una oportunidad nace en leads_comerciales y se reutiliza al convertir en
-- cotizacion/pedido. Inserts publicos pasan exclusivamente por Edge Function.

-- ── 1. Pipeline CRM operativo ───────────────────────────────
ALTER TABLE crm_opportunities
  DROP CONSTRAINT IF EXISTS crm_opportunities_etapa_check;

ALTER TABLE crm_opportunities
  ADD CONSTRAINT crm_opportunities_etapa_check CHECK (
    etapa IN (
      'nuevo', 'contactado', 'calificacion', 'reunion', 'demo', 'cotizando',
      'negociacion', 'checkout_pendiente', 'ganado', 'perdido', 'nutrir', 'posventa'
    )
  ),
  ADD COLUMN IF NOT EXISTS prioridad TEXT
    CHECK (prioridad IS NULL OR prioridad IN ('P1', 'P2', 'P3')),
  ADD COLUMN IF NOT EXISTS margen_estimado NUMERIC
    CHECK (margen_estimado IS NULL OR margen_estimado >= 0),
  ADD COLUMN IF NOT EXISTS margen_pct NUMERIC
    CHECK (margen_pct IS NULL OR margen_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS motivo_perdida TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action_note TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_priority_due
  ON crm_opportunities (prioridad, next_action_at)
  WHERE etapa NOT IN ('ganado', 'perdido', 'posventa');

-- ── 2. Fuente de verdad para formularios consultivos ────────
CREATE TABLE IF NOT EXISTS leads_comerciales (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key          TEXT NOT NULL UNIQUE,
  nombre                   TEXT NOT NULL,
  cargo                    TEXT,
  institucion              TEXT NOT NULL,
  ciudad                   TEXT NOT NULL,
  telefono                 TEXT,
  email                    TEXT,
  familia_slug             TEXT NOT NULL,
  tipo_slug                TEXT,
  tipo_proyecto            TEXT NOT NULL,
  horizonte                TEXT NOT NULL CHECK (horizonte IN ('0-3', '4-12', 'exploracion')),
  presupuesto_estado       TEXT,
  necesidad                TEXT NOT NULL,
  consentimiento_datos     BOOLEAN NOT NULL CHECK (consentimiento_datos = true),
  consentimiento_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  campaign                 TEXT NOT NULL,
  locale                   TEXT NOT NULL DEFAULT 'es' CHECK (locale IN ('es', 'en')),
  prioridad                TEXT NOT NULL CHECK (prioridad IN ('P1', 'P2', 'P3')),
  estado                   TEXT NOT NULL DEFAULT 'nuevo' CHECK (
    estado IN (
      'nuevo', 'contactado', 'calificado', 'reunion', 'demo', 'cotizacion',
      'negociacion', 'ganado', 'perdido', 'nutrir'
    )
  ),
  landing_path             TEXT,
  referrer                 TEXT,
  analytics_session_id     TEXT,
  utm_source               TEXT,
  utm_medium               TEXT,
  utm_campaign             TEXT,
  utm_content              TEXT,
  utm_term                 TEXT,
  crm_account_id           UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  crm_contact_id           UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  crm_opportunity_id       UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  crm_sync_status          TEXT NOT NULL DEFAULT 'pending'
                           CHECK (crm_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  crm_sync_error           TEXT,
  crm_sync_last_attempt_at TIMESTAMPTZ,
  twenty_person_id         TEXT,
  twenty_company_id        TEXT,
  twenty_opportunity_id    TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leads_comerciales_contact_check CHECK (
    NULLIF(trim(coalesce(telefono, '')), '') IS NOT NULL
    OR NULLIF(trim(coalesce(email, '')), '') IS NOT NULL
  )
);

DROP TRIGGER IF EXISTS set_leads_comerciales_updated_at ON leads_comerciales;
CREATE TRIGGER set_leads_comerciales_updated_at
  BEFORE UPDATE ON leads_comerciales
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_leads_comerciales_priority_created
  ON leads_comerciales (prioridad, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_comerciales_campaign_created
  ON leads_comerciales (campaign, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_comerciales_email
  ON leads_comerciales (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_comerciales_phone
  ON leads_comerciales (telefono) WHERE telefono IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_comerciales_sync
  ON leads_comerciales (crm_sync_status, created_at DESC);

ALTER TABLE leads_comerciales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_comerciales_admin_select" ON leads_comerciales;
CREATE POLICY "leads_comerciales_admin_select"
  ON leads_comerciales FOR SELECT TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'lectura', 'admin', 'owner']));
DROP POLICY IF EXISTS "leads_comerciales_admin_update" ON leads_comerciales;
CREATE POLICY "leads_comerciales_admin_update"
  ON leads_comerciales FOR UPDATE TO authenticated
  USING (is_admin(ARRAY['ventas', 'admin', 'owner']))
  WITH CHECK (is_admin(ARRAY['ventas', 'admin', 'owner']));
REVOKE ALL ON leads_comerciales FROM anon;
GRANT SELECT, UPDATE ON leads_comerciales TO authenticated;

-- ── 3. Atribucion explicita en cotizacion y pedido ──────────
ALTER TABLE solicitudes_cotizacion
  ADD COLUMN IF NOT EXISTS lead_comercial_id UUID REFERENCES leads_comerciales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign TEXT,
  ADD COLUMN IF NOT EXISTS landing_path TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS analytics_session_id TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS crm_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS crm_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS crm_sync_last_attempt_at TIMESTAMPTZ;

UPDATE solicitudes_cotizacion
SET crm_sync_status = CASE
  WHEN twenty_opportunity_id IS NOT NULL THEN 'synced'
  ELSE 'skipped'
END
WHERE crm_sync_status IS NULL;

ALTER TABLE solicitudes_cotizacion
  ALTER COLUMN crm_sync_status SET DEFAULT 'pending',
  ALTER COLUMN crm_sync_status SET NOT NULL,
  DROP CONSTRAINT IF EXISTS solicitudes_cotizacion_crm_sync_status_check;
ALTER TABLE solicitudes_cotizacion
  ADD CONSTRAINT solicitudes_cotizacion_crm_sync_status_check
  CHECK (crm_sync_status IN ('pending', 'synced', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_lead
  ON solicitudes_cotizacion (lead_comercial_id)
  WHERE lead_comercial_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_attribution
  ON solicitudes_cotizacion (utm_campaign, campaign, created_at DESC);

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS solicitud_cotizacion_id UUID
    REFERENCES solicitudes_cotizacion(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_comercial_id UUID
    REFERENCES leads_comerciales(id) ON DELETE SET NULL;

UPDATE pedidos
SET solicitud_cotizacion_id = (metadata->>'solicitud_cotizacion_id')::UUID
WHERE solicitud_cotizacion_id IS NULL
  AND coalesce(metadata->>'solicitud_cotizacion_id', '')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

UPDATE pedidos p
SET lead_comercial_id = c.lead_comercial_id
FROM solicitudes_cotizacion c
WHERE p.solicitud_cotizacion_id = c.id
  AND p.lead_comercial_id IS NULL
  AND c.lead_comercial_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_solicitud_cotizacion
  ON pedidos (solicitud_cotizacion_id)
  WHERE solicitud_cotizacion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_lead_comercial
  ON pedidos (lead_comercial_id)
  WHERE lead_comercial_id IS NOT NULL;

-- ── 4. Lead → cuenta/contacto/oportunidad CRM ───────────────
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

REVOKE ALL ON FUNCTION crm_sync_from_lead_comercial() FROM PUBLIC;
DROP TRIGGER IF EXISTS crm_sync_lead_comercial_before_insert ON leads_comerciales;
CREATE TRIGGER crm_sync_lead_comercial_before_insert
  BEFORE INSERT ON leads_comerciales
  FOR EACH ROW EXECUTE FUNCTION crm_sync_from_lead_comercial();

-- ── 5. Reutilizar oportunidad al crear cotizacion ───────────
CREATE OR REPLACE FUNCTION crm_link_cotizacion_to_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_opp UUID;
  v_quote_opp UUID := NEW.crm_opportunity_id;
BEGIN
  IF NEW.lead_comercial_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT crm_opportunity_id INTO v_lead_opp
  FROM leads_comerciales
  WHERE id = NEW.lead_comercial_id;

  IF v_lead_opp IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_quote_opp IS NOT NULL AND v_quote_opp <> v_lead_opp THEN
    UPDATE crm_activities SET opportunity_id = v_lead_opp WHERE opportunity_id = v_quote_opp;
    DELETE FROM crm_opportunities WHERE id = v_quote_opp;
  END IF;

  UPDATE crm_opportunities
  SET etapa = crm_stage_from_cotizacion(NEW.estado),
      valor_estimado = coalesce(NULLIF(NEW.total_estimado, 0), valor_estimado),
      moneda = coalesce(NULLIF(NEW.moneda, ''), moneda),
      productos = coalesce(NEW.productos, productos),
      probabilidad = CASE crm_stage_from_cotizacion(NEW.estado)
        WHEN 'cotizando' THEN 55
        WHEN 'calificacion' THEN 30
        ELSE probabilidad
      END,
      metadata = metadata || jsonb_build_object(
        'cotizacion_id', NEW.id,
        'estado_cotizacion', NEW.estado,
        'campaign', coalesce(NEW.campaign, metadata->>'campaign'),
        'utm_source', NEW.utm_source,
        'utm_medium', NEW.utm_medium,
        'utm_campaign', NEW.utm_campaign
      ),
      updated_at = NOW()
  WHERE id = v_lead_opp;

  UPDATE crm_activities
  SET opportunity_id = v_lead_opp
  WHERE source_table = 'solicitudes_cotizacion' AND source_id = NEW.id;

  UPDATE leads_comerciales
  SET estado = 'cotizacion', updated_at = NOW()
  WHERE id = NEW.lead_comercial_id
    AND estado NOT IN ('ganado', 'perdido');

  NEW.crm_opportunity_id := v_lead_opp;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION crm_link_cotizacion_to_lead() FROM PUBLIC;
DROP TRIGGER IF EXISTS zz_crm_link_cotizacion_lineage ON solicitudes_cotizacion;
CREATE TRIGGER zz_crm_link_cotizacion_lineage
  BEFORE INSERT OR UPDATE OF lead_comercial_id, estado, productos, total_estimado
  ON solicitudes_cotizacion
  FOR EACH ROW EXECUTE FUNCTION crm_link_cotizacion_to_lead();

-- ── 6. Reutilizar oportunidad al crear pedido ───────────────
CREATE OR REPLACE FUNCTION crm_link_pedido_to_cotizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_opp UUID;
  v_order_opp UUID := NEW.crm_opportunity_id;
  v_lead_id UUID;
  v_stage TEXT;
BEGIN
  IF NEW.solicitud_cotizacion_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT crm_opportunity_id, lead_comercial_id
  INTO v_quote_opp, v_lead_id
  FROM solicitudes_cotizacion
  WHERE id = NEW.solicitud_cotizacion_id;

  NEW.lead_comercial_id := coalesce(NEW.lead_comercial_id, v_lead_id);

  IF v_quote_opp IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_order_opp IS NOT NULL AND v_order_opp <> v_quote_opp THEN
    UPDATE crm_activities SET opportunity_id = v_quote_opp WHERE opportunity_id = v_order_opp;
    DELETE FROM crm_opportunities WHERE id = v_order_opp;
  END IF;

  v_stage := crm_stage_from_pedido(NEW.estado);
  UPDATE crm_opportunities
  SET etapa = v_stage,
      valor_estimado = NEW.total,
      moneda = NEW.moneda,
      productos = coalesce(NEW.items, productos),
      probabilidad = CASE v_stage
        WHEN 'ganado' THEN 100
        WHEN 'posventa' THEN 100
        WHEN 'perdido' THEN 0
        WHEN 'checkout_pendiente' THEN 80
        ELSE 60
      END,
      closed_at = CASE WHEN v_stage IN ('ganado', 'perdido', 'posventa') THEN NOW() ELSE NULL END,
      metadata = metadata || jsonb_build_object(
        'pedido_id', NEW.id,
        'estado_pedido', NEW.estado,
        'mercado', NEW.mercado
      ),
      updated_at = NOW()
  WHERE id = v_quote_opp;

  UPDATE crm_activities
  SET opportunity_id = v_quote_opp
  WHERE source_table = 'pedidos' AND source_id = NEW.id;

  IF NEW.lead_comercial_id IS NOT NULL THEN
    UPDATE leads_comerciales
    SET estado = CASE
      WHEN v_stage IN ('ganado', 'posventa') THEN 'ganado'
      WHEN v_stage = 'perdido' THEN 'perdido'
      ELSE estado
    END,
    updated_at = NOW()
    WHERE id = NEW.lead_comercial_id;
  END IF;

  NEW.crm_opportunity_id := v_quote_opp;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION crm_link_pedido_to_cotizacion() FROM PUBLIC;
DROP TRIGGER IF EXISTS zz_crm_link_pedido_lineage ON pedidos;
CREATE TRIGGER zz_crm_link_pedido_lineage
  BEFORE INSERT OR UPDATE OF solicitud_cotizacion_id, estado, total, items
  ON pedidos
  FOR EACH ROW EXECUTE FUNCTION crm_link_pedido_to_cotizacion();

-- Mantener estado operativo del registro fuente cuando ventas mueve el CRM.
CREATE OR REPLACE FUNCTION crm_reflect_opportunity_on_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_table <> 'leads_comerciales' THEN
    RETURN NEW;
  END IF;

  UPDATE leads_comerciales
  SET estado = CASE NEW.etapa
    WHEN 'nuevo' THEN 'nuevo'
    WHEN 'contactado' THEN 'contactado'
    WHEN 'calificacion' THEN 'calificado'
    WHEN 'reunion' THEN 'reunion'
    WHEN 'demo' THEN 'demo'
    WHEN 'cotizando' THEN 'cotizacion'
    WHEN 'checkout_pendiente' THEN 'cotizacion'
    WHEN 'negociacion' THEN 'negociacion'
    WHEN 'ganado' THEN 'ganado'
    WHEN 'perdido' THEN 'perdido'
    WHEN 'nutrir' THEN 'nutrir'
    WHEN 'posventa' THEN 'ganado'
    ELSE estado
  END,
  updated_at = NOW()
  WHERE id = NEW.source_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION crm_reflect_opportunity_on_lead() FROM PUBLIC;
DROP TRIGGER IF EXISTS crm_reflect_opportunity_on_lead_after_update ON crm_opportunities;
CREATE TRIGGER crm_reflect_opportunity_on_lead_after_update
  AFTER UPDATE OF etapa ON crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION crm_reflect_opportunity_on_lead();
