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

describe('getLocalizedPath · carrito, cuenta, pago y cotización', () => {
  it('carrito ↔ cart (antes daba /en/carrito/ y /es/cart/, ambas 404)', () => {
    expect(getLocalizedPath('/es/carrito/', 'en')).toBe('/en/cart/');
    expect(getLocalizedPath('/en/cart/', 'es')).toBe('/es/carrito/');
  });

  it('cuenta ↔ account', () => {
    expect(getLocalizedPath('/es/cuenta/', 'en')).toBe('/en/account/');
    expect(getLocalizedPath('/en/account/', 'es')).toBe('/es/cuenta/');
  });

  it('las páginas de resultado de pago traducen sección y slug', () => {
    expect(getLocalizedPath('/es/pago/exito/', 'en')).toBe('/en/payment/success/');
    expect(getLocalizedPath('/en/payment/failure/', 'es')).toBe('/es/pago/fallo/');
    expect(getLocalizedPath('/es/pago/pendiente/', 'en')).toBe('/en/payment/pending/');
    expect(getLocalizedPath('/en/payment/result/', 'es')).toBe('/es/pago/resultado/');
  });

  it('cotizacion/formalizar ↔ quote/formalize', () => {
    expect(getLocalizedPath('/es/cotizacion/formalizar/', 'en')).toBe('/en/quote/formalize/');
    expect(getLocalizedPath('/en/quote/formalize/', 'es')).toBe('/es/cotizacion/formalizar/');
  });
});
