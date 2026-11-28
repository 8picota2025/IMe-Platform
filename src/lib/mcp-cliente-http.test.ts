import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCommerceHttpHandler, hashIdentifier } from './mcp-comercio-http.ts';
import { HERRAMIENTAS_LECTURA } from './mcp-comercio-core.ts';
import {
  CLIENT_TOOLS,
  type ClienteDeps,
  type ClienteRow,
  type NuevaSolicitud,
  type ProductoPublicoRow,
} from './mcp-cliente-core.ts';
import {
  createClienteHttpHandler,
  type AuditEntry,
  type ClienteHttpOptions,
  type RateScope,
} from './mcp-cliente-http.ts';

// Respuestas JSON-RPC dinámicas: se inspeccionan por ruta en las aserciones.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
const endpoint = 'https://example.supabase.co/functions/v1/mcp-cliente';
const BASE_HEADERS = {
  Accept: 'application/json, text/event-stream',
  'Content-Type': 'application/json',
};

const producto = (over: Partial<ProductoPublicoRow>): ProductoPublicoRow => ({
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'acme-x1',
  sku: 'ACME-X1',
  nombre_es: 'Equipo de prueba X1',
  nombre_en: 'Test device X1',
  descripcion_corta_es: 'Descripción sintética',
  descripcion_corta_en: 'Synthetic summary',
  imagen_principal: '/assets/productos/acme-x1.webp',
  ficha_pdf: '/assets/productos/fichas/acme/acme-x1.pdf',
  fulfillment_mode: 'cotizacion',
  stock_estado: 'instock',
  disponible: true,
  precio_publico: null,
  familia_slug: 'acme',
  ...over,
});

type ClienteFake = ClienteRow & { token_hash: string };
let tokenSeq = 0;

