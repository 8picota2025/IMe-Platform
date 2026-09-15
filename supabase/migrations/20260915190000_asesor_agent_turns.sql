-- Web IMEIA turns delegated to the external Grok routine.
-- Edge Function and routine use service_role; browser has no table access.
CREATE TABLE IF NOT EXISTS asesor_agent_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'replied', 'failed', 'timeout')),
  session_id TEXT NOT NULL,
  conversation_id TEXT,
  locale TEXT NOT NULL CHECK (locale IN ('es', 'en')),
  mensaje TEXT NOT NULL,
  historial JSONB NOT NULL DEFAULT '[]'::jsonb,
  navigation_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  reply_texto TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_asesor_agent_turns_status_created_at
  ON asesor_agent_turns (status, created_at);

CREATE INDEX IF NOT EXISTS idx_asesor_agent_turns_session_created_at
  ON asesor_agent_turns (session_id, created_at DESC);

DROP TRIGGER IF EXISTS set_asesor_agent_turns_updated_at ON asesor_agent_turns;
CREATE TRIGGER set_asesor_agent_turns_updated_at
  BEFORE UPDATE ON asesor_agent_turns
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE asesor_agent_turns ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated are denied. Edge Function and routine use service_role.
