-- El cron nocturno de embeddings usa el mismo token de cron que el dispatch de WhatsApp
-- (edge_service_key en vault no era aceptado por generar-embeddings: 401).
select cron.unschedule('generar-embeddings-nocturno')
 where exists (select 1 from cron.job where jobname = 'generar-embeddings-nocturno');
select cron.schedule('generar-embeddings-nocturno', '0 7 * * *', $$
  select net.http_post(
    url := 'https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/generar-embeddings',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select token from public.whatsapp_dispatch_auth where id = 1)),
    body := '{"solo_faltantes": true}'::jsonb,
    timeout_milliseconds := 120000);
$$);
