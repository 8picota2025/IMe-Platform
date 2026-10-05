-- Additive: apply only after review. No credentials in this migration.
ALTER TABLE public.whatsapp_inbound_events
  ADD COLUMN sender_id text,
  ADD COLUMN sender_type text CHECK (sender_type IN ('phone', 'bsuid', 'username')),
  ADD COLUMN username text,
  ADD COLUMN profile_name text,
  ADD COLUMN raw jsonb,
  ADD COLUMN drop_reason text,
  ADD COLUMN retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  ADD COLUMN last_error text;
ALTER TABLE public.whatsapp_inbound_events DROP CONSTRAINT whatsapp_inbound_events_kind_check;
ALTER TABLE public.whatsapp_inbound_events DROP CONSTRAINT whatsapp_inbound_events_status_check;
ALTER TABLE public.whatsapp_inbound_events ADD CONSTRAINT whatsapp_inbound_events_status_check
  CHECK (status IN ('claimed','replied','ignored','rate_limited','send_failed','pending_agent','human_paused','echo','stale'));
UPDATE public.whatsapp_inbound_events SET sender_id = from_wa,
  sender_type = CASE WHEN from_wa ~ '^[0-9]{8,15}$' THEN 'phone' ELSE 'username' END
  WHERE from_wa IS NOT NULL;
ALTER TABLE public.whatsapp_contact_pauses DROP CONSTRAINT whatsapp_contact_pauses_wa_id_check;
ALTER TABLE public.whatsapp_contact_pauses ADD COLUMN reason text;

REVOKE ALL ON public.whatsapp_inbound_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_inbound_events TO service_role;

