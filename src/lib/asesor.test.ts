import { describe, expect, it } from 'vitest';

import es from '../i18n/es.json';
import en from '../i18n/en.json';
import {
  buildBiomedicalFallback,
  buildResilientFallbackResponse,
  coerceAsesorEdgePayload,
  copyForAsesorError,
  extractFunctionsInvokeStatus,
  mapAsesorEdgeStatus,
  mapAsesorInvokeFailure,
  mapAsesorWidgetException,
  parseStructuredAsesorResponse,
  resetCatalogoPublicadoCache,
  resolveAsesorTransport,
} from './asesor';

const contextoVacio: Parameters<typeof buildBiomedicalFallback>[0] = [];

async function requireCatalogFallback(
  params: Parameters<typeof buildResilientFallbackResponse>[0]
) {
  const respuesta = await buildResilientFallbackResponse(params);
  expect(respuesta).not.toBeNull();
  if (!respuesta) throw new Error('expected catalog keyword fallback');
  return respuesta;
}

describe('asesor biomedical fallback', () => {
  it('usa Edge Function fuera de desarrollo local; nunca llama IMEIA directo desde navegador', () => {
    expect(resolveAsesorTransport('i-me.com.co')).toBe('supabase');
    expect(resolveAsesorTransport('preview.i-me.internal')).toBe('supabase');
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
      const respuesta = await requireCatalogFallback({
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
      const respuesta = await requireCatalogFallback({
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
      const respuesta = await requireCatalogFallback({
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
            slug: 'sistema-radiografico-3d-ref-wr-3d-angell',
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
      const respuesta = await requireCatalogFallback({
        mensaje:
          'Hablame del wr-3d, cómpralo con otros productos similares indicando sus ventajas.',
        historial: [],
        locale: 'es',
      });

      expect(respuesta.productos.map(producto => producto.slug)).toEqual([
        'sistema-radiografico-3d-ref-wr-3d-angell',
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
            slug: 'mamografo-digital-dm166-series-ref-dm166-angell',
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
      const respuesta = await requireCatalogFallback({
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
        'mamografo-digital-dm166-series-ref-dm166-angell',
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
            slug: 'sistema-de-ultrasonido-versatil-ref-dus-6000-advanced',
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
      const respuesta = await requireCatalogFallback({
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

  it('resuelve nombres parecidos por igualdad exacta, no por includes', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            slug: 'monitor-x-plus',
            nombre: 'Monitor X Plus',
            familia: { slug: 'monitores', nombre: 'Monitores' },
            tipo: null,
            descripcion_corta: 'Monitor ampliado.',
            imagen_principal: null,
            texto_busqueda: 'monitor x plus',
          },
          {
            slug: 'monitor-x',
            nombre: 'Monitor X',
            familia: { slug: 'monitores', nombre: 'Monitores' },
            tipo: null,
            descripcion_corta: 'Monitor base.',
            imagen_principal: null,
            texto_busqueda: 'monitor x',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    try {
      resetCatalogoPublicadoCache();
      const respuesta = await requireCatalogFallback({
        mensaje: '¿Cuál recomiendas?',
        historial: [
          { rol: 'usuario', contenido: 'Busco un monitor.', timestamp: new Date() },
          { rol: 'asesor', contenido: '1. Monitor X — Monitor base.', timestamp: new Date() },
        ],
        locale: 'es',
      });

      expect(respuesta.productos.map(producto => producto.slug)).toEqual(['monitor-x']);
      expect(respuesta.texto).not.toContain('Monitor X Plus');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('ancla la última shortlist por URLs ES y EN y conserva URLs del locale actual', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            slug: 'monitor-alpha',
            nombre: 'Alpha Monitor',
            familia: { slug: 'monitors', nombre: 'Monitors' },
            tipo: null,
            descripcion_corta: 'Alpha option.',
            imagen_principal: null,
            texto_busqueda: 'alpha monitor',
          },
          {
            slug: 'monitor-beta',
            nombre: 'Beta Monitor',
            familia: { slug: 'monitors', nombre: 'Monitors' },
            tipo: null,
            descripcion_corta: 'Beta option.',
            imagen_principal: null,
            texto_busqueda: 'beta monitor',
          },
          {
            slug: 'monitor-old',
            nombre: 'Old Monitor',
            familia: { slug: 'monitors', nombre: 'Monitors' },
            tipo: null,
            descripcion_corta: 'Older option.',
            imagen_principal: null,
            texto_busqueda: 'old monitor',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    try {
      resetCatalogoPublicadoCache();
      const respuesta = await requireCatalogFallback({
        mensaje: 'Which is better of those?',
        historial: [
          {
            rol: 'asesor',
            contenido: 'https://i-me.com.co/en/products/monitor-old/',
            timestamp: new Date(),
          },
          {
            rol: 'asesor',
            contenido:
              'https://i-me.com.co/es/productos/MONITOR-ALPHA/\nhttps://i-me.com.co/en/products/monitor-beta/',
            timestamp: new Date(),
          },
        ],
        locale: 'en',
      });

      expect(respuesta.productos.map(producto => producto.slug)).toEqual([
        'monitor-alpha',
        'monitor-beta',
      ]);
      expect(respuesta.productos.map(producto => producto.urlLanding)).toEqual([
        '/en/products/monitor-alpha/',
        '/en/products/monitor-beta/',
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('no inventa copy consultiva Hermes si el catálogo no encontró productos', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    try {
      resetCatalogoPublicadoCache();
      const respuesta = await buildResilientFallbackResponse({
        mensaje: 'Hola IMEia',
        historial: [],
        locale: 'es',
      });

      expect(respuesta).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('asesor Edge error mapping', () => {
  it('mapea 403 a verificación y 503/504 a no disponible, con clase precisa', () => {
    expect(mapAsesorEdgeStatus(403)).toEqual({
      tipo: 'verificacion',
      clase: 'turnstile_forbidden',
    });
    expect(mapAsesorEdgeStatus(503)).toEqual({
      tipo: 'no_disponible',
      clase: 'agent_unavailable',
    });
    expect(mapAsesorEdgeStatus(504)).toEqual({ tipo: 'no_disponible', clase: 'agent_timeout' });
    expect(mapAsesorEdgeStatus(429)).toEqual({
      tipo: 'rate_limited',
      clase: 'rate_limited',
      retryAfterSegundos: null,
    });
    expect(mapAsesorEdgeStatus(500)).toEqual({ tipo: 'error', clase: 'generic' });
    expect(mapAsesorEdgeStatus(null)).toEqual({ tipo: 'error', clase: 'generic' });
  });

  it('lee 403 desde el código FORBIDDEN aunque context no sea Response', () => {
    expect(
      extractFunctionsInvokeStatus({ context: { status: 502 } }, { error: { code: 'FORBIDDEN' } })
    ).toBe(403);
    expect(extractFunctionsInvokeStatus({ context: { status: 403 } }, null)).toBe(403);
    expect(extractFunctionsInvokeStatus({}, { error: { code: 'NOT_CONFIGURED' } })).toBe(503);
    expect(extractFunctionsInvokeStatus({}, { error: { code: 'AGENT_UNAVAILABLE' } })).toBe(503);
    expect(extractFunctionsInvokeStatus({}, { error: { code: 'AGENT_TIMEOUT' } })).toBe(504);
    expect(
      extractFunctionsInvokeStatus({ message: 'Supabase request timed out after 120000ms' }, null)
    ).toBe(504);
  });

  it('lee FORBIDDEN aunque el body llegue como string JSON', () => {
    expect(
      extractFunctionsInvokeStatus(
        { message: 'Edge Function returned a non-2xx status code' },
        '{"error":{"code":"FORBIDDEN","message":"Verificacion anti-bot fallida"}}'
      )
    ).toBe(403);
    expect(coerceAsesorEdgePayload('{"error":{"code":"FORBIDDEN"}}')).toEqual({
      error: { code: 'FORBIDDEN' },
    });
  });

  it('mapea FunctionsFetchError con AbortError anidado a 504, no a error genérico', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    const wrapped = new Error('Failed to send a request to the Edge Function', { cause: abort });
    expect(extractFunctionsInvokeStatus(wrapped, null)).toBe(504);
    expect(extractFunctionsInvokeStatus({ context: abort, message: 'Failed to send' }, null)).toBe(
      504
    );
  });

  it('clasifica excepciones del widget: Turnstile → turnstile_client, abort → invoke_abort', () => {
    expect(mapAsesorWidgetException(new Error('turnstile load error'))).toEqual({
      tipo: 'verificacion',
      clase: 'turnstile_client',
    });
    expect(mapAsesorWidgetException(new Error('Supabase request timed out after 30000ms'))).toEqual(
      {
        tipo: 'no_disponible',
        clase: 'invoke_timeout',
      }
    );
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    expect(mapAsesorWidgetException(abort)).toEqual({
      tipo: 'no_disponible',
      clase: 'invoke_abort',
    });
    expect(mapAsesorWidgetException(new Error('boom'))).toEqual({
      tipo: 'error',
      clase: 'generic',
    });
  });

  it('distingue AGENT_TIMEOUT, siteverify_timeout y missing_token en el payload Edge', () => {
    expect(
      mapAsesorInvokeFailure({
        status: 504,
        data: { error: { code: 'AGENT_TIMEOUT' } },
        error: null,
      })
    ).toEqual({ tipo: 'no_disponible', clase: 'agent_timeout' });
    expect(
      mapAsesorInvokeFailure({
        status: 403,
        data: {
          error: {
            code: 'FORBIDDEN',
            details: { reason: 'error', errorCodes: ['siteverify_timeout'] },
          },
        },
        error: null,
      })
    ).toEqual({
      tipo: 'verificacion',
      clase: 'siteverify_timeout',
      codes: ['siteverify_timeout'],
    });
    expect(
      mapAsesorInvokeFailure({
        status: 403,
        data: { error: { code: 'FORBIDDEN', details: { reason: 'missing_token' } } },
        error: null,
      })
    ).toEqual({ tipo: 'verificacion', clase: 'missing_token' });
    expect(
      mapAsesorInvokeFailure({
        status: 403,
        data: { error: { code: 'FORBIDDEN', details: { reason: 'not_configured' } } },
        error: null,
      })
    ).toEqual({ tipo: 'verificacion', clase: 'turnstile_not_configured' });
    expect(
      mapAsesorInvokeFailure({
        status: 503,
        data: {
          error: {
            code: 'NOT_CONFIGURED',
            message: 'BLOQUEANTE_BACKEND: anti-bot no configurado',
          },
        },
        error: null,
      })
    ).toEqual({ tipo: 'verificacion', clase: 'turnstile_not_configured' });
  });
});

describe('IMEIA welcome copy', () => {
  it('usa el saludo de alma WhatsApp y no el texto Hermes antiguo', () => {
    expect(es.asesor.bienvenida).toContain(
      'Hola, soy IMEIA, del equipo de I-ME, un gusto saludarte.'
    );
    expect(es.asesor.bienvenida).toContain('¿En qué equipo o especialidad te podemos orientar?');
    expect(es.asesor.bienvenida).not.toContain('asesora biomédica');
    expect(es.asesor.bienvenida).not.toContain('¿Cómo puedo ayudarle hoy?');
    expect(en.asesor.bienvenida).toContain("Hello, I'm IMEIA, from the I-ME team");
    expect(en.asesor.bienvenida).not.toContain('biomedical advisor');
  });

  it('mantiene copy honesta de verificación y nombra las clases de fallo', () => {
    expect(es.asesor.verificacion).toContain('verificación de seguridad');
    expect(es.asesor.verificacion_hint).toContain('casilla de seguridad');
    expect(es.asesor.verificacion_cargando).toContain('Cargando casilla');
    expect(en.asesor.verificacion).toContain('security check');
    expect(en.asesor.verificacion_hint).toContain('security checkbox');
    expect(en.asesor.verificacion_cargando).toContain('Loading security checkbox');
    expect(es.asesor.error_agent_timeout).toContain('AGENT_TIMEOUT');
    expect(es.asesor.error_invoke_abort).toContain('INVOKE_ABORT');
    expect(es.asesor.error_siteverify_timeout).toContain('SITEVERIFY_TIMEOUT');
    expect(es.asesor.error_missing_token).toContain('MISSING_TOKEN');
    expect(en.asesor.error_agent_timeout).toContain('AGENT_TIMEOUT');
    expect(en.asesor.error_invoke_abort).toContain('INVOKE_ABORT');
  });

  it('copyForAsesorError nombra la clase y anexa códigos Cloudflare', () => {
    expect(
      copyForAsesorError(
        { tipo: 'verificacion', clase: 'siteverify_timeout', codes: ['siteverify_timeout'] },
        {
          errorSiteverifyTimeout: 'Cloudflare no respondió (SITEVERIFY_TIMEOUT).',
          verificacion: 'verificación genérica',
          error: 'error genérico',
        }
      )
    ).toBe('Cloudflare no respondió (SITEVERIFY_TIMEOUT). (siteverify_timeout)');
    expect(
      copyForAsesorError(
        { tipo: 'no_disponible', clase: 'invoke_abort' },
        {
          errorInvokeAbort: 'Se cortó (INVOKE_ABORT).',
          noDisponible: 'no disponible',
          error: 'error',
        }
      )
    ).toBe('Se cortó (INVOKE_ABORT).');
  });
});