function setup(
  opts: { limitar?: RateScope[]; limiterThrows?: boolean; auditThrows?: boolean } = {}
) {
  const productos = [
    producto({}),
    producto({
      id: '00000000-0000-4000-8000-000000000002',
      slug: 'acme-y2',
      sku: null,
      ficha_pdf: null,
      precio_publico: 119000,
      fulfillment_mode: 'dropship',
    }),
  ];
  const clientes = new Map<string, ClienteFake>();
  const idem = new Map<string, { huella: string; estado: string; respuesta: Json | null }>();
  const solicitudes: Array<NuevaSolicitud & { id: string }> = [];
  const descargas: string[] = [];
  const avisos: string[] = [];
  const audit: AuditEntry[] = [];
  const llamadas: string[] = [];

  const deps: ClienteDeps = {
    async listarProductos({ familia, limite, desplazamiento }) {
      llamadas.push('listar');
      const filas = productos.filter(p => !familia || p.familia_slug === familia);
      return { filas: filas.slice(desplazamiento, desplazamiento + limite), total: filas.length };
    },
    async buscarProductos(texto) {
      llamadas.push('buscar');
      return productos.filter(p => p.nombre_es.toLowerCase().includes(texto.toLowerCase()));
    },
    async productoPorSlug(slug) {
      llamadas.push('porSlug');
      return productos.find(p => p.slug === slug) ?? null;
    },
    async productosPorSlugs(slugs) {
      llamadas.push('porSlugs');
      return productos.filter(p => slugs.includes(p.slug));
    },
    async crearCliente(fila) {
      llamadas.push('crearCliente');
      const id = `00000000-0000-4000-9000-${String(clientes.size + 1).padStart(12, '0')}`;
      clientes.set(fila.token_hash, { ...fila, id, revocado_at: null });
      return { id };
    },
    async clientePorTokenHash(hash) {
      llamadas.push('clientePorToken');
      return clientes.get(hash) ?? null;
    },
    async tocarCliente() {},
    async registrarDescarga(_cliente, p) {
      descargas.push(p.slug);
    },
    async firmarFicha(ruta) {
      llamadas.push('firmar');
      return {
        url: `https://example.supabase.co/storage/v1/object/sign/fichas-clientes${ruta}?token=t`,
        expira_en: new Date(Date.now() + 600_000).toISOString(),
      };
    },
    async reservarIdempotencia(c, h, k, huella) {
      const key = `${c}|${h}|${k}`;
      const prev = idem.get(key);
      if (!prev) {
        idem.set(key, { huella, estado: 'en_curso', respuesta: null });
        return { estado: 'nueva' };
      }
      if (prev.huella !== huella) return { estado: 'conflicto' };
      if (prev.estado === 'completada' && prev.respuesta)
        return { estado: 'completada', respuesta: prev.respuesta };
      return { estado: 'en_curso' };
    },
    async completarIdempotencia(c, h, k, respuesta) {
      const prev = idem.get(`${c}|${h}|${k}`);
      if (prev) Object.assign(prev, { estado: 'completada', respuesta });
    },
    async liberarIdempotencia(c, h, k) {
      const key = `${c}|${h}|${k}`;
      if (idem.get(key)?.estado === 'en_curso') idem.delete(key);
    },
    async crearSolicitud(fila) {
      llamadas.push('crearSolicitud');
      const id = `00000000-0000-4000-a000-${String(solicitudes.length + 1).padStart(12, '0')}`;
      solicitudes.push({ ...fila, id });
      return { id };
    },
    async notificarVentas(id) {
      avisos.push(id);
      return true;
    },
    sha256: hashIdentifier,
    randomToken: () => `imec_${String(++tokenSeq).padStart(43, 'A')}`,
    now: () => new Date(),
  };

  const options: ClienteHttpOptions = {
    deps,
    consumeRateLimit: async scope => {
      if (opts.limiterThrows) throw new Error('db down');
      return !(opts.limitar ?? []).includes(scope);
    },
    auditStart: async entry => {
      if (opts.auditThrows) throw new Error('audit down');
      audit.push({ ...entry });
      return audit.length - 1;
    },
    auditFinish: async (id, entry) => {
      Object.assign(audit[Number(id)] as AuditEntry, entry);
    },
  };
  const handler = createClienteHttpHandler(options);

  async function rpc(body: unknown, headers: Record<string, string> = {}) {
    const res = await handler(
      new Request(endpoint, {
        method: 'POST',
        headers: { ...BASE_HEADERS, ...headers },
        body: JSON.stringify(body),
      })
    );
    const json = res.status === 202 ? null : ((await res.json()) as Json);
    return { res, json };
  }
  async function call(name: string, args: Json = {}, headers: Record<string, string> = {}) {
    const { res, json } = await rpc(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
      headers
    );
    const text = json?.result?.content?.[0]?.text as string | undefined;
    return { res, json: json as Json, out: (text ? JSON.parse(text) : null) as Json };
  }
  const registro = {
    name: 'Ana Prueba',
    email: 'ana@example.com',
    company: 'Clínica Ejemplo SAS',
    phone: '+57 300 000 0000',
    country: 'CO',
    data_processing_consent: true,
  };
  async function registrar(): Promise<string> {
    const { out } = await call('v1_client_register_client', registro);
    return String(out.client_token);
  }
  return {
    handler,
    rpc,
    call,
    registrar,
    registro,
    clientes,
    solicitudes,
    descargas,
    avisos,
    audit,
    llamadas,
  };
}

