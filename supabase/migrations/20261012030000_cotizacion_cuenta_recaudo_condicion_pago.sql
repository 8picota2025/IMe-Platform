-- Cuenta de recaudo y condición de pago por cotización.
-- NULL conserva el PDF histórico: Bancolombia Ahorros COP y «Contado».

ALTER TABLE solicitudes_cotizacion
  ADD COLUMN IF NOT EXISTS cuenta_recaudo TEXT,
  ADD COLUMN IF NOT EXISTS condicion_pago TEXT;

ALTER TABLE solicitudes_cotizacion
  DROP CONSTRAINT IF EXISTS solicitudes_cotizacion_cuenta_recaudo_check;

ALTER TABLE solicitudes_cotizacion
  ADD CONSTRAINT solicitudes_cotizacion_cuenta_recaudo_check
  CHECK (
    cuenta_recaudo IS NULL
    OR cuenta_recaudo IN ('bancolombia_ahorros', 'davivienda_sa')
  );

COMMENT ON COLUMN solicitudes_cotizacion.cuenta_recaudo IS
  'Cuenta de recaudo de la cotización. NULL o bancolombia_ahorros = Bancolombia Ahorros COP (PDF histórico). davivienda_sa = Davivienda S.A. 0550108900697583 SWIFT CAFECOBBXXX.';

COMMENT ON COLUMN solicitudes_cotizacion.condicion_pago IS
  'Condición de pago impresa en el PDF. NULL = Contado (es) / Prepaid (en).';
