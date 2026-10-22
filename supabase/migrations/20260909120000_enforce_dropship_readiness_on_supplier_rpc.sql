-- Dropship notify must honor supplier-directory readiness gates.
-- get_proveedor_para_producto previously only checked activo, so flipping
-- activo on a research prospect (seeded with public third-party emails)
-- made customer PII eligible for notificar-proveedor without dropship_enabled,
-- apto_dropship, or commercial approval.

-- Preserve pre-directory operational suppliers already used in fulfillment.
UPDATE proveedores AS p
SET
  lifecycle_status = CASE
    WHEN p.lifecycle_status = 'prospect' THEN 'aprobado'
    ELSE p.lifecycle_status
  END,
  dropship_enabled = true
WHERE p.activo = true
  AND p.dropship_enabled = false
  AND EXISTS (
    SELECT 1
    FROM proveedor_producto AS pp
    WHERE pp.proveedor_id = p.id
      AND pp.activo = true
  );

UPDATE proveedor_producto
SET apto_dropship = true
WHERE activo = true
  AND apto_dropship = false;

CREATE OR REPLACE FUNCTION get_proveedor_para_producto(p_producto_id UUID)
RETURNS TABLE (
  proveedor_id       UUID,
  canal              TEXT,
  contacto_email     TEXT,
  contacto_whatsapp  TEXT,
  webhook_url        TEXT,
  api_config         JSONB
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.proveedor_id,
    p.canal,
    p.contacto_email,
    p.contacto_whatsapp,
    p.webhook_url,
    p.api_config
  FROM proveedor_producto pp
  JOIN proveedores p ON p.id = pp.proveedor_id
  WHERE pp.producto_id = p_producto_id
    AND pp.activo = true
    AND pp.apto_dropship = true
    AND p.activo = true
    AND p.dropship_enabled = true
  ORDER BY pp.prioridad ASC
  LIMIT 1;
$$;
