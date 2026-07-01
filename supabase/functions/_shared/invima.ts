/**
 * Clasificación de dispositivos médicos INVIMA (Colombia) — subset Deno-safe
 * de src/lib/invima.ts / src/data/invima-knowledge-base.json.
 *
 * Duplicado deliberado: src/lib/invima.ts importa su fuente como JSON
 * (`import invimaData from '../data/invima-knowledge-base.json'`), que
 * requiere un import attribute (`with { type: 'json' }`) para resolver en
 * el runtime Deno de las Edge Functions y no se puede verificar sin
 * desplegar (supabase/functions no corre en CI). Este archivo evita ese
 * riesgo usando un objeto TS plano, igual que el resto de imports
 * cross-runtime ya usados en asesor/index.ts (ej. asesor-knowledge.ts).
 *
 * Fuente original: https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/
 * (Decreto 4725 de 2005). Si se actualiza invima-knowledge-base.json, replicar
 * el cambio aqui.
 */

export interface InvimaDeviceClass {
  riesgo: string;
  certificacion_requerida: string;
  requisitos: string[];
}

const CLASIFICACION: Record<string, InvimaDeviceClass> = {
  I: {
    riesgo: 'riesgo mínimo',
    certificacion_requerida: 'Presunción de conformidad',
    requisitos: [
      'Declaración de conformidad del fabricante',
      'Descripción del dispositivo',
      'Certificación del sistema de gestión de calidad (BPM)',
    ],
  },
  II: {
    riesgo: 'riesgo moderado',
    certificacion_requerida: 'Conformidad evaluada',
    requisitos: [
      'Estudio técnico de biocompatibilidad',
      'Certificación de sistema de gestión de calidad',
      'Evaluación de conformidad con estándares aplicables',
      'Descripción técnica del dispositivo',
      'Comprobaciones analíticas',
    ],
  },
  IIB: {
    riesgo: 'riesgo moderado-alto',
    certificacion_requerida: 'Conformidad evaluada con tercero notificado',
    requisitos: [
      'Ensayos clínicos o pruebas de desempeño',
      'Evaluación de riesgos completa',
      'Certificación de calidad por terceros',
      'Estudios técnicos exhaustivos',
      'Declaración de conformidad',
    ],
  },
  III: {
    riesgo: 'riesgo alto',
    certificacion_requerida: 'Aprobación previa de registro sanitario',
    requisitos: [
      'Ensayos clínicos completos',
      'Evaluación de riesgos exhaustiva',
      'Certificación de organismo notificado',
      'Seguimiento post-comercialización',
      'Estudios de biocompatibilidad',
      'Pruebas de esterilidad y pirógenos',
    ],
  },
};

const REGISTRATION_TIMELINE: Record<string, string> = {
  I: '60-90 días',
  II: '4-6 meses',
  IIB: '8-12 meses',
  III: '12-24 meses',
};

/** Palabras clave por clase (ES/EN), igual que src/lib/invima.ts. */
const DEVICE_CLASS_PATTERNS: Record<string, string[]> = {
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

/** Clase INVIMA probable a partir del nombre del dispositivo (heurística por palabras clave). */
export function getDeviceClass(deviceName: string): string | null {
  const nameLower = deviceName.toLowerCase();
  for (const [className, keywords] of Object.entries(DEVICE_CLASS_PATTERNS)) {
    if (keywords.some(keyword => nameLower.includes(keyword))) return className;
  }
  return null;
}

export function getClassInfo(className: string): InvimaDeviceClass | null {
  return CLASIFICACION[className.toUpperCase()] ?? null;
}

export function getRegistrationTimeline(className: string): string {
  return REGISTRATION_TIMELINE[className.toUpperCase()] ?? 'Variable según regulación';
}
