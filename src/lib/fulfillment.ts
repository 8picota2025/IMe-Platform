/**
 * Stubs de fulfillment — módulo dropshipping.
 * Implementación real en F4.
 *
 * REGLA CRÍTICA: precio_costo NUNCA se expone fuera del servidor/Edge Functions.
 * Esta capa pública NO devuelve precio_costo bajo ninguna circunstancia.
 *
 * BLOQUEANTE_BACKEND: Requiere Supabase + Edge Functions (F4).
 */

export type EstadoFulfillment =
  | 'pendiente'
  | 'notificado'
  | 'preparando'
  | 'enviado'
  | 'entregado'
  | 'cancelado'
  | 'error'

export interface FulfillmentResumen {
  id: string
  pedido_id: string
  proveedor_id: string
  estado: EstadoFulfillment
  tracking_number: string | null
  tracking_url: string | null
  notificado_at: string | null
  enviado_at: string | null
  entregado_at: string | null
}

/**
 * Retorna los fulfillments pendientes de notificar.
 * STUB — implementar en F4 con service_role en Edge Function.
 */
export async function getFulfillmentPendientes(): Promise<FulfillmentResumen[]> {
  // BLOQUEANTE_BACKEND: Lógica real en Edge Function notificar-proveedor (F4)
  return []
}

/**
 * Actualiza el estado de un fulfillment.
 * STUB — implementar en F4.
 */
export async function actualizarEstadoFulfillment(
  _fulfillmentId: string,
  _estado: EstadoFulfillment,
  _datos?: { tracking_number?: string; tracking_url?: string; notas?: string }
): Promise<{ ok: boolean; error?: string }> {
  // BLOQUEANTE_BACKEND: Lógica real en Edge Function (F4)
  return { ok: false, error: 'BLOQUEANTE_BACKEND: No implementado hasta F4' }
}

/**
 * Obtiene el proveedor preferente para un producto (sin precio_costo).
 * La función real es get_proveedor_para_producto RPC en Supabase.
 * STUB — implementar en F4 vía Edge Function con service_role.
 */
export async function getProveedorParaProducto(
  _productoId: string
): Promise<{
  proveedor_id: string
  canal: string
  contacto_email: string
  contacto_whatsapp: string
} | null> {
  // BLOQUEANTE_BACKEND: Lógica real en Edge Function (F4) — nunca expone precio_costo
  return null
}
