-- Estado comercial ampliado (perdida, declinada) y archivo recuperable.
-- No borra filas. Las listas por defecto ocultan archived_at IS NOT NULL.
-- El cambio de estado y el archivo los escriben la Edge `comercial-cotizacion`
-- y el MCP ime-comercio; ambos auditan en comercio_actuaciones.

ALTER TABLE solicitudes_cotizacion
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT;

ALTER TABLE solicitudes_cotizacion DROP CONSTRAINT IF EXISTS solicitudes_cotizacion_estado_check;
ALTER TABLE solicitudes_cotizacion
  ADD CONSTRAINT solicitudes_cotizacion_estado_check
  CHECK (estado IN (
    'nueva',
    'en_revision',
    'respondida',
    'enviada',
    'convertida',
    'expirada',
    'perdida',
    'declinada'
  ));

CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_activas
  ON solicitudes_cotizacion (estado, created_at DESC)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN solicitudes_cotizacion.archived_at IS
  'Soft delete. NULL = visible en las listas por defecto. Nunca borrar la fila.';
COMMENT ON COLUMN solicitudes_cotizacion.archived_by IS
  'auth.users del comercial que archivó (NULL si el MCP no trae actor_user_id).';
COMMENT ON COLUMN solicitudes_cotizacion.archived_reason IS
  'Motivo del archivo. El historial completo está en comercio_actuaciones.';
