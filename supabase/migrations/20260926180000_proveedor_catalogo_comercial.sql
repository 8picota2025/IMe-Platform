-- Campos comerciales del directorio y seguimiento.
-- Aditivo: no borra columnas ni datos. No toca secretos ni costos.
-- El relleno de dirección y último contacto asume la migración
-- 20260904160000_supplier_directory_dropship_readiness.sql.

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS lineas_equipos TEXT,
  ADD COLUMN IF NOT EXISTS estado_invima TEXT,
  ADD COLUMN IF NOT EXISTS invima_titular TEXT,
  ADD COLUMN IF NOT EXISTS distribuidor_local TEXT;

ALTER TABLE proveedores
  DROP CONSTRAINT IF EXISTS proveedores_estado_invima_check;
ALTER TABLE proveedores
  ADD CONSTRAINT proveedores_estado_invima_check
  CHECK (
    estado_invima IS NULL
    OR estado_invima IN (
      'titular_marca',
      'titular_tercero',
      'titular_otro_distribuidor',
      'en_modificacion',
      'sin_iniciar'
    )
  );

COMMENT ON COLUMN proveedores.pais IS
  'País o países de origen en texto. Varios países se guardan separados por " / " para no romper lecturas existentes.';
COMMENT ON COLUMN proveedores.lineas_equipos IS
  'Líneas de equipo que ofrece el proveedor, en texto libre.';
COMMENT ON COLUMN proveedores.estado_invima IS
  'Estado normalizado del registro INVIMA: titular_marca, titular_tercero, titular_otro_distribuidor, en_modificacion, sin_iniciar.';
COMMENT ON COLUMN proveedores.invima_titular IS
  'Titular del registro cuando no es la marca.';
COMMENT ON COLUMN proveedores.distribuidor_local IS
  'Distribuidor local conocido, en texto. No es una clave foránea.';

CREATE TABLE IF NOT EXISTS proveedor_interacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT NOT NULL DEFAULT 'nota'
    CHECK (tipo IN ('nota', 'reunion', 'llamada', 'email', 'whatsapp', 'seguimiento', 'importacion')),
  resumen TEXT NOT NULL,
  proximo_paso TEXT,
  responsable TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedor_interacciones_proveedor
  ON proveedor_interacciones (proveedor_id, fecha DESC);

ALTER TABLE proveedor_interacciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proveedor_interacciones_admin_all ON proveedor_interacciones;
CREATE POLICY proveedor_interacciones_admin_all ON proveedor_interacciones
  FOR ALL TO authenticated
  USING (is_admin(ARRAY['catalogo', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'operaciones']));

