import { describe, expect, it } from 'vitest';
import { etiquetaBilingue, resolverIdiomaCotizacion, textoPareceIngles } from './idioma-cotizacion';

describe('resolverIdiomaCotizacion', () => {
  it('deja las COP nacionales solo en castellano', () => {
    expect(
      resolverIdiomaCotizacion({
        moneda: 'COP',
        mercado: 'CO',
        idioma: 'es-en',
        locale: 'en',
        texto: 'Delivery and payment terms for this quote until shipping',
      })
    ).toBe('es');
  });

  it('saca USD, INTL, locale en o idioma es-en en los dos idiomas', () => {
    expect(resolverIdiomaCotizacion({ moneda: 'USD', mercado: 'CO', idioma: 'es' })).toBe('es-en');
    expect(resolverIdiomaCotizacion({ moneda: 'COP', mercado: 'INTL' })).toBe('es-en');
    expect(resolverIdiomaCotizacion({ moneda: 'USD', locale: 'en' })).toBe('es-en');
    expect(resolverIdiomaCotizacion({ moneda: 'COP', mercado: 'INTL', idioma: 'es' })).toBe(
      'es-en'
    );
  });

  it('detecta condiciones libres escritas en inglés fuera del mercado nacional', () => {
    expect(textoPareceIngles('Delivery and payment for this quote until shipping')).toBe(true);
    expect(textoPareceIngles('Entrega en 30 dias. Garantia del fabricante.')).toBe(false);
    expect(
      resolverIdiomaCotizacion({
        moneda: 'COP',
        mercado: 'INTL',
        idioma: 'es',
        locale: 'es',
        texto: 'Delivery and payment for this quote until shipping',
      })
    ).toBe('es-en');
  });
});

describe('etiquetaBilingue', () => {
  it('no repite la etiqueta cuando el castellano y el inglés coinciden', () => {
    expect(etiquetaBilingue('Web', 'Web', 'es-en')).toBe('Web');
    expect(etiquetaBilingue('REF', 'ref', 'es-en')).toBe('REF');
    expect(etiquetaBilingue('N°', 'No.', 'es-en')).toBe('N° / No.');
    expect(etiquetaBilingue('Web', 'Web', 'es')).toBe('Web');
    expect(etiquetaBilingue('Web', 'Website', 'en')).toBe('Website');
  });
});
