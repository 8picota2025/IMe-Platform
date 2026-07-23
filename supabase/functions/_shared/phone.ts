/**
 * Normalizacion minima de telefonos a formato E.164 para el CMS comercial.
 * No usamos una libreria de terceros (libphonenumber) para mantener el
 * bundle de la Edge Function liviano; solo cubrimos los casos que necesita
 * el flujo de WhatsApp (wa.me) y el registro en Twenty CRM.
 *
 * Reglas:
 *  - Se aceptan digitos, espacios, guiones, parentesis y un '+' inicial.
 *  - Si el numero ya trae codigo de pais (empieza con '+' o con el
 *    countryCode explicito), se respeta.
 *  - Si no trae codigo de pais, se asume `countryCode` (default 57 = CO).
 *  - Longitud final validada de forma laxa (8 a 15 digitos, tope E.164).
 */

export interface NormalizePhoneResult {
  ok: boolean;
  e164?: string;
  error?: string;
}

const DEFAULT_COUNTRY_CODE = '57';

function onlyDigits(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/**
 * Normaliza un telefono a E.164 (`+<codigo><numero>`, sin espacios).
 * `countryCode` es el codigo de pais SIN '+' (ej. '57' para Colombia).
 */
export function normalizeE164(
  phone: unknown,
  countryCode: string = DEFAULT_COUNTRY_CODE
): NormalizePhoneResult {
  if (typeof phone !== 'string' || !phone.trim()) {
    return { ok: false, error: 'Telefono vacio' };
  }

  const raw = phone.trim();
  const country = onlyDigits(String(countryCode || DEFAULT_COUNTRY_CODE)) || DEFAULT_COUNTRY_CODE;

  let digits: string;
  if (raw.startsWith('+')) {
    digits = onlyDigits(raw);
  } else {
    const local = onlyDigits(raw);
    // Evita duplicar el codigo de pais si el usuario ya lo escribio sin '+'
    // (ej. "573001234567" con countryCode "57").
    digits =
      local.startsWith(country) && local.length > country.length + 6 ? local : `${country}${local}`;
  }

  // E.164: maximo 15 digitos (sin '+'), minimo razonable de 8.
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: 'Telefono con longitud invalida' };
  }

  return { ok: true, e164: `+${digits}` };
}

/**
 * Enmascara un telefono para logs/telemetria (nunca loguear el numero completo).
 * "+573001234567" -> "+573******67"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.startsWith('+') ? phone.slice(1) : phone;
  if (digits.length <= 4) return '*'.repeat(digits.length);
  const head = digits.slice(0, 4);
  const tail = digits.slice(-2);
  return `+${head}${'*'.repeat(Math.max(0, digits.length - head.length - tail.length))}${tail}`;
}
