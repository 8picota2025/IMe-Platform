# BACKLOG V2 — Fuera de alcance V1

Funcionalidades identificadas pero explícitamente excluidas del alcance inicial.

## Comercio

- Stripe / mercado INTL: `StripeGateway` (`payment-gateway.ts`) está completamente
  implementado desde F4 (checkout, verificación, webhook), pero su activación real
  (credenciales `STRIPE_*`, pruebas sandbox) queda diferida a la fase internacional —
  ver `NO_EJECUTADO_ENTORNO` en PENDIENTES.md. No es deuda técnica, es alcance
  geográfico diferido.
- Portal de proveedor para gestionar `productos.disponible` (Escenario A, F4.1) — hoy
  el flag lo gestiona el admin manualmente desde el formulario de producto.
- Logística / cálculo de envío
- Devoluciones y reembolsos automatizados
- Inventario multi-almacén
- Multi-proveedor con comparación de precios
- Portal de tracking público para pedidos pagados

## Contenido y marketing

- Blog / sección de conocimiento con CMS completo
- Email marketing integrado
- Programa de fidelización / puntos
- Comparador avanzado de productos
- Banner granular de consentimiento de cookies para analítica/marketing si se agregan terceros

## IA y asesor

- Historial persistente de conversaciones del asesor
- Asesor multimodal (imágenes de equipos)
- Recomendaciones personalizadas por historial de usuario
- Streaming SSE de la respuesta del Asesor para distinguir estados "escribiendo"
  (generando respuesta) y "buscando" (recuperando productos) — hoy ambos se
  muestran como un único estado de carga (`asesor.buscando`) porque la Edge
  Function `asesor` responde JSON sin streaming
- Prellenar el formulario de cotización/contacto con el `resumen` del
  `accion_handoff` del Asesor (hoy el handoff de tipo `cotizacion` enlaza a la
  página de contacto sin parámetros de query)

## Usuarios y B2B

- Registro público de clientes
- Portal de cliente con historial de pedidos
- Precios diferenciados por tipo de institución
- Catálogo privado por cliente

## Internacionalización

- Más de 2 idiomas
- Precios en múltiples monedas con conversión en tiempo real
