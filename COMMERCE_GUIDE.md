# COMMERCE GUIDE — I-ME

Configuración operativa de pasarelas de pago, webhooks y notificación a
proveedores. Complementa `ADMIN_GUIDE.md` (gestión de catálogo/pedidos en
`/admin`) y `docs/decisions/` (decisiones de diseño de F4/F4.1).

## Arquitectura

- `supabase/functions/_shared/payment-gateway.ts`: capa `PaymentGateway`
  swappable. `WompiGateway` (Colombia, COP) y `StripeGateway`
  (Internacional) implementan la misma interfaz (`crearCheckout`,
  `verificarPago`, `validarWebhook`).
- Checkout **hospedado** en ambos casos (Wompi Web Checkout / Stripe Checkout
  Session) — ningún dato de tarjeta toca el frontend ni las Edge Functions
  (minimiza PCI scope).
- Edge Functions: `crear-pago` (crea el pedido + checkout), `webhook-wompi` /
  `webhook-stripe` (confirman el pago), `notificar-proveedor` (avisa al
  proveedor tras pago confirmado para items `dropship`).
- Stripe/INTL está completamente implementado pero su activación real queda
  diferida a la fase internacional — ver `BACKLOG_V2.md` §Comercio.

## Secrets requeridos (Supabase Edge Functions → Secrets)

### Wompi (Colombia, COP) — TODO_CLIENTE

| Variable                         | Uso                                                                            | Dónde se obtiene                                                     |
| -------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `WOMPI_PUBLIC_KEY`               | `crearCheckout` (Web Checkout hospedado)                                       | dashboard.wompi.co → Desarrolladores                                 |
| `WOMPI_PRIVATE_KEY`              | `verificarPago` (Transactions API)                                             | idem                                                                 |
| `WOMPI_EVENTS_SECRET`            | `validarWebhook` (checksum del evento)                                         | idem → Webhooks → "Secreto de eventos"                               |
| `WOMPI_INTEGRITY_SECRET`         | firma `signature:integrity` del Web Checkout                                   | idem → "Secreto de integridad" (**distinto** de `WOMPI_PRIVATE_KEY`) |
| `WOMPI_API_BASE` (opcional)      | override de `https://api.wompi.co/v1` (sandbox: `https://sandbox.wompi.co/v1`) | —                                                                    |
| `WOMPI_CHECKOUT_BASE` (opcional) | override de `https://checkout.wompi.co/p/` (sandbox tiene su propio dominio)   | —                                                                    |

Sin `WOMPI_PUBLIC_KEY`/`WOMPI_INTEGRITY_SECRET`, `crear-pago` responde
`BLOQUEANTE_BACKEND` de forma fail-closed (no se crea ningún checkout).

### Stripe (Internacional) — TODO_CLIENTE, activación diferida

| Variable                | Uso                                                |
| ----------------------- | -------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | `crearCheckout` / `verificarPago`                  |
| `STRIPE_WEBHOOK_SECRET` | `validarWebhook` (firma header `stripe-signature`) |
| `STRIPE_PUBLIC_KEY`     | reservado para uso futuro en cliente               |

### Rate limiting `crear-pago` (F4.1) — opcional, tiene defaults

`CREAR_PAGO_RATE_LIMIT_VENTANA_SEGUNDOS` (3600) /
`CREAR_PAGO_RATE_LIMIT_MAX_VENTANA` (10) / `CREAR_PAGO_RATE_LIMIT_MAX_DIA` (30)
— 10/hora/IP, ver `docs/decisions/0001-rate-limit-crear-pago.md`. No requiere
tabla ni cron adicional: reutiliza `asesor_rate_limit` (upsert por
identificador, sin acumulación de filas).

### `notificar-proveedor`, canal `email` — TODO_CLIENTE

`MAILER_API_KEY` / `MAILER_FROM` (API estilo Resend). Sin esto, los
fulfillments con `canal='email'` quedan en estado `error` con mensaje
accionable indicando el contacto del proveedor a notificar manualmente. No
introducir Resend hasta que el volumen lo justifique (ver nota en el prompt
de fase).

