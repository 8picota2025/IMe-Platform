import { describe, expect, it, vi } from 'vitest';
import { claimPedidoPagado } from './pedido-pagado-claim';

function createMockClient(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn(async () => result);
  const select = vi.fn(() => ({ maybeSingle }));
  const neq = vi.fn(() => ({ select }));
  const eq = vi.fn(() => ({ neq }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { from, update, eq, neq, select, maybeSingle };
}

describe('claimPedidoPagado', () => {
  it('wins the CAS when update returns a row', async () => {
    const mock = createMockClient({ data: { id: 'pedido-1' }, error: null });
    const won = await claimPedidoPagado(mock, 'pedido-1', { ultimo_evento: 'evt-1' });

    expect(won).toBe(true);
    expect(mock.from).toHaveBeenCalledWith('pedidos');
    expect(mock.update).toHaveBeenCalledWith({
      estado: 'pagado',
      metadata: { ultimo_evento: 'evt-1' },
    });
    expect(mock.eq).toHaveBeenCalledWith('id', 'pedido-1');
    expect(mock.neq).toHaveBeenCalledWith('estado', 'pagado');
  });

  it('loses the CAS when another writer already marked pagado', async () => {
    const mock = createMockClient({ data: null, error: null });
    const won = await claimPedidoPagado(mock, 'pedido-1', { ultimo_evento: 'evt-2' });
    expect(won).toBe(false);
  });

  it('returns false on update error without throwing', async () => {
    const mock = createMockClient({ data: null, error: { message: 'db down' } });
    const won = await claimPedidoPagado(mock, 'pedido-1', {});
    expect(won).toBe(false);
  });
});
