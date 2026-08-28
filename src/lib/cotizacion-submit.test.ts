import { describe, expect, it } from 'vitest';
import {
  interpretarErrorEdgeFunction,
  mensajeExitoCotizacion,
  normalizarPayloadCotizacion,
  resolverMensajeCotizacion,
} from './cotizacion-submit';

describe('cotizacion-submit', () => {
  it('conserva mensaje escrito por el usuario', () => {
    expect(
      resolverMensajeCotizacion({
        locale: 'es',
        mensaje: '  Necesito entrega urgente  ',
        productos: [{ slug: 'a', nombre: 'Monitor', cantidad: 1 }],
      })
    ).toBe('Necesito entrega urgente');
  });

  it('genera mensaje en español cuando hay productos sin detalle', () => {
    const mensaje = resolverMensajeCotizacion({
      locale: 'es',
      productos: [
        { slug: 'tcq', nombre: 'Detector TCQ-III', cantidad: 2 },
        { slug: 'monnal', nombre: 'Monnal T75', cantidad: 1, modelo: 'T75' },
      ],
    });
    expect(mensaje).toContain('Quiero solicitar cotización de:');
    expect(mensaje).toContain('- Detector TCQ-III (x2)');
    expect(mensaje).toContain('- Monnal T75 (Ref. T75)');
  });

  it('genera mensaje en inglés e incluye URL cuando existe', () => {
    const mensaje = resolverMensajeCotizacion({
      locale: 'en',
      productos: [
        {
          slug: 'x',
          nombre: 'Portable ultrasound',
          cantidad: 1,
          url: 'https://i-me.com.co/en/product/x',
        },
      ],
    });
    expect(mensaje).toContain('I would like a quote for:');
    expect(mensaje).toContain('Product page: https://i-me.com.co/en/product/x');
  });

  it('normalizarPayloadCotizacion rellena mensaje antes del invoke', () => {
    const payload = normalizarPayloadCotizacion({
      locale: 'es',
      mensaje: '',
      nombre: 'Ana',
      email: 'ana@example.com',
      telefono: '300',
      consentimiento_datos: true,
      productos: [{ slug: 'a', nombre: 'Equipo A', cantidad: 1 }],
    });
    expect(payload.mensaje).toContain('Equipo A');
  });

  it('interpretarErrorEdgeFunction lee mensaje del cuerpo JSON', async () => {
    const response = new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'nombre y mensaje son obligatorios' },
      }),
      { status: 400 }
    );
    await expect(interpretarErrorEdgeFunction({ context: response }, null)).resolves.toBe(
      'nombre y mensaje son obligatorios'
    );
  });

  it('interpretarErrorEdgeFunction lee mensaje RATE_LIMIT 429', async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: 'RATE_LIMIT',
          message: 'Demasiadas solicitudes de cotización. Espera unos minutos e intenta de nuevo.',
        },
      }),
      { status: 429 }
    );
    await expect(interpretarErrorEdgeFunction({ context: response }, null)).resolves.toContain(
      'Demasiadas solicitudes'
    );
  });

  it('mensajeExitoCotizacion menciona correo cuando se envió', () => {
    expect(mensajeExitoCotizacion('es', { interno: true, cliente: true })).toContain(
      'confirmación a tu correo'
    );
  });
});
