# SEO de fichas de producto (PDP) — guía para desarrolladores

Cambios frecuentes en títulos, metas, JSON-LD y bloques «productos relacionados». Verificar
siempre contra código; no inventar precios ni claims clínicos.

## Archivos clave

| Área | Ubicación |
| ---- | --------- |
| Metas globales, JSON-LD Product, truncado de description | `src/lib/seo.ts` |
| Overrides por slug (GSC / CTR) | `src/data/producto-seo-copy.ts` |
| Relacionados accesorio ↔ equipo | `src/lib/relacion-accesorios.ts` |
| Páginas PDP ES/EN | `src/pages/es/productos/[slug].astro`, `src/pages/en/products/[slug].astro` |
| Copy campañas con modelos retirados | migración `supabase/migrations/20261022103000_seo_landings_productos_retirados.sql` |
| Indexabilidad sitemap | `scripts/sitemap-indexability.mjs` |

Tests: `src/lib/seo.test.ts`, `src/lib/seo-p0.test.ts`, `src/lib/relacion-accesorios.test.ts`,
`src/data/gsc-20261018.test.ts`.

## Meta description sin cortes a mitad de palabra

`truncateMetaDescription()` (≤155 caracteres por defecto) recorta en el último espacio antes
del límite y elimina puntuación final colgante. Evita snippets tipo «movilidad co.» o
«Konfort Plu.» en SERP.

Al añadir copy en `producto-seo-copy.ts`, comprobar longitud; las PDP usan el helper vía
`buildProductoSeo`.

## Overrides GSC (`producto-seo-copy.ts`)

Mapa `slug → { es, en }` con `title`, `description`, `h1`, `intro`. Solo slugs con evidencia
(GSC, CTR bajo). **No** cambia nombre de catálogo, precio ni ficha PDF.

Flujo:

1. Añadir entrada con copy aprobado (sin datos inventados).
2. `npm test -- --run src/lib/seo.test.ts src/data/gsc-20261018.test.ts`
3. Rebuild y, si aplica, solicitar reindexación en GSC para URLs concretas.

## JSON-LD `Product`

`buildProductJsonLd()` en `src/lib/seo.ts`:

- Devuelve **`null`** si el producto **no tiene precio público** (`tienePrecioPublico`). Un
  `Product` sin `offers` válido genera avisos en Search Console («elemento no válido»).
- Con precio: `Offer` con `price`, `priceCurrency`, `priceValidUntil` (+1 año), `availability`
  según `disponible`, `seller` → Organization.
- `MedicalDevice` solo si hay certificaciones en specs que coinciden con INVIMA/CE/FDA/ISO.
- Marca real vía parámetro `marca`; MPN/SKU cuando existen.

Las PDP deben comprobar que el script JSON-LD se omite o incluye según precio del registro.

## Productos relacionados (`relacion-accesorios.ts`)

`seleccionarRelacionados(producto, mismaFamilia, todos, limite=8)`:

1. Hasta **6** referencias por **prefijo de SKU** (`REF_CAP`): pieza → equipo padre;
   equipo → accesorios hijos; piezas huérfanas → mismo «tallo» de SKU.
2. `esPieza()` marca consumibles o nombres/slugs con tokens de repuesto (filtro, kit, etc.).
3. **No** enlaza a un padre inventado si su SKU no está en catálogo.
4. Rellena con otros productos de la misma familia hasta `limite` (8 en PDP).

Regresiones: `src/lib/relacion-accesorios.test.ts`.

## Landings comerciales vs catálogo retirado

Productos dados de baja pueden seguir mencionados en landings CMS. La migración
`20261022103000_seo_landings_productos_retirados.sql` sustituye copy que citaba modelos
410 (torres SonoScape, Biolight P15/P12, etc.) por redacción alineada al **catálogo activo**.

Aplicar en Supabase antes del rebuild que publica esas landings. No sustituye revisión editorial
de nuevas campañas.

## Servicios (calibración)

Copy institucional en `/es/servicios/` y `/en/services/` indica calibración incluida en la
instalación cuando corresponde al mensaje comercial acordado (`src/lib/seo.ts` + páginas
servicios). Mantener paridad ES/EN.

## Comandos útiles

```bash
npm test -- --run src/lib/seo.test.ts src/lib/relacion-accesorios.test.ts
npm run validate:seo    # si el entorno tiene build reciente
npm run validate        # lint + check + build completo
```

Backlog operativo GSC: `docs/seo/backlog.md`. Auditoría histórica: `docs/SEO_CRAWL_AUDIT.md`.
