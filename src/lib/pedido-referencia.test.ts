import { describe, expect, it } from 'vitest';
import {
  compatibilidadReferenciaWompi,
  debeRecuperarPedidoImeQ,
  esReferenciaPedidoUuid,
  pareceNumeroCotizacion,
} from './pedido-referencia';

describe('pedido-referencia', () => {
  it('acepta UUID de pedido', () => {
    expect(esReferenciaPedidoUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(esReferenciaPedidoUuid(' 550e8400-e29b-41d4-a716-446655440000 ')).toBe(true);
  });

  it('rechaza número de cotización como reference de pasarela', () => {
    expect(esReferenciaPedidoUuid('IME-Q-2026-000042')).toBe(false);
    expect(pareceNumeroCotizacion('IME-Q-2026-000042')).toBe(true);
    expect(pareceNumeroCotizacion('BORRADOR')).toBe(true);
    expect(pareceNumeroCotizacion('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('solo recupera pedido IME-Q cuando la verificación es pagado', () => {
    expect(debeRecuperarPedidoImeQ('IME-Q-2026-000042', 'pagado')).toBe(true);
    expect(debeRecuperarPedidoImeQ('IME-Q-2026-000042', 'rechazado')).toBe(false);
    expect(debeRecuperarPedidoImeQ('IME-Q-2026-000042', 'cancelado')).toBe(false);
    expect(debeRecuperarPedidoImeQ('IME-Q-2026-000042', 'pendiente')).toBe(false);
    expect(debeRecuperarPedidoImeQ('IME-Q-2026-000042', 'error_verificacion')).toBe(false);
    expect(debeRecuperarPedidoImeQ('550e8400-e29b-41d4-a716-446655440000', 'pagado')).toBe(false);
  });

  it('rebinea ref distinta solo en pedidos Wompi pendientes', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const ime = 'IME-Q-2026-000042';
    expect(
      compatibilidadReferenciaWompi({
        referenciaExistente: uuid,
        override: ime,
        estadoPedido: 'pendiente',
      })
    ).toBe('rebind');
    expect(
      compatibilidadReferenciaWompi({
        referenciaExistente: uuid,
        override: ime,
        estadoPedido: 'pagado',
      })
    ).toBe('reject');
    expect(
      compatibilidadReferenciaWompi({
        referenciaExistente: ime,
        override: ime,
        estadoPedido: 'pendiente',
      })
    ).toBe('ok');
    expect(
      compatibilidadReferenciaWompi({
        referenciaExistente: uuid,
        override: null,
        estadoPedido: 'pendiente',
      })
    ).toBe('ok');
  });
});
