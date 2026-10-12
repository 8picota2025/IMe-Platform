export type CotizacionesTab = 'pendientes' | 'enviadas' | 'cerradas';

export interface CotizacionesRoute {
  mode: 'list' | 'nueva' | 'edit' | 'escanear';
  id?: string;
  tab: CotizacionesTab;
  equipo: boolean;
  q: string;
  page: number;
  /** 1 = activas y archivadas; solo = solo archivadas. */
  archivadas: '' | '1' | 'solo';
}

export function parseCotizacionesRoute(hash: string): CotizacionesRoute {
  const stripped = hash.replace(/^#\/?/, '');
  const qIndex = stripped.indexOf('?');
  const path = (qIndex >= 0 ? stripped.slice(0, qIndex) : stripped).replace(/\/+$/, '');
  const query = new URLSearchParams(qIndex >= 0 ? stripped.slice(qIndex + 1) : '');
  const tabParam = query.get('tab');
  const tab: CotizacionesTab =
    tabParam === 'enviadas' || tabParam === 'cerradas' ? tabParam : 'pendientes';
  const equipo = query.get('equipo') === '1';
  const q = (query.get('q') ?? '').trim();
  const page = Math.max(1, Number.parseInt(query.get('page') ?? '1', 10) || 1);
  const archivadasParam = query.get('archivadas');
  const archivadas: CotizacionesRoute['archivadas'] =
    archivadasParam === '1' || archivadasParam === 'solo' ? archivadasParam : '';
  const id = (query.get('id') ?? '').trim();
  if (path === 'cotizaciones/escanear' || query.get('tab') === 'escanear') {
    return { mode: 'escanear', tab, equipo, q, page, archivadas };
  }
  if (path === 'cotizaciones/nueva' || id === 'new') {
    return { mode: 'nueva', tab, equipo, q, page, archivadas };
  }
  if (id) return { mode: 'edit', id, tab, equipo, q, page, archivadas };
  return { mode: 'list', tab, equipo, q, page, archivadas };
}

export function cotizacionesListHash(opts: {
  tab?: CotizacionesTab;
  equipo?: boolean;
  q?: string;
  page?: number;
  archivadas?: '' | '1' | 'solo';
}): string {
  const params = new URLSearchParams();
  if (opts.tab === 'enviadas' || opts.tab === 'cerradas') params.set('tab', opts.tab);
  if (opts.equipo) params.set('equipo', '1');
  if (opts.q) params.set('q', opts.q);
  if (opts.page && opts.page > 1) params.set('page', String(opts.page));
  if (opts.archivadas === '1' || opts.archivadas === 'solo')
    params.set('archivadas', opts.archivadas);
  const qs = params.toString();
  return qs ? `#/cotizaciones?${qs}` : '#/cotizaciones';
}

export const QUOTE_PREFILL_KEY = 'ime_quote_prefill_lines';

export interface QuotePrefillLine {
  slug: string;
  nombre: string;
  cantidad: number;
  /** Precio de catálogo si el producto lo tiene (>0). */
  precio_unitario?: number;
  moneda?: 'COP' | 'USD';
}

export function writeQuotePrefill(lines: QuotePrefillLine[]): void {
  try {
    globalThis.sessionStorage?.setItem(QUOTE_PREFILL_KEY, JSON.stringify(lines));
  } catch {
    /* ignore quota / missing storage */
  }
}

export function takeQuotePrefill(): QuotePrefillLine[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(QUOTE_PREFILL_KEY);
    globalThis.sessionStorage?.removeItem(QUOTE_PREFILL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => {
        const row = item as Record<string, unknown>;
        const precio = Number(row.precio_unitario ?? 0);
        const moneda =
          String(row.moneda ?? '').toUpperCase() === 'USD' ? ('USD' as const) : ('COP' as const);
        return {
          slug: String(row.slug ?? '').trim(),
          nombre: String(row.nombre ?? '').trim(),
          cantidad: Math.max(1, Math.floor(Number(row.cantidad) || 1)),
          precio_unitario: Number.isFinite(precio) && precio > 0 ? precio : 0,
          moneda,
        };
      })
      .filter(l => l.nombre || l.slug);
  } catch {
    return [];
  }
}
