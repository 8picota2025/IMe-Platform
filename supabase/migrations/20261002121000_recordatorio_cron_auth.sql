-- Reuse the existing protected cron credential; never embed JWTs in cron.job.
DO $$ DECLARE existing bigint; new_job bigint; BEGIN
  FOR existing IN SELECT jobid FROM cron.job
    WHERE jobname = 'recordatorio-carritos' OR command LIKE '%/functions/v1/recordatorio-carritos%'
  LOOP PERFORM cron.unschedule(existing); END LOOP;
  new_job := cron.schedule('recordatorio-carritos','0 * * * *', $cron$
    SELECT net.http_post(
      url := 'https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/recordatorio-carritos',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
        (SELECT token FROM public.whatsapp_dispatch_auth WHERE id = 1)),
      body := '{}'::jsonb, timeout_milliseconds := 5000
    );
  $cron$);
  -- Activate only after the matching handler is deployed and reviewed.
  PERFORM cron.alter_job(new_job, active := false);
END $$;
