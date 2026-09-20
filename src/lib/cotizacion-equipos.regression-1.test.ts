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

describe('agregarACotizacion — flujo de cotización desde la ficha', () => {
  const item = { slug: 'equipo-x', nombre: 'Equipo X', imagen: '/x.jpg' };

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', new EventTarget());
  });

  it('respeta la cantidad seleccionada y acumula productos distintos', async () => {
    const { agregarACotizacion, getCotizacionItems, getCotizacionCantidad } =
      await import('./cotizacion-equipos');
    agregarACotizacion(item, 3, { abrir: false });
    agregarACotizacion({ slug: 'equipo-y', nombre: 'Equipo Y', imagen: '/y.jpg' }, 1, {
      abrir: false,
    });
    expect(getCotizacionItems().map(i => [i.slug, i.cantidad])).toEqual([
      ['equipo-x', 3],
      ['equipo-y', 1],
    ]);
    expect(getCotizacionCantidad()).toBe(4);
  });

  it('no abre el drawer con abrir:false, pero sí por defecto', async () => {
    const { agregarACotizacion, alAbrirCotizacion } = await import('./cotizacion-equipos');
    const abrir = vi.fn();
    alAbrirCotizacion(abrir);
    agregarACotizacion(item, 1, { abrir: false });
    expect(abrir).not.toHaveBeenCalled();
    agregarACotizacion(item, 1);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('normaliza cantidades inválidas y limita al máximo', async () => {
    const { normalizarCantidadCotizacion, CANTIDAD_MAXIMA_COTIZACION } =
      await import('./cotizacion-equipos');
    expect(normalizarCantidadCotizacion(0)).toBe(1);
    expect(normalizarCantidadCotizacion(-4)).toBe(1);
    expect(normalizarCantidadCotizacion('abc')).toBe(1);
    expect(normalizarCantidadCotizacion(2.9)).toBe(2);
    expect(normalizarCantidadCotizacion(10_000)).toBe(CANTIDAD_MAXIMA_COTIZACION);
  });
});
