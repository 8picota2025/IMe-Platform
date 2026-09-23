# ADR-0011: Atribución (UTM/landing/referrer/sesión) en la sincronización con Twenty CRM

- Fecha: 2026-09-22
- Estado: aceptado (interino)
- Contexto: Growth Engine, Fase 1 — Foundation (`docs/growth-engine/IMPLEMENTATION_PLAN.md`)

## Contexto

`leads_comerciales` y `solicitudes_cotizacion` ya capturan atribución completa
(`utm_source/medium/campaign/content/term`, `landing_path`, `referrer`,
`analytics_session_id`) vía `src/lib/commercial-attribution.ts`. Pero
`syncCotizacionWithTwenty` / `syncCommercialLeadWithTwenty`
(`supabase/functions/_shared/twenty-crm.ts`) sólo aceptaban `campaign`: la
atribución nunca llegaba al CRM de referencia comercial (Twenty), sólo al
warehouse interno.

La API key de Twenty en uso **no tiene `create_field_metadata`**: crear
campos custom nuevos en `opportunities`/`people` requiere que un admin humano
lo haga primero desde la consola de Twenty. Esa es una dependencia externa
que no se puede resolver desde el repo.

## Decisión

Se añade un parámetro opcional `attribution: TwentyAttribution` a
`syncCotizacionLead` (método de clase) y a los dos wrappers exportados. Se
propaga desde `registrar-cotizacion/index.ts` (ya tenía la atribución en
scope) y desde `registrar-lead-comercial/index.ts` (se añadieron las 8
columnas de atribución a `LEAD_SELECT`/`LeadRow`, que no se seleccionaban
antes).

**Fase interina (esta ADR):** la atribución se escribe como texto legible en
el cuerpo Markdown de la `Task` que ya se crea por cada lead/cotización
(`**UTM Source:** ...`, `**Landing:** ...`, etc.), junto a `**Campaña:**`.
No se crean campos custom.

**Fase estructurada (pendiente, fuera de esta ADR):** cuando el admin de
Twenty cree los campos custom correspondientes en `opportunities`, extender
`syncCotizacionLead` para además escribirlos en el payload de
`POST/PATCH /opportunities` en vez de (o además de) la nota. Requiere
confirmar los nombres de campo reales con el admin de Twenty antes de
codificar — no inventar nombres de campo.

## Alternativas consideradas

- **Esperar a que existan campos custom antes de hacer cualquier cambio**:
  descartada. La atribución llevaba meses perdiéndose por completo camino a
  Twenty; el fix de texto libre es de bajo riesgo, no rompe nada existente
  (parámetro opcional) y entrega valor inmediato a comercial sin bloquear en
  una dependencia externa que puede tardar.
- **Crear una tabla/objeto custom en Twenty vía API sin permisos**: no es
  posible con la API key actual; ni se intentó.

## Consecuencias

- Sin migración SQL (las columnas de atribución ya existían).
- `TwentyAttribution` es un tipo nuevo, exportado desde `twenty-crm.ts`.
- Cobertura: 2 tests nuevos en `twenty-crm.test.ts` (Deno), corriendo en CI
  desde este mismo bloque de trabajo (ver ADR/commit de GE-008).
- Deuda reconocida: la atribución en Twenty es texto no estructurado hasta
  la fase estructurada — no es consultable/filtrable dentro de Twenty como
  campo nativo todavía.
