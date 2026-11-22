import type { Locale } from '../i18n/utils';

/**
 * Snippets aligned to Search Console intent (Nov 2026).
 * Copy stays inside what the pages already explain: steps, risk classes,
 * documents, and a quote. No fees, timelines, or registration numbers.
 */
export const INVIMA_TOPIC_EN = {
  title: 'INVIMA: medical devices in Colombia | I-ME',
  h1: 'INVIMA: medical device regulation in Colombia',
  description:
    'INVIMA device registration in Colombia: steps, risk classes and documents to review. Request a quote from I-ME.',
} as const;

export const INVIMA_CHECKLIST_EN = {
  title: 'INVIMA checklist to buy medical equipment | I-ME',
  h1: 'INVIMA checklist for buying medical equipment in Colombia',
  description:
    'Before buying medical equipment in Colombia, check the model’s INVIMA registration, holder, importer and technical documents. Request a quote from I-ME.',
} as const;

export const INVIMA_REGISTRATION_EN = {
  title: 'Medical device registration in Colombia (INVIMA) | I-ME',
  h1: 'Medical device registration in Colombia (INVIMA)',
  description:
    'Medical device registration in Colombia for foreign manufacturers: INVIMA pathway and dossier support. Request an assessment. No approval is guaranteed.',
} as const;

/** Search snippets for the manufacturer guides; their URLs remain unchanged. */
const descriptions: Record<string, Record<Locale, string>> = {
  'registro-sanitario-invima-equipos-biomedicos': {
    es: 'Clase de riesgo, dossier y qué revisar antes de fabricar o comprar equipos biomédicos en Colombia. I-ME evalúa el caso. La aprobación no se garantiza.',
    en: 'Risk class, the dossier and what to check before making or buying biomedical equipment in Colombia. I-ME reviews the case. Approval is not guaranteed.',
  },
  'checklist-invima-compra-equipos-medicos': {
    es: 'Antes de firmar, verifique el registro INVIMA del modelo, titular, importador, garantía y documentos técnicos del equipo. Lista para comprar en Colombia.',
    en: INVIMA_CHECKLIST_EN.description,
  },
};

export function descripcionInvima(slug: string, locale: Locale): string | undefined {
  return descriptions[slug]?.[locale];
}
