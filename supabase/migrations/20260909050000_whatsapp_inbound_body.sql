-- Store inbound WhatsApp text for agent poll/wake replies; allow pending_agent status.
ALTER TABLE whatsapp_inbound_events
  ADD COLUMN IF NOT EXISTS body TEXT;

COMMENT ON COLUMN whatsapp_inbound_events.body IS 'Inbound WhatsApp text for agent poll/wake replies';

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
  CHECK (status IN ('claimed', 'replied', 'ignored', 'rate_limited', 'send_failed', 'pending_agent'));
