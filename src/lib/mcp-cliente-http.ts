/**
 * Streamable HTTP (stateless) para la superficie pública `mcp-cliente`.
 * Server only. Dependencias inyectadas: el handler no conoce Supabase.
 */
import { hashIdentifier, readBoundedBody } from './mcp-comercio-http.ts';
import { dispatchMcp, MCP_VERSIONS, rpcError, type McpArgs } from './mcp-comercio-rpc.ts';
import {
  CLIENTE_REGISTRY,
  CLIENT_TOKEN_RE,
  ejecutarCliente,
  type ClienteDeps,
  type ClientToolName,
} from './mcp-cliente-core.ts';

const MAX_BODY_BYTES = 64 * 1024;

export type RateScope = 'ip' | 'cli' | 'reg' | 'ficha' | 'esc';
/** Topes por ventana de 60 s y por día (America/Bogota). */
export const RATE_LIMITS: Record<RateScope, { ventana: number; dia: number }> = {
  ip: { ventana: 60, dia: 3000 }, // todo el tráfico por IP
  reg: { ventana: 3, dia: 20 }, // registros por IP
  cli: { ventana: 30, dia: 600 }, // llamadas con token, por token
  ficha: { ventana: 10, dia: 150 }, // descargas de ficha por token
  esc: { ventana: 5, dia: 40 }, // presupuestos/contactos por token
};

export interface AuditEntry {
  metodo: string;
  herramienta: string | null;
  cliente_id: string | null;
  ip_hash: string | null;
  resultado: 'en_curso' | 'ok' | 'error' | 'denegado' | 'limitado' | 'invalido';
  codigo: string | null;
  entidad_id: string | null;
  duracion_ms: number | null;
}

export interface ClienteHttpOptions {
  deps: ClienteDeps;
  /** Consume 1 unidad en cada clave; false si alguna supera su tope. */
  consumeRateLimit: (scope: RateScope, keys: string[]) => Promise<boolean>;
  /** Inserta una fila de auditoría y devuelve su id. Debe lanzar si falla. */
  auditStart: (entry: AuditEntry) => Promise<number | string>;
  auditFinish: (id: number | string, entry: Partial<AuditEntry>) => Promise<void>;
  secrets?: readonly string[];
}

function bearerDe(request: Request): string | null {
  const raw = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? null;
  return raw && CLIENT_TOKEN_RE.test(raw) ? raw : null;
}

function resultadoDe(result: McpArgs): AuditEntry['resultado'] {
  if (result.ok !== false) return 'ok';
  if (result.code === 'UNAUTHORIZED') return 'denegado';
  if (result.code === 'INVALID_ARGUMENT') return 'invalido';
  return 'error';
}

function escopoDe(name: ClientToolName): RateScope | null {
  if (name === 'v1_client_register_client') return 'reg';
  if (name === 'v1_client_get_product_sheet') return 'ficha';
  if (name === 'v1_client_request_quote' || name === 'v1_client_request_contact') return 'esc';
  return null;
}

const RATE_LIMITED: McpArgs = {
  ok: false,
  status: 429,
  code: 'RATE_LIMITED',
  error: 'Rate limit exceeded; retry after 60 seconds.',
};

export function createClienteHttpHandler(options: ClienteHttpOptions) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });

    // Solo agentes de servidor: sin CORS; cualquier Origin de navegador se rechaza.
    if (request.headers.has('origin')) return reply({ error: 'Origin not allowed' }, 403);

    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (request.method === 'GET' && path.endsWith('/mcp-cliente/health')) {
      return reply({ ok: true, transport: 'http', server: CLIENTE_REGISTRY.serverInfo });
    }
    if (!path.endsWith('/mcp-cliente')) return reply({ error: 'Not found' }, 404);
    if (request.method !== 'POST')
      return reply({ error: 'Method not allowed' }, 405, { Allow: 'POST' });

    // IP: el gateway de Supabase añade su peer de confianza al final de XFF.
    const ip = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
    const ipHash = await hashIdentifier(`mcpc-ip:${ip}`);
    try {
      if (!(await options.consumeRateLimit('ip', [`mcpc:ip:${ipHash}`])))
        return reply({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': '60' });
    } catch {
      return reply({ error: 'Service unavailable' }, 503);
    }

    const version = request.headers.get('mcp-protocol-version');
    if (version && !MCP_VERSIONS.slice(0, 3).includes(version))
      return reply({ error: 'Unsupported MCP protocol version' }, 400);
    const accept = request.headers.get('accept') ?? '';
    if (!accept.includes('application/json') || !accept.includes('text/event-stream'))
      return reply({ error: 'Accept must include application/json and text/event-stream' }, 406);
    if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
      return reply({ error: 'Expected application/json' }, 415);
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES)
      return reply({ error: 'Request too large' }, 413);

    let message: unknown;
    try {
      message = JSON.parse(await readBoundedBody(request, MAX_BODY_BYTES));
    } catch (error) {
      if (error instanceof Error && error.message === 'body_too_large')
        return reply({ error: 'Request too large' }, 413);
      return reply(rpcError(null, -32700, 'Parse error'), 400);
    }

    const bearer = bearerDe(request);
    const result = await dispatchMcp<ClientToolName>(message, {
      registry: CLIENTE_REGISTRY,
      versions: MCP_VERSIONS.slice(0, 3),
      secrets: options.secrets ?? [],
      execute: async (name, args) => {
        // Rate limit por herramienta ANTES de tocar datos. Un error del
        // limitador propaga una excepción → respuesta genérica (fail closed).
        const token =
          typeof args.client_token === 'string' && CLIENT_TOKEN_RE.test(args.client_token)
            ? args.client_token
            : bearer;
        const tokenHash = token ? await hashIdentifier(`mcpc-tok:${token}`) : null;
        const scope = escopoDe(name);
        const checks: Array<[RateScope, string]> = [];
        if (tokenHash) checks.push(['cli', `mcpc:cli:${tokenHash}`]);
        if (scope === 'reg') checks.push(['reg', `mcpc:reg:${ipHash}`]);
        else if (scope && tokenHash) checks.push([scope, `mcpc:${scope}:${tokenHash}`]);
        for (const [s, key] of checks) {
          if (!(await options.consumeRateLimit(s, [key]))) return RATE_LIMITED;
        }

        // Auditoría fail-closed: sin fila de auditoría no se ejecuta nada.
        const inicio = Date.now();
        const auditId = await options.auditStart({
          metodo: 'tools/call',
          herramienta: name,
          cliente_id: null,
          ip_hash: ipHash,
          resultado: 'en_curso',
          codigo: null,
          entidad_id: null,
          duracion_ms: null,
        });
        try {
          const salida = await ejecutarCliente(name, args, { ipHash, bearer }, options.deps);
          await options
            .auditFinish(auditId, {
              cliente_id: salida.clienteId,
              resultado: resultadoDe(salida.result),
              codigo: typeof salida.result.code === 'string' ? salida.result.code : null,
              entidad_id: salida.entidadId ?? null,
              duracion_ms: Date.now() - inicio,
            })
            .catch(() => undefined);
          return salida.result;
        } catch (error) {
          await options
            .auditFinish(auditId, {
              resultado: 'error',
              codigo: 'INTERNAL',
              duracion_ms: Date.now() - inicio,
            })
            .catch(() => undefined);
          throw error;
        }
      },
    });
    if (!result)
      return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    return reply(result, result.error ? 400 : 200);
  };
}
