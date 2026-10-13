/**
 * Teléfono de formularios públicos (cotización, ficha, contacto, checkout).
 *
 * No antepone +57 a ciegas. El selector de país (por defecto Colombia) solo
 * se aplica cuando el visitante elige un indicativo distinto de 57. Con
 * Colombia —o sin país— +57 se asume únicamente para un móvil de 10 dígitos
 * que empieza por 3.
 *
 * Espejo en Postgres: `crm_normalize_phone` (migración
 * `20261013193000_visitor_phone_no_blind_prefix.sql`). Esa función no recibe
 * el país del selector: la Edge Function aplica el indicativo antes de
 * insertar, y SQL conserva un `+` ya resuelto sin volver a anteponer 57.
 */

export interface VisitorCountry {
  iso: string;
  dial: string;
  es: string;
  en: string;
}

/** Indicativos que el selector ofrece. Si el país no está, el visitante elige "Otro" y escribe + o 00. */
export const VISITOR_PHONE_COUNTRIES: readonly VisitorCountry[] = [
  { iso: 'CO', dial: '57', es: 'Colombia', en: 'Colombia' },
  { iso: 'AR', dial: '54', es: 'Argentina', en: 'Argentina' },
  { iso: 'AU', dial: '61', es: 'Australia', en: 'Australia' },
  { iso: 'AT', dial: '43', es: 'Austria', en: 'Austria' },
  { iso: 'BE', dial: '32', es: 'Bélgica', en: 'Belgium' },
  { iso: 'BO', dial: '591', es: 'Bolivia', en: 'Bolivia' },
  { iso: 'BR', dial: '55', es: 'Brasil', en: 'Brazil' },
  { iso: 'BG', dial: '359', es: 'Bulgaria', en: 'Bulgaria' },
  { iso: 'CL', dial: '56', es: 'Chile', en: 'Chile' },
  { iso: 'CN', dial: '86', es: 'China', en: 'China' },
  { iso: 'CR', dial: '506', es: 'Costa Rica', en: 'Costa Rica' },
  { iso: 'CU', dial: '53', es: 'Cuba', en: 'Cuba' },
  { iso: 'CZ', dial: '420', es: 'Chequia', en: 'Czechia' },
  { iso: 'DK', dial: '45', es: 'Dinamarca', en: 'Denmark' },
  { iso: 'EC', dial: '593', es: 'Ecuador', en: 'Ecuador' },
  { iso: 'EG', dial: '20', es: 'Egipto', en: 'Egypt' },
  { iso: 'SV', dial: '503', es: 'El Salvador', en: 'El Salvador' },
  { iso: 'AE', dial: '971', es: 'Emiratos Árabes', en: 'United Arab Emirates' },
  { iso: 'ES', dial: '34', es: 'España', en: 'Spain' },
  { iso: 'US', dial: '1', es: 'Estados Unidos / Canadá', en: 'United States / Canada' },
  { iso: 'FI', dial: '358', es: 'Finlandia', en: 'Finland' },
  { iso: 'FR', dial: '33', es: 'Francia', en: 'France' },
  { iso: 'DE', dial: '49', es: 'Alemania', en: 'Germany' },
  { iso: 'GR', dial: '30', es: 'Grecia', en: 'Greece' },
  { iso: 'GT', dial: '502', es: 'Guatemala', en: 'Guatemala' },
  { iso: 'HN', dial: '504', es: 'Honduras', en: 'Honduras' },
  { iso: 'HU', dial: '36', es: 'Hungría', en: 'Hungary' },
  { iso: 'IN', dial: '91', es: 'India', en: 'India' },
  { iso: 'ID', dial: '62', es: 'Indonesia', en: 'Indonesia' },
  { iso: 'IE', dial: '353', es: 'Irlanda', en: 'Ireland' },
  { iso: 'IL', dial: '972', es: 'Israel', en: 'Israel' },
  { iso: 'IT', dial: '39', es: 'Italia', en: 'Italy' },
  { iso: 'JP', dial: '81', es: 'Japón', en: 'Japan' },
  { iso: 'KE', dial: '254', es: 'Kenia', en: 'Kenya' },
  { iso: 'MY', dial: '60', es: 'Malasia', en: 'Malaysia' },
  { iso: 'MA', dial: '212', es: 'Marruecos', en: 'Morocco' },
  { iso: 'MX', dial: '52', es: 'México', en: 'Mexico' },
  { iso: 'NI', dial: '505', es: 'Nicaragua', en: 'Nicaragua' },
  { iso: 'NG', dial: '234', es: 'Nigeria', en: 'Nigeria' },
  { iso: 'NO', dial: '47', es: 'Noruega', en: 'Norway' },
  { iso: 'NZ', dial: '64', es: 'Nueva Zelanda', en: 'New Zealand' },
  { iso: 'NL', dial: '31', es: 'Países Bajos', en: 'Netherlands' },
  { iso: 'PA', dial: '507', es: 'Panamá', en: 'Panama' },
  { iso: 'PY', dial: '595', es: 'Paraguay', en: 'Paraguay' },
  { iso: 'PE', dial: '51', es: 'Perú', en: 'Peru' },
  { iso: 'PH', dial: '63', es: 'Filipinas', en: 'Philippines' },
  { iso: 'PL', dial: '48', es: 'Polonia', en: 'Poland' },
  { iso: 'PT', dial: '351', es: 'Portugal', en: 'Portugal' },
  { iso: 'GB', dial: '44', es: 'Reino Unido', en: 'United Kingdom' },
  { iso: 'RO', dial: '40', es: 'Rumanía', en: 'Romania' },
  { iso: 'RU', dial: '7', es: 'Rusia', en: 'Russia' },
  { iso: 'SA', dial: '966', es: 'Arabia Saudita', en: 'Saudi Arabia' },
  { iso: 'SG', dial: '65', es: 'Singapur', en: 'Singapore' },
  { iso: 'ZA', dial: '27', es: 'Sudáfrica', en: 'South Africa' },
  { iso: 'KR', dial: '82', es: 'Corea del Sur', en: 'South Korea' },
  { iso: 'SE', dial: '46', es: 'Suecia', en: 'Sweden' },
  { iso: 'CH', dial: '41', es: 'Suiza', en: 'Switzerland' },
  { iso: 'TH', dial: '66', es: 'Tailandia', en: 'Thailand' },
  { iso: 'TR', dial: '90', es: 'Turquía', en: 'Turkey' },
  { iso: 'UA', dial: '380', es: 'Ucrania', en: 'Ukraine' },
  { iso: 'UY', dial: '598', es: 'Uruguay', en: 'Uruguay' },
  { iso: 'VE', dial: '58', es: 'Venezuela', en: 'Venezuela' },
  { iso: 'VN', dial: '84', es: 'Vietnam', en: 'Vietnam' },
];

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

