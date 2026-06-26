# Edge Function: actualizar-fulfillment

Permite que un **proveedor** actualice el estado de un fulfillment (pedido en tránsito).

## Autenticación

Usa **Bearer Token** en el header `Authorization`:

```
Authorization: Bearer <api_token>
```

Donde `<api_token>` es el valor generado y guardado en `proveedores.api_token`.

## Request

**POST** `/rest/v1/functions/v1/actualizar-fulfillment`

```json
{
  "fulfillment_id": "123e4567-e89b-12d3-a456-426614174000",
  "estado": "enviado",
  "tracking_number": "1234567890",
  "tracking_url": "https://tracking.proveedor.com/1234567890",
  "notas": "Enviado con DHL"
}
```

### Parámetros

| Campo             | Tipo   | Requerido | Descripción                                               |
| ----------------- | ------ | --------- | --------------------------------------------------------- |
| `fulfillment_id`  | UUID   | ✅        | ID del fulfillment a actualizar                           |
| `estado`          | string | ✅        | Uno de: `preparando`, `enviado`, `entregado`, `cancelado` |
| `tracking_number` | string | ❌        | Número de seguimiento (ej: número de guía)                |
| `tracking_url`    | string | ❌        | URL para rastrear el envío                                |
| `notas`           | string | ❌        | Notas sobre el estado (se agregan con timestamp)          |

## Response (exitosa)

**Status: 200**

```json
{
  "ok": true,
  "fulfillment": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "estado": "enviado",
    "tracking_number": "1234567890",
    "tracking_url": "https://tracking.proveedor.com/1234567890",
    "updated_at": "2026-06-26T15:30:00Z"
  },
  "mensaje": "Fulfillment actualizado a estado 'enviado'"
}
```

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

- Token no proporcionado
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
- El proveedor del fulfillment fue eliminado

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
- `estado` no es uno de los permitidos
- JSON inválido

## Transiciones de estado

```
pendiente → notificado (automático cuando se envía notificación)
  ↓
preparando (proveedor reporta que está preparando)
  ↓
enviado (proveedor reporta que envió con número de tracking)
  ↓
entregado (confirmación de entrega)

En cualquier momento:
  → cancelado (cancelación)
  → error (error durante fulfillment)
```

## Timestamps automáticos

La función actualiza automáticamente:

- `enviado_at` → cuando estado cambia a `enviado` (si está null)
- `entregado_at` → cuando estado cambia a `entregado` (si está null)
- `updated_at` → siempre

## Setup de un proveedor

### 1. Crear proveedor

```sql
INSERT INTO proveedores (slug, nombre, canal, api_token, contacto_email)
VALUES (
  'proveedor-xyz',
  'Proveedor XYZ',
  'api',
  'sk_live_xxxxxxxxxxxxxxxxxxxxx', -- Generar token seguro
  'api@proveedor.com'
)
RETURNING id, api_token;
```

### 2. Generar un token seguro

```bash
# En Node.js
const token = require('crypto').randomBytes(32).toString('hex');
// sk_live_xxxxxxxxxxxxxxxxxxxxxxxx

# En Bash
openssl rand -hex 32
```

### 3. Guardar token de forma segura

- **NO guardar en archivos de código**
- Guardar en variables de entorno del proveedor
- Rotar periódicamente

## Ejemplo de integración (TypeScript)

```typescript
interface ActualizarFulfillmentPayload {
  fulfillment_id: string;
  estado: 'preparando' | 'enviado' | 'entregado' | 'cancelado';
  tracking_number?: string;
  tracking_url?: string;
  notas?: string;
}

async function actualizarFulfillment(
  token: string,
  payload: ActualizarFulfillmentPayload
) {
  const response = await fetch(
    'https://i-me.com.co/rest/v1/functions/v1/actualizar-fulfillment',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Error ${response.status}: ${error.error.message}`);
  }

  return await response.json();
}
```

## Notas

- **Idempotencia**: Llamar 2 veces con el mismo `estado` es seguro (actualiza mismo timestamp)
- **Pricing**: Supabase Edge Functions cobran por ejecución. Optimizar re-intentos.
- **Rate limiting**: TODO_CLIENTE — agregar si es necesario
- **Auditoría**: Cada cambio queda registrado en `updated_at` y `notas` (con timestamp)
