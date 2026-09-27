-- Toma humana: #pausa / #activa desde el WhatsApp Business app.
-- Aditiva. No envía mensajes. El cron y el despacho ya existen.

ALTER TABLE whatsapp_inbound_events
  DROP CONSTRAINT IF EXISTS whatsapp_inbound_events_status_check;

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'whatsapp_inbound_events'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~* 'status'
      AND pg_get_constraintdef(con.oid) !~* 'kind'
  LOOP
    EXECUTE format('ALTER TABLE whatsapp_inbound_events DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE whatsapp_inbound_events
  ADD CONSTRAINT whatsapp_inbound_events_status_check
  CHECK (status IN (
    'claimed', 'replied', 'ignored', 'rate_limited', 'send_failed',
    'pending_agent', 'human_paused', 'echo'
  ));

ALTER TABLE whatsapp_inbound_events
  DROP CONSTRAINT IF EXISTS whatsapp_inbound_events_kind_check;

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'whatsapp_inbound_events'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~* 'kind'
  LOOP
    EXECUTE format('ALTER TABLE whatsapp_inbound_events DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE whatsapp_inbound_events
  ADD CONSTRAINT whatsapp_inbound_events_kind_check
  CHECK (kind IN ('message', 'status', 'ignored', 'echo'));

COMMENT ON COLUMN whatsapp_inbound_events.status IS
  'human_paused: el cliente está en #pausa y IMEIA no lo responde. echo: idempotencia de un eco de la app, no es un mensaje del cliente.';

CREATE TABLE IF NOT EXISTS public.whatsapp_contact_pauses (
  wa_id      TEXT PRIMARY KEY CHECK (wa_id ~ '^[0-9]{8,15}$'),
  paused     BOOLEAN NOT NULL,
  paused_at  TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  updated_by TEXT
);

COMMENT ON TABLE public.whatsapp_contact_pauses IS
  'Pausa de IMEIA por cliente. Sin caducidad: sigue hasta #activa. updated_by es el wamid del eco.';

ALTER TABLE public.whatsapp_contact_pauses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_contact_pauses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_contact_pauses TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsapp_outbound_wamid
  ON whatsapp_outbound_messages (wamid)
  WHERE wamid IS NOT NULL;

-- El reclamo sale vacío si el cliente está en pausa (ni wake ni, vía el plan, espera).
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
  IF p_from_wa ILIKE '%@g.us%' OR position('-' in p_from_wa) > 0 THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.whatsapp_contact_pauses p
    WHERE p.wa_id = p_from_wa
      AND p.paused
  ) THEN
    RETURN;
  END IF;
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

COMMENT ON FUNCTION public.claim_whatsapp_agent_batch(text, integer, integer) IS
  'Reclama los pending_agent de un remitente. 0 filas si está en pausa, es grupo, no hubo silencio o ya hay reclamo fresco.';
