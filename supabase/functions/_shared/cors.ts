/**
 * CORS headers para Edge Functions.
 * Restringir ALLOWED_ORIGINS en producción.
 */

// TODO_CLIENTE: Restringir a dominio real en producción
const ALLOWED_ORIGINS = ['https://i-me.com.co', 'http://localhost:43421', 'http://localhost:4321']

export function getCorsHeaders(requestOrigin: string | null): HeadersInit {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]!

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req.headers.get('origin')),
    })
  }
  return null
}
