-- Historial de "Publicar cambios" (trigger-rebuild)

CREATE TABLE IF NOT EXISTS public.cms_publish_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  requested_email text,
  reason text,
  mode text,
  ok boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cms_publish_log_created_at_idx
  ON public.cms_publish_log (created_at DESC);

ALTER TABLE public.cms_publish_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_publish_log_admin_select" ON public.cms_publish_log;
CREATE POLICY "cms_publish_log_admin_select"
  ON public.cms_publish_log FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['owner', 'admin', 'catalogo']));

-- Inserts solo vía service_role (Edge trigger-rebuild); sin policy INSERT para authenticated.
