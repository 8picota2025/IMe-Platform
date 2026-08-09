import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureCommercialAttribution, rememberCommercialLead } from './commercial-attribution';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function installBrowser(url: string, referrer = ''): MemoryStorage {
  const parsed = new URL(url);
  const storage = new MemoryStorage();
  vi.stubGlobal('window', {
    location: parsed,
    sessionStorage: storage,
    crypto: { randomUUID: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
  });
  vi.stubGlobal('document', { referrer });
  return storage;
}

afterEach(() => vi.unstubAllGlobals());

describe('commercial attribution', () => {
  it('captura campaña, UTM, landing, referrer y sesión', () => {
    installBrowser(
      'https://i-me.com.co/es/imagenologia/?utm_source=google&utm_medium=cpc&utm_campaign=rx',
      'https://www.google.com/'
    );

    expect(captureCommercialAttribution('imagenologia')).toEqual({
      campaign: 'imagenologia',
      landing_path: '/es/imagenologia/',
      referrer: 'https://www.google.com/',
      analytics_session_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'rx',
    });
  });

  it('conserva lead_id y atribución al navegar sin parámetros UTM', () => {
    const storage = installBrowser(
      'https://i-me.com.co/es/robotica-rehabilitacion/?utm_source=linkedin&utm_campaign=robotica'
    );
    rememberCommercialLead('11111111-2222-4333-8444-555555555555', 'robotica_rehabilitacion');

    vi.stubGlobal('window', {
      location: new URL('https://i-me.com.co/es/contacto/'),
      sessionStorage: storage,
      crypto: { randomUUID: () => 'unused' },
    });

    expect(captureCommercialAttribution()).toMatchObject({
      lead_id: '11111111-2222-4333-8444-555555555555',
      campaign: 'robotica_rehabilitacion',
      landing_path: '/es/robotica-rehabilitacion/',
      utm_source: 'linkedin',
      utm_campaign: 'robotica',
    });
  });
});
