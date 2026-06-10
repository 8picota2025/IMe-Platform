/**
 * Edge Function: trigger-rebuild
 * Estado: STUB — implementar en F3
 *
 * Variables requeridas: GITHUB_TOKEN (o CI_DEPLOY_HOOK), SUPABASE_SERVICE_ROLE_KEY
 */

import { handleCors } from '../_shared/cors.ts'
import { badRequest } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  return badRequest(
    'BLOQUEANTE_BACKEND: trigger-rebuild se implementa en F3.',
    req.headers.get('origin')
  )
})
