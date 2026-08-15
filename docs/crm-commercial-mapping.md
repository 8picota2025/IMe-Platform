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
