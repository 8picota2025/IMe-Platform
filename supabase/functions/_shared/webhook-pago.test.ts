import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildWompiEventId,
  esEstadoReconciliable,
  esVerificacionReintentable,
} from './webhook-pago.ts';

Deno.test('esVerificacionReintentable: solo error_verificacion', () => {
  assertEquals(esVerificacionReintentable('error_verificacion'), true);
  assertEquals(esVerificacionReintentable('pendiente'), false);
  assertEquals(esVerificacionReintentable('pagado'), false);
  assertEquals(esVerificacionReintentable('rechazado'), false);
});

Deno.test('esEstadoReconciliable: pendiente y error_verificacion', () => {
  assertEquals(esEstadoReconciliable('pendiente'), true);
  assertEquals(esEstadoReconciliable('error_verificacion'), true);
  assertEquals(esEstadoReconciliable('pagado'), false);
  assertEquals(esEstadoReconciliable('rechazado'), false);
});

Deno.test('buildWompiEventId: distingue PENDING de APPROVED para la misma transacción', () => {
  const txn = { id: '1234-1610641025-49201', reference: 'MZQ3X2DE2SMX', status: 'PENDING' };
  const pending = buildWompiEventId('transaction.updated', txn, 1530291411);
  const approved = buildWompiEventId(
    'transaction.updated',
    { ...txn, status: 'APPROVED' },
    1530291499
  );

  assertEquals(pending, 'transaction.updated:1234-1610641025-49201:PENDING:1530291411');
  assertEquals(approved, 'transaction.updated:1234-1610641025-49201:APPROVED:1530291499');
  assertEquals(pending === approved, false);
});

Deno.test('buildWompiEventId: reintento idéntico produce la misma clave', () => {
  const txn = { id: 'tx-1', status: 'APPROVED' };
  const a = buildWompiEventId('transaction.updated', txn, 100);
  const b = buildWompiEventId('transaction.updated', txn, 100);
  assertEquals(a, b);
});
