import { describe, expect, it } from 'vitest';
import { getLocalizedPath } from '../i18n/utils';
import { esLeadPiloto, etapaDeRuta, resumirPiloto } from './piloto-monitoreo';

describe('etapaDeRuta', () => {
  it('clasifica las páginas del piloto en ES y EN, con o sin barra final y query', () => {
    expect(etapaDeRuta('/es/conocimiento/tema/monitoreo-uci/')).toBe('contenido');
    expect(etapaDeRuta('/en/knowledge/monitores-uci-adulto-pediatrica-neonatal')).toBe('contenido');
    expect(etapaDeRuta('/es/dotacion-monitoreo-uci/?utm_source=linkedin')).toBe('landing');
    expect(etapaDeRuta('/en/resources/monitor-receiving-checklist/')).toBe('herramienta');
  });

  it('deja fuera el resto del sitio', () => {
    expect(etapaDeRuta('/es/')).toBeNull();
    expect(etapaDeRuta('/es/monitores-biolight-uci/')).toBeNull();
    expect(etapaDeRuta(null)).toBeNull();
  });

  it('las rutas EN del piloto son las alternas reales de las ES', () => {
    for (const es of [
      '/es/conocimiento/tema/monitoreo-uci/',
      '/es/dotacion-monitoreo-uci/',
      '/es/recursos/checklist-recepcion-monitor/',
    ]) {
      expect(etapaDeRuta(getLocalizedPath(es, 'en')), es).toBe(etapaDeRuta(es));
    }
  });
});

describe('esLeadPiloto', () => {
  it('cuenta la landing y sólo la herramienta del checklist', () => {
    expect(esLeadPiloto({ campaign: 'dotacion_monitoreo_uci' })).toBe(true);
    expect(
      esLeadPiloto({ campaign: 'herramienta', tipo_proyecto: 'checklist-recepcion-monitor' })
    ).toBe(true);
    expect(esLeadPiloto({ campaign: 'herramienta', tipo_proyecto: 'otra-herramienta' })).toBe(
      false
    );
    expect(esLeadPiloto({ campaign: 'monitores_biolight' })).toBe(false);
  });
});

describe('resumirPiloto', () => {
  const eventos = [
    {
      event_name: 'page_view',
      session_id: 's1',
      page_path: '/es/conocimiento/tema/monitoreo-uci/',
    },
    { event_name: 'page_view', session_id: 's1', page_path: '/es/dotacion-monitoreo-uci/' },
    {
      event_name: 'page_view',
      session_id: 's2',
      page_path: '/es/dotacion-monitoreo-uci/',
      utm_source: 'linkedin',
      utm_medium: 'social',
    },
    {
      // La analítica propia arrastra la UTM de la sesión a cada evento.
      event_name: 'page_view',
      session_id: 's2',
      page_path: '/es/recursos/checklist-recepcion-monitor/',
      utm_source: 'linkedin',
      utm_medium: 'social',
    },
    {
      event_name: 'tool_start',
      session_id: 's2',
      page_path: '/es/recursos/checklist-recepcion-monitor/',
    },
    {
      event_name: 'tool_start',
      session_id: 's2',
      page_path: '/es/recursos/checklist-recepcion-monitor/',
    },
    {
      event_name: 'lead_magnet_download',
      session_id: 's2',
      page_path: '/es/recursos/checklist-recepcion-monitor/',
    },
    { event_name: 'page_view', session_id: 's3', page_path: '/es/catalogo/' },
  ];
  const leads = [
    {
      campaign: 'herramienta',
      tipo_proyecto: 'checklist-recepcion-monitor',
      utm_source: 'linkedin',
      utm_medium: 'social',
    },
    { campaign: 'dotacion_monitoreo_uci' },
    { campaign: 'monitores_biolight' },
  ];

  it('cuenta vistas y sesiones únicas por etapa, sin páginas ajenas', () => {
    const r = resumirPiloto(eventos, leads);
    expect(r.etapas).toEqual([
      { etapa: 'contenido', vistas: 1, sesiones: 1 },
      { etapa: 'landing', vistas: 2, sesiones: 2 },
      { etapa: 'herramienta', vistas: 1, sesiones: 1 },
    ]);
    expect(r.paginas[0]).toEqual({ ruta: '/es/dotacion-monitoreo-uci/', vistas: 2 });
  });

  it('cuenta la herramienta por sesión y sólo los leads del piloto', () => {
    const r = resumirPiloto(eventos, leads);
    expect(r.herramienta).toEqual({ inicios: 1, completados: 0, descargas: 1 });
    expect(r.leads).toEqual({ total: 2, herramienta: 1, landing: 1 });
  });

  it('cruza sesiones y leads por fuente', () => {
    const r = resumirPiloto(eventos, leads);
    expect(r.fuentes).toHaveLength(2);
    expect(r.fuentes).toContainEqual({ fuente: 'linkedin / social', sesiones: 1, leads: 1 });
    expect(r.fuentes).toContainEqual({ fuente: 'directo / none', sesiones: 1, leads: 1 });
  });

  it('ordena primero las fuentes que traen leads', () => {
    const r = resumirPiloto(
      [
        { event_name: 'page_view', session_id: 'a', page_path: '/es/dotacion-monitoreo-uci/' },
        { event_name: 'page_view', session_id: 'b', page_path: '/es/dotacion-monitoreo-uci/' },
      ],
      [{ campaign: 'dotacion_monitoreo_uci', utm_source: 'linkedin', utm_medium: 'social' }]
    );
    expect(r.fuentes[0]?.fuente).toBe('linkedin / social');
  });
});
