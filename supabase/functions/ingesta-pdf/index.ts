/**
 * Edge Function: ingesta-pdf
 * Estado: STUB — implementar en F3
 *
 * Variables requeridas: SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY, ANTHROPIC_API_KEY
 */

import { handleCors } from '../_shared/cors.ts'
import { badRequest } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  return badRequest(
    'BLOQUEANTE_BACKEND: ingesta-pdf se implementa en F3.',
    req.headers.get('origin')
  )
})
