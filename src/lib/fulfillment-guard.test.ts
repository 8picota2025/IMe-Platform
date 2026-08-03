import { describe, expect, it } from 'vitest';
import { pedidoPermiteNotificarProveedor } from './fulfillment-guard';

describe('pedidoPermiteNotificarProveedor', () => {
  it('allows post-payment order states', () => {
    for (const estado of ['pagado', 'procesando', 'enviado', 'entregado', 'retrasado']) {
      expect(pedidoPermiteNotificarProveedor(estado)).toBe(true);
    }
  });

  it('blocks unpaid and terminal states', () => {
    for (const estado of [
      'pendiente',
      'pendiente_validacion',
      'error_verificacion',
      'rechazado',
      'expirado',
      'cancelado',
      'reembolsado',
      '',
      null,
      undefined,
    ]) {
      expect(pedidoPermiteNotificarProveedor(estado)).toBe(false);
    }
  });
});
