/**
 * Stable idempotency key for Wompi webhook deliveries.
 *
 * Wompi reuses event name `transaction.updated` for every status change on the
 * same transaction id. Keys that omit status+timestamp collapse APPROVED and a
 * later VOIDED into one row, so the void is ACK'd as a duplicate and never
 * applied (paid order + dropship after money is reversed).
 *
 * Same status + timestamp (Wompi retry) stays idempotent.
 */
export function buildWompiEventId(input: {
  event: string;
  transactionId: string;
  status: string;
  timestamp: string | number | null | undefined;
}): string {
  const status = (input.status || 'unknown').toUpperCase();
  const timestamp =
    input.timestamp === null || input.timestamp === undefined || input.timestamp === ''
      ? '0'
      : String(input.timestamp);
  return `${input.event}:${input.transactionId}:${status}:${timestamp}`;
}
