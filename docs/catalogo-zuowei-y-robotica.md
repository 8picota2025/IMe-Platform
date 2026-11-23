# Catálogo Zuowei y landing de robótica

## Zuowei — fichas publicadas sin venta

PRs #242–#249. Nueve modelos en catálogo con ficha y SEO; **sin registro INVIMA verificado** → no checkout ni cotización de venta.

### Reglas en código

- `src/lib/zuowei-sin-venta.ts`: SKUs `ZW568`, `ZW598`, `ZW518`, `ZW302`, `ZW365D-2`, `ZW366S`, `ZW186`, `ZW501`, `ZW502` y slugs `zuowei-zw*`.
- `fichaZuoweiSinVenta`: `disponible === false` **y** es ficha Zuowei → oculta CTA de compra/cotización en UI.
- BD: `invima_estado = 'sin_registro'` (migración `20261030140000`); migración `20261030180000_zuowei_sin_venta.sql` alinea catálogo.
- Performance: el explorador de catálogo no carga el bundle Zuowei pesado salvo rutas que lo necesitan (`fix(perf)` PR #249).

### Qué no hacer

- No marcar INVIMA vigente ni precio de venta en estas fichas.
- No reactivar checkout sin OK legal + dato INVIMA verificado.

## Landing distribuidores / ingeniería robótica

- Datos: `src/data/robotica-ingenieria.ts`, componente `RoboticaIngenieriaLanding.astro`.
- Slug canónico (ES): `distribuidores-de-robots-e-ingenieria-robotica-en-colombia-y-latinoamerica` — ver `ROBOTICA_PATH` / `ROBOTICA_SLUG`.
- Ruta corta `/es/robotica-rehabilitacion/` → **301** al slug largo (PR #240).
- Catálogo visual familia robots: PR #241 (`TiendaCategoria`, tarjetas con fotos de estudio).
- Copy: sin precios inventados, sin registros INVIMA inventados, sin SKUs nuevos; specs desde manuales del dossier 2026-10-28.

## Prueba rápida

1. Abrir una ficha Zuowei: debe mostrar información pero no flujo de venta si `disponible=false`.
2. Landing robótica ES/EN: canonical, breadcrumb JSON-LD, FAQ según `robotica-ingenieria.ts`.
3. `npm run test` — incluye `zuowei-catalogo.test.ts`, `seo.test.ts` para rutas 301.
