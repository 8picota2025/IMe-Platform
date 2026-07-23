-- ============================================================
-- CMS COMERCIAL: perfiles extendidos, plantillas, envios (email/WhatsApp)
-- y sincronizacion con Twenty CRM.
--
-- Todas las sentencias son idempotentes (IF NOT EXISTS / DROP POLICY IF
-- EXISTS + CREATE) siguiendo el patron de supabase/schema.sql y las
-- migraciones previas (20260705000000_backoffice_f1_f3.sql,
-- 20260722221138_marketing_analytics.sql).
--
-- ROLLBACK MANUAL (no se ejecuta automaticamente; documentado para
-- referencia si se necesita revertir esta migracion):
--   DROP TABLE IF EXISTS commercial_audit_log;
--   DROP TABLE IF EXISTS commercial_share_products;
--   DROP TABLE IF EXISTS commercial_shares;
--   DROP TABLE IF EXISTS commercial_message_templates;
--   DROP FUNCTION IF EXISTS is_comercial_user();
--   ALTER TABLE admin_profiles
--     DROP COLUMN IF EXISTS nombre,
--     DROP COLUMN IF EXISTS telefono,
--     DROP COLUMN IF EXISTS cargo,
--     DROP COLUMN IF EXISTS last_login_at;
--   DELETE FROM email_templates WHERE clave = 'comercial_catalogo';
-- ============================================================

-- ── 1. Perfiles administrativos extendidos ──────────────────
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- ── 2. Helper RBAC comercial ─────────────────────────────────
-- Igual que is_admin(), pero fijo a los roles que pueden operar el
-- flujo comercial (compartir catalogo, generar cotizaciones ad-hoc).
-- SECURITY DEFINER para evitar recursion RLS sobre admin_profiles.
CREATE OR REPLACE FUNCTION is_comercial_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(ARRAY['ventas', 'admin', 'owner']);
$$;

REVOKE ALL ON FUNCTION is_comercial_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_comercial_user() TO authenticated;

-- ── 3. commercial_message_templates ─────────────────────────
CREATE TABLE IF NOT EXISTS commercial_message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject     TEXT,
  body        TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  version     INT NOT NULL DEFAULT 1,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo puede haber una plantilla predeterminada activa por canal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_templates_default_per_channel
  ON commercial_message_templates (channel)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_commercial_templates_channel
  ON commercial_message_templates (channel, is_active);

DROP TRIGGER IF EXISTS set_commercial_message_templates_updated_at ON commercial_message_templates;
CREATE TRIGGER set_commercial_message_templates_updated_at
  BEFORE UPDATE ON commercial_message_templates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE commercial_message_templates ENABLE ROW LEVEL SECURITY;

-- Cualquier perfil admin activo (ventas/operaciones/lectura/catalogo/admin/owner)
-- puede leer las plantillas disponibles.
DROP POLICY IF EXISTS "commercial_templates_select" ON commercial_message_templates;
CREATE POLICY "commercial_templates_select"
  ON commercial_message_templates FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'lectura', 'catalogo', 'admin', 'owner']));

-- Solo owner/admin administran (crean/editan/desactivan) plantillas.
DROP POLICY IF EXISTS "commercial_templates_admin_write" ON commercial_message_templates;
CREATE POLICY "commercial_templates_admin_write"
  ON commercial_message_templates FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin']))
  WITH CHECK (is_admin(ARRAY['owner', 'admin']));

