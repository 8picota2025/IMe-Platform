-- Intermediate claim state for anular-factura-dian CAS (emitida → anulando → anulada).
-- Prevents two concurrent annulments from each creating a Siigo/DIAN credit note.

ALTER TABLE facturas_electronicas DROP CONSTRAINT IF EXISTS facturas_electronicas_estado_check;
ALTER TABLE facturas_electronicas
  ADD CONSTRAINT facturas_electronicas_estado_check
  CHECK (estado = ANY (ARRAY[
    'pendiente_pago'::text,
    'pendiente_envio'::text,
    'emitida'::text,
    'rechazada'::text,
    'error'::text,
    'anulando'::text,
    'anulada'::text
  ]));

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_facturacion_electronica_estado_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_facturacion_electronica_estado_check
  CHECK (facturacion_electronica_estado = ANY (ARRAY[
    'no_solicitada'::text,
    'pendiente_pago'::text,
    'pendiente_envio'::text,
    'emitida'::text,
    'rechazada'::text,
    'error'::text,
    'anulando'::text,
    'anulada'::text
  ]));
