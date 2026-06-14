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
`redirect-url` del checkout: `${SITE_URL}/es/pago/exito?ref=...`).

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
con los `slugs` afectados, y el carrito los elimina automáticamente. Migración
SQL (`productos.disponible` + `disponible_actualizado_at`) pendiente de
aplicar en la base de datos real — ver `PENDIENTES.md`.

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
