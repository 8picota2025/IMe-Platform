/**
 * Manejo de errores estándar para Edge Functions.
 */

import { getCorsHeaders } from './cors.ts'

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export function errorResponse(error: ApiError, status: number, origin: string | null): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  })
}

export function notFound(origin: string | null): Response {
  return errorResponse({ code: 'NOT_FOUND', message: 'Resource not found' }, 404, origin)
}

export function unauthorized(origin: string | null): Response {
  return errorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401, origin)
}

export function internalError(detail: string, origin: string | null): Response {
  // No exponer detalles internos en producción
  return errorResponse(
    {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: Deno.env.get('SUPABASE_ENV') !== 'prod' ? detail : undefined,
    },
    500,
    origin
  )
}

export function badRequest(message: string, origin: string | null): Response {
  return errorResponse({ code: 'BAD_REQUEST', message }, 400, origin)
}