### Comunes

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL` (usado para
`redirect-url` del checkout: `${SITE_URL}/es/pago/resultado?ref=...` o
`${SITE_URL}/en/payment/result?ref=...` según `locale`).

## Configuración de webhooks

### Wompi (producción/sandbox)

1. dashboard.wompi.co → Desarrolladores → Webhooks.
2. URL: `https://<proyecto>.supabase.co/functions/v1/webhook-wompi`.
3. Evento a suscribir: `transaction.updated`.
4. Copiar el **secreto de eventos** → `WOMPI_EVENTS_SECRET`.
5. Copiar el **secreto de integridad** → `WOMPI_INTEGRITY_SECRET`.

### Stripe (cuando se active la fase internacional)

1. dashboard.stripe.com → Developers → Webhooks.
2. URL: `https://<proyecto>.supabase.co/functions/v1/webhook-stripe`.
3. Evento a suscribir: `checkout.session.completed`.
4. Copiar el **signing secret** → `STRIPE_WEBHOOK_SECRET`.

## Métodos de pago Wompi a habilitar

El Web Checkout hospedado expone los métodos que la cuenta Wompi tenga
activos: Tarjeta, PSE, Nequi, Bancolombia Transfer/QR, Efecty. PSE, Nequi y
Efecty requieren activación adicional en la cuenta (ver `TODO_CLIENTE` en
`PENDIENTES.md`). Los campos específicos de PSE (tipo de persona, banco, tipo
y número de documento) los captura la página hospedada de Wompi, no el
frontend de I-ME — ver `docs/decisions/0002-pse-checkout-hospedado.md`.

## Idempotencia y verificación

- `eventos_pago` (`UNIQUE(proveedor_pago, event_id)`) ≡ `eventos_procesados`
  de la spec v1.1 — un evento de webhook duplicado se ignora (200 sin
  reprocesar).
- Cada webhook **verifica el estado real** contra la API del proveedor
  (Transactions API de Wompi / Checkout Sessions de Stripe) antes de
  actualizar `pedidos.estado` — el payload del webhook nunca se confía a
  ciegas.
- `consultar-pedido` implementa reconciliación Wompi de respaldo: si el pedido
  sigue `pendiente`, consulta el estado real contra Wompi y actualiza a
  `pagado`/`rechazado` para no depender exclusivamente del webhook en el
  retorno del usuario.
- `pedidos.estado` acepta: `pendiente|pagado|rechazado|expirado|cancelado|
reembolsado|error_verificacion|procesando|enviado|entregado|retrasado`
  (`retrasado` = Escenario A, rotura de stock post-pago — ver F4.1 en
  `PENDIENTES.md`).
- Pago confirmado (`pagado`) → se invoca `notificar-proveedor` para los items
  con `fulfillment_mode='dropship'`.

## Habeas Data

`pedidos.consentimiento_datos` / `consentimiento_timestamp` (y el equivalente
en `solicitudes_cotizacion`) ≡ `habeas_data_ok`/`habeas_data_at` de v1.1 — ver
`docs/decisions/0003-habeas-data-equivalencia.md`. El checkbox obligatorio
cita la Ley 1581/2012 y enlaza `/legal/privacidad`.

## Disponibilidad de producto (Escenario A, F4.1)

`productos.disponible` controla si un producto puede añadirse al carrito y
pasar `crear-pago`: si algún item del carrito tiene `disponible=false` al
momento de pagar, `crear-pago` responde `422 PRODUCTO_NO_DISPONIBLE_TEMPORAL`
con los `slugs` afectados, y el carrito los elimina automáticamente. Columnas
`productos.disponible` + `disponible_actualizado_at` en `schema.sql` (aplicadas
en BD real — ver `PENDIENTES.md` / `AGENTS.md`).

## Checklist de pruebas (sandbox Wompi / test Stripe)

Ver sección `NO_EJECUTADO_ENTORNO` de `PENDIENTES.md`. Resumen (de TAREA 10 de
la spec v1.1):

```
□ Pago aprobado → pedido 'pagado', proveedor notificado, email al cliente
□ Pago rechazado → pedido 'rechazado'
□ Webhook duplicado → segundo ignorado (eventos_pago)
□ Firma de webhook inválida → 401, pedido sin modificar
□ Total manipulado en cliente → servidor rechaza (recalcula server-side)
□ Item con disponible=false → crear-pago rechaza con 422
□ Sin habeas_data_ok → 422 / botón deshabilitado en cliente
□ Rate limit: 11ª petición/hora desde misma IP → 429
```

## Seguridad — verificación rápida

