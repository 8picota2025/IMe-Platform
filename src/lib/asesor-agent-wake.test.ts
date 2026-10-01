import { describe, expect, it } from 'vitest';
import {
  isAmbiguousAgentWakeFailure,
  shouldMarkAgentTurnFailedOnWakeError,
} from './asesor-agent-wake';

describe('asesor agent wake ACK policy', () => {
  it('treats AbortError as ambiguous so the turn stays pending', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    expect(isAmbiguousAgentWakeFailure(abort)).toBe(true);
    expect(shouldMarkAgentTurnFailedOnWakeError(abort)).toBe(false);
  });

  it('treats timeout-shaped messages as ambiguous', () => {
    expect(isAmbiguousAgentWakeFailure(new Error('wake timed out'))).toBe(true);
    expect(isAmbiguousAgentWakeFailure('signal timeout')).toBe(true);
    expect(shouldMarkAgentTurnFailedOnWakeError(new Error('Timeout'))).toBe(false);
  });

  it('marks definitive wake HTTP / network failures as failed', () => {
    expect(shouldMarkAgentTurnFailedOnWakeError(new Error('wake HTTP 503'))).toBe(true);
    expect(shouldMarkAgentTurnFailedOnWakeError(new Error('wake HTTP 401'))).toBe(true);
    expect(shouldMarkAgentTurnFailedOnWakeError(new Error('fetch failed'))).toBe(true);
    expect(isAmbiguousAgentWakeFailure(new Error('wake HTTP 500'))).toBe(false);
  });
});
