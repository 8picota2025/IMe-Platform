import { describe, expect, it } from 'vitest';

import {
  buildBiomedicalFallback,
  buildResilientFallbackResponse,
  parseStructuredAsesorResponse,
} from './asesor';

const contextoVacio: Parameters<typeof buildBiomedicalFallback>[0] = [];

describe('asesor biomedical fallback', () => {
  it('responde a un medico de urgencias sobre monitores sin derivar a WhatsApp', () => {
    const respuesta = buildBiomedicalFallback(
      contextoVacio,
      'es',
      'Soy médico de urgencias. Necesito un monitor para triage y observación, ¿qué debería considerar?'
    );

    expect(respuesta).toContain('robustez operativa');
    expect(respuesta).toContain('ECG');
    expect(respuesta).toContain('SpO2');
    expect(respuesta).not.toContain('WhatsApp');
  });

  it('responde orientacion INVIMA para importar monitor multiparametrico', () => {
    const respuesta = buildBiomedicalFallback(
      contextoVacio,
      'es',
      '¿Qué exige INVIMA para importar un monitor multiparamétrico a Colombia?'
    );

    expect(respuesta).toContain('clasificación de riesgo INVIMA');
    expect(respuesta).toContain('registro sanitario');
    expect(respuesta).toContain('documentación del fabricante');
  });

  it('diferencia bomba volumetrica y bomba de jeringa para UCI', () => {
    const respuesta = buildBiomedicalFallback(
      contextoVacio,
      'es',
      'Para una UCI de 10 camas, ¿qué diferencia práctica hay entre bomba de infusión volumétrica y bomba de jeringa?'
    );

    expect(respuesta).toContain('bomba volumétrica');
    expect(respuesta).toContain('bomba de jeringa');
    expect(respuesta).toContain('microdosis');
  });

  it('cualifica cotizacion de ecografo portatil con DICOM', () => {
    const respuesta = buildBiomedicalFallback(
      contextoVacio,
      'es',
      'Tenemos una IPS nivel 2 y queremos cotizar un ecógrafo portátil con DICOM. ¿Qué información necesitas?'
    );

    expect(respuesta).toContain('ecógrafo portátil con DICOM');
    expect(respuesta).toContain('servicio clínico');
    expect(respuesta).toContain('transductores');
  });

  it('parsea respuesta estructurada de IMEIA con handoff y slugs', () => {
    const respuesta = parseStructuredAsesorResponse(
      JSON.stringify({
        texto: 'Puedo ayudarte con un monitor para triage.',
        productos_citados: ['monitor-de-paciente-p1-biolight'],
        accion_handoff: {
          tipo: 'cotizacion',
          resumen: 'IPS nivel 2, monitor para triage y observación.',
        },
      }),
      'es'
    );

    expect(respuesta.texto).toContain('monitor para triage');
    expect(respuesta.productosCitados).toEqual(['monitor-de-paciente-p1-biolight']);
    expect(respuesta.accionHandoff).toEqual({
      tipo: 'cotizacion',
      resumen: 'IPS nivel 2, monitor para triage y observación.',
    });
  });

  it('usa el indice publicado del catalogo para responder con productos reales si falla la capa principal', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            slug: 'cama-de-atencion-domiciliaria-hb421',
            nombre: 'Cama de Atención Domiciliaria HB421',
            familia: { slug: 'mobiliario', nombre: 'Mobiliario Hospitalario' },
            tipo: { slug: 'camas-domiciliarias', nombre: 'Camas de Atención Domiciliaria' },
            descripcion_corta:
              'Cama hospitalaria para cuidado en casa con ajuste de posición y soporte a movilidad.',
            imagen_principal: 'https://example.com/hb421.jpg',
            texto_busqueda:
              'cama atencion domiciliaria hb421 mobiliario hospitalario cuidado en casa movilidad',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )) as typeof fetch;

    try {
      const respuesta = await buildResilientFallbackResponse({
        mensaje: 'Tienes alguna cama para uso en domicilio?',
        historial: [],
        locale: 'es',
      });

      expect(respuesta.texto).toContain('Sí, en nuestro catálogo tenemos');
      expect(respuesta.texto).toContain('Cama de Atención Domiciliaria HB421');
      expect(respuesta.texto).not.toContain('cualificación');
      expect(respuesta.productos).toHaveLength(1);
      expect(respuesta.productos[0]?.urlLanding).toBe(
        '/es/productos/cama-de-atencion-domiciliaria-hb421'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
