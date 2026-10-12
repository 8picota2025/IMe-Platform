import { describe, expect, it } from 'vitest';
import { getAccionComercial, getProductPurchaseMode } from './comercial';

describe('getProductPurchaseMode — commerce vs quote', () => {
  it('precio válido → commerce aunque no haya stock', () => {
    expect(getProductPurchaseMode({ precio: 1000, disponible: true })).toBe('commerce');
    expect(
      getProductPurchaseMode({
        precio: 1000,
        disponible: true,
        stock: 0,
        gestionar_stock: true,
      })
    ).toBe('commerce');
    expect(getProductPurchaseMode({ precio: 1000, disponible: false })).toBe('commerce');
  });

  it('sin precio / inválido → quote (no implica agotado)', () => {
    expect(getProductPurchaseMode({ precio: null, disponible: true })).toBe('quote');
    expect(getProductPurchaseMode({ precio: 0 })).toBe('quote');
    expect(getProductPurchaseMode({ precio: NaN })).toBe('quote');
    expect(getProductPurchaseMode({ precio: undefined })).toBe('quote');
  });
});

describe('getAccionComercial — precio → carrito', () => {
  it('producto con precio > 0 y disponible → carrito (equipo o consumible)', () => {
    const accion = getAccionComercial({ precio: 500000, disponible: true }, 'es');
    expect(accion.tipo).toBe('carrito');
    expect(accion.tienePrecio).toBe(true);
  });

  it('producto con precio y disponible=false → consultar', () => {
    const accion = getAccionComercial({ precio: 500000, disponible: false }, 'es');
    expect(accion.tipo).toBe('consultar');
    expect(accion.tienePrecio).toBe(true);
  });

  it('producto con precio y stock 0 → consultar', () => {
    const accion = getAccionComercial(
      { precio: 500000, disponible: true, stock: 0, gestionar_stock: true },
      'es'
    );
    expect(accion.tipo).toBe('consultar');
  });

  it('producto sin precio → cotizacion', () => {
    const accion = getAccionComercial({ precio: null, disponible: true }, 'es');
    expect(accion.tipo).toBe('cotizacion');
    expect(accion.tienePrecio).toBe(false);
  });

  it('precio 0 o invalido → cotizacion', () => {
    expect(getAccionComercial({ precio: 0 }, 'es').tipo).toBe('cotizacion');
    expect(getAccionComercial({ precio: NaN }, 'es').tipo).toBe('cotizacion');
    expect(getAccionComercial({ precio: undefined }, 'es').tipo).toBe('cotizacion');
    expect(getAccionComercial({ precio: 'invalido' as unknown as number }, 'es').tipo).toBe(
      'cotizacion'
    );
  });
});
