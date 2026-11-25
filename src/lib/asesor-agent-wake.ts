/**
 * Wake ACK policy for IMEIA web agent turns.
 *
 * Edge posts to the agent webhook with a short AbortController budget so the
 * HTTP handler can return `turn_id` quickly (or via waitUntil). A slow ACK or
 * aborted fetch does **not** mean the agent never received the turn — the
 * routine may still write `replied` while status is `pending`.
 *
 * Marking the row `failed` on abort permanently discards that late reply
 * (routine updates only WHERE status = 'pending') and pins Retry to a dead turn.
 */

function errorName(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'name' in err) {
    const name = (err as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  }
  return '';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '';
}

export function isAmbiguousAgentWakeFailure(err: unknown): boolean {
  if (errorName(err) === 'AbortError') return true;
  return /\babort(?:ed|error)?\b|\btimed?\s*out\b|\btimeout\b/i.test(errorMessage(err));
}

/** True when wake failure should flip asesor_agent_turns to failed. */
export function shouldMarkAgentTurnFailedOnWakeError(err: unknown): boolean {
  return !isAmbiguousAgentWakeFailure(err);
}
