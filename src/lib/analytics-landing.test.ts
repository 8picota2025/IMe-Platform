import { describe, expect, it } from 'vitest';
import { buildGa4EventParams } from './analytics';
import {
  canonicalPublicUrl,
  readAnalyticsLanding,
  rememberAnalyticsLanding,
} from './analytics-landing';
import { INVIMA_CHECKLIST_EN, INVIMA_REGISTRATION_EN, INVIMA_TOPIC_EN } from '../data/invima-seo';

describe('buildGa4EventParams', () => {
  it('siempre incluye page_location y descarta PII', () => {
    const params = buildGa4EventParams(
      {
        email: 'a@b.co',
        telefono: '+573000000000',
        origin: 'formulario_contacto',
      },
      {
        page_location: 'https://i-me.com.co/es/contacto/',
        page_path: '/es/contacto/',
        page_title: 'Contacto',
        page_referrer: 'https://www.google.com/',
      }
    );
    expect(params.page_location).toBe('https://i-me.com.co/es/contacto/');
    expect(params.page_referrer).toBe('https://www.google.com/');
    expect(params.origin).toBe('formulario_contacto');
    expect(params).not.toHaveProperty('email');
    expect(params).not.toHaveProperty('telefono');
  });

  it('el evento puede fijar su propia page_location', () => {
    const params = buildGa4EventParams(
      { page_location: 'https://i-me.com.co/en/knowledge/topic/invima-regulacion/' },
      { page_location: 'https://i-me.com.co/en/' }
    );
    expect(params.page_location).toBe('https://i-me.com.co/en/knowledge/topic/invima-regulacion/');
  });
});

describe('canonicalPublicUrl', () => {
  it('unifica /es y /es/ para que GA4 no parta la landing', () => {
    expect(canonicalPublicUrl('https://i-me.com.co/es')).toBe('https://i-me.com.co/es/');
    expect(canonicalPublicUrl('https://i-me.com.co/es/')).toBe('https://i-me.com.co/es/');
    expect(canonicalPublicUrl('https://i-me.com.co/es/catalogo?q=cama')).toBe(
      'https://i-me.com.co/es/catalogo/?q=cama'
    );
    expect(canonicalPublicUrl('https://i-me.com.co/llms.txt')).toBe('https://i-me.com.co/llms.txt');
  });
});

describe('rememberAnalyticsLanding', () => {
  it('guarda solo la primera URL de la sesión', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    rememberAnalyticsLanding(storage, {
      page_location: 'https://i-me.com.co/en/',
      page_referrer: 'https://www.google.com/',
      page_title: 'Home',
    });
    rememberAnalyticsLanding(storage, {
      page_location: 'https://i-me.com.co/en/catalog/',
      page_referrer: '',
      page_title: 'Catalog',
    });
    expect(readAnalyticsLanding(storage)?.page_location).toBe('https://i-me.com.co/en/');
  });
});

describe('snippets INVIMA EN', () => {
  it('alinean title, H1 y meta con la intención y caben en el snippet', () => {
    for (const snippet of [INVIMA_TOPIC_EN, INVIMA_CHECKLIST_EN, INVIMA_REGISTRATION_EN]) {
      expect(snippet.title.length).toBeLessThanOrEqual(60);
      expect(snippet.description.length).toBeLessThanOrEqual(155);
      expect(snippet.h1.length).toBeGreaterThan(10);
    }
    expect(INVIMA_TOPIC_EN.title.startsWith('INVIMA')).toBe(true);
    expect(INVIMA_REGISTRATION_EN.title.toLowerCase()).toContain('medical device registration');
    expect(INVIMA_CHECKLIST_EN.description.toLowerCase()).toContain('request a quote');
    expect(INVIMA_TOPIC_EN.description).not.toMatch(/\d{4,}/);
  });
});
