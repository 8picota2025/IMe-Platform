/**
 * CORS headers para Edge Functions.
 * Localhost solo en entornos no productivos.
 */

const PROD_ORIGINS = ['https://i-me.com.co', 'https://www.i-me.com.co'];

const DEV_ORIGINS = [
  'http://localhost:44334',
  'http://localhost:4321',
  'http://localhost:3000',
  'http://127.0.0.1:44334',
  'http://127.0.0.1:4321',
];

// Sandbox local (`127.0.0.1:44334`) siempre permitido: Origin solo aplica al
// navegador que abre esa URL; no abre CORS a terceros en producción.
const ALLOWED_ORIGINS = [...PROD_ORIGINS, ...DEV_ORIGINS];

export function getCorsHeaders(requestOrigin: string | null): HeadersInit {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]!;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req.headers.get('origin')),
    });
  }
  return null;
}
