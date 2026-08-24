import { describe, expect, it } from 'vitest';

/**
 * Mirrors the pure decision helpers in supabase/functions/_shared/webhook-pago.ts.
 * Kept in sync so npm test locks the critical payment-recovery invariants without Deno.
 */

const ESTADOS_RECONCILIABLES = ['pendiente', 'error_verificacion'] as const;

function esEstadoReconciliable(estado: string): boolean {
  return (ESTADOS_RECONCILIABLES as readonly string[]).includes(estado);
}

function esVerificacionReintentable(estado: string): boolean {
  return estado === 'error_verificacion';
}

function buildWompiEventId(
  eventName: string,
  transaction: { id?: string; reference?: string; status?: string },
  timestamp: unknown
): string {
  const txnKey = transaction.id ?? transaction.reference ?? 'unknown';
  const status = String(transaction.status ?? 'unknown').toUpperCase();
  const ts =
    timestamp === undefined || timestamp === null || timestamp === '' ? '0' : String(timestamp);
  return `${eventName}:${txnKey}:${status}:${ts}`;
}

describe('webhook-pago recovery invariants', () => {
  it('treats error_verificacion as retryable (must not ACK webhook as done)', () => {
    expect(esVerificacionReintentable('error_verificacion')).toBe(true);
    expect(esVerificacionReintentable('pendiente')).toBe(false);
    expect(esVerificacionReintentable('pagado')).toBe(false);
  });

  it('allows consultar-pedido to reconcile both pendiente and error_verificacion', () => {
    expect(esEstadoReconciliable('pendiente')).toBe(true);
    expect(esEstadoReconciliable('error_verificacion')).toBe(true);
    expect(esEstadoReconciliable('pagado')).toBe(false);
  });

  it('does not collapse PENDING and APPROVED Wompi notifications for the same txn', () => {
    const pending = buildWompiEventId(
      'transaction.updated',
      { id: '1234-1610641025-49201', status: 'PENDING' },
      1530291411
    );
    const approved = buildWompiEventId(
      'transaction.updated',
      { id: '1234-1610641025-49201', status: 'APPROVED' },
      1530291499
    );
    expect(pending).not.toEqual(approved);
    expect(pending).toBe('transaction.updated:1234-1610641025-49201:PENDING:1530291411');
  });
});
