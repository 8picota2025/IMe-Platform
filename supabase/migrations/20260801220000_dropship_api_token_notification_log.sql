-- Dropship operativo: api_token en proveedores + notification_log
-- (faltaban en remoto aunque estaban en schema base local)

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS api_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS proveedores_api_token_uidx
  ON proveedores (api_token)
  WHERE api_token IS NOT NULL;

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
