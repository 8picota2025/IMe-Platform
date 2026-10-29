-- Inteligencia de precios de proveedor y mercado (confidencial).
-- Costos de fábrica, distribuidores locales y referencias web.
-- Nunca se expone a anon ni al sitio público.
--
-- UniGuajira: el pedido incluye referencias web con recargo de estampillas
-- (+30 %). El brief no enumera equipo, URL ni precio de esas capturas, así que
-- no se insertan filas inventadas. El recargo se aplica en el CMS al cotizar.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS market_price_entries (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                  UUID REFERENCES productos(id) ON DELETE SET NULL,
  category                    TEXT,
  equipment_name              TEXT NOT NULL,
  brand                       TEXT,
  model                       TEXT,
  specs_summary               TEXT,
  invima_registration         TEXT,
  invima_status               TEXT,
  source_type                 TEXT NOT NULL
                              CHECK (source_type IN (
                                'factory_fob',
                                'factory_exw',
                                'factory_cif',
                                'local_distributor',
                                'web_scrape',
                                'historical_quote'
                              )),
  supplier_or_source_name     TEXT,
  supplier_country            TEXT,
  contact_email               TEXT,
  source_url_or_ref           TEXT,
  currency                    TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  unit_cost_original          NUMERIC NOT NULL CHECK (unit_cost_original >= 0),
  price_min_original          NUMERIC CHECK (price_min_original IS NULL OR price_min_original >= 0),
  price_avg_original          NUMERIC CHECK (price_avg_original IS NULL OR price_avg_original >= 0),
  price_max_original          NUMERIC CHECK (price_max_original IS NULL OR price_max_original >= 0),
  incoterm                    TEXT NOT NULL
                              CHECK (incoterm IN ('FOB', 'EXW', 'CIF', 'DDP_COLOMBIA', 'WEB_REF', 'LOCAL')),
  tier_min_qty                INTEGER NOT NULL DEFAULT 1 CHECK (tier_min_qty >= 1),
  lead_time                   TEXT,
  iva_mode                    TEXT CHECK (iva_mode IS NULL OR iva_mode IN ('incluido', 'mas_iva', 'no_aplica')),
  trm_applied                 NUMERIC CHECK (trm_applied IS NULL OR trm_applied > 0),
  freight_pct                 NUMERIC CHECK (freight_pct IS NULL OR freight_pct >= 0),
  duty_pct                    NUMERIC CHECK (duty_pct IS NULL OR duty_pct >= 0),
  ime_margin_pct              NUMERIC CHECK (ime_margin_pct IS NULL OR ime_margin_pct >= 0),
  estimated_landed_cost_cop   NUMERIC CHECK (estimated_landed_cost_cop IS NULL OR estimated_landed_cost_cop >= 0),
  suggested_sale_price_cop    NUMERIC CHECK (suggested_sale_price_cop IS NULL OR suggested_sale_price_cop >= 0),
  max_reference_price_cop     NUMERIC CHECK (max_reference_price_cop IS NULL OR max_reference_price_cop >= 0),
  public_stamp_surcharge_pct  NUMERIC CHECK (public_stamp_surcharge_pct IS NULL OR public_stamp_surcharge_pct >= 0),
  valid_until                 DATE,
  captured_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                       TEXT,
  raw_metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_key                TEXT UNIQUE,
  created_by                  UUID,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE market_price_entries IS
  'CONFIDENCIAL. Costos de proveedor y referencias de mercado. No publicar en el sitio ni en APIs anónimas.';

CREATE INDEX IF NOT EXISTS idx_market_price_source_type
  ON market_price_entries (source_type);
CREATE INDEX IF NOT EXISTS idx_market_price_category
  ON market_price_entries (category);
CREATE INDEX IF NOT EXISTS idx_market_price_brand
  ON market_price_entries (brand);
CREATE INDEX IF NOT EXISTS idx_market_price_model
  ON market_price_entries (model);
CREATE INDEX IF NOT EXISTS idx_market_price_currency
  ON market_price_entries (currency);
CREATE INDEX IF NOT EXISTS idx_market_price_captured
  ON market_price_entries (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_price_product
  ON market_price_entries (product_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_price_equipment_trgm
  ON market_price_entries USING gin (equipment_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_market_price_brand_trgm
  ON market_price_entries USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_market_price_model_trgm
  ON market_price_entries USING gin (model gin_trgm_ops);

DROP TRIGGER IF EXISTS set_market_price_entries_updated_at ON market_price_entries;
CREATE TRIGGER set_market_price_entries_updated_at
  BEFORE UPDATE ON market_price_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE FUNCTION market_price_entries_set_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_market_price_entries_actor ON market_price_entries;
CREATE TRIGGER set_market_price_entries_actor
  BEFORE INSERT ON market_price_entries
  FOR EACH ROW EXECUTE FUNCTION market_price_entries_set_actor();

CREATE OR REPLACE VIEW supplier_price_intelligence
WITH (security_invoker = true) AS
SELECT * FROM market_price_entries;

COMMENT ON VIEW supplier_price_intelligence IS
  'Alias de market_price_entries. security_invoker: respeta el RLS de la tabla.';

ALTER TABLE market_price_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE market_price_entries FROM PUBLIC, anon;
REVOKE ALL ON TABLE supplier_price_intelligence FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE market_price_entries TO authenticated;
GRANT SELECT ON TABLE supplier_price_intelligence TO authenticated;
GRANT ALL ON TABLE market_price_entries TO service_role;
GRANT SELECT ON TABLE supplier_price_intelligence TO service_role;

DROP POLICY IF EXISTS market_price_entries_select ON market_price_entries;
CREATE POLICY market_price_entries_select
  ON market_price_entries FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'catalogo']));

DROP POLICY IF EXISTS market_price_entries_insert ON market_price_entries;
CREATE POLICY market_price_entries_insert
  ON market_price_entries FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones', 'catalogo']));

DROP POLICY IF EXISTS market_price_entries_update ON market_price_entries;
CREATE POLICY market_price_entries_update
  ON market_price_entries FOR UPDATE
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones', 'catalogo']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones', 'catalogo']));

