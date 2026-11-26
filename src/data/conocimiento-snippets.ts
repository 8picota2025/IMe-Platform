import type { Locale } from '../i18n/utils';

/**
 * Title, H1 and meta written for the query, not truncated from the markdown.
 * Facts stay inside the published article: no fees, no timelines, no clinical claims.
 * Title ≤60 (brand included). Description ≤155.
 */
export interface ConocimientoSnippet {
  title: string;
  h1: string;
  description: string;
  /** Shown and marked up only when the article body has no FAQ section. */
  faq?: Array<{ q: string; a: string }>;
  links?: Array<{ href: string; label: string }>;
}

const REGISTRO_ES: ConocimientoSnippet = {
  title: 'Registro sanitario INVIMA de equipos biomédicos | I-ME',
  h1: 'Registro sanitario INVIMA para equipos biomédicos',
  description:
    'Clase de riesgo, dossier y qué revisar antes de fabricar o comprar equipos biomédicos en Colombia. I-ME evalúa el caso. La aprobación no se garantiza.',
  links: [
    {
      href: '/es/conocimiento/checklist-invima-compra-equipos-medicos/',
      label: 'Checklist INVIMA antes de comprar',
    },
    {
      href: '/es/registro-sanitario-invima-fabricantes/',
      label: 'Evaluación para fabricantes',
    },
    {
      href: '/es/familias/mobiliario/',
      label: 'Cama hospitalaria eléctrica',
    },
  ],
};

const REGISTRO_EN: ConocimientoSnippet = {
  title: 'INVIMA registration: risk class and dossier | I-ME',
  h1: 'INVIMA registration for biomedical equipment',
  description:
    'Risk class, the dossier and what to check before making or buying biomedical equipment in Colombia. I-ME reviews the case. Approval is not guaranteed.',
  links: [
    {
      href: '/en/knowledge/checklist-invima-compra-equipos-medicos/',
      label: 'INVIMA checklist before you buy',
    },
    {
      href: '/en/medical-device-registration-colombia/',
      label: 'Assessment for manufacturers',
    },
    {
      href: '/en/families/mobiliario/',
      label: 'Hospital beds',
    },
  ],
};

const TENSIOMETRO_ES: ConocimientoSnippet = {
  title: 'Cómo elegir un tensiómetro digital | I-ME',
  h1: 'Cómo elegir un tensiómetro digital',
  description:
    '¿Muñeca o brazo? Compare los tensiómetros Carditek del catálogo I-ME. Pulse, Vital y Smart publican precio con IVA. Power se cotiza.',
  faq: [
    {
      q: '¿Muñeca o brazo?',
      a: 'La ficha lo define. Carditek Pulse es de muñeca. Vital y Smart son de brazo para el hogar. Power figura para hogar o cuidado y se cotiza.',
    },
    {
      q: '¿Cuáles publican precio?',
      a: 'Pulse, Vital y Smart publican precio con IVA. Power no. El envío a Colombia es adicional y la entrega es en menos de 10 días hábiles.',
    },
    {
      q: '¿Esta guía dice qué cifra es normal?',
      a: 'No. Compara referencias del catálogo. No diagnostica y no dice qué lectura es normal.',
    },
  ],
  links: [{ href: '/es/tensiometros-digitales/', label: 'Ver tensiómetros digitales con precio' }],
};

const TENSIOMETRO_EN: ConocimientoSnippet = {
  title: 'How to choose a blood pressure monitor | I-ME',
  h1: 'How to choose a blood pressure monitor',
  description:
    'Wrist or upper arm? Compare Carditek monitors in the I-ME catalog. Pulse, Vital and Smart publish a VAT price. Power is quoted.',
  faq: [
    {
      q: 'How do I choose a wrist or an upper-arm monitor?',
      a: 'The published sheet decides it. Carditek Pulse is a wrist monitor. Vital and Smart are upper-arm home monitors. Power is listed for home or care and is quoted.',
    },
    {
      q: 'Which blood pressure monitors show a price?',
      a: 'Pulse, Vital and Smart publish a VAT-inclusive price. Power does not. Shipping to Colombia is extra and delivery is in under 10 business days.',
    },
    {
      q: 'Does this guide say which reading is normal?',
      a: 'No. It compares catalog references. It does not diagnose and it does not say which reading is normal.',
    },
  ],
  links: [
    {
      href: '/en/digital-blood-pressure-monitors/',
      label: 'See digital blood pressure monitors with a price',
    },
  ],
};

const CENTRAL_EN: ConocimientoSnippet = {
  title: 'Bedside monitors vs central station | I-ME',
  h1: 'Bedside monitors or a central monitoring station',
  description:
    'Compare independent bedside monitors with a multi-bed central station. Confirm the layout, training and quote with I-ME. No clinical claims.',
  links: [
    { href: '/en/families/monitores/', label: 'Patient monitor family' },
    { href: '/en/biolight-icu-monitors/', label: 'Biolight ICU monitors' },
  ],
};

const SNIPPETS: Record<string, Partial<Record<Locale, ConocimientoSnippet>>> = {
  'registro-sanitario-invima-equipos-biomedicos': { es: REGISTRO_ES, en: REGISTRO_EN },
  'como-elegir-tensiometro-digital': { es: TENSIOMETRO_ES, en: TENSIOMETRO_EN },
  'central-monitoreo-multicama-o-monitores-independientes': { en: CENTRAL_EN },
};

export function snippetConocimiento(slug: string, locale: Locale): ConocimientoSnippet | undefined {
  return SNIPPETS[slug]?.[locale];
}
