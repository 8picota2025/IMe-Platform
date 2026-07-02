# Taxonomía: autoasignar tipos, eliminar familia/tipo, y obligatoriedad familia+tipo

## Contexto

El panel admin (`src/admin/admin-app.ts`, vista `taxonomiaView`) ya permite:

- Crear familias y tipos (solo alta, sin baja).
- Reasignar manualmente, uno por uno, los productos sin `tipo_id` ("Productos sin tipo asignado").

Faltan tres cosas pedidas por el cliente:

1. Un fix masivo (y repetible) para productos sin tipo.
2. Poder eliminar familias y tipos existentes.
3. Que familia y tipo sean obligatorios al guardar un producto desde la edición general.

Todo se implementa en `src/admin/admin-app.ts` reusando los patrones ya existentes
(`supabase!.from(tabla).insert/update/delete`, `confirm()` antes de borrar, `toast()`
para feedback, `render()` para refrescar la vista tras una mutación). No se requiere
tocar `supabase/schema.sql` — las columnas y FKs necesarias ya existen:

- `tipos.familia_id` → `familias.id` (`NOT NULL`, `ON DELETE CASCADE`)
- `productos.familia_id` → `familias.id` (nullable, `ON DELETE SET NULL`)
- `productos.tipo_id` → `tipos.id` (nullable, `ON DELETE SET NULL`)

Todas las mutaciones descritas aquí corren client-side con el cliente Supabase ya
autenticado como admin (mismo patrón que "Crear familia"/"Crear tipo"/"Reasignar" hoy).
No se crea ninguna Edge Function nueva.

## 1. Autoasignar tipos por familia

**Regla de negocio:** para cada producto con `tipo_id = null` y `familia_id` no nulo,
se le asigna el tipo de su misma familia cuyo `nombre_es` sea idéntico al `nombre_es`
de la familia. Si esa familia no tiene todavía un tipo con ese nombre, se crea
(`slug` = slug de la familia, `nombre_es`/`nombre_en` copiados de la familia,
`activo = true`, `orden = 0`).

**UI:** botón "Autoasignar tipos faltantes" en la cabecera de la sección
"Productos sin tipo asignado" de `taxonomiaView`.

**Flujo (`autoasignarTiposPorFamilia()`):**

1. `SELECT id, familia_id FROM productos WHERE tipo_id IS NULL AND familia_id IS NOT NULL`.
2. Si no hay filas → toast "No hay productos pendientes." y salir.
3. Agrupar ids de producto por `familia_id`.
4. Para cada `familia_id` del grupo:
   - Buscar en la lista de `tipos` ya cargada (`taxonomiaView` ya trae todos los tipos)
     uno con `familia_id` igual y `nombre_es === familia.nombre_es` (comparación exacta,
     sin trim/normalización — si no calza por espacios/acentos se crea uno nuevo,
     comportamiento aceptado).
   - Si no existe, `INSERT INTO tipos` con los datos de la familia y usar el id devuelto.
5. Una vez resuelto un `tipo_id` por familia, `UPDATE productos SET tipo_id = ... WHERE id IN (...)`
   (un update por familia agrupado, no uno por producto).
6. Toast final: `"${productosActualizados} productos actualizados, ${tiposCreados} tipos creados."`
7. `await render()` para refrescar contadores y la lista de pendientes.

**Errores:** si cualquier insert/update falla, se corta el loop, se muestra
`toast(error.message)` y se hace `render()` igualmente (para reflejar el progreso parcial
ya aplicado — no hay transacción, es aceptable dado que cada paso es idempotente y se
puede volver a pulsar el botón).

**Idempotencia:** correr el botón dos veces seguidas la segunda vez no hace nada
("No hay productos pendientes."), porque ya no quedan productos con `tipo_id null`
que tengan familia.

## 2. Eliminar familia / Eliminar tipo

**UI:** columna "Acciones" nueva en ambas tablas de `taxonomiaView` (Familias, Tipos)
con un botón `<button class="admin-button admin-button--danger" data-delete-familia="{id}">Eliminar</button>`
(y el equivalente `data-delete-tipo` para tipos).

