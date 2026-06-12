# RESUMEN EJECUTIVO

## Estado

I-ME Platform está en F5 (auditoría, legales, seguridad y despliegue), en curso. Actualización 2026-06-12:
se cerró un bug bloqueante que dejaba el catálogo vacío en producción y se completó una primera pasada de
QA/SEO/seguridad/a11y/performance sobre el build estático con evidencia.

## Implementado

- F0-F4 y Asesor están implementados a nivel código.
- F5 agrega legales borrador ES/EN, enlaces de consentimiento, `robots.txt`, `llms.txt`, `.htaccess` 301 y documentación de QA/remediación.
- La aplicación sigue siendo estática en Astro y usa Supabase Edge Functions para backend sensible.
- **Catálogo real sembrado en Supabase** (2026-06-12): 8 familias y 24 productos (datos reales extraídos en F0)
  vía `scripts/seed-catalogo.mjs` (idempotente). El build genera 78 páginas, incluyendo 24 landings de producto
  por idioma con JSON-LD/canonical/hreflang correctos, usando datos en vivo de Supabase.
- **Bug crítico corregido**: `src/lib/datos.ts` caía silenciosamente al mock cuando Supabase respondía 0 filas
  sin error, y `productos.familia_slug` (columna inexistente en el schema real) rompía el filtro por familia y
  "productos relacionados". Ambos resueltos (ver REMEDIACION.md).
- **Accesibilidad**: Lighthouse sobre `dist/` pasó de accessibility 0.96 a **1.0** tras corregir contraste del
  footer (incluyendo un fallo severo en tema oscuro: footer casi blanco-sobre-blanco) y el `aria-label` del
  selector de idioma. SEO y Best Practices en 1.0.
- **Seguridad**: matriz RLS básica verificada contra el proyecto Supabase real (catálogo público de solo
  lectura para `anon`, escritura bloqueada en `productos`, formulario de cotización funcional con RLS que
  oculta solicitudes de terceros). Grep de secretos en `src`/`dist`: 0 coincidencias.

## Hallazgos nuevos (no bloqueantes, registrados en PENDIENTES.md/REMEDIACION.md)

- Performance Lighthouse (`dist/`, preset móvil simulado) en 0.66-0.79, por debajo del objetivo ≥90 — pendiente
  optimización de peso de imágenes/JS.
- Tabla `tipos` (subcategorías) sigue vacía — catálogo no agrupa por tipo dentro de cada familia.
- `sitemap-0.xml` incluye `/admin/` y páginas `/pago/*` (ambas `noindex,nofollow`) — sugerido filtrarlas del sitemap.
- `.htaccess` no define HSTS ni CSP — pendiente de añadir tras confirmar despliegue HTTPS en Hostinger.

## Bloqueantes antes de producción

- Aprobación legal de privacidad, habeas data, cookies, términos y copyright.
- Migraciones pgvector/Asesor y despliegue de Edge Functions (`asesor`, `generar-embeddings`) en Supabase.
- Pruebas reales Wompi/Stripe (credenciales pendientes).
- Deploy preprod (secretos Hostinger) y validación humana de contenido.

## Recomendación

No promover a producción raíz hasta cerrar los bloqueantes restantes de `REMEDIACION.md` (legal, Asesor,
pagos, deploy) y seguir completando la matriz `QA.md` con evidencia — especialmente interacción de filtros
del catálogo, navegación por teclado en dispositivo real y los flujos de pago/cotización end-to-end.
