-- IMEIA → CRM: trazabilidad de origen y sesión en solicitudes de cotización
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS origen TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS asesor_fase TEXT;

CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_origen
  ON solicitudes_cotizacion (origen)
  WHERE origen IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_session
  ON solicitudes_cotizacion (session_id)
  WHERE session_id IS NOT NULL;
