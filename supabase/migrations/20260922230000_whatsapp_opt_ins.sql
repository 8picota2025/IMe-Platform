-- ADR-0016: identidad minima opt-in para WhatsApp como canal de leads.
-- whatsapp_inbound_events (existente) es solo idempotencia de mensajes, no
-- crea identidad ni lead. leads_comerciales (existente) exige institucion,
-- familia_slug, tipo_proyecto, horizonte, necesidad — demasiados campos
-- para capturar en el primer contacto casual de un chat. Tabla puente:
-- registra que un wa_id dio consentimiento y su nombre, sin forzar
-- recolectar todo lo que exige un lead calificado todavia. La logica
-- conversacional que realmente pide el consentimiento (el webhook) es
-- trabajo de Fase 4 (Channel Adapters), fuera de alcance de esta
-- migracion — ver docs/decisions/0016-whatsapp-opt-in.md.

CREATE TABLE IF NOT EXISTS whatsapp_opt_ins (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id                     TEXT NOT NULL UNIQUE,
  nombre                    TEXT,
  consentimiento_datos      BOOLEAN NOT NULL DEFAULT false,
  consentimiento_timestamp  TIMESTAMPTZ,
  primer_mensaje_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Se llena cuando la conversacion junta suficiente informacion para
  -- calificar como lead_comercial completo (Fase 4). NULL = solo opt-in,
  -- todavia no es un lead calificado.
  lead_comercial_id         UUID REFERENCES leads_comerciales(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_lead_comercial_id
  ON whatsapp_opt_ins(lead_comercial_id);

CREATE OR REPLACE FUNCTION set_updated_at_whatsapp_opt_ins()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_opt_ins_updated_at ON whatsapp_opt_ins;
CREATE TRIGGER trg_whatsapp_opt_ins_updated_at
  BEFORE UPDATE ON whatsapp_opt_ins
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_whatsapp_opt_ins();

-- RLS: contiene PII (wa_id + nombre). Sin acceso anon/publico en absoluto
-- (a diferencia de producto_claims_evidencia/topic_clusters, que sí
-- exponen lectura pública de contenido aprobado — esto es identidad de
-- persona, no contenido). Lectura admin (ventas/catalogo) para
-- seguimiento comercial; escritura solo service_role (el webhook).
ALTER TABLE whatsapp_opt_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_opt_ins_admin_select" ON whatsapp_opt_ins;
CREATE POLICY "whatsapp_opt_ins_admin_select"
  ON whatsapp_opt_ins FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'catalogo']));
