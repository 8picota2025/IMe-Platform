import { beforeAll, describe, expect, it, vi } from 'vitest';

const { client, tokenLookup } = vi.hoisted(() => {
  const tokenLookup = vi.fn(async () => ({
    data: { token: 'existing-cron-fixture' },
    error: null,
  }));
  const client = {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        lt: () => query,
        maybeSingle: tokenLookup,
        limit: async () => ({ data: table === 'carritos_abandonados' ? [] : null, error: null }),
      };
      return query;
    },
  };
  return { client, tokenLookup };
});
vi.mock('../supabase/functions/_shared/supabase-server.ts', () => ({
  getServerSupabase: () => client,
}));
vi.mock('../supabase/functions/_shared/email.ts', () => ({
  enviarEmailPlantilla: vi.fn(),
  escapeHtml: vi.fn(),
  itemsToHtml: vi.fn(),
}));
let handler: (request: Request) => Promise<Response>;
beforeAll(async () => {
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => (key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service-fixture' : undefined),
    },
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  });
  await import('../supabase/functions/recordatorio-carritos/index.ts');
  vi.unstubAllGlobals();
});

describe('recordatorio-carritos authentication', () => {
  it.each(['existing-cron-fixture', 'service-fixture'])(
    'accepts an existing authorized credential (%s)',
    async bearer => {
      // Deno.env is read per request; no real environment credentials are used.
      vi.stubGlobal('Deno', {
        env: {
          get: (key: string) =>
            key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service-fixture' : undefined,
        },
      });
      const response = await handler(
        new Request('https://test.invalid', { headers: { authorization: `Bearer ${bearer}` } })
      );
      expect(response.status).toBe(200);
      vi.unstubAllGlobals();
    }
  );
  it.each(['', 'wrong-fixture', 'eyJ.fake-unsigned-jwt'])(
    'rejects missing, wrong, or fabricated JWT credentials (%s)',
    async bearer => {
      vi.stubGlobal('Deno', { env: { get: () => 'service-fixture' } });
      const response = await handler(
        new Request('https://test.invalid', { headers: { authorization: `Bearer ${bearer}` } })
      );
      expect(response.status).toBe(401);
      vi.unstubAllGlobals();
    }
  );
  it('fails closed when the protected cron token cannot be read', async () => {
    tokenLookup.mockResolvedValueOnce({ data: null, error: { message: 'fixture' } } as never);
    vi.stubGlobal('Deno', { env: { get: () => 'service-fixture' } });
    const response = await handler(
      new Request('https://test.invalid', { headers: { authorization: 'Bearer wrong-fixture' } })
    );
    expect(response.status).toBe(503);
    vi.unstubAllGlobals();
  });
});
