import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { pedidoPermiteNotificarProveedor } from './fulfillment-guard.ts';

Deno.test('pedidoPermiteNotificarProveedor: permite post-pago', () => {
  for (const estado of ['pagado', 'procesando', 'enviado', 'entregado', 'retrasado']) {
    assertEquals(pedidoPermiteNotificarProveedor(estado), true, estado);
  }
});

Deno.test('pedidoPermiteNotificarProveedor: bloquea impagos y terminales', () => {
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
    assertEquals(pedidoPermiteNotificarProveedor(estado), false, String(estado));
  }
});
