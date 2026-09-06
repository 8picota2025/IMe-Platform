# Directorio de proveedores — arquitectura y operación

Runbook interno para el directorio verificable de fabricantes/proveedores y la
preparación operativa de dropshipping. Complementa la integración externa descrita
en `PROVIDER_INTEGRATION_GUIDE.md` (webhooks/API hacia proveedores aprobados).

## Intención

- Centralizar datos operativos de proveedores **sin** credenciales, costos ni datos
  de clientes en el admin.
- Separar **investigación** (prospectos con fuentes públicas) de **autorización
  comercial** (dropship habilitado).
- Vincular catálogo ↔ fabricante como referencia trazable, no como acuerdo de
  suministro.

Un registro en el directorio **no** autoriza compra, envío ni publicación de
precio de costo hasta completar validación y aprobación operativa.

## Superficie admin

| Ruta hash | Vista | Rol mínimo |
| --- | --- | --- |
| `#/proveedores` | Listado, filtros, alta, import/export Excel | `operaciones` (+ owner/admin) |
| `#/proveedor?id=<uuid>` | Ficha editable + contactos, fuentes, canales, documentos | `operaciones` |
| `#/proveedor-productos?id=<uuid>` | Asignaciones producto–proveedor | `operaciones` |

Menú lateral: **Proveedores** (Operaciones). No confundir con **Transportistas**
(`#/fulfillments`), que gestiona tracking de fulfillments ya creados.

Código: `src/admin/admin-app.ts` (`proveedoresView`, `proveedorDetailView`,
`proveedorProductosView`).

## Modelo de datos

Migraciones de referencia:

- `20260904160000_supplier_directory_dropship_readiness.sql` — tablas y columnas base
- `20260905100000_expand_supplier_contact_roles.sql` — roles de contacto ampliados
- `20260905110000_seed_catalog_supplier_associations.sql` — asociaciones catálogo–marca

### Tabla `proveedores` (campos nuevos relevantes)

| Campo | Uso |
| --- | --- |
| `tipo_entidad` | `fabricante` \| `distribuidor` \| `proveedor` \| `logistica` |
| `lifecycle_status` | Pipeline de validación (ver abajo) |
| `dropship_enabled` | Solo `true` si `lifecycle_status = 'aprobado'` (CHECK en BD) |
| `cobertura_envios`, `incoterms`, `almacenes` | Cobertura operativa |
| `sla_respuesta_horas`, `sla_despacho_dias_habiles` | SLAs internos |
| `stock_feed_tipo` | `ninguno` \| `manual` \| `archivo` \| `portal` \| `api` \| `edi` |
| `riesgo_operativo` | `bajo` \| `medio` \| `alto` |

Campos legados (`contacto_email`, `contacto_whatsapp`, `canal`) siguen en la ficha;
los contactos normalizados viven en `proveedor_contactos`.

### Tablas satélite

| Tabla | Contenido | Restricción RLS |
| --- | --- | --- |
| `proveedor_contactos` | Personas por rol (comercial, pedidos, logística, …) | `catalogo`, `operaciones` |
| `proveedor_fuentes` | Trazabilidad (sitio oficial, investigación local, …) | `catalogo`, `operaciones` |
| `proveedor_documentos` | Metadatos de documentos (registro, fiscal, calidad, …) | `catalogo`, `operaciones` |
| `proveedor_canales_pedido` | Destinos públicos de pedido (email, WhatsApp, portal, EDI) | solo `operaciones` |
| `fulfillment_snapshots` | Timeline append-only de actualizaciones de fulfillment | solo `operaciones` |

`proveedor_canales_pedido` guarda **destinos públicos e instrucciones**; tokens,
webhooks secretos y contraseñas permanecen en infraestructura de servidor.

### `proveedor_producto` (operación por SKU)

Además de `precio_costo` (CONFIDENCIAL) y `prioridad`:

| Campo | Valores / notas |
| --- | --- |
| `sku_proveedor` | SKU del proveedor |
| `disponibilidad` | `en_stock`, `bajo_pedido`, `agotado`, `descontinuado`, `desconocida` |
| `lead_time_dias_habiles`, `pais_origen`, `pais_despacho`, `incoterm` | Logística |
| `apto_dropship` | Flag operativo por asignación |
| `association_status` | `pendiente` \| `verificado` \| `rechazado` (referencias catálogo–marca) |
| `association_source`, `association_notes` | Origen de la asociación automática |

