-- Pausa explícita, silencio de 30 s, escritura, rate_limited reencolado,
-- plantillas Meta y bandera del watcher. Aditiva: no borra filas.

ALTER TABLE public.whatsapp_outbound_messages
  ADD COLUMN IF NOT EXISTS origin text;

COMMENT ON COLUMN public.whatsapp_outbound_messages.origin IS
  'owner_echo: lo escribió el dueño. imeia: la plataforma. external: otro envío.';

ALTER TABLE public.whatsapp_outbound_messages
  DROP CONSTRAINT IF EXISTS whatsapp_outbound_messages_kind_check;

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
      AND rel.relname = 'whatsapp_outbound_messages'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.whatsapp_outbound_messages DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE public.whatsapp_outbound_messages
  ADD CONSTRAINT whatsapp_outbound_messages_kind_check
  CHECK (kind IN ('holding', 'reply', 'template', 'other'));

COMMENT ON COLUMN public.whatsapp_outbound_messages.kind IS
  'holding: espera. reply: respuesta del agente. template: plantilla Meta. other: eco u otro.';

CREATE TABLE IF NOT EXISTS public.whatsapp_typing_state (
  sender_id text PRIMARY KEY,
  typing_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_typing_state IS
  'Pulso de escritura del contacto. El reclamo espera a que pare, con tope de 2 minutos desde el último mensaje.';

CREATE TABLE IF NOT EXISTS public.whatsapp_watcher_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL,
  outbound_id uuid,
  wamid text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);

