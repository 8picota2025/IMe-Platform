-- Permite estado 'anulada' tras nota de credito Siigo/DIAN

ALTER TABLE facturas_electronicas DROP CONSTRAINT IF EXISTS facturas_electronicas_estado_check;
ALTER TABLE facturas_electronicas
  ADD CONSTRAINT facturas_electronicas_estado_check
  CHECK (estado = ANY (ARRAY[
    'pendiente_pago'::text,
    'pendiente_envio'::text,
    'emitida'::text,
    'rechazada'::text,
    'error'::text,
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
    'anulada'::text
  ]));
