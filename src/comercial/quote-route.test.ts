import { describe, expect, it } from 'vitest';
import { cotizacionesListHash, parseCotizacionesRoute } from './quote-route';

describe('parseCotizacionesRoute', () => {
  it('lista pendientes por defecto', () => {
    expect(parseCotizacionesRoute('#/cotizaciones')).toMatchObject({
      mode: 'list',
      tab: 'pendientes',
      equipo: false,
    });
  });

  it('nueva y edit y equipo', () => {
    expect(parseCotizacionesRoute('#/cotizaciones/nueva')).toMatchObject({ mode: 'nueva' });
    expect(parseCotizacionesRoute('#/cotizaciones?id=new')).toMatchObject({ mode: 'nueva' });
    expect(parseCotizacionesRoute('#/cotizaciones?id=abc-1&tab=enviadas&equipo=1')).toMatchObject({
      mode: 'edit',
      id: 'abc-1',
      tab: 'enviadas',
      equipo: true,
    });
  });

  it('cotizacionesListHash omite defaults', () => {
    expect(cotizacionesListHash({})).toBe('#/cotizaciones');
    expect(cotizacionesListHash({ tab: 'enviadas', equipo: true, q: 'clinic', page: 2 })).toBe(
      '#/cotizaciones?tab=enviadas&equipo=1&q=clinic&page=2'
    );
  });
});
