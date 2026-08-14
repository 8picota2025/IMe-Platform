export type CotizacionesTab = 'pendientes' | 'enviadas';

export interface CotizacionesRoute {
  mode: 'list' | 'nueva' | 'edit';
  id?: string;
  tab: CotizacionesTab;
  equipo: boolean;
  q: string;
  page: number;
}

export function parseCotizacionesRoute(hash: string): CotizacionesRoute {
  const stripped = hash.replace(/^#\/?/, '');
  const qIndex = stripped.indexOf('?');
  const path = (qIndex >= 0 ? stripped.slice(0, qIndex) : stripped).replace(/\/+$/, '');
  const query = new URLSearchParams(qIndex >= 0 ? stripped.slice(qIndex + 1) : '');
  const tab: CotizacionesTab = query.get('tab') === 'enviadas' ? 'enviadas' : 'pendientes';
  const equipo = query.get('equipo') === '1';
  const q = (query.get('q') ?? '').trim();
  const page = Math.max(1, Number.parseInt(query.get('page') ?? '1', 10) || 1);
  const id = (query.get('id') ?? '').trim();
  if (path === 'cotizaciones/nueva' || id === 'new') {
    return { mode: 'nueva', tab, equipo, q, page };
  }
  if (id) return { mode: 'edit', id, tab, equipo, q, page };
  return { mode: 'list', tab, equipo, q, page };
}

export function cotizacionesListHash(opts: {
  tab?: CotizacionesTab;
  equipo?: boolean;
  q?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (opts.tab === 'enviadas') params.set('tab', 'enviadas');
  if (opts.equipo) params.set('equipo', '1');
  if (opts.q) params.set('q', opts.q);
  if (opts.page && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();
  return qs ? `#/cotizaciones?${qs}` : '#/cotizaciones';
}

export const QUOTE_PREFILL_KEY = 'ime_quote_prefill_lines';

export interface QuotePrefillLine {
  slug: string;
  nombre: string;
  cantidad: number;
}

export function writeQuotePrefill(lines: QuotePrefillLine[]): void {
  try {
    sessionStorage.setItem(QUOTE_PREFILL_KEY, JSON.stringify(lines));
  } catch {
    /* ignore quota */
  }
}

export function takeQuotePrefill(): QuotePrefillLine[] {
  try {
    const raw = sessionStorage.getItem(QUOTE_PREFILL_KEY);
    sessionStorage.removeItem(QUOTE_PREFILL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => {
        const row = item as Record<string, unknown>;
        return {
          slug: String(row.slug ?? '').trim(),
          nombre: String(row.nombre ?? '').trim(),
          cantidad: Math.max(1, Math.floor(Number(row.cantidad) || 1)),
        };
      })
      .filter(l => l.nombre || l.slug);
  } catch {
    return [];
  }
}