-- Fusiona un duplicado en el proveedor que se conserva.
-- Mueve productos, contactos y seguimiento. No devuelve secretos.
CREATE OR REPLACE FUNCTION public.merge_proveedores(keeper_id UUID, duplicate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(ARRAY['catalogo', 'operaciones']) THEN
    RAISE EXCEPTION 'No autorizado para fusionar proveedores';
  END IF;
  IF keeper_id IS NULL OR duplicate_id IS NULL THEN
    RAISE EXCEPTION 'Faltan los identificadores del proveedor';
  END IF;
  IF keeper_id = duplicate_id THEN
    RAISE EXCEPTION 'El proveedor a conservar y el duplicado son el mismo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM proveedores WHERE id = keeper_id) THEN
    RAISE EXCEPTION 'No existe el proveedor que se quiere conservar';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM proveedores WHERE id = duplicate_id) THEN
    RAISE EXCEPTION 'No existe el proveedor duplicado';
  END IF;

  IF to_regclass('public.proveedor_producto') IS NOT NULL THEN
    DELETE FROM proveedor_producto AS duplicated
    USING proveedor_producto AS kept
    WHERE duplicated.proveedor_id = duplicate_id
      AND kept.proveedor_id = keeper_id
      AND kept.producto_id = duplicated.producto_id;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'proveedor_producto'
        AND column_name = 'sku_proveedor'
    ) THEN
      DELETE FROM proveedor_producto AS duplicated
      USING proveedor_producto AS kept
      WHERE duplicated.proveedor_id = duplicate_id
        AND kept.proveedor_id = keeper_id
        AND duplicated.sku_proveedor IS NOT NULL
        AND kept.sku_proveedor IS NOT NULL
        AND lower(duplicated.sku_proveedor) = lower(kept.sku_proveedor);
    END IF;

    UPDATE proveedor_producto
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  IF to_regclass('public.proveedor_contactos') IS NOT NULL THEN
    UPDATE proveedor_contactos AS duplicated
      SET es_principal = false
      WHERE duplicated.proveedor_id = duplicate_id
        AND duplicated.es_principal
        AND EXISTS (
          SELECT 1
          FROM proveedor_contactos AS kept
          WHERE kept.proveedor_id = keeper_id
            AND kept.tipo = duplicated.tipo
            AND kept.es_principal
        );

    DELETE FROM proveedor_contactos AS duplicated
    USING proveedor_contactos AS kept
    WHERE duplicated.proveedor_id = duplicate_id
      AND kept.proveedor_id = keeper_id
      AND duplicated.email IS NOT NULL
      AND lower(duplicated.email) = lower(kept.email);

    UPDATE proveedor_contactos
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  IF to_regclass('public.proveedor_fuentes') IS NOT NULL THEN
    DELETE FROM proveedor_fuentes AS duplicated
    USING proveedor_fuentes AS kept
    WHERE duplicated.proveedor_id = duplicate_id
      AND kept.proveedor_id = keeper_id
      AND kept.tipo = duplicated.tipo
      AND coalesce(kept.url, '') = coalesce(duplicated.url, '')
      AND coalesce(kept.referencia_local, '') = coalesce(duplicated.referencia_local, '');

    UPDATE proveedor_fuentes
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  IF to_regclass('public.proveedor_documentos') IS NOT NULL THEN
    UPDATE proveedor_documentos
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  IF to_regclass('public.proveedor_canales_pedido') IS NOT NULL THEN
    DELETE FROM proveedor_canales_pedido AS duplicated
    USING proveedor_canales_pedido AS kept
    WHERE duplicated.proveedor_id = duplicate_id
      AND kept.proveedor_id = keeper_id
      AND kept.tipo = duplicated.tipo
      AND kept.etiqueta = duplicated.etiqueta;

    UPDATE proveedor_canales_pedido
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  IF to_regclass('public.proveedor_interacciones') IS NOT NULL THEN
    UPDATE proveedor_interacciones
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  IF to_regclass('public.fulfillments') IS NOT NULL THEN
    UPDATE fulfillments
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  IF to_regclass('public.fulfillment_snapshots') IS NOT NULL THEN
    UPDATE fulfillment_snapshots
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  IF to_regclass('public.notification_log') IS NOT NULL THEN
    UPDATE notification_log
      SET proveedor_id = keeper_id
      WHERE proveedor_id = duplicate_id;
  END IF;

  UPDATE proveedores AS keeper
  SET
    razon_social = COALESCE(NULLIF(keeper.razon_social, ''), duplicated.razon_social),
    pais = COALESCE(NULLIF(keeper.pais, ''), duplicated.pais),
    ciudad = COALESCE(NULLIF(keeper.ciudad, ''), duplicated.ciudad),
    direccion_comercial = COALESCE(NULLIF(keeper.direccion_comercial, ''), duplicated.direccion_comercial),
    sitio_web = COALESCE(NULLIF(keeper.sitio_web, ''), duplicated.sitio_web),
    contacto_email = COALESCE(NULLIF(keeper.contacto_email, ''), duplicated.contacto_email),
    contacto_whatsapp = COALESCE(NULLIF(keeper.contacto_whatsapp, ''), duplicated.contacto_whatsapp),
    notas = CASE
      WHEN keeper.notas IS NULL OR btrim(keeper.notas) = '' THEN duplicated.notas
      WHEN duplicated.notas IS NULL OR btrim(duplicated.notas) = '' THEN keeper.notas
      WHEN position(duplicated.notas in keeper.notas) > 0 THEN keeper.notas
      ELSE keeper.notas || E'\n\n' || duplicated.notas
    END,
    lineas_equipos = COALESCE(NULLIF(keeper.lineas_equipos, ''), duplicated.lineas_equipos),
    estado_invima = COALESCE(keeper.estado_invima, duplicated.estado_invima),
    invima_titular = COALESCE(NULLIF(keeper.invima_titular, ''), duplicated.invima_titular),
    distribuidor_local = COALESCE(NULLIF(keeper.distribuidor_local, ''), duplicated.distribuidor_local),
    ultimo_contacto_at = GREATEST(keeper.ultimo_contacto_at, duplicated.ultimo_contacto_at)
  FROM proveedores AS duplicated
  WHERE keeper.id = keeper_id
    AND duplicated.id = duplicate_id;

  DELETE FROM proveedores WHERE id = duplicate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_proveedores(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_proveedores(UUID, UUID) TO authenticated, service_role;
