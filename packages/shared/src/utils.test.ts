import { describe, it, expect } from 'vitest';
import {
  slugify,
  formatPrice,
  validateEmail,
  validatePhone,
  generateId,
  isValidLocale,
  getLocaleFromPath,
  getAlternateUrls,
} from './index.js';

describe('shared/utils', () => {
  describe('slugify', () => {
    it('converts text to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('removes accents', () => {
      expect(slugify('Médico')).toBe('medico');
    });

    it('replaces special characters with hyphens', () => {
      expect(slugify('Product@#$%Name')).toBe('product-name');
    });

    it('trims leading and trailing hyphens', () => {
      expect(slugify('-test-')).toBe('test');
    });
  });

  describe('formatPrice', () => {
    it('formats COP without decimals', () => {
      const result = formatPrice(1500000, 'COP', 'es-CO');
      expect(result).toContain('1.500.000');
      expect(result).toContain('$');
    });

    it('formats USD with 2 decimals', () => {
      const result = formatPrice(1500.5, 'USD', 'en-US');
      expect(result).toContain('1,500.50');
      expect(result).toContain('$');
    });

    it('formats EUR with 2 decimals', () => {
      const result = formatPrice(1500.5, 'EUR', 'es-CO');
      expect(result).toContain('1.500,50');
      expect(result).toContain('EUR');
    });
  });

  describe('validateEmail', () => {
    it('returns true for valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });

    it('returns false for invalid email', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('returns true for valid phone numbers', () => {
      expect(validatePhone('3001234567')).toBe(true);
      expect(validatePhone('+15551234567')).toBe(true);
    });

    it('returns false for invalid phone', () => {
      expect(validatePhone('abc')).toBe(false);
      expect(validatePhone('123')).toBe(false);
    });
  });

  describe('generateId', () => {
    it('generates unique ids', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('includes prefix when provided', () => {
      const id = generateId('test-');
      expect(id).toMatch(/^test-\d+-[a-z0-9]+$/);
    });
  });

  describe('isValidLocale', () => {
    it('returns true for valid locales', () => {
      expect(isValidLocale('es')).toBe(true);
      expect(isValidLocale('en')).toBe(true);
    });

    it('returns false for invalid locales', () => {
      expect(isValidLocale('fr')).toBe(false);
      expect(isValidLocale('')).toBe(false);
    });
  });

  describe('getLocaleFromPath', () => {
    it('returns en for /en/ paths', () => {
      expect(getLocaleFromPath('/en/')).toBe('en');
      expect(getLocaleFromPath('/en/catalog')).toBe('en');
    });

    it('returns es for /es/ paths and others', () => {
      expect(getLocaleFromPath('/es/')).toBe('es');
      expect(getLocaleFromPath('/es/catalogo')).toBe('es');
      expect(getLocaleFromPath('/')).toBe('es');
      expect(getLocaleFromPath('/other')).toBe('es');
    });
  });

  describe('getAlternateUrls', () => {
    it('generates correct alternate URLs', () => {
      const urls = getAlternateUrls('https://example.com', '/es/producto/test');
      expect(urls.es).toBe('https://example.com/es/producto/test');
      expect(urls.en).toBe('https://example.com/en/producto/test');
    });

    it('handles root path', () => {
      const urls = getAlternateUrls('https://example.com', '/');
      expect(urls.es).toBe('https://example.com/es/');
      expect(urls.en).toBe('https://example.com/en/');
    });
  });
});
