-- Programa el despacho IMEIA cada minuto. El bearer no está en git:
-- se genera aquí, vive en whatsapp_dispatch_auth, y pg_cron lo lee al
-- ejecutar. La función (verify_jwt = false) lo compara en tiempo constante
-- con esa fila o con la clave de servicio que ya inyecta la plataforma.
-- Un JWT sin firma no autentica.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.whatsapp_dispatch_auth (
  id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token      TEXT NOT NULL CHECK (char_length(token) >= 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_dispatch_auth IS
  'Bearer del cron whatsapp-imeia-dispatch. Una fila. No sale a anon ni a git.';

-- pg_catalog.gen_random_uuid existe en el Postgres de Supabase sin depender
-- del esquema de pgcrypto. Reaplicar la migración no rota el token.
INSERT INTO public.whatsapp_dispatch_auth (id, token)
SELECT 1,
       replace(pg_catalog.gen_random_uuid()::text, '-', '')
         || replace(pg_catalog.gen_random_uuid()::text, '-', '')
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_dispatch_auth WHERE id = 1
);

ALTER TABLE public.whatsapp_dispatch_auth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_dispatch_auth FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.whatsapp_dispatch_auth TO service_role;

DO $$
DECLARE
  existing bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron no dejó cron.job; no se programa whatsapp-imeia-dispatch';
  END IF;
  FOR existing IN
    SELECT jobid FROM cron.job WHERE jobname = 'whatsapp-imeia-dispatch'
  LOOP
    PERFORM cron.unschedule(existing);
  END LOOP;
END $$;

SELECT cron.schedule(
  'whatsapp-imeia-dispatch',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/whatsapp-imeia-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT token FROM public.whatsapp_dispatch_auth WHERE id = 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) AS request_id;
  $cron$
);
