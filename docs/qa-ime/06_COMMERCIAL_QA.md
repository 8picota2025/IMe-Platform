# QA comercial

Código identificado: leads, cotización, carrito, checkout, ofertas, impuestos,
fulfillment, facturación DIAN, notificaciones, CRM Twenty y seguimiento.

Flujo esperado:

```text
formulario → validación → Edge Function → Supabase → email/CRM → seguimiento
```

Tests locales cubren lógica de leads, cotización y pagos. El usuario confirma que
pagos y Auth fueron probados. Emails tienen pruebas parciales; CRM, webhooks y
persistencia comercial completa siguen pendientes de evidencia.

| Flujo                       | Estado                                    | Riesgo                           |
| --------------------------- | ----------------------------------------- | -------------------------------- |
| Lead persistido y atribuido | local/test                                | Alto: verificar remoto           |
| Cotización y PDF            | local/test                                | Alto: sandbox pendiente          |
| Wompi/Stripe                | probado según usuario; alcance no adjunto | Confirmar cobertura              |
| Fulfillment proveedor       | no ejecutado                              | Alto                             |
| Email/retry                 | parcial                                   | Alto: pérdida silenciosa posible |

Usar buzón sandbox, productos fixture y cuentas de prueba antes de cualquier canary.
