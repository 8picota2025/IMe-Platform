-- Despacho IMEIA: reclamo por remitente y bitácora de salidas.
-- Aditiva. El cron lo programa 20260925150000_whatsapp_dispatch_cron.sql.
-- El criterio de reclamo debe seguir a reclamarLoteWhatsApp
-- (src/lib/whatsapp-imeia-dispatch.ts).

ALTER TABLE whatsapp_inbound_events
  ADD COLUMN IF NOT EXISTS agent_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_claim_token UUID;

COMMENT ON COLUMN whatsapp_inbound_events.agent_claimed_at IS
  'Marca de reclamo del despacho. El status sigue en pending_agent hasta que el agente lo cierra.';
COMMENT ON COLUMN whatsapp_inbound_events.agent_claim_token IS
  'Token del lote reclamado. Un segundo despacho con reclamo fresco sale con 0 filas.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_events_pending_sender
  ON whatsapp_inbound_events (from_wa, created_at DESC)
  WHERE status = 'pending_agent';

CREATE TABLE IF NOT EXISTS whatsapp_outbound_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_wa            TEXT NOT NULL,
  body             TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4096),
  kind             TEXT NOT NULL CHECK (kind IN ('holding', 'reply', 'other')),
  wamid            TEXT,
  turn_key         TEXT,
  phone_number_id  TEXT,
  send_status      TEXT NOT NULL DEFAULT 'sent'
                   CHECK (send_status IN ('pending', 'sent', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE whatsapp_outbound_messages IS
  'Lo que la plataforma o el agente envió por WhatsApp. El agente inserta kind=reply con service_role.';
COMMENT ON COLUMN whatsapp_outbound_messages.wamid IS
  'Id del mensaje saliente en Graph (messages[0].id), no el wamid entrante.';
COMMENT ON COLUMN whatsapp_outbound_messages.turn_key IS
  'En kind=holding: wamid del pendiente más reciente. Una espera por turno.';
COMMENT ON COLUMN whatsapp_outbound_messages.send_status IS
  'sent cuenta como mensaje ya entregado al cliente. pending es la reserva anti-duplicado.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_to_created
  ON whatsapp_outbound_messages (to_wa, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsapp_outbound_holding_turn
  ON whatsapp_outbound_messages (to_wa, turn_key)
  WHERE kind = 'holding' AND turn_key IS NOT NULL;

ALTER TABLE whatsapp_outbound_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE whatsapp_outbound_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE whatsapp_outbound_messages TO service_role;

-- Reclamo atómico de los pending_agent de un remitente (ventana 24 h).
-- 0 filas = otro despacho ya los tiene, el silencio no se cumplió, es grupo o está ignored.
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

REVOKE ALL ON FUNCTION public.claim_whatsapp_agent_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_agent_batch(text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.claim_whatsapp_agent_batch(text, integer, integer) IS
  'Reclama los pending_agent de un remitente para un solo wake. 0 filas: no despertar.';
