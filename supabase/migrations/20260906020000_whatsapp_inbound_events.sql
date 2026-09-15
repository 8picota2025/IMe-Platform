-- Idempotencia de inbound WhatsApp Cloud API (wamid).
-- Solo service_role (Edge Function whatsapp-webhook). Deny-all a anon/authenticated.

CREATE TABLE IF NOT EXISTS whatsapp_inbound_events (
  wamid            TEXT PRIMARY KEY,
  from_wa          TEXT,
  phone_number_id  TEXT,
  kind             TEXT NOT NULL DEFAULT 'message'
                   CHECK (kind IN ('message', 'status', 'ignored')),
  status           TEXT NOT NULL DEFAULT 'claimed'
                   CHECK (status IN ('claimed', 'replied', 'ignored', 'rate_limited', 'send_failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_events_created
  ON whatsapp_inbound_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_events_status
  ON whatsapp_inbound_events(status);

ALTER TABLE whatsapp_inbound_events ENABLE ROW LEVEL SECURITY;
