# ORCHESTRATION_STATE — I-ME Growth Engine

> Actualizado por Claude Orchestrator después de cada bloque de trabajo, per §28 del
> mandato (`/home/shoky/IMEGrow/IMEGrowth1.md`). Fuente de verdad operativa del proyecto;
> el detalle técnico/razonado vive en `IMPLEMENTATION_PLAN.md`.

---

## Estado general

- **Fase actual:** Fase 1 — Foundation → **8/8 ADRs aceptadas y redactadas** (0011-0018).
  Todo el diseño de Fase 1 que el plan proponía está cerrado; lo que queda es
  implementación diferida ya scopeada explícitamente a Fase 2/3/4 en cada ADR, más la
  decisión de negocio del cluster piloto.
- **Objetivo actual:** push de los commits pendientes, actualizar PR #116. Después:
  decisión de negocio del cluster piloto (plan §16) para poder arrancar Fase 2.
- **Última actualización:** 2026-09-22
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

Ninguna decisión de arquitectura/alcance ha sido tomada todavía por el humano. Lo que
existe hasta ahora son **recomendaciones de Claude Orchestrator pendientes de
aprobación**:

| Decisión pendiente            | Recomendación de Claude                                                                                       | Estado                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Cluster piloto (mandato §24)  | Monitoreo / UCI, con Ventilación como segundo                                                                 | Pendiente de aprobación humana        |
| Secuencia de Fase 1           | Priorizar ADR-0012 (CMP) y ADR-0011 (fix atribución Twenty) antes que nada más                                | **Aprobada y ejecutada** — 2026-09-22 |
| Enfoque CMP (ADR-0012)        | Banner propio ligero (sin vendor de pago)                                                                     | **Aprobada y ejecutada** — 2026-09-22 |
| Prioridad GE-008 (tests Deno) | Arreglar ahora como parte de Fase 1                                                                           | **Aprobada y ejecutada** — 2026-09-22 |
| Modelo de evidencia           | Versión mínima viable (3 campos) en vez del modelo completo de 10 campos del mandato, para no bloquear Fase 2 | Pendiente de aprobación humana        |

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
| GE-005-d1-secreto-legado      | CLAUDE (directo, no ameritó Codex)       | L1                                    | GE-001 = GO                                                                                                                                      | **Completado**            | `src/data/raw_js_cms.js` (eliminado)                                                                                                                                      | cero referencias confirmadas por grep antes de borrar                                                                                              | —                                                                                  | commit `1abf064`-previo en `feat/growth-engine-foundation`                                                                                        |
| GE-006-vitest-ci-gate         | CLAUDE (directo, no ameritó Codex)       | L1                                    | GE-001 = GO                                                                                                                                      | **Completado**            | `.github/workflows/ci.yml`                                                                                                                                                | 402/402 vitest verificado localmente antes de wirear el gate                                                                                       | —                                                                                  | commit `167146f`                                                                                                                                  |
| GE-004-adr-0011-twenty-attrib | CLAUDE (diseño e implementación directa) | L2                                    | GE-001 = GO; **admin Twenty aún debe crear campos custom** (no bloqueó esta iteración — se resolvió como fix interino de texto libre en la nota) | **Completado (interino)** | `supabase/functions/_shared/twenty-crm.ts`, `.test.ts`, `registrar-cotizacion/index.ts`, `registrar-lead-comercial/index.ts`                                              | 16/16 Deno tests (2 nuevos), 402/402 vitest, `deno check` limpio en `twenty-crm.ts`                                                                | dependencia externa sigue abierta para la fase estructurada (campos custom reales) | commit `1abf064`. **Pendiente real:** cuando el admin de Twenty cree los campos custom, escribirlos también de forma estructurada (no sólo texto) |
| GE-008-deno-tests-sin-ci      | CLAUDE (directo)                         | L1 (una vez priorizado por el humano) | GE-001 = GO                                                                                                                                      | **Completado**            | `.github/workflows/ci.yml` (+ inventario: descubierto un 5º archivo, `actualizar-fulfillment/test.ts`, integración contra Supabase local — NO incluido, follow-up aparte) | 37/37 Deno tests verificados localmente antes de wirear el gate                                                                                    | —                                                                                  | commit `6da5350`                                                                                                                                  |
| GE-003-adr-0012-cmp           | CLAUDE (diseño e implementación directa) | L3 diseño / L1-L2 implementación      | GE-001 = GO; decisión de vendor/build tomada por el humano (banner propio)                                                                       | **Completado**            | `src/lib/consent.ts`, `consent.test.ts`, `ConsentBanner.astro`, `AnalyticsHead.astro`, `AnalyticsNoScript.astro`, `Footer.astro`, `Layout.astro`, `es.json`, `en.json`    | 407/407 vitest (5 nuevos), lint limpio, `astro check` 0 errores, build real verificado (gtag/js y noscript GTM ausentes del HTML, banner presente) | —                                                                                  | commit `b1f8195`. ADR formal: `docs/decisions/0012-cmp-consentimiento-analitica.md`                                                               |
| GE-007-r7-estado-legal        | CLAUDE                                   | L1                                    | GE-001 = GO                                                                                                                                      | No iniciada               | `README.md` y/o `REMEDIACION.md`                                                                                                                                          | —                                                                                                                                                  | requiere confirmar con negocio cuál es la verdad vigente                           | preguntar al usuario/cliente antes de editar                                                                                                      |

### Hallazgos nuevos desde Fase 0

- **`vitest.config.mjs` nunca incluyó `supabase/functions/**`** — los 4 archivos
`Deno.test`bajo`supabase/functions/\_shared/`(incluido`twenty-crm.test.ts`, que
cubre justo el código tocado por GE-004) **no corren en ningún lado**: no en
`npm run test`, no en `ci.yml`, no hay paso `deno test`en ningún workflow. Verificado
ejecutándolos manualmente con el binario Deno ya presente en`~/.deno/bin/deno`(2.9.3) — los 14 preexistentes + 2 nuevos de este bloque pasan (16/16). Esto es más
severo que D-3/R-10 (que ya se resolvió): no es que un test roto pueda llegar a`main`, es que **una categoría entera de tests nunca se ejecuta**, ni localmente vía
`npm run validate`ni en CI.`deno check`sobre`twenty-crm.ts` también reveló que el
propio archivo de test (`twenty-crm.test.ts`, no tocado en su lógica de mock) tiene 10
errores de tipos preexistentes (`TwentyRecord | null`no asignable) — otra señal de que
nadie corre`deno check`en CI tampoco.
**No se ha decidido owner ni alcance de la corrección** (¿añadir`deno test`a`ci.yml`? ¿arreglar primero los 10 errores de tipos preexistentes? ¿instalar Deno en el
  runner de CI?) — se deja como hallazgo abierto para que el humano decida prioridad,
  en vez de ampliar el alcance de GE-006 sin autorización.

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

Todo el backlog de quick wins de Fase 1 aprobado en la sesión de 2026-09-22 está
**completado** (GE-001 a GE-008, salvo GE-007 que requiere una confirmación del cliente
sobre el estado legal antes de tocar copy). Rama `feat/growth-engine-foundation` lista
para push + PR draft (aprobado por el usuario). Después del push: continuar con
ADR-0013 (evidencia mínima), ADR-0014 (taxonomía de topic clusters) y la decisión final
de cluster piloto.
