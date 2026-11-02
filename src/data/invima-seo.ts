import type { Locale } from '../i18n/utils';

/** Search snippets for the manufacturer guides; their URLs remain unchanged. */
const descriptions: Record<string, Record<Locale, string>> = {
  'registro-sanitario-invima-equipos-biomedicos': {
    es: 'Registro INVIMA para fabricantes de dispositivos médicos: requisitos, costes y tiempos para entrar a Colombia. Pida acompañamiento a I-ME.',
    en: 'INVIMA registration for medical device manufacturers: requirements, costs and timelines for entering Colombia. Request support from I-ME.',
  },
  'checklist-invima-compra-equipos-medicos': {
    es: 'Antes de firmar, verifique el registro INVIMA del modelo, titular, importador, garantía y documentos técnicos del equipo. Lista para comprar en Colombia.',
    en: 'Before signing, check the INVIMA registration for the model, holder, importer, warranty and technical documents. A buyer checklist for Colombia.',
  },
};

export function descripcionInvima(slug: string, locale: Locale): string | undefined {
  return descriptions[slug]?.[locale];
}