describe('mcp-cliente: superficie pública rol client', () => {
  it('lists exactly the 6 v1 client tools with schemas and annotations', async () => {
    const s = setup();
    const init = await s.rpc({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} });
    expect(init.json?.result.serverInfo.name).toBe('ime-cliente');
    const { json } = await s.rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const tools = json?.result.tools as Json[];
    expect(tools.map(t => t.name)).toEqual([...CLIENT_TOOLS]);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^v1_client_[a-z_]+$/);
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(tool.outputSchema).toBeTruthy();
      expect(typeof tool.annotations.readOnlyHint).toBe('boolean');
    }
  });

  it('returns 401 + register instruction to unregistered, unknown, expired and revoked clients', async () => {
    const s = setup();
    for (const name of [
      'v1_client_get_product_sheet',
      'v1_client_request_quote',
      'v1_client_request_contact',
    ]) {
      const { out, json } = await s.call(name, { slug: 'acme-x1' });
      expect(json.result.isError).toBe(true);
      expect(out).toMatchObject({
        ok: false,
        status: 401,
        code: 'UNAUTHORIZED',
        next_step: 'v1_client_register_client',
      });
    }
    const ficha = (client_token: string) =>
      s.call('v1_client_get_product_sheet', { client_token, slug: 'acme-x1' });
    expect((await ficha(`imec_${'Z'.repeat(43)}`)).out.status).toBe(401);

    const token = await s.registrar();
    const fila = [...s.clientes.values()][0] as ClienteFake;
    fila.expira_en = new Date(Date.now() - 1000).toISOString();
    expect((await ficha(token)).out.status).toBe(401);
    fila.expira_en = new Date(Date.now() + 86_400_000).toISOString();
    fila.revocado_at = new Date().toISOString();
    expect((await ficha(token)).out.status).toBe(401);

    expect(s.descargas).toEqual([]);
    expect(s.llamadas).not.toContain('firmar');
    expect(s.audit.filter(a => a.resultado === 'denegado').length).toBe(6);
  });

  it('gives a registered client a private signed sheet URL (argument or Bearer header)', async () => {
    const s = setup();
    const token = await s.registrar();
    expect(token).toMatch(/^imec_[A-Za-z0-9_-]{43}$/);
    const fila = [...s.clientes.values()][0];
    expect(JSON.stringify(fila)).not.toContain(token);
    expect(fila?.token_hash).toBe(await hashIdentifier(token));

    const conArg = await s.call('v1_client_get_product_sheet', {
      client_token: token,
      slug: 'acme-x1',
    });
    expect(conArg.out).toMatchObject({
      ok: true,
      slug: 'acme-x1',
      content_type: 'application/pdf',
    });
    expect(conArg.out.sheet_url).toContain('/object/sign/fichas-clientes/');
    const conHeader = await s.call(
      'v1_client_get_product_sheet',
      { slug: 'acme-x1' },
      { Authorization: `Bearer ${token}` }
    );
    expect(conHeader.out.ok).toBe(true);
    expect(s.descargas).toEqual(['acme-x1', 'acme-x1']);

    const sinFicha = await s.call('v1_client_get_product_sheet', {
      client_token: token,
      slug: 'acme-y2',
    });
    expect(sinFicha.out.code).toBe('SHEET_UNAVAILABLE');
  });

  it('rejects admin/operator tools and unlisted names without touching data', async () => {
    const s = setup();
    for (const name of [
      'bandeja_trabajo',
      'buscar_clientes',
      'proponer_precio',
      'confirmar_factura',
      'preparar_borrado_crm',
      'actualizar_cotizacion',
      'v1.client.list_catalog',
      '__proto__',
      'constructor',
    ]) {
      const { json } = await s.call(name, { rol: 'admin' });
      expect(json.error).toEqual({ code: -32602, message: 'Unknown tool' });
    }
    expect(s.audit).toEqual([]);
    expect(s.llamadas).toEqual([]);
    const fuente = readFileSync(new URL('./mcp-cliente-core.ts', import.meta.url), 'utf8');
    const imports = fuente.split('\n').filter(l => /^\s*import\b|from\s+'/.test(l));
    expect(imports.join('\n')).not.toMatch(/mcp-comercio-core|comercio-operacion/);
  });

  it('validates and sanitizes register_client input', async () => {
    const s = setup();
    const sinConsent = await s.call('v1_client_register_client', {
      ...s.registro,
      data_processing_consent: false,
    });
    expect(sinConsent.out).toMatchObject({
      code: 'INVALID_ARGUMENT',
      field: 'data_processing_consent',
    });
    const extra = await s.call('v1_client_register_client', { ...s.registro, rol: 'admin' });
    expect(extra.out.code).toBe('INVALID_ARGUMENT');
    expect(extra.out.error).toContain('rol');
    const email = await s.call('v1_client_register_client', {
      ...s.registro,
      email: 'no-es-email',
    });
    expect(email.out.field).toBe('email');
    expect(s.llamadas).not.toContain('crearCliente');

    const ok = await s.call('v1_client_register_client', {
      ...s.registro,
      name: 'Ana\u202E\u0000 Prueba\u200B',
    });
    expect(ok.out.ok).toBe(true);
    expect([...s.clientes.values()][0]?.nombre).toBe('Ana Prueba');
  });

  it('makes request_quote idempotent and binds it to the registered contact', async () => {
    const s = setup();
    const token = await s.registrar();
    const args = {
      client_token: token,
      idempotency_key: 'quote-0001-abcdefgh',
      items: [{ slug: 'acme-x1', quantity: 2 }],
      message: 'Necesitamos 2 unidades',
    };
    const a = await s.call('v1_client_request_quote', args);
    const b = await s.call('v1_client_request_quote', args);
    expect(a.out).toMatchObject({
      ok: true,
      type: 'quote',
      status: 'received',
      sales_notified: true,
    });
    expect(b.out.request_id).toBe(a.out.request_id);
    expect(b.out.idempotent_replay).toBe(true);
    expect(s.solicitudes).toHaveLength(1);
    expect(s.avisos).toHaveLength(1);
    expect(s.solicitudes[0]).toMatchObject({
      nombre: 'Ana Prueba',
      email: 'ana@example.com',
      tipo_solicitud: 'cotizacion',
    });

    const conflicto = await s.call('v1_client_request_quote', {
      ...args,
      items: [{ slug: 'acme-y2' }],
    });
    expect(conflicto.out).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    const corta = await s.call('v1_client_request_quote', { ...args, idempotency_key: 'short' });
    expect(corta.out.code).toBe('INVALID_ARGUMENT');
    const suplanta = await s.call('v1_client_request_quote', {
      ...args,
      idempotency_key: 'quote-0002-abcdefgh',
      email: 'otra@example.com',
    });
    expect(suplanta.out.code).toBe('INVALID_ARGUMENT');

    const desconocido = {
      ...args,
      idempotency_key: 'quote-0003-abcdefgh',
      items: [{ slug: 'no-existe' }],
    };
    expect((await s.call('v1_client_request_quote', desconocido)).out.code).toBe('NOT_FOUND');
    const reintento = await s.call('v1_client_request_quote', {
      ...desconocido,
      items: [{ slug: 'acme-y2' }],
    });
    expect(reintento.out.ok).toBe(true);
    expect(s.solicitudes).toHaveLength(2);
  });

  it('validates request_contact', async () => {
    const s = setup();
    const token = await s.registrar();
    const base = { client_token: token, idempotency_key: 'contact-0001-abcdef' };
    const corto = await s.call('v1_client_request_contact', { ...base, message: 'hola' });
    expect(corto.out.code).toBe('INVALID_ARGUMENT');
    const ok = await s.call('v1_client_request_contact', {
      ...base,
      message: 'Queremos una demostración del equipo',
      product_slug: 'acme-x1',
    });
    expect(ok.out).toMatchObject({ ok: true, type: 'contact' });
    expect(s.solicitudes[0]?.tipo_solicitud).toBe('contacto');
  });

  it('exposes only whitelisted public catalog fields without registration', async () => {
    const s = setup();
    const { out } = await s.call('v1_client_list_catalog', { limit: 10 });
    expect(out.ok).toBe(true);
    expect(out.products).toHaveLength(2);
    for (const p of out.products as Json[]) {
      expect(Object.keys(p).sort()).toEqual(
        [
          'availability',
          'family',
          'has_product_sheet',
          'image_url',
          'name',
          'public_price_cop',
          'purchase_mode',
          'sku',
          'slug',
          'summary',
          'url',
        ].sort()
      );
    }
    expect(out.products[0].image_url).toBe('https://i-me.com.co/assets/productos/acme-x1.webp');
    const corta = await s.call('v1_client_search_catalog', { query: 'x' });
    expect(corta.out.code).toBe('INVALID_ARGUMENT');
    const ok = await s.call('v1_client_search_catalog', { query: 'equipo' });
    expect(ok.out.products).toHaveLength(2);
  });

  it('rate-limits by IP (HTTP 429), by registration scope, and fails closed if the limiter is down', async () => {
    const ip = setup({ limitar: ['ip'] });
    const r = await ip.call('v1_client_list_catalog');
    expect(r.res.status).toBe(429);
    expect(r.res.headers.get('retry-after')).toBe('60');

    const reg = setup({ limitar: ['reg'] });
    const out = (await reg.call('v1_client_register_client', reg.registro)).out;
    expect(out.code).toBe('RATE_LIMITED');
    expect(reg.llamadas).not.toContain('crearCliente');

    const caido = setup({ limiterThrows: true });
    expect((await caido.call('v1_client_list_catalog')).res.status).toBe(503);
  });

  it('does not execute anything when the audit log is unavailable', async () => {
    const s = setup({ auditThrows: true });
    const { json } = await s.call('v1_client_register_client', s.registro);
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text).toContain('Error interno');
    expect(s.llamadas).not.toContain('crearCliente');
    expect(s.llamadas).not.toContain('crearSolicitud');
  });

  it('enforces the transport contract', async () => {
    const s = setup();
    const conOrigin = await s.handler(
      new Request(endpoint, { method: 'POST', headers: { Origin: 'https://evil.example' } })
    );
    expect(conOrigin.status).toBe(403);
    expect((await s.handler(new Request(`${endpoint}/health`))).status).toBe(200);
    expect((await s.handler(new Request(endpoint, { method: 'GET' }))).status).toBe(405);
    const batch = await s.rpc([{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]);
    expect(batch.json?.error.code).toBe(-32600);
    const big = await s.handler(
      new Request(endpoint, {
        method: 'POST',
        headers: BASE_HEADERS,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
          params: { x: 'a'.repeat(70_000) },
        }),
      })
    );
    expect(big.status).toBe(413);
  });
});

