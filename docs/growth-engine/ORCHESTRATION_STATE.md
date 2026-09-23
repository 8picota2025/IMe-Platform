# ORCHESTRATION_STATE — I-ME Growth Engine

> Actualizado por Claude Orchestrator después de cada bloque de trabajo, per §28 del
> mandato (`/home/shoky/IMEGrow/IMEGrowth1.md`). Fuente de verdad operativa del proyecto;
> el detalle técnico/razonado vive en `IMPLEMENTATION_PLAN.md`.

---

## Estado general

- **Fase actual:** Fase 1 — Foundation → **CERRADA**. 8/8 ADRs (0011-0018) aceptadas,
  redactadas e implementadas donde correspondía; cluster piloto decidido; plan de
  contenido de Fase 2 redactado. Después del cierre se hizo una **revisión de errores de
  todo lo realizado** (ver "Revisión post-cierre" abajo); sus correcciones están
  commiteadas en la rama.
- **Última actualización:** 2026-09-22 (revisión post-cierre)

### 🔴 Punto de reanudación — leer esto primero al retomar

**Estado git:** todo pusheado en `feat/growth-engine-foundation`, PR
[#116](https://github.com/8picota2025/IMe-Platform/pull/116) en draft: los 17 commits de
Fase 1, la revisión post-cierre (`dfa5d22`, CI verde) y el registro de la decisión sobre
clases INVIMA. Descripción del PR actualizada con la revisión.

### Revisión post-cierre (2026-09-22)

Se revisaron los 17 commits contra `a1280c2`. Corregido en la rama:

- **Redacción de PII (ADR-0017) demasiado amplia:** el patrón genérico de 7-15 dígitos
  redactaba precios, NITs, fechas y referencias, y ese texto es el que recibe el agente
  IMEIA. Ahora sólo móvil/fijo CO (+57 opcional) e internacional con `+`; tests de
  no-regresión en `pii-redact.test.ts`. ADR-0017 actualizada.
- **Contraseña del CMS legado** copiada en texto plano en `IMPLEMENTATION_PLAN.md` (D-1):
  retirada del documento. **Sigue en el historial de git** (`raw_js_cms.js` hasta
  `167146f` y el propio plan en `4f62386`): rotarla donde se haya reutilizado.
- **Primer `page_view` perdido al aceptar el banner:** se reenvía sólo a `gtag` al
  aceptar (`replayPageViewToGtag()`), sin duplicar en `dataLayer` ni en la analítica propia.
- **Retirar el consentimiento no apagaba los tags:** ahora se expiran las cookies de
  GA/Clarity (`clearAnalyticsCookies()`) y se recarga la página. ADR-0012 actualizada.
- **`supabase/schema.sql` no reflejaba las migraciones nuevas:** añadidos
  `producto_claims_evidencia`, `topic_clusters` + columnas de `articulos` y el índice de
  retención. `whatsapp_opt_ins` no se replica (depende de `leads_comerciales`, que sólo
  vive en migraciones). Verificado idempotente (dos ejecuciones) en Postgres 16 desechable.
- Este archivo: secciones desactualizadas corregidas.

**Abierto tras la revisión (requiere confirmación antes de tocar):**

1. **Consent Mode v2 probablemente inoperante:** `consent.ts` y el `gtag` definen
   comandos con `dataLayer.push([...])` / `...args` (arrays). gtag.js sólo reconoce
   objetos `arguments`, así que `consent default/update` — y posiblemente el
   `gtag('config')` de GA4, que ya venía así antes de esta rama — se estarían ignorando.
   **Verificar en DevTools** durante el QA manual del banner antes de cambiarlo.
2. **Clases de riesgo INVIMA incorrectas** en `src/data/invima-knowledge-base.json`
   (preexistente): usa "Clase II"; el Decreto 4725/2005 define I, **IIa**, IIb, III.
   **Diferido por decisión del usuario (2026-09-23):** por ahora no habrá contenido
   sobre clases de riesgo INVIMA, así que no bloquea nada. Corregir y verificar el JSON
   antes de retomar ese contenido (y antes de exponer `src/lib/invima.ts` en una tool
   que clasifique equipos).
3. Menores: el input `retention_dias` de `purgar-asesor-agent-turns.yml` no se usa; el
   CHECK de evidencia acepta `fuente_url = ''`; `revisado_por` es legible por `anon`;
   las funciones de trigger nuevas no fijan `search_path`; `purgar-asesor-agent-turns`
   acepta un JWT `service_role` sin verificar firma (hoy lo cubre `verify_jwt` del
   gateway, mismo patrón que `reporte-semanal`).
4. ~~Aprobación humana de ADR-0013 a 0018 sin registrar~~ — **resuelto:** aprobadas
   por el usuario el 2026-09-23 (ver tabla de decisiones).

**Lo último que se hizo:** `docs/growth-engine/pilot-clusters-content-plan.md` — plan de
contenido (sin producir nada todavía) para los dos clusters piloto que el usuario aprobó:
**Monitoreo/UCI + INVIMA/Regulación**. El plan está a la espera de aprobación del usuario
antes de que se escriba cualquier artículo/landing/tool/post real.

**Siguiente acción concreta cuando se retome** (en orden, per el propio plan de
contenido §4):

1. El usuario aprueba (o ajusta) `pilot-clusters-content-plan.md`.
2. Verificar en Supabase real cuántos artículos de Monitoreo ya están publicados en
   producción (el build local sólo tiene mock data — no se puede confirmar desde aquí sin
   credenciales).
3. Confirmar con el equipo biomédico de I-ME cualquier checklist operativo que el plan
   marcó `REQUIRES_VERIFICATION` (§1.3.3 del plan de contenido).
4. Recién ahí, producir contenido real — sigue siendo Fase 2 (`Knowledge Hub`), no
   arrancada todavía.

**Pendientes que no bloquean lo anterior pero siguen abiertos:**

- QA manual del banner de consentimiento (ADR-0012) en navegador real — no se hizo en
  esta sesión.
- Coordinar con el admin de Twenty CRM para crear los campos custom de la fase
  estructurada de ADR-0011 (hoy la atribución llega a Twenty como texto, funciona, pero
  no es un campo nativo consultable).
- GE-007 (contradicción de estado legal entre `README.md`/`REMEDIACION.md`/
  `PENDIENTES.md`) — identificado en Fase 0, nunca se resolvió, no bloquea nada, pendiente
  desde el principio.
- `actualizar-fulfillment/test.ts` — test de integración contra Supabase local
  descubierto durante GE-008, nunca se metió a CI (necesita su propio harness con
  service container, fuera de alcance de lo hecho hasta ahora).

**Para reanudar sin releer todo el hilo:** este archivo + `IMPLEMENTATION_PLAN.md` +
`pilot-clusters-content-plan.md` + los 8 archivos en `docs/decisions/0011-*.md` a
`0018-*.md` son la fuente de verdad completa. No hace falta releer la conversación
original — está todo aquí.

- **Repo/rama de trabajo:** `/home/shoky/cursor/ime-platform-growth-engine`, rama
  `feat/growth-engine-foundation` (creada desde `origin/main` @ `a1280c2`, worktree
  dedicado — no reutiliza `fix/saikang-missing-cart-images`, que sigue intacto).
- **Codex connector:** confirmado disponible como agente `codex:codex-rescue` en este
  entorno (mandato §18.5). No usado todavía en Fase 1 — todos los quick wins ejecutados
  hasta ahora eran lo bastante acotados (mecánicos y de bajo volumen, o requerían diseño
  de Claude primero) para que delegar a un agente Codex separado añadiera overhead sin
  beneficio. Se delegará a Codex cuando haya trabajo de mayor volumen mecánico verificable
  (p. ej. implementación de la taxonomía de topic clusters tras ADR-0014).

---

## Decisiones vigentes

Decisiones de arquitectura/alcance y su estado de aprobación humana:

| Decisión                                | Recomendación de Claude                                                                                                                                                                                                                                                     | Estado                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Cluster piloto (mandato §24)            | Monitoreo / UCI + INVIMA / Regulación (dos clusters piloto en paralelo, decisión del usuario — no la recomendación original de Claude, que sugería Ventilación como segundo; INVIMA se vuelve viable ahora porque su precondición, ADR-0013, ya está mergeada en esta rama) | **Aprobada** — 2026-09-22                       |
| Contenido sobre clases de riesgo INVIMA | No producirlo por ahora (piezas excluidas listadas al inicio de `pilot-clusters-content-plan.md`)                                                                                                                                                                           | **Decisión del usuario** — 2026-09-23           |
| Secuencia de Fase 1                     | Priorizar ADR-0012 (CMP) y ADR-0011 (fix atribución Twenty) antes que nada más                                                                                                                                                                                              | **Aprobada y ejecutada** — 2026-09-22           |
| Enfoque CMP (ADR-0012)                  | Banner propio ligero (sin vendor de pago)                                                                                                                                                                                                                                   | **Aprobada y ejecutada** — 2026-09-22           |
| Prioridad GE-008 (tests Deno)           | Arreglar ahora como parte de Fase 1                                                                                                                                                                                                                                         | **Aprobada y ejecutada** — 2026-09-22           |
| Modelo de evidencia                     | Versión mínima viable (3 campos) en vez del modelo completo de 10 campos del mandato, para no bloquear Fase 2                                                                                                                                                               | **Aprobada** (ADR-0013, `744b4ce`) — 2026-09-23 |
| ADR-0014 a ADR-0018                     | Redactadas e implementadas por Claude en la sesión de 2026-09-22                                                                                                                                                                                                            | **Aprobadas** — 2026-09-23                      |

## ADRs (ver `IMPLEMENTATION_PLAN.md` §9 para el detalle)

| ADR  | Título                                  | Estado                                                                                           |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 0011 | Atribución en `TwentyClient`            | **Aceptada (interina), redactada** — `docs/decisions/0011-*.md`, commit `1abf064`                |
| 0012 | CMP y consent-mode por defecto          | **Aceptada, redactada** — `docs/decisions/0012-*.md`, commit `b1f8195`                           |
| 0013 | Modelo mínimo de Evidence & Compliance  | **Aceptada, redactada** — `docs/decisions/0013-*.md`, commit `744b4ce`                           |
| 0014 | Taxonomía de topic clusters             | **Aceptada, redactada** — `docs/decisions/0014-*.md`, commit `6127fbb`                           |
| 0015 | Autoría única del Landing Factory       | **Aceptada (decisión, sin migración), redactada** — `docs/decisions/0015-*.md`, commit `6aaebf1` |
| 0016 | Captura de identidad opt-in en WhatsApp | **Aceptada (schema), redactada** — `docs/decisions/0016-*.md`, commit `239632a`                  |
| 0017 | Redacción PII en `asesor_agent_turns`   | **Aceptada, redactada** — `docs/decisions/0017-*.md`, commit `ef83cec`                           |
| 0018 | Automatización (n8n vs. patrón nativo)  | **Aceptada, redactada** — `docs/decisions/0018-*.md`, commit `78708f9`                           |

Numeración continúa desde la última ADR real del repo (`docs/decisions/0010-quote-numero-pdf.md`).

---

## Tareas abiertas

| task_id                       | Owner                                    | Nivel                                 | Dependencias                                                                                                                                     | Estado                    | Archivos afectados                                                                                                                                                        | Tests requeridos                                                                                                                                   | Bloqueadores                                                                       | Siguiente acción                                                                                                                                  |
| ----------------------------- | ---------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| GE-000-discovery-arch         | CLAUDE_SUBAGENT                          | L3                                    | —                                                                                                                                                | Completado                | ninguno (read-only)                                                                                                                                                       | —                                                                                                                                                  | —                                                                                  | integrado en IMPLEMENTATION_PLAN §1.1-1.3,§4                                                                                                      |
| GE-000-discovery-crm          | CLAUDE_SUBAGENT                          | L3                                    | —                                                                                                                                                | Completado                | ninguno (read-only)                                                                                                                                                       | —                                                                                                                                                  | —                                                                                  | integrado en IMPLEMENTATION_PLAN §1.4                                                                                                             |
| GE-000-discovery-seo          | CLAUDE_SUBAGENT                          | L3                                    | —                                                                                                                                                | Completado                | ninguno (read-only)                                                                                                                                                       | —                                                                                                                                                  | —                                                                                  | integrado en IMPLEMENTATION_PLAN §1.5                                                                                                             |
| GE-000-discovery-compliance   | CLAUDE_SUBAGENT                          | L3                                    | —                                                                                                                                                | Completado                | ninguno (read-only)                                                                                                                                                       | —                                                                                                                                                  | —                                                                                  | integrado en IMPLEMENTATION_PLAN §1.6-1.7                                                                                                         |
| GE-001-gate-decision          | (humano)                                 | —                                     | GE-000-\*                                                                                                                                        | **Completado — GO**       | —                                                                                                                                                                         | —                                                                                                                                                  | —                                                                                  | secuencia recomendada aprobada, 2026-09-22                                                                                                        |
| GE-002-codex-discovery        | CLAUDE                                   | L1                                    | GE-001 = GO                                                                                                                                      | **Completado**            | —                                                                                                                                                                         | —                                                                                                                                                  | —                                                                                  | `codex:codex-rescue` confirmado como conector real disponible                                                                                     |
| GE-005-d1-secreto-legado      | CLAUDE (directo, no ameritó Codex)       | L1                                    | GE-001 = GO                                                                                                                                      | **Completado**            | `src/data/raw_js_cms.js` (eliminado)                                                                                                                                      | cero referencias confirmadas por grep antes de borrar                                                                                              | la contraseña sigue en el historial de git                                         | borrado dentro de commit `167146f` (junto al gate de vitest). **Pendiente:** rotar la contraseña donde se haya reutilizado                        |
| GE-006-vitest-ci-gate         | CLAUDE (directo, no ameritó Codex)       | L1                                    | GE-001 = GO                                                                                                                                      | **Completado**            | `.github/workflows/ci.yml`                                                                                                                                                | 402/402 vitest verificado localmente antes de wirear el gate                                                                                       | —                                                                                  | commit `167146f`                                                                                                                                  |
| GE-004-adr-0011-twenty-attrib | CLAUDE (diseño e implementación directa) | L2                                    | GE-001 = GO; **admin Twenty aún debe crear campos custom** (no bloqueó esta iteración — se resolvió como fix interino de texto libre en la nota) | **Completado (interino)** | `supabase/functions/_shared/twenty-crm.ts`, `.test.ts`, `registrar-cotizacion/index.ts`, `registrar-lead-comercial/index.ts`                                              | 16/16 Deno tests (2 nuevos), 402/402 vitest, `deno check` limpio en `twenty-crm.ts`                                                                | dependencia externa sigue abierta para la fase estructurada (campos custom reales) | commit `1abf064`. **Pendiente real:** cuando el admin de Twenty cree los campos custom, escribirlos también de forma estructurada (no sólo texto) |
| GE-008-deno-tests-sin-ci      | CLAUDE (directo)                         | L1 (una vez priorizado por el humano) | GE-001 = GO                                                                                                                                      | **Completado**            | `.github/workflows/ci.yml` (+ inventario: descubierto un 5º archivo, `actualizar-fulfillment/test.ts`, integración contra Supabase local — NO incluido, follow-up aparte) | 37/37 Deno tests al wirear el gate (hoy 52/52 en 6 archivos, tras ADR-0017 y la revisión)                                                          | —                                                                                  | commit `6da5350`                                                                                                                                  |
| GE-003-adr-0012-cmp           | CLAUDE (diseño e implementación directa) | L3 diseño / L1-L2 implementación      | GE-001 = GO; decisión de vendor/build tomada por el humano (banner propio)                                                                       | **Completado**            | `src/lib/consent.ts`, `consent.test.ts`, `ConsentBanner.astro`, `AnalyticsHead.astro`, `AnalyticsNoScript.astro`, `Footer.astro`, `Layout.astro`, `es.json`, `en.json`    | 407/407 vitest (5 nuevos), lint limpio, `astro check` 0 errores, build real verificado (gtag/js y noscript GTM ausentes del HTML, banner presente) | —                                                                                  | commit `b1f8195`. ADR formal: `docs/decisions/0012-cmp-consentimiento-analitica.md`                                                               |
| GE-007-r7-estado-legal        | CLAUDE                                   | L1                                    | GE-001 = GO                                                                                                                                      | No iniciada               | `README.md` y/o `REMEDIACION.md`                                                                                                                                          | —                                                                                                                                                  | requiere confirmar con negocio cuál es la verdad vigente                           | preguntar al usuario/cliente antes de editar                                                                                                      |
| ADR-0013-evidencia            | CLAUDE                                   | L2                                    | GE-001 = GO                                                                                                                                      | **Completado**            | `supabase/migrations/20260922200000_producto_claims_evidencia.sql`, `supabase/schema.sql`                                                                                 | CHECK verificado en Postgres desechable                                                                                                            | migración no aplicada a producción (manual)                                        | commit `744b4ce`                                                                                                                                  |
| ADR-0014-topic-clusters       | CLAUDE                                   | L2                                    | GE-001 = GO                                                                                                                                      | **Completado**            | `supabase/migrations/20260922210000_articulos_topic_clusters.sql`, `supabase/schema.sql`                                                                                  | —                                                                                                                                                  | migración no aplicada a producción (manual)                                        | commit `6127fbb`                                                                                                                                  |
| ADR-0015-landing-factory      | CLAUDE                                   | L3                                    | GE-001 = GO                                                                                                                                      | **Completado (decisión)** | `docs/decisions/0015-*.md`                                                                                                                                                | —                                                                                                                                                  | migración de datos fuera de alcance                                                | commit `6aaebf1`                                                                                                                                  |
| ADR-0016-whatsapp-opt-in      | CLAUDE                                   | L2                                    | GE-001 = GO                                                                                                                                      | **Completado (schema)**   | `supabase/migrations/20260922230000_whatsapp_opt_ins.sql`                                                                                                                 | —                                                                                                                                                  | lógica conversacional es Fase 4                                                    | commit `239632a`                                                                                                                                  |
| ADR-0017-pii-asesor           | CLAUDE                                   | L2                                    | GE-001 = GO                                                                                                                                      | **Completado**            | `_shared/pii-redact.ts`, `_shared/asesor-retention.ts`, `asesor/index.ts`, `purgar-asesor-agent-turns/`, workflow de purga                                                | Deno tests en CI (patrón de teléfono corregido en la revisión post-cierre)                                                                         | 90 días de retención sin validar legalmente                                        | commit `ef83cec` + revisión post-cierre                                                                                                           |
| ADR-0018-automatizacion       | CLAUDE                                   | L3                                    | GE-001 = GO                                                                                                                                      | **Completado (decisión)** | `docs/decisions/0018-*.md`                                                                                                                                                | —                                                                                                                                                  | —                                                                                  | commit `78708f9`                                                                                                                                  |
| GE-009-revision-post-cierre   | CLAUDE                                   | L1-L2                                 | Fase 1 cerrada                                                                                                                                   | **Completado**            | ver "Revisión post-cierre" arriba                                                                                                                                         | 409/409 vitest, 52/52 Deno, lint, `astro check`, build                                                                                             | puntos 1-4 de "Abierto tras la revisión" requieren confirmación                    | QA del banner en navegador (incluye verificar Consent Mode)                                                                                       |

### Hallazgos nuevos desde Fase 0

- **Tests Deno de `supabase/functions/**` sin ejecutar en ningún lado** (ni vitest ni
CI) — **resuelto por GE-008** (`6da5350`): paso `deno test`en`ci.yml`, hoy 6 archivos,
52 tests. Sigue con `--no-check`por 10 errores de tipos preexistentes en el helper de
mocks de`twenty-crm.test.ts` (`TwentyRecord | null`) — follow-up menor sin owner.
`actualizar-fulfillment/test.ts` (integración) sigue fuera de CI, ver Blockers.

---

## Regla de contexto para delegación

Ningún subagente de Fase 1 debe recibir el repositorio mental completo. Contexto mínimo
por tarea: la sección relevante de `IMPLEMENTATION_PLAN.md`, los archivos exactos listados
en la tabla de arriba, y el ADR asociado una vez redactado. Los cuatro reportes de
discovery completos quedan en el historial de la sesión de Claude Orchestrator, no se
re-envían íntegros a cada subagente.

---

## Deuda aceptada (ver `IMPLEMENTATION_PLAN.md` §4 para el detalle completo)

D-2 a D-11 se aceptan como deuda conocida, no bloqueante para iniciar Fase 1, salvo D-1
(remediación trivial, se resuelve en Fase 1 como quick win) y D-3/R-10 (gate de CI, se
resuelve en Fase 1 como quick win).

---

## Blockers activos

1. **Admin de Twenty CRM debe crear campos custom** para que la atribución (ADR-0011) deje
   de ser texto libre en una nota y pase a campos estructurados — el fix interino ya está
   en producción-lista (commit `1abf064`), esto es sólo para la fase estructurada
   posterior.
2. **Firma legal de tasas de financiación reales** — bloquea contenido del cluster
   "Financiación" (por eso no se recomienda como piloto).
3. **`actualizar-fulfillment/test.ts` (integración, descubierto durante GE-008)** — test de
   integración contra Supabase local, necesita su propio harness en CI (service container +
   migraciones). Follow-up más grande, sin owner ni prioridad asignada todavía.

---

## Siguiente acción

Ver **"Punto de reanudación"** al principio de este archivo: aprobación del plan de
contenido piloto, verificación en Supabase real, confirmaciones del equipo biomédico y
los puntos abiertos tras la revisión post-cierre.
