-- Telemetría de uso del portal privado /comercial.
-- No almacena email, teléfono, nombre de destinatario ni contenido de mensajes.
-- La identidad se toma del JWT y solo se usa para agregados internos por usuario.

CREATE TABLE IF NOT EXISTS public.commercial_usage_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 128),
  event_name  TEXT NOT NULL CHECK (event_name IN (
    'login', 'logout', 'idle_logout', 'view', 'search', 'filter',
    'product_selected', 'share_modal_open', 'share_submitted',
    'share_succeeded', 'share_failed', 'crm_retry', 'pwa_install',
    'pwa_dismiss', 'error'
  )),
  view        TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commercial_usage_events_created_idx
  ON public.commercial_usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS commercial_usage_events_user_created_idx
  ON public.commercial_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commercial_usage_events_event_created_idx
  ON public.commercial_usage_events (event_name, created_at DESC);

ALTER TABLE public.commercial_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_usage_events_insert_own" ON public.commercial_usage_events;
CREATE POLICY "commercial_usage_events_insert_own"
  ON public.commercial_usage_events FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND is_comercial_user()
  );

DROP POLICY IF EXISTS "commercial_usage_events_admin_select" ON public.commercial_usage_events;
CREATE POLICY "commercial_usage_events_admin_select"
  ON public.commercial_usage_events FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin', 'lectura']));

GRANT SELECT, INSERT ON public.commercial_usage_events TO authenticated;
