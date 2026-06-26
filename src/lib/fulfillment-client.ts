/**
 * Cliente para la Edge Function actualizar-fulfillment.
 * Usado por proveedores para reportar cambios de estado en fulfillments.
 */

export type EstadoFulfillmentProveedor = 'preparando' | 'enviado' | 'entregado' | 'cancelado';

export interface ActualizarFulfillmentPayload {
  fulfillment_id: string;
  estado: EstadoFulfillmentProveedor;
  tracking_number?: string;
  tracking_url?: string;
  notas?: string;
}

export interface ActualizarFulfillmentResponse {
  ok: true;
  fulfillment: {
    id: string;
    estado: string;
    tracking_number: string | null;
    tracking_url: string | null;
    updated_at: string;
  };
  mensaje: string;
}

export interface ActualizarFulfillmentError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export async function actualizarFulfillment(
  token: string,
  payload: ActualizarFulfillmentPayload,
  baseUrl = 'https://i-me.com.co'
): Promise<ActualizarFulfillmentResponse> {
  const url = new URL('/rest/v1/functions/v1/actualizar-fulfillment', baseUrl);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as
    | ActualizarFulfillmentResponse
    | ActualizarFulfillmentError;

  if (!response.ok) {
    const error = data as ActualizarFulfillmentError;
    throw new Error(
      `[${error.error.code}] ${error.error.message}` +
        (error.error.details ? ` — ${JSON.stringify(error.error.details)}` : '')
    );
  }

  return data as ActualizarFulfillmentResponse;
}

/**
 * Webhook callback que un proveedor puede invocar directamente.
 * Valida que el fulfillment existe y actualiza sin token (para webhooks de terceros).
 * BLOQUEANTE_BACKEND: Implementar si los proveedores usan webhooks de terceros.
 */
export async function procesarWebhookProveedorFulfillment(
  _payload: {
    fulfillment_id: string;
    estado: string;
    tracking_number?: string;
    tracking_url?: string;
    notas?: string;
  },
  _secret?: string
): Promise<ActualizarFulfillmentResponse> {
  // TODO: Validar signature de webhook con secret
  // TODO: Llamar a Edge Function con service_role para actualizar sin token
  throw new Error('BLOQUEANTE_BACKEND: Webhook validation no implementado');
}
