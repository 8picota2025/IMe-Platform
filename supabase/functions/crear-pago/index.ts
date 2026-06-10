/**
 * Edge Function: crear-pago
 * Estado: STUB — implementar en F4
 *
 * PENDIENTE (F4):
 * - Recibir items + cliente desde el cliente
 * - Recalcular precios server-side (NUNCA confiar en precios del cliente)
 * - Crear checkout con Wompi (CO/COP) o Stripe (INTL)
 * - Guardar pedido en estado 'pendiente'
 * - Devolver checkout_url
 *
 * Variables requeridas: WOMPI_PRIVATE_KEY, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { handleCors } from '../_shared/cors.ts'
import { badRequest } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  return badRequest(
    'BLOQUEANTE_BACKEND: crear-pago se implementa en F4.',
    req.headers.get('origin')
  )
})
