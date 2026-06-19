# ADR-0002: Campos PSE — capturados por el checkout hospedado de Wompi

- Fecha: 2026-06-14
- Estado: aceptado
- Contexto: F4.1 — Escenario A y cierre de Comercio (Wompi v1.1)

## Contexto

`IME_F4_Commerce_Pasarelas_v1.1.md` (TAREA 5, líneas 242-243) describe un
formulario de checkout propio con selector de método de pago (Tarjeta · PSE ·
Nequi · Bancolombia QR · Efecty) y, si el método es PSE, campos adicionales
(tipo de persona, banco/`financial_institution_code`, tipo y número de
documento). El pseudocódigo de `crear-pago` (TAREA 4.1, líneas 184-190) asume
una llamada directa a la **API de Transacciones** de Wompi (`payment_method:
{ type: PSE, user_type, user_legal_id_type, user_legal_id,
financial_institution_code }`), que requiere capturar esos campos en nuestro
frontend.

El mismo documento, en "Notas de implementación" (líneas 404-409), indica lo
contrario: **"Wompi checkout hospedado (no widget embebido) para minimizar PCI
scope"** y que "PSE es captura inmediata". La implementación real de
`WompiGateway.crearCheckout` (`supabase/functions/_shared/payment-gateway.ts`)
ya sigue esta segunda recomendación: construye una URL de **Web Checkout**
(`https://checkout.wompi.co/p/?...` con `signature:integrity`) y redirige al
cliente a la página hospedada por Wompi.

## Decisión

Se mantiene el **Web Checkout hospedado** (ya implementado) como única
integración con Wompi. No se añaden campos PSE (tipo de persona, banco,
tipo/número de documento) al formulario de checkout propio
(`Carrito.astro`/`iniciarCheckout`), porque:

- En Web Checkout, **Wompi presenta el selector de método de pago y captura
  todos los campos específicos de PSE en su propia página hospedada** — el
  comprador elige PSE, banco, tipo de persona y documento ahí, no en
  i-me.com.co.
- Nuestro backend (`crear-pago`) solo necesita `amount-in-cents`, `currency`,
  `reference`, `signature:integrity` y datos básicos del cliente (email,
  nombre, teléfono) — ya presentes en `CheckoutRequest`.
- Esto es estrictamente mejor para PCI scope y consistente con la propia
  recomendación del v1.1 (líneas 406-409), que tiene prioridad sobre el
  pseudocódigo de TAREA 4.1 (Transactions API) cuando ambos entran en
  conflicto.

## Consecuencias

- No se requieren cambios en `payment-gateway.ts`, `crear-pago/index.ts` ni en
  el formulario de checkout para "completar campos PSE".
- Los métodos de pago disponibles (PSE, Nequi, Bancolombia Transfer, Efecty,
  tarjeta) dependen de lo habilitado en la cuenta Wompi de producción —
  ver `TODO_CLIENTE`: "Confirmar métodos de pago habilitados en la cuenta
  (PSE, Nequi, Efecty requieren activación)" en
  `IME_F4_Commerce_Pasarelas_v1.1.md`.
- Si en el futuro se requiere un checkout embebido (Widget de Wompi) en lugar
  de Web Checkout, esta decisión debe revisarse — en ese caso sí habría que
  capturar los campos PSE en el formulario propio.