CREATE TABLE public.whatsapp_contact_exclusions (
  sender_id text PRIMARY KEY, motivo text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.whatsapp_contact_exclusions (sender_id, motivo)
SELECT id, 'user_requested' FROM unnest(ARRAY[
  '573156425021','573112000000','15628432865','919184009225','573237216344',
  '573128062584','573154348618','573004931866','8619061689171','8613699773609','8618077094838'
]) id;

-- Stable routing key (from_wa compatibility), latest confirmed sendable identifiers.
-- A username alone is retained but cannot authorize a Graph send.
CREATE TABLE public.whatsapp_contact_routes (
  sender_id text PRIMARY KEY, phone text, bsuid text, username text, profile_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX whatsapp_contact_routes_bsuid ON public.whatsapp_contact_routes(bsuid) WHERE bsuid IS NOT NULL;
CREATE INDEX whatsapp_contact_routes_phone ON public.whatsapp_contact_routes(phone);
INSERT INTO public.whatsapp_contact_routes(sender_id, phone)
SELECT DISTINCT from_wa, from_wa FROM public.whatsapp_inbound_events WHERE from_wa ~ '^[0-9]{8,15}$';

CREATE TABLE public.whatsapp_drop_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wamid text, sender_id text,
  drop_reason text NOT NULL, raw jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.whatsapp_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id text NOT NULL, turn_key text NOT NULL,
  reason text NOT NULL, last_error text, retry_count integer NOT NULL,
  second_holding_status text NOT NULL DEFAULT 'new' CHECK (second_holding_status IN ('new','reserved','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(turn_key, reason)
);
CREATE TABLE public.whatsapp_pipeline_config (
  id smallint PRIMARY KEY CHECK (id = 1), max_failures integer NOT NULL DEFAULT 3 CHECK (max_failures BETWEEN 1 AND 100)
);
INSERT INTO public.whatsapp_pipeline_config(id) VALUES (1);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['whatsapp_contact_exclusions','whatsapp_contact_routes','whatsapp_drop_log','whatsapp_alerts','whatsapp_pipeline_config'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE FUNCTION public.whatsapp_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER whatsapp_inbound_updated_at BEFORE UPDATE ON public.whatsapp_inbound_events
FOR EACH ROW EXECUTE FUNCTION public.whatsapp_touch_updated_at();

CREATE FUNCTION public.whatsapp_dispatch_drop_reason(p_sender text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_sender ~ '@g\.us' OR p_sender ~ '^[0-9]+-[0-9]+$' THEN 'group'
    WHEN EXISTS (SELECT 1 FROM whatsapp_contact_exclusions x WHERE x.sender_id = p_sender OR x.sender_id IN (
      SELECT unnest(ARRAY[r.phone,r.bsuid]) FROM whatsapp_contact_routes r WHERE r.sender_id = p_sender)) THEN 'excluded'
    WHEN EXISTS (SELECT 1 FROM whatsapp_contact_pauses p WHERE p.paused AND (p.wa_id = p_sender OR p.wa_id IN (
      SELECT unnest(ARRAY[r.phone,r.bsuid]) FROM whatsapp_contact_routes r WHERE r.sender_id = p_sender))) THEN 'paused'
    ELSE NULL END
$$;

-- Claim and persistence in ONE transaction: retries never leave an empty claimed row.
CREATE FUNCTION public.ingest_whatsapp_event(p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender text := p_event->>'sender_id'; v_route text; v_phone text := p_event->>'phone';
  v_bsuid text := p_event->>'bsuid'; v_reason text := p_event->>'drop_reason';
  v_status text; v_echo boolean := p_event->>'kind' = 'echo'; v_action text := p_event->>'echo_action';
BEGIN
  -- Serializes identity changes and duplicate echo delivery, not only wamid insert.
  PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp_ingest', 0));
  IF EXISTS (SELECT 1 FROM whatsapp_inbound_events WHERE wamid = p_event->>'wamid') THEN
    INSERT INTO whatsapp_drop_log(wamid,sender_id,drop_reason,raw)
    VALUES(p_event->>'wamid',v_sender,'duplicate',p_event->'raw');
    RETURN jsonb_build_object('status','duplicate');
  END IF;
  SELECT r.sender_id INTO v_route FROM whatsapp_contact_routes r
  WHERE r.sender_id = v_sender OR (v_bsuid IS NOT NULL AND r.bsuid = v_bsuid)
    OR (v_phone IS NOT NULL AND r.phone = v_phone)
  ORDER BY (r.sender_id = v_sender) DESC, r.updated_at DESC LIMIT 1;
  v_route := coalesce(v_route,v_sender);
  INSERT INTO whatsapp_contact_routes(sender_id,phone,bsuid,username,profile_name)
  VALUES(v_route,v_phone,v_bsuid,p_event->>'username',p_event->>'profile_name')
  ON CONFLICT (sender_id) DO UPDATE SET phone = coalesce(EXCLUDED.phone,whatsapp_contact_routes.phone),
    bsuid = coalesce(EXCLUDED.bsuid,whatsapp_contact_routes.bsuid),
    username = coalesce(EXCLUDED.username,whatsapp_contact_routes.username),
    profile_name = coalesce(EXCLUDED.profile_name,whatsapp_contact_routes.profile_name),updated_at = now();
  IF v_echo THEN
    -- API echoes already present in outbound are not a human takeover.
    IF EXISTS (SELECT 1 FROM whatsapp_outbound_messages WHERE wamid = p_event->>'wamid') THEN
      v_reason := 'duplicate'; v_status := 'echo';
    ELSE
      INSERT INTO whatsapp_contact_pauses(wa_id,paused,paused_at,resumed_at,updated_by,reason)
      VALUES(v_route,v_action IS DISTINCT FROM 'resume',CASE WHEN v_action IS DISTINCT FROM 'resume' THEN now() END,
        CASE WHEN v_action = 'resume' THEN now() END,p_event->>'wamid','human_takeover')
      ON CONFLICT (wa_id) DO UPDATE SET paused = EXCLUDED.paused,paused_at = coalesce(EXCLUDED.paused_at,whatsapp_contact_pauses.paused_at),
        resumed_at = coalesce(EXCLUDED.resumed_at,whatsapp_contact_pauses.resumed_at),updated_by = EXCLUDED.updated_by,reason = EXCLUDED.reason;
      INSERT INTO whatsapp_outbound_messages(to_wa,body,kind,wamid,phone_number_id,send_status)
      VALUES(v_route,p_event->>'body','other',p_event->>'wamid',p_event->>'phone_number_id','sent');
      v_status := 'echo'; v_reason := 'human_takeover';
    END IF;
  ELSE
    v_reason := coalesce(v_reason, public.whatsapp_dispatch_drop_reason(v_route));
    v_status := CASE WHEN v_reason = 'paused' THEN 'human_paused' WHEN v_reason IS NOT NULL THEN 'ignored' ELSE 'pending_agent' END;
  END IF;
  INSERT INTO whatsapp_inbound_events(wamid,from_wa,sender_id,sender_type,username,profile_name,phone_number_id,kind,body,raw,status,drop_reason)
  VALUES(p_event->>'wamid',v_route,v_sender,p_event->>'sender_type',p_event->>'username',p_event->>'profile_name',
    p_event->>'phone_number_id',p_event->>'kind',p_event->>'body',p_event->'raw',v_status,v_reason);
  IF v_reason IS NOT NULL THEN
    INSERT INTO whatsapp_drop_log(wamid,sender_id,drop_reason,raw) VALUES(p_event->>'wamid',v_sender,v_reason,p_event->'raw');
  END IF;
  RETURN jsonb_build_object('status',CASE WHEN v_reason = 'duplicate' THEN 'duplicate' ELSE v_status END,'from_wa',v_route);
END $$;

CREATE FUNCTION public.fail_whatsapp_batch(p_token uuid,p_error text,p_release boolean DEFAULT true) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF v_latest.retry_count >= v_threshold THEN
    INSERT INTO whatsapp_alerts(sender_id,turn_key,reason,last_error,retry_count)
    VALUES(v_latest.from_wa,v_latest.wamid,'consecutive_failures',v_latest.last_error,v_latest.retry_count)
    ON CONFLICT(turn_key,reason) DO UPDATE SET last_error = EXCLUDED.last_error,retry_count = EXCLUDED.retry_count;
  END IF;
END $$;

CREATE FUNCTION public.maintain_whatsapp_pipeline() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  WITH stale AS (
    UPDATE whatsapp_inbound_events SET status = 'stale',drop_reason = 'stale',agent_claimed_at = NULL,agent_claim_token = NULL
    WHERE status IN ('pending_agent','claimed','send_failed') AND created_at <= now() - interval '24 hours'
    RETURNING *
  ) INSERT INTO whatsapp_drop_log(wamid,sender_id,drop_reason) SELECT wamid,sender_id,'stale' FROM stale;
  FOR t IN SELECT DISTINCT agent_claim_token FROM whatsapp_inbound_events
    WHERE status = 'pending_agent' AND agent_claimed_at < now() - interval '180 seconds' AND last_error IS NULL
  LOOP PERFORM fail_whatsapp_batch(t,'agent_claim_expired',true); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_agent_batch(
  p_from_wa text,
  p_quiet_seconds integer DEFAULT 25,
  p_claim_ttl_seconds integer DEFAULT 180
)
RETURNS TABLE (
  out_wamid text,
  out_body text,
  out_created_at timestamptz,
  out_phone_number_id text,
  out_claim_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_latest timestamptz;
  v_quiet interval;
  v_ttl interval;
BEGIN
  IF p_from_wa IS NULL OR btrim(p_from_wa) = '' THEN
    RETURN;
  END IF;
  IF p_from_wa ILIKE '%@g.us%' OR p_from_wa ~ '^[0-9]+-[0-9]+$' THEN
    RETURN;
  END IF;
  IF public.whatsapp_dispatch_drop_reason(p_from_wa) IS NOT NULL THEN RETURN; END IF;
  IF p_quiet_seconds IS NULL OR p_quiet_seconds < 0 OR p_quiet_seconds > 600 THEN
    p_quiet_seconds := 25;
  END IF;
  IF p_claim_ttl_seconds IS NULL OR p_claim_ttl_seconds < 30 OR p_claim_ttl_seconds > 900 THEN
    p_claim_ttl_seconds := 180;
  END IF;

  v_quiet := make_interval(secs => p_quiet_seconds);
  v_ttl := make_interval(secs => p_claim_ttl_seconds);

  PERFORM 1
  FROM public.whatsapp_inbound_events
  WHERE whatsapp_inbound_events.from_wa = p_from_wa
    AND whatsapp_inbound_events.status = 'pending_agent'
    AND whatsapp_inbound_events.created_at > now() - interval '24 hours'
  FOR UPDATE;

  SELECT MAX(e.created_at)
    INTO v_latest
  FROM public.whatsapp_inbound_events e
  WHERE e.from_wa = p_from_wa
    AND e.status = 'pending_agent'
    AND e.created_at > now() - interval '24 hours';

  IF v_latest IS NULL OR v_latest > now() - v_quiet THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.whatsapp_inbound_events e
    WHERE e.from_wa = p_from_wa
      AND e.status = 'pending_agent'
      AND e.created_at > now() - interval '24 hours'
      AND e.agent_claimed_at IS NOT NULL
      AND e.agent_claimed_at >= now() - v_ttl
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.whatsapp_inbound_events e
    WHERE e.from_wa = p_from_wa
      AND e.status = 'ignored'
      AND e.created_at > now() - interval '24 hours'
      AND e.created_at >= v_latest
  ) THEN
    RETURN;
  END IF;

  UPDATE public.whatsapp_inbound_events e
  SET agent_claimed_at = now(),
      agent_claim_token = v_token,
      last_error = NULL,
      updated_at = now()
  WHERE e.from_wa = p_from_wa
    AND e.status = 'pending_agent'
    AND e.created_at > now() - interval '24 hours'
    AND (
      e.agent_claimed_at IS NULL
      OR e.agent_claimed_at < now() - v_ttl
    );

  RETURN QUERY
  SELECT e.wamid, e.body, e.created_at, e.phone_number_id, e.agent_claim_token
  FROM public.whatsapp_inbound_events e
  WHERE e.agent_claim_token = v_token;
END;
$$;


REVOKE ALL ON FUNCTION public.whatsapp_dispatch_drop_reason(text),public.ingest_whatsapp_event(jsonb),
  public.fail_whatsapp_batch(uuid,text,boolean),public.maintain_whatsapp_pipeline() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_dispatch_drop_reason(text),public.ingest_whatsapp_event(jsonb),
  public.fail_whatsapp_batch(uuid,text,boolean),public.maintain_whatsapp_pipeline() TO service_role;

CREATE UNIQUE INDEX whatsapp_outbound_reply_turn ON public.whatsapp_outbound_messages(turn_key)
WHERE kind = 'reply' AND turn_key IS NOT NULL;
