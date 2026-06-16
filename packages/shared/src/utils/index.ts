import type { Locale } from '../types/index.js';

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatPrice(
  amount: number,
  currency: 'COP' | 'USD' | 'EUR' = 'COP',
  locale: 'es-CO' | 'en-US' = 'es-CO'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'COP' ? 0 : 2,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(amount);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  return /^\+?\(?[0-9]{1,3}\)?[-\s.]?\(?[0-9]{1,3}\)?[-\s.]?[0-9]{4,6}$/.test(phone);
}

export function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isValidLocale(locale: string): locale is Locale {
  return locale === 'es' || locale === 'en';
}

export function getLocaleFromPath(pathname: string): Locale {
  if (pathname.startsWith('/en/') || pathname === '/en') return 'en';
  return 'es';
}

export function getAlternateUrls(baseUrl: string, pathname: string): Record<Locale, string> {
  const cleanPath = pathname.replace(/^\/(es|en)/, '') || '/';
  return {
    es: `${baseUrl}/es${cleanPath}`,
    en: `${baseUrl}/en${cleanPath}`,
  };
}