export function countryOptionLabel(country: VisitorCountry, locale: 'es' | 'en'): string {
  const name = locale === 'en' ? country.en : country.es;
  return `${name} (+${country.dial})`;
}

const DIAL_CODES_BY_LENGTH = [
  ...new Set(VISITOR_PHONE_COUNTRIES.map(country => country.dial)),
].sort((a, b) => b.length - a.length || a.localeCompare(b));

function looksColombianStored(digits: string): boolean {
  return /^573\d{9}$/.test(digits) || /^5760\d{8}$/.test(digits);
}

/**
 * Teléfono guardado con +57 a ciegas. Devuelve null si parece Colombia
 * (+57 y 10 dígitos de móvil 3… o fijo 60…). No escribe en la base.
 */
export function likelyPhoneAfterBlindPrefix(stored: string): string | null {
  const trimmed = stored.trim();
  const digits = onlyDigits(trimmed);
  if (!digits.startsWith('57')) return null;
  if (!trimmed.startsWith('+') && !trimmed.startsWith('57')) return null;
  if (looksColombianStored(digits)) return null;

  const rest = digits.slice(2);
  if (!rest) return '';
  if (looksColombianStored(rest) || isColombianMobileNational(rest)) {
    return rest.startsWith('57') ? `+${rest}` : `+57${rest}`;
  }
  const dial = matchDialCode(rest);
  if (dial && dial !== '57' && rest.length >= E164_MIN && rest.length <= E164_MAX) {
    return `+${rest}`;
  }
  return rest;
}

function matchDialCode(digits: string): string | null {
  for (const code of DIAL_CODES_BY_LENGTH) {
    if (!digits.startsWith(code)) continue;
    const national = digits.slice(code.length);
    if (national.length < 4) continue;
    if (code === '1' && digits.length !== 11) continue;
    return code;
  }
  return null;
}

/**
 * Campos de teléfono de Twenty. No fuerza `+57`: si el número es ambiguo
 * se envía el nacional sin indicativo inventado.
 */
export function twentyPhoneFields(value: string | null | undefined): {
  phoneNumber?: string;
  phoneCallingCode?: string;
} {
  const normalized = normalizeVisitorPhone(value ?? '');
  if (normalized.e164) {
    const digits = onlyDigits(normalized.e164);
    const dial = matchDialCode(digits);
    if (!dial) return { phoneNumber: digits };
    return { phoneCallingCode: `+${dial}`, phoneNumber: digits.slice(dial.length) };
  }
  const digits = onlyDigits(normalized.phone);
  if (digits.length >= E164_MIN && digits.length <= E164_MAX) return { phoneNumber: digits };
  return {};
}
