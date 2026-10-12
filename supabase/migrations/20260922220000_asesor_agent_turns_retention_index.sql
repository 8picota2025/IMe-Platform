-- ADR-0017: indice para la purga por antiguedad (purgar-asesor-agent-turns).
-- Los indices existentes (status, created_at) y (session_id, created_at)
-- no sirven para un DELETE ... WHERE created_at < cutoff sin filtrar por
-- status/session_id.

CREATE INDEX IF NOT EXISTS idx_asesor_agent_turns_created_at
  ON asesor_agent_turns (created_at);
