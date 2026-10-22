-- Evita que merge_proveedores borre credenciales / routing de dropship
-- al conservar un prospecto de investigación sobre el registro operativo.

CREATE OR REPLACE FUNCTION public.merge_proveedores(keeper_id UUID, duplicate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keeper_dropship BOOLEAN;
  keeper_nombre TEXT;
  dup_dropship BOOLEAN;
  dup_nombre TEXT;
  dup_operational BOOLEAN;
  dup_token TEXT;
  keeper_token TEXT;
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

  SELECT
    COALESCE(keeper.dropship_enabled, false),
    keeper.nombre,
    COALESCE(duplicated.dropship_enabled, false),
    duplicated.nombre,
    (
      COALESCE(duplicated.dropship_enabled, false)
      OR NULLIF(btrim(COALESCE(duplicated.webhook_url, '')), '') IS NOT NULL
      OR duplicated.api_token IS NOT NULL
      OR duplicated.api_config IS NOT NULL
    ),
    duplicated.api_token,
    keeper.api_token
  INTO
    keeper_dropship,
    keeper_nombre,
    dup_dropship,
    dup_nombre,
    dup_operational,
    dup_token,
    keeper_token
  FROM proveedores AS keeper
  CROSS JOIN proveedores AS duplicated
  WHERE keeper.id = keeper_id
    AND duplicated.id = duplicate_id;

  -- Conservar el registro operativo: fusionar un dropship/credenciales
  -- hacia un prospecto sin dropship destruiría webhook/api_token y el routing.
  IF dup_operational AND NOT keeper_dropship THEN
    RAISE EXCEPTION
      'No se puede fusionar el proveedor operativo "%" en "%". Conserva el registro con dropshipping o credenciales de fulfillment y elimina el duplicado de investigación.',
      dup_nombre,
      keeper_nombre;
  END IF;

  -- api_token es UNIQUE: moverlo antes del UPDATE/DELETE para no chocar.
  IF keeper_token IS NULL AND dup_token IS NOT NULL THEN
    UPDATE proveedores SET api_token = NULL WHERE id = duplicate_id;
    UPDATE proveedores SET api_token = dup_token WHERE id = keeper_id;
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
    contacto_email = CASE
      WHEN keeper.dropship_enabled
        AND NULLIF(btrim(COALESCE(keeper.contacto_email, '')), '') IS NOT NULL
        THEN keeper.contacto_email
      ELSE COALESCE(NULLIF(btrim(COALESCE(keeper.contacto_email, '')), ''), duplicated.contacto_email)
    END,
    contacto_whatsapp = CASE
      WHEN keeper.dropship_enabled
        AND NULLIF(btrim(COALESCE(keeper.contacto_whatsapp, '')), '') IS NOT NULL
        THEN keeper.contacto_whatsapp
      ELSE COALESCE(NULLIF(btrim(COALESCE(keeper.contacto_whatsapp, '')), ''), duplicated.contacto_whatsapp)
    END,
    canal = CASE
      WHEN keeper.dropship_enabled THEN keeper.canal
      ELSE COALESCE(NULLIF(btrim(COALESCE(keeper.canal, '')), ''), duplicated.canal)
    END,
    webhook_url = COALESCE(NULLIF(btrim(COALESCE(keeper.webhook_url, '')), ''), duplicated.webhook_url),
    api_config = COALESCE(keeper.api_config, duplicated.api_config),
    dropship_enabled = keeper.dropship_enabled OR duplicated.dropship_enabled,
    lifecycle_status = CASE
      WHEN keeper.dropship_enabled OR duplicated.dropship_enabled THEN 'aprobado'
      WHEN keeper.lifecycle_status IS NOT NULL THEN keeper.lifecycle_status
      ELSE duplicated.lifecycle_status
    END,
    activo = keeper.activo OR duplicated.activo,
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

COMMENT ON FUNCTION public.merge_proveedores(UUID, UUID) IS
  'Fusiona un duplicado en el keeper. Bloquea borrar el registro dropship/credenciales al conservar un prospecto; mueve api_token/webhook sin perder routing.';
