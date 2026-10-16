-- Un wake con HTTP 4xx no se arregla reintentando: alerta desde el primer fallo.
-- Igual que antes para el resto (umbral max_failures). Sin cambios de permisos.
CREATE OR REPLACE FUNCTION public.fail_whatsapp_batch(p_token uuid, p_error text, p_release boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_threshold integer; v_latest record;
BEGIN
  SELECT max_failures INTO v_threshold FROM whatsapp_pipeline_config WHERE id = 1;
  WITH failed AS (
    UPDATE whatsapp_inbound_events SET retry_count = retry_count + 1,last_error = left(p_error,500),
      agent_claimed_at = CASE WHEN p_release THEN NULL ELSE agent_claimed_at END,
      agent_claim_token = CASE WHEN p_release THEN NULL ELSE agent_claim_token END
    WHERE agent_claim_token = p_token AND status = 'pending_agent'
    RETURNING *
  ) SELECT * INTO v_latest FROM failed ORDER BY created_at DESC LIMIT 1;
  IF v_latest.wamid IS NULL THEN RETURN; END IF;
  IF p_error ~ '^wake_http_4[0-9]{2}$' THEN
    INSERT INTO whatsapp_alerts(sender_id,turn_key,reason,last_error,retry_count)
    VALUES(v_latest.from_wa,v_latest.wamid,'wake_http_4xx',v_latest.last_error,v_latest.retry_count)
    ON CONFLICT(turn_key,reason) DO UPDATE SET last_error = EXCLUDED.last_error,retry_count = EXCLUDED.retry_count;
  END IF;
  IF v_latest.retry_count >= v_threshold THEN
    INSERT INTO whatsapp_alerts(sender_id,turn_key,reason,last_error,retry_count)
    VALUES(v_latest.from_wa,v_latest.wamid,'consecutive_failures',v_latest.last_error,v_latest.retry_count)
    ON CONFLICT(turn_key,reason) DO UPDATE SET last_error = EXCLUDED.last_error,retry_count = EXCLUDED.retry_count;
  END IF;
END $function$;
