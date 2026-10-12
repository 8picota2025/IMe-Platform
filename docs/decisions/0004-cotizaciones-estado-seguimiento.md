# ADR-0004: Seguimiento de cotizaciones — `estado` y `notas_internas`

- Fecha: 2026-06-14
- Estado: aceptado
- Contexto: F4.1 — Escenario A y cierre de Comercio (Wompi v1.1)

## Contexto

`IME_F4_Commerce_Pasarelas_v1.1.md` (TAREA 1 y TAREA 8) pide ampliar la tabla
de solicitudes con `estado TEXT DEFAULT 'nueva'` y `notas_internas TEXT`, y
que el panel admin de cotizaciones permita "marcar respondida, notas
internas, filtro por estado" con valores `nueva / en revisión / respondida`.

La implementación actual de `solicitudes_cotizacion` (F3) solo tenía un flag
binario `leida BOOLEAN`, sin distinción entre "en revisión" y "respondida" ni
un campo para notas internas del equipo comercial.

## Decisión

Se añaden dos columnas a `solicitudes_cotizacion`
(`supabase/schema.sql`):

```sql
estado         TEXT NOT NULL DEFAULT 'nueva'
               CHECK (estado IN ('nueva', 'en_revision', 'respondida')),
notas_internas TEXT,
```

`leida` se mantiene sin cambios (sigue controlando el badge "sin leer" del
dashboard y el botón "Marcar leída"); `estado`/`notas_internas` son un
seguimiento comercial más granular, independiente de `leida`.

En `/admin#cotizaciones` (`src/admin/admin-app.ts`):

- La lista (`cotizacionesView`) muestra la columna `estado`.
- El detalle (`cotizacionDetailView`) añade un formulario
  (`data-cotizacion-estado-form`) con selector de `estado`
  (`COTIZACION_ESTADOS`) y textarea de `notas_internas`, que actualiza ambos
  campos vía `update()` directo (mismo patrón que `PEDIDO_ESTADOS` /
  `data-pedido-estado-form` de pedidos).

## Consecuencias

- Requiere migración SQL (`ALTER TABLE solicitudes_cotizacion ADD COLUMN IF
NOT EXISTS estado ... ADD COLUMN IF NOT EXISTS notas_internas TEXT`) sobre
  la base de datos real — pendiente de aplicar junto con la migración de
  `productos.disponible`/`disponible_actualizado_at` de F4.1 (ver
  `PENDIENTES.md`).
- Hasta aplicar la migración, `cotizacionesView`/`cotizacionDetailView`
  funcionan en modo degradado: `row.estado`/`row.notas_internas` serán
  `undefined` (el selector cae a `'nueva'` por defecto vía `|| 'nueva'`, y la
  textarea queda vacía) sin error, igual que el patrón ya usado para
  `disponible` en catálogo/carrito.

## Actualización 2026-10-11 — estado sin envío y archivo recuperable

El CHECK pasa a incluir `perdida` y `declinada`. El POST de guardado de
`comercial-cotizacion` sigue **sin** escribir `estado` (allowlist
`CAMPOS_GUARDADO_COTIZACION`): un body con `"estado"` se descarta. El cambio
de estado sin avisar al cliente es `POST ?action=cambiar-estado` (y la
herramienta MCP `cambiar_estado_cotizacion`). No llama a `enviar-cotizacion`
ni escribe `oferta_enviada_at`.

Archivo recuperable: `archived_at`, `archived_by`, `archived_reason`.
`POST ?action=archivar` / `desarchivar`. DELETE ya no borra la fila ni el PDF.
Las listas ocultan `archived_at IS NOT NULL` salvo `incluir_archivadas=1`.
Cada cambio queda en `comercio_actuaciones` (actor, momento, motivo, antes/después).
