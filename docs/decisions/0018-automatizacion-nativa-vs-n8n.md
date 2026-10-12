# ADR-0018: Automatización — patrón nativo (Edge Functions + GitHub Actions cron), no n8n

- Fecha: 2026-09-22
- Estado: aceptado
- Contexto: Growth Engine, Fase 1 — Foundation (`docs/growth-engine/IMPLEMENTATION_PLAN.md`)

## Contexto

El mandato pregunta explícitamente si el growth engine debe automatizarse con n8n u
otro sistema de automatización. El discovery de Fase 0 confirmó **cero resultados** de
n8n (ni de Zapier/Make/Activepieces/Windmill) en todo el repo — no hay ninguna
plataforma de automatización externa hoy. Lo que sí existe y funciona:

- Programación recurrente: GitHub Actions `schedule:` (`observabilidad-smoke.yml`,
  `cotizacion-canary.yml`, `reporte-semanal.yml`, y ahora
  `purgar-asesor-agent-turns.yml` de ADR-0017).
- Reportes/notificaciones recurrentes: `crm-digest` (Edge Function, lectura de Twenty
  REST + email vía Resend) — patrón "Edge Function + cron" ya en producción, ya mergeado
  a `main` (rama `feat/crm-digest-email`).
- Webhooks/eventos: cada integración (Wompi, Stripe, Bold, WhatsApp Cloud API, DIAN) ya
  es una Edge Function dedicada.

## Decisión

**No introducir n8n (ni ninguna plataforma de automatización visual nueva).** Seguir
extendiendo el patrón nativo ya probado: **Edge Function (lógica) + GitHub Actions
`schedule:` (disparo) + Supabase Postgres (estado)**, exactamente como `crm-digest`,
`reporte-semanal`, `cotizacion-canary`, y `purgar-asesor-agent-turns` (ADR-0017) ya
hacen.

Para las necesidades de automatización que el growth engine sí va a necesitar (disparar
distribución de contenido a canales, recalcular intent scores, alimentar el Learning
Loop de Fase 7), el mismo patrón se extiende: nueva Edge Function por capacidad,
GitHub Actions cron o `repository_dispatch` para el disparo (mismo mecanismo que ya usa
`trigger-rebuild` para republicar el sitio al editar contenido en el CMS).

## Alternativas consideradas

- **n8n autoalojado**: descartado. Añadiría una pieza de infraestructura nueva
  (hosting, actualizaciones, backups, superficie de ataque, un segundo lugar donde vive
  lógica de negocio fuera del repo versionado) para resolver un problema que el patrón
  actual ya resuelve sin costo operativo adicional. El mandato mismo dice "no delegues
  por volumen de tokens, delega por idoneidad" — el mismo principio aplica a
  infraestructura: no se añade una plataforma nueva porque "growth" suena a que debería
  tener una, sin evidencia de que el patrón actual no alcance.
- **n8n gestionado (n8n Cloud)**: descartado por la misma razón, más un costo recurrente
  de licencia sin necesidad demostrada.
- **`pg_cron` como orquestador central**: descartado — ver ADR-0017. El propio repo ya
  trata `pg_cron` como fuera de alcance de las migraciones automatizadas (requiere una
  extensión no habilitada y secrets en Vault, documentado como paso manual). GitHub
  Actions cron ya cumple el mismo rol sin esa fricción.
- **Mantener el patrón nativo pero re-evaluar cuando exista un caso concreto de
  orquestación multi-paso con ramificación condicional compleja** (el tipo de cosa para
  la que n8n sí tiene ventaja real sobre cron + Edge Functions): no descartado a futuro,
  pero no hay ese caso todavía en Fase 1-3 del plan. Si aparece en Fase 4+ (Channel
  Adapters, distribución multi-canal con lógica condicional pesada), esta ADR puede
  revisarse con evidencia concreta del caso que lo justifique.

## Consecuencias

- Ningún cambio de código en esta ADR — es una decisión arquitectónica que confirma el
  patrón ya en uso y lo fija como el default para el resto del growth engine, en vez de
  dejarlo implícito.
- Fase 8 del mandato ("Controlled Automation") hereda esta decisión: "automatización"
  significa más Edge Functions + cron, no una plataforma nueva.
