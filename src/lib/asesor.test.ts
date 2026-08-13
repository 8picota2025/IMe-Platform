import { describe, expect, it } from 'vitest';

import {
  buildBiomedicalFallback,
  buildResilientFallbackResponse,
  parseStructuredAsesorResponse,
  resetCatalogoPublicadoCache,
  resolveAsesorTransport,
} from './asesor';

const contextoVacio: Parameters<typeof buildBiomedicalFallback>[0] = [];

describe('asesor biomedical fallback', () => {
  it('prioriza la edge function estable en produccion aunque exista URL directa de IMEIA', () => {
    expect(resolveAsesorTransport('i-me.com.co', { hasDirectImeiaUrl: true })).toBe('supabase');
    expect(resolveAsesorTransport('www.i-me.com.co', { hasDirectImeiaUrl: true })).toBe('supabase');
  });

  it('mantiene IMEIA directo disponible fuera del host de produccion', () => {
    expect(resolveAsesorTransport('preview.i-me.internal', { hasDirectImeiaUrl: true })).toBe(
      'imeia_direct'
    );
  });

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
      resetCatalogoPublicadoCache();
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
        '/es/productos/cama-de-atencion-domiciliaria-hb421/'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('filtra candidatos no equivalentes cuando la consulta es sobre bombas de infusion', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            slug: 'bomba-de-infusion-volumetrica-uci',
            nombre: 'Bomba de Infusión Volumétrica UCI',
            familia: { slug: 'terapia-infusion', nombre: 'Terapia de infusión' },
            tipo: { slug: 'bombas-infusion', nombre: 'Bombas de infusión' },
            descripcion_corta: 'Bomba de infusión volumétrica para UCI con alarmas de seguridad.',
            imagen_principal: 'https://example.com/bomba.jpg',
            texto_busqueda: 'bomba infusion volumetrica uci terapia de infusion alarmas seguridad',
          },
          {
            slug: 'skr-it625',
            nombre: 'Carro de Infusión SKR-IT625',
            familia: { slug: 'mobiliario', nombre: 'Mobiliario hospitalario' },
            tipo: { slug: 'carros-infusion', nombre: 'Carros de infusión' },
            descripcion_corta: 'Carro para transporte de bombas y suministros de infusión.',
            imagen_principal: 'https://example.com/carro.jpg',
            texto_busqueda: 'carro infusion bombas suministros infusion hospitalario',
          },
          {
            slug: 'a4051',
            nombre: 'Cuna de Calor Radiante A4051',
            familia: { slug: 'neonatologia', nombre: 'Neonatología' },
            tipo: { slug: 'calor-radiante', nombre: 'Cunas de calor radiante' },
            descripcion_corta: 'Sistema con bomba de calor para manejo térmico neonatal.',
            imagen_principal: 'https://example.com/cuna.jpg',
            texto_busqueda: 'cuna calor radiante bomba de calor neonatal',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )) as typeof fetch;

    try {
      resetCatalogoPublicadoCache();
      const respuesta = await buildResilientFallbackResponse({
        mensaje: 'I need an infusion pump for ICU',
        historial: [],
        locale: 'en',
      });

      expect(respuesta.productos.map(producto => producto.slug)).toEqual([
        'bomba-de-infusion-volumetrica-uci',
      ]);
      expect(respuesta.texto).toContain('Bomba de Infusión Volumétrica UCI');
      expect(respuesta.texto).not.toContain('Carro de Infusión');
      expect(respuesta.texto).not.toContain('Cuna de Calor');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('descarta desinfeccion y calor radiante cuando el usuario pide bombas de infusion en produccion degradada', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            slug: 'ip-200',
            nombre: 'Bomba de Infusión IP-200',
            familia: { slug: 'terapia-infusion', nombre: 'Terapia de infusión' },
            tipo: { slug: 'bombas-infusion', nombre: 'Bombas de infusión' },
            descripcion_corta: 'Bomba de infusión de volumen y goteo compacta.',
            imagen_principal: 'https://example.com/ip200.jpg',
            texto_busqueda: 'bomba infusion ip-200 volumen goteo terapia infusion',
          },
          {
            slug: 'vp-50',
            nombre: 'Bomba de Infusión VP-50',
            familia: { slug: 'terapia-infusion', nombre: 'Terapia de infusión' },
            tipo: { slug: 'bombas-infusion', nombre: 'Bombas de infusión' },
            descripcion_corta: 'Bomba de infusión de un canal para UCI.',
            imagen_principal: 'https://example.com/vp50.jpg',
            texto_busqueda: 'bomba infusion vp-50 canal uci terapia infusion',
          },
          {
            slug: 'esterilizador-xyz',
            nombre: 'Sistema de Desinfección XYZ',
            familia: { slug: 'control-infecciones', nombre: 'Control de infecciones' },
            tipo: { slug: 'desinfeccion', nombre: 'Desinfección' },
            descripcion_corta: 'Equipo para desinfección hospitalaria.',
            imagen_principal: 'https://example.com/desinfeccion.jpg',
            texto_busqueda: 'desinfeccion hospitalaria control infecciones esterilizacion',
          },
          {
            slug: 'a4051',
            nombre: 'Cuna de Calor Radiante A4051',
            familia: { slug: 'neonatologia', nombre: 'Neonatología' },
            tipo: { slug: 'calor-radiante', nombre: 'Cunas de calor radiante' },
            descripcion_corta: 'Sistema neonatal con bomba de calor.',
            imagen_principal: 'https://example.com/a4051.jpg',
            texto_busqueda: 'cuna calor radiante bomba calor neonatal',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )) as typeof fetch;

    try {
      resetCatalogoPublicadoCache();
      const respuesta = await buildResilientFallbackResponse({
        mensaje: '¿Qué bombas de infusión tienen?',
        historial: [],
        locale: 'es',
      });

      expect(respuesta.productos.map(producto => producto.slug)).toEqual(['ip-200', 'vp-50']);
      expect(respuesta.texto).toContain('Bomba de Infusión IP-200');
      expect(respuesta.texto).toContain('Bomba de Infusión VP-50');
      expect(respuesta.texto).not.toContain('Desinfección');
      expect(respuesta.texto).not.toContain('Calor Radiante');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('no mezcla productos no relacionados cuando el usuario menciona explicitamente WR-3D', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            slug: 'sistema-radiografico-3d-wr-3d',
            nombre: 'Sistema Radiográfico 3D WR-3D',
            familia: { slug: 'imagenologia-y-radiologia', nombre: 'Imagenología y Radiología' },
            tipo: { slug: 'radiografia-digital-dr', nombre: 'Radiografía Digital DR' },
            descripcion_corta: 'Sistema radiográfico 3D en posición de carga con CBCT.',
            imagen_principal: 'https://example.com/wr3d.jpg',
            texto_busqueda:
              'sistema radiografico 3d wr 3d posicion carga cbct imagenologia radiologia',
          },
          {
            slug: 'sistema-radiografico-3d-en-carga-wr-3d',
            nombre: 'Sistema Radiográfico 3D en Carga WR-3D',
            familia: { slug: 'imagenologia-y-radiologia', nombre: 'Imagenología y Radiología' },
            tipo: { slug: 'radiografia-digital-dr', nombre: 'Radiografía Digital DR' },
            descripcion_corta:
              'Sistema de radiografía digital con reconstrucción volumétrica 3D para columna completa y miembros inferiores en posición de carga.',
            imagen_principal: 'https://example.com/wr3d-carga.jpg',
            texto_busqueda:
              'sistema radiografico 3d carga wr 3d reconstruccion volumetrica columna miembros inferiores',
          },
          {
            slug: 'klorsept-granulos-500gr-ref-1013-medentech',
            nombre: 'Klorsept Gránulos 500gr Ref 1013 Medentech',
            familia: { slug: 'control-infecciones', nombre: 'Control de infecciones' },
            tipo: { slug: 'desinfeccion', nombre: 'Desinfección' },
            descripcion_corta: 'Absorción y desinfección de derrames líquidos contaminados.',
            imagen_principal: 'https://example.com/klorsept.jpg',
            texto_busqueda: 'klorsept granulos desinfeccion derrames fluidos sangre',
          },
          {
            slug: 'sistema-resusa-tee-ref-10-51504-mercury',
            nombre: 'Sistema Resusa-Tee Ref 10-51504 Mercury',
            familia: { slug: 'neonatologia', nombre: 'Neonatología' },
            tipo: { slug: 'reanimacion-neonatal', nombre: 'Reanimación Neonatal' },
            descripcion_corta: 'Circuito reanimador neonatal de pieza en T.',
            imagen_principal: 'https://example.com/resusa.jpg',
            texto_busqueda: 'resusa tee circuito reanimador neonatal pip peep',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )) as typeof fetch;

    try {
      resetCatalogoPublicadoCache();
      const respuesta = await buildResilientFallbackResponse({
        mensaje:
          'Hablame del wr-3d, cómpralo con otros productos similares indicando sus ventajas.',
        historial: [],
        locale: 'es',
      });

      expect(respuesta.productos.map(producto => producto.slug)).toEqual([
        'sistema-radiografico-3d-wr-3d',
        'sistema-radiografico-3d-en-carga-wr-3d',
      ]);
      expect(respuesta.texto).toContain('Sistema Radiográfico 3D WR-3D');
      expect(respuesta.texto).toContain('Sistema Radiográfico 3D en Carga WR-3D');
      expect(respuesta.texto).not.toContain('Klorsept');
      expect(respuesta.texto).not.toContain('Resusa-Tee');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('en follow-up "mejor de los dos" reusa mamógrafos y no salta a bombas/glucómetros (caso 1308b)', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            slug: 'mamografo-digital-dm166-series',
            nombre: 'Mamógrafo digital DM166 Series Angell con tomosíntesis 3D y CESM',
            familia: { slug: 'imagenologia', nombre: 'Imagenología' },
            tipo: { slug: 'mamografia', nombre: 'Mamografía' },
            descripcion_corta:
              'Mamógrafo digital Angell configurable con tomosíntesis 3D de ángulo amplio, detector de alta resolución y opción CESM',
            imagen_principal: 'https://example.com/dm166.jpg',
            texto_busqueda: 'mamografo digital dm166 angell tomosintesis cesm',
          },
          {
            slug: 'mamografo-digital-dm156-series',
            nombre: 'Mamógrafo Digital DM156 Series',
            familia: { slug: 'imagenologia', nombre: 'Imagenología' },
            tipo: { slug: 'mamografia', nombre: 'Mamografía' },
            descripcion_corta: 'Mamógrafo digital con detector de 24×30cm y tomosíntesis 2D/3D',
            imagen_principal: 'https://example.com/dm156.jpg',
            texto_busqueda: 'mamografo digital dm156 tomosintesis',
          },
          {
            slug: 'bomba-jeringa-precision-microdosis',
            nombre: 'Bomba de Jeringa Precisión Microdosis',
            familia: { slug: 'terapia-infusion', nombre: 'Terapia de infusión' },
            tipo: { slug: 'bombas-jeringa', nombre: 'Bombas de jeringa' },
            descripcion_corta: 'Bomba de jeringa para microdosis en UCI',
            imagen_principal: 'https://example.com/bomba.jpg',
            texto_busqueda: 'bomba jeringa precision microdosis uci',
          },
          {
            slug: 'glucometro-latidos',
            nombre: 'Glucómetro Latidos',
            familia: { slug: 'diagnostico', nombre: 'Diagnóstico' },
            tipo: { slug: 'glucometros', nombre: 'Glucómetros' },
            descripcion_corta: 'Glucómetro Latidos LTD-B10',
            imagen_principal: 'https://example.com/gluco.jpg',
            texto_busqueda: 'glucometro latidos',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )) as typeof fetch;

    try {
      resetCatalogoPublicadoCache();
      const respuesta = await buildResilientFallbackResponse({
        mensaje: 'Cuál es el mejor de los dos ?',
        historial: [
          {
            rol: 'usuario',
            contenido: 'Tienes algún otro mamógrafo?',
            timestamp: new Date(),
          },
          {
            rol: 'asesor',
            contenido: [
              'Sí, en nuestro catálogo tenemos estas opciones que encajan con lo que busca:',
              '',
              '1.\u00a0Mamógrafo digital DM166 Series Angell con tomosíntesis 3D y CESM\u00a0— Mamógrafo digital Angell',
              '2.\u00a0Mamógrafo Digital DM156 Series\u00a0— Mamógrafo digital con detector',
            ].join('\n'),
            timestamp: new Date(),
          },
        ],
        locale: 'es',
      });

      expect(respuesta.productos.map(p => p.slug)).toEqual([
        'mamografo-digital-dm166-series',
        'mamografo-digital-dm156-series',
      ]);
      expect(respuesta.texto).toMatch(/DM166|DM156/);
      expect(respuesta.texto).not.toContain('Bomba de Jeringa');
      expect(respuesta.texto).not.toContain('Glucómetro');
      expect(respuesta.modo).toBe('rag');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('en follow-up "más versátil" reusa shortlist y no salta a ultrasonido/máscaras (caso 1308)', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            slug: 'sistema-radiografico-3d-en-carga-wr-3d',
            nombre: 'Sistema radiográfico 3D en carga WR-3D Angell Technology',
            familia: { slug: 'imagenologia-y-radiologia', nombre: 'Imagenología y Radiología' },
            tipo: { slug: 'radiografia-digital-dr', nombre: 'Radiografía Digital DR' },
            descripcion_corta:
              'Sistema CBCT de radiografía 3D en bipedestación para columna, pelvis y miembros inferiores con reconstrucción MPR, MIP y VR',
            imagen_principal: 'https://example.com/wr3d.jpg',
            texto_busqueda: 'sistema radiografico 3d carga wr 3d cbct bipedestacion',
          },
          {
            slug: 'equipo-movil-radiografia-digital-dinamica-lingxi',
            nombre: 'Equipo Móvil de Radiografía Digital Dinámica Lingxi',
            familia: { slug: 'imagenologia-y-radiologia', nombre: 'Imagenología y Radiología' },
            tipo: { slug: 'radiografia-digital-dr', nombre: 'Radiografía Digital DR' },
            descripcion_corta: 'Unidad móvil de radiografía digital dinámica',
            imagen_principal: 'https://example.com/lingxi.jpg',
            texto_busqueda: 'equipo movil radiografia digital dinamica lingxi',
          },
          {
            slug: 'sistema-radiografia-digital-dinamica-techo-qomo',
            nombre: 'Sistema de Radiografía Digital Dinámica de Techo QOMO',
            familia: { slug: 'imagenologia-y-radiologia', nombre: 'Imagenología y Radiología' },
            tipo: { slug: 'radiografia-digital-dr', nombre: 'Radiografía Digital DR' },
            descripcion_corta: 'Sistema de radiografía digital de techo con doble detector',
            imagen_principal: 'https://example.com/qomo.jpg',
            texto_busqueda: 'sistema radiografia digital dinamica techo qomo',
          },
          {
            slug: 'sistema-de-ultrasonido-versatil-dus-6000',
            nombre: 'Sistema de Ultrasonido Versátil DUS-6000',
            familia: { slug: 'ultrasonido', nombre: 'Ultrasonido' },
            tipo: { slug: 'ultrasonido', nombre: 'Ultrasonido' },
            descripcion_corta: 'Sistema de ultrasonido versátil portátil',
            imagen_principal: 'https://example.com/dus.jpg',
            texto_busqueda: 'sistema ultrasonido versatil dus 6000',
          },
          {
            slug: 'mascara-nivairo',
            nombre: 'Máscara Nivairo Fisher & Paykel',
            familia: { slug: 'anestesia', nombre: 'Anestesia' },
            tipo: { slug: 'mascaras', nombre: 'Máscaras' },
            descripcion_corta: 'Máscara nasal NIVAIRO',
            imagen_principal: 'https://example.com/nivairo.jpg',
            texto_busqueda: 'mascara nivairo fisher paykel',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )) as typeof fetch;

    try {
      resetCatalogoPublicadoCache();
      const respuesta = await buildResilientFallbackResponse({
        mensaje: 'Cuál es el más versátil y completo?',
        historial: [
          {
            rol: 'usuario',
            contenido: 'Radiografía en 3d en un ambulatorio',
            timestamp: new Date(),
          },
          {
            rol: 'asesor',
            contenido: [
              'Estas son las opciones de nuestro catálogo que mejor encajan con lo que plantea:',
              '',
              '1. Sistema radiográfico 3D en carga WR-3D Angell Technology — Sistema CBCT de radiografía 3D en bipedestación',
              '2. Equipo Móvil de Radiografía Digital Dinámica Lingxi — Unidad móvil de radiografía digital dinámica',
              '3. Sistema de Radiografía Digital Dinámica de Techo QOMO — Sistema de radiografía digital de techo',
            ].join('\n'),
            timestamp: new Date(),
          },
        ],
        locale: 'es',
      });

      expect(respuesta.texto).toContain('WR-3D');
      expect(respuesta.texto).toMatch(/más completa|más versátil/i);
      expect(respuesta.productos.map(p => p.slug)).toEqual([
        'sistema-radiografico-3d-en-carga-wr-3d',
        'equipo-movil-radiografia-digital-dinamica-lingxi',
        'sistema-radiografia-digital-dinamica-techo-qomo',
      ]);
      expect(respuesta.texto).not.toContain('DUS-6000');
      expect(respuesta.texto).not.toContain('Nivairo');
      expect(respuesta.modo).toBe('rag');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
