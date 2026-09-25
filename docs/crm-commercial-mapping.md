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
verdad) → Twenty (espejo).

**Regla (decisión del usuario, 2026-09-25): la Opportunity nace con la cotización.** Los
leads de herramientas (`campaign = 'herramienta'`) y de descargas de fichas técnicas
(`pdf_descarga`, desde `20260926000000_fichas_sin_oportunidad.sql`) son contactos por explorar: en Twenty,
Person + Company + nota con atribución, **sin Opportunity ni tarea**; en el warehouse,
cuenta + contacto + actividad, **sin `crm_opportunities`** (migración
`20260925220000_lead_magnet_sin_oportunidad.sql`). Si luego piden cotización, la cotización
crea la oportunidad (`crm_link_cotizacion_to_lead` admite lead sin oportunidad). La lista de
campañas lead magnet vive en `esCampanaLeadMagnet()` (`_shared/twenty-crm.ts`) y en la
función SQL: cambiar las dos a la vez.

| Campo                       | Checklist de recepción (herramienta)                                        | Landing proyectos UCI                                                                                  |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `campaign`                  | `herramienta`                                                               | `dotacion_monitoreo_uci`                                                                               |
| `tipo_proyecto`             | `checklist-recepcion-monitor` (id de la herramienta)                        | opción del formulario: `uci_nueva`, `ampliacion_camas`, `uci_pediatrica_neonatal`, `central_multicama` |
| `horizonte` → `prioridad`   | siempre `exploracion` → P3                                                  | lo elige el usuario: `0-3` → P1, `4-12` → P2, `exploracion` → P3                                       |
| `landing_path`, UTM, sesión | sí                                                                          | sí                                                                                                     |
| Twenty                      | Person (cargo `Lead magnet · checklist-recepcion-monitor`) + Company + nota | Person + Company + Opportunity `NEW` + tarea SLA + nota con atribución                                 |
| Warehouse                   | cuenta + contacto + actividad                                               | cuenta + contacto + oportunidad + actividad                                                            |

**Lista en Twenty — «Lead magnet — por explorar»** (se crea una vez en la interfaz; la API
no gestiona vistas): People → Filter → Job Title → contains `Lead magnet` → Save as new view.
Sirve para explorarlos y para contarlos. El cargo no se pisa si el contacto ya existía (por
ejemplo, un lead de evento): esos no aparecen en la vista, pero su nota sí registra la descarga.
Cuando existan los campos custom de ADR-0011, filtrar por un campo en vez de por el cargo.

**Cuantificación:** admin → Marketing → «Piloto Monitoreo/UCI · 30 días»
(`src/lib/piloto-monitoreo.ts`), desde `leads_comerciales`, que conserva todos los leads.

Descargas de fichas (`pdf_descarga`): mismo trato, con cargo único `Lead magnet · ficha-tecnica`
para todas (el producto, `tipo_slug`, va en la nota) y así caen en la misma vista.
