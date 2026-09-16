import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from './supabase';
import { preguntarAsesor, resetCatalogoPublicadoCache } from './asesor';

const getClient = vi.mocked(getSupabaseClient);

function mockInvoke(result: unknown) {
  const invoke = vi.fn().mockResolvedValue(result);
  getClient.mockReturnValue({
    functions: { invoke },
  } as never);
  return invoke;
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

    expect(resultado).toEqual({ ok: false, error: { tipo: 'verificacion' } });
    if (resultado.ok) throw new Error('expected verification error');
    expect(JSON.stringify(resultado)).not.toContain('Podemos acotarlo');
  });

  it('expone 503 de backend como no disponible si no hay catálogo que mostrar', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

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
        mensaje: 'Hola IMEia',
        historial: [],
        locale: 'es',
      });

      expect(resultado).toEqual({ ok: false, error: { tipo: 'no_disponible' } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('usa fallback de catálogo solo cuando sí hay productos reales', async () => {
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

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) throw new Error('expected catalog fallback');
      expect(resultado.respuesta.productos).toHaveLength(1);
      expect(resultado.respuesta.texto).toContain('Cama de Atención Domiciliaria HB421');
      expect(resultado.respuesta.texto).not.toContain('Podemos acotarlo');
    } finally {
      globalThis.fetch = originalFetch;
    }
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

      expect(resultado).toEqual({ ok: false, error: { tipo: 'error' } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
