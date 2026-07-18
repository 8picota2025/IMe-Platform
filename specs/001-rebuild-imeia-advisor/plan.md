# Implementation Plan: Reconstrucción del asesor IMEIA

**Branch**: `cursor/rebuild-imeia-advisor-5d08` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-rebuild-imeia-advisor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Reconstruir IMEIA alrededor de un único contrato conversacional: la plataforma controla la identidad, el estado de descubrimiento, la validación del catálogo, la política de preguntas y la llamada a la acción; el modelo externo aporta comprensión y redacción, pero no decide productos válidos ni escribe en el CRM. La entrega incorpora perfil provisional de sesión, respuesta estructurada y validada, selección contextual de siguiente paso, captura explícita y consentida de lead, y enlace de la conversación con solicitudes de cotización.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 6 estricto en Astro; TypeScript compatible con Deno en Edge Functions; SQL PostgreSQL/Supabase

**Primary Dependencies**: Astro 6, Supabase JS 2, Supabase Edge Functions, API IMEIA/Hermes compatible con Chat Completions; sin dependencias nuevas

**Storage**: Supabase Postgres para leads consentidos y cotizaciones; `sessionStorage` para historial y perfil provisional anónimo

**Testing**: Vitest para reducer, contrato, validación y políticas; `astro check`, ESLint y build SSG; smoke manual documentado para Edge Functions

**Target Platform**: Navegadores modernos móviles/escritorio; Supabase Edge Functions sobre Deno; hosting estático de Astro

**Project Type**: Aplicación web estática con backend serverless y servicio de lenguaje externo

**Performance Goals**: Actualización local de estado imperceptible; una sola llamada al modelo por turno normal; máximo cuatro tarjetas verificadas; respuesta degradada útil sin esperar un segundo servicio externo

**Constraints**: Cero datos inventados; no diagnóstico; precio no comprometido; secretos solo en Edge Functions; `precio_costo` nunca expuesto; RLS estricta; sin React; equivalencia es/en; consentimiento previo a persistir PII; no almacenar transcript anónimo en servidor

**Scale/Scope**: Un widget global, un cliente conversacional, una Edge Function de asesoría, una Edge Function de lead, extensión del flujo de cotización, una tabla CRM de leads y pruebas unitarias/contractuales

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Datos reales**: PASS. Toda tarjeta se resuelve contra productos activos y los campos ausentes se marcan para confirmación.
- **Seguridad de secretos**: PASS. IMEIA, service role y escrituras CRM permanecen en Edge Functions.
- **Límite clínico**: PASS. La política central prohíbe diagnóstico/tratamiento y contempla redirección por riesgo.
- **Privacidad y CRM**: PASS. El perfil anónimo queda en sesión y el lead exige contacto válido y consentimiento explícito.
- **i18n**: PASS. Contratos, preguntas y UI se implementan para español e inglés.
- **Stack inamovible**: PASS. No se introducen React, Framer Motion ni Three.js.
- **Precio confidencial**: PASS. Ni el prompt ni el contexto incluyen `precio_costo`.
- **Calidad**: PASS condicionado a `npm run validate` antes de cierre.

## Project Structure

### Documentation (this feature)

```text
specs/001-rebuild-imeia-advisor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── components/
│   └── Asesor.astro
├── lib/
│   ├── asesor.ts
│   ├── imeia-conversation.ts
│   ├── imeia-conversation.test.ts
│   └── datos.ts
├── pages/{es,en}/
│   └── {contacto,contact}.astro
└── i18n/{es,en}.json

supabase/
├── functions/
│   ├── asesor/index.ts
│   ├── registrar-imeia-lead/index.ts
│   └── registrar-cotizacion/index.ts
├── migrations/
│   └── 20260718000000_imeia_conversational_crm.sql
└── schema.sql

specs/001-rebuild-imeia-advisor/
├── contracts/
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

**Structure Decision**: Se mantiene la arquitectura existente Astro + Supabase. La política pura y tipada vive en `src/lib/imeia-conversation.ts` para compartirla entre cliente, Edge y pruebas; la Edge Function `asesor` conserva autoridad sobre catálogo y respuesta; una función separada registra leads consentidos; el widget solo conserva estado provisional y representa el contrato.

## Complexity Tracking

No hay violaciones de constitución ni se añaden proyectos o dependencias. La Edge Function adicional separa el tratamiento de PII de la conversación anónima y reduce privilegios, en vez de ampliar el alcance del modelo.
