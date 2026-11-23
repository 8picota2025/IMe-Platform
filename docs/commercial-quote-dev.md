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

| code                                                            | HTTP | meaning                                |
| --------------------------------------------------------------- | ---- | -------------------------------------- |
| OFERTA_SIN_LINEAS / SIN_PRECIO / SIN_CONDICIONES / MONEDA_MIXTA | 422  | complete offer                         |
| SIN_EMAIL                                                       | 422  | client email missing                   |
| TEMPLATE_INACTIVE                                               | 422  | activate plantilla                     |
| SEND_IN_FLIGHT                                                  | 409  | wait 2 min                             |
| NUMERO_CONFLICT                                                 | 409  | retry                                  |
| EMAIL_FALLIDO                                                   | 502  | mail not accepted; not enviada         |
| PDF_RENDER_FAILED                                               | 500  | renderer/upload                        |
| NO_ENVIAR_MARCADO                                               | 409  | texto «NO ENVIAR» en condiciones/notas |
| CUENTA_RECAUDO_INVALIDA                                         | 422  | `cuenta_recaudo` fuera del catálogo    |

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

## Guarda de envío (2026-11-20)

Lógica compartida: `supabase/functions/_shared/guarda-envio.ts` (tests en `src/lib/guarda-envio.test.ts`).

| Regla                                              | Comportamiento                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marca **NO ENVIAR**                                | Bloquea envío de oferta (`enviar-cotizacion`), formalización, notificación al cliente y compartir catálogo si `condiciones`, `condiciones_en`, `notas_internas`, `notas` o `metadata.nota_envio` / `metadata.notas` contienen la frase (sin importar tildes, guiones o puntos intermedios). Código `NO_ENVIAR_MARCADO` (HTTP 409 en Edge; trigger Postgres `P0409` al pasar a `estado = enviada`). |
| Aprobación previa (`aprobado_por` / `aprobado_at`) | **Ya no bloquea** el envío. Migración `20261120190303_quitar_bloqueo_aprobacion_envio_cotizacion.sql`. Las columnas y la RPC `aprobar_cotizacion_envio` siguen en BD para auditoría opcional; no devuelve `SIN_APROBACION`.                                                                                                                                                                        |
| MCP `preparar_envio_cotizacion`                    | Sigue exigiendo aprobación **owner/admin en el CMS** (flujo de confirmación de 4 h). Es independiente de `aprobado_por` en la fila. Ver `docs/mcp-ime-comercio-cotizaciones.md`.                                                                                                                                                                                                                   |

Consumidores de la guarda:

- `verificarEnvioPermitido` → `enviar-cotizacion`
- `verificarNoEnviar` → `formalizar-cotizacion`, `notificar-cliente`, `comercial-share` (`contieneNoEnviar` en texto del envío)

## Moneda USD, recaudo y emisor en PDF

Fuente: `src/lib/cotizacion-recaudo.ts`, render `supabase/functions/_shared/render-quote-pdf.ts`.

- Sin `cuenta_recaudo` explícita: **COP** → Bancolombia ahorros (`bancolombia_ahorros`); **USD** → Davivienda (`davivienda_sa`, SWIFT `CAFECOBBXXX`).
- Al guardar o enviar con `moneda = USD`, `aplicarNotaImportesUsd` añade la nota legal de importes en USD a `condiciones` (ES/EN).
- El bloque **EMISOR** del PDF es siempre I-ME (razón social, NIT, teléfono, correo, web, dirección Medellín); el asesor comercial va aparte, no sustituye al emisor.
- Web Checkout en el PDF solo se firma en COP; cotizaciones USD no llevan enlace de pago en línea en el anexo.

Validar cuenta en envío/patch:

```bash
# cuenta_recaudo opcional en body de enviar-cotizacion / comercial-cotizacion
# Valores: bancolombia_ahorros | davivienda_sa | null (default por moneda)
```
