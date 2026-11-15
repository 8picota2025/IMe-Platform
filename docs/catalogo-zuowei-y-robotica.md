# Catálogo — Zuowei y robótica de servicio

## Zuowei (sin venta en Colombia)

Migración: `20261030180000_zuowei_sin_venta.sql`. Lógica cliente: `src/lib/zuowei-sin-venta.ts`.

- Nueve SKUs publicados (`ZW568`, `ZW598`, …) con `disponible = false` e `invima_estado = sin_registro`.
- `fichaZuoweiSinVenta` → sin checkout ni cotización de venta; copy sin promesa de precio (nota INVIMA ES/EN).
- Consumidores: `ProductoLanding`, `ProductoCard`, `TiendaCategoria`, landing robótica (`RoboticaIngenieriaLanding` + `src/data/zuowei-catalogo.ts`).

No inventar número de registro INVIMA en fichas ni en `dist/`.

## Robots de servicio (sin uso clínico en copy)

Migración: `20261030120000_robots_servicio_sin_uso_clinico.sql`.

PadBot, Cruzr y familia robots: pestaña **aplicaciones** y descripciones alineadas a recepción, orientación y automatización comercial/industrial — **sin** claims clínicos, diagnósticos ni terapéuticos en ES/EN. La landing canónica vive en TypeScript; la migración alinea CMS (`productos`, familia robots, guías enlazadas) antes del build.

Cambio reciente (PR #268 / #269): línea **UniX AI** (Wanda 2.0 Pro, Panther Pro, Pioneer H) en distribuidores ES/EN — ver `docs/pr-unix-seo-2026-11-09.md` para disponibilidad y SEO.

## Compliance de certificados en fichas

Retiro de certificados o claims no verificados en PDP (ej. Wanda 2.0 Ultra) va en commits de datos/mock + CMS, no solo en TS. Validar con `npm run audit:seo-build` cuando toque metas o H1 de fichas robots.

## Relacionado

- Disponibilidad pública (stock vs cotización): `docs/catalogo-disponibilidad-producto.md`.
- INVIMA en RAG: `docs/rag-busqueda-hibrida.md`.