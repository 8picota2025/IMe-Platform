import { describe, expect, it } from 'vitest';
import {
  esSupervisorCotizacion,
  filtroListadoEquipo,
  puedeOperarCotizacion,
} from './cotizacion-ownership';

describe('puedeOperarCotizacion (F-06)', () => {
  it('admin/owner/service_role operan cualquier fila', () => {
    expect(
      puedeOperarCotizacion({
        rol: 'admin',
        userId: 'a',
        createdBy: 'b',
      })
    ).toBe(true);
    expect(
      puedeOperarCotizacion({
        rol: 'owner',
        userId: 'a',
        createdBy: 'b',
      })
    ).toBe(true);
    expect(
      puedeOperarCotizacion({
        rol: 'service_role',
        userId: null,
        createdBy: 'b',
      })
    ).toBe(true);
  });

  it('ventas solo opera propia o sin dueño (lead web)', () => {
    expect(
      puedeOperarCotizacion({
        rol: 'ventas',
        userId: 'u1',
        createdBy: 'u1',
      })
    ).toBe(true);
    expect(
      puedeOperarCotizacion({
        rol: 'ventas',
        userId: 'u1',
        createdBy: null,
      })
    ).toBe(true);
    expect(
      puedeOperarCotizacion({
        rol: 'ventas',
        userId: 'u1',
        createdBy: 'u2',
      })
    ).toBe(false);
  });

  it('ventas sin userId no opera', () => {
    expect(
      puedeOperarCotizacion({
        rol: 'ventas',
        userId: null,
        createdBy: null,
      })
    ).toBe(false);
  });
});

describe('filtroListadoEquipo', () => {
  it('ventas+equipo: propias + sin asignar, nunca bandeja ajena completa', () => {
    expect(filtroListadoEquipo({ rol: 'ventas', userId: 'u1', equipo: true })).toEqual({
      mode: 'own_or_unassigned',
    });
    expect(filtroListadoEquipo({ rol: 'ventas', userId: 'u1', equipo: false })).toEqual({
      mode: 'own',
    });
  });

  it('admin equipo ve todas; sin equipo solo propias', () => {
    expect(filtroListadoEquipo({ rol: 'admin', userId: 'a', equipo: true })).toEqual({
      mode: 'all',
    });
    expect(filtroListadoEquipo({ rol: 'admin', userId: 'a', equipo: false })).toEqual({
      mode: 'own',
    });
  });
});

describe('esSupervisorCotizacion', () => {
  it('reconoce supervisores', () => {
    expect(esSupervisorCotizacion('admin')).toBe(true);
    expect(esSupervisorCotizacion('owner')).toBe(true);
    expect(esSupervisorCotizacion('service_role')).toBe(true);
    expect(esSupervisorCotizacion('ventas')).toBe(false);
  });
});
