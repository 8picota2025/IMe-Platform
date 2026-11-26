import { describe, expect, it } from 'vitest';
import { snippetConocimiento } from './conocimiento-snippets';

describe('snippets de conocimiento con CTR bajo', () => {
  it('cabena en el snippet y nombran la consulta', () => {
    const invima = snippetConocimiento('registro-sanitario-invima-equipos-biomedicos', 'es');
    const monitor = snippetConocimiento('como-elegir-tensiometro-digital', 'en');
    expect(invima).toBeDefined();
    expect(monitor).toBeDefined();
    for (const snippet of [invima!, monitor!]) {
      expect(snippet.title.length).toBeLessThanOrEqual(60);
      expect(snippet.description.length).toBeLessThanOrEqual(155);
      expect(snippet.h1.length).toBeGreaterThan(10);
    }
    expect(invima!.title.toLowerCase()).toContain('registro sanitario invima');
    expect(invima!.description).not.toMatch(/coste|costo|tiempo|tarifa/i);
    expect(monitor!.title.toLowerCase()).toBe('how to choose a blood pressure monitor | i-me');
    expect(monitor!.h1.toLowerCase()).toBe('how to choose a blood pressure monitor');
    expect(monitor!.faq?.length).toBeGreaterThan(0);
    expect(monitor!.description.toLowerCase()).not.toContain('diagnos');
    const central = snippetConocimiento(
      'central-monitoreo-multicama-o-monitores-independientes',
      'en'
    );
    expect(central!.title.length).toBeLessThanOrEqual(60);
    expect(central!.description.length).toBeLessThanOrEqual(155);
    expect(central!.title.toLowerCase()).toContain('bedside');
    expect(central!.description.toLowerCase()).not.toContain('diagnos');
  });

  it('separa la guía EN de registro del landing comercial', () => {
    const guide = snippetConocimiento('registro-sanitario-invima-equipos-biomedicos', 'en');
    expect(guide!.title.toLowerCase()).not.toContain('medical device registration in colombia');
    expect(guide!.title.length).toBeLessThanOrEqual(60);
    expect(guide!.links?.some(link => link.href.includes('medical-device-registration'))).toBe(
      true
    );
  });
});
