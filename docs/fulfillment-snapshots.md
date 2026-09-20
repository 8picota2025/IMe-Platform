# Fulfillment snapshots — timeline append-only

Registro operativo de **cambios de estado de fulfillment** tal como los reporta el proveedor (API, portal, email parseado, EDI, webhook). Complementa la fila mutable `fulfillments` con una línea de tiempo auditable.

Migración: `supabase/migrations/20260904160000_supplier_directory_dropship_readiness.sql`.

## Intención

| Tabla               | Rol                                                                 |
| ------------------- | ------------------------------------------------------------------- |
| `fulfillments`      | Estado actual del envío (mutable, una fila por pedido+producto)     |
| `fulfillment_snapshots` | Historial append-only de observaciones externas (timeline)      |

La fila en `fulfillments` refleja el **último estado operativo**. Cada snapshot captura **qué reportó el proveedor y cuándo**, sin sobrescribir entradas anteriores.

## Esquema

```sql
fulfillment_snapshots (
  id UUID PK,
  fulfillment_id UUID NOT NULL → fulfillments(id) ON DELETE CASCADE,
  proveedor_id UUID → proveedores(id),
  origen TEXT NOT NULL,          -- manual | email | portal | api | edi | webhook
  external_event_id TEXT,        -- idempotencia por evento externo
  estado TEXT NOT NULL,          -- pendiente | notificado | preparando | enviado | entregado | cancelado | error
  tracking_number TEXT,
  tracking_url TEXT,
  payload JSONB NOT NULL DEFAULT '{}',  -- snapshot operativo redactado
  observado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

Índice único parcial: `(fulfillment_id, origen, external_event_id)` cuando `external_event_id IS NOT NULL` — evita duplicar el mismo evento del proveedor.

Timeline: `idx_fulfillment_snapshots_timeline (fulfillment_id, observado_at DESC)`.

## Qué va en `payload`

Solo datos operativos redactados: estado reportado, referencia de guía, notas del proveedor, campos normalizados del webhook.

**No** incluir:

- Dirección completa del cliente
- Datos de pago o tokens
- Cuerpo crudo del webhook sin redactar

El comentario en la migración lo deja explícito; cumplirlo en cualquier writer futuro.

## RLS

Solo roles internos `operaciones` (vía `is_admin(ARRAY['operaciones'])`). Proveedores **no** leen esta tabla directamente; usan `actualizar-fulfillment` (ver `supabase/functions/actualizar-fulfillment/README.md`).

## Estado del código (2026-09-20)

- Tabla e índices: **aplicados** en migración.
- Writers automáticos: **pendientes** — `actualizar-fulfillment` hoy actualiza `fulfillments` pero aún no inserta snapshots.
- Admin UI: **pendiente** — timeline visible solo vía SQL por ahora.

Al implementar el writer, el flujo recomendado es:

1. Validar token / permisos del proveedor (igual que hoy).
2. `INSERT INTO fulfillment_snapshots (...)` con `external_event_id` cuando el origen lo provea.
3. Si el insert gana (no conflicto UNIQUE), actualizar `fulfillments` al nuevo estado.
4. Si conflicto UNIQUE → 200 idempotente, sin tocar `fulfillments`.

## Consultas útiles

Timeline de un fulfillment:

```sql
SELECT observado_at, origen, estado, tracking_number, tracking_url, payload
FROM fulfillment_snapshots
WHERE fulfillment_id = '<uuid>'
ORDER BY observado_at DESC;
```

Último reporte por proveedor:

```sql
SELECT DISTINCT ON (fulfillment_id)
  fulfillment_id, proveedor_id, estado, observado_at
FROM fulfillment_snapshots
WHERE proveedor_id = '<uuid>'
ORDER BY fulfillment_id, observado_at DESC;
```

Detectar eventos duplicados rechazados (conflictos UNIQUE en logs de la app).

## Relación con otras piezas

- **Notificación inicial dropship:** `notificar-proveedor` crea/actualiza `fulfillments` a `notificado`; el primer snapshot debería registrarse cuando el proveedor confirme recepción (`confirmar-notificacion-proveedor`).
- **API proveedor:** `actualizar-fulfillment` — candidato natural para escribir snapshots con `origen = 'api'`.
- **Directorio proveedores:** ver `PROVIDER_INTEGRATION_GUIDE.md` para el contrato externo.

## Troubleshooting

| Síntoma                         | Acción                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| Timeline vacía tras API update  | Esperado hasta implementar writer; revisar `fulfillments.updated_at` |
| Dos snapshots mismo evento      | Verificar que `external_event_id` se envía y es estable          |
| Snapshot con PII                | Redactar `payload`; no exponer en exports                        |
