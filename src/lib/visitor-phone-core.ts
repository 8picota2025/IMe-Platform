/**
 * Normalización de teléfono sin el catálogo de países.
 * El catálogo no entra al bundle del navegador: el selector lo renderiza Astro.
 */

const E164_MIN = 8;
const E164_MAX = 15;

export interface VisitorPhoneResult {
  ok: boolean;
  /** Valor a guardar y mostrar. E.164 si el país es conocido; si no, los dígitos sin prefijo. */
  phone: string;
  /** E.164 solo cuando hay código de país conocido. */
  e164: string | null;
  raw: string;
  countryCode: string | null;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function emptyResult(raw: string): VisitorPhoneResult {
  return { ok: false, phone: '', e164: null, raw, countryCode: null };
}

function international(digits: string, raw: string): VisitorPhoneResult {
  if (!digits) return emptyResult(raw);
  const inRange = digits.length >= E164_MIN && digits.length <= E164_MAX;
  return {
    ok: true,
    phone: `+${digits}`,
    e164: inRange ? `+${digits}` : null,
    raw,
    countryCode: null,
  };
}

function ambiguous(digits: string, raw: string): VisitorPhoneResult {
  return {
    ok: digits.length > 0,
    phone: digits,
    e164: null,
    raw,
    countryCode: null,
  };
}

/**
 * Quita el indicativo si el visitante ya lo escribió junto al número nacional.
 * El 1 de NANP solo se quita en 11 dígitos: un nacional de 10 no empieza por 1.
 */
function stripCallingCode(digits: string, country: string): string {
  if (!country || !digits.startsWith(country)) return digits;
  const rest = digits.slice(country.length);
  if (rest.length < 6 || rest.length > 12) return digits;
  if (country === '1' && digits.length !== 11) return digits;
  return rest;
}

function isColombianMobileWithCountry(digits: string): boolean {
  return digits.length === 12 && digits.startsWith('57') && digits.charAt(2) === '3';
}

function isColombianMobileNational(digits: string): boolean {
  return digits.length === 10 && digits.startsWith('3');
}

/**
 * Normaliza el teléfono que escribió un visitante.
 * `countryCode` es el indicativo SIN '+' elegido en el selector ('' = Otro).
 */
export function normalizeVisitorPhone(
  phone: unknown,
  options?: { countryCode?: string | null }
): VisitorPhoneResult {
  const raw = typeof phone === 'string' ? phone.trim() : '';
  if (!raw) return emptyResult('');

  const compact = raw.replace(/[\s().-]/g, '');
  if (compact.startsWith('+')) return international(onlyDigits(compact), raw);
  if (compact.startsWith('00')) return international(onlyDigits(compact).replace(/^00/, ''), raw);

  const digits = onlyDigits(raw);
  if (!digits) return emptyResult(raw);

  const country = onlyDigits(options?.countryCode ?? '');
  if (country && country !== '57') {
    const national = stripCallingCode(digits, country);
    const combined = `${country}${national}`;
    if (national.length >= 4 && combined.length >= E164_MIN && combined.length <= E164_MAX) {
      return {
        ok: true,
        phone: `+${combined}`,
        e164: `+${combined}`,
        raw,
        countryCode: country,
      };
    }
    return ambiguous(digits, raw);
  }

  if (isColombianMobileWithCountry(digits)) {
    return { ok: true, phone: `+${digits}`, e164: `+${digits}`, raw, countryCode: '57' };
  }
  if (isColombianMobileNational(digits)) {
    return { ok: true, phone: `+57${digits}`, e164: `+57${digits}`, raw, countryCode: '57' };
  }
  return ambiguous(digits, raw);
}

/** La Edge Function vuelve a normalizar. Si llega el texto crudo, manda sobre `telefono`. */
export function resolveSubmittedPhone(input: {
  telefono?: unknown;
  telefono_raw?: unknown;
  telefono_pais?: unknown;
}): VisitorPhoneResult {
  const rawText = typeof input.telefono_raw === 'string' ? input.telefono_raw.trim() : '';
  const sent = typeof input.telefono === 'string' ? input.telefono : '';
  const source = rawText || sent;
  const country = typeof input.telefono_pais === 'string' ? input.telefono_pais : '';
  return normalizeVisitorPhone(source, { countryCode: country });
}

/** Texto del correo: el número normalizado y, si difiere, lo que la persona escribió. */
export function formatPhoneForEmail(result: VisitorPhoneResult, locale: 'es' | 'en'): string {
  if (!result.phone) return '';
  const rawDigits = onlyDigits(result.raw);
  const phoneDigits = onlyDigits(result.phone);
  if (!result.raw.trim() || rawDigits === phoneDigits) return result.phone;
  const note = locale === 'en' ? 'as typed' : 'como lo escribió';
  return `${result.phone} (${note}: ${result.raw.trim()})`;
}
