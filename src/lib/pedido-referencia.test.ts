import { describe, expect, it } from 'vitest';
import { esReferenciaPedidoUuid, pareceNumeroCotizacion } from './pedido-referencia';

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
});
