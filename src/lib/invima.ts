/**
 * INVIMA Knowledge Base - Información oficial sobre dispositivos médicos en Colombia
 * Fuente: https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/
 * Propósito: Enriquecer respuestas del asesor con contexto regulatorio oficial
 */

import invimaData from '../data/invima-knowledge-base.json';

export interface InvimaDeviceClass {
  nombre: string;
  riesgo: string;
  ejemplos: string[];
  certificacion_requerida: string;
  requisitos: string[];
}

export interface InvimaInfo {
  nombre: string;
  website: string;
  descripcion: string;
  dispositivos: {
    definicion: string;
    regulacion: string;
    clasificacion: Record<string, InvimaDeviceClass>;
  };
  normatividad_clave?: Record<string, { titulo: string; enlace: string }>;
}

const INVIMA: InvimaInfo = invimaData.invima;

/**
 * Patrones de palabras clave para identificar clase probable de dispositivo
 */
const DEVICE_CLASS_PATTERNS = {
  III: [
    'implant',
    'marcapasos',
    'pacemaker',
    'cardiovascular',
    'neural',
    'articular',
    'corazón',
    'heart',
    'bypass',
    'stent',
  ],
  IIB: [
    'ventilador',
    'ventilator',
    'quirúrgico',
    'surgical',
    'energía',
    'energy',
    'sistema de infusión',
    'infusion pump',
    'implante óseo',
    'bone implant',
    'electrobisturí',
    'electrosurgical',
  ],
  II: [
    'monitor',
    'electrocardiogr',
    'ecógrafo',
    'ultrasound',
    'presión',
    'pressure',
    'diagnóstico',
    'diagnostic',
    'rayos x',
    'x-ray',
    'tomografía',
    'tomography',
  ],
  I: [
    'vendaje',
    'bandage',
    'instrumento',
    'instrument',
    'protección',
    'protection',
    'básico',
    'basic',
  ],
};

/**
 * Obtener la clase probable de un dispositivo basado en el nombre
 */
export function getDeviceClass(deviceName: string): string | null {
  const nameLower = deviceName.toLowerCase();

  for (const [className, keywords] of Object.entries(DEVICE_CLASS_PATTERNS)) {
    if (keywords.some(keyword => nameLower.includes(keyword))) {
      return className;
    }
  }

  return null;
}

/**
 * Obtener información detallada de una clase
 */
export function getClassInfo(className: string): InvimaDeviceClass | null {
  const normalized = className.toUpperCase();
  return INVIMA.dispositivos.clasificacion[normalized] || null;
}

/**
 * Obtener timeline de registro para una clase
 */
export function getRegistrationTimeline(className: string): string {
  const timelines: Record<string, string> = {
    I: '60-90 días',
    II: '4-6 meses',
    IIB: '8-12 meses',
    III: '12-24 meses',
  };
  return timelines[className.toUpperCase()] || 'Variable según regulación';
}

/**
 * Obtener requisitos específicos para una clase
 */
export function getRequirements(className: string): string[] {
  const info = getClassInfo(className);
  return info?.requisitos || [];
}

/**
 * Generar un fragmento de contexto INVIMA para enriquecer respuestas
 */
export function getInvimaContext(deviceName?: string): string {
  const deviceClass = deviceName ? getDeviceClass(deviceName) : null;

  let context = `
Regulación oficial (INVIMA - Instituto Nacional de Vigilancia de Medicamentos y Alimentos):
- Decreto 4725 de 2005 (Régimen de registros sanitarios)
- Autoridad: INVIMA (https://www.invima.gov.co)
- Aplicable a: Fabricantes, importadores y distribuidores en Colombia
`;

  if (deviceClass) {
    const info = getClassInfo(deviceClass);
    const timeline = getRegistrationTimeline(deviceClass);

    context += `

Clasificación probable del dispositivo:
- Clase: ${deviceClass} - ${info?.riesgo}
- Certificación requerida: ${info?.certificacion_requerida}
- Timeline de registro: ${timeline}

Requisitos técnicos principales:
${info?.requisitos.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
  }

  return context;
}

/**
 * Generar respuesta enriquecida con contexto INVIMA
 */
export function enrichResponse(originalResponse: string, deviceName?: string): string {
  const deviceClass = deviceName ? getDeviceClass(deviceName) : null;

  if (!deviceClass) {
    return originalResponse;
  }

  const info = getClassInfo(deviceClass);
  const timeline = getRegistrationTimeline(deviceClass);

  const enrichment = `

**Contexto Regulatorio (INVIMA):**
- Clasificación: **${deviceClass}** - ${info?.riesgo}
- Certificación: ${info?.certificacion_requerida}
- Timeline de registro: **${timeline}**
- Regulación: Decreto 4725 de 2005
- Autoridad: INVIMA (invima.gov.co)
`;

  return originalResponse + enrichment;
}

/**
 * Validar si un dispositivo requiere análisis especial
 */
export function needsSpecialAnalysis(deviceName: string): boolean {
  const deviceClass = getDeviceClass(deviceName);
  return deviceClass === 'IIB' || deviceClass === 'III';
}

/**
 * Obtener referencias normativas relevantes
 */
export function getNormativeReferences(): Array<{ titulo: string; enlace: string }> {
  const regulations = INVIMA.normatividad_clave as Record<
    string,
    { titulo: string; enlace: string }
  >;

  return Object.values(regulations).slice(0, 3); // Primeras 3 regulaciones
}

/**
 * Validar conformidad básica de un dispositivo
 */
export function validateConformity(deviceName: string): {
  isValid: boolean;
  requirements: string[];
  warnings: string[];
} {
  const deviceClass = getDeviceClass(deviceName);

  if (!deviceClass) {
    return {
      isValid: false,
      requirements: [],
      warnings: ['No se pudo determinar la clasificación del dispositivo'],
    };
  }

  const info = getClassInfo(deviceClass);
  const requirements = info?.requisitos || [];
  const warnings = [];

  if (deviceClass === 'III') {
    warnings.push('Dispositivos Clase III requieren aprobación previa de INVIMA');
    warnings.push('Ensayos clínicos completos son obligatorios');
  }

  if (deviceClass === 'IIB') {
    warnings.push('Se requiere evaluación de conformidad con terceros notificados');
  }

  return {
    isValid: true,
    requirements,
    warnings,
  };
}

/**
 * Obtener tips de conformidad para el cliente
 */
export function getComplianceTips(): string[] {
  return [
    '✓ Verificar que el proveedor tenga registro sanitario activo en INVIMA',
    '✓ Solicitar certificación de Sistema de Gestión de Calidad (BPM)',
    '✓ Revisar documentación técnica completa del dispositivo',
    '✓ Consultar listado público de establecimientos certificados en INVIMA',
    '✓ Para equipos IIB/III, solicitar estudios técnicos y evaluación de riesgos',
  ];
}

export default {
  getDeviceClass,
  getClassInfo,
  getRegistrationTimeline,
  getRequirements,
  getInvimaContext,
  enrichResponse,
  needsSpecialAnalysis,
  getNormativeReferences,
  validateConformity,
  getComplianceTips,
};
