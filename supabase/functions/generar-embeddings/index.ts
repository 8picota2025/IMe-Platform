/**
 * Edge Function: generar-embeddings
 * Estado: STUB — implementar en Fase Asesor
 *
 * Variables requeridas: VOYAGE_API_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { handleCors } from '../_shared/cors.ts'
import { badRequest } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  return badRequest(
    'BLOQUEANTE_BACKEND: generar-embeddings se implementa en Fase Asesor.',
    req.headers.get('origin')
  )
})
