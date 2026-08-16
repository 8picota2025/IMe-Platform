/**
 * Landings por ciudad — cobertura nacional I-ME.
 * HQ NAP: Envigado. No inventar oficinas locales.
 */
import type { Locale } from '../i18n/utils';

export interface CityLanding {
  slug: string;
  name_es: string;
  name_en: string;
  region_es: string;
  region_en: string;
  title_es: string;
  title_en: string;
  description_es: string;
  description_en: string;
  h1_es: string;
  h1_en: string;
  lead_es: string;
  lead_en: string;
  body_es: string[];
  body_en: string[];
  focusFamilias: string[];
}

export const CITY_LANDINGS: CityLanding[] = [
  {
    slug: 'bogota',
    name_es: 'Bogotá',
    name_en: 'Bogotá',
    region_es: 'Cundinamarca',
    region_en: 'Cundinamarca',
    title_es: 'Equipos biomédicos en Bogotá | Venta y soporte I-ME',
    title_en: 'Biomedical equipment in Bogotá | Sales and support I-ME',
    description_es:
      'Equipos biomédicos para hospitales y clínicas en Bogotá. Cotización, soporte técnico y financiamiento con I-ME — cobertura nacional desde Envigado.',
    description_en:
      'Biomedical equipment for hospitals and clinics in Bogotá. Quotes, technical support and financing with I-ME — national coverage from Envigado.',
    h1_es: 'Equipos biomédicos para instituciones en Bogotá',
    h1_en: 'Biomedical equipment for institutions in Bogotá',
    lead_es:
      'I-ME acompaña a hospitales, clínicas y centros de salud en Bogotá con catálogo certificado, asesoría de tipología y soporte. Sede operativa en Envigado (Antioquia); atención comercial y técnica a nivel nacional.',
    lead_en:
      'I-ME supports hospitals, clinics and care centers in Bogotá with a certified catalog, typology advisory and support. Operating HQ in Envigado (Antioquia); commercial and technical reach nationwide.',
    body_es: [
      'En Bogotá el volumen de proyectos suele concentrarse en UCI, quirófano, imagen y terapia IV. Ayudamos a priorizar tipologías antes de pedir referencias para no mezclar compras.',
      'La cotización incluye condiciones comerciales, alcance de instalación cuando aplica y canal de soporte. No operamos una sucursal pública inventada en Bogotá: coordinamos visitas y logística desde la red I-ME.',
      'También orientamos financiamiento institucional cuando el proyecto lo requiere — simulador indicativo en el sitio; tasas finales en cotización formal.',
    ],
    body_en: [
      'In Bogotá projects often cluster around ICU, OR, imaging and IV therapy. We prioritize typologies before SKUs so purchases stay coherent.',
      'Quotes include commercial terms, installation scope when applicable and a support channel. We do not invent a public Bogotá branch — visits and logistics are coordinated through the I-ME network.',
      'We also guide institutional financing when needed — on-site simulator is indicative; final rates appear in the formal quote.',
    ],
    focusFamilias: ['monitores', 'sala-cirugia', 'soluciones-iv', 'ultrasonido'],
  },
  {
    slug: 'medellin',
    name_es: 'Medellín',
    name_en: 'Medellín',
    region_es: 'Antioquia',
    region_en: 'Antioquia',
    title_es: 'Equipos biomédicos en Medellín y Antioquia | I-ME',
    title_en: 'Biomedical equipment in Medellín and Antioquia | I-ME',
    description_es:
      'Equipos biomédicos para Medellín y Antioquia. I-ME en Envigado: catálogo, soporte técnico y financiamiento para hospitales y clínicas.',
    description_en:
      'Biomedical equipment for Medellín and Antioquia. I-ME in Envigado: catalog, technical support and financing for hospitals and clinics.',
    h1_es: 'Equipos biomédicos en Medellín y el Valle de Aburrá',
    h1_en: 'Biomedical equipment in Medellín and the Aburrá Valley',
    lead_es:
      'Con sede en Envigado, I-ME atiende instituciones del Valle de Aburrá y Antioquia con cercanía operativa: catálogo biomédico, instalación acordada y soporte técnico.',
    lead_en:
      'Based in Envigado, I-ME serves Aburrá Valley and Antioquia institutions with operational proximity: biomedical catalog, agreed installation and technical support.',
    body_es: [
      'Para Medellín priorizamos tiempos de respuesta en soporte y claridad de tipología (monitores, anestesia, neonatología, esterilización).',
      'Puede visitarnos o coordinar asesoría remota; el NAP oficial es CL 28 SUR 29 83, Envigado, Antioquia — +57 310 333 2607 — info@i-me.com.co.',
    ],
    body_en: [
      'For Medellín we prioritize support response and clear typology (monitors, anesthesia, neonatology, sterilization).',
      'Visit or book remote advisory; official NAP is CL 28 SUR 29 83, Envigado, Antioquia — +57 310 333 2607 — info@i-me.com.co.',
    ],
    focusFamilias: ['monitores', 'anestesia', 'neonatologia', 'sala-cirugia'],
  },
  {
    slug: 'cali',
    name_es: 'Cali',
    name_en: 'Cali',
    region_es: 'Valle del Cauca',
    region_en: 'Valle del Cauca',
    title_es: 'Equipos biomédicos en Cali | Venta y soporte I-ME',
    title_en: 'Biomedical equipment in Cali | Sales and support I-ME',
    description_es:
      'Equipos biomédicos para hospitales y clínicas en Cali y el Valle. Cotización y soporte I-ME con cobertura nacional.',
    description_en:
      'Biomedical equipment for hospitals and clinics in Cali and Valle. I-ME quotes and support with national coverage.',
    h1_es: 'Equipos biomédicos para instituciones en Cali',
    h1_en: 'Biomedical equipment for institutions in Cali',
    lead_es:
      'I-ME acompaña proyectos biomédicos en Cali: desde monitores y cardiología hasta quirófano y terapia IV. Operación nacional con sede en Envigado.',
    lead_en:
      'I-ME supports biomedical projects in Cali: from monitors and cardiology to OR and IV therapy. National operations with HQ in Envigado.',
    body_es: [
      'Definimos tipología con biomédica y compras antes de cotizar referencias. Así se reduce reproceso y se alinea soporte postventa.',
      'No publicamos una dirección inventada en Cali: la logística y visitas se coordinan según el proyecto desde la red I-ME.',
    ],
    body_en: [
      'We define typology with biomed and procurement before quoting SKUs. That cuts rework and aligns after-sales support.',
      'We do not publish an invented Cali address: logistics and visits are coordinated per project through the I-ME network.',
    ],
    focusFamilias: ['monitores', 'cardiologia', 'sala-cirugia', 'soluciones-iv'],
  },
];

export function listCitySlugs(): string[] {
  return CITY_LANDINGS.map(c => c.slug);
}

export function getCityLanding(slug: string): CityLanding | undefined {
  return CITY_LANDINGS.find(c => c.slug === slug);
}

export function cityName(city: CityLanding, locale: Locale): string {
  return locale === 'en' ? city.name_en : city.name_es;
}
