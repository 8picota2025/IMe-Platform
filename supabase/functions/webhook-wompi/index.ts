/**
 * Edge Function: webhook-wompi
 * Estado: STUB — implementar en F4
 *
 * PENDIENTE (F4):
 * - Validar firma con WOMPI_EVENTS_SECRET
 * - Registrar evento en eventos_pago (idempotente — unique event_id)
 * - Actualizar estado de pedido solo si firma válida
 * - Disparar notificar-proveedor si estado = 'APPROVED'
 *
 * Variables requeridas: WOMPI_EVENTS_SECRET, SUPABASE_SERVICE_ROLE_KEY
 */

import { handleCors } from '../_shared/cors.ts'
import { badRequest } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  return badRequest(
    'BLOQUEANTE_BACKEND: webhook-wompi se implementa en F4.',
    req.headers.get('origin')
  )
})
