import { describe, expect, it } from 'vitest';
import {
  derivarEstadoPedidoDesdeFulfillments,
  estadosFulfillmentConOverride,
  pedidoAceptaSyncFulfillment,
} from './fulfillment-pedido-estado';

describe('pedidoAceptaSyncFulfillment', () => {
  it('blocks unpaid and dead payment states', () => {
    expect(pedidoAceptaSyncFulfillment('pendiente')).toBe(false);
    expect(pedidoAceptaSyncFulfillment('pendiente_validacion')).toBe(false);
    expect(pedidoAceptaSyncFulfillment('rechazado')).toBe(false);
    expect(pedidoAceptaSyncFulfillment('cancelado')).toBe(false);
  });

  it('allows paid and in-flight shipping states', () => {
    expect(pedidoAceptaSyncFulfillment('pagado')).toBe(true);
    expect(pedidoAceptaSyncFulfillment('preparando')).toBe(true);
    expect(pedidoAceptaSyncFulfillment('enviado')).toBe(true);
    expect(pedidoAceptaSyncFulfillment('entregado')).toBe(true);
  });
});

describe('derivarEstadoPedidoDesdeFulfillments', () => {
  it('does not cancel the whole pedido when only one of many fulfillments cancels', () => {
    expect(
      derivarEstadoPedidoDesdeFulfillments(['cancelado', 'enviado'], 'enviado')
    ).toBeNull();
    expect(derivarEstadoPedidoDesdeFulfillments(['cancelado', 'preparando'], 'preparando')).toBe(
      null
    );
    expect(derivarEstadoPedidoDesdeFulfillments(['cancelado', 'enviado'], 'pagado')).toBe(
      'enviado'
    );
  });

  it('cancels the pedido only when every fulfillment is inactive', () => {
    expect(derivarEstadoPedidoDesdeFulfillments(['cancelado'], 'pagado')).toBe('cancelado');
    expect(derivarEstadoPedidoDesdeFulfillments(['cancelado', 'error'], 'preparando')).toBe(
      'cancelado'
    );
  });

  it('marks entregado only when all active fulfillments are delivered', () => {
    expect(derivarEstadoPedidoDesdeFulfillments(['entregado', 'enviado'], 'enviado')).toBeNull();
    expect(derivarEstadoPedidoDesdeFulfillments(['entregado', 'entregado'], 'enviado')).toBe(
      'entregado'
    );
    expect(
      derivarEstadoPedidoDesdeFulfillments(['entregado', 'cancelado'], 'enviado')
    ).toBe('entregado');
  });

  it('never advances unpaid pedidos via supplier sync', () => {
    expect(derivarEstadoPedidoDesdeFulfillments(['entregado'], 'pendiente')).toBeNull();
    expect(derivarEstadoPedidoDesdeFulfillments(['enviado'], 'pendiente_validacion')).toBeNull();
  });

  it('keeps pagado while fulfillments are only pendiente/notificado', () => {
    expect(derivarEstadoPedidoDesdeFulfillments(['notificado', 'pendiente'], 'pagado')).toBeNull();
  });

  it('does not regress entregado', () => {
    expect(derivarEstadoPedidoDesdeFulfillments(['enviado'], 'entregado')).toBeNull();
    expect(derivarEstadoPedidoDesdeFulfillments(['preparando'], 'entregado')).toBeNull();
  });
});

describe('estadosFulfillmentConOverride', () => {
  it('overrides the updated fulfillment id', () => {
    expect(
      estadosFulfillmentConOverride(
        [
          { id: 'a', estado: 'preparando' },
          { id: 'b', estado: 'enviado' },
        ],
        'a',
        'cancelado'
      )
    ).toEqual(['cancelado', 'enviado']);
  });
});