describe('mcp-comercio: alcance de tokens (mejora del MCP existente)', () => {
  const operador = 'operator-test-token-'.repeat(3);
  const siguiente = 'rotation-test-token-'.repeat(3);
  const lectura = 'readonly-test-token-'.repeat(3);
  function op() {
    const ejecutadas: string[] = [];
    const handler = createCommerceHttpHandler({
      token: operador,
      nextToken: siguiente,
      readOnlyToken: lectura,
      consumeRateLimit: async () => true,
      execute: async (name, args) => {
        ejecutadas.push(`${name}:${String(args.rol)}`);
        return { ok: true };
      },
    });
    const post = async (tok: string, body: unknown): Promise<Json> => {
      const res = await handler(
        new Request('https://example.supabase.co/functions/v1/mcp-comercio', {
          method: 'POST',
          headers: { ...BASE_HEADERS, Authorization: `Bearer ${tok}` },
          body: JSON.stringify(body),
        })
      );
      return (await res.json()) as Json;
    };
    return { post, ejecutadas };
  }

  it('read-only token lists and runs only read tools, with forced read role', async () => {
    const { post, ejecutadas } = op();
    const list = await post(lectura, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names = (list.result.tools as Json[]).map(t => String(t.name));
    expect(new Set(names)).toEqual(HERRAMIENTAS_LECTURA);
    const write = await post(lectura, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'confirmar_reembolso', arguments: {} },
    });
    expect(write.error.message).toBe('Unknown tool');
    await post(lectura, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'buscar_productos', arguments: { rol: 'owner' } },
    });
    expect(ejecutadas).toEqual(['buscar_productos:lectura']);
  });

  it('rotation token keeps full operator scope and tools carry annotations', async () => {
    const { post } = op();
    const list = await post(siguiente, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const tools = list.result.tools as Array<{
      name: string;
      annotations: Record<string, boolean>;
    }>;
    expect(tools.length).toBeGreaterThan(HERRAMIENTAS_LECTURA.size);
    const borrar = tools.find(t => t.name === 'confirmar_borrado_crm');
    expect(borrar?.annotations.destructiveHint).toBe(true);
    expect(tools.find(t => t.name === 'buscar_pedidos')?.annotations.readOnlyHint).toBe(true);
    const invalido = await post('x'.repeat(40), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(invalido).toEqual({ error: 'Unauthorized' });
  });
});
