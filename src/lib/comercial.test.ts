import { describe, expect, it } from 'vitest';
import { getAccionComercial } from './comercial';

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

  it('producto sin precio → cotizacion', () => {
    const accion = getAccionComercial({ precio: null, disponible: true }, 'es');
    expect(accion.tipo).toBe('cotizacion');
    expect(accion.tienePrecio).toBe(false);
  });

  it('precio 0 o invalido → cotizacion', () => {
    expect(getAccionComercial({ precio: 0 }, 'es').tipo).toBe('cotizacion');
    expect(getAccionComercial({ precio: NaN }, 'es').tipo).toBe('cotizacion');
  });
});
