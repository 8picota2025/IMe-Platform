/**
 * Canales comerciales oficiales de I-ME.
 * Fuente única para WhatsApp Business — no mezclar con números personales
 * o de congreso históricos (p. ej. +57 310 333 2607).
 */

/** E.164 sin '+': wa.me y deep-links. */
export const IME_WHATSAPP_E164 = '573137247353';

/** Presentación humana (Colombia). */
export const IME_WHATSAPP_DISPLAY = '+57 313 724 7353';

/** Formato schema.org / tel: */
export const IME_WHATSAPP_TEL = '+57-313-724-7353';

export const IME_WHATSAPP_URL = `https://wa.me/${IME_WHATSAPP_E164}`;

export const IME_EMAIL = 'info@i-me.com.co';

export function buildWhatsAppHref(prefill?: string): string {
  const text = prefill?.trim();
  if (!text) return IME_WHATSAPP_URL;
  return `${IME_WHATSAPP_URL}?text=${encodeURIComponent(text)}`;
}
