-- Catalog-to-manufacturer references are evidence links, not commercial supply
-- agreements. A public product page does not establish price, stock, lead time
-- or dropshipping authorization.

-- A catalog reference can exist before commercial cost is received. Keeping the
-- value NULL is materially different from recording a made-up zero cost.
ALTER TABLE proveedor_producto
  ALTER COLUMN precio_costo DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS association_status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (association_status IN ('pendiente', 'verificado', 'rechazado')),
  ADD COLUMN IF NOT EXISTS association_source TEXT,
  ADD COLUMN IF NOT EXISTS association_notes TEXT;

-- Match only the exact manufacturer label already stored in the public catalog.
-- All seeded links are inactive for fulfilment, have no cost and must be
-- commercially verified before becoming an operational provider-product row.
WITH manufacturer_matches(supplier_slug, catalog_brand) AS (
  VALUES
    ('saikang-medical', 'Saikang Medical'),
    ('angell-technology', 'Angell Technology'),
    ('tuttnauer', 'Tuttnauer'),
    ('biobase', 'BIOBASE'),
    ('ilumitec', 'Ilumitec'),
    ('air-liquide-medical-systems', 'Air Liquide')
)
INSERT INTO proveedor_producto (
  proveedor_id,
  producto_id,
  precio_costo,
  moneda_costo,
  prioridad,
  activo,
  disponibilidad,
  apto_dropship,
  association_status,
  association_source,
  association_notes
)
SELECT
  proveedor.id,
  producto.id,
  NULL,
  'COP',
  9999,
  false,
  'desconocida',
  false,
  'pendiente',
  'marca exacta en atributos del catálogo I-ME',
  'Asociación de referencia catálogo–fabricante. No confirma relación comercial, costo, stock ni dropshipping.'
FROM manufacturer_matches
JOIN proveedores AS proveedor ON proveedor.slug = manufacturer_matches.supplier_slug
JOIN productos AS producto
  ON lower(coalesce(producto.atributos ->> 'marca', '')) = lower(manufacturer_matches.catalog_brand)
ON CONFLICT (proveedor_id, producto_id) DO NOTHING;
