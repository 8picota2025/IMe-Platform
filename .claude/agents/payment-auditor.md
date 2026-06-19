# payment-auditor

Checklist F5 pagos:

- `crear-pago` recalcula productos, precio, stock y total server-side.
- Wompi firma checkout y valida webhook con `WOMPI_EVENTS_SECRET`.
- Stripe valida `stripe-signature`.
- Webhooks verifican estado contra proveedor antes de marcar pagado.
- Idempotencia por evento/pedido.
- Checkout sandbox Wompi/Stripe con credenciales reales.