Las filas sembradas por marca de catálogo tienen `precio_costo = NULL`, `activo =
false` y `association_status = 'pendiente'`. **NULL ≠ cero**: no inventar costos.

## Pipeline de validación (`lifecycle_status`)

```
prospect → contactado → calificado → onboarding → aprobado
                                              ↘ suspendido / rechazado
```

| Estado | Significado operativo |
| --- | --- |
| `prospect` | Dato de investigación; inactivo por defecto |
| `contactado` | Primer contacto comercial iniciado |
| `calificado` | Capacidad y fit evaluados |
| `onboarding` | Recopilando documentos, canal y SLAs |
| `aprobado` | Único estado que permite `dropship_enabled = true` |
| `suspendido` / `rechazado` | No usar para nuevos pedidos |

Al crear desde el listado, dropshipping aparece deshabilitado en UI hasta aprobación.

## Flujo operativo recomendado

1. **Alta o importación** — slug único, tipo de entidad, datos públicos verificables.
2. **Fuentes** — registrar URL o referencia local; marcar `verification_status` tras revisión humana.
3. **Contactos por rol** — al menos comercial y logística cuando aplique; un principal por rol.
4. **Documentos** — metadatos y vencimientos (`vence_at`); archivos privados en storage interno.
5. **Canal de pedido** — activar solo tras acuerdo; operaciones configura secretos fuera del admin.
6. **Productos** — asignar SKU, disponibilidad y costo real cuando exista; verificar asociaciones automáticas.
7. **Aprobación** — pasar a `aprobado` y habilitar dropship cuando canal, SLAs y documentos estén listos.

## Import / export Excel

Desde `#/proveedores`:

- **Exportar Excel** — snapshot operativo.
- **Plantilla Excel** — upsert por `slug`.
- **Importar** — solo datos operativos públicos.

**Prohibido importar:** tokens, claves API, `precio_costo` masivo sin revisión, datos
de clientes o payloads de webhooks.

## Integración con checkout y fulfillments

- `crear-pago` consulta `get_proveedor_para_producto` para items dropship; si no hay
  proveedor asignado, el checkout **sigue** (producto con precio) y la notificación
  queda diferida — ver dashboard operaciones.
- Tras pago, `notificar-proveedor` usa el canal del proveedor aprobado.
- El proveedor responde vía `confirmar-notificacion-proveedor` y `actualizar-fulfillment`
  (ver `PROVIDER_INTEGRATION_GUIDE.md`).
- `fulfillment_snapshots` registra eventos externos sin almacenar direcciones de cliente
  ni cuerpos crudos de webhooks de pago.

## Seguridad y confidencialidad

- RLS: lectura/escritura admin autenticado por rol; nada de esto es público en `dist/`.
- `precio_costo` solo en `#/proveedor-productos` y APIs internas autorizadas.
- Seeds de investigación local (`proveedor_fuentes.referencia_local`) son trazabilidad
  interna; no exponer rutas locales en UI pública.
- Prospectos sembrados desde sitios públicos **no** implican relación comercial.

## Errores frecuentes

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| No puedo activar dropship | `lifecycle_status ≠ aprobado` | Completar onboarding y aprobar |
| CHECK violation al guardar dropship | Intentar `dropship_enabled` sin aprobación | Aprobar primero |
| Producto dropship sin notificación | Sin fila activa en `proveedor_producto` | Asignar proveedor y prioridad |
| Asociación catálogo sin costo | Seed `association_status = pendiente` | Verificar comercialmente antes de costo |
| Contacto no guarda | Falta email, teléfono o WhatsApp | Al menos un medio de contacto |

## Documentos relacionados

- `ADMIN_GUIDE.md` — resumen operativo del back-office
- `PROVIDER_INTEGRATION_GUIDE.md` — API externa para proveedores aprobados
- `DROPSHIPPING_CHECKLIST_PRODUCCION.md` — checklist pre-producción
- `supabase/functions/confirmar-notificacion-proveedor/README.md`
- `supabase/functions/actualizar-fulfillment/README.md`
