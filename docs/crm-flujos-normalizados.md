# Flujos CRM Normalizados

## Objetivo

Todo dato comercial capturado por I-ME debe quedar en CRM normalizado para seguimiento, medicion y explotacion comercial. La tabla operativa conserva snapshot original; CRM conserva vista unica.

## Fuentes Cubiertas

| Fuente              | Entrada tecnica                                | Registro operativo       | CRM generado                                      |
| ------------------- | ---------------------------------------------- | ------------------------ | ------------------------------------------------- |
| Formulario contacto | `submitCotizacion()` -> `registrar-cotizacion` | `solicitudes_cotizacion` | cuenta, contacto, oportunidad, actividad          |
| Drawer cotizacion   | `CotizacionDrawer` -> `registrar-cotizacion`   | `solicitudes_cotizacion` | cuenta, contacto, oportunidad, actividad          |
| Compra a valorar    | carrito -> `registrar-cotizacion`              | `solicitudes_cotizacion` | cuenta, contacto, oportunidad, actividad          |
| Venta e-commerce    | carrito -> `crear-pago`                        | `pedidos`                | cliente, cuenta, contacto, oportunidad, actividad |
| Cambio pago/pedido  | webhooks/operaciones -> `pedidos.estado`       | `pedidos`                | oportunidad y actividad actualizadas              |
| Landing consultiva  | `registrar-lead-comercial`                     | `leads_comerciales`      | cuenta, contacto, oportunidad P1/P2/P3, actividad |

Landings consultivas persisten antes de abrir WhatsApp. `lead_comercial_id` y
`solicitud_cotizacion_id` mantienen la misma oportunidad durante
`lead -> cotizacion -> pedido`; no se crean oportunidades duplicadas por etapa.

## Normalizacion

| Campo               | Regla                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| Email               | `lower(trim(email))`                                                         |
| Telefono            | solo digitos, E.164 Colombia por defecto (`+57`)                             |
| Empresa/institucion | `trim`, lower key para deduplicacion                                         |
| Cliente             | upsert por email en `clientes`                                               |
| Cuenta CRM          | upsert por `normalized_name` en `crm_accounts`                               |
| Contacto CRM        | upsert por `email_norm` en `crm_contacts`                                    |
| Oportunidad         | unica por ciclo comercial; cotizacion/pedido reutilizan la nacida en el lead |
| Actividad           | unica por `source_table + source_id + event_type`                            |

## Pipeline

| Evento                                    | Etapa CRM            | Probabilidad |
| ----------------------------------------- | -------------------- | ------------ |
| Cotizacion nueva                          | `nuevo`              | 10%          |
| Primer contacto                           | `contactado`         | 20%          |
| Cotizacion en revision                    | `calificacion`       | 25%          |
| Reunion / demo                            | `reunion` / `demo`   | 40% / 45%    |
| Cotizacion respondida                     | `cotizando`          | 45%          |
| Negociacion                               | `negociacion`        | 70%          |
| Pedido pendiente                          | `checkout_pendiente` | 60%          |
| Pedido pagado/procesando/enviado          | `ganado`             | 100%         |
| Pedido entregado                          | `posventa`           | 100%         |
| Pedido rechazado/cancelado/expirado/error | `perdido`            | 0%           |

## SLA Operativo

| Actividad                 | Responsable          | Plazo                        | KPI                      |
| ------------------------- | -------------------- | ---------------------------- | ------------------------ |
| Nueva cotizacion/contacto | Ventas               | 5 minutos primer contacto    | speed-to-lead            |
| Compra a valorar          | Ventas + Operaciones | 4 horas valoracion final     | cotizaciones enviadas    |
| Pedido pendiente          | Ventas               | 2 horas rescate si no paga   | recuperacion checkout    |
| Pedido pagado             | Operaciones          | 1 dia confirmacion proveedor | tiempo a fulfillment     |
| Pedido entregado          | Postventa            | 7 dias seguimiento           | recompra, NPS, referidos |

## Explotacion Semanal

Vistas base:

```sql
SELECT etapa, count(*) oportunidades, sum(valor_estimado) pipeline
FROM crm_opportunities
GROUP BY etapa
ORDER BY etapa;

SELECT origen_primario, lifecycle_stage, count(*) contactos
FROM crm_contacts
GROUP BY origen_primario, lifecycle_stage
ORDER BY contactos DESC;

SELECT event_type, date_trunc('day', occurred_at) dia, count(*) eventos
FROM crm_activities
WHERE occurred_at >= now() - interval '14 days'
GROUP BY event_type, dia
ORDER BY dia DESC;
```

Decision semanal:

1. Leads por fuente.
2. Valor pipeline por etapa.
3. Cotizaciones sin respuesta.
4. Pedidos pendientes sin pago.
5. Clientes ganados para recompra/postventa.

## Control De Calidad

- Cero formulario sin `consentimiento_datos = true`.
- Cero cotizacion/pedido sin `crm_contact_id`.
- Cero oportunidad sin `source_table + source_id`.
- Cero formulario consultivo con mensaje de exito sin fila en `leads_comerciales`.
- Cero cotizacion atribuida que pierda `lead_comercial_id`, UTM o campaña.
- Cero venta pagada sin contacto en stage `cliente`.
- RLS: CRM solo backoffice `ventas`, `operaciones`, `admin`, `owner`.
