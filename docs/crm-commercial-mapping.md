# CRM commercial mapping

## Authority

| Object               | SoT                                            | Mirror                                                 |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Quote                | `solicitudes_cotizacion`                       | Twenty Opportunity (`twenty_opportunity_id`)           |
| Web lead (pre-quote) | `solicitudes_cotizacion` + `leads_comerciales` | `syncCotizacionWithTwenty` **lead-shaped** (unchanged) |
| Share catalog        | `commercial_shares`                            | Twenty **Note only** — never Opportunity               |
| Pipeline UI          | Twenty                                         | `crm_opportunities` warehouse                          |
| Order                | `pedidos`                                      | Twenty pago                                            |

## IDs

- Local warehouse: `crm_opportunity_id`
- Twenty: `twenty_opportunity_id` on quote row
- Do not conflate the two

## Quote oferta sync

`syncCotizacionOfertaWithTwenty` (Validar → CRM en CMS comercial):

- Person + Company upsert (email/tel + empresa)
- Opportunity stage `PROPOSAL` con total/moneda/validez
- Si `twenty_opportunity_id` set → PATCH, never duplicate POST
- Nota con Nº, líneas (qty×precio), condiciones, canal envío, formalizar URL, validador
- Share catalog sigue siendo **Note only** — never Opportunity

Lead web sigue en `syncCotizacionWithTwenty` (sin cambiar firma).

## Dedup people/companies

Existing: email then phone; company exact name. Do not use person name as unique key.

## Config

`TWENTY_BASE_URL=https://crm.i-me.com.co` (not crm.i-me.clm.co)

## Piloto Monitoreo/UCI (Growth Engine, mandato §24)

Dos entradas nuevas, ambas por `registrar-lead-comercial` → `leads_comerciales` (fuente de
verdad) → `syncCommercialLeadWithTwenty` (espejo). Comportamiento actual, sin código nuevo:

| Campo                       | Checklist de recepción (herramienta)                                                                 | Landing proyectos UCI                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `campaign`                  | `herramienta`                                                                                        | `dotacion_monitoreo_uci`                                                                               |
| `tipo_proyecto`             | `checklist-recepcion-monitor` (id de la herramienta)                                                 | opción del formulario: `uci_nueva`, `ampliacion_camas`, `uci_pediatrica_neonatal`, `central_multicama` |
| `familia_slug`              | `monitores`                                                                                          | `monitores`                                                                                            |
| `horizonte` → `prioridad`   | siempre `exploracion` → **P3**                                                                       | lo elige el usuario: `0-3` → P1, `4-12` → P2, `exploracion` → P3                                       |
| `landing_path`, UTM, sesión | sí (`captureCommercialAttribution`)                                                                  | sí                                                                                                     |
| Twenty                      | Person + Company + **Opportunity `NEW`** + nota con atribución; origen `lead_consultivo:herramienta` | igual, origen `lead_consultivo:dotacion_monitoreo_uci`                                                 |

Informe: admin → Marketing → «Piloto Monitoreo/UCI · 30 días» (`src/lib/piloto-monitoreo.ts`).

**Decisión abierta:** cada descarga del checklist crea una Opportunity `NEW`, igual que las
descargas de fichas (`pdf_descarga`). Es intención temprana, no una oportunidad: con volumen
ensuciará el pipeline. Alternativa: para `herramienta`, sólo Person + nota + tarea de
seguimiento, y Opportunity cuando el lead pida cotización. Pendiente de decisión comercial
(encaja con el scoring de la Fase 5).
