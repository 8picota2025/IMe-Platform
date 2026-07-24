-- Hotfix producción: registrar-cotizacion ya envía campos enriquecidos,
-- pero producción puede estar antes de la migración CRM completa.
-- Mantener idempotente: la migración CRM posterior usa IF NOT EXISTS.

ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS tipo_solicitud TEXT NOT NULL DEFAULT 'cotizacion';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'web';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS mercado TEXT NOT NULL DEFAULT 'CO';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'COP';
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS total_estimado NUMERIC;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS cupon_codigo TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

ALTER TABLE solicitudes_cotizacion DROP CONSTRAINT IF EXISTS solicitudes_cotizacion_tipo_solicitud_check;
ALTER TABLE solicitudes_cotizacion
  ADD CONSTRAINT solicitudes_cotizacion_tipo_solicitud_check
  CHECK (tipo_solicitud IN ('cotizacion', 'compra_a_valorar', 'contacto', 'asesor'));
