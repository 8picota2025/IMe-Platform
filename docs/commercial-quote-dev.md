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

## Contenido del PDF (renderer)

Código: `src/lib/render-quote-pdf.ts` (Edge: `supabase/functions/_shared/render-quote-pdf.ts`).
Snapshot único para email + Storage. El total que se persiste en `precio_total_ofertado` es el
**total a pagar** del desglose fiscal, no solo `Σ precio × cantidad` cuando hay IVA distinto por línea.

### IVA por línea

Lógica: `src/lib/cotizacion-iva.ts`; en Edge `desgloseDeLineas` (`supabase/functions/_shared/cotizacion-pago.ts`).

| Precedencia | Campo | Efecto |
| ----------- | ----- | ------ |
| 1 | `tratamiento_iva` en la línea (`19`, `5`, `excluido`, `exento`) | Gana sobre catálogo |
| 2 | `productos.tarifa_iva_pct` / `excluido_iva` | Tarifa de ficha |
| 3 | (vacío) | 19 % en COP; USD fuerza `excluido` |

`impuestos_incluidos = true` en la cotización: el precio unitario digitado **ya incluye** IVA; el PDF
muestra subtotal neto + IVA desglosado sin sumar impuesto encima del total ofertado. Obligatorio para
factura electrónica en formalizar (`TRATAMIENTO_TRIBUTARIO_OFERTA_REQUERIDO` si falta).

UI: selector IVA por línea en `/comercial` y en admin cotizaciones. Tests:
`src/lib/cotizacion-iva.test.ts`, casos IVA en `src/lib/render-quote-pdf.test.ts`.

### Oferta bilingüe (ES / EN)

- `locale` (`es` \| `en`) y `idioma` (`es`, `en`, `es-en`) en `solicitudes_cotizacion`.
- `condiciones_en` y `condicion_pago_en` opcionales; si faltan, el bloque EN repite el castellano.
- Etiquetas de tabla y totales usan pares ES/EN (`et()` en el renderer).
- Condiciones de pago en la columna derecha: títulos bilingües con salto de línea (no truncar).

Migraciones/columnas: `condiciones_en`, `idioma`, `ciudad`, `pais` (ver parches en
`comercial-cotizacion` / admin si el schema aún no las tiene).

### Contacto cliente vs I-ME

`src/lib/contacto-cliente.ts`: correos `@i-me.com.co`, NIT 901871720 y teléfonos oficiales (+57 313…)
**nunca** rellenan huecos del bloque cliente, email de envío ni aceptación. Si falta dato del cliente →
`—`, no datos de I-ME. El pie y la firma del asesor sí muestran contacto comercial.

### Anexos de ficha

`src/lib/quote-pdf-annex.ts`: una página de anexo por línea de catálogo solo si hay descripción larga
útil (distinta del nombre) **o** especificaciones/aplicaciones. Nombre solo o ficha vacía → sin anexo.
Tests: `src/lib/quote-pdf-annex.test.ts`. Tabla multipágina: `docs/qa/quote-pdf-multipage/README.md`.

### Wompi en PDF y email

Regla de referencia: la `reference` de Wompi debe ser **`pedidos.id`** (`referencia_pasarela`), nunca
`IME-Q-…` (`cotizacion-pago.ts`, `webhook-wompi`).

| Momento | Enlace en PDF / correo |
| ------- | ---------------------- |
| `dry_run` / vista previa (`comercial-cotizacion?action=pdf`) | Sin checkout Wompi (`wompiUrl: null`); CTA formalizar opcional |
| Envío real (`enviar-cotizacion`) | «Pagar con Wompi» apunta a **`formalizarUrl`** (token), no a checkout firmado |
| Cliente en formalizar → `iniciar_pago_wompi` | Crea o reutiliza pedido pendiente + URL checkout con `pedidos.id` |

El email incluye botón Wompi vía `htmlBotonWompiViaFormalizar` (misma URL de formalización en COP).
Metadata: `wompi_formalizar_url`, no `wompi_checkout_url` hasta que exista pedido.

Recuperación legacy: si un cobro llegó con referencia `IME-Q-…`, `webhook-wompi` puede materializar
pedido desde la cotización (`cotizacion-pedido-wompi.ts`). Flujo nuevo no debe generar esas referencias.

Ver también: `COMMERCE_GUIDE.md` (referencia pasarela) y `formalizar-cotizacion` (`iniciar_pago_wompi`).