**Regla:** bloquear el borrado si hay registros dependientes — no hay borrado en cascada
desde el admin, aunque la FK de `tipos.familia_id` sí sea `ON DELETE CASCADE` a nivel de
DB (el admin nunca debe disparar esa cascada sin que el usuario lo sepa explícitamente).

**Flujo eliminar familia:**

1. `count` de `tipos WHERE familia_id = id` + `count` de `productos WHERE familia_id = id`.
2. Si `tipos > 0 || productos > 0` → `toast(`No se puede eliminar: tiene ${tipos} tipos y ${productos} productos asociados. Reasigna primero.`)`, no se hace ninguna llamada de borrado.
3. Si ambos son 0 → `confirm('Eliminar familia?')` → `DELETE FROM familias WHERE id = id` → toast + `render()`.

**Flujo eliminar tipo:** igual pero solo cuenta `productos WHERE tipo_id = id`
(los tipos no tienen hijos propios).

## 3. Nueva sección "Productos sin familia"

Espejo exacto de la sección ya existente "Productos sin tipo asignado":

- Se calcula junto a `productosSinTipo` en `taxonomiaView`, filtrando
  `productos` con `familia_id` vacío (independientemente de si además falta `tipo_id`).
- Reusa el mismo componente de formulario (`data-reasignar-form`, mismo
  `bindReasignacion()` ya existente — no hace falta un handler nuevo) porque ese
  formulario ya actualiza `familia_id` y `tipo_id` juntos.
- Encabezado: `"Productos sin familia (${productosSinFamilia.length})"`, mismo
  mensaje vacío ("Todos los productos tienen familia asignada.") cuando no hay ninguno.
- Un producto que aparece aquí (sin familia) probablemente también aparecerá en
  "sin tipo asignado" — es aceptable que un producto aparezca en ambas listas a la vez;
  reasignarlo en cualquiera de las dos actualiza ambos campos y desaparece de las dos
  tras el `render()`.

## 4. Familia y tipo obligatorios al guardar un producto (con excepción de ingesta)

**Alcance:** aplica a los dos caminos de guardado de producto que ya existen:

- `bindProductForm()` → submit del formulario principal (`data-product-form`), tanto
  creación como edición.
- `bindProductList()` → guardado inline por fila (`data-product-row-save` →
  `productInlinePayload`).

**No aplica** al flujo de ingesta PDF (`ADMIN_GUIDE.md` ya documenta que ese flujo
permite dejar "Sin asignar" en el borrador inicial, activo=false, para revisión
posterior vía los paneles de "sin tipo"/"sin familia" que arreglamos en el punto 3).
Ese código de ingesta no se toca.

**Cambio:** justo antes de la llamada a `supabase!.from('productos').insert/update(...)`
en ambos handlers, si `payload['familia_id']` o `payload['tipo_id']` son `null`/vacíos:
`toast('Familia y tipo son obligatorios para guardar el producto.')` y `return`
sin llamar a Supabase.

**UI complementaria:** se deja el option "Sin asignar" visible en el select de
`tipo_id` del formulario principal (no se retira) para que un producto ya existente
sin tipo se muestre honestamente como "Sin asignar" en vez de defaultear en silencio
al primer tipo de la lista — la validación de guardado es la que realmente bloquea,
no el HTML del select.

## Fuera de alcance

- No se toca el importador Excel (`data-products-import-form`, que ya tiene su propio
  checkbox "Crear familia/tipo faltante").
- No se toca el flujo de ingesta PDF.
- No hay migración SQL: todo son mutaciones de datos vía el propio panel admin,
  ejecutadas por el usuario cuando tenga credenciales válidas (el intento de login
  de esta sesión con `8picota2025@gmail.com` fue rechazado por Supabase Auth —
  "Invalid login credentials" — así que este spec no pudo probarse contra datos reales).

## Testing

Sin entorno de Supabase de test disponible en esta sesión, no hay tests automatizados
posibles contra datos reales. El plan de implementación debe incluir verificación
manual paso a paso (autoasignar, eliminar con/sin dependientes, guardar producto sin
familia/tipo) una vez el usuario tenga acceso al admin real, más una revisión de
`npm run validate` (typecheck/lint, requerido antes de commitear según `CLAUDE.md`
del repo).
