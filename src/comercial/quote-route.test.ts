import { describe, expect, it } from 'vitest';
import {
  cotizacionesListHash,
  parseCotizacionesRoute,
  scopeQuoteRoute,
  takeQuotePrefill,
  writeQuotePrefill,
} from './quote-route';
import { resolveCatalogUnitPrice } from '../lib/cotizacion-oferta';

describe('parseCotizacionesRoute', () => {
  it('lista pendientes por defecto', () => {
    expect(parseCotizacionesRoute('#/cotizaciones')).toMatchObject({
      mode: 'list',
      tab: 'pendientes',
      equipo: false,
    });
  });

  it('nueva, escanear y edit y equipo', () => {
    expect(parseCotizacionesRoute('#/cotizaciones/nueva')).toMatchObject({ mode: 'nueva' });
    expect(parseCotizacionesRoute('#/cotizaciones?id=new')).toMatchObject({ mode: 'nueva' });
    expect(parseCotizacionesRoute('#/cotizaciones/escanear')).toMatchObject({ mode: 'escanear' });
    expect(parseCotizacionesRoute('#/cotizaciones?tab=escanear')).toMatchObject({
      mode: 'escanear',
    });
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

  it('ventas no puede forzar la bandeja Equipo por querystring', () => {
    const parsed = parseCotizacionesRoute('#/cotizaciones?equipo=1&tab=enviadas');
    expect(scopeQuoteRoute(parsed, false)).toMatchObject({ equipo: false, tab: 'enviadas' });
    expect(scopeQuoteRoute(parsed, true)).toMatchObject({ equipo: true, tab: 'enviadas' });
  });
});

describe('quote prefill precios', () => {
  it('persiste precio_unitario y moneda del catálogo', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: storage,
    });

    writeQuotePrefill([
      {
        slug: 'g-kbe-9000d',
        nombre: 'Silla',
        cantidad: 2,
        precio_unitario: 285000,
        moneda: 'COP',
      },
    ]);
    const lines = takeQuotePrefill();
    expect(lines).toEqual([
      {
        slug: 'g-kbe-9000d',
        nombre: 'Silla',
        cantidad: 2,
        precio_unitario: 285000,
        moneda: 'COP',
      },
    ]);
    expect(takeQuotePrefill()).toEqual([]);
  });
});

describe('resolveCatalogUnitPrice', () => {
  it('prioriza precio actual, luego oferta, luego regular', () => {
    expect(resolveCatalogUnitPrice({ precio: 100, precio_oferta: 80, precio_regular: 120 })).toBe(
      100
    );
    expect(resolveCatalogUnitPrice({ precio: null, precio_oferta: 80, precio_regular: 120 })).toBe(
      80
    );
    expect(resolveCatalogUnitPrice({ precio: 0, precio_oferta: null, precio_regular: 120 })).toBe(
      120
    );
    expect(
      resolveCatalogUnitPrice({ precio: null, precio_oferta: null, precio_regular: null })
    ).toBe(0);
  });
});
