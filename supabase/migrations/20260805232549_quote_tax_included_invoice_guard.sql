-- La facturación de una cotización exige que ventas declare cómo se compone
-- el precio. NULL mantiene las ofertas históricas bloqueadas para FE hasta
-- que un comercial las revise explícitamente.
ALTER TABLE solicitudes_cotizacion
  ADD COLUMN IF NOT EXISTS impuestos_incluidos BOOLEAN;
