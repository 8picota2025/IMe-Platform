# Catálogo — etiquetas de disponibilidad pública

Fuente de verdad: `src/lib/disponibilidad-producto.ts`.

## Intención

«Disponible» solo aparece cuando hay **stock documentado** (`stock > 0`). Sin stock en ficha (`null` / `undefined` / `0`) no se afirma disponibilidad implícita: evita PDP y tarjetas que prometen stock inexistente (caso UniX, nov-2026).

## Niveles

| Nivel | Condición | ES (ficha) | ES (tarjeta corta) |
| ----- | --------- | ---------- | ------------------- |
| `no_disponible` | `disponible === false` o `stock === 0` | `producto.ficha_no_disponible` | igual |
| `stock_documentado` | `stock > 0` | `stockLimitado(n)` vía i18n | igual |
| `bajo_cotizacion` | sin stock y (sin precio público o `fulfillment_mode` ∈ `cotizacion` \| `individualizado`) | `producto.ficha_bajo_cotizacion` | `producto.ficha_bajo_cotizacion_corto` |
| `consultar` | sin stock, con precio y otro modo | `producto.cta_consultar_disponibilidad` | `producto.ficha_consultar_corto` |

Claves i18n en `src/i18n/es.json` y `en.json`.

## Consumidores

- `ProductoLanding.astro` — hero y bloque de disponibilidad (`etiquetaDisponibilidad`).
- `ProductoCard.astro` — etiqueta «Disponibilidad» + valor corto (`valorCortoDisponibilidad`).
- `src/lib/catalogo-cliente.ts` — quickview del catálogo (misma regla).

No duplicar la matriz en componentes: importar desde la lib.

## Tests y CI

- Unit: `src/lib/disponibilidad-producto.test.ts`.
- Build SEO (fichas UniX): `scripts/validate-seo.mjs` → `checkFichasUnix()` con `npm run audit:seo-build`.

## Relacionado

- Posicionamiento SEO UniX (nov-2026): `docs/pr-unix-seo-2026-11-09.md`.
- Zuowei sin venta (otra regla de negocio): `docs/catalogo-zuowei-y-robotica.md`.