/**
 * Pre-diagnóstico INVIMA en el Centro de Conocimiento.
 * Copy de chips y asunto del correo: especificación 2026-10-26.
 * No promete aprobación ni plazos de INVIMA.
 */

export const CAMPANA_INVIMA_CONOCIMIENTO = 'invima_conocimiento' as const;
export const EMAIL_REGISTRO_INVIMA = 'registroinvima@i-me.com.co';
export const TIPO_PROYECTO_INVIMA_CONOCIMIENTO = 'prediagnostico_registro_invima';
export const FAMILIA_INVIMA_CONOCIMIENTO = 'invima-regulacion';

export const REFERENCIAS_ES = ['1 modelo', '2 a 5 modelos', 'Más de 5 / Familia completa'] as const;
export const REFERENCIAS_EN = [
  '1 model',
  '2\u20135 models',
  '6+ models / Full product family',
] as const;
export const DOCUMENTACION_ES = [
  'Tengo CVL + ISO 13485',
  'En preparación',
  'Necesito revisarlos',
] as const;
export const DOCUMENTACION_EN = [
  'Have CFS/CVL + ISO 13485',
  'In progress',
  'Need pre-check',
] as const;
export const REPRESENTACION_ES = [
  'Busco importador autorizado en Colombia',
  'Ya tengo importador local',
  'Quiero evaluar opciones',
] as const;
export const REPRESENTACION_EN = [
  'Need an authorized importer in Colombia',
  'Already have a local importer',
  'Exploring options',
] as const;

const REFERENCIAS = new Set<string>([...REFERENCIAS_ES, ...REFERENCIAS_EN]);
const DOCUMENTACION = new Set<string>([...DOCUMENTACION_ES, ...DOCUMENTACION_EN]);
const REPRESENTACION = new Set<string>([...REPRESENTACION_ES, ...REPRESENTACION_EN]);

export interface SeleccionPrediagnostico {
  producto: string;
  referencias: string;
  documentacion: string;
  representacion: string;
  nombre: string;
  empresa: string;
  pais: string;
  email: string;
  telefono?: string;
}

export function opcionesPrediagnostico(locale: 'es' | 'en'): {
  referencias: readonly string[];
  documentacion: readonly string[];
  representacion: readonly string[];
} {
  if (locale === 'en') {
    return {
      referencias: REFERENCIAS_EN,
      documentacion: DOCUMENTACION_EN,
      representacion: REPRESENTACION_EN,
    };
  }
  return {
    referencias: REFERENCIAS_ES,
    documentacion: DOCUMENTACION_ES,
    representacion: REPRESENTACION_ES,
  };
}

function limpiarAsunto(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[{}]/g, '')
    .trim()
    .slice(0, 120);
}

/** Asunto interno fijo, en español, con empresa y país del formulario. */
export function asuntoCotizacionInvima(empresa: string, pais: string): string {
  return `[Cotización Registro INVIMA - Web] ${limpiarAsunto(empresa)} (${limpiarAsunto(pais)})`;
}

export function destinatariosInvimaConocimiento(actuales: readonly string[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const correo of [EMAIL_REGISTRO_INVIMA, ...actuales]) {
    const limpio = correo.trim();
    const clave = limpio.toLowerCase();
    if (!limpio || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(limpio);
  }
  return salida;
}

export function resumenPrediagnostico(input: SeleccionPrediagnostico): string {
  const lineas = [
    `Producto y finalidad prevista: ${input.producto.trim()}`,
    `Referencias o modelos: ${input.referencias.trim()}`,
    `Documentación en país de origen: ${input.documentacion.trim()}`,
    `Representación en Colombia: ${input.representacion.trim()}`,
    `Nombre y cargo: ${input.nombre.trim()}`,
    `Empresa fabricante: ${input.empresa.trim()}`,
    `País: ${input.pais.trim()}`,
    `Correo corporativo: ${input.email.trim()}`,
  ];
  const telefono = input.telefono?.trim();
  if (telefono) lineas.push(`WhatsApp / Teléfono: ${telefono}`);
  return lineas.join('\n');
}

export function validarSeleccionPrediagnostico(
  input: Partial<SeleccionPrediagnostico>,
  locale: 'es' | 'en' = 'es'
): { ok: true } | { ok: false; error: string } {
  const es = locale !== 'en';
  if (!input.producto?.trim() || input.producto.trim().length < 2) {
    return {
      ok: false,
      error: es
        ? 'Indica el producto y su finalidad prevista.'
        : 'Enter the device and its intended use.',
    };
  }
  if (!input.referencias || !REFERENCIAS.has(input.referencias)) {
    return {
      ok: false,
      error: es
        ? 'Selecciona cuántas referencias o modelos desea registrar.'
        : 'Select how many models or references you plan to register.',
    };
  }
  if (!input.documentacion || !DOCUMENTACION.has(input.documentacion)) {
    return {
      ok: false,
      error: es
        ? 'Selecciona el estado de la documentación en el país de origen.'
        : 'Select the home-country documentation status.',
    };
  }
  if (!input.representacion || !REPRESENTACION.has(input.representacion)) {
    return {
      ok: false,
      error: es
        ? 'Selecciona la representación en Colombia.'
        : 'Select the local setup in Colombia.',
    };
  }
  return { ok: true };
}
