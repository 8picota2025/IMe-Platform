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
