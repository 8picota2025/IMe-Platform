# ADR-0017: Redacción de PII y retención en `asesor_agent_turns`

- Fecha: 2026-09-22
- Estado: aceptado
- Contexto: Growth Engine, Fase 1 — Foundation (`docs/growth-engine/IMPLEMENTATION_PLAN.md`)

## Contexto

`crearTurnoAgente()` en `supabase/functions/asesor/index.ts` persistía el mensaje del
usuario, el historial completo de la conversación y el contexto de navegación
**verbatim** en `asesor_agent_turns`, y `despertarAgente()` reenviaba el mismo payload a
un endpoint de agente externo de terceros (webhook IMEIA). No había redacción de PII (a
diferencia de `track-analytics`, que sí tiene un denylist `PII_KEYS`), ni TTL, ni
retención configurada, ni job de borrado. Conversaciones de compra hospitalaria pueden
contener nombres, institución y datos de contacto. Este era el hallazgo de mayor
"blast radius" identificado en el discovery de compliance de Fase 0.

## Decisión

Dos mecanismos independientes, no uno solo:

### 1. Redacción de patrones de alta confianza (`_shared/pii-redact.ts`)

Regex para email y teléfono, aplicados una sola vez sobre
`mensaje`/`historial` **antes** de que ese valor llegue tanto a `crearTurnoAgente()` como
a `despertarAgente()` (mismo dato, una sola redacción, en el único punto donde ambas
llamadas comparten `mensaje`/`historial` en `asesor/index.ts`).

El patrón de teléfono es deliberadamente estrecho: móvil CO (`3XX XXX XXXX`), fijo CO
(`60X XXX XXXX`), ambos con `+57` opcional, e internacional sólo con `+` explícito. La
primera versión usaba un patrón genérico de 7-15 dígitos que redactaba también precios
(`1.500.000`), NITs, fechas y referencias de producto — y como el texto redactado es lo
que recibe el agente IMEIA, eso degradaba sus respuestas comerciales. Corregido en la
revisión posterior al cierre de Fase 1, con tests de no-regresión para esos casos.

**Deliberadamente NO se redactan nombres propios.** Un detector de nombres por regex es
poco confiable (falsos negativos silenciosos) — prometer redacción de nombres sin poder
garantizarla sería peor que no prometerla. El dato de contacto real para seguimiento
comercial (nombre, teléfono, email con consentimiento) ya viaja por un canal separado y
consentido (`registrar-lead-comercial`, `consentimiento_datos`) — este chat log no es la
fuente de verdad para eso, así que redactarlo aquí no reduce capacidad de captación de
leads.

### 2. Retención con purga programada (`purgar-asesor-agent-turns` + `asesor-retention.ts`)

Nueva Edge Function `purgar-asesor-agent-turns`, service_role only (mismo patrón de auth
que `reporte-semanal`), que borra turnos con `created_at` más viejo que
`ASESOR_RETENTION_DIAS` (default 90, configurable). Programada vía GitHub Actions
(`.github/workflows/purgar-asesor-agent-turns.yml`, diario 03:17 UTC), **reutilizando el
secret `SUPABASE_SERVICE_ROLE_KEY` ya existente** — sin credenciales nuevas, cumple la
regla de autonomía del mandato (§28: "no requieren credenciales nuevas").

Índice nuevo `idx_asesor_agent_turns_created_at` (los índices existentes son compuestos
con `status`/`session_id`, no sirven para un `DELETE ... WHERE created_at < cutoff`
plano).

## Alternativas consideradas

- **Redactar también en tránsito hacia el DB pero no hacia el webhook externo (o
  viceversa)**: descartado — ambos destinos reciben la misma exposición de riesgo
  (persistencia indefinida vs. reenvío a terceros), no hay razón para proteger uno y no
  el otro.
- **NER/detección de nombres con un modelo**: descartado para esta iteración — añadiría
  una llamada a otro proveedor de IA sólo para redactar (coste, latencia, nueva
  dependencia) para un beneficio incierto dado que el chat no es la fuente de verdad de
  contacto. Podría reconsiderarse si en el futuro el asesor empieza a manejar más
  contexto de identificación.
- **Sólo retención, sin redacción de email/teléfono**: descartado — un email/teléfono
  con regex confiable es una mejora barata y de bajo riesgo de falso negativo; no
  aprovecharlo cuando ya existe la infraestructura (mismo punto de llamada) habría sido
  dejar valor barato sobre la mesa.
- **`pg_cron` en vez de GitHub Actions cron**: descartado — el propio repo ya trata
  `pg_cron` como paso manual fuera de las migraciones (ver comentario en `schema.sql`
  sobre `recordatorio-carritos`: requiere una extensión no habilitada por ninguna
  migración y un secret en Vault). El patrón "Edge Function + GitHub Actions cron" ya es
  el que usa `reporte-semanal`/`cotizacion-canary` — más testeable, más consistente, y es
  además la recomendación de ADR-0018 (no introducir infraestructura de automatización
  nueva).

## Consecuencias

- Cobertura: 12 tests Deno nuevos (`pii-redact.test.ts` 8, `asesor-retention.test.ts` 4),
  corriendo en CI desde este mismo commit (añadidos al step ya wireado en GE-008).
  `asesor/index.ts` verificado con `deno check` (0 errores) tras el cambio; sin test
  directo de integración del Edge Function completo (no existe ningún test Deno para
  ningún `index.ts` en el repo — es el patrón establecido, sólo `_shared/*.ts` se testea
  directamente, porque `index.ts` llama `Deno.serve` a nivel de módulo).
- Impacto en las respuestas del asesor: el agente IMEIA recibe el texto redactado, así
  que no ve emails ni teléfonos que el usuario escriba en el chat (no puede repetirlos ni
  usarlos). Precios, cantidades, NITs, fechas y referencias sí llegan intactos gracias
  al patrón estrecho descrito arriba. Contrapartida: un teléfono en formato no cubierto
  (p. ej. internacional sin `+`) no se redacta — falso negativo aceptado.
- Deuda reconocida: el default de 90 días de retención es una elección conservadora
  razonable, no un número validado legal/jurídicamente — queda documentado como tal para
  que negocio/legal lo confirme o ajuste (cambio de una línea de env var, no de código).
