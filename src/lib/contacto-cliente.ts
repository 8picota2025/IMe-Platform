/**
 * Datos de contacto del cliente en una cotización.
 * El correo y el teléfono de I-ME solo pueden aparecer como emisor o en el pie,
 * nunca en el bloque del cliente, el correo de envío ni la página de aceptación.
 */
import { IME_WHATSAPP_DISPLAY, IME_WHATSAPP_E164, IME_WHATSAPP_TEL } from './contacto-oficial.ts';

export const IME_RAZON_SOCIAL = 'International Medical Enterprise IME S.A.S.';
export const IME_NIT = '901871720';
export const IME_NIT_CON_DV = '901871720-1';
export const IME_WEB = 'i-me.com.co';
export const IME_EMAIL_PUBLICO = 'info@i-me.com.co';
export const IME_EMAIL_DOMINIO = 'i-me.com.co';

/** Marcador visible cuando el dato del cliente falta. Nunca se rellena con datos de I-ME. */
export const DATO_CLIENTE_VACIO = '—';

const TELEFONOS_IME = [IME_WHATSAPP_E164, IME_WHATSAPP_DISPLAY, IME_WHATSAPP_TEL];

export function digitosTelefono(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function esCorreoIme(email: string | null | undefined): boolean {
  const normalizado = String(email ?? '')
    .trim()
    .toLowerCase();
  const arroba = normalizado.lastIndexOf('@');
  if (arroba < 1) return false;
  const dominio = normalizado.slice(arroba + 1).replace(/\.+$/, '');
  return dominio === IME_EMAIL_DOMINIO || dominio.endsWith(`.${IME_EMAIL_DOMINIO}`);
}

function telefonosImeDigitos(): Set<string> {
  const oficiales = new Set<string>();
  for (const raw of TELEFONOS_IME) {
    const digitos = digitosTelefono(raw);
    if (!digitos) continue;
    oficiales.add(digitos);
    if (digitos.startsWith('57') && digitos.length > 10) oficiales.add(digitos.slice(2));
  }
  return oficiales;
}

/** True si el número, con o sin código de país, es un teléfono oficial de I-ME. */
export function esTelefonoIme(value: string | null | undefined): boolean {
  const digitos = digitosTelefono(value);
  if (digitos.length < 10) return false;
  const oficiales = telefonosImeDigitos();
  const local = digitos.startsWith('57') && digitos.length > 10 ? digitos.slice(2) : digitos;
  return oficiales.has(digitos) || oficiales.has(local);
}

export function esNitIme(value: string | null | undefined): boolean {
  const digitos = String(value ?? '').replace(/\D/g, '');
  return digitos === '901871720' || digitos === '9018717201';
}

function compactarNombre(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '');
}

const RAZONES_IME = [
  'International Medical Enterprise IME S.A.S.',
  'International Medical Enterprise IME SAS',
  'I-ME International Medical Enterprise S.A.S.',
  'INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
  'INTERNATIONAL MEDICAL ENTERPRISE',
].map(compactarNombre);

export function esRazonSocialIme(value: string | null | undefined): boolean {
  const compacto = compactarNombre(String(value ?? ''));
  if (compacto.length < 8) return false;
  return RAZONES_IME.some(razon => compacto === razon);
}

export type CampoCliente = 'email' | 'telefono' | 'nit' | 'razon' | 'texto';

/** Valor imprimible del cliente. Vacío o dato de I-ME → «—». */
export function textoCliente(value: string | null | undefined, campo: CampoCliente): string {
  const raw = String(value ?? '').trim();
  if (!raw) return DATO_CLIENTE_VACIO;
  if (campo === 'email' && esCorreoIme(raw)) return DATO_CLIENTE_VACIO;
  if (campo === 'telefono' && esTelefonoIme(raw)) return DATO_CLIENTE_VACIO;
  if (campo === 'nit' && esNitIme(raw)) return DATO_CLIENTE_VACIO;
  if (campo === 'razon' && esRazonSocialIme(raw)) return DATO_CLIENTE_VACIO;
  return raw;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactoClienteInput {
  email?: string | null;
  telefono?: string | null;
}

export type CodigoContactoCliente = 'SIN_EMAIL' | 'SIN_TELEFONO' | 'CONTACTO_IME';

export type ResultadoContactoCliente =
  | { ok: true; email: string; telefono: string }
  | { ok: false; code: CodigoContactoCliente; message: string; status: 422 };

/**
 * Envío, PDF oficial y página de aceptación: correo y teléfono del cliente
 * tienen que existir y no pueden ser de I-ME.
 */
export function validarContactoClienteParaEnvio(
  row: ContactoClienteInput
): ResultadoContactoCliente {
  const email = String(row.email ?? '')
    .trim()
    .toLowerCase();
  const telefono = String(row.telefono ?? '').trim();
  if (!email) {
    return {
      ok: false,
      code: 'SIN_EMAIL',
      message: 'Falta el correo del cliente. No se puede completar ni enviar la cotización.',
      status: 422,
    };
  }
  if (esCorreoIme(email)) {
    return {
      ok: false,
      code: 'CONTACTO_IME',
      message: 'El correo del cliente no puede ser de I-ME (@i-me.com.co).',
      status: 422,
    };
  }
  if (!EMAIL_RE.test(email)) {
    return {
      ok: false,
      code: 'SIN_EMAIL',
      message: 'Falta un correo válido del cliente.',
      status: 422,
    };
  }
  if (!telefono) {
    return {
      ok: false,
      code: 'SIN_TELEFONO',
      message: 'Falta el teléfono del cliente. No se puede completar ni enviar la cotización.',
      status: 422,
    };
  }
  if (esTelefonoIme(telefono)) {
    return {
      ok: false,
      code: 'CONTACTO_IME',
      message: 'El teléfono del cliente no puede coincidir con un teléfono de I-ME.',
      status: 422,
    };
  }
  return { ok: true, email, telefono };
}

/**
 * Borrador: el correo y el teléfono pueden ir vacíos.
 * Si traen un dato de I-ME, o un correo con forma inválida, no se guardan.
 */
export function validarContactoClienteBorrador(
  row: ContactoClienteInput
): { ok: true } | { ok: false; code: CodigoContactoCliente; message: string; status: 422 } {
  const email = String(row.email ?? '').trim();
  const telefono = String(row.telefono ?? '').trim();
  if (email && esCorreoIme(email)) {
    return {
      ok: false,
      code: 'CONTACTO_IME',
      message: 'El correo del cliente no puede ser de I-ME (@i-me.com.co).',
      status: 422,
    };
  }
  if (email && !EMAIL_RE.test(email)) {
    return {
      ok: false,
      code: 'SIN_EMAIL',
      message: 'El correo del cliente no tiene un formato válido.',
      status: 422,
    };
  }
  if (telefono && esTelefonoIme(telefono)) {
    return {
      ok: false,
      code: 'CONTACTO_IME',
      message: 'El teléfono del cliente no puede coincidir con un teléfono de I-ME.',
      status: 422,
    };
  }
  return { ok: true };
}
