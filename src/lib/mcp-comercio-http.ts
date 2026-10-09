/** Server-only, dependency-injected Streamable HTTP adapter for Supabase Edge. */
import { herramientasComercio } from './mcp-comercio-core.ts';
import { dispatchMcp, MCP_VERSIONS, rpcError, type McpRpcOptions } from './mcp-comercio-rpc.ts';

export interface CommerceHttpOptions extends McpRpcOptions {
  token: string | undefined;
  consumeRateLimit: (keys: string[]) => Promise<boolean>;
}
const MAX_BODY_BYTES = 256 * 1024;
export async function hashIdentifier(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function matchesToken(candidate: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([hashIdentifier(candidate), hashIdentifier(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
async function readBoundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('body_too_large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export function createCommerceHttpHandler(options: CommerceHttpOptions) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
    // No browser origins are allowed. No wildcard CORS, including errors and health.
    if (request.headers.has('origin')) return reply({ error: 'Origin not allowed' }, 403);
    if (!options.token || options.token.length < 32)
      return reply({ error: 'Service unavailable' }, 503);
    const candidate =
      /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
    if (!candidate || candidate.length > 1024 || !(await matchesToken(candidate, options.token))) {
      return reply({ error: 'Unauthorized' }, 401, {
        'WWW-Authenticate': 'Bearer realm="ime-comercio"',
      });
    }
    const fingerprint = await hashIdentifier(options.token);
    // The gateway appends its trusted peer to X-Forwarded-For; the token-wide
    // budget still applies when an upstream does not provide reliable IP data.
    const ip = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
    try {
      const allowed = await options.consumeRateLimit([
        `mcp:ip:${await hashIdentifier(ip)}`,
        `mcp:token:${fingerprint}`,
      ]);
      if (!allowed) return reply({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': '60' });
    } catch {
      return reply({ error: 'Service unavailable' }, 503);
    }
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (request.method === 'GET' && path.endsWith('/mcp-comercio/health')) {
      return reply({ ok: true, transport: 'http', tools: herramientasComercio().length });
    }
    if (!path.endsWith('/mcp-comercio')) return reply({ error: 'Not found' }, 404);
    if (request.method !== 'POST')
      return reply({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
    const version = request.headers.get('mcp-protocol-version');
    if (version && !MCP_VERSIONS.slice(0, 3).includes(version))
      return reply({ error: 'Unsupported MCP protocol version' }, 400);
    const accept = request.headers.get('accept') ?? '';
    if (!accept.includes('application/json') || !accept.includes('text/event-stream'))
      return reply({ error: 'Accept must include application/json and text/event-stream' }, 406);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      return reply({ error: 'Expected application/json' }, 415);
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES)
      return reply({ error: 'Request too large' }, 413);
    let message: unknown;
    try {
      message = JSON.parse(await readBoundedBody(request));
    } catch (error) {
      if (error instanceof Error && error.message === 'body_too_large')
        return reply({ error: 'Request too large' }, 413);
      return reply(rpcError(null, -32700, 'Parse error'), 400);
    }
    const result = await dispatchMcp(message, {
      secrets: [...(options.secrets ?? []), options.token],
      versions: MCP_VERSIONS.slice(0, 3),
      execute: (name, args) =>
        options.execute(name, {
          ...args,
          actor: `mcp-http:${fingerprint.slice(0, 16)}`,
          rol: 'agente',
        }),
    });
    if (!result)
      return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    return reply(result, result.error ? 400 : 200);
  };
}
