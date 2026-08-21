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
    slug: 'acise2026',
    name: 'ACISE2026',
    location: 'ACISE 2026',
  },
];

export function getCongresoEvent(slug: string | null): CongresoEvent {
  return CONGRESO_EVENTS.find(event => event.slug === slug) ?? CONGRESO_EVENTS[0]!;
}
