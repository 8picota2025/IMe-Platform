# Edge Function: confirmar-notificacion-proveedor

Webhook callback que permite a un **proveedor** confirmar que recibió una notificación de pedido.

## Propósito

Cuando I-ME envía una notificación al proveedor (email, webhook, WhatsApp, etc.), el proveedor puede invocar este endpoint para confirmar que:

1. ✅ Recibió la notificación
2. ✅ Leyó/procesó el pedido
3. ✅ Está listo para empezar a preparar

Esto permite a I-ME:

- Saber que el proveedor recibió el pedido
- Transicionar automáticamente el estado de `notificado` → `preparando` si es confirmado
- Registrar auditoría de cuándo el proveedor confirmó

## Autenticación

Usa **Bearer Token** en el header `Authorization`:

```
Authorization: Bearer <api_token>
```

Mismo token que se usa en `actualizar-fulfillment`.

## Request

**POST** `/rest/v1/functions/v1/confirmar-notificacion-proveedor`

```json
{
  "fulfillment_id": "123e4567-e89b-12d3-a456-426614174000",
  "confirmado": true,
  "mensaje": "Pedido recibido, iniciamos preparación",
  "metadatos": {
    "ip": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "sistema_externo": "ERP-v2.1"
  }
}
```

### Parámetros

| Campo            | Tipo    | Requerido | Descripción                           |
| ---------------- | ------- | --------- | ------------------------------------- |
| `fulfillment_id` | UUID    | ✅        | ID del fulfillment                    |
| `confirmado`     | boolean | ✅        | `true` = confirmo; `false` = rechazo  |
| `mensaje`        | string  | ❌        | Razón de la confirmación/rechazo      |
| `metadatos`      | object  | ❌        | Datos adicionales (IP, sistema, etc.) |

## Response (exitosa)

**Status: 200**

```json
{
  "ok": true,
  "confirmacion": {
    "fulfillment_id": "123e4567-e89b-12d3-a456-426614174000",
    "estado": "preparando",
    "confirmado": true,
    "timestamp": "2026-06-26T15:30:00Z"
  },
  "mensaje": "Confirmación de notificación registrada (confirmado)"
}
```

Si confirmo (`confirmado: true`), el fulfillment transiciona automáticamente:

- `notificado` → `preparando`

Si rechazo (`confirmado: false`), el estado se mantiene pero se registra el rechazo.

## Response (errores)

### Unauthorized (401)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized"
  }
}
```

**Causas:**

- Token ausente
- Token inválido
- Token no coincide con el proveedor del fulfillment

### Not Found (404)

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

**Causas:**

- `fulfillment_id` no existe
- El proveedor fue eliminado

### Bad Request (400)

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "fulfillment_id invalido o no proporcionado"
  }
}
```

**Causas:**

- `fulfillment_id` no es UUID válido
- JSON inválido

## Transición de estados

```
notificado (inicial)
    ↓
(proveedor confirma)
    ↓
preparando (automático)
```

## Auditoría

Cada confirmación se registra en `notification_log`:

- Tipo: `confirmacion`
- Status: `confirmado` o `rechazado`
- Metadatos: datos adicionales del proveedor
- Timestamp: cuándo confirmó

## Ejemplo de integración

### Desde webhook del proveedor

Si el proveedor usa un sistema que puede hacer webhooks automáticos:

```typescript
// Sistema del proveedor (ERP, Shopify, etc.)
async function onOrderReceived(order) {
  const fulfillmentId = order.fulfillment_id; // que viene de I-ME

  try {
    // Confirmar a I-ME
    const response = await fetch(
      'https://i-me.com.co/rest/v1/functions/v1/confirmar-notificacion-proveedor',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${providerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fulfillment_id: fulfillmentId,
          confirmado: true,
          mensaje: 'Orden confirmada en nuestro ERP',
          metadatos: {
            orden_interna: order.internal_id,
            sistema: 'SAP-2024',
          },
        }),
      }
    );

    if (response.ok) {
      console.log('✅ Confirmado en I-ME');
    } else {
      console.error('❌ Error confirmando:', await response.json());
    }
  } catch (error) {
    console.error('Error de red:', error);
  }
}
```

### Desde aplicación manual

Si el proveedor quiere hacerlo desde una app web:

```bash
curl -X POST \
  'https://i-me.com.co/rest/v1/functions/v1/confirmar-notificacion-proveedor' \
  -H 'Authorization: Bearer sk_live_abc123' \
  -H 'Content-Type: application/json' \
  -d '{
    "fulfillment_id": "550e8400-e29b-41d4-a716-446655440000",
    "confirmado": true,
    "mensaje": "Confirmado manualmente por gerente",
    "metadatos": {
      "usuario": "juan@proveedor.com"
    }
  }'
```

## Notas importantes

- **Idempotencia**: Llamar 2 veces con confirmado=true es seguro (solo registra 2 confirmaciones)
- **Rechazo**: Si el proveedor rechaza (`confirmado: false`), puede reintentarlo después
- **Auditoría**: Todas las confirmaciones quedan en `notification_log` para compliance
- **Timestamps**: El timestamp de confirmación es importante para SLA tracking

## Casos de uso

| Caso                       | Flujo                                                       |
| -------------------------- | ----------------------------------------------------------- |
| Proveedor recibe email     | Lee el email → Confirma vía web                             |
| Webhook automático         | I-ME envía webhook → Proveedor confirma automático          |
| Rechazo por falta de stock | Proveedor rechaza (`confirmado: false`) → Admin ve en panel |
| Integración con ERP        | ERP recibe pedido → Confirma automático a I-ME              |

## Rate limiting (TODO_CLIENTE)

Por ahora sin límites, pero se recomienda agregar:

- Max 1 confirmación por fulfillment
- Max 100 confirmaciones/hora por proveedor