COMMENT ON TABLE public.whatsapp_watcher_flags IS
  'El watcher lee filas con acknowledged_at nulo. Un envío que no es IMEIA ni el eco del dueño en un chat ya pausado.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_watcher_flags_open
  ON public.whatsapp_watcher_flags (created_at DESC)
  WHERE acknowledged_at IS NULL;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['whatsapp_typing_state', 'whatsapp_watcher_flags']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.note_whatsapp_typing(p_sender text, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route text := nullif(btrim(coalesce(p_sender, '')), '');
  v_found text;
BEGIN
  IF v_route IS NULL THEN
    RETURN;
  END IF;
  SELECT r.sender_id INTO v_found
  FROM public.whatsapp_contact_routes r
  WHERE r.sender_id = v_route OR r.phone = v_route OR r.bsuid = v_route
  ORDER BY (r.sender_id = v_route) DESC, r.updated_at DESC
  LIMIT 1;
  v_route := coalesce(v_found, v_route);
  INSERT INTO public.whatsapp_typing_state (sender_id, typing_until)
  VALUES (
    v_route,
    CASE WHEN p_active IS TRUE THEN now() + interval '20 seconds' ELSE NULL END
  )
  ON CONFLICT (sender_id) DO UPDATE
    SET typing_until = EXCLUDED.typing_until,
        updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.whatsapp_flag_paused_outbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind IN ('reply', 'holding', 'template') THEN
    RETURN NEW;
  END IF;
  IF NEW.origin IN ('owner_echo', 'imeia') THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.whatsapp_contact_pauses p
    WHERE p.paused
      AND p.wa_id = NEW.to_wa
      AND p.updated_by IS DISTINCT FROM NEW.wamid
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.whatsapp_watcher_flags (wa_id, outbound_id, wamid, reason)
  VALUES (NEW.to_wa, NEW.id, NEW.wamid, 'paused_unmatched_outbound');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS whatsapp_watcher_paused_outbound ON public.whatsapp_outbound_messages;
CREATE TRIGGER whatsapp_watcher_paused_outbound
  AFTER INSERT ON public.whatsapp_outbound_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsapp_flag_paused_outbound();

-- Reclamo y persistencia. Silencio por defecto 30 s. La escritura alarga la espera
-- hasta 2 minutos desde el último mensaje. rate_limited vuelve a pending_agent.
CREATE OR REPLACE FUNCTION public.ingest_whatsapp_event(p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender text := p_event->>'sender_id';
  v_route text;
  v_phone text := p_event->>'phone';
  v_bsuid text := p_event->>'bsuid';
  v_reason text := p_event->>'drop_reason';
  v_status text;
  v_echo boolean := p_event->>'kind' = 'echo';
  v_action text := p_event->>'echo_action';
  v_body text := p_event->>'body';
  v_token text := lower(regexp_replace(split_part(btrim(coalesce(v_body, '')), ' ', 1), '[.,;:!?…]+$', ''));
  v_template text := nullif(btrim(coalesce(p_event->>'template_name', '')), '');
  v_command boolean := v_token IN ('#pausa', '/pausa', '#pause', '#parar', '#continua', '#activa');
  v_owner boolean := coalesce(p_event->>'owner_echo', '') IN ('true', 't', '1');
  v_outbound_body text;
  v_origin text;
  v_was_paused boolean := false;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp_ingest', 0));
  IF v_token IN ('#pausa', '/pausa', '#pause', '#parar') THEN
    v_action := 'pause';
  ELSIF v_token IN ('#continua', '#activa') THEN
    v_action := 'resume';
  END IF;
  IF EXISTS (SELECT 1 FROM whatsapp_inbound_events WHERE wamid = p_event->>'wamid') THEN
    INSERT INTO whatsapp_drop_log (wamid, sender_id, drop_reason, raw)
    VALUES (p_event->>'wamid', v_sender, 'duplicate', p_event->'raw');
    RETURN jsonb_build_object('status', 'duplicate');
  END IF;
  SELECT r.sender_id INTO v_route
  FROM whatsapp_contact_routes r
  WHERE r.sender_id = v_sender
    OR (v_bsuid IS NOT NULL AND r.bsuid = v_bsuid)
    OR (v_phone IS NOT NULL AND r.phone = v_phone)
  ORDER BY (r.sender_id = v_sender) DESC, r.updated_at DESC
  LIMIT 1;
  v_route := coalesce(v_route, v_sender);
  INSERT INTO whatsapp_contact_routes (sender_id, phone, bsuid, username, profile_name)
  VALUES (v_route, v_phone, v_bsuid, p_event->>'username', p_event->>'profile_name')
  ON CONFLICT (sender_id) DO UPDATE
    SET phone = coalesce(EXCLUDED.phone, whatsapp_contact_routes.phone),
        bsuid = coalesce(EXCLUDED.bsuid, whatsapp_contact_routes.bsuid),
        username = coalesce(EXCLUDED.username, whatsapp_contact_routes.username),
        profile_name = coalesce(EXCLUDED.profile_name, whatsapp_contact_routes.profile_name),
        updated_at = now();
  IF v_echo THEN
    IF EXISTS (SELECT 1 FROM whatsapp_outbound_messages WHERE wamid = p_event->>'wamid') THEN
      v_reason := 'duplicate';
      v_status := 'echo';
    ELSIF v_template IS NOT NULL THEN
      INSERT INTO whatsapp_outbound_messages (
        to_wa, body, kind, wamid, phone_number_id, send_status, origin
      )
      VALUES (
        v_route, left(v_template, 4096), 'template', p_event->>'wamid',
        p_event->>'phone_number_id', 'sent', 'imeia'
      );
      v_status := 'echo';
      v_reason := NULL;
    ELSE
      v_outbound_body := CASE WHEN v_command THEN '[toma-humana]' ELSE left(coalesce(v_body, '[eco]'), 4096) END;
      v_origin := CASE WHEN v_owner OR v_command THEN 'owner_echo' ELSE 'external' END;
      SELECT EXISTS (
        SELECT 1 FROM whatsapp_contact_pauses p WHERE p.wa_id = v_route AND p.paused
      ) INTO v_was_paused;
      INSERT INTO whatsapp_contact_pauses (wa_id, paused, paused_at, resumed_at, updated_by, reason)
      VALUES (
        v_route,
        v_action IS DISTINCT FROM 'resume',
        CASE WHEN v_action IS DISTINCT FROM 'resume' THEN now() END,
        CASE WHEN v_action = 'resume' THEN now() END,
        p_event->>'wamid',
        'human_takeover'
      )
      ON CONFLICT (wa_id) DO UPDATE
        SET paused = EXCLUDED.paused,
            paused_at = coalesce(EXCLUDED.paused_at, whatsapp_contact_pauses.paused_at),
            resumed_at = CASE
              WHEN EXCLUDED.paused THEN whatsapp_contact_pauses.resumed_at
              ELSE coalesce(EXCLUDED.resumed_at, now())
            END,
            updated_by = EXCLUDED.updated_by,
            reason = EXCLUDED.reason;
      INSERT INTO whatsapp_outbound_messages (
        to_wa, body, kind, wamid, phone_number_id, send_status, origin
      )
      VALUES (
        v_route, v_outbound_body, 'other', p_event->>'wamid',
        p_event->>'phone_number_id', 'sent', v_origin
      );
      IF v_origin = 'external' AND v_was_paused THEN
        INSERT INTO whatsapp_watcher_flags (wa_id, wamid, reason)
        VALUES (v_route, p_event->>'wamid', 'paused_unmatched_outbound');
      END IF;
      v_status := 'echo';
      v_reason := 'human_takeover';
    END IF;
  ELSE
    UPDATE whatsapp_typing_state
      SET typing_until = NULL, updated_at = now()
      WHERE sender_id = v_route OR sender_id = v_sender;
    v_reason := coalesce(v_reason, public.whatsapp_dispatch_drop_reason(v_route));
    v_status := CASE
      WHEN v_reason = 'paused' THEN 'human_paused'
      WHEN v_reason = 'rate_limited' THEN 'pending_agent'
      WHEN v_reason IS NOT NULL THEN 'ignored'
      ELSE 'pending_agent'
    END;
  END IF;
  INSERT INTO whatsapp_inbound_events (
    wamid, from_wa, sender_id, sender_type, username, profile_name, phone_number_id,
    kind, body, raw, status, drop_reason
  )
  VALUES (
    p_event->>'wamid', v_route, v_sender, p_event->>'sender_type', p_event->>'username',
    p_event->>'profile_name', p_event->>'phone_number_id', p_event->>'kind', v_body,
    p_event->'raw', v_status, v_reason
  );
  IF v_reason IS NOT NULL THEN
    INSERT INTO whatsapp_drop_log (wamid, sender_id, drop_reason, raw)
    VALUES (p_event->>'wamid', v_sender, v_reason, p_event->'raw');
  END IF;
  RETURN jsonb_build_object(
    'status', CASE WHEN v_reason = 'duplicate' THEN 'duplicate' ELSE v_status END,
    'from_wa', v_route
  );
END $$;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_agent_batch(
  p_from_wa text,
  p_quiet_seconds integer DEFAULT 30,
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
  IF public.whatsapp_dispatch_drop_reason(p_from_wa) IS NOT NULL THEN
    RETURN;
  END IF;
  IF p_quiet_seconds IS NULL OR p_quiet_seconds < 0 OR p_quiet_seconds > 600 THEN
    p_quiet_seconds := 30;
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

  IF v_latest > now() - interval '120 seconds' AND EXISTS (
    SELECT 1
    FROM public.whatsapp_typing_state t
    WHERE t.typing_until > now()
      AND (
        t.sender_id = p_from_wa
        OR t.sender_id IN (
          SELECT unnest(ARRAY[r.phone, r.bsuid, r.sender_id])
          FROM public.whatsapp_contact_routes r
          WHERE r.sender_id = p_from_wa OR r.phone = p_from_wa OR r.bsuid = p_from_wa
        )
      )
  ) THEN
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

COMMENT ON FUNCTION public.claim_whatsapp_agent_batch(text, integer, integer) IS
  'Reclama pending_agent tras 30 s de silencio. Si el contacto sigue escribiendo, espera hasta 2 minutos desde el último mensaje. 0 filas si está en pausa, es grupo, excluido o ya hay reclamo fresco.';

REVOKE ALL ON FUNCTION public.note_whatsapp_typing(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.note_whatsapp_typing(text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.whatsapp_flag_paused_outbound() FROM PUBLIC, anon, authenticated;
