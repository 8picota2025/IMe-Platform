/**
 * Verificación NIT Colombia (formato + dígito). Copia Edge-safe de src/lib/nit-dian.ts.
 */

export type TipoDocumentoFiscal = 'CC' | 'NIT' | 'CE' | 'PP' | 'OTRO';
export type TipoPersonaFiscal = 'natural' | 'juridica';

export interface NitVerificacion {
  ok: boolean;
  tipo: TipoDocumentoFiscal;
  numero: string | null;
  nit_base: string | null;
  digito_verificacion: number | null;
  numero_formateado: string | null;
  errores: string[];
  avisos: string[];
}

export interface ContribuyenteDian {
  nit: string;
  razon_social: string;
  tipo_persona: TipoPersonaFiscal | null;
  estado: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  responsable_iva: boolean | null;
  fuente: string;
  raw?: unknown;
}

export function soloDigitosDocumento(value: string): string {
  return value.replace(/\D/g, '');
}

export function digitoVerificacionNit(nitSinDv: string): number | null {
  const digits = soloDigitosDocumento(nitSinDv);
  if (!digits || digits.length < 5 || digits.length > 15) return null;
  const primes = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[digits.length - 1 - i]);
    const p = primes[i];
    if (!Number.isFinite(d) || p == null) return null;
    sum += d * p;
  }
  const mod = sum % 11;
  return mod > 1 ? 11 - mod : mod;
}

export function normalizeNumeroDocumento(
  tipo: TipoDocumentoFiscal | null | undefined,
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (tipo === 'NIT' || tipo === 'CC' || !tipo) {
    const digits = soloDigitosDocumento(trimmed);
    return digits || null;
  }
  const cleaned = trimmed.replace(/\s+/g, '').toUpperCase();
  return cleaned || null;
}

export function formatearNitConDv(nitConDv: string): string {
  const digits = soloDigitosDocumento(nitConDv);
  if (digits.length < 2) return digits;
  return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
}

export function verificarNitCampo(
  raw: string | null | undefined,
  tipo: TipoDocumentoFiscal = 'NIT'
): NitVerificacion {
  const errores: string[] = [];
  const avisos: string[] = [];
  const numero = normalizeNumeroDocumento(tipo, raw);

  if (!numero) {
    return {
      ok: false,
      tipo,
      numero: null,
      nit_base: null,
      digito_verificacion: null,
      numero_formateado: null,
      errores: ['Ingresa un numero de documento'],
      avisos,
    };
  }

  if (tipo === 'NIT') {
    if (!/^\d{9,10}$/.test(numero)) {
      return {
        ok: false,
        tipo,
        numero,
        nit_base: null,
        digito_verificacion: null,
        numero_formateado: null,
        errores: ['NIT debe tener 9 digitos (base) o 10 (base+DV), sin letras ni espacios'],
        avisos,
      };
    }

    let nitBase: string;
    let dv: number;
    if (numero.length === 9) {
      nitBase = numero;
      const calculated = digitoVerificacionNit(nitBase);
      if (calculated == null) {
        return {
          ok: false,
          tipo,
          numero,
          nit_base: nitBase,
          digito_verificacion: null,
          numero_formateado: null,
          errores: ['No se pudo calcular el digito de verificacion'],
          avisos,
        };
      }
      dv = calculated;
      avisos.push(`Digito de verificacion calculado: ${dv}`);
    } else {
      nitBase = numero.slice(0, -1);
      dv = Number(numero.slice(-1));
      const expected = digitoVerificacionNit(nitBase);
      if (expected == null) {
        errores.push('No se pudo validar el digito de verificacion');
      } else if (dv !== expected) {
        errores.push(
          `Digito de verificacion incorrecto: ingresaste ${dv}, DIAN espera ${expected} (NIT ${nitBase}-${expected})`
        );
      }
    }

    const numeroFinal = `${nitBase}${dv}`;
    return {
      ok: errores.length === 0,
      tipo,
      numero: numeroFinal,
      nit_base: nitBase,
      digito_verificacion: dv,
      numero_formateado: formatearNitConDv(numeroFinal),
      errores,
      avisos,
    };
  }

  if (tipo === 'CC') {
    if (!/^\d{5,12}$/.test(numero)) {
      errores.push('CC invalida: 5 a 12 digitos');
    }
    return {
      ok: errores.length === 0,
      tipo,
      numero,
      nit_base: null,
      digito_verificacion: null,
      numero_formateado: numero,
      errores,
      avisos,
    };
  }

  return {
    ok: true,
    tipo,
    numero,
    nit_base: null,
    digito_verificacion: null,
    numero_formateado: numero,
    errores,
    avisos,
  };
}
