import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_POLICY_VERSION,
  CONSENT_STORAGE_KEY,
  clearAnalyticsCookies,
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

describe('clearAnalyticsCookies', () => {
  function stubCookies(initial: string): string[] {
    const writes: string[] = [];
    vi.stubGlobal('window', { location: { hostname: 'www.i-me.com.co' } });
    vi.stubGlobal('document', {
      get cookie() {
        return initial;
      },
      set cookie(value: string) {
        writes.push(value);
      },
    });
    return writes;
  }

  it('expires only GA/Clarity cookies, on the host and every parent domain', () => {
    const writes = stubCookies('_ga=GA1.1.1; _ga_ABC123=GS1; ime_session=x; _clck=y; _gcl_au=z');
    expect(clearAnalyticsCookies()).toEqual(['_ga', '_ga_ABC123', '_clck', '_gcl_au']);
    expect(writes.every(w => w.includes('expires=Thu, 01 Jan 1970'))).toBe(true);
    expect(writes.some(w => w.startsWith('ime_session='))).toBe(false);
    for (const domain of ['www.i-me.com.co', '.i-me.com.co', 'com.co']) {
      expect(writes).toContain(
        `_ga=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`
      );
    }
  });

  it('does nothing when there are no analytics cookies', () => {
    const writes = stubCookies('ime_session=x');
    expect(clearAnalyticsCookies()).toEqual([]);
    expect(writes).toEqual([]);
  });
});
