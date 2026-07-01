# QA F5

Estados: Pass, Fail, Bloqueado, NO_EJECUTADO_ENTORNO.

> Nota (2026-07-01): las cifras "24 productos / 8 familias" citadas abajo son
> el snapshot del catálogo cuando se corrió esta QA (2026-06-12). El catálogo
> real hoy tiene 121 productos / 10 familias (importaciones equitronic/saikang);
> las pruebas de filtros/paginación deberían re-ejecutarse contra el volumen
> actual antes de asumir que siguen vigentes.

## Rutas

(Verificado 2026-06-12 sobre `dist/` reconstruido con catálogo sembrado en Supabase: 78 páginas, navegador real vía Playwright para `/es/catalogo` y landings de producto.)

- `/` -> `/es/`: Pass. `dist/index.html` = `<meta http-equiv="refresh" content="0; url=/es/">` + `<link rel="canonical" href="/es/">`; además `.htaccess` define `RewriteRule ^index\.html$ /es/ [R=301,L]` para hosts con mod_rewrite.
- `/es/` y `/en/`: Pass parcial. 1 `<h1>` por página verificado en `dist/es/index.html` y `dist/en/index.html`. Render completo en navegador solo verificado para `/es/`; `/en/` no se navegó interactivamente.
- Catálogo ES/EN: Pass (ES). `/es/catalogo` en `astro dev` con datos de Supabase: hero "Catálogo de Equipos", "24 equipos biomédicos en 8 categorías especializadas", grid de 8 categorías (Monitores, Cardiología, Sala de Cirugía, Neonatología, Ultrasonido, Soluciones IV, Mobiliario Hospitalario, Anestesia y Ventilación) con enlaces `?familia=...`, panel de Filtros (categorías + checkbox "Destacados") y buscador. EN no navegado interactivamente; build EN genera `/en/catalog/index.html` con 1 `<h1>`.
- Servicios: Pass parcial. 1 `<h1>` verificado en `dist/es/servicios/index.html`; contenido completo no recorrido en navegador.
- Contacto: Pass parcial. 1 `<h1>` verificado en `dist/es/contacto/index.html`; formulario/consentimiento no enviado en esta pasada.
- Financiación: Pass parcial. 1 `<h1>` verificado en `dist/es/financiacion/index.html`; simulador no ejercitado en esta pasada.
- Conocimiento stub: Pass parcial. 1 `<h1>` verificado en `dist/es/conocimiento/index.html` y `dist/en/knowledge/index.html`; contenido es stub "próximamente" (sin artículos), consistente con `llms.txt`.
- Landings producto: Pass. `monitor-multiparametrico-uci-avanzado` ES y EN verificadas en `dist/`: 1 `<h1>`, JSON-LD `@graph` (`Product` sin sku/offers/rating + `BreadcrumbList` de 4 niveles), canonical e `hreflang` es/es-CO/en/x-default recíprocos correctos. Datos provienen de Supabase (seed F0) vía `getProductoBySlug`.
- Admin: Pass parcial (sesión previa). `/admin` devuelve 404 en `astro dev` (quirk i18n del dev server de Astro 6 para rutas raíz fuera de `[locale]`, no reproducible en producción) pero 200 con formulario de login en `astro build` + `astro preview`; `dist/admin/index.html` tiene `<meta name="robots" content="noindex,nofollow">`. Login real contra Supabase Auth: NO_EJECUTADO_ENTORNO (requiere usuario admin real).
- Legales: Pass implementación de rutas ES/EN; Footer enlaza las 5 páginas legales (privacidad, habeas-data, cookies, términos, copyright) en `dist/es/index.html`; revisión legal por abogado sigue BLOQUEANTE_LEGAL.
- Pago resultado: Pass parcial. `/es/pago/{exito,fallo,pendiente}` y equivalentes EN están en el sitemap con `<meta name="robots" content="noindex, nofollow">` (verificado); flujo real contra pedidos: NO_EJECUTADO_ENTORNO (bloqueado por credenciales Wompi/Stripe).

