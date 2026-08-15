/**
 * CORS headers for Edge Functions.
 * Reflect any http(s) Origin: SPA uses Bearer tokens (not cookies), so
 * echoing Origin is safe and fixes LAN IPs / preview hosts that previously
 * got Access-Control-Allow-Origin: https://i-me.com.co → browser "Failed to fetch".
 */

const FALLBACK_ORIGIN = 'https://i-me.com.co';

function resolveOrigin(requestOrigin: string | null): string {
  const origin = (requestOrigin ?? '').trim();
  if (/^https?:\/\/[^/]+$/i.test(origin) || /^https?:\/\/[^/]+\//i.test(origin)) {
    // Origin header never has a path; accept host-only http(s)
    try {
      const u = new URL(origin);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return `${u.protocol}//${u.host}`;
      }
    } catch {
      /* fall through */
    }
  }
  return FALLBACK_ORIGIN;
}

export function getCorsHeaders(requestOrigin: string | null): HeadersInit {
  const origin = resolveOrigin(requestOrigin);

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, apikey, x-client-info, x-supabase-auth',
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