DROP POLICY IF EXISTS market_price_entries_delete ON market_price_entries;
CREATE POLICY market_price_entries_delete
  ON market_price_entries FOR DELETE
  TO authenticated
  USING (is_admin(ARRAY['operaciones']));

-- Semilla: solo precios explícitos recibidos por I-ME.
-- Sin TRM, flete, arancel, margen ni registro INVIMA: no venían en la fuente.
INSERT INTO market_price_entries (
  equipment_name,
  brand,
  model,
  source_type,
  supplier_or_source_name,
  currency,
  unit_cost_original,
  incoterm,
  tier_min_qty,
  iva_mode,
  captured_at,
  notes,
  source_url_or_ref,
  external_key,
  raw_metadata
) VALUES
  (
    'Angell DM156A',
    'Angell',
    'DM156A',
    'factory_cif',
    'Angell',
    'USD',
    54000,
    'CIF',
    1,
    NULL,
    '2026-10-25T12:00:00Z',
    'Precio recibido por I-ME. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:factory_cif:angell:dm156a:1',
    '{"origen_semilla":"brief-shoky-2026-10-25"}'::jsonb
  ),
  (
    'SonoScape SV-M4K220Exp',
    'SonoScape',
    'SV-M4K220Exp',
    'factory_exw',
    'SonoScape',
    'USD',
    42400,
    'EXW',
    1,
    NULL,
    '2026-10-25T12:00:00Z',
    'Precio recibido por I-ME. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:factory_exw:sonoscape:sv-m4k220exp:1',
    '{"origen_semilla":"brief-shoky-2026-10-25"}'::jsonb
  ),
  (
    'Siriusmed R55',
    'Siriusmed',
    'R55',
    'factory_exw',
    'Siriusmed',
    'USD',
    5550,
    'EXW',
    1,
    NULL,
    '2026-10-25T12:00:00Z',
    'Precio recibido por I-ME. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:factory_exw:siriusmed:r55:1',
    '{"origen_semilla":"brief-shoky-2026-10-25"}'::jsonb
  ),
  (
    'Heyer/Aeonmed VG70',
    'Heyer/Aeonmed',
    'VG70',
    'factory_cif',
    'Heyer/Aeonmed',
    'USD',
    4350,
    'CIF',
    1,
    NULL,
    '2026-10-25T12:00:00Z',
    'Precio recibido por I-ME. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:factory_cif:heyer-aeonmed:vg70:1',
    '{"origen_semilla":"brief-shoky-2026-10-25"}'::jsonb
  ),
  (
    'Miniklav 12L',
    NULL,
    'Miniklav 12L',
    'local_distributor',
    'Dental Store',
    'COP',
    3360000,
    'LOCAL',
    1,
    NULL,
    '2026-10-25T12:00:00Z',
    'Precio local recibido por I-ME. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:local:dental-store:miniklav-12l:1',
    '{"origen_semilla":"brief-shoky-2026-10-25"}'::jsonb
  ),
  (
    'Miniklav 5,5L',
    NULL,
    'Miniklav 5,5L',
    'local_distributor',
    'Dental Store',
    'COP',
    2850000,
    'LOCAL',
    1,
    NULL,
    '2026-10-25T12:00:00Z',
    'Precio local recibido por I-ME. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:local:dental-store:miniklav-5-5l:1',
    '{"origen_semilla":"brief-shoky-2026-10-25"}'::jsonb
  ),
  (
    'GraphNet TS',
    NULL,
    'GraphNet TS',
    'local_distributor',
    'Gilmédica',
    'COP',
    53695144,
    'LOCAL',
    1,
    NULL,
    '2026-10-25T12:00:00Z',
    'Precio unitario recibido por I-ME. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:local:gilmedica:graphnet-ts:1',
    '{"origen_semilla":"brief-shoky-2026-10-25","unidad":"por unidad"}'::jsonb
  ),
  (
    'ZOLL M2',
    'ZOLL',
    'M2',
    'local_distributor',
    'Jmedics',
    'COP',
    24620000,
    'LOCAL',
    1,
    'mas_iva',
    '2026-10-25T12:00:00Z',
    'Precio recibido por I-ME, sin IVA. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:local:jmedics:zoll-m2:1',
    '{"origen_semilla":"brief-shoky-2026-10-25","iva":"mas_iva"}'::jsonb
  ),
  (
    'COMEN S5',
    'COMEN',
    'S5',
    'local_distributor',
    'Allers',
    'COP',
    9215954,
    'LOCAL',
    1,
    'mas_iva',
    '2026-10-25T12:00:00Z',
    'Precio recibido por I-ME, sin IVA. La fecha original de la oferta no venía en el registro; captured_at es la fecha de carga.',
    'semilla-ime-2026-10-25',
    'seed:local:allers:comen-s5:1',
    '{"origen_semilla":"brief-shoky-2026-10-25","iva":"mas_iva"}'::jsonb
  )
ON CONFLICT (external_key) DO NOTHING;

UPDATE market_price_entries AS entry
SET product_id = match.product_id
FROM (
  SELECT entry_id, product_id
  FROM (
    SELECT
      seeded.id AS entry_id,
      product.id AS product_id,
      COUNT(*) OVER (PARTITION BY seeded.id) AS matches
    FROM market_price_entries AS seeded
    JOIN productos AS product
      ON lower(product.sku) = lower(seeded.model)
      OR lower(product.slug) = lower(replace(seeded.model, ' ', '-'))
    WHERE seeded.product_id IS NULL
      AND seeded.external_key LIKE 'seed:%'
  ) AS counted
  WHERE matches = 1
) AS match
WHERE entry.id = match.entry_id;
