# Quote PDF — implementer runbook (TTHW ~15 min)

Gospel: `docs/commercial-dropshipping-plan.md`. Not `CMS_CRM.md`.
ADR: `docs/decisions/0010-quote-numero-pdf.md`.

SoT: `solicitudes_cotizacion`. Formalizar unchanged. Invoice = Siigo.

## Apply migration

```bash
cd /home/shoky/cursor/ime-platform
npx supabase db query --linked < supabase/migrations/20260814170000_quote_pdf_numero.sql
# or: npx supabase db push   # if CLI linked to the project
```

Deploy function after code change:

```bash
npx supabase functions deploy enviar-cotizacion
```

## Seed draft (SQL)

Replace email with a mailbox you control.

```sql
INSERT INTO solicitudes_cotizacion (
  nombre, empresa, email, telefono, productos, condiciones, moneda, mercado,
  consentimiento_datos, estado, locale
) VALUES (
  'QA Quote PDF',
  'Clinica Demo',
  'tu-correo@i-me.com.co',
  '3000000000',
  '[{"slug":"estetoscopio-demo","nombre":"Estetoscopio demo","cantidad":2,"precio_unitario":150000,"subtotal":300000,"moneda":"COP"}]'::jsonb,
  'Validez 15 dias. Entrega 30 dias. Precios + IVA cuando aplique.',
  'COP',
  'CO',
  true,
  'en_revision',
  'es'
)
RETURNING id, estado, numero;
```

Save `id`.

## Send (JWT ventas)

```bash
# TOKEN = supabase auth JWT of a ventas/admin user (Authorization: Bearer)
# URL  = PUBLIC_SUPABASE_URL
# ANON is not enough; functions.invoke uses the user JWT.

curl -sS -X POST "$PUBLIC_SUPABASE_URL/functions/v1/enviar-cotizacion" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"cotizacion_id\":\"$COTIZACION_ID\"}"
```

Expect `ok: true`, `numero` like `IME-Q-2026-000001`, `estado: "enviada"`.

## Fail-closed check (Resend down)

With `MAILER_API_KEY` invalid or Resend mocked 500:

```sql
SELECT estado, numero, send_error, oferta_enviada_at
FROM solicitudes_cotizacion WHERE id = '$COTIZACION_ID';
```

`estado` must **not** be `enviada`. `send_error` populated. Retry after claim window (2 min) or after `send_claimed_at` cleared.

Inactive template:

```sql
UPDATE email_templates SET activo = false WHERE clave = 'cotizacion_oferta_cliente_es';
```

Send must return `TEMPLATE_INACTIVE`. Restore `activo = true` after.

## Assert PDF

Storage bucket `cotizaciones-pdf`, object `{id}/{revision}.pdf`.
Email `referencia` = `numero`, attachment `{numero}.pdf`.

## Error codes

| code                                                            | HTTP | meaning                        |
| --------------------------------------------------------------- | ---- | ------------------------------ |
| OFERTA_SIN_LINEAS / SIN_PRECIO / SIN_CONDICIONES / MONEDA_MIXTA | 422  | complete offer                 |
| SIN_EMAIL                                                       | 422  | client email missing           |
| TEMPLATE_INACTIVE                                               | 422  | activate plantilla             |
| SEND_IN_FLIGHT                                                  | 409  | wait 2 min                     |
| NUMERO_CONFLICT                                                 | 409  | retry                          |
| EMAIL_FALLIDO                                                   | 502  | mail not accepted; not enviada |
| PDF_RENDER_FAILED                                               | 500  | renderer/upload                |

## `/comercial` workbench (Phase 2)

Nav: Catálogo · Cotizaciones · Envíos. Writes go through `comercial-cotizacion`
(allowlist). Send still `enviar-cotizacion`.

```bash
npx supabase functions deploy comercial-cotizacion enviar-cotizacion
```

`/comercial` quote UI. Twenty offer sync. Duplicate-on-revise UI. RLS isolation.

## Estado sin envío y archivo (no desplegar sin la migración)

