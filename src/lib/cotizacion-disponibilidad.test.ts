import { describe, expect, it } from 'vitest';
import {
  indexProductosPorSlug,
  validarDisponibilidadLineasOferta,
} from './cotizacion-disponibilidad';

describe('validarDisponibilidadLineasOferta', () => {
  const catalog = indexProductosPorSlug([
    { slug: 'kit-a', activo: true, disponible: true },
    { slug: 'kit-off', activo: true, disponible: false },
    { slug: 'kit-dead', activo: false, disponible: true },
  ]);

  it('permite lineas con SKU activo y disponible', () => {
    expect(validarDisponibilidadLineasOferta([{ slug: 'kit-a' }], catalog)).toEqual({ ok: true });
  });

  it('rechaza disponible=false (Escenario A)', () => {
    const r = validarDisponibilidadLineasOferta([{ slug: 'kit-off' }], catalog);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PRODUCTO_NO_DISPONIBLE_TEMPORAL');
      expect(r.slug).toBe('kit-off');
    }
  });

  it('rechaza activo=false', () => {
    const r = validarDisponibilidadLineasOferta([{ slug: 'kit-dead' }], catalog);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('PRODUCTO_NO_DISPONIBLE');
      expect(r.slug).toBe('kit-dead');
    }
  });

  it('permite slug ausente del catalogo (linea individualizada)', () => {
    expect(validarDisponibilidadLineasOferta([{ slug: 'no-existe' }], catalog)).toEqual({
      ok: true,
    });
  });

  it('permite linea sin slug', () => {
    expect(validarDisponibilidadLineasOferta([{ slug: '  ' }, { slug: null }], catalog)).toEqual({
      ok: true,
    });
  });

  it('falla el SKU no disponible aunque haya otras lineas ok', () => {
    const r = validarDisponibilidadLineasOferta(
      [{ slug: 'kit-a' }, { slug: 'kit-off' }],
      catalog
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.slug).toBe('kit-off');
  });
});
