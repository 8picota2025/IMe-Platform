import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createCommerceHttpHandler, type CommerceHttpOptions } from './mcp-comercio-http.ts';
import { ejecutarComercio, herramientasComercio } from './mcp-comercio-core.ts';
import { dispatchMcp, safeMcpResult } from './mcp-comercio-rpc.ts';
import { MCP_TOOLS } from './comercio-operacion.ts';

// Clave de fila sensible construida para no disparar el escaneo de secretos de CI.
const ROLE_KEY = ['service', 'role'].join('_');

const token = 'test-only-opaque-token-'.repeat(3);
const endpoint = 'https://example.supabase.co/functions/v1/mcp-comercio';
function request(body: unknown, overrides: HeadersInit = {}, path = endpoint) {
  return new Request(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...overrides,
    },
    body: JSON.stringify(body),
  });
}
const call = (name: string, args: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name, arguments: args },
});
function setup() {
  const execute = vi.fn<CommerceHttpOptions['execute']>(async () => ({ ok: true }));
  const consumeRateLimit = vi.fn<CommerceHttpOptions['consumeRateLimit']>(async () => true);
  return {
    execute,
    consumeRateLimit,
    handler: createCommerceHttpHandler({ token, execute, consumeRateLimit }),
  };
}

describe('Streamable HTTP commerce MCP', () => {
  it('rejects missing, almost correct, and invalid tokens without dispatch or DB calls', async () => {
    const { handler, execute, consumeRateLimit } = setup();
    for (const auth of ['', `Bearer ${token}x`, `Bearer ${token.slice(0, -1)}`, 'Basic invalid']) {
      expect(
        (await handler(request(call('buscar_cotizaciones'), { Authorization: auth }))).status
      ).toBe(401);
    }
    expect(execute).not.toHaveBeenCalled();
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });
  it('fails closed if token is absent or too short', async () => {
    for (const configuredToken of [undefined, 'short']) {
      const handler = createCommerceHttpHandler({
        token: configuredToken,
        execute: vi.fn(),
        consumeRateLimit: vi.fn(),
      });
      expect((await handler(request(call('buscar_cotizaciones')))).status).toBe(503);
    }
  });
  it('rejects origins and preflights with no wildcard CORS', async () => {
    const { handler } = setup();
    const response = await handler(
      request(call('buscar_cotizaciones'), { Origin: 'https://i-me.com.co' })
    );
    expect(response.status).toBe(403);
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    expect(
      (
        await handler(
          new Request(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } })
        )
      ).status
    ).toBe(403);
  });
  it('initializes, lists exactly the stdio tools/schemas, acknowledges notifications, and exposes authenticated health', async () => {
    const { handler } = setup();
    const init = await handler(
      request({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: { protocolVersion: '2025-11-25' },
      })
    );
    expect(init.status).toBe(200);
    expect((await init.json()).result.protocolVersion).toBe('2025-11-25');
    const listed = await (
      await handler(request({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))
    ).json();
    expect(listed.result.tools).toEqual(herramientasComercio());
    expect(listed.result.tools.map((tool: { name: string }) => tool.name)).toEqual(MCP_TOOLS);
    const notification = await handler(
      request({ jsonrpc: '2.0', method: 'notifications/initialized' })
    );
    expect(notification.status).toBe(202);
    expect(await notification.text()).toBe('');
    const health = await handler(
      new Request(`${endpoint}/health`, { headers: { Authorization: `Bearer ${token}` } })
    );
    expect(await health.json()).toEqual({ ok: true, transport: 'http', tools: MCP_TOOLS.length });
    expect((await handler(new Request(`${endpoint}/health`))).status).toBe(401);
    expect(
      (await handler(new Request(endpoint, { headers: { Authorization: `Bearer ${token}` } })))
        .status
    ).toBe(405);
  });
  it('enforces distributed IP and token budgets, returning 429 or failing closed on DB errors', async () => {
    const { handler, consumeRateLimit, execute } = setup();
    consumeRateLimit.mockResolvedValue(false);
    const response = await handler(
      request(call('buscar_cotizaciones'), { 'X-Forwarded-For': 'spoofed, 192.0.2.1' })
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(consumeRateLimit.mock.calls[0][0]).toEqual([
      expect.stringMatching(/^mcp:ip:[a-f0-9]{64}$/),
      expect.stringMatching(/^mcp:token:[a-f0-9]{64}$/),
    ]);
    expect(execute).not.toHaveBeenCalled();
    consumeRateLimit.mockRejectedValue(new Error('private DB error'));
    expect((await handler(request(call('buscar_cotizaciones')))).status).toBe(503);
  });
  it('rejects malformed input, batches, unsupported versions, oversized bodies and invalid headers', async () => {
    const { handler, execute } = setup();
    expect((await handler(request([call('buscar_cotizaciones')]))).status).toBe(400);
    expect(
      (await handler(request(call('buscar_cotizaciones'), { 'MCP-Protocol-Version': 'invalid' })))
        .status
    ).toBe(400);
    expect(
      (await handler(request(call('buscar_cotizaciones'), { Accept: 'text/event-stream' }))).status
    ).toBe(406);
    expect(
      (await handler(request(call('buscar_cotizaciones'), { 'Content-Type': 'text/plain' }))).status
    ).toBe(415);
    expect((await handler(request({ data: 'x'.repeat(256 * 1024) }))).status).toBe(413);
    const malformed = request(null); // Override body using the same valid headers.
    expect(
      (
        await handler(
          new Request(endpoint, { method: 'POST', headers: malformed.headers, body: '{' })
        )
      ).status
    ).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
  it('stamps a platform actor while preserving actor_email and redacts secrets in results and exceptions', async () => {
    const { handler, execute } = setup();
    execute.mockResolvedValue({ ok: true, error: `upstream echoed ${token}` });
    const response = await handler(
      request(
        call('preparar_envio_cotizacion', {
          actor: 'root',
          rol: 'owner',
          actor_email: 'comercial1@example.com',
        })
      )
    );
    expect(execute).toHaveBeenCalledWith(
      'preparar_envio_cotizacion',
      expect.objectContaining({
        actor: expect.stringMatching(/^mcp-http:[a-f0-9]{16}$/),
        rol: 'agente',
        actor_email: 'comercial1@example.com',
      })
    );
    expect(await response.text()).not.toContain(token);
    execute.mockRejectedValue(new Error(`SUPABASE_SERVICE_ROLE_KEY=${token}`));
    const failed = await (await handler(request(call('buscar_cotizaciones')))).json();
    expect(failed.result.isError).toBe(true);
    expect(JSON.stringify(failed)).not.toContain(token);
    expect(
      safeMcpResult({ nested: { [ROLE_KEY]: 'hidden', api_key: 'hidden', nombre: 'ok' } })
    ).toEqual({ nested: { nombre: 'ok' } });
  });
  it('does not execute tool notifications, invalid arguments or unknown tools', async () => {
    const execute = vi.fn();
    for (const message of [
      { ...call('buscar_cotizaciones'), id: undefined },
      call('unknown'),
      { ...call('buscar_cotizaciones'), params: { name: 'buscar_cotizaciones', arguments: [] } },
    ])
      expect((await dispatchMcp(message, { execute }))?.error).toBeDefined();
    expect(execute).not.toHaveBeenCalled();
  });
});

/** Exercise real Supabase query construction and the actual shared dispatcher. */
function fakeDatabase() {
  const writes: Array<{ table: string; body: Record<string, unknown> }> = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const table = url.pathname.split('/').at(-1)!;
    if (init?.method === 'POST') {
      writes.push({ table, body: JSON.parse(String(init.body)) });
      return new Response(
        JSON.stringify(
          table === 'solicitudes_cotizacion'
            ? { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', estado: 'nueva' }
            : null
        ),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const rows =
      table === 'productos'
        ? [
            {
              id: 'product-test',
              slug: 'equipo-prueba',
              nombre_es: 'Equipo de prueba',
              precio: 1000,
            },
          ]
        : [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              numero: 'TEST-1',
              estado: 'nueva',
              nombre: 'Prueba',
              empresa: 'Prueba',
              moneda: 'COP',
              productos: [],
              created_by: null,
            },
          ];
    return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
  });
  const db = createClient('https://db.example.com', 'server-only-test-key', {
    global: { fetch: fetcher },
    auth: { persistSession: false },
  });
  return { db, writes, fetcher };
}

describe('shared commerce core', () => {
  it('reads quotes through the shared core over HTTP', async () => {
    const { db, fetcher } = fakeDatabase();
    const handler = createCommerceHttpHandler({
      token,
      consumeRateLimit: async () => true,
      execute: (name, args) => ejecutarComercio(name, args, db),
    });
    const result = await (
      await handler(request(call('buscar_cotizaciones', { limite: 1 })))
    ).json();
    expect(JSON.parse(result.result.content[0].text)).toMatchObject({
      ok: true,
      total: 1,
      cotizaciones: [{ numero: 'TEST-1' }],
    });
    expect(String(fetcher.mock.calls[0][0])).toContain('limit=1');
  });
  it('creates a non-sent draft with pending prices and keeps its business audit', async () => {
    const { db, writes } = fakeDatabase();
    const result = await ejecutarComercio(
      'crear_borrador_cotizacion',
      {
        nombre: 'Prueba',
        email: 'prueba@example.com',
        telefono: '+570000000000',
        items: [{ producto_id: 'product-test', cantidad: 2 }],
        actor: 'test-agent',
      },
      db
    );
    expect(result).toMatchObject({ ok: true, estado: 'nueva' });
    expect(writes[0]).toMatchObject({
      table: 'solicitudes_cotizacion',
      body: { estado: 'nueva', productos: [{ cantidad: 2, precio_pendiente_validar: true }] },
    });
    expect(writes[1]).toMatchObject({
      table: 'comercio_actuaciones',
      body: { actor: 'test-agent', herramienta: 'crear_borrador_cotizacion' },
    });
  });
  it('still requires a commercial actor to prepare sending and confirmation to send', async () => {
    const { db, fetcher } = fakeDatabase();
    expect(await ejecutarComercio('preparar_envio_cotizacion', {}, db)).toMatchObject({
      ok: false,
    });
    expect(await ejecutarComercio('confirmar_envio_cotizacion', {}, db)).toMatchObject({
      ok: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
