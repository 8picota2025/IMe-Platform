/**
 * Verificación de NIT/CC Colombia + forma canónica para DIAN/Siigo.
 * La importación de razón social desde DIAN vive en Edge (`consultar-nit-dian`).
 *
 * Mantiene la misma API que la copia Edge (`_shared/nit-verificacion.ts`).
 */

import {
  digitoVerificacionNit,
  normalizeNumeroDocumento,
  soloDigitosDocumento,
  type TipoDocumentoFiscal,
  type TipoPersonaFiscal,
} from './fiscal';

export type { TipoDocumentoFiscal, TipoPersonaFiscal };

export interface NitVerificacion {
  ok: boolean;
  tipo: TipoDocumentoFiscal;
  /** Solo dígitos, listo para Siigo (incluye DV si venía o se calculó). */
  numero: string | null;
  /** Base sin dígito de verificación (NIT). */
  nit_base: string | null;
  digito_verificacion: number | null;
  /** Presentación humana 901441908-2 */
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

export function formatearNitConDv(nitConDv: string): string {
  const digits = soloDigitosDocumento(nitConDv);
  if (digits.length < 2) return digits;
  return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
}

/**
 * Rutina de verificación del campo NIT (formato + dígito de verificación).
 * Acepta espacios, puntos y guiones; normaliza a dígitos.
 */
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
      errores.push('NIT debe tener 9 digitos (base) o 10 (base+DV), sin letras ni espacios');
      return {
        ok: false,
        tipo,
        numero,
        nit_base: null,
        digito_verificacion: null,
        numero_formateado: null,
        errores,
        avisos,
      };
    }

    let nitBase: string;
    let dv: number;
    if (numero.length === 9) {
      nitBase = numero;
      const calculated = digitoVerificacionNit(nitBase);
      if (calculated == null) {
        errores.push('No se pudo calcular el digito de verificacion');
        return {
          ok: false,
          tipo,
          numero,
          nit_base: nitBase,
          digito_verificacion: null,
          numero_formateado: null,
          errores,
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