```
□ WOMPI_PRIVATE_KEY / WOMPI_INTEGRITY_SECRET / STRIPE_SECRET_KEY ausentes de dist/
□ precio_costo ausente de toda respuesta de API y de dist/
□ SUPABASE_SERVICE_ROLE_KEY ausente del cliente
□ /admin y páginas de pago/resultado con noindex
```

## Nota operativa Wompi

- `webhook-wompi` debe desplegarse en Supabase **sin** verificación JWT del
  gateway (`--no-verify-jwt`), porque Wompi no firma con JWT de Supabase; la
  validación correcta la hace la propia función con `WOMPI_EVENTS_SECRET`.

## Post-pago centralizado (`_shared/post-pago.ts`)

Todos los caminos que confirman un pago invocan `registrarPedidoPagado` con el
proveedor correspondiente:

| Proveedor       | Origen típico                                         |
| --------------- | ----------------------------------------------------- |
| `wompi`         | `webhook-wompi`, reconciliación en `consultar-pedido` |
| `stripe`        | `webhook-stripe`                                      |
| `bold`          | `webhook-bold`                                        |
| `transferencia` | `validar-transferencia` (admin valida comprobante)    |

Acciones comunes (best-effort; no bloquean el webhook):

1. Actualiza totales del cliente (`total_pedidos`, `total_gastado`).
2. Inserta evento en `pedido_eventos` (`pago_confirmado` o `transferencia_validada`).
3. Si `facturacion_electronica_solicitada=true` → marca `pendiente_envio` e invoca
   `emitir-factura-dian` con `force_live: true`.
4. Emails internos + `notificar-cliente` al cliente.
5. Marca carritos abandonados como `convertido`.
6. Sync CRM Twenty vía `pushPagoToTwenty` (ver `docs/twenty-integration.md`).
7. `notificarFulfillmentDropship` → `notificar-proveedor` para items `dropship`.

## Cotizaciones: oferta → formalizar → pago

Flujo para equipos cotizados fuera del checkout de consumibles. Detalle operativo
en `/admin` en `ADMIN_GUIDE.md`.

```
Solicitud web → Admin arma oferta → enviar-cotizacion (email + adjuntos)
  → Cliente abre /es/cotizacion/formalizar (token firmado)
       ├─ Transferencia: formalizar-cotizacion → pedido pendiente_validacion
       │     → admin valida/rechaza comprobante
       └─ Wompi: convertir-cotizacion-pedido (admin) o pago online en formalizar
```

### Edge Functions

| Función                       | Auth                                                | Rol                                                                                             |
| ----------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `enviar-cotizacion`           | JWT admin (`ventas+`)                               | Persiste oferta, genera token, envía email con link formalizar y adjuntos                       |
| `formalizar-cotizacion`       | Token en query + rate-limit                         | `preview`: resumen + datos bancarios; `registrar_transferencia`: crea pedido + sube comprobante |
| `convertir-cotizacion-pedido` | JWT admin (`ventas+`)                               | Crea pedido con precios bloqueados de la oferta + URL checkout Wompi                            |
| `validar-transferencia`       | JWT admin (`ventas\|operaciones+`)                  | `pendiente_validacion` → `pagado` + post-pago                                                   |
| `rechazar-comprobante`        | JWT admin (`ventas+`)                               | Pedido `rechazado`, reabre cotización con nuevo token, email al cliente                         |
| `consultar-nit-dian`          | JWT admin (`ventas\|operaciones+`) o `service_role` | Verifica NIT/DV e importa razón social desde proveedor DIAN o Siigo                             |

Código compartido de oferta: `src/lib/cotizacion-oferta.ts` (líneas, token SHA-256,
expiración, rutas `/es/cotizacion/formalizar` y `/en/quote/formalize`).

### Oferta comercial ampliada (datos fiscales y adjuntos)

Desde el panel admin, la oferta persiste en `solicitudes_cotizacion`:

| Campo                   | Uso                                                                |
| ----------------------- | ------------------------------------------------------------------ |
| `nit`                   | Identificación fiscal del contacto (texto libre en oferta)         |
| `responsable_iva`       | Si el comprador es responsable de IVA                              |
| `impuestos_incluidos`   | **Obligatorio** para factura electrónica en formalizar (ver abajo) |
| `direccion_envio`       | Dirección postal de entrega                                        |
| `direccion_facturacion` | Dirección de facturación                                           |
| `adjuntos`              | JSON con metadatos de archivos en bucket `cotizaciones-adjuntos`   |

