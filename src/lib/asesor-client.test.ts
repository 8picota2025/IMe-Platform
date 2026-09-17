import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from './supabase';
import { preguntarAsesor, resetCatalogoPublicadoCache } from './asesor';

const getClient = vi.mocked(getSupabaseClient);

const CATALOG_COPY = 'Estas son las opciones de nuestro catálogo';

function mockInvoke(result: unknown) {
  const invoke = vi.fn().mockResolvedValue(result);
  getClient.mockReturnValue({
    functions: { invoke },
  } as never);
  return invoke;
}

function mockCatalogFetch() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          slug: 'cama-de-atencion-domiciliaria-hb421',
          nombre: 'Cama de Atención Domiciliaria HB421',
          familia: { slug: 'mobiliario', nombre: 'Mobiliario Hospitalario' },
          tipo: { slug: 'camas-domiciliarias', nombre: 'Camas de Atención Domiciliaria' },
          descripcion_corta: 'Cama hospitalaria para cuidado en casa.',
          imagen_principal: 'https://example.com/hb421.jpg',
          texto_busqueda: 'cama atencion domiciliaria hb421 mobiliario hospitalario',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe('preguntarAsesor error handling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    resetCatalogoPublicadoCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expone 403 Turnstile como error de verificación, sin copy consultiva falsa', async () => {
    mockInvoke({
      data: { error: { code: 'FORBIDDEN', message: 'Verificacion anti-bot fallida' } },
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 }),
      },
    });

    const resultado = await preguntarAsesor({
      mensaje: 'Hola IMEia',
      historial: [],
      locale: 'es',
    });

    expect(resultado).toEqual({
      ok: false,
      error: { tipo: 'verificacion', clase: 'turnstile_forbidden' },
    });
    if (resultado.ok) throw new Error('expected verification error');
    expect(JSON.stringify(resultado)).not.toContain('Podemos acotarlo');
    expect(JSON.stringify(resultado)).not.toContain(CATALOG_COPY);
  });

  it('expone 403 aunque supabase-js no entregue context.status', async () => {
    mockInvoke({
      data: { error: { code: 'FORBIDDEN', message: 'Verificacion anti-bot fallida' } },
      error: { message: 'Edge Function returned a non-2xx status code' },
    });

    const resultado = await preguntarAsesor({
      mensaje: 'Tienes alguna cama para uso en domicilio?',
      historial: [],
      locale: 'es',
    });

    expect(resultado).toEqual({
      ok: false,
      error: { tipo: 'verificacion', clase: 'turnstile_forbidden' },
    });
  });

  it('expone 403 cuando el body de error llega como string JSON', async () => {
    mockInvoke({
      data: '{"error":{"code":"FORBIDDEN","message":"Verificacion anti-bot fallida"}}',
      error: { message: 'Edge Function returned a non-2xx status code' },
    });

    const resultado = await preguntarAsesor({
      mensaje: 'Holter y desfibriladores',
      historial: [],
      locale: 'es',
    });

    expect(resultado).toEqual({
      ok: false,
      error: { tipo: 'verificacion', clase: 'turnstile_forbidden' },
    });
  });

  it('expone 503 de backend como no disponible, nunca shortlist de catálogo', async () => {
    const restoreFetch = mockCatalogFetch();
    try {
      mockInvoke({
        data: { error: { code: 'NOT_CONFIGURED' } },
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response(JSON.stringify({ error: { code: 'NOT_CONFIGURED' } }), {
            status: 503,
          }),
        },
      });

      const resultado = await preguntarAsesor({
        mensaje: 'Tienes alguna cama para uso en domicilio?',
        historial: [],
        locale: 'es',
      });

      expect(resultado).toEqual({
        ok: false,
        error: { tipo: 'no_disponible', clase: 'agent_unavailable' },
      });
      expect(JSON.stringify(resultado)).not.toContain(CATALOG_COPY);
    } finally {
      restoreFetch();
    }
  });

  it('expone timeout del agente como no disponible, no como IMEIA consultiva', async () => {
    const restoreFetch = mockCatalogFetch();
    try {
      mockInvoke({
        data: { error: { code: 'AGENT_TIMEOUT', message: 'IMEIA tardó más de lo esperado' } },
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response(JSON.stringify({ error: { code: 'AGENT_TIMEOUT' } }), {
            status: 504,
          }),
        },
      });

      const resultado = await preguntarAsesor({
        mensaje: 'Tienes alguna cama para uso en domicilio?',
        historial: [],
        locale: 'es',
      });

      expect(resultado).toEqual({
        ok: false,
        error: { tipo: 'no_disponible', clase: 'agent_timeout' },
      });
    } finally {
      restoreFetch();
    }
  });

  it('expone agente caído (503 AGENT_UNAVAILABLE) sin degradar a keyword_degradado', async () => {
    mockInvoke({
      data: { error: { code: 'AGENT_UNAVAILABLE' } },
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { status: 503 },
      },
    });

    const resultado = await preguntarAsesor({
      mensaje: 'Necesito una bomba de infusión para UCI',
      historial: [],
      locale: 'es',
    });

    expect(resultado).toEqual({
      ok: false,
      error: { tipo: 'no_disponible', clase: 'agent_unavailable' },
    });
  });

  it('en 500 no usa fallback de catálogo aunque haya productos reales', async () => {
    const restoreFetch = mockCatalogFetch();
    try {
      mockInvoke({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response('{}', { status: 500 }),
        },
      });

      const resultado = await preguntarAsesor({
        mensaje: 'Tienes alguna cama para uso en domicilio?',
        historial: [],
        locale: 'es',
      });

      expect(resultado).toEqual({
        ok: false,
        error: { tipo: 'error', clase: 'generic' },
      });
      expect(JSON.stringify(resultado)).not.toContain(CATALOG_COPY);
      expect(JSON.stringify(resultado)).not.toContain('Cama de Atención Domiciliaria HB421');
    } finally {
      restoreFetch();
    }
  });

  it('rechaza un 200 keyword_degradado para que no se haga pasar por IMEIA', async () => {
    mockInvoke({
      data: {
        texto: 'Estas son las opciones de nuestro catálogo que mejor encajan con lo que plantea:',
        productos: [
          {
            slug: 'cama-de-atencion-domiciliaria-hb421',
            nombre: 'Cama de Atención Domiciliaria HB421',
            imagen: null,
            url_landing: '/es/productos/cama-de-atencion-domiciliaria-hb421/',
            score: 0.9,
          },
        ],
        accion_handoff: null,
        modo: 'keyword_degradado',
      },
      error: null,
    });

    const resultado = await preguntarAsesor({
      mensaje: 'Tienes alguna cama para uso en domicilio?',
      historial: [],
      locale: 'es',
    });

    expect(resultado).toEqual({
      ok: false,
      error: { tipo: 'no_disponible', clase: 'agent_unavailable' },
    });
  });

  it('pasa la respuesta rag del agente sin reescribirla', async () => {
    const invoke = mockInvoke({
      data: {
        texto: 'Hola, soy IMEIA, del equipo de I-ME, un gusto saludarte.',
        productos: [],
        accion_handoff: null,
        modo: 'rag',
      },
      error: null,
    });

    const resultado = await preguntarAsesor({
      mensaje: 'Hola IMEia',
      historial: [],
      locale: 'es',
      turnstileToken: 'token-ok',
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1]?.body?.turnstileToken).toBe('token-ok');
    expect(resultado).toEqual({
      ok: true,
      respuesta: {
        texto: 'Hola, soy IMEIA, del equipo de I-ME, un gusto saludarte.',
        productos: [],
        accionHandoff: null,
        modo: 'rag',
      },
    });
  });

  it('en error genérico sin productos muestra fallo, no el cerebro falso', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    try {
      mockInvoke({
        data: null,
        error: { message: 'Failed to send a request to the Edge Function' },
      });

      const resultado = await preguntarAsesor({
        mensaje: 'Hola IMEia',
        historial: [],
        locale: 'es',
      });

      expect(resultado).toEqual({
        ok: false,
        error: { tipo: 'error', clase: 'generic' },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('expone AbortError envuelto por supabase-js como no_disponible, no error genérico', async () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    mockInvoke({
      data: null,
      error: new Error('Failed to send a request to the Edge Function', { cause: abort }),
    });

    const resultado = await preguntarAsesor({
      mensaje: 'Holter y desfibriladores',
      historial: [],
      locale: 'es',
    });

    expect(resultado).toEqual({
      ok: false,
      error: { tipo: 'no_disponible', clase: 'invoke_abort' },
    });
  });

  it('clasifica 403 siteverify_timeout y missing_token, no un FORBIDDEN genérico', async () => {
    mockInvoke({
      data: {
        error: {
          code: 'FORBIDDEN',
          message: 'Verificacion anti-bot fallida',
          details: { reason: 'error', errorCodes: ['siteverify_timeout'] },
        },
      },
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              details: { reason: 'error', errorCodes: ['siteverify_timeout'] },
            },
          }),
          { status: 403 }
        ),
      },
    });

    const timeout = await preguntarAsesor({
      mensaje: 'Tienes mamógrafos?',
      historial: [],
      locale: 'es',
    });
    expect(timeout).toEqual({
      ok: false,
      error: {
        tipo: 'verificacion',
        clase: 'siteverify_timeout',
        codes: ['siteverify_timeout'],
      },
    });

    mockInvoke({
      data: {
        error: {
          code: 'FORBIDDEN',
          message: 'Verificacion anti-bot fallida',
          details: { reason: 'missing_token', errorCodes: [] },
        },
      },
      error: { message: 'Edge Function returned a non-2xx status code', context: { status: 403 } },
    });
    const missing = await preguntarAsesor({
      mensaje: 'Holters please',
      historial: [],
      locale: 'en',
    });
    expect(missing).toEqual({
      ok: false,
      error: { tipo: 'verificacion', clase: 'missing_token' },
    });
  });

  it('envía el mensaje al agente aunque no haya turnstileToken (chat sin Cloudflare)', async () => {
    const invoke = mockInvoke({
      data: {
        texto: 'Sí, tenemos holters en catálogo.',
        productos: [],
        accion_handoff: null,
        modo: 'rag',
      },
      error: null,
    });

    const resultado = await preguntarAsesor({
      mensaje: 'Holters please',
      historial: [],
      locale: 'en',
    });

    expect(resultado.ok).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1]?.body?.turnstileToken).toBeUndefined();
  });

  it('hace poll corto cuando el edge responde pending + turn_id', async () => {
    vi.useFakeTimers();
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          status: 'pending',
          turn_id: '11111111-1111-4111-8111-111111111111',
          texto: '',
          productos: [],
          accion_handoff: null,
          modo: 'rag',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          status: 'pending',
          turn_id: '11111111-1111-4111-8111-111111111111',
          texto: '',
          productos: [],
          accion_handoff: null,
          modo: 'rag',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          status: 'replied',
          turn_id: '11111111-1111-4111-8111-111111111111',
          texto: 'Tenemos mesas quirúrgicas y lámparas en catálogo.',
          productos: [
            {
              slug: 'mesa-quirurgica-motorizada-multiposicion',
              nombre: 'Mesa quirúrgica',
              imagen: null,
              url_landing: '/es/productos/mesa-quirurgica-motorizada-multiposicion/',
              score: 1,
            },
          ],
          accion_handoff: null,
          modo: 'rag',
        },
        error: null,
      });
    getClient.mockReturnValue({ functions: { invoke } } as never);

    try {
      const pending = preguntarAsesor({
        mensaje: 'Busco equipar un quirófano',
        historial: [],
        locale: 'es',
      });
      await vi.runAllTimersAsync();
      const resultado = await pending;

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) throw new Error('expected success');
      expect(resultado.respuesta.texto).toContain('mesas quirúrgicas');
      expect(resultado.respuesta.productos).toHaveLength(1);
      expect(invoke).toHaveBeenCalledTimes(3);
      expect(invoke.mock.calls[1]![1].body.turnId).toBe('11111111-1111-4111-8111-111111111111');
    } finally {
      vi.useRealTimers();
    }
  });
});