-- ── 4. commercial_shares ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS commercial_shares (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_name        TEXT NOT NULL,
  medical_center_name   TEXT,
  recipient_email       TEXT,
  recipient_phone       TEXT,
  phone_country_code    TEXT NOT NULL DEFAULT '57',
  channel               TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  message               TEXT,
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                          'draft', 'prepared', 'opened', 'queued',
                          'sent', 'delivered', 'read', 'failed'
                        )),
  provider              TEXT,
  provider_message_id   TEXT,
  crm_sync_status       TEXT NOT NULL DEFAULT 'pending'
                        CHECK (crm_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  -- IDs externos de Twenty CRM (people/companies/notes) — nunca FK local, son texto.
  crm_record_id         TEXT,
  crm_person_id         TEXT,
  crm_company_id        TEXT,
  idempotency_key       TEXT UNIQUE,
  error_code            TEXT,
  error_message         TEXT,
  consent_contact       BOOLEAN NOT NULL DEFAULT false,
  whatsapp_url          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at               TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commercial_shares_recipient_check CHECK (
    (channel = 'email' AND recipient_email IS NOT NULL)
    OR (channel = 'whatsapp' AND recipient_phone IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_commercial_shares_user_created
  ON commercial_shares (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_shares_crm_sync_status
  ON commercial_shares (crm_sync_status);
-- idempotency_key ya queda indexado por el UNIQUE constraint anterior.

DROP TRIGGER IF EXISTS set_commercial_shares_updated_at ON commercial_shares;
CREATE TRIGGER set_commercial_shares_updated_at
  BEFORE UPDATE ON commercial_shares
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE commercial_shares ENABLE ROW LEVEL SECURITY;

-- ventas ve solo sus propios envios; admin/owner ven todos.
DROP POLICY IF EXISTS "commercial_shares_select" ON commercial_shares;
CREATE POLICY "commercial_shares_select"
  ON commercial_shares FOR SELECT
  TO authenticated
  USING (
    is_comercial_user()
    AND (user_id = (SELECT auth.uid()) OR is_admin(ARRAY['owner', 'admin']))
  );

-- ventas inserta unicamente a su propio nombre (user_id = auth.uid()).
DROP POLICY IF EXISTS "commercial_shares_insert_own" ON commercial_shares;
CREATE POLICY "commercial_shares_insert_own"
  ON commercial_shares FOR INSERT
  TO authenticated
  WITH CHECK (is_comercial_user() AND user_id = (SELECT auth.uid()));

-- Actualizar registros de otros usuarios: solo owner/admin. ventas puede
-- actualizar los suyos (p.ej. reintentos de sincronizacion CRM).
DROP POLICY IF EXISTS "commercial_shares_update" ON commercial_shares;
CREATE POLICY "commercial_shares_update"
  ON commercial_shares FOR UPDATE
  TO authenticated
  USING (
    is_admin(ARRAY['owner', 'admin'])
    OR (is_comercial_user() AND user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    is_admin(ARRAY['owner', 'admin'])
    OR (is_comercial_user() AND user_id = (SELECT auth.uid()))
  );

-- ── 5. commercial_share_products ────────────────────────────
CREATE TABLE IF NOT EXISTS commercial_share_products (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_share_id     UUID NOT NULL REFERENCES commercial_shares(id) ON DELETE CASCADE,
  product_id              UUID REFERENCES productos(id) ON DELETE SET NULL,
  product_name_snapshot   TEXT NOT NULL,
  product_slug_snapshot   TEXT,
  product_url_snapshot    TEXT,
  product_sku_snapshot    TEXT,
  specialty_snapshot       TEXT,
  family_snapshot          TEXT,
  subfamily_snapshot       TEXT,
  section_snapshot         TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_share_products_share
  ON commercial_share_products (commercial_share_id);
CREATE INDEX IF NOT EXISTS idx_commercial_share_products_product
  ON commercial_share_products (product_id);

ALTER TABLE commercial_share_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_share_products_select" ON commercial_share_products;
CREATE POLICY "commercial_share_products_select"
  ON commercial_share_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commercial_shares s
      WHERE s.id = commercial_share_products.commercial_share_id
        AND is_comercial_user()
        AND (s.user_id = (SELECT auth.uid()) OR is_admin(ARRAY['owner', 'admin']))
    )
  );

DROP POLICY IF EXISTS "commercial_share_products_insert" ON commercial_share_products;
CREATE POLICY "commercial_share_products_insert"
  ON commercial_share_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commercial_shares s
      WHERE s.id = commercial_share_products.commercial_share_id
        AND is_comercial_user()
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- ── 6. commercial_audit_log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS commercial_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_audit_log_user_created
  ON commercial_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_audit_log_entity
  ON commercial_audit_log (entity_type, entity_id);

ALTER TABLE commercial_audit_log ENABLE ROW LEVEL SECURITY;

-- Auditoria visible solo para owner/admin.
DROP POLICY IF EXISTS "commercial_audit_log_admin_select" ON commercial_audit_log;
CREATE POLICY "commercial_audit_log_admin_select"
  ON commercial_audit_log FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin']));

-- Cualquier usuario comercial puede registrar auditoria de sus propias acciones
-- (en la practica la Edge Function usa service_role y no depende de esta policy).
DROP POLICY IF EXISTS "commercial_audit_log_insert_own" ON commercial_audit_log;
CREATE POLICY "commercial_audit_log_insert_own"
  ON commercial_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (is_comercial_user() AND user_id = (SELECT auth.uid()));

-- ── 7. Seeds de plantillas comerciales predeterminadas ──────
-- Variables soportadas por comercial-templates.ts (renderTemplate):
--   {{nombre_destinatario}} {{nombre_comercial}} {{centro_medico}}
--   {{mensaje}} {{lista_productos_texto}} {{correo_comercial}}
--   {{telefono_comercial}}
INSERT INTO commercial_message_templates (name, channel, subject, body, is_default, is_active)
SELECT
  'Presentacion de catalogo (email)',
  'email',
  'Catalogo I-ME para {{centro_medico}}',
  E'Hola {{nombre_destinatario}},\n\n'
  || E'Soy {{nombre_comercial}}, asesor(a) comercial de I-ME International Medical Enterprise.\n\n'
  || E'{{mensaje}}\n\n'
  || E'Estos son los productos que quiero compartir contigo:\n{{lista_productos_texto}}\n\n'
  || E'Quedo atento(a) a tus comentarios para coordinar una cotizacion o demostracion.\n\n'
  || E'Saludos,\n{{nombre_comercial}}\nI-ME International Medical Enterprise\n{{correo_comercial}} · {{telefono_comercial}}',
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM commercial_message_templates WHERE channel = 'email' AND is_default = true
);

INSERT INTO commercial_message_templates (name, channel, subject, body, is_default, is_active)
SELECT
  'Presentacion de catalogo (WhatsApp)',
  'whatsapp',
  NULL,
  E'Hola {{nombre_destinatario}}, soy {{nombre_comercial}} de I-ME.\n'
  || E'{{mensaje}}\n\n'
  || E'Te comparto estos productos de nuestro catalogo:\n{{lista_productos_texto}}\n\n'
  || E'Cualquier duda, quedo atento(a). {{telefono_comercial}}',
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM commercial_message_templates WHERE channel = 'whatsapp' AND is_default = true
);

-- ── 8. Plantilla en email_templates (Resend) para comercial-share ──
-- Solo se inserta si la tabla existe (deberia existir desde
-- 20260705000000_backoffice_f1_f3.sql, pero se verifica por robustez).
DO $$
BEGIN
  IF to_regclass('public.email_templates') IS NOT NULL THEN
    INSERT INTO email_templates (clave, descripcion, asunto, html)
    VALUES (
      'comercial_catalogo',
      'Envio de catalogo/productos desde el CMS comercial a un contacto externo',
      'Catalogo I-ME para {{centro_medico}}',
      '<h2>Hola {{nombre_destinatario}}</h2>'
        || '<p>Soy <strong>{{nombre_comercial}}</strong>, asesor(a) comercial de I-ME International Medical Enterprise'
        || '<span> para {{centro_medico}}</span>.</p>'
        || '<p>{{mensaje}}</p>'
        || '<p><strong>Productos compartidos:</strong></p>'
        || '<ul>{{lista_productos_html}}</ul>'
        || '<p>Quedo atento(a) a tus comentarios para coordinar una cotizacion o demostracion.</p>'
        || '<p>Saludos,<br>{{nombre_comercial}}<br>I-ME International Medical Enterprise<br>'
        || '{{correo_comercial}} · {{telefono_comercial}}</p>'
    )
    ON CONFLICT (clave) DO NOTHING;
  END IF;
END $$;
