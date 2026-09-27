/**
 * Texto público de cada tema del Centro de Conocimiento (ADR-0014).
 * `topic_clusters.descripcion` en la BD guarda notas internas de análisis, no
 * copy para el visitante; por eso el nombre y la introducción públicos viven
 * aquí. Un tema sin entrada usa el nombre de la BD y no muestra introducción.
 */
import type { Locale } from '../i18n/utils';

type TextoTema = Record<Locale, { nombre: string; intro: string }>;

export const TEMAS_CONOCIMIENTO: Record<string, TextoTema> = {
  'monitoreo-uci': {
    es: {
      nombre: 'Monitoreo / UCI',
      intro:
        'Guías para elegir, recibir y mantener monitores de paciente y centrales de monitoreo en cuidado intensivo y hospitalización.',
    },
    en: {
      nombre: 'Monitoring / ICU',
      intro:
        'Guides to choosing, receiving and maintaining patient monitors and central monitoring stations in intensive care and hospital wards.',
    },
  },
  'invima-regulacion': {
    es: {
      nombre: 'INVIMA / regulación',
      intro:
        'El marco regulatorio de los dispositivos médicos en Colombia desde el lado del comprador: qué es el registro sanitario INVIMA y qué verificar antes de comprar.',
    },
    en: {
      nombre: 'INVIMA / regulatory',
      intro:
        "Colombia's medical device regulations from the buyer's side: what an INVIMA sanitary registration is and what to check before you buy.",
    },
  },
  'ventilacion-terapia-respiratoria': {
    es: {
      nombre: 'Ventilación / terapia respiratoria',
      intro:
        'Criterios para evaluar ventiladores mecánicos y equipos de soporte respiratorio según el servicio y el perfil de paciente.',
    },
    en: {
      nombre: 'Ventilation / respiratory therapy',
      intro:
        'Criteria for evaluating mechanical ventilators and respiratory support equipment by service and patient profile.',
    },
  },
  'cardiologia-reanimacion': {
    es: {
      nombre: 'Cardiología / reanimación',
      intro:
        'Qué revisar al comprar desfibriladores y equipos de reanimación, y qué respaldo documental exigir.',
    },
    en: {
      nombre: 'Cardiology / resuscitation',
      intro:
        'What to review when buying defibrillators and resuscitation equipment, and what documentation to require.',
    },
  },
  'movilidad-rehabilitacion': {
    es: {
      nombre: 'Movilidad / rehabilitación',
      intro: 'Guías de compra de caminadores, sillas de ruedas y ayudas para la movilidad.',
    },
    en: {
      nombre: 'Mobility / rehabilitation',
      intro: 'Buying guides for walkers, wheelchairs and mobility aids.',
    },
  },
  financiacion: {
    es: {
      nombre: 'Financiación',
      intro: 'Cómo funciona la financiación de equipos médicos y qué aclarar antes de firmar.',
    },
    en: {
      nombre: 'Financing',
      intro: 'How medical equipment financing works and what to clarify before signing.',
    },
  },
};

export function introTema(slug: string, locale: Locale): string | null {
  return TEMAS_CONOCIMIENTO[slug]?.[locale].intro ?? null;
}

export function nombreTema(slug: string, locale: Locale): string | null {
  return TEMAS_CONOCIMIENTO[slug]?.[locale].nombre ?? null;
}
