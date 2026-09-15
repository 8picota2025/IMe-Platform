import { describe, expect, it } from 'vitest';
import { buildWompiEventId } from './wompi-event-id';

describe('buildWompiEventId', () => {
  it('distinguishes APPROVED vs VOIDED for the same transaction', () => {
    const approved = buildWompiEventId({
      event: 'transaction.updated',
      transactionId: 'txn-1',
      status: 'APPROVED',
      timestamp: 100,
    });
    const voided = buildWompiEventId({
      event: 'transaction.updated',
      transactionId: 'txn-1',
      status: 'VOIDED',
      timestamp: 200,
    });

    expect(approved).toBe('transaction.updated:txn-1:APPROVED:100');
    expect(voided).toBe('transaction.updated:txn-1:VOIDED:200');
    expect(approved).not.toBe(voided);
  });

  it('keeps identical status+timestamp retries idempotent', () => {
    const a = buildWompiEventId({
      event: 'transaction.updated',
      transactionId: 'txn-1',
      status: 'approved',
      timestamp: 100,
    });
    const b = buildWompiEventId({
      event: 'transaction.updated',
      transactionId: 'txn-1',
      status: 'APPROVED',
      timestamp: 100,
    });
    expect(a).toBe(b);
  });

  it('falls back when timestamp is missing', () => {
    expect(
      buildWompiEventId({
        event: 'transaction.updated',
        transactionId: 'txn-1',
        status: 'DECLINED',
        timestamp: undefined,
      })
    ).toBe('transaction.updated:txn-1:DECLINED:0');
  });
});
