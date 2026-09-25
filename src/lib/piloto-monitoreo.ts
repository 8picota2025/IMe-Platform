/**
 * Dashboard mínimo del piloto Monitoreo/UCI (mandato §24.12): embudo contenido → landing →
 * herramienta → lead, con la fuente de cada sesión. Lógica pura para el panel de Marketing
 * del admin; los datos son `analytics_eventos` (analítica propia, sin gate de consentimiento
 * según ADR-0012: cuenta todas las visitas) y `leads_comerciales`.
 */
import { CHECKLIST_RECEPCION_MONITOR_ID } from '../data/checklist-recepcion-monitor';

export type EtapaPiloto = 'contenido' | 'landing' | 'herramienta';

/** Artículos del cluster Monitoreo/UCI (mismo slug en ES y EN). */
const ARTICULOS_PILOTO = [
  'guia-monitores-multiparametricos-hospitalarios-colombia',
  'checklist-recepcion-instalacion-monitor-hospitalario',
  'monitores-uci-adulto-pediatrica-neonatal',
  'central-monitoreo-multicama-o-monitores-independientes',
  'guia-monitores-multiparametricos-uci',
];

const RUTAS_PILOTO: Record<string, EtapaPiloto> = {
  '/es/conocimiento/tema/monitoreo-uci/': 'contenido',
  '/en/knowledge/topic/monitoreo-uci/': 'contenido',
  ...Object.fromEntries(
    ARTICULOS_PILOTO.flatMap(slug => [
      [`/es/conocimiento/${slug}/`, 'contenido'],
      [`/en/knowledge/${slug}/`, 'contenido'],
    ])
  ),
  '/es/dotacion-monitoreo-uci/': 'landing',
  '/en/icu-monitoring-projects/': 'landing',
  '/es/recursos/checklist-recepcion-monitor/': 'herramienta',
  '/en/resources/monitor-receiving-checklist/': 'herramienta',
};

/** Rutas del piloto con y sin barra final, para filtrar `analytics_eventos.page_path`. */
export function rutasPiloto(): string[] {
  return Object.keys(RUTAS_PILOTO).flatMap(ruta => [ruta, ruta.replace(/\/$/, '')]);
}

export const CAMPANAS_PILOTO = ['herramienta', 'dotacion_monitoreo_uci'];

export function etapaDeRuta(path: string | null | undefined): EtapaPiloto | null {
  if (!path) return null;
  const normalizada = path.split(/[?#]/)[0]!.replace(/\/?$/, '/');
  return RUTAS_PILOTO[normalizada] ?? null;
}

export interface EventoPiloto {
  event_name: string;
  session_id: string;
  page_path?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
}

export interface LeadPiloto {
  campaign: string;
  tipo_proyecto?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
}

export function esLeadPiloto(lead: LeadPiloto): boolean {
  if (lead.campaign === 'dotacion_monitoreo_uci') return true;
  return lead.campaign === 'herramienta' && lead.tipo_proyecto === CHECKLIST_RECEPCION_MONITOR_ID;
}

export interface ResumenPiloto {
  etapas: Array<{ etapa: EtapaPiloto; vistas: number; sesiones: number }>;
  herramienta: { inicios: number; completados: number; descargas: number };
  leads: { total: number; herramienta: number; landing: number };
  fuentes: Array<{ fuente: string; sesiones: number; leads: number }>;
  paginas: Array<{ ruta: string; vistas: number }>;
}

function fuente(source?: string | null, medium?: string | null): string {
  return `${source?.trim() || 'directo'} / ${medium?.trim() || 'none'}`;
}

export function resumirPiloto(eventos: EventoPiloto[], leads: LeadPiloto[]): ResumenPiloto {
  const etapas: EtapaPiloto[] = ['contenido', 'landing', 'herramienta'];
  const porEtapa = new Map(etapas.map(e => [e, { vistas: 0, sesiones: new Set<string>() }]));
  const porPagina = new Map<string, number>();
  const sesionesPorFuente = new Map<string, Set<string>>();
  const herramienta = {
    inicios: new Set<string>(),
    completados: new Set<string>(),
    descargas: new Set<string>(),
  };

  for (const ev of eventos) {
    const etapa = etapaDeRuta(ev.page_path);
    if (!etapa) continue;
    if (ev.event_name === 'page_view') {
      const acc = porEtapa.get(etapa)!;
      acc.vistas += 1;
      acc.sesiones.add(ev.session_id);
      const ruta = ev.page_path!.split(/[?#]/)[0]!;
      porPagina.set(ruta, (porPagina.get(ruta) ?? 0) + 1);
      const clave = fuente(ev.utm_source, ev.utm_medium);
      const sesiones = sesionesPorFuente.get(clave) ?? new Set<string>();
      sesiones.add(ev.session_id);
      sesionesPorFuente.set(clave, sesiones);
    }
    if (ev.event_name === 'tool_start') herramienta.inicios.add(ev.session_id);
    if (ev.event_name === 'tool_complete') herramienta.completados.add(ev.session_id);
    if (ev.event_name === 'lead_magnet_download') herramienta.descargas.add(ev.session_id);
  }

  const leadsPiloto = leads.filter(esLeadPiloto);
  const leadsPorFuente = new Map<string, number>();
  for (const lead of leadsPiloto) {
    const clave = fuente(lead.utm_source, lead.utm_medium);
    leadsPorFuente.set(clave, (leadsPorFuente.get(clave) ?? 0) + 1);
  }

  const claves = new Set([...sesionesPorFuente.keys(), ...leadsPorFuente.keys()]);
  const fuentes = [...claves]
    .map(clave => ({
      fuente: clave,
      sesiones: sesionesPorFuente.get(clave)?.size ?? 0,
      leads: leadsPorFuente.get(clave) ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads || b.sesiones - a.sesiones);

  return {
    etapas: etapas.map(etapa => ({
      etapa,
      vistas: porEtapa.get(etapa)!.vistas,
      sesiones: porEtapa.get(etapa)!.sesiones.size,
    })),
    herramienta: {
      inicios: herramienta.inicios.size,
      completados: herramienta.completados.size,
      descargas: herramienta.descargas.size,
    },
    leads: {
      total: leadsPiloto.length,
      herramienta: leadsPiloto.filter(l => l.campaign === 'herramienta').length,
      landing: leadsPiloto.filter(l => l.campaign === 'dotacion_monitoreo_uci').length,
    },
    fuentes,
    paginas: [...porPagina.entries()]
      .map(([ruta, vistas]) => ({ ruta, vistas }))
      .sort((a, b) => b.vistas - a.vistas),
  };
}
