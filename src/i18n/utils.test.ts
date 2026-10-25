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

describe('getLocalizedPath · rutas de comercio', () => {
  it('traduce carrito ↔ cart', () => {
    expect(getLocalizedPath('/es/carrito/', 'en')).toBe('/en/cart/');
    expect(getLocalizedPath('/en/cart/', 'es')).toBe('/es/carrito/');
  });

  it('traduce cotizacion ↔ quote', () => {
    expect(getLocalizedPath('/es/cotizacion/', 'en')).toBe('/en/quote/');
    expect(getLocalizedPath('/en/quote/', 'es')).toBe('/es/cotizacion/');
  });

  it('traduce cuenta ↔ account', () => {
    expect(getLocalizedPath('/es/cuenta/', 'en')).toBe('/en/account/');
    expect(getLocalizedPath('/en/account/', 'es')).toBe('/es/cuenta/');
  });

  it('traduce el sub-paso formalizar ↔ formalize', () => {
    expect(getLocalizedPath('/es/cotizacion/formalizar/', 'en')).toBe('/en/quote/formalize/');
    expect(getLocalizedPath('/en/quote/formalize/', 'es')).toBe('/es/cotizacion/formalizar/');
  });
});
