/**
 * Copy SEO único por familia (top categorías audit).
 * Sin inventar specs de producto — orientación de compra institucional.
 */
import type { Locale } from '../i18n/utils';

export interface FamiliaSeoContent {
  slug: string;
  name_es: string;
  name_en: string;
  title_es: string;
  title_en: string;
  description_es: string;
  description_en: string;
  intro_es: string;
  intro_en: string;
  body_es: string[];
  body_en: string[];
  faq: Array<{ q_es: string; a_es: string; q_en: string; a_en: string }>;
  relatedSlugs: string[];
}

export const FAMILIA_SEO: FamiliaSeoContent[] = [
  {
    slug: 'radiologia',
    name_es: 'Imagenología y radiología',
    name_en: 'Medical imaging and radiology',
    title_es: 'Equipos de imagenología y radiología hospitalaria | I-ME',
    title_en: 'Hospital medical imaging and radiology equipment | I-ME',
    description_es:
      'Equipos de radiología e imagenología para instituciones de salud en Colombia: rayos X, detectores, mamografía y fluoroscopia.',
    description_en:
      'Radiology and medical imaging equipment for healthcare institutions in Colombia: X-ray, detectors, mammography and fluoroscopy.',
    intro_es:
      'Un proyecto de imagenología se define por flujo de pacientes, espacio disponible e integración con la operación radiológica; no por una ficha aislada.',
    intro_en:
      'An imaging project follows patient flow, available space and radiology operations—not a single product sheet.',
    body_es: [
      'I-ME acompaña la selección de tipología — sistemas DR de techo, piso o móvil, detectores planos, mamografía y arco en C — según el servicio y el flujo previsto.',
      'Antes de cotizar se revisan condiciones de sala, requerimientos de instalación, integración y documentación aplicable para cada referencia. La validación regulatoria se confirma por equipo.',
      'Para renovaciones o aperturas de servicio, se puede estructurar una lista de equipos alrededor de prioridades operativas y del alcance definido por la institución.',
    ],
    body_en: [
      'I-ME supports modality selection—ceiling, floor and mobile DR systems, flat-panel detectors, mammography and C-arms—by service and expected workflow.',
      'Before quoting, we review room conditions, installation requirements, integration and applicable documentation for each SKU. Regulatory validation is confirmed per device.',
      'For renewals or new services, equipment lists can be structured around operational priorities and the institution-defined scope.',
    ],
    faq: [
      {
        q_es: '¿Sistema DR móvil, de piso o de techo?',
        a_es: 'Cada tipología responde a un flujo y una infraestructura distintos. Revisamos volumen, movilidad requerida y condiciones de la sala antes de proponer referencias.',
        q_en: 'Mobile, floor-mounted or ceiling-mounted DR?',
        a_en: 'Each modality fits a different workflow and infrastructure. We review volume, mobility needs and room conditions before proposing SKUs.',
      },
      {
        q_es: '¿La documentación regulatoria está disponible?',
        a_es: 'La documentación aplicable se valida para la referencia cotizada; no se generaliza entre equipos.',
        q_en: 'Is regulatory documentation available?',
        a_en: 'Applicable documentation is validated for the quoted SKU; it is not generalized across devices.',
      },
    ],
    relatedSlugs: [
      'mamografo-digital-dm166-series',
      'detector-plano-inalambrico-tcq-iii',
      'sistema-de-rayos-x-dr-montado-en-techo',
      'sistema-radiografico-3d-wr-3d-angell-technology',
    ],
  },
  {
    slug: 'monitores',
    name_es: 'Monitores de signos vitales',
    name_en: 'Patient monitors',
    title_es: 'Monitores multiparamétricos UCI y hospital | I-ME',
    title_en: 'ICU multiparameter patient monitors | I-ME',
    description_es:
      'Monitores de paciente y centrales UCI para hospitales en Colombia. Orientación I-ME: parámetros, conectividad y soporte — con equipos certificados.',
    description_en:
      'Patient monitors and ICU centrals for hospitals in Colombia. I-ME guidance on parameters, connectivity and support — certified equipment.',
    intro_es:
      'Elegir un monitor no es solo “pantalla grande”. En UCI, urgencias o transporte el criterio cambia: parámetros base, modularidad, alarma usable y cómo se integra a la estación central.',
    intro_en:
      'Choosing a monitor is not just “a bigger screen”. ICU, ER or transport change the brief: core parameters, modularity, usable alarms and how it joins a central station.',
    body_es: [
      'En Colombia, las instituciones suelen pedir monitores multiparamétricos con ECG, SpO₂ y NIBP como mínimo, y opciones de capnografía o presión invasiva según el servicio. I-ME ayuda a mapear el uso previsto antes de cotizar referencias.',
      'También importa el flujo operativo: ¿quién responde alarmas?, ¿hay central multicama?, ¿se necesita transporte inter-área sin perder trazo? Esas preguntas evitan comprar potencia que no se usa o quedar cortos en criticidad.',
      'Trabajamos con catálogo activo, soporte técnico y acompañamiento comercial para hospitales y clínicas en los 32 departamentos — sede en Envigado, cobertura nacional.',
    ],
    body_en: [
      'Colombian hospitals often need multiparameter monitors with ECG, SpO₂ and NIBP as a baseline, plus capnography or invasive pressure by service. I-ME maps intended use before quoting SKUs.',
      'Operations matter too: who owns alarms, whether a multi-bed central exists, and whether transport must keep the trace. That prevents overbuying or under-specifying critical care.',
      'We combine an active catalog, technical support and commercial guidance for hospitals nationwide — HQ in Envigado, national coverage.',
    ],
    faq: [
      {
        q_es: '¿Qué diferencia un monitor básico de uno de UCI?',
        a_es: 'La criticidad del servicio: parámetros expandibles, alarmas, autonomía y capacidad de central. Lo básico cubre observación; UCI suele exigir más modularidad y continuidad.',
        q_en: 'What separates a basic monitor from an ICU monitor?',
        a_en: 'Service criticality: expandable parameters, alarms, autonomy and central-station readiness. Basic units fit observation; ICU usually needs modularity and continuity.',
      },
      {
        q_es: '¿I-ME instala y capacita?',
        a_es: 'Sí, el alcance de instalación y capacitación se acuerda en la cotización según sede y cantidad de puntos.',
        q_en: 'Does I-ME install and train?',
        a_en: 'Yes — installation and training scope are agreed in the quote by site and number of points.',
      },
    ],
    relatedSlugs: [
      'monitor-multiparametrico-uci-avanzado',
      'monitor-multiparametrico-basico',
      'monitor-central-uci-multicama',
      'monitor-de-paciente-m12-biolight',
    ],
  },
  {
    slug: 'cardiologia',
    name_es: 'Cardiología',
    name_en: 'Cardiology',
    title_es: 'Equipos de cardiología hospitalaria | ECG y más | I-ME',
    title_en: 'Hospital cardiology equipment | ECG and more | I-ME',
    description_es:
      'Cardiología para hospitales y clínicas en Colombia: electrocardiógrafos y flujo diagnóstico. Asesoría I-ME sin inventar indicaciones clínicas.',
    description_en:
      'Cardiology for hospitals and clinics in Colombia: electrocardiographs and diagnostic flow. I-ME advisory without inventing clinical claims.',
    intro_es:
      'En cardiología ambulatoria y hospitalaria el cuello de botella suele ser el flujo: derivaciones, portabilidad, informe y quién interpreta — no solo el “ECG más barato”.',
    intro_en:
      'In outpatient and hospital cardiology the bottleneck is usually workflow: leads, portability, reporting and who interprets — not only the cheapest ECG.',
    body_es: [
      'Las instituciones preguntan por 3, 6 o 12 derivaciones, impresión/archivo digital y facilidad de uso en consulta o urgencias. I-ME orienta según volumen de pacientes y perfil del servicio.',
      'Cuando el proyecto incluye desfibrilación o monitoreo continuo, se separa tipología (diagnóstico vs reanimación) para no mezclar compras.',
      'Cotizamos con soporte y opciones de financiamiento institucional cuando aplica.',
    ],
    body_en: [
      'Sites ask about 3/6/12 leads, print or digital archive, and ease of use in clinic or ER. I-ME orients by patient volume and service profile.',
      'When defibrillation or continuous monitoring is in scope, we separate diagnostic vs resuscitation typologies so purchases stay coherent.',
      'Quotes include support and institutional financing options when applicable.',
    ],
    faq: [
      {
        q_es: '¿ECG de 12 derivaciones para consulta externa?',
        a_es: 'Es el estándar más pedido en diagnóstico. Confirmamos software, impresión y flujo de historia clínica en la visita técnica.',
        q_en: 'Is a 12-lead ECG right for outpatient clinic?',
        a_en: 'It is the most requested diagnostic baseline. We confirm software, printing and EMR workflow in the technical visit.',
      },
    ],
    relatedSlugs: [
      'electrocardiografo-12-derivaciones-digital',
      'electrocardiografo-ecg-3-plus',
      'desfibrilador-bifasico-con-monitor',
    ],
  },
  {
    slug: 'cardiologia-reanimacion',
    name_es: 'Cardiología y reanimación',
    name_en: 'Cardiology and resuscitation',
    title_es: 'Desfibriladores y reanimación hospitalaria | I-ME',
    title_en: 'Hospital defibrillators and resuscitation | I-ME',
    description_es:
      'Desfibriladores bifásicos con monitor para hospitales en Colombia. Orientación I-ME en tipología, ubicación y soporte postventa.',
    description_en:
      'Biphasic defibrillators with monitor for hospitals in Colombia. I-ME guidance on typology, placement and after-sales support.',
    intro_es:
      'Un desfibrilador no se elige por brochure: se define por protocolo de código, quién lo opera y dónde vive el equipo (urgencias, UCI, quirófano, ambulancia).',
    intro_en:
      'A defibrillator is not chosen from a brochure: it follows code protocol, who operates it and where it lives (ER, ICU, OR, ambulance).',
    body_es: [
      'Pedimos aclarar uso previsto (DEA vs manual/monitor), capacitación y plan de mantenimiento. Documentación regulatoria se valida por referencia — sin inventar registros.',
      'I-ME cubre cotización, puesta en marcha acordada y soporte para instituciones en todo el país.',
    ],
    body_en: [
      'We clarify intended use (AED vs manual/monitor), training and maintenance plan. Regulatory docs are validated per SKU — never invented.',
      'I-ME covers quoting, agreed commissioning and support for institutions nationwide.',
    ],
    faq: [
      {
        q_es: '¿Necesito desfibrilador con monitor?',
        a_es: 'Depende del servicio: urgencias y UCI suelen requerir monitoreo; otros puntos pueden priorizar DEA. Lo definimos con biomédica y jefatura clínica.',
        q_en: 'Do I need a defibrillator with monitor?',
        a_en: 'It depends on the service: ER/ICU often need monitoring; other points may prioritize AED. We define it with biomed and clinical leads.',
      },
    ],
    relatedSlugs: ['desfibrilador-bifasico-con-monitor'],
  },
  {
    slug: 'sala-cirugia',
    name_es: 'Sala de cirugía',
    name_en: 'Operating room',
    title_es: 'Equipos de sala de cirugía hospitalaria | I-ME',
    title_en: 'Hospital operating room equipment | I-ME',
    description_es:
      'Mesas quirúrgicas, iluminación y flujo de quirófano para hospitales en Colombia. Asesoría I-ME orientada a carga quirúrgica real.',
    description_en:
      'Surgical tables, lighting and OR flow for hospitals in Colombia. I-ME advisory driven by real surgical load.',
    intro_es:
      'Quirófano se dimensiona por especialidades, tiempos de cambio y ergonomía — no por “paquete completo” genérico.',
    intro_en:
      'OR sizing follows specialties, turnover time and ergonomics — not a generic “full package”.',
    body_es: [
      'Mesas eléctricas/hidráulicas, radiolúcidas u ortopédicas responden a preguntas distintas. I-ME separa tipologías antes de cotizar referencias.',
      'También alineamos lámparas, aspiración y mobiliario perioperatorio cuando el proyecto es de sala completa.',
    ],
    body_en: [
      'Electric/hydraulic, radiolucent or orthopedic tables answer different questions. I-ME separates typologies before quoting SKUs.',
      'We also align lights, suction and perioperative furniture when the project is a full room.',
    ],
    faq: [
      {
        q_es: '¿Mesa ortopédica o multipropósito?',
        a_es: 'Depende del mix quirúrgico. Si hay traumatología frecuente, la radiolúcida/ortopédica suele priorizarse; si no, multipropósito puede bastar.',
        q_en: 'Orthopedic or multipurpose table?',
        a_en: 'It depends on case mix. Frequent trauma often prioritizes radiolucent/orthopedic; otherwise multipurpose may suffice.',
      },
    ],
    relatedSlugs: [
      'mesa-quirurgica-electrica-ref-a100-4-saikang',
      'mesa-quirurgica-motorizada-multiposicion',
    ],
  },
  {
    slug: 'neonatologia',
    name_es: 'Neonatología',
    name_en: 'Neonatology',
    title_es: 'Equipos de neonatología hospitalaria | I-ME',
    title_en: 'Hospital neonatology equipment | I-ME',
    description_es:
      'Incubadoras, servocunas y soporte neonatal para hospitales en Colombia. Orientación I-ME según nivel de cuidado.',
    description_en:
      'Incubators, warmers and neonatal support for hospitals in Colombia. I-ME guidance by care level.',
    intro_es:
      'Neonatología exige tipología clara: incubadora cerrada, abierta/servocuna, fototerapia o CPAP — según nivel y protocolo institucional.',
    intro_en:
      'Neonatology needs clear typology: closed incubator, open warmer, phototherapy or CPAP — by care level and protocol.',
    body_es: [
      'Ayudamos a biomédica y pediatría a traducir el nivel de cuidado en una lista corta de tipologías, evitando mezclar consumibles con equipos capitales sin plan de soporte.',
    ],
    body_en: [
      'We help biomed and pediatrics translate care level into a short typology list, avoiding mixing consumables with capital equipment without a support plan.',
    ],
    faq: [
      {
        q_es: '¿Incubadora abierta o cerrada?',
        a_es: 'Depende del nivel neonatal y del procedimiento. Lo definimos con el servicio clínico; no hay una sola respuesta “correcta” de catálogo.',
        q_en: 'Open or closed incubator?',
        a_en: 'It depends on neonatal level and procedures. We define it with the clinical service; there is no single catalog “right answer”.',
      },
    ],
    relatedSlugs: ['incubadora-abierta-o-servocuna-ref-bt550-bistos'],
  },
  {
    slug: 'ultrasonido',
    name_es: 'Ultrasonido',
    name_en: 'Ultrasound',
    title_es: 'Ecógrafos y ultrasonido hospitalario | I-ME',
    title_en: 'Hospital ultrasound systems | I-ME',
    description_es:
      'Ecógrafos portátiles y Doppler para hospitales en Colombia. Asesoría I-ME por especialidad y flujo point-of-care.',
    description_en:
      'Portable and Doppler ultrasound for hospitals in Colombia. I-ME advisory by specialty and point-of-care flow.',
    intro_es:
      'Ultrasonido se decide por sonda, especialidad (vascular, OB, urgencias) y si el informe debe salir en DICOM/PACS.',
    intro_en:
      'Ultrasound is decided by probe, specialty (vascular, OB, ER) and whether reports must leave via DICOM/PACS.',
    body_es: [
      'Separar “ecógrafo de consulta” vs “point-of-care” evita comprar conectividad que no se usa o quedar cortos en archivo clínico.',
    ],
    body_en: [
      'Separating clinic ultrasound vs point-of-care avoids buying unused connectivity or under-specifying clinical archive.',
    ],
    faq: [
      {
        q_es: '¿Necesito DICOM sí o sí?',
        a_es: 'Si el hospital exige PACS/HIS, sí. En consulta pequeña puede bastar archivo local; lo confirmamos con sistemas.',
        q_en: 'Is DICOM mandatory?',
        a_en: 'If the hospital requires PACS/HIS, yes. A small clinic may store locally; we confirm with IT.',
      },
    ],
    relatedSlugs: [
      'ecografo-color-doppler-diagnostico-vascular',
      'ecografo-portatil-con-wifi-y-dicom',
    ],
  },
  {
    slug: 'soluciones-iv',
    name_es: 'Soluciones IV',
    name_en: 'IV solutions',
    title_es: 'Bombas de infusión hospitalarias | I-ME',
    title_en: 'Hospital infusion pumps | I-ME',
    description_es:
      'Bombas de infusión y jeringa para UCI y hospitalización en Colombia. Orientación I-ME en seguridad de terapia IV.',
    description_en:
      'Infusion and syringe pumps for ICU and wards in Colombia. I-ME guidance on IV therapy safety.',
    intro_es:
      'La terapia IV se dimensiona por camas, protocolos de biblioteca de fármacos y quién programa la bomba en turno.',
    intro_en:
      'IV therapy is sized by beds, drug-library protocols and who programs the pump each shift.',
    body_es: [
      'Volumétricas vs jeringa no son intercambiables. I-ME ayuda a mezclar parque según UCI, pediatría y hospitalización general.',
    ],
    body_en: [
      'Volumetric vs syringe pumps are not interchangeable. I-ME helps mix the fleet for ICU, pediatrics and general wards.',
    ],
    faq: [
      {
        q_es: '¿Cuántas bombas por cama UCI?',
        a_es: 'Varía por protocolo. Partimos del mapa de terapias concurrentes del servicio, no de un ratio genérico de internet.',
        q_en: 'How many pumps per ICU bed?',
        a_en: 'It varies by protocol. We start from concurrent therapies in the service — not a generic internet ratio.',
      },
    ],
    relatedSlugs: [
      'bomba-de-infusion-ip-200',
      'bomba-de-infusion-ref-sk-em211-saikang',
      'bomba-de-jeringa-precision-microdosis',
    ],
  },
  {
    slug: 'anestesia',
    name_es: 'Anestesia',
    name_en: 'Anesthesia',
    title_es: 'Máquinas de anestesia hospitalaria | I-ME',
    title_en: 'Hospital anesthesia machines | I-ME',
    description_es:
      'Anestesia y ventilación de quirófano para hospitales en Colombia. Asesoría I-ME según carga quirúrgica.',
    description_en:
      'OR anesthesia and ventilation for hospitals in Colombia. I-ME advisory by surgical load.',
    intro_es:
      'Una máquina de anestesia se elige por quirófanos activos, tipo de cirugía y soporte de gases — no solo por pantalla.',
    intro_en:
      'An anesthesia machine follows active ORs, surgery mix and gas utilities — not only the display.',
    body_es: [
      'Cuando el proyecto incluye ventilación crítica aparte, separamos tipologías (quirófano vs UCI) para no subespecificar.',
    ],
    body_en: [
      'When critical ventilation is separate, we split OR vs ICU typologies to avoid under-specifying.',
    ],
    faq: [
      {
        q_es: '¿Anestesia con ventilador integrado?',
        a_es: 'Es lo habitual en quirófano moderno. Validamos utilidades (O₂, aire, vacío) con ingeniería biomédica del sitio.',
        q_en: 'Anesthesia with integrated ventilator?',
        a_en: 'Common in modern ORs. We validate utilities (O₂, air, vacuum) with on-site biomed engineering.',
      },
    ],
    relatedSlugs: ['maquina-de-anestesia-con-ventilador', 'maquina-de-anestesia-am-6000-plus'],
  },
  {
    slug: 'ventiladores',
    name_es: 'Ventiladores',
    name_en: 'Ventilators',
    title_es: 'Ventiladores mecánicos hospitalarios | I-ME',
    title_en: 'Hospital mechanical ventilators | I-ME',
    description_es:
      'Ventilación mecánica para UCI adulto/pediátrica en Colombia. Orientación I-ME por tipología y soporte.',
    description_en:
      'Mechanical ventilation for adult/pediatric ICU in Colombia. I-ME guidance by typology and support.',
    intro_es:
      'Ventilador UCI no es el mismo brief que quirófano o transporte. Definimos tipología con el servicio de cuidados intensivos.',
    intro_en:
      'ICU ventilators are not the same brief as OR or transport. We define typology with the critical-care service.',
    body_es: [
      'Adulto/pediátrico, modos y monitoreo asociados se cotizan tras aclarar población y protocolos — sin promesas clínicas inventadas.',
    ],
    body_en: [
      'Adult/pediatric scope, modes and related monitoring are quoted after clarifying population and protocols — no invented clinical claims.',
    ],
    faq: [
      {
        q_es: '¿Un ventilador sirve para adulto y pediátrico?',
        a_es: 'Algunas referencias sí; otras no. Lo confirmamos por ficha técnica real del equipo cotizado.',
        q_en: 'Can one ventilator cover adult and pediatric?',
        a_en: 'Some SKUs can; others cannot. We confirm from the real datasheet of the quoted unit.',
      },
    ],
    relatedSlugs: ['ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide'],
  },
  {
    slug: 'terapia-de-infusion',
    name_es: 'Terapia de infusión',
    name_en: 'Infusion therapy',
    title_es: 'Terapia de infusión hospitalaria | I-ME',
    title_en: 'Hospital infusion therapy | I-ME',
    description_es:
      'Parque de bombas de infusión para hospitales en Colombia. I-ME orienta tipología volumétrica y de jeringa.',
    description_en:
      'Infusion pump fleets for hospitals in Colombia. I-ME orients volumetric and syringe typologies.',
    intro_es:
      'Terapia de infusión es un sistema: bombas, consumibles compatibles y protocolo de enfermería.',
    intro_en: 'Infusion therapy is a system: pumps, compatible sets and nursing protocol.',
    body_es: [
      'Revisamos estandarización de parque para reducir errores de programación y facilitar mantenimiento.',
    ],
    body_en: ['We review fleet standardization to reduce programming errors and ease maintenance.'],
    faq: [
      {
        q_es: '¿Puedo mezclar marcas de bombas?',
        a_es: 'Sí, pero complica capacitación y repuestos. Preferimos un plan de estandarización por servicio.',
        q_en: 'Can I mix pump brands?',
        a_en: 'Yes, but training and spare parts get harder. We prefer a standardization plan by service.',
      },
    ],
    relatedSlugs: [
      'bomba-de-infusion-ref-sk-em211-saikang',
      'bomba-de-infusion-ref-sk-em215-saikang',
    ],
  },
];

export function listFamiliaSeoSlugs(): string[] {
  return FAMILIA_SEO.map(f => f.slug);
}

export function getFamiliaSeo(slug: string): FamiliaSeoContent | undefined {
  return FAMILIA_SEO.find(f => f.slug === slug);
}

export function familiaDisplayName(content: FamiliaSeoContent, locale: Locale): string {
  return locale === 'en' ? content.name_en : content.name_es;
}
