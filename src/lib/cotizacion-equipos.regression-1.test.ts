// Regression: ISSUE-001 — Añadir a cotización increments by 2 on one click
// Found by /qa on 2026-07-26
// Report: ~/.gstack/qa-reports/qa-report-i-me-com-co-2026-07-26.md
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
});

describe('agregarACotizacion — single add', () => {
  beforeEach(() => {
    store.clear();
  });

  it('adds quantity 1 on the first call for a new product', async () => {
    const { agregarACotizacion, getCotizacionItems, getCotizacionCantidad } =
      await import('./cotizacion-equipos');

    agregarACotizacion({
      slug: 'tcq-iii',
      nombre: 'Detector Plano Inalámbrico TCQ-III',
      imagen: '/assets/productos/cat/tcq-iii.jpg',
    });

    expect(getCotizacionCantidad()).toBe(1);
    expect(getCotizacionItems()).toEqual([
      {
        slug: 'tcq-iii',
        nombre: 'Detector Plano Inalámbrico TCQ-III',
        imagen: '/assets/productos/cat/tcq-iii.jpg',
        cantidad: 1,
      },
    ]);
  });

  it('increments by 1 on a second explicit call (not 2)', async () => {
    const { agregarACotizacion, getCotizacionCantidad } = await import('./cotizacion-equipos');
    const item = {
      slug: 'tcq-iii',
      nombre: 'Detector Plano Inalámbrico TCQ-III',
      imagen: '/assets/productos/cat/tcq-iii.jpg',
    };

    agregarACotizacion(item);
    agregarACotizacion(item);

    expect(getCotizacionCantidad()).toBe(2);
  });

  it('asegurarProductoEnCotizacion no duplica si ya está en lista', async () => {
    const { agregarACotizacion, asegurarProductoEnCotizacion, getCotizacionCantidad } =
      await import('./cotizacion-equipos');
    const item = {
      slug: 'hua-ii',
      nombre: 'Arco C',
      imagen: '/assets/x.jpg',
    };
    agregarACotizacion(item);
    asegurarProductoEnCotizacion(item);
    expect(getCotizacionCantidad()).toBe(1);
  });
});
