import { describe, expect, it, vi } from 'vitest';
import { claimPaidTransition, type PaymentStateClient } from './payment-state';

function createClient(result: { data: { id: string } | null; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const neq = vi.fn(() => ({ select }));
  const eq = vi.fn(() => ({ neq }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const client: PaymentStateClient = { from };

  return { client, from, update, eq, neq, select, maybeSingle };
}

describe('claimPaidTransition', () => {
  it('claims a non-paid order with one conditional update', async () => {
    const mock = createClient({ data: { id: 'pedido-1' }, error: null });

    await expect(claimPaidTransition(mock.client, 'pedido-1')).resolves.toEqual({
      claimed: true,
      error: null,
    });
    expect(mock.from).toHaveBeenCalledWith('pedidos');
    expect(mock.update).toHaveBeenCalledWith({ estado: 'pagado' });
    expect(mock.eq).toHaveBeenCalledWith('id', 'pedido-1');
    expect(mock.neq).toHaveBeenCalledWith('estado', 'pagado');
    expect(mock.select).toHaveBeenCalledWith('id');
    expect(mock.maybeSingle).toHaveBeenCalledOnce();
  });

  it('does not claim an order already paid by a concurrent caller', async () => {
    const mock = createClient({ data: null, error: null });

    await expect(claimPaidTransition(mock.client, 'pedido-1')).resolves.toEqual({
      claimed: false,
      error: null,
    });
  });

  it('returns database errors without granting the claim', async () => {
    const mock = createClient({ data: null, error: { message: 'database unavailable' } });

    await expect(claimPaidTransition(mock.client, 'pedido-1')).resolves.toEqual({
      claimed: false,
      error: 'database unavailable',
    });
  });
});
