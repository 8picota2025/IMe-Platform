# FASE 4 revisada — Comercio híbrido, Wompi Colombia, Stripe internacional y financiación

**Objetivo:** habilitar compra real de consumibles, cotización de equipos, financiación orientativa y handoff humano/conversacional. Colombia usa Wompi; pagos fuera de Colombia usan Stripe. Todo va detrás de `PaymentGateway`.

```txt
[PEGAR CONTEXTO MAESTRO]

PRECONDICIÓN:
F0-F3 completadas y preferiblemente Fase Asesor completada. Existen productos con tipo_comercial, landings, catálogo, capa datos, tabla pedidos, eventos_pago, admin, Edge Functions scaffolding crear-pago, webhook-wompi, webhook-stripe y submitCotizacion.

OBJETIVO F4:
Comercio híbrido: consumibles se compran con checkout hospedado; equipos se cotizan/financian. Pagos Colombia vía Wompi, internacional vía Stripe. Crear financiación orientativa con aviso legal. NO implementar consejo clínico ni inventar tasas.

REGLA RECTORA DE PAGO:
El cliente nunca decide que algo está pagado. El servidor recalcula total, crea transacción y verifica estado contra el proveedor antes de marcar pedido pagado.

==================================================================
1. MODELO COMERCIAL
==================================================================
Tipo de producto:
- consumible → carrito/checkout.
- equipo → cotización/financiación.

Mercado:
- CO → Wompi, moneda COP.
- INTL → Stripe, moneda definida por precios reales/configuración validada.

Reglas:
- Un equipo nunca ofrece pago directo.
- Un consumible sin precio real no puede comprarse; se manda a cotización y se marca TODO_CLIENTE.
- Precios deben venir de Supabase/producto, no del cliente.
- Impuestos, DIAN, IVA, retenciones y logística quedan fuera V1 salvo datos reales validados.

Routing por fulfillment_mode:
- consumible + dropship  → pago online → webhook marca pagado → notificar-proveedor automático.
- equipo + dropship      → cotización aprobada en admin → notificar-proveedor manual desde Fulfillments.
- equipo + cotizacion    → cotización sin fulfillment automático.
- equipo + individualizado → flujo personal; admin gestiona desde Fulfillments sin notificación automática.
- Mezcla en carrito: consumibles pagan, equipos van a cotización. No mezclar en un solo checkout.
- Si un item con fulfillment_mode='dropship' no tiene proveedor asignado: bloquear checkout y
  mostrar alerta al admin. El sistema no puede enviar notificación a un proveedor inexistente.

==================================================================
2. PAYMENTGATEWAY
==================================================================
Implementa en Edge Functions _shared/payment-gateway.ts:

interface PaymentGateway:
- createCheckout(orderInput): Promise<CheckoutResult>
- verifyWebhook(req): Promise<WebhookEvent>
- fetchPaymentStatus(reference): Promise<PaymentStatus>
- mapStatus(providerStatus): PedidoEstado

Implementaciones:
- WompiGateway.
- StripeGateway.

Selección:
- mercado explícito del checkout.
- país del cliente si se captura.
- moneda/producto.
- fallback seguro: si no se puede determinar, pedir cotización.

Estados internos:
- pendiente.
- pagado.
- rechazado.
- expirado.
- cancelado.
- reembolsado.
- error_verificacion.

==================================================================
3. CARRITO DE CONSUMIBLES
==================================================================
- Drawer lateral con GSAP.
- badge real en Navbar.
- añadir/quitar.
- cantidades.
- subtotales.
- total.
- moneda.
- mercado seleccionado.
- persistencia sessionStorage.
- validación stock si existe.
- vaciar carrito.
- resumen antes de pagar.

Accesibilidad:
- rol dialog.
- focus trap.
- Escape.
- aria-live para cambios.
- teclado completo.
- errores con aria-describedby.

Datos:
- guardar solo ids/slugs/cantidades en sessionStorage.
- no confiar en precio guardado.

==================================================================
4. CHECKOUT CREAR-PAGO
==================================================================
supabase/functions/crear-pago:
- requiere POST.
- recibe items: slug/id + cantidad.
- recibe cliente básico.
- recibe mercado: CO|INTL.
- recibe consentimiento de datos cuando aplique.
- valida input.
- recalcula total desde Supabase.
- verifica producto activo, tipo_comercial=consumible, precio real y stock si existe.
- selecciona Wompi o Stripe.
- crea pedido pendiente en Supabase con service_role.
- crea checkout hospedado.
- devuelve checkout_url o token.

Nunca:
- confiar en total cliente.
- almacenar tarjeta.
- exponer claves privadas.

Variables:
- WOMPI_PUBLIC_KEY.
- WOMPI_PRIVATE_KEY.
- WOMPI_EVENTS_SECRET.
- STRIPE_PUBLIC_KEY.
- STRIPE_SECRET_KEY.
- STRIPE_WEBHOOK_SECRET.

==================================================================
5. EDGE FUNCTION notificar-proveedor
==================================================================
supabase/functions/notificar-proveedor/ — núcleo del modelo dropshipping.

Contrato: { pedido_id, producto_ids[] }

Pipeline:
1. Para cada producto_id, llama a get_proveedor_para_producto(producto_id).
2. Según el canal del proveedor:
   'email'    → envía email estructurado (número de pedido, producto, cantidad,
                dirección de envío, datos del comprador). Variable: MAILER_API_KEY (TODO_CLIENTE).
   'whatsapp' → mensaje vía WhatsApp Business API o enlace wa.me precargado (TODO_CLIENTE).
   'webhook'  → POST al webhook_url del proveedor con payload del pedido.
                Reintento con backoff exponencial (3 intentos).
   'api'      → llamada al endpoint definido en api_config del proveedor.
   'manual'   → registra en fulfillments y notifica al admin por email.
3. Crea registro en fulfillments (estado='notificado').
4. Enlaza fulfillment_id al pedido.
5. Idempotente: si ya existe fulfillment para ese pedido+producto, no duplica.
6. Errores: registra en fulfillments.error_detalle, estado='error', notifica al admin.
7. No expone precio_costo en ningún canal.

Variables adicionales:
- MAILER_API_KEY (TODO_CLIENTE si canal=email)
- WHATSAPP_API_KEY (TODO_CLIENTE si canal=whatsapp)

En desarrollo sin credenciales reales: modo mock — log en admin, sin envío real.

==================================================================
6. WEBHOOKS
==================================================================
webhook-wompi:
- validar firma/integridad.
- idempotente por event_id/transacción.
- consultar estado server-side al proveedor antes de marcar pagado.
- actualizar pedido.
- registrar evento en eventos_pago.
- manejar duplicados.
- tras marcar pagado: llamar a notificar-proveedor con los items del pedido
  que tengan fulfillment_mode='dropship'. Items con cotizacion/individualizado no se notifican.

webhook-stripe:
- validar firma webhook.
- idempotente por event_id.
- recuperar PaymentIntent/Checkout Session server-side según corresponda.
- actualizar pedido.
- registrar evento.
- tras marcar pagado: igual que webhook-wompi respecto a notificar-proveedor.

Regla común:
- solo estado verificado APPROVED/succeeded equivalente marca pagado.
- errores no filtran secretos.
- reintentos seguros.

==================================================================
7. PÁGINAS RESULTADO
==================================================================
Rutas no indexables:
- /es/pago/exito
- /es/pago/pendiente
- /es/pago/fallo
- /en/payment/success
- /en/payment/pending
- /en/payment/failure

Características:
- meta noindex.
- identificar pedido por referencia/token no sensible.
- mostrar estado consultado de Supabase o mensaje seguro.
- CTA volver catálogo/contacto.
- accesibles.

==================================================================
8. COTIZACIÓN DE EQUIPOS
==================================================================
Crear colección separada del carrito:
- drawer/sección "Solicitud de cotización".
- añadir/quitar equipos.
- sessionStorage.
- formulario:
  - nombre.
  - empresa.
  - email.
  - teléfono.
  - mensaje.
  - productos.
  - consentimiento de datos placeholder hasta F5 si no está.
- submitCotizacion.
- confirmación accesible.

Desde:
- landing de equipo.
- catálogo.
- asesor si existe.
- financiación.

==================================================================
9. ADMIN PEDIDOS
==================================================================
Completar vista de F3:
- fecha.
- cliente.
- items.
- total.
- moneda.
- mercado.
- proveedor.
- estado.
- referencia.
- eventos asociados.
- leída.
- detalle.
- marcar leída.
- cambiar estado manual con advertencia.
- export CSV.

Nota:
- "enviado" es manual; logística fuera V1.

==================================================================
10. FINANCIACIÓN
==================================================================
Rutas:
- /es/financiacion
- /en/financing

Contenido:
- usar financiacion_referencia.json de F0.
- planes flexibles.
- hasta 60 meses si aparece.
- sin codeudor para instituciones de salud si aparece.
- financiamiento para clínicas/salas si aparece.
- no inventar tasas.

Simulador:
- src/data/financiacion.json.
- si no hay tasas reales, modo orientativo.
- slider monto.
- selector plazo.
- cálculo puede mostrar escenarios orientativos solo si están claramente marcados y no parecen oferta.
- opción más segura: no mostrar cuota exacta si no hay tasa real; mostrar "solicita simulación personalizada".

Aviso legal visible:
"Simulación orientativa. No constituye oferta vinculante. Las condiciones finales dependen de evaluación, documentación y validación por I-ME o aliado financiero."

PENDIENTES:
- BLOQUEANTE_LEGAL: tasas, plazos exactos, condiciones, aliado financiero, aviso legal abogado.

CTA:
- WhatsApp.
- contacto.
- cotización.

==================================================================
11. ASISTENTE WHATSAPP / HANDOFF
==================================================================
Si Fase Asesor no existe:
- botón flotante WhatsApp.
- modal categorías: Productos, Soporte técnico, Financiación, Otro.
- mensaje precargado.
- número real.
- accesible.

Si Fase Asesor existe:
- mantener WhatsApp como canal de handoff dentro del asesor.
- no duplicar dos widgets flotantes invasivos.

==================================================================
12. PERFORMANCE Y SEGURIDAD
==================================================================
- cargar lógica carrito/checkout solo donde se usa.
- no meter Stripe/Wompi SDK pesado globalmente si no hace falta.
- Edge Functions restringen CORS.
- validar input.
- rate-limit crear-pago/cotización si aplica.
- Turnstile en formularios si está disponible.
- grep cliente/dist de claves privadas = 0.

==================================================================
FUERA DE ALCANCE V1
==================================================================
Registrar en BACKLOG_V2/TODO_CLIENTE:
- Facturación electrónica DIAN.
- IVA/retenciones.
- logística/envíos.
- cálculo de envío.
- inventario avanzado.
- devoluciones/reembolsos automatizados.
- multiwarehouse.

==================================================================
PROHIBIDO EN F4
==================================================================
- Marcar pagado sin verificar proveedor server-side.
- Confiar en precio/total cliente.
- Guardar datos de tarjeta.
- Exponer WOMPI/STRIPE secretos.
- Ofrecer pago directo en equipos.
- Inventar tasas/cuotas.
- Fingir DIAN/IVA/envío.

==================================================================
ENTREGABLES F4
==================================================================
- PaymentGateway.
- WompiGateway.
- StripeGateway.
- carrito consumibles.
- crear-pago.
- webhook-wompi.
- webhook-stripe.
- notificar-proveedor.
- páginas resultado.
- cotización equipos.
- admin pedidos completo.
- financiación con simulador orientativo/CTA.
- handoff WhatsApp/asesor.
- PENDIENTES.md y BACKLOG_V2.md actualizados.

==================================================================
CRITERIOS DE ACEPTACIÓN F4
==================================================================
- Consumible CO puede pasar por Wompi sandbox si hay llaves.
- Consumible INTL puede pasar por Stripe test si hay llaves.
- Total se recalcula server-side.
- Webhooks validan firma, verifican estado e idempotencia.
- Equipo solo cotiza.
- Simulador no presenta tasas inventadas como reales.
- Secretos no aparecen en cliente/dist.
- Reporte de cierre con pruebas por proveedor o NO_EJECUTADO_ENTORNO.
```
