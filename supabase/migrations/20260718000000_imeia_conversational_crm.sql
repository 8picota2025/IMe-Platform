-- IMEIA conversational CRM: consented leads and quote traceability.

CREATE TABLE IF NOT EXISTS imeia_leads (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                 TEXT NOT NULL UNIQUE CHECK (char_length(session_id) BETWEEN 1 AND 128),
  locale                     TEXT NOT NULL CHECK (locale IN ('es', 'en')),
  nombre                     TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  institucion                TEXT,
  email                      TEXT,
  telefono                   TEXT,
  canal_preferido            TEXT NOT NULL CHECK (canal_preferido IN ('email', 'telefono', 'whatsapp')),
  perfil                     JSONB NOT NULL DEFAULT '{}',
  resumen                    TEXT NOT NULL DEFAULT '',
  productos                  JSONB NOT NULL DEFAULT '[]',
  tipo_handoff               TEXT NOT NULL CHECK (tipo_handoff IN ('whatsapp', 'cotizacion')),
  estado                     TEXT NOT NULL DEFAULT 'nuevo'
                             CHECK (estado IN ('nuevo', 'contactado', 'cotizacion', 'convertido', 'cerrado')),
  consentimiento_datos       BOOLEAN NOT NULL CHECK (consentimiento_datos = true),
  consentimiento_version     TEXT NOT NULL,
  consentimiento_locale      TEXT NOT NULL CHECK (consentimiento_locale IN ('es', 'en')),
  consentimiento_timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT imeia_leads_contacto_check CHECK (
    NULLIF(trim(email), '') IS NOT NULL OR NULLIF(trim(telefono), '') IS NOT NULL
  ),
  CONSTRAINT imeia_leads_canal_contacto_check CHECK (
    (canal_preferido = 'email' AND NULLIF(trim(email), '') IS NOT NULL)
    OR
    (canal_preferido IN ('telefono', 'whatsapp') AND NULLIF(trim(telefono), '') IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_imeia_leads_estado ON imeia_leads(estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imeia_leads_created ON imeia_leads(created_at DESC);

DROP TRIGGER IF EXISTS set_imeia_leads_updated_at ON imeia_leads;
CREATE TRIGGER set_imeia_leads_updated_at
  BEFORE UPDATE ON imeia_leads
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE solicitudes_cotizacion
  ADD COLUMN IF NOT EXISTS imeia_lead_id UUID REFERENCES imeia_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asesor_session_id TEXT,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'formulario';

DO $$
BEGIN
  ALTER TABLE solicitudes_cotizacion
    ADD CONSTRAINT solicitudes_cotizacion_origen_check
    CHECK (origen IN ('formulario', 'asesor', 'carrito'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_imeia_lead
  ON solicitudes_cotizacion(imeia_lead_id)
  WHERE imeia_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_asesor_session
  ON solicitudes_cotizacion(asesor_session_id)
  WHERE asesor_session_id IS NOT NULL;

ALTER TABLE imeia_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "imeia_leads_admin_all" ON imeia_leads;
CREATE POLICY "imeia_leads_admin_all"
  ON imeia_leads FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));

-- Public writes must pass through registrar-cotizacion, where consent and
-- payload validation are enforced with service_role.
DROP POLICY IF EXISTS "cotizaciones_insert_public" ON solicitudes_cotizacion;
