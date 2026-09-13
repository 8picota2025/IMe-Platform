import { describe, expect, it } from 'vitest';
import {
  pedidoDebeLiberarReserva,
  simularReservaConcurrente,
  stockDisponibleNumerico,
} from './stock-availability';

describe('stockDisponibleNumerico', () => {
  it('sin gestión → null', () => {
    expect(stockDisponibleNumerico(null, 0, false)).toBeNull();
  });

  it('físico − reservado', () => {
    expect(stockDisponibleNumerico(5, 2, true)).toBe(3);
    expect(stockDisponibleNumerico(1, 1, true)).toBe(0);
  });
});

describe('simularReservaConcurrente — última unidad', () => {
  it('solo un checkout gana con stock=1', () => {
    expect(simularReservaConcurrente(1, [1, 1])).toEqual([true, false]);
  });

  it('bundle all-or-nothing conceptual: dos demandas de 1 componente con stock 1', () => {
    // Dos checkouts del mismo componente: solo el primero reserva.
    expect(simularReservaConcurrente(1, [1, 1])).toEqual([true, false]);
  });
});

describe('pedidoDebeLiberarReserva', () => {
  it('libera en estados terminales no pagados', () => {
    expect(pedidoDebeLiberarReserva('rechazado')).toBe(true);
    expect(pedidoDebeLiberarReserva('pagado')).toBe(false);
    expect(pedidoDebeLiberarReserva('pendiente')).toBe(false);
  });
});
