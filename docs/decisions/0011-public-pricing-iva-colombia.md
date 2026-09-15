# ADR-0011: Precio público con IVA en storefront vs base neta en checkout

- Fecha: 2026-09-06
- Estado: aceptado
- Alcance: catálogo, landings, carrito, checkout Colombia

## Contexto

Los precios en `productos.precio_regular` (y ofertas en `precio_oferta`) se
almacenan como **base neta en COP**, sin IVA incluido. Hasta 2026-08 el storefront
mostraba valores inconsistentes respecto al total cobrado. Los commits
`ae014b8`, `94272f7` y `721c5e6` unificaron la capa de presentación.

## Decisión

### 1. Fuente de verdad en base de datos

- `precio_regular`: precio neto de lista (sin IVA).
- `precio_oferta` + ventana `oferta_inicio` / `oferta_fin`: neto promocional vigente.
- No duplicar precios con/sin IVA en columnas paralelas.

### 2. Capa de presentación (storefront)

`src/lib/format.ts`:

- `IVA_COLOMBIA_PCT = 19` (tasa confirmada para precios públicos CO).
- `resolvePrecioPublico(row)` devuelve el neto vigente más IVA, redondeado a pesos
  enteros.
- Prioridad: oferta vigente → `precio_regular` → null si no hay precio > 0.

Usado en `src/lib/datos.ts` al mapear productos para UI, JSON-LD (solo si hay precio
público válido) y componentes (`ProductoCard`, `Carrito`, etc.).

### 3. Checkout server-side

`supabase/functions/crear-pago`:

- Toma el neto con `precioVigente()` (misma lógica de oferta que el cliente).
- Aplica listas de precio / cupones sobre la base neta.
- Calcula IVA fiscal con `CO_DEFAULT_IVA_PCT` (default 19) vía módulo fiscal compartido.
- Cotizaciones formalizadas (`lineasCotizacion`): `default_iva_pct = 0` porque el
  tratamiento fiscal ya quedó locked al emitir la cotización.

El total mostrado al cliente en UI (con IVA) debe coincidir con el total calculado
en checkout para carrito directo, salvo descuentos de lista aplicados server-side.

### 4. Restricciones

- No inventar precios: `resolvePrecioPublico` devuelve `null` si no hay base > 0.
- `precio_costo` en `proveedor_producto` nunca participa en precio público.
- Product JSON-LD solo incluye `offers` cuando existe precio público resoluble.

## Consecuencias

- Editores deben cargar **neto** en admin; el sitio mostrará neto + 19 % automáticamente.
- Tests unitarios: `src/lib/format.test.ts`.
- Cambiar la tasa exige actualizar `IVA_COLOMBIA_PCT` y revisar env `CO_DEFAULT_IVA_PCT`.

## Referencias

- `src/lib/format.ts` — `resolvePrecioPublico`, `precioConIvaColombia`
- `supabase/functions/crear-pago/index.ts` — `precioVigente`, cálculo fiscal
- `docs/decisions/0009-commerce-disponibilidad-comparador-precios.md` — jerarquía de señales de venta