**Adjuntos:** el admin sube PDF/Office/imagen (máx. 25 MB total). Al pulsar
**Enviar al cliente**, `enviar-cotizacion` descarga los archivos del bucket
privado y los adjunta al correo. Errores: `ADJUNTOS_INVALIDOS` si falta un
archivo o se supera el límite.

**Tratamiento tributario (`impuestos_incluidos`):** migración
`20260806011152_quote_tax_included_invoice_guard.sql`. Si el cliente marca
factura electrónica en formalizar y la oferta **no** tiene
`impuestos_incluidos=true`, `formalizar-cotizacion` responde
`422 TRATAMIENTO_TRIBUTARIO_OFERTA_REQUERIDO`. Ofertas históricas con
`impuestos_incluidos=NULL` quedan bloqueadas para FE hasta que ventas revise y
marque explícitamente el checkbox en admin.

En formalizar, el cliente puede opcionalmente solicitar factura DIAN (solo
`mercado=CO` y moneda `COP`). La página valida NIT localmente con
`verificarNitCampo` (`src/lib/nit-dian.ts`, espejo de
`_shared/nit-verificacion.ts`) antes de enviar el body `fiscal` a
`formalizar-cotizacion`.

### Pago por transferencia bancaria

Datos bancarios I-ME (`_shared/transferencia-bancaria.ts`), configurables vía secrets
de Edge Function (también en `.env.example` para referencia local):

| Variable                      | Default / notas                                     |
| ----------------------------- | --------------------------------------------------- |
| `TRANSFERENCIA_BANCO`         | `Bancolombia`                                       |
| `TRANSFERENCIA_TITULAR`       | I-ME International Medical Enterprise S.A.S.        |
| `TRANSFERENCIA_NIT`           | **TODO_CLIENTE** — obligatorio en producción        |
| `TRANSFERENCIA_TIPO_CUENTA`   | `Ahorros`                                           |
| `TRANSFERENCIA_NUMERO`        | **TODO_CLIENTE**                                    |
| `TRANSFERENCIA_SWIFT`         | Opcional; se muestra en oferta/formalizar si existe |
| `TRANSFERENCIA_INSTRUCCIONES` | Texto libre al pie de los datos bancarios           |

El cliente sube comprobante (JPEG/PNG/WebP/PDF, máx. 5 MB) al formalizar.
Archivo en bucket privado `comprobantes-pago`; el admin lo abre desde el detalle
del pedido. Estado del pedido: `pendiente_validacion` hasta validación manual.

**Restricción:** solo ventas/operaciones pueden validar; el cliente nunca marca
el pago como aprobado.

### Moneda COP/USD

La oferta admite `moneda` `COP` o `USD` desde el panel admin. `mercado` se deriva
(`CO` / `INTL`). La facturación electrónica DIAN aplica solo a perfil fiscal
colombiano en formalizar (`fiscal` en body de `formalizar-cotizacion`).

## Consulta NIT e importación DIAN (`consultar-nit-dian`)

Usada desde `/admin` en detalle de **cliente** y **pedido** (botones
**Verificar NIT** e **Importar datos DIAN**). No expone credenciales al
navegador: el admin invoca la Edge Function con JWT.

Flujo (`_shared/dian-nit-lookup.ts`):

1. `verificarNitCampo` — formato y dígito de verificación (NIT 9–10 dígitos).
2. Lookup externo según `DIAN_PROVIDER_NAME` (`verifik`, `coresoft`, `generic`).
3. Fallback/enriquecimiento vía Siigo si el tercero ya existe en la cuenta.

| Variable                  | Uso                                                          |
| ------------------------- | ------------------------------------------------------------ |
| `DIAN_PROVIDER_NAME`      | `verifik` \| `coresoft` \| `generic` (vacío = solo DV local) |
| `DIAN_PROVIDER_API_URL`   | URL del proveedor (ej. Verifik DIAN company)                 |
| `DIAN_PROVIDER_API_TOKEN` | Bearer token del proveedor                                   |
| `DIAN_PROVIDER_METHOD`    | Opcional: `GET` (default Verifik) o `POST`                   |

Respuesta JSON: `{ ok, verificacion, contribuyente, fuentes_intentadas, mensaje }`.
HTTP 422 si la verificación local falla; 200 con `contribuyente=null` si no hay
match en proveedores externos.