Migración: `supabase/migrations/20261011143000_cotizacion_estado_archivo.sql`.

El guardado ignora `estado`. Para cambiarlo sin correo ni WhatsApp:

```bash
curl -sS -X POST "$PUBLIC_SUPABASE_URL/functions/v1/comercial-cotizacion?action=cambiar-estado&id=$COTIZACION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"estado":"perdida","motivo":"El cliente eligió otro proveedor"}'
```

`envio_cliente` en la respuesta es `false`. Archivar / desarchivar:
`?action=archivar` y `?action=desarchivar` con `{"motivo":"..."}`.
Listas: sin parámetro ocultan archivadas; `incluir_archivadas=1` las muestra;
`solo_archivadas=1` solo esas; `tab=cerradas` es perdida, declinada y expirada.

Probar solo en una cotización creada para la prueba. No tocar cotizaciones reales.
Cliente de caja: `tools/ime-cms/cms_api.py`. MCP: `docs/mcp-ime-comercio-cotizaciones.md`.

## IVA, moneda y totales (#272)

SoT del cálculo: `src/lib/cotizacion-iva.ts` (espejo en Edge vía import compartido en `render-quote-pdf`).

- Precedencia por línea: `tratamiento_iva` de la línea → ficha (`excluido_iva` / `tarifa_iva_pct`) → 19 % si no hay tarifa.
- `impuestos_incluidos` a nivel cotización: el precio digitado **ya** incluye IVA; no se suma dos veces.
- `roundMoney` a 2 decimales en base, IVA y total. `total` es lo que paga el cliente, no la base neta sola.
- Cotizaciones **USD**: `src/lib/cotizacion-recaudo.ts` → `aplicarNotaImportesUsd` añade la nota de moneda en condiciones (ES/EN); al volver a COP la retira.

Tests: `cotizacion-iva.test.ts`, `render-quote-pdf.test.ts`.

## Cuenta de recaudo por moneda

Catálogo fijo en `src/lib/cotizacion-recaudo.ts`:

| Moneda | Default si `cuenta_recaudo` vacío | Id |
| ------ | --------------------------------- | -- |
| COP | Bancolombia ahorros | `bancolombia_ahorros` |
| USD | Davivienda S.A. (+ SWIFT) | `davivienda_sa` |

`lineasMedioPagoCotizacion` conserva líneas históricas cuando la cuenta es el default de la moneda; si el operador elige otra cuenta, el PDF usa `lineasPagoCuenta`.

Tests: `cotizacion-recaudo.test.ts`.

## Emisor vs bloque cliente

`src/lib/contacto-cliente.ts`: correo, teléfono, NIT y razón social de I-ME **solo** en emisor / pie del PDF, nunca en el bloque del cliente ni en el correo de envío.

Helpers `esCorreoIme`, `esTelefonoIme`, `esNitIme`, `esRazonSocialIme` evitan fugas al guardar oferta desde `/comercial` o al renderizar.

## Guarda de envío (409)

Código: `supabase/functions/_shared/guarda-envio.ts`. Migración: `20261031143158_aprobacion_envio_cotizacion.sql`.

Bloquea envío formal (`enviar-cotizacion`, etc.) con HTTP **409** si:

1. Condiciones, notas o metadata contienen **NO ENVIAR** (normalización sin tildes; regex tolerante).
2. Faltan `aprobado_por` y `aprobado_at`, o la huella `aprobacion_hash` no coincide tras cambiar líneas/condiciones/total.

Aprobar solo vía RPC `aprobar_cotizacion_envio` (**service_role**): tipos `ok_shoky` o `validacion_costeo_margen` (con `margen_validado`).

| code | Significado |
| ---- | ----------- |
| `NO_ENVIAR_MARCADO` | Quitar marca con OK explícito |
| `SIN_APROBACION` | Ejecutar `aprobar_cotizacion_envio` antes de enviar |

Trigger en BD: ningún `estado = enviada` sin marca vigente (defensa en profundidad).
