-- Twenty CRM IDs para sync cliente → pago → factura
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS twenty_person_id TEXT,
  ADD COLUMN IF NOT EXISTS twenty_company_id TEXT;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS twenty_opportunity_id TEXT;

ALTER TABLE solicitudes_cotizacion
  ADD COLUMN IF NOT EXISTS twenty_person_id TEXT,
  ADD COLUMN IF NOT EXISTS twenty_company_id TEXT,
  ADD COLUMN IF NOT EXISTS twenty_opportunity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clientes_twenty_person
  ON clientes (twenty_person_id)
  WHERE twenty_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_twenty_opportunity
  ON pedidos (twenty_opportunity_id)
  WHERE twenty_opportunity_id IS NOT NULL;
