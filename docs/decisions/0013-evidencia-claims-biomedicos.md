# ADR-0013: Modelo mínimo de Evidence & Compliance para claims biomédicos

- Fecha: 2026-09-22
- Estado: aceptado (alcance reducido)
- Contexto: Growth Engine, Fase 1 — Foundation (`docs/growth-engine/IMPLEMENTATION_PLAN.md`)

## Contexto

El mandato de growth engineering prohíbe explícitamente publicar claims biomédicos
sensibles (INVIMA, CE, FDA, ISO, indicaciones, precisión, eficacia, seguridad,
compatibilidad, garantía) sin evidencia suficiente: "INSUFFICIENT EVIDENCE → DO NOT
PUBLISH". Hoy esto no existe como mecanismo — es disciplina cultural ("cero invención"
en `PENDIENTES.md`). Los claims regulatorios viven como texto libre dentro de
`productos.especificaciones` JSONB, sin fuente, sin fecha de verificación, sin estado de
aprobación. `VALIDACION.md → BLOCKED_HUMAN_REVIEW` ítem 4 ya señalaba explícitamente:
"Política INVIMA por producto (no crear columna a ciegas)".

El mandato original pide un modelo de 10 campos: `CLAIM SOURCE SOURCE_URL SOURCE_TYPE
PRODUCT/MODEL JURISDICTION VALID_FROM VALID_UNTIL VERIFIED_AT CONFIDENCE
APPROVAL_STATUS`.

## Decisión

Modelo reducido a **3 campos obligatorios antes de aprobar un claim**, no los 10
completos — para no bloquear el resto de Fase 1/2 con un diseño de gobernanza más
grande del que hay evidencia de necesidad todavía. Puede ampliarse después sin romper
nada (columnas nuevas, no reescritura).

Tabla nueva `producto_claims_evidencia` (migración
`supabase/migrations/20260922200000_producto_claims_evidencia.sql`), no columnas nuevas
en `productos` — responde directamente a la objeción ya registrada en
`VALIDACION.md` ("no crear columna a ciegas"): un producto puede tener cero, uno o
varios claims, cada uno con su propio ciclo de vida.

Campos: `producto_id` (FK), `claim_texto`, `categoria` (enum: invima/ce/fda/iso/
indicacion/precision/eficacia/seguridad/compatibilidad/garantia/otro — mismas categorías
sensibles que nombra el mandato), `fuente_url`, `revisado_por`, `estado_aprobacion`
(pendiente/aprobado/rechazado), `notas`.

**Regla ejecutable a nivel de base de datos**, no sólo documental: un `CHECK CONSTRAINT`
impide guardar `estado_aprobacion = 'aprobado'` sin `fuente_url` Y `revisado_por` no
nulos. Verificado con Postgres real (contenedor descartable) que el intento de aprobar
sin evidencia falla con el constraint, y que aprobar con ambos campos presentes
funciona. Esto es lo que hace la regla "INSUFFICIENT EVIDENCE → DO NOT PUBLISH" real en
vez de aspiracional.

RLS: lectura pública sólo de claims `aprobado` (para que el sitio o el asesor IMEIA
puedan citar evidencia real sin exponer claims pendientes/rechazados); escritura sólo
admin/catalogo — mismo patrón que `articulos_select_public`/`articulos_admin_all`.

## Alternativas consideradas

- **Modelo completo de 10 campos ya**: descartado por ahora. Añade `SOURCE_TYPE`,
  `JURISDICTION`, `VALID_FROM/UNTIL`, `VERIFIED_AT`, `CONFIDENCE` — todos razonables,
  pero sin un flujo de trabajo real todavía que los consuma (no hay UI de revisión, no
  hay asesor IA citando evidencia todavía). Añadirlos ahora sería diseño especulativo.
  El schema es aditivo: se pueden agregar columnas después cuando haya un caso de uso
  concreto que los necesite.
- **Columna(s) en `productos` en vez de tabla aparte**: descartado explícitamente — es
  la opción que `VALIDACION.md` ya vetó ("no crear columna a ciegas"), y no modela bien
  "un producto puede tener varios claims independientes con distinto estado".
- **Regla sólo a nivel de aplicación (sin CHECK constraint)**: descartado. Un constraint
  de base de datos es la única forma de que la regla sea imposible de saltarse por un
  bug de aplicación o un script directo — coherente con "INSUFFICIENT EVIDENCE → DO NOT
  PUBLISH" siendo una regla dura, no una sugerencia de UI.

## Fuera de alcance de esta ADR (follow-up explícito)

- **Enforcement en el flujo de publicación real**: esta ADR crea el modelo de datos y
  su regla a nivel DB, pero no conecta todavía ningún claim existente ni construye la UI
  de revisión en `/admin`. Eso es trabajo de Fase 2 ("Knowledge Hub"), cuando se defina
  qué contenido nuevo requiere pasar por esto.
- **Migrar los claims que hoy viven en `productos.especificaciones` JSONB** a esta
  tabla: no se tocó ningún dato existente. Backfill es decisión de negocio aparte (¿vale
  la pena migrar retroactivamente 718 productos, o sólo aplica a claims nuevos?).
- **Campo `CONFIDENCE`/score numérico**: descartado del modelo mínimo — "confianza"
  sin una metodología de scoring detrás sería un número inventado, contrario a "cero
  datos inventados" (AGENTS.md).

## Consecuencias

- Migración `20260922200000_producto_claims_evidencia.sql`, verificada end-to-end contra
  Postgres 16 real en un contenedor descartable (Docker): aplica limpio, es idempotente
  (reejecutable sin error), el trigger `updated_at` funciona, y el CHECK constraint
  bloquea correctamente la aprobación sin evidencia. No se aplicó contra ningún proyecto
  Supabase real — eso sigue el flujo normal de `deploy-supabase-migrations.yml`.
- Sin impacto en datos existentes — tabla nueva, sin tocar `productos` ni `articulos`.
- Deuda reconocida: el modelo de 3 campos es deliberadamente menos rico que el mandato
  original; documentado aquí para que quede trazable si más adelante se decide ampliarlo.
