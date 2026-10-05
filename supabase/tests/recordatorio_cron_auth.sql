DO $$ BEGIN
  IF (SELECT count(*) FROM cron.job WHERE jobname = 'recordatorio-carritos') <> 1 THEN RAISE EXCEPTION 'cron duplicate'; END IF;
  IF (SELECT active FROM cron.job WHERE jobname = 'recordatorio-carritos') THEN RAISE EXCEPTION 'cron prematurely active'; END IF;
  IF (SELECT command NOT LIKE '%SELECT token FROM public.whatsapp_dispatch_auth%' FROM cron.job WHERE jobname = 'recordatorio-carritos') THEN RAISE EXCEPTION 'wrong auth source'; END IF;
  IF (SELECT command LIKE '%fixture-not-a-production-secret%' FROM cron.job WHERE jobname = 'recordatorio-carritos') THEN RAISE EXCEPTION 'embedded credential'; END IF;
END $$;