## Catálogo

- Jerarquía (8 familias) y "mostrar todos": Pass, verificado en `/es/catalogo` (grid de 8 categorías + botón "Todos los equipos").
- Filtros por categoría y "Destacados", buscador: Pass de presencia/render (panel "Filtros" con 8 botones de categoría + checkbox "Destacados" + searchbox "Buscar en el catálogo" + botón "Limpiar filtros"); interacción de filtrado (clic → resultado filtrado) y sincronización de URL: NO_EJECUTADO_ENTORNO en esta pasada.
- Paginación: NO_EJECUTADO_ENTORNO (24 productos caben en una sola página con `pageSize` por defecto; no se pudo ejercitar paginación real).
- Tipos/subcategorías ausentes ("General"): confirmado — `src/data/mock-tipos.json` está vacío y la tabla `tipos` en Supabase también (no sembrada), por lo que no hay agrupación por tipo. Registrado en PENDIENTES.md / REMEDIACION.md.

## Landings

- Hero, breadcrumbs, JSON-LD, canonical, hreflang: Pass (ver sección Rutas y VALIDACION.md), verificado en `monitor-multiparametrico-uci-avanzado` ES/EN.
- Galería: Pass de render (sección de galería presente en la landing); sin imágenes adicionales más allá de `imagen_principal` en los datos sembrados (`galeria: []` en `mock-productos.json`), por lo que se muestra solo la imagen principal — comportamiento esperado, no es un bug.
- Especificaciones (`especificaciones`): Pass — sección "Especificaciones" presente con estado vacío correcto (todos los productos sembrados tienen `especificaciones: []`, sin inventar datos).
- Comparador: NO_EJECUTADO_ENTORNO (no se interactuó con el comparador en esta pasada).
- CTA según `tipo_comercial`/`fulfillment_mode`: Pass de render (CTA "Cotizar ahora" visible); no se verificaron las 4 variantes de la matriz comercial (consumible/equipo × dropship/cotización/individualizado) una por una.
- Ficha PDF (`ficha_pdf`): NO_EJECUTADO_ENTORNO — los productos sembrados no tienen `ficha_pdf` (no inventado, dato ausente en F0).
- Productos relacionados: Pass. Verificado en `monitor-multiparametrico-uci-avanzado` (familia "monitores"): la landing muestra productos relacionados de la misma familia, resueltos correctamente vía `familia_id`↔`familia_slug` (fix de esta sesión).
- Breadcrumbs: Pass, `BreadcrumbList` de 4 niveles en JSON-LD, verificado en dist ES/EN.

## Admin

- Login, guard, CRUD, ingesta PDF, revisión obligatoria, publicar -> embeddings -> rebuild, CSV: NO_EJECUTADO_ENTORNO por falta de Supabase/secretos.

## Asesor

- Recuperación real, producto citado existe, guardarraíl clínico, precio/financiación derivan, anti-bot, rate-limit, presupuesto agotado, keyword fallback: NO_EJECUTADO_ENTORNO por falta de funciones desplegadas y credenciales.

## Comercio

- Carrito: NO_EJECUTADO_ENTORNO en navegador.
- Wompi sandbox CO: Bloqueado por credenciales.
- Stripe test INTL: Bloqueado por credenciales.
- Webhooks: Bloqueado por endpoints/secretos reales.
- Idempotencia: NO_EJECUTADO_ENTORNO contra Supabase.
- Pedidos admin: NO_EJECUTADO_ENTORNO.
- Equipo cotización: NO_EJECUTADO_ENTORNO contra Supabase; mock local no prueba persistencia.

## i18n

- Selector mantiene ruta equivalente: NO_EJECUTADO_ENTORNO.
- `hreflang` recíproco: pendiente validar en `dist`.
- EN con pendientes marcados internamente: Pass parcial, existen `COPY_CLIENTE_REVISAR` en contenido EN.
