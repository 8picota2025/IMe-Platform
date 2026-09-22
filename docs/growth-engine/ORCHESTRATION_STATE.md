# ORCHESTRATION_STATE — I-ME Growth Engine

> Actualizado por Claude Orchestrator después de cada bloque de trabajo, per §28 del
> mandato (`/home/shoky/IMEGrow/IMEGrowth1.md`). Fuente de verdad operativa del proyecto;
> el detalle técnico/razonado vive en `IMPLEMENTATION_PLAN.md`.

---

## Estado general

- **Fase actual:** Fase 0 — Discovery & Plan → **COMPLETADA**
- **Objetivo actual:** obtener decisión GO/HOLD humana para iniciar Fase 1 — Foundation
- **Última actualización:** 2026-09-22
- **Repo:** `/home/shoky/cursor/ime-platform` (worktree, rama `fix/saikang-missing-cart-images`)
- **CODEX_CONNECTOR_UNAVAILABLE:** aún no verificado — descubrir el conector/plugin Codex
  real es el primer paso técnico de Fase 1 (mandato §18.5), no se asumió nada en Fase 0.

---

## Decisiones vigentes

Ninguna decisión de arquitectura/alcance ha sido tomada todavía por el humano. Lo que
existe hasta ahora son **recomendaciones de Claude Orchestrator pendientes de
aprobación**:

| Decisión pendiente | Recomendación de Claude | Estado |
|---|---|---|
| Cluster piloto (mandato §24) | Monitoreo / UCI, con Ventilación como segundo | Pendiente de aprobación humana |
| Secuencia de Fase 1 | Priorizar ADR-0012 (CMP) y ADR-0011 (fix atribución Twenty) antes que nada más | Pendiente de aprobación humana |
| Modelo de evidencia | Versión mínima viable (3 campos) en vez del modelo completo de 10 campos del mandato, para no bloquear Fase 2 | Pendiente de aprobación humana |

## ADRs (ver `IMPLEMENTATION_PLAN.md` §9 para el detalle)

| ADR | Título | Estado |
|---|---|---|
| 0011 | Atribución en `TwentyClient` | Propuesta, no redactada formalmente |
| 0012 | CMP y consent-mode por defecto | Propuesta, no redactada formalmente |
| 0013 | Modelo mínimo de Evidence & Compliance | Propuesta, no redactada formalmente |
| 0014 | Taxonomía de topic clusters | Propuesta, no redactada formalmente |
| 0015 | Autoría única del Landing Factory | Propuesta, no redactada formalmente |
| 0016 | Captura de identidad opt-in en WhatsApp | Propuesta, no redactada formalmente |
| 0017 | Redacción PII en `asesor_agent_turns` | Propuesta, no redactada formalmente |
| 0018 | Automatización (n8n vs. patrón nativo) | Propuesta, no redactada formalmente |

Numeración continúa desde la última ADR real del repo (`docs/decisions/0010-quote-numero-pdf.md`).

---

## Tareas abiertas

| task_id | Owner | Nivel | Dependencias | Estado | Archivos afectados | Tests requeridos | Bloqueadores | Siguiente acción |
|---|---|---|---|---|---|---|---|---|
| GE-000-discovery-arch | CLAUDE_SUBAGENT | L3 | — | Completado | ninguno (read-only) | — | — | integrado en IMPLEMENTATION_PLAN §1.1-1.3,§4 |
| GE-000-discovery-crm | CLAUDE_SUBAGENT | L3 | — | Completado | ninguno (read-only) | — | — | integrado en IMPLEMENTATION_PLAN §1.4 |
| GE-000-discovery-seo | CLAUDE_SUBAGENT | L3 | — | Completado | ninguno (read-only) | — | — | integrado en IMPLEMENTATION_PLAN §1.5 |
| GE-000-discovery-compliance | CLAUDE_SUBAGENT | L3 | — | Completado | ninguno (read-only) | — | — | integrado en IMPLEMENTATION_PLAN §1.6-1.7 |
| GE-001-gate-decision | (humano) | — | GE-000-* | Pendiente | — | — | requiere decisión del usuario | presentar resumen ejecutivo, esperar GO/HOLD |
| GE-002-codex-discovery | CLAUDE | L1 | GE-001 = GO | No iniciada | — | — | GE-001 | inspeccionar conector/plugin Codex disponible (mandato §18.5) |
| GE-003-adr-0012-cmp | CLAUDE | L3 diseño | GE-001 = GO | No iniciada | `src/components/AnalyticsHead.astro`, nuevo módulo CMP | manual QA de consent-mode en Chrome/Safari | GE-001 | redactar ADR-0012 formal |
| GE-004-adr-0011-twenty-attrib | CLAUDE | L2 (diseño Claude / impl. Codex) | GE-001 = GO; admin Twenty crea campos custom | No iniciada | `supabase/functions/_shared/twenty-crm.ts` | test unitario de firma extendida | dependencia externa: admin de Twenty | coordinar con admin de `crm.i-me.com.co` en paralelo al diseño |
| GE-005-d1-secreto-legado | CODEX | L1 | GE-001 = GO | No iniciada | `src/data/raw_js_cms.js` | ninguno usa el archivo (verificar antes de borrar) | — | confirmar cero referencias, remover o sanear |
| GE-006-vitest-ci-gate | CODEX | L1 | GE-001 = GO | No iniciada | `.github/workflows/ci.yml` | `npm run test` en verde | — | añadir step al workflow |
| GE-007-r7-estado-legal | CLAUDE | L1 | GE-001 = GO | No iniciada | `README.md` y/o `REMEDIACION.md` | — | requiere confirmar con negocio cuál es la verdad vigente | preguntar al usuario/cliente antes de editar |

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

1. **Decisión GO/HOLD humana** para iniciar Fase 1 (bloquea todo lo demás).
2. **Admin de Twenty CRM debe crear campos custom** antes de que ADR-0011 pueda
   implementarse en producción — acción humana externa al repo.
3. **Firma legal de tasas de financiación reales** — bloquea contenido del cluster
   "Financiación" (por eso no se recomienda como piloto).
4. **Conector/plugin Codex no descubierto todavía** — bloquea cualquier delegación L1/L2
   real hasta GE-002.

---

## Siguiente acción

Presentar resumen ejecutivo (`IMPLEMENTATION_PLAN.md` §0) y esta tabla de blockers al
usuario. Esperar decisión GO/HOLD antes de tocar código de producción o crear ADRs
formales.
