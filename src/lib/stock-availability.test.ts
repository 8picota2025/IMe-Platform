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
  it('libera solo abandono definitivo (cancelado/expirado), no decline', () => {
    // Wompi allows multiple txs per reference and prefers APPROVED. Liberating
    // on DECLINED left consumir=0 on later APPROVED → oversell + dropship.
    expect(pedidoDebeLiberarReserva('rechazado')).toBe(false);
    expect(pedidoDebeLiberarReserva('error_verificacion')).toBe(false);
    expect(pedidoDebeLiberarReserva('cancelado')).toBe(true);
    expect(pedidoDebeLiberarReserva('expirado')).toBe(true);
    expect(pedidoDebeLiberarReserva('pagado')).toBe(false);
    expect(pedidoDebeLiberarReserva('pendiente')).toBe(false);
  });
});