**Separación de concerns:** `DIAN_PROVIDER_*` es solo **consulta** de razón
social. La **emisión** de facturas usa `SIIGO_*` (sección siguiente).

## Facturación electrónica DIAN vía Siigo

Integración real (no el adaptador genérico `DIAN_PROVIDER_*` legacy para emisión).
Diseño detallado en
`docs/superpowers/specs/2026-07-07-facturacion-electronica-siigo-design.md`.

### Disparo automático

Tras `registrarPedidoPagado`, si el pedido tiene
`facturacion_electronica_solicitada=true`, se invoca `emitir-factura-dian` con
`service_role`. Persistencia en `facturas_electronicas` (una fila por pedido).

Estados en `pedidos.facturacion_electronica_estado`:

`no_solicitada` → `pendiente_envio` → `emitida` | `rechazada` | `error`

### Secrets Siigo (Edge Functions)

| Variable                 | Uso                                                              |
| ------------------------ | ---------------------------------------------------------------- |
| `SIIGO_USERNAME`         | Autenticación API Siigo                                          |
| `SIIGO_ACCESS_KEY`       | idem                                                             |
| `SIIGO_PARTNER_ID`       | Header `Partner-Id` requerido por Siigo                          |
| `SIIGO_DOCUMENT_TYPE_ID` | Tipo documento factura en la cuenta Siigo del cliente            |
| `SIIGO_SELLER_ID`        | Vendedor por defecto                                             |
| `SIIGO_PAYMENT_TYPE_ID`  | Medio de pago por defecto                                        |
| `SIIGO_ACCOUNT_GROUP_ID` | Grupo contable de productos nuevos auto-creados                  |
| `SIIGO_TAX_MAP`          | JSON `{ "19": <tax_id>, "5": <tax_id>, ... }` — IDs IVA en Siigo |
| `SIIGO_TIMEOUT_MS`       | Opcional (default 20000)                                         |
| `DIAN_TEST_MAX_COP`      | Tope COP para emisión live sin `force_live` (default 5000)       |

Sin credenciales Siigo válidas, `emitir-factura-dian` falla de forma controlada
y deja traza en `facturas_electronicas.error`.

### Resolución en Siigo (`siigo-client.ts`)

1. Autentica y obtiene token.
2. `resolverCliente`: busca por identificación o crea cliente en Siigo.
3. Por cada línea: `resolverProducto` — busca por código o crea producto en
   Siigo (requiere mapeo IVA en `SIIGO_TAX_MAP`).
4. `mapDianDraftToSiigoInvoice` (`siigo-mapper.ts`) + `POST /v1/invoices`.
5. Normaliza `stamp.status` Siigo: `accepted|draft|pending|sending` → `emitida`;
   `rejected` → `rechazada`.

Cálculo fiscal server-side: `src/lib/fiscal.ts` (`calculateFiscalSummary`,
`buildDianInvoiceDraft`, `validateClienteFiscal`).

### Invocación manual / pruebas

```bash
# Dry-run: autentica y mapea payload, NO crea factura
curl -X POST "$SUPABASE_URL/functions/v1/emitir-factura-dian" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pedido_id":"<uuid>","dry_run":true}'

# Live (respeta DIAN_TEST_MAX_COP salvo force_live)
curl -X POST ... -d '{"pedido_id":"<uuid>","force_live":true}'
```

Auth: `service_role` o JWT admin. Acepta JWT legacy `service_role` cuando el
secret inyectado usa formato `sb_secret_*`.

Desde `/admin`: panel **Facturas** (`#/facturas`) y botón **Reemitir DIAN** en
detalle de pedido/factura invocan la misma función con `force_live: true` tras
corregir NIT o datos fiscales.

### Anulación (`anular-factura-dian`)

Emite nota de crédito Siigo (motivo DIAN 2 = anulación). Auth: `owner|admin` o
`service_role`. Body: `pedido_id`, opcional `observaciones`, `dry_run`, `stamp`
(default `true` — envía a DIAN). Actualiza `facturas_electronicas.estado` a
`anulada`.

No hay botón en `/admin` para anular; invocar vía Edge Function o script operativo.

### Sync CRM

`pushFacturaToTwenty` tras emisión exitosa — ver hooks en
`docs/twenty-integration.md`.
