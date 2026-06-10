/**
 * Edge Function: webhook-stripe
 * Estado: STUB — implementar en F4
 *
 * Variables requeridas: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { handleCors } from '../_shared/cors.ts'
import { badRequest } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  return badRequest(
    'BLOQUEANTE_BACKEND: webhook-stripe se implementa en F4.',
    req.headers.get('origin')
  )
})
