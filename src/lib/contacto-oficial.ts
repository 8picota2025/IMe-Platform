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

/** Perfiles confirmados, incluido Facebook (página «I-ME International Medical Enterprise»). */
export const IME_SOCIAL_PROFILES = [
  {
    id: 'instagram',
    href: 'https://www.instagram.com/imebiomed/',
    labelEs: 'Instagram de I-ME',
    labelEn: 'I-ME on Instagram',
  },
  {
    id: 'x',
    href: 'https://x.com/IMEbiomed',
    labelEs: 'I-ME en X',
    labelEn: 'I-ME on X',
  },
  {
    id: 'linkedin',
    href: 'https://www.linkedin.com/company/ime-international-medical-enterprise/',
    labelEs: 'LinkedIn de I-ME',
    labelEn: 'I-ME on LinkedIn',
  },
  {
    id: 'youtube',
    href: 'https://www.youtube.com/@IMEbiomed',
    labelEs: 'YouTube de I-ME',
    labelEn: 'I-ME on YouTube',
  },
  {
    id: 'facebook',
    href: 'https://www.facebook.com/profile.php?id=61592213295039',
    labelEs: 'Facebook de I-ME',
    labelEn: 'Facebook de I-ME',
  },
] as const;

/** WhatsApp Business más los perfiles públicos. Mismo orden en schema y pie. */
export const IME_SAME_AS = [IME_WHATSAPP_URL, ...IME_SOCIAL_PROFILES.map(profile => profile.href)];

export const IME_EMAIL = 'info@i-me.com.co';

/** Domicilio del RUT vigente. NIT 901871720-1. */
export const IME_STREET = 'CR 43 A 1 50';
export const IME_LOCALITY = 'Medellín';
export const IME_REGION = 'Antioquia';
export const IME_ADDRESS_LINE = `${IME_STREET}, ${IME_LOCALITY}, ${IME_REGION}, Colombia`;

export function buildWhatsAppHref(prefill?: string): string {
  const text = prefill?.trim();
  if (!text) return IME_WHATSAPP_URL;
  return `${IME_WHATSAPP_URL}?text=${encodeURIComponent(text)}`;
}
