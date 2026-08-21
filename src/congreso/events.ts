export interface CongresoEvent {
  slug: string;
  name: string;
  location: string;
  startDate?: string;
  endDate?: string;
}

/** Configuración aditiva. No crea tablas ni modifica el CMS existente. */
export const CONGRESO_EVENTS: CongresoEvent[] = [
  {
    slug: 'congreso-2026',
    name: 'Congreso 2026',
    location: 'Por confirmar',
  },
];

export function getCongresoEvent(slug: string | null): CongresoEvent {
  return CONGRESO_EVENTS.find(event => event.slug === slug) ?? CONGRESO_EVENTS[0]!;
}
