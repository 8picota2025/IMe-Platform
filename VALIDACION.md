# VALIDACION F5

Fecha: 2026-06-12  
Rama: `feature/fase-5`

> Nota (2026-07-01): las cifras de catálogo citadas en este documento (24
> productos / 8 familias) reflejan el snapshot del 2026-06-12. El catálogo
> real hoy tiene 121 productos / 10 familias (importaciones equitronic/saikang
> posteriores) — ver PENDIENTES.md.

## Evidencia local

- `npm run validate`: Pass el 2026-06-12 (tras los fixes de esta sesión). Resultado: lint 0 errores, Astro check 0 errores/0 warnings (8 hints preexistentes en scripts/ y BaseHead.astro, no relacionados), build 78 páginas.
- Grep de secretos en `src` y `dist`: Pass el 2026-06-12, 0 coincidencias para patrones sensibles (`service_role`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `VOYAGE_API_KEY`, `WOMPI_PRIVATE`, `WOMPI_EVENTS_SECRET`, `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET`).
- Legales ES/EN: implementados como borradores con `COPY_CLIENTE_REVISAR` y `BLOQUEANTE_LEGAL`.
- Footer: enlaza privacidad, habeas data, cookies, términos y copyright.
- Consentimientos: formularios de contacto, carrito y cotización enlazan política de privacidad.
- `robots.txt`: bloquea `/admin`, `/admin/`, `/_astro/`, `/77/`, `/1old/`; declara `Sitemap: https://i-me.com.co/sitemap-index.xml`.
- `.htaccess` (public/.htaccess, copiado a dist/.htaccess, 36 líneas): 301 explícitos para `index.html`→`/es/`, `/77/`→`/es/`, `/77/index.html`→`/es/`, `/77/catalogo.html`→`/es/catalogo`, las 8 familias (`/77/{monitores,cardiologia,sala-cirugia,neonatologia,ultrasonido,soluciones-iv,mobiliario,anestesia}.html`→`/es/catalogo?familia=...` con `QSA`), páginas core (`/77/servicios.html`, `/77/contacto.html`, `/77/financiacion.html`) y `/1old(/.*)?`→`/es/`. No se detectaron bucles (todas las reglas son legacy→`/es/...`, ninguna `/es/...`→legacy). Bloque `<IfModule mod_headers.c>` con `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: SAMEORIGIN`. **Pendiente (Mayor)**: no hay `Strict-Transport-Security` (HSTS) ni `Content-Security-Policy` (CSP) — el F5 prompt los menciona como deseables; quedan como NO_EJECUTADO_ENTORNO porque dependen de servir siempre sobre HTTPS en Hostinger (riesgo de bloqueo si se activan antes del deploy con TLS confirmado).
- `llms.txt`: actualizado con comercio F4, financiación orientativa y legales borrador. Verificado el 2026-06-12: refleja el catálogo real sembrado — "Catalog (24 products, 8 categories...)" y lista las 8 familias con sus productos (ej. Monitores de Signos Vitales: 4 productos, Cardiología: 4, Sala de Cirugía: 3...), enlaces ES/EN consistentes con las rutas del sitemap.

## Sitemap (dist/sitemap-0.xml vía sitemap-index.xml)

- 71 `<loc>` tras filtrar rutas no indexables: 24 `/es/productos/<slug>` + 24 `/en/products/<slug>` + 10 rutas ES (`/`, `/catalogo`, `/servicios`, `/contacto`, `/financiacion`, `/conocimiento`, `/legal/{privacidad,habeas-data,cookies,terminos,copyright}`) + 10 equivalentes EN + `/` (raíz). El build sigue generando 78 páginas; el sitemap excluye `/admin/` y `/es|en/pago/*` porque son `noindex,nofollow`.
- Las 24 landings de producto por locale corresponden 1:1 con `mock-productos.json` / la tabla `productos` sembrada (8 familias × 3-4 productos cada una).
- Fix aplicado en `astro.config.mjs`: integración `@astrojs/sitemap` con `filter` para excluir `/admin/`, `/es/pago/*` y `/en/payment/*`.

## JSON-LD, canonical y hreflang (landing de producto, verificado en dist)

- `dist/es/productos/monitor-multiparametrico-uci-avanzado/index.html`: `@graph` con `Product` (name, description, image, url, brand, category — sin `sku`/`offers`/`rating`, cumple regla "cero invención") + `BreadcrumbList` (4 items). Canonical `https://i-me.com.co/es/productos/monitor-multiparametrico-uci-avanzado`. `hreflang` recíproco es/es-CO/en/x-default. Meta description 127 caracteres.
- `dist/en/products/monitor-multiparametrico-uci-avanzado/index.html`: canonical a `/en/products/...`, `hreflang` recíproco apuntando de vuelta a la versión ES. Datos idénticos a la versión ES (mismo producto, traducido), consistente con Supabase tras el seed.

## Seguridad — RLS (Supabase real, verificado 2026-06-12)

Matriz ejecutada con `curl` contra `nnfbucwiasuggyfoyydo.supabase.co/rest/v1/`:

| Operación                       | Rol  | Resultado           | Esperado                                                                                                     |
| ------------------------------- | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `SELECT productos` (slug)       | anon | 200, devuelve filas | Pass — catálogo público legible                                                                              |
| `INSERT productos`              | anon | 401                 | Pass — RLS bloquea escritura anónima                                                                         |
| `SELECT solicitudes_cotizacion` | anon | 200, `[]`           | Pass — RLS oculta filas de terceros (PostgREST devuelve 200+`[]`, no 403, cuando RLS filtra todas las filas) |
| `INSERT solicitudes_cotizacion` | anon | 201                 | Pass — formulario público de cotización funciona                                                             |

