# Catálogo — productos retirados y URLs legacy

Cómo el sitio deja de publicar un producto y qué pasa con enlaces antiguos (SEO y operación).

## Señal en base de datos

Campo `productos.activo` (boolean):

- `activo = true` — entra en consultas públicas y en el build estático.
- `activo = false` — **retirado del catálogo público**; no aparece en listados, búsqueda ni `getStaticPaths` de fichas.

La capa de datos filtra en Supabase con `.eq('activo', true)` (`src/lib/datos.ts`). `getProductoBySlug` devuelve `null` para slugs inactivos (ver `src/lib/datos.test.ts`).

`disponible` es independiente: controla checkout/carrito para productos aún activos en catálogo (`docs/decisions/0009-commerce-disponibilidad-comparador-precios.md`).

## Build estático

Las rutas `/es/productos/[slug]/` y `/en/products/[slug]/` se generan solo para productos activos devueltos por `getProductos()`. Tras marcar `activo=false` y un rebuild CI, **no se genera HTML** para ese slug.

En `/admin` → Productos: filtro por estado activo/inactivo; `Guardar` con `activo=false` + **Publicar cambios** (rebuild) es el flujo habitual de retiro.

## URLs que ya existían en la web o en Google

### Respuesta HTTP 410 (Gone)

Para slugs retirados que antes tenían tráfico o enlaces externos, `public/.htaccess` incluye reglas `RewriteRule … - [G,L]` bajo el bloque «Productos retirados». Devuelven **410** aunque el FTP aún conserve un `index.html` antiguo.

Al retirar lotes grandes (p. ej. fichas Fisher & Paykel / accesorios sin continuidad comercial), añadir el slug ES y EN en `.htaccess` en el mismo PR que la migración o el cambio masivo de `activo`.

### Duplicados SEO (301 al canonical)

Slugs duplicados publicados por error se resuelven con 301 al slug que permanece en el sitemap. Script de referencia: `supabase/retirar-duplicados-seo1026.sql`. Reglas ejemplo en `.htaccess` («Productos publicados dos veces»).

### Productos de prueba

Slugs `test`, `ejemplo-producto`, etc. → 410 directo (no 301 a 404).

## Landings y enlaces internos

Landings de producto y grids de catálogo solo listan productos activos en build. Tras retiros masivos, conviene:

1. Rebuild con datos vivos (`REQUIRE_LIVE_DATA` en CI).
2. Ejecutar auditorías SEO (`npm run validate:seo`, `npm run audit:seo-build`) si se tocó `.htaccess` o slugs.
3. Revisar landings CMS que referenciaban SKUs retirados (sin enlaces a 404).

Informe de enriquecimiento con fichas de fabricante (oct-2026): `docs/informe-fichas-fabricantes-2026-10-02.md`.

## Comercio y cotizaciones

`src/lib/commerce-policy.ts` rechaza líneas sobre productos `activo=false` (`reason: 'inactivo'`). Cotizaciones ya enviadas conservan histórico; no reactivar checkout sobre SKUs retirados.

## Checklist operativo (retiro de un producto)

1. Confirmar con comercial que no hay pedidos/cotizaciones abiertas dependientes.
2. `activo=false` en admin (o migración SQL para lotes).
3. Si la URL estuvo indexada: regla 410 (o 301 si hay slug sustituto) en `.htaccess`.
4. Trigger rebuild → verificar 410/404 en ES y EN.
5. Opcional: URL Inspection en Search Console tras deploy.
