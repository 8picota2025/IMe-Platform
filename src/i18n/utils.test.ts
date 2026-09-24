import { describe, expect, it } from 'vitest';
import { getLocalizedPath } from './utils';

describe('getLocalizedPath · Centro de Conocimiento', () => {
  it('traduce las páginas de tema en los dos sentidos', () => {
    expect(getLocalizedPath('/en/knowledge/topic/monitoreo-uci/', 'es')).toBe(
      '/es/conocimiento/tema/monitoreo-uci/'
    );
    expect(getLocalizedPath('/es/conocimiento/tema/monitoreo-uci', 'en')).toBe(
      '/en/knowledge/topic/monitoreo-uci/'
    );
  });

  it('un artículo mantiene su slug', () => {
    expect(getLocalizedPath('/es/conocimiento/guia-monitores/', 'en')).toBe(
      '/en/knowledge/guia-monitores/'
    );
  });

  it('publicar ↔ publish sigue funcionando', () => {
    expect(getLocalizedPath('/en/knowledge/publish', 'es')).toBe('/es/conocimiento/publicar/');
  });
});