Fila de prueba (`mensaje: "[QA F5] prueba RLS automatizada"`) insertada y eliminada con `service_role` tras la verificación; no queda dato de prueba en la base.

## Accesibilidad y Lighthouse (2026-06-12)

- H1 único por página: verificado en `/es/`, `/es/catalogo`, `/es/productos/monitor-multiparametrico-uci-avanzado`, `/es/servicios`, `/es/contacto`, `/es/financiacion` — 1 `<h1>` cada una.
- `prefers-reduced-motion: reduce`: manejado globalmente en `src/styles/globals.css` (anula animaciones/transiciones) y específicamente en `CotizacionDrawer.astro` y `Carrito.astro`.
- Skip-link (`#main-content`) presente en `Layout.astro`; `:focus-visible` con outline de 3px (`var(--blue)`) en `globals.css` y `.btn`.
- Selector de idioma del Navbar (botón EN/ES) y toggle de tema oscuro probados con teclado/click en `/es/catalogo`: funcionan, cambian `data-theme` y la URL alterna correctamente (`/es/catalogo` ↔ `/en/catalog`).
- Catálogo ES (`/es/catalogo`, dev server con datos reales de Supabase sembrados): renderiza hero "Catálogo de Equipos", "24 equipos biomédicos en 8 categorías especializadas", grid de 8 categorías con enlaces `?familia=...`, panel de Filtros (categoría + destacados) y buscador.
- Lighthouse (Chrome headless, `npx lighthouse`, preset por defecto = móvil simulado) sobre `dist/` servido estáticamente (`python3 -m http.server`), página `/es/`:
  - **Antes del fix de a11y**: performance 0.78-0.79, accessibility 0.96 (fallos: `color-contrast` en footer, `label-content-name-mismatch` en selector de idioma), best-practices 1.0, seo 1.0.
  - **Después del fix** (opacidades de footer subidas a 0.5, `aria-label` del selector de idioma incluye el código de idioma, footer con fondo/texto fijos independientes del tema): performance 0.66-0.79 (varianza del entorno headless compartido), **accessibility 1.0**, best-practices 1.0, seo 1.0.
  - Performance por debajo del objetivo ≥90 de PENDIENTES.md; mayor oportunidad: `total-byte-weight` ~3.1MB y `unused-javascript` ~248KiB (ver REMEDIACION.md, registrado como Menor/OPCIONAL_MEJORA — no bloqueante para esta fase, pendiente de optimización de imágenes/JS).
  - Lighthouse contra `astro dev` (sin build) dio performance ~0.52 — descartado como no representativo (dev server sin minificar).

## Pipeline completo

1. `npm install` / `npm ci`: NO_EJECUTADO_ENTORNO en F5 local; dependencias ya presentes. Usar Node `>=22.12.0`.
2. Aplicar `supabase/schema.sql`: NO_EJECUTADO_ENTORNO, requiere proyecto Supabase y permisos SQL.
3. Crear admin Supabase: NO_EJECUTADO_ENTORNO, requiere Auth real.
4. Configurar env: NO_EJECUTADO_ENTORNO, faltan secretos cliente.
5. Ingesta PDF -> borrador: NO_EJECUTADO_ENTORNO, requiere `ANTHROPIC_API_KEY` u `OPENAI_API_KEY`.
6. Revisión humana: NO_EJECUTADO_ENTORNO, requiere contenido real del cliente.
7. Publicar: NO_EJECUTADO_ENTORNO, requiere admin real.
8. Generar embeddings: NO_EJECUTADO_ENTORNO, requiere migraciones, Edge Function y `VOYAGE_API_KEY`.
9. Trigger rebuild: NO_EJECUTADO_ENTORNO, requiere deploy hook o GitHub token.
10. Deploy preprod: NO_EJECUTADO_ENTORNO, requiere secretos Hostinger.
11. Auditoría contenido: NO_EJECUTADO_ENTORNO, requiere preprod y revisión humana.
12. Promoción raíz: NO_EJECUTADO_ENTORNO, requiere aprobación del cliente.
13. Verificar 301: NO_EJECUTADO_ENTORNO, ejecutar contra Hostinger tras deploy.
14. Compra Wompi sandbox: NO_EJECUTADO_ENTORNO, requiere credenciales Wompi.
15. Compra Stripe test: NO_EJECUTADO_ENTORNO, requiere credenciales Stripe.
16. Cotización equipo: NO_EJECUTADO_ENTORNO contra Supabase; mock local envía OK.
17. Asesor recupera producto nuevo: NO_EJECUTADO_ENTORNO, requiere RAG desplegado y embeddings.

## Comandos de verificación pendientes

```bash
npm run validate
rg -n "service_role|SERVICE_KEY|service_role_key|ANTHROPIC_API_KEY|OPENAI_API_KEY|VOYAGE_API_KEY|WOMPI_PRIVATE|WOMPI_EVENTS_SECRET|STRIPE_SECRET|STRIPE_WEBHOOK_SECRET|TURNSTILE_SECRET" src dist
npx lighthouse http://localhost:44334/es/ --preset=desktop --output=html --output-path=./lighthouse-home.html
curl -I https://i-me.com.co/77/
curl -I https://i-me.com.co/1old/
```
