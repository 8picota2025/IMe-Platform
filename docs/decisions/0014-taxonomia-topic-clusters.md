# ADR-0014: Taxonomía de topic clusters para el Knowledge Hub

- Fecha: 2026-09-22
- Estado: aceptado
- Contexto: Growth Engine, Fase 1 — Foundation (`docs/growth-engine/IMPLEMENTATION_PLAN.md`)

## Contexto

`/es/conocimiento/` es hoy un grid plano de artículos ordenado por fecha, sin
categoría, tag ni cluster (`articulos` en `schema.sql` no tenía esos campos). El único
mecanismo de linking sistemático es `FAMILIA_HUB_LINKS`
(`src/data/familia-seo.ts:1074-1214`), un mapa hardcodeado de 8 familias → 1-3 enlaces,
y sólo en sentido familia→artículo, nunca artículo→artículo. El mandato pide topic
clusters con página pilar + 3-5 supporting assets (Sección 24), y el subagente de
discovery SEO de Fase 0 ya identificó qué clusters tienen profundidad real hoy
(landing + keywords + contenido + catálogo) frente a cuáles no tienen nada.

## Decisión

Tabla de referencia `topic_clusters` + dos columnas nuevas en `articulos`
(`cluster_id` FK nullable, `tags TEXT[]` default `{}`) — migración
`supabase/migrations/20260922210000_articulos_topic_clusters.sql`. Ambas columnas son
nullable/con default, así que ningún artículo existente se rompe ni requiere backfill
obligatorio.

Se sembraron 6 clusters candidatos, exactamente los que el discovery SEO de Fase 0
identificó con evidencia citada a archivo — **no se inventó ningún cluster nuevo**:
`monitoreo-uci`, `ventilacion-terapia-respiratoria`, `movilidad-rehabilitacion`,
`cardiologia-reanimacion`, `financiacion`, `invima-regulacion`. Cada fila lleva su
evidencia de por qué existe (qué landing, qué keywords, cuántos artículos) directamente
en la columna `descripcion`, para que quede trazable sin tener que volver a
`IMPLEMENTATION_PLAN.md`.

**Esta ADR NO decide el cluster piloto.** Eso es una decisión de negocio explícitamente
separada (mandato Sección 24, plan §16) — la tabla sólo registra la taxonomía candidata;
`monitoreo-uci` sigue siendo la recomendación de Claude Orchestrator, pendiente de
aprobación humana, no una decisión tomada aquí.

## Alternativas consideradas

- **Taxonomía libre en código** (un array de constantes en `src/data/`, sin tabla): se
  descartó porque el mandato modela el Knowledge Graph como entidades con relaciones
  consultables (`TOPIC ↔ CONTENT_ASSET ↔ ...`), y una tabla real permite que el admin
  cree/edite clusters sin deploy, y que el hub renderice "artículos relacionados por
  cluster" con una query en vez de un mapa hardcodeado más — exactamente el problema que
  ya tiene `FAMILIA_HUB_LINKS`.
- **Categoría simple (un solo `TEXT` en vez de FK + tags)**: descartado — un artículo
  suele tocar más de un tema (p. ej. un artículo sobre checklist de compra de
  desfibrilador es `cardiologia-reanimacion` con tags `compra`, `checklist`); `tags[]`
  cubre eso sin forzar un solo cluster por artículo, mientras `cluster_id` sigue dando
  la agrupación primaria para el hub.
- **Sembrar clusters de baja evidencia hoy** (imagenología, esterilización, sala de
  cirugía, robótica — mencionados en el discovery como "landings + family hubs existen,
  ~0-1 artículos") o clusters de cero contenido (mantenimiento, calibración,
  comparadores, licitaciones, tecnovigilancia, TCO): no se sembraron en esta migración.
  Se pueden insertar después con un `INSERT` simple cuando haya decisión de invertir en
  ellos — no es una limitación del schema, es una decisión deliberada de no poblar la
  tabla con clusters sin evidencia de demanda todavía.

## Consecuencias

- Migración `20260922210000_articulos_topic_clusters.sql`, verificada end-to-end contra
  Postgres 16 real (mismo contenedor descartable que ADR-0013): aplica limpio, es
  idempotente (el `INSERT ... ON CONFLICT (slug) DO NOTHING` no duplica filas en un
  segundo run, confirmado — 6 filas antes y después de reejecutar), RLS funciona.
- Sin impacto en datos existentes — columnas nuevas nullable/con default, artículos
  existentes quedan con `cluster_id = NULL`, `tags = '{}'`.
- Fuera de alcance aquí (follow-up de Fase 2): actualizar `/es/conocimiento.astro` para
  filtrar/agrupar por cluster, construir el bloque de "artículos relacionados" que hoy no
  existe (`[slug].astro` no tiene ninguno), y decidir formalmente el cluster piloto.
