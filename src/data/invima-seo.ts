import type { Locale } from '../i18n/utils';

/** Search snippets for the manufacturer guides; their URLs remain unchanged. */
const descriptions: Record<string, Record<Locale, string>> = {
  'registro-sanitario-invima-equipos-biomedicos': {
    es: 'Registro INVIMA para fabricantes de dispositivos médicos: requisitos, costes y tiempos para entrar a Colombia. Pida acompañamiento a I-ME.',
    en: 'INVIMA registration for medical device manufacturers: requirements, costs and timelines for entering Colombia. Request support from I-ME.',
  },
  'checklist-invima-compra-equipos-medicos': {
    es: 'Checklist INVIMA para fabricantes y compradores: documentos, presupuesto, calendario y verificación de equipos médicos en Colombia. Consulte a I-ME.',
    en: 'INVIMA checklist for manufacturers and buyers: documents, budget, timelines and medical equipment checks in Colombia. Speak with I-ME.',
  },
};

export function descripcionInvima(slug: string, locale: Locale): string | undefined {
  return descriptions[slug]?.[locale];
}
