import { describe, expect, it } from 'vitest';
import {
  normalizeStockReserveItems,
  pedidoDebeLiberarReserva,
  simularReservaConcurrente,
  stockDisponibleNumerico,
  STOCK_RESERVA_TTL_CHECKOUT_DEFAULT_MIN,
  STOCK_RESERVA_TTL_TRANSFERENCIA_DEFAULT_MIN,
  ttlMinutosReservaCheckout,
  ttlMinutosReservaTransferencia,
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

describe('normalizeStockReserveItems', () => {
  it('acepta ítems válidos', () => {
    expect(
      normalizeStockReserveItems([
        { producto_id: 'a', cantidad: 2 },
        { producto_id: ' b ', cantidad: 1.9 },
      ])
    ).toEqual({
      ok: true,
      items: [
        { producto_id: 'a', cantidad: 2 },
        { producto_id: 'b', cantidad: 1 },
      ],
    });
  });

  it('falla sin producto_id (quote paths no pueden oversell silencioso)', () => {
    expect(normalizeStockReserveItems([{ producto_id: null, cantidad: 1 }])).toEqual({
      ok: false,
      motivo: 'producto_id_faltante',
    });
  });

  it('falla con cantidad inválida', () => {
    expect(normalizeStockReserveItems([{ producto_id: 'a', cantidad: 0 }])).toEqual({
      ok: false,
      motivo: 'cantidad_invalida',
    });
  });
});

describe('TTL reserva', () => {
  it('checkout default 30 / floor / min 5', () => {
    expect(ttlMinutosReservaCheckout(undefined)).toBe(STOCK_RESERVA_TTL_CHECKOUT_DEFAULT_MIN);
    expect(ttlMinutosReservaCheckout('45')).toBe(45);
    expect(ttlMinutosReservaCheckout('2')).toBe(5);
  });

  it('transferencia default 7d / min 60', () => {
    expect(ttlMinutosReservaTransferencia(null)).toBe(STOCK_RESERVA_TTL_TRANSFERENCIA_DEFAULT_MIN);
    expect(ttlMinutosReservaTransferencia('120')).toBe(120);
    expect(ttlMinutosReservaTransferencia('10')).toBe(60);
  });
});
