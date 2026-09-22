import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_POLICY_VERSION,
  CONSENT_STORAGE_KEY,
  hasAnalyticsConsent,
  readStoredConsent,
  writeStoredConsent,
} from './consent';

let storeRef: Map<string, string>;

function freshLocalStorage(): void {
  storeRef = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storeRef.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storeRef.set(key, value);
    },
    removeItem: (key: string) => {
      storeRef.delete(key);
    },
  };
  // consent.ts guarda con `typeof window === 'undefined'`; en el entorno
  // vitest (node, sin jsdom) `window` no existe, así que hay que stubearlo
  // igual que src/lib/commercial-attribution.test.ts.
  vi.stubGlobal('window', { localStorage });
  vi.stubGlobal('localStorage', localStorage);
}

describe('consent', () => {
  beforeEach(() => {
    freshLocalStorage();
  });

  it('returns null when nothing was decided yet', () => {
    expect(readStoredConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('persists accept/reject decisions with the current policy version', () => {
    writeStoredConsent(true, 'accept_all');
    const stored = readStoredConsent();
    expect(stored?.categories).toEqual({ necessary: true, analytics: true });
    expect(stored?.policyVersion).toBe(CONSENT_POLICY_VERSION);
    expect(stored?.source).toBe('accept_all');
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('rejecting stores analytics: false and hasAnalyticsConsent() stays false', () => {
    writeStoredConsent(false, 'reject_all');
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('ignores stored consent from a previous, superseded policy version', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        categories: { necessary: true, analytics: true },
        policyVersion: '2020-01-01',
        decidedAt: new Date().toISOString(),
        source: 'accept_all',
      })
    );
    expect(readStoredConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('treats malformed stored JSON as no decision', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, '{not json');
    expect(readStoredConsent()).toBeNull();
  });
});
