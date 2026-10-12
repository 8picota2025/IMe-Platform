# ADR-0015: Autoría única del Landing Factory

- Fecha: 2026-09-22
- Estado: aceptado (decisión), migración de datos fuera de alcance de esta ADR
- Contexto: Growth Engine, Fase 1 — Foundation (`docs/growth-engine/IMPLEMENTATION_PLAN.md`)

## Contexto

El discovery de Fase 0 encontró que el Landing Factory **ya existe y funciona**: cuatro
sistemas data-driven (`comercial-landings.ts`, `fabricante-landings.ts`,
`city-landings.ts`, `familia-seo.ts`) con un renderer compartido
(`CampaignLandingPage.astro`), produciendo ≈88 landings programáticas. El problema no es
el renderer, es que existen **tres vías de autoría inconsistentes** para el mismo tipo de
contenido:

1. Archivos TypeScript literales (`src/data/*.ts`) — la vía "oficial", pero requiere
   commit + PR + deploy para cualquier cambio de copy.
2. Migraciones SQL de enriquecimiento (`20260904140000_enrich_first_landing_batch.sql`,
   `20260904150000_enrich_second_landing_batch.sql`, y similares) — copy de landing
   escrito directamente en SQL, un mecanismo aparte que nadie diseñó como tal.
3. El CMS admin (`/admin`) — usado para `articulos`/`productos`, pero no para landings.

## Decisión

**Vía única de autoría futura: el CMS admin (Supabase + `/admin`), no archivos TS ni
migraciones SQL de enriquecimiento.** Razones:

- Es el patrón que el resto del sitio ya usa para contenido editable (`articulos`,
  `productos`, taxonomía de ADR-0014) — consolidar landings ahí es coherencia
  arquitectónica, no una tecnología nueva.
- Permite editar copy sin deploy — el propio README del proyecto documenta el flujo
  "publicar en CMS → rebuild CI → deploy estático" (`trigger-rebuild`) como el patrón ya
  establecido para contenido editorial.
- Elimina la ambigüedad de "¿dónde edito esta landing?" que hoy tienen las 3 vías.

**Esta ADR fija la dirección, NO ejecuta la migración de las ≈88 landings existentes en
esta iteración.** Migrar 4 sistemas TS + N migraciones SQL a un modelo de datos en CMS es
trabajo real (diseñar el schema, migrar contenido sin perder SEO/JSON-LD ya generado,
verificar cada landing renderiza igual) — la complejidad M-L que el plan ya estimó. Se
deja como tarea de Fase 3 ("Landing & Tool Foundation" en el mandato), con esta ADR como
la decisión de diseño ya tomada para no volver a discutirla entonces.

**Regla inmediata, vigente desde ya sin esperar a la migración:** ninguna landing nueva
se añade vía migración SQL de enriquecimiento a partir de esta ADR. Las dos landings
adicionales que se necesiten mientras no exista la migración completa deben seguir el
patrón TS existente (`src/data/*.ts`) — es la menos mala de las dos vías no-CMS, porque
al menos vive versionada en el repo con type-safety, a diferencia de copy embebido en
SQL.

## Alternativas consideradas

- **Generador sobre los archivos TS** (un script que genera los `.astro` wrappers y
  valida el shape de `CampaignLandingContent`): descartado como vía _futura_ — no
  resuelve el problema real (editar copy sigue requiriendo PR + deploy), sólo automatiza
  la parte que ya es barata (los wrappers `.astro` de fabricante/ciudad ya usan
  `getStaticPaths()`, sólo las 11 landings de campaña siguen siendo manuales, y ese es un
  problema de wrapper, no de autoría de copy).
- **Dejar las 3 vías coexistiendo, sólo documentarlas mejor**: descartado — no resuelve
  la ambigüedad de origen de verdad, y las migraciones SQL de enriquecimiento seguirían
  acumulándose como una cuarta, quinta, sexta vía cada vez que alguien necesite launch
  rápido.
- **Deprecar TS y migrar directo a CMS ahora, sin fase intermedia**: descartado — riesgo
  de romper landings en producción sin tiempo de verificar cada una; la migración
  necesita su propio ciclo de QA (Fase 3), no puede ser un cambio apresurado dentro de
  Fase 1.

## Consecuencias

- Sin cambios de código en esta ADR — es una decisión de dirección arquitectónica.
- Deuda reconocida y aceptada temporalmente: las 3 vías siguen coexistiendo hasta la
  migración de Fase 3; esta ADR sólo congela que no se abra una cuarta vía y fija cuál de
  las tres sobrevive.
- Bloquea (positivamente): cualquier trabajo futuro de "Landing Factory formal" en Fase 3
  ya no necesita redebatir dónde vive la autoría — esta ADR es la respuesta.
