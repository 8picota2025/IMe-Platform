# Auditoría SEO

## Pass local/build

- Canonical, hreflang ES/EN, JSON-LD y noindex existen en layouts/páginas.
- `robots.txt`, `sitemap-index.xml`, `sitemap-0.xml` y `llms.txt` se generan.
- `npm run audit:seo-build`: `OK (1642 HTML, 1 sitemap XML)`.
- Sitemap excluye rutas privadas, carrito, checkout, pagos y herramientas internas.
- Producto/familia/catálogo tienen rutas canónicas y breadcrumbs.

## Riesgos/pending

Crawl HTTP externo completo, Search Console/Bing, duplicados, indexación real,
Core Web Vitals, hreflang recíproco en todas las URLs y claims regulatorios.
Contenido EN con `COPY_CLIENTE_REVISAR` no debe promocionarse sin aprobación.
