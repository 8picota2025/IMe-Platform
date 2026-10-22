/**
 * Índice corto para el panel de revisión del admin.
 * El copy completo vive en `comercial-landings.ts` y no debe entrar al JS
 * del cliente: el audit de performance suma cada archivo `.js` de dist/.
 * El test de este módulo exige que id, ruta, h1 y slugs sigan a las campañas ES.
 */
import type { StandardCampaignLandingId } from './comercial-landings';

export interface CampaignLandingRevision {
  id: StandardCampaignLandingId;
  path: string;
  h1: string;
  productSlugs: readonly string[];
}

const REVISION_ES: readonly CampaignLandingRevision[] = [
  {
    id: 'torres_laparoscopia',
    path: '/es/torres-laparoscopia/',
    h1: 'Su quirófano merece una torre que el equipo quiera usar',
    productSlugs: [],
  },
  {
    id: 'esterilizacion',
    path: '/es/esterilizacion/',
    h1: 'Equipos de esterilización y autoclaves hospitalarios en Colombia',
    productSlugs: ['autoclave-horizontal-ref-5075-tuttnauer', 'autoclave-ref-t-max-6-tuttnauer'],
  },
  {
    id: 'imagenologia',
    path: '/es/imagenologia/',
    h1: 'Equipos de imagenología: rayos X digital, arco en C, mamografía y ecografía en Colombia',
    productSlugs: [
      'mamografo-digital-dm166-series-ref-dm166-angell',
      'arco-en-c-alc-280-series-ref-alc-280-angell',
      'mamografo-digital-dm156-series-angell-technology-ref-dm156-angell',
      'sistema-de-rayos-x-dr-montado-en-techo-ref-dr-ceiling-angell',
      'sistema-de-rayos-x-dr-movil-ref-dr-mobile-angell',
      'dr-dinamico-de-brazo-ref-dr-uc-arm-angell',
      'sistema-de-ultrasonido-ref-dus-5000-advanced',
    ],
  },
  {
    id: 'robotica_rehabilitacion',
    path: '/es/robotica-rehabilitacion/',
    h1: 'Robótica que alivia operación — no ciencia ficción en el lobby',
    productSlugs: [
      'padbot-x3-robot-recepcion-ref-padbot-x3-padbot',
      'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot',
      'padbot-w2-robot-delivery-institucional-ref-padbot-w2-padbot',
      'c3-robot-limpieza-autonoma-ref-c3-cleaning-robot',
    ],
  },
  {
    id: 'caminadores_adultos',
    path: '/es/caminadores-para-adultos/',
    h1: 'Caminadores para adultos que sí se usan — no solo se cotizan',
    productSlugs: [
      'caminador-desarmable-en-aluminio-ref-kp1-8160l-konfort-plus',
      'caminador-stand-up-doble-funcion-ref-kp1-816l-19-konfort-plus',
      'caminador-con-ruedas-de-5-en-aluminio-color-gris-ref-kp153-al-19-konfort-plus',
      'caminador-con-ruedas-rollator-en-aluminio-con-reposapies-ref-kp285-al-19',
      'rollator-en-aluminio-ref-kp271-al-2-konfort-plus',
      'caminador-doble-funcion-con-ruedas-ref-kp1-8130g-5',
    ],
  },
  {
    id: 'sillas_ruedas',
    path: '/es/sillas-de-ruedas/',
    h1: 'Sillas de ruedas para institución — Konfort Plus y tipologías claras',
    productSlugs: [
      'silla-de-ruedas-estandar-en-acero-reclinable-ref-kbe-9953-konfort-plus',
      'silla-de-ruedas-de-transporte-basica-en-acero-ref-kbe-9125t-konfort-plus',
      'silla-de-ruedas-estandar-y-de-transporte-en-aluminio-ref-kbe-9630l-konfort-plus',
      'silla-de-ruedas-estandar-desarmable-en-acero-con-tapiceria-acolchada-ref-kbe-9113-konfort-plus',
      'silla-de-ruedas-estandar-en-acero-bariatrica-de-56-5-cm-ref-kbe-9953-iii-konfort-plus',
      'silla-de-ruedas-estandar-en-acero-con-rin-estrella-22-de-45-7-cm-de-ancho-ref-kbe-622',
    ],
  },
  {
    id: 'monitores_biolight',
    path: '/es/monitores-biolight-uci/',
    h1: 'Monitores Biolight para UCI — P15 modular y S12 con criterio institucional',
    productSlugs: [
      'monitor-de-paciente-ref-s12-biolight',
      'monitor-de-paciente-ref-m12-biolight',
      'monitor-modular-de-paciente-ref-pm-200m-advanced',
    ],
  },
  {
    id: 'alto_flujo_fisher_paykel',
    path: '/es/alto-flujo-fisher-paykel/',
    h1: 'Alto flujo Fisher Paykel',
    productSlugs: [],
  },
  {
    id: 'camillas_medicas',
    path: '/es/camillas-medicas/',
    h1: 'Camillas médicas que encajan en su recorrido — no solo en el brochure',
    productSlugs: [
      'camilla-de-traslado-ref-skb041-6-saikang',
      'camilla-de-traslado-ref-skb041-1-saikang',
      'camilla-plegable-ref-skb1a04-saikang',
      'camilla-cuchara-ref-skb2b01-saikang',
      'camilla-manual-ref-st-100-advanced',
    ],
  },
  {
    id: 'ventiladores_mecanicos',
    path: '/es/ventiladores-mecanicos-uci/',
    h1: 'Ventilador mecánico para UCI',
    productSlugs: ['ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide'],
  },
  {
    id: 'desfibriladores_hospital',
    path: '/es/desfibriladores-hospitalarios/',
    h1: 'Desfibriladores hospitalarios — bifásico con monitor y criterio de reanimación',
    productSlugs: ['desfibrilador-bifasico-con-monitor'],
  },
  {
    id: 'dotacion_monitoreo_uci',
    path: '/es/dotacion-monitoreo-uci/',
    h1: 'Dotar el monitoreo de una UCI, de la primera cama al acta de entrega',
    productSlugs: [
      'monitor-multiparametrico-uci-avanzado',
      'monitor-multiparametrico-basico',
      'monitor-de-paciente-ref-m12-biolight',
      'monitor-central-uci-multicama',
    ],
  },
];

export function listCampaignLandingRevision(): readonly CampaignLandingRevision[] {
  return REVISION_ES;
}
