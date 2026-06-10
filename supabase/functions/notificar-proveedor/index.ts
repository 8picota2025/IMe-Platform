/**
 * Edge Function: notificar-proveedor
 * Estado: STUB — implementar en F4
 *
 * PENDIENTE (F4):
 * - Llamada desde webhook-wompi/stripe al aprobar pago
 * - Usar get_proveedor_para_producto RPC (no expone precio_costo)
 * - Notificar por canal del proveedor: email, WhatsApp, webhook, API, manual
 *
 * Variables requeridas: SUPABASE_SERVICE_ROLE_KEY + config de canales por proveedor
 */

import { handleCors } from '../_shared/cors.ts'
import { badRequest } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  return badRequest(
    'BLOQUEANTE_BACKEND: notificar-proveedor se implementa en F4.',
    req.headers.get('origin')
  )
})
