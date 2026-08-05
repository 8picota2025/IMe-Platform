/**
 * Landings por fabricante — misma plantilla consultiva B2B.
 * Fuentes: carpeta Fabricantes IME + sitios públicos corporativos/producto.
 * Prohibido: teléfonos, emails, direcciones operativas o WhatsApp del fabricante.
 * Solo logo, perfil corporativo y problemas/ventajas de producto del catálogo I-ME.
 */
import type { CampaignLandingContent } from './comercial-landings';
import type { FabricanteLandingId } from '../lib/comercial-leads';
import type { Locale } from '../i18n/utils';

type FabCopy = Omit<
  CampaignLandingContent,
  'id' | 'familia_slug' | 'tipo_slug' | 'path' | 'pathEn' | 'hubPath' | 'hubLabel'
>;

interface FabMeta {
  id: FabricanteLandingId;
  slug: string;
  slugEn: string;
  familia_slug: string;
  tipo_slug: string;
}

const SHARED_PROCESS_ES = {
  processTitle: 'Cómo trabajamos con usted',
  processSteps: [
    'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
    'Priorizamos por horizonte de compra',
    'Orientamos con modelos publicados en catálogo I-ME',
    'Si encaja: propuesta consultiva con alcance de instalación y soporte',
  ],
  financingNote:
    'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
  evidenceNote:
    'Separamos capacidad documentada del equipo, ficha publicada y lo que depende del sitio. Sin promesas clínicas ni ROI inventado.',
};

const SHARED_PROCESS_EN = {
  processTitle: 'How we work with you',
  processSteps: [
    'Share the clinical-operational context (service, volume, timeline)',
    'We prioritize by purchase horizon',
    'We guide with models published in the I-ME catalog',
    'If it fits: consultative proposal with installation and support scope',
  ],
  financingNote: 'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
  evidenceNote:
    'We separate documented equipment capability, published sheets and site-dependent factors. No clinical promises or invented ROI.',
};

const TUTTNAUER: Record<Locale, FabCopy> = {
  es: {
    tag: 'Esterilización · Tuttnauer',
    title: 'Autoclaves Tuttnauer para central de esterilización | Asesoría I-ME Colombia',
    description:
      '¿Cuello de botella en esterilización? Oriente autoclaves Tuttnauer (línea hospitalaria desde 1925) con asesoría I-ME: flujo de carga, instalación y soporte en Colombia.',
    h1: 'Cuando la central no puede esperar al ciclo siguiente',
    lead: 'Tuttnauer fabrica esterilizadores y equipos de control de infección desde 1925. En I-ME le ayudamos a aterrizar autoclaves del catálogo a su carga real: quirófano, CSSD y turnos que no perdonan demoras.',
    formIntro:
      'Cuéntenos volumen de carga, tipo de instrumental y plazo. Un asesor I-ME responde con contexto de central — no con un PDF genérico.',
    primaryCta: 'Orientar mi proyecto de esterilización',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver esterilización en catálogo',
    heroImage: '/assets/img/hospital-facility.webp',
    heroImageAlt: 'Infraestructura hospitalaria para control de infecciones — I-ME Colombia',
    manufacturer: {
      name: 'Tuttnauer',
      logo: '/assets/img/fabricantes/tuttnauer.webp',
      logoAlt: 'Logo Tuttnauer',
      corpTitle: 'Quién es Tuttnauer (perfil de producto)',
      corpBody:
        'Fabricante especializado en esterilización y control de infecciones: autoclaves de mesa y hospitalarios, esterilizadores de baja temperatura y lavadoras-desinfectadoras. Presencia global en entornos clínicos, odontológicos y de laboratorio. En Colombia, I-ME asesora la selección e implementación de referencias publicadas en catálogo.',
      advantagesTitle: 'Ventajas que suelen buscar jefes de central y biomédicos',
      advantages: [
        'Trayectoria centenaria enfocada en infection control (no “equipo genérico”)',
        'Portafolio que cubre desde mesa/clínica hasta flujo hospitalario',
        'Lenguaje de ciclos, carga y trazabilidad alineado a operación CSSD',
        'Acompañamiento I-ME en puesta en marcha y soporte post-compra en territorio',
      ],
    },
    problemTitle: 'El problema real en centrales colombianas',
    problemBody:
      'No es “comprar un autoclave bonito”. Es liberar instrumental a tiempo, reducir reprocesos, documentar ciclos y no dejar quirófano esperando porque la cámara quedó corta o mal dimensionada.',
    solutionsTitle: 'Cómo Tuttnauer + I-ME atacan ese dolor',
    solutions: [
      {
        pain: 'La cámara satura en pico de quirófano',
        help: 'Dimensionamos referencias Tuttnauer del catálogo (p. ej. T-Max 6 y líneas horizontales) según carga, instrumental y turnos — no según el brochure más grande.',
      },
      {
        pain: 'Temen quedar solos tras la instalación',
        help: 'Acordamos alcance de puesta en marcha, capacitación y canal de soporte I-ME para que la central no dependa de improvisación.',
      },
      {
        pain: 'Auditoría pide trazabilidad y evidencia',
        help: 'Orientamos el alcance documental aplicable del fabricante y lo que la institución debe operar día a día — sin inventar certificaciones.',
      },
    ],
    audienceYes: [
      'CSSD / centrales de esterilización en ampliación o renovación',
      'Clínicas e IPS con quirófano que satura ciclos',
      'Ingeniería biomédica y compras con proyecto de CapEx real',
    ],
    audienceNo: [
      'Pacientes o particulares',
      'Pedidos de repuestos sin institución',
      'Contacto directo al fabricante (I-ME es su canal de asesoría local)',
    ],
    situations: [
      {
        title: 'Apertura de central',
        body: 'Definir capacidad, utilidades y flujo antes de comprar “lo más grande”.',
      },
      {
        title: 'Reemplazo por obsolescencia',
        body: 'Migrar sin frenar quirófano: transición, capacitación y plan B de carga.',
      },
      {
        title: 'Pico quirúrgico',
        body: 'Cuando el cuello de botella es tiempo de ciclo y no “falta de voluntad”.',
      },
    ],
    scopeTitle: 'Qué incluye la conversación con I-ME',
    scope: [
      'Lectura de carga y tipo de instrumental',
      'Alternativas Tuttnauer publicadas en catálogo',
      'Alcance de instalación y capacitación',
      'Propuesta formal cuando el proyecto madura',
    ],
    requirementsTitle: 'Para no perder tiempo',
    requirements: [
      'Institución, ciudad y servicio (CSSD / quirófano)',
      'Horizonte de compra',
      'Volumen o cuello de botella en una frase',
    ],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿Qué autoclaves Tuttnauer están en el catálogo I-ME?',
        a: 'Referencias publicadas como Autoclave T-Max 6 y Autoclave Horizontal 5075, entre otras de la familia de esterilización. Confirmamos disponibilidad en cotización.',
      },
      {
        q: '¿I-ME inventa claims clínicos de Tuttnauer?',
        a: 'No. Trabajamos con ficha publicada, alcance acordado y soporte local. Sin promesas de resultado clínico.',
      },
    ],
    projectOptions: [
      { value: 'nueva_central', label: 'Nueva central / ampliación' },
      { value: 'reemplazo', label: 'Reemplazo de autoclave' },
      { value: 'pico_quirurgico', label: 'Cuello de botella en quirófano' },
      { value: 'orientacion', label: 'Solo orientación técnica' },
    ],
    productSlugs: ['t-max-6', 'autoclave-5075'],
    productsTitle: 'Referencias Tuttnauer en catálogo',
    productsNote: 'Modelos reales. El dimensionamiento lo cierra un asesor con su carga.',
    catalogFilter: 'esterilizacion-control-infecciones',
  },
  en: {
    tag: 'Sterilization · Tuttnauer',
    title: 'Tuttnauer autoclaves for sterile processing | I-ME Colombia advisory',
    description:
      'Sterile processing bottleneck? Evaluate Tuttnauer autoclaves (infection-control focus since 1925) with I-ME guidance: load flow, install and support in Colombia.',
    h1: 'When CSSD cannot wait for the next cycle',
    lead: 'Tuttnauer builds sterilizers and infection-control equipment since 1925. I-ME helps land catalog autoclaves on your real load: OR, CSSD and shifts that do not forgive delays.',
    formIntro:
      'Share load volume, instrument mix and timeline. An I-ME advisor replies in CSSD language — not a generic PDF.',
    primaryCta: 'Guide my sterilization project',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse sterilization catalog',
    heroImage: '/assets/img/hospital-facility.webp',
    heroImageAlt: 'Hospital infrastructure for infection control — I-ME Colombia',
    manufacturer: {
      name: 'Tuttnauer',
      logo: '/assets/img/fabricantes/tuttnauer.webp',
      logoAlt: 'Tuttnauer logo',
      corpTitle: 'Who is Tuttnauer (product profile)',
      corpBody:
        'Manufacturer focused on sterilization and infection control: tabletop and hospital autoclaves, low-temperature sterilizers and washer-disinfectors. Global presence in clinical, dental and lab settings. In Colombia, I-ME advises selection and implementation of catalog references.',
      advantagesTitle: 'Advantages CSSD and biomed leaders usually seek',
      advantages: [
        'Century-long infection-control focus (not a generic box)',
        'Portfolio from clinic tabletop to hospital workflow',
        'Cycle, load and traceability language aligned to CSSD ops',
        'I-ME local commissioning and after-sales support',
      ],
    },
    problemTitle: 'The real problem in Colombian sterile processing',
    problemBody:
      'It is not “buying a pretty autoclave”. It is releasing instruments on time, cutting rework, documenting cycles and not leaving the OR waiting because the chamber was undersized.',
    solutionsTitle: 'How Tuttnauer + I-ME address that pain',
    solutions: [
      {
        pain: 'The chamber saturates at OR peak',
        help: 'We size Tuttnauer catalog references (e.g. T-Max 6 and horizontal lines) by load, instruments and shifts — not the biggest brochure.',
      },
      {
        pain: 'Fear of being alone after install',
        help: 'We agree commissioning, training and I-ME support so CSSD is not improvising.',
      },
      {
        pain: 'Audit asks for traceability evidence',
        help: 'We clarify applicable manufacturer documentation vs day-to-day institutional operation — without inventing certifications.',
      },
    ],
    audienceYes: [
      'CSSD / sterile processing expanding or renewing',
      'Clinics and IPS with OR cycle saturation',
      'Biomed and purchasing with a real CapEx project',
    ],
    audienceNo: [
      'Patients or individuals',
      'Spare-part requests without an institution',
      'Direct manufacturer outreach (I-ME is your local advisory channel)',
    ],
    situations: [
      {
        title: 'New CSSD',
        body: 'Define capacity, utilities and flow before buying “the biggest unit”.',
      },
      {
        title: 'Obsolescence replacement',
        body: 'Migrate without freezing the OR: transition, training and load plan B.',
      },
      {
        title: 'Surgical peak',
        body: 'When the bottleneck is cycle time, not “lack of will”.',
      },
    ],
    scopeTitle: 'What the I-ME conversation covers',
    scope: [
      'Load and instrument-type reading',
      'Published Tuttnauer catalog alternatives',
      'Install and training scope',
      'Formal proposal when the project matures',
    ],
    requirementsTitle: 'So nobody wastes time',
    requirements: [
      'Institution, city and service (CSSD / OR)',
      'Purchase horizon',
      'Volume or bottleneck in one sentence',
    ],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Which Tuttnauer autoclaves are in the I-ME catalog?',
        a: 'Published references such as T-Max 6 and Horizontal Autoclave 5075, among other sterilization items. Availability confirmed in quotation.',
      },
      {
        q: 'Does I-ME invent clinical claims for Tuttnauer?',
        a: 'No. We work with published sheets, agreed scope and local support. No clinical outcome promises.',
      },
    ],
    projectOptions: [
      { value: 'nueva_central', label: 'New / expanded CSSD' },
      { value: 'reemplazo', label: 'Autoclave replacement' },
      { value: 'pico_quirurgico', label: 'OR bottleneck' },
      { value: 'orientacion', label: 'Technical guidance only' },
    ],
    productSlugs: ['t-max-6', 'autoclave-5075'],
    productsTitle: 'Tuttnauer catalog references',
    productsNote: 'Real models. An advisor closes sizing with your load.',
    catalogFilter: 'esterilizacion-control-infecciones',
  },
};

const SAIKANG: Record<Locale, FabCopy> = {
  es: {
    tag: 'Mobiliario · Saikang',
    title: 'Mobiliario hospitalario Saikang: camillas, carros y flujo | I-ME Colombia',
    description:
      '¿Flujo de paciente y enfermería trabado? Mobiliario Saikang (camillas, carros, ABS) con asesoría I-ME: ergonomía de servicio, no catálogo infinito.',
    h1: 'El mobiliario también es un dispositivo de flujo',
    lead: 'Saikang Medical (desde 2002) fabrica camas, camillas y carros hospitalarios con foco en confort, seguridad y carga de trabajo del cuidador. I-ME traduce eso a su piso: emergencias, hospitalización y quirófano.',
    formIntro:
      'Indique servicio (urgencias, hospitalización, quirófano) y qué frena hoy el flujo. Respondemos con referencias Saikang del catálogo.',
    primaryCta: 'Orientar mobiliario clínico',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver mobiliario en catálogo',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Pasillo clínico hospitalario — I-ME Colombia',
    manufacturer: {
      name: 'Saikang Medical',
      logo: '/assets/img/fabricantes/saikang.png',
      logoAlt: 'Logo Saikang Medical',
      corpTitle: 'Quién es Saikang (perfil de producto)',
      corpBody:
        'Jiangsu Saikang Medical Equipment Co., Ltd. desarrolla mobiliario clínico desde 2002: camas, camillas, carros y soluciones de infraestructura. Reporta sistemas de gestión tipo ISO 13485 / ISO 9001 y cumplimiento IEC en líneas de cama. En I-ME presentamos referencias publicadas para proyectos institucionales en Colombia.',
      advantagesTitle: 'Ventajas para jefes de piso y compras',
      advantages: [
        'Portafolio amplio de flujo: emergencia, infusión, anestesia, lavado',
        'Diseño orientado a reducir carga del cuidador y mejorar dignidad del paciente',
        'Referencias ABS y acero inoxidable según zona (húmeda vs. transporte)',
        'Acompañamiento I-ME en selección por servicio, no por “precio por unidad”',
      ],
    },
    problemTitle: 'Lo que duele en el piso (y no aparece en el brochure)',
    problemBody:
      'Carros que no entran en ascensor, camillas sin frenado confiable, estaciones de enfermería saturadas y compras que eligen “lo barato” y pagan en tiempo de traslado y riesgo de caída.',
    solutionsTitle: 'Cómo Saikang + I-ME ordenan el flujo',
    solutions: [
      {
        pain: 'Urgencias sin carro de emergencia coherente',
        help: 'Orientamos carros tipo SKR054-ET y líneas ABS según protocolo de reanimación y layout de sala.',
      },
      {
        pain: 'Camillas que frenan el traslado interservicio',
        help: 'Comparamos camillas SKB037 y variantes según distancia, ascensores y tipo de paciente.',
      },
      {
        pain: 'Carros de infusión / anestesia desordenados',
        help: 'Aterrizamos SKR-IV588, SKR-AT625 y similares al flujo real de terapia y quirófano.',
      },
    ],
    audienceYes: [
      'Hospitalización, urgencias y quirófano en remodelación',
      'Enfermería e ingeniería que rediseñan flujo de paciente',
      'Compras institucionales con lote de mobiliario clínico',
    ],
    audienceNo: [
      'Mobiliario doméstico / oficina',
      'Pacientes particulares',
      'Contacto directo al fabricante',
    ],
    situations: [
      {
        title: 'Apertura de piso',
        body: 'Estandarizar carros y camillas antes de que cada servicio improvise.',
      },
      {
        title: 'Renovación de urgencias',
        body: 'Carro de emergencia y traslado alineados al protocolo.',
      },
      {
        title: 'Licitación de mobiliario',
        body: 'Fichas claras, alternativas publicadas y alcance de entrega.',
      },
    ],
    scopeTitle: 'Alcance de la asesoría I-ME',
    scope: [
      'Mapa de servicios y cuellos de flujo',
      'Referencias Saikang del catálogo',
      'Criterios de material (ABS / inox) por zona',
      'Propuesta por lote o por servicio',
    ],
    requirementsTitle: 'Datos mínimos',
    requirements: [
      'Institución y ciudad',
      'Servicio prioritario',
      'Horizonte y volumen aproximado',
    ],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿Saikang solo hace camas?',
        a: 'No. En catálogo I-ME hay carros ABS/inox, camillas, carros de emergencia, infusión y anestesia, entre otras referencias publicadas.',
      },
      {
        q: '¿Garantizan resultados de enfermería?',
        a: 'No prometemos outcomes clínicos. Sí ayudamos a elegir mobiliario documentado y operable en su layout.',
      },
    ],
    projectOptions: [
      { value: 'urgencias', label: 'Urgencias / emergencia' },
      { value: 'hospitalizacion', label: 'Hospitalización' },
      { value: 'quirofano', label: 'Quirófano / anestesia' },
      { value: 'lote', label: 'Lote institucional' },
    ],
    productSlugs: [
      'skm-b-skr054-et',
      'skm-c-skb037b',
      'skm-g-skb037c',
      'skr-at625-1',
      'skm-b-skr-iv588',
      'skm-a-skr-ib00',
    ],
    productsTitle: 'Referencias Saikang en catálogo',
    productsNote: 'Muestra representativa. Hay más carros y camillas publicados en mobiliario.',
    catalogFilter: 'mobiliario',
  },
  en: {
    tag: 'Furniture · Saikang',
    title: 'Saikang hospital furniture: stretchers, trolleys & flow | I-ME Colombia',
    description:
      'Patient-flow stuck? Saikang furniture (stretchers, trolleys, ABS) with I-ME advisory: service ergonomics, not an endless catalog.',
    h1: 'Furniture is a flow device too',
    lead: 'Saikang Medical (since 2002) builds beds, stretchers and hospital trolleys focused on comfort, safety and caregiver load. I-ME maps that to your floor: ED, wards and OR.',
    formIntro:
      'Tell us the service (ED, ward, OR) and what blocks flow today. We reply with Saikang catalog references.',
    primaryCta: 'Guide clinical furniture',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse furniture catalog',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Hospital clinical corridor — I-ME Colombia',
    manufacturer: {
      name: 'Saikang Medical',
      logo: '/assets/img/fabricantes/saikang.png',
      logoAlt: 'Saikang Medical logo',
      corpTitle: 'Who is Saikang (product profile)',
      corpBody:
        'Jiangsu Saikang Medical Equipment Co., Ltd. develops clinical furniture since 2002: beds, stretchers, trolleys and infrastructure solutions. Reports ISO 13485 / ISO 9001-type systems and IEC compliance on bed lines. I-ME presents published references for institutional projects in Colombia.',
      advantagesTitle: 'Advantages ward and purchasing leaders seek',
      advantages: [
        'Broad flow portfolio: emergency, infusion, anesthesia, wash',
        'Design aimed at caregiver load and patient dignity',
        'ABS and stainless options by zone (wet vs transport)',
        'I-ME selection by service — not unit price alone',
      ],
    },
    problemTitle: 'What hurts on the floor (and never makes the brochure)',
    problemBody:
      'Trolleys that miss elevator clearance, stretchers without reliable braking, nursing stations overflowing, and purchases that pick “cheap” then pay in transfer time and fall risk.',
    solutionsTitle: 'How Saikang + I-ME organize flow',
    solutions: [
      {
        pain: 'ED without a coherent emergency cart',
        help: 'We guide SKR054-ET-class carts and ABS lines by resuscitation protocol and room layout.',
      },
      {
        pain: 'Stretchers that slow inter-service transfer',
        help: 'We compare SKB037 stretchers by distance, elevators and patient type.',
      },
      {
        pain: 'Messy infusion / anesthesia carts',
        help: 'We land SKR-IV588, SKR-AT625 and peers on real therapy and OR flow.',
      },
    ],
    audienceYes: [
      'Wards, ED and OR under remodel',
      'Nursing and engineering redesigning patient flow',
      'Institutional purchasing with clinical furniture lots',
    ],
    audienceNo: ['Home / office furniture', 'Individual patients', 'Direct manufacturer outreach'],
    situations: [
      {
        title: 'New ward',
        body: 'Standardize carts and stretchers before each service improvises.',
      },
      {
        title: 'ED renewal',
        body: 'Emergency cart and transfer aligned to protocol.',
      },
      {
        title: 'Furniture tender',
        body: 'Clear sheets, published alternatives and delivery scope.',
      },
    ],
    scopeTitle: 'I-ME advisory scope',
    scope: [
      'Service map and flow bottlenecks',
      'Saikang catalog references',
      'Material criteria (ABS / stainless) by zone',
      'Lot or per-service proposal',
    ],
    requirementsTitle: 'Minimum data',
    requirements: ['Institution and city', 'Priority service', 'Horizon and approximate volume'],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Does Saikang only make beds?',
        a: 'No. The I-ME catalog includes ABS/stainless trolleys, stretchers, emergency, infusion and anesthesia carts, among published items.',
      },
      {
        q: 'Do you guarantee nursing outcomes?',
        a: 'We do not promise clinical outcomes. We help choose documented furniture operable in your layout.',
      },
    ],
    projectOptions: [
      { value: 'urgencias', label: 'ED / emergency' },
      { value: 'hospitalizacion', label: 'Inpatient ward' },
      { value: 'quirofano', label: 'OR / anesthesia' },
      { value: 'lote', label: 'Institutional lot' },
    ],
    productSlugs: [
      'skm-b-skr054-et',
      'skm-c-skb037b',
      'skm-g-skb037c',
      'skr-at625-1',
      'skm-b-skr-iv588',
      'skm-a-skr-ib00',
    ],
    productsTitle: 'Saikang catalog references',
    productsNote:
      'Representative sample. More trolleys and stretchers are published under furniture.',
    catalogFilter: 'mobiliario',
  },
};

const ANGELL: Record<Locale, FabCopy> = {
  es: {
    tag: 'Imagen · Angell Technology',
    title: 'Mamografía digital y WR-3D Angell Technology | Asesoría I-ME Colombia',
    description:
      '¿Proyecto de mama o imagen ortopédica en carga? Angell Technology (DM156/DM166, WR-3D) con orientación I-ME: sala, flujo y soporte — sin claims inventados.',
    h1: 'Imagen que responde a la pregunta clínica, no solo al pixel',
    lead: 'Angell Technology (Shenzhen, desde 2002) desarrolla imagen médica digital: mamografía y radiografía 3D en carga (WR-3D). I-ME le ayuda a decidir sala, flujo de pacientes y alcance de implementación en Colombia.',
    formIntro:
      '¿Mama, WR-3D ortopédico u otro hilo de imagen? Cuéntenos volumen y plazo; un asesor aterriza referencias del catálogo.',
    primaryCta: 'Orientar mi proyecto de imagen',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver imagenología en catálogo',
    heroImage: '/assets/img/wr3d-equipo-multifuncional.webp',
    heroImageAlt: 'Sistema de imagen radiográfica 3D — I-ME Colombia',
    manufacturer: {
      name: 'Angell Technology',
      logo: '/assets/img/fabricantes/angell-technology.jpg',
      logoAlt: 'Logo Angell Technology',
      corpTitle: 'Quién es Angell Technology (perfil de producto)',
      corpBody:
        'Proveedor global de imagen médica digital con sede en Shenzhen (fundación 2002). Portafolio público: mamografía digital, DR y el sistema WR-3D de radiografía volumétrica en posición de carga para columna y miembros inferiores — complementario a CT/MRI en evaluación ortopédica funcional.',
      advantagesTitle: 'Ventajas para radiólogos, ortopedistas y biomédicos',
      advantages: [
        'Mamografía digital con foco en detección y experiencia de examen (líneas DM / Fanghua)',
        'WR-3D: imagen 3D en carga — alineación bajo peso real, no solo en decúbito',
        'Plataforma 2D + fluoroscopía / stitching en un mismo hilo de sala (según configuración)',
        'Asesoría I-ME en layout, flujo y propuesta sin inventar desempeño clínico',
      ],
    },
    problemTitle: 'Dolor típico en proyectos de imagen',
    problemBody:
      'Salas mal dimensionadas, equipos que no responden a la pregunta ortopédica en carga, mamógrafos elegidos solo por precio y proyectos que olvidan capacitación y mantenimiento.',
    solutionsTitle: 'Cómo Angell + I-ME ordenan la decisión',
    solutions: [
      {
        pain: 'Programa de mama sin claridad de detector / flujo',
        help: 'Orientamos series DM156 / DM166 del catálogo según volumen, sala y protocolo institucional.',
      },
      {
        pain: 'Ortopedia necesita alineación en carga (escoliosis / rodilla)',
        help: 'Explicamos el rol del WR-3D frente a CT/MRI en decúbito: complementary imaging, no reemplazo mágico.',
      },
      {
        pain: 'Temen CapEx ciego',
        help: 'Separaremos ficha publicada, utilidades de sala y alcance de instalación antes de cotizar en firme.',
      },
    ],
    audienceYes: [
      'Servicios de imagen / mama en ampliación',
      'Ortopedia y columna que evalúan alineación en carga',
      'Compras e ingeniería con proyecto radiológico real',
    ],
    audienceNo: [
      'Pacientes buscando cita diagnóstica',
      'Pedidos de film sin institución',
      'Contacto directo al fabricante',
    ],
    situations: [
      {
        title: 'Nueva sala de mama',
        body: 'Detector, flujo de pacientes y experiencia del examen.',
      },
      {
        title: 'Proyecto WR-3D',
        body: 'Indicación ortopédica, layout y comparación honesta vs. otras modalidades.',
      },
      {
        title: 'Renovación DR',
        body: 'Cuando el cuello es productividad de sala, no solo “más megapíxeles”.',
      },
    ],
    scopeTitle: 'Qué cubre I-ME',
    scope: [
      'Lectura de caso clínico-operativo',
      'Referencias Angell publicadas',
      'Alcance de sala e instalación',
      'Propuesta consultiva',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Institución y ciudad', 'Tipo de estudio prioritario', 'Horizonte de compra'],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿WR-3D reemplaza el CT?',
        a: 'No lo presentamos así. WR-3D aporta imagen en carga; CT/MRI siguen con fortalezas distintas. La decisión es clínica e institucional.',
      },
      {
        q: '¿Qué mamógrafos Angell hay en catálogo?',
        a: 'Series publicadas como DM156 y DM166, entre otras referencias de radiología I-ME.',
      },
    ],
    projectOptions: [
      { value: 'mamografia', label: 'Mamografía digital' },
      { value: 'wr3d', label: 'WR-3D / imagen en carga' },
      { value: 'sala_nueva', label: 'Nueva sala de imagen' },
      { value: 'orientacion', label: 'Orientación técnica' },
    ],
    productSlugs: ['dm156', 'dm166', 'wr-3d'],
    productsTitle: 'Referencias Angell en catálogo',
    productsNote: 'Modelos reales. El layout de sala lo cerramos con ingeniería y clínica.',
    catalogFilter: 'radiologia',
  },
  en: {
    tag: 'Imaging · Angell Technology',
    title: 'Angell Technology digital mammography & WR-3D | I-ME Colombia advisory',
    description:
      'Breast or weight-bearing ortho imaging project? Angell Technology (DM156/DM166, WR-3D) with I-ME guidance: room, flow and support — no invented claims.',
    h1: 'Imaging that answers the clinical question, not just the pixel',
    lead: 'Angell Technology (Shenzhen, since 2002) builds digital medical imaging: mammography and weight-bearing 3D radiography (WR-3D). I-ME helps decide room, patient flow and implementation scope in Colombia.',
    formIntro:
      'Breast, WR-3D ortho or another imaging thread? Share volume and timeline; an advisor lands catalog references.',
    primaryCta: 'Guide my imaging project',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse imaging catalog',
    heroImage: '/assets/img/wr3d-equipo-multifuncional.webp',
    heroImageAlt: '3D radiographic imaging system — I-ME Colombia',
    manufacturer: {
      name: 'Angell Technology',
      logo: '/assets/img/fabricantes/angell-technology.jpg',
      logoAlt: 'Angell Technology logo',
      corpTitle: 'Who is Angell Technology (product profile)',
      corpBody:
        'Global digital medical imaging supplier based in Shenzhen (founded 2002). Public portfolio: digital mammography, DR and WR-3D volumetric weight-bearing radiography for spine and lower limbs — complementary to CT/MRI for functional orthopedic assessment.',
      advantagesTitle: 'Advantages radiologists, ortho and biomed seek',
      advantages: [
        'Digital mammography focused on detection and exam experience (DM / Fanghua lines)',
        'WR-3D: weight-bearing 3D — alignment under real load, not only supine',
        '2D + fluoroscopy / stitching on one room thread (by configuration)',
        'I-ME advisory on layout, flow and proposal without inventing clinical performance',
      ],
    },
    problemTitle: 'Typical imaging-project pain',
    problemBody:
      'Undersized rooms, systems that miss the weight-bearing ortho question, mammography picked by price alone, and projects that forget training and maintenance.',
    solutionsTitle: 'How Angell + I-ME organize the decision',
    solutions: [
      {
        pain: 'Breast program without detector / flow clarity',
        help: 'We guide DM156 / DM166 catalog series by volume, room and institutional protocol.',
      },
      {
        pain: 'Ortho needs load-bearing alignment (scoliosis / knee)',
        help: 'We explain WR-3D vs supine CT/MRI: complementary imaging, not a magic replace.',
      },
      {
        pain: 'Fear of blind CapEx',
        help: 'We separate published sheet, room utilities and install scope before firm quote.',
      },
    ],
    audienceYes: [
      'Imaging / breast services expanding',
      'Spine and ortho evaluating weight-bearing alignment',
      'Purchasing and engineering with a real radiology project',
    ],
    audienceNo: [
      'Patients seeking diagnostic appointments',
      'Film requests without an institution',
      'Direct manufacturer outreach',
    ],
    situations: [
      {
        title: 'New breast room',
        body: 'Detector, patient flow and exam experience.',
      },
      {
        title: 'WR-3D project',
        body: 'Ortho indication, layout and honest modality comparison.',
      },
      {
        title: 'DR renewal',
        body: 'When the bottleneck is room productivity, not “more megapixels”.',
      },
    ],
    scopeTitle: 'What I-ME covers',
    scope: [
      'Clinical-operational case reading',
      'Published Angell references',
      'Room and install scope',
      'Consultative proposal',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Institution and city', 'Priority study type', 'Purchase horizon'],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Does WR-3D replace CT?',
        a: 'We do not present it that way. WR-3D adds weight-bearing imaging; CT/MRI keep distinct strengths. The decision is clinical and institutional.',
      },
      {
        q: 'Which Angell mammography units are in catalog?',
        a: 'Published series such as DM156 and DM166, among other I-ME radiology references.',
      },
    ],
    projectOptions: [
      { value: 'mamografia', label: 'Digital mammography' },
      { value: 'wr3d', label: 'WR-3D / weight-bearing imaging' },
      { value: 'sala_nueva', label: 'New imaging room' },
      { value: 'orientacion', label: 'Technical guidance' },
    ],
    productSlugs: ['dm156', 'dm166', 'wr-3d'],
    productsTitle: 'Angell catalog references',
    productsNote: 'Real models. Room layout closes with engineering and clinical leads.',
    catalogFilter: 'radiologia',
  },
};

const NORTHERN: Record<Locale, FabCopy> = {
  es: {
    tag: 'Monitoreo · Northern Meditec',
    title: 'Monitores y anestesia Northern Meditec (Virgo, Atlas) | I-ME Colombia',
    description:
      '¿UCI, quirófano o transporte? Monitores Virgo/Gemini/Aquarius y anestesia Atlas N3–N7 Northern Meditec con asesoría I-ME en Colombia.',
    h1: 'Signos vitales claros cuando el turno no perdona ruido',
    lead: 'Northern Meditec (Shenzhen) fabrica monitores multiparámetro, oxímetros y máquinas de anestesia (líneas Virgo, Aquarius, Atlas, Crius). I-ME aterriza el modelo a su unidad: UCI, quirófano o traslado.',
    formIntro:
      'Indique unidad (UCI, quirófano, neonatos, transporte) y qué parámetro o flujo falla hoy. Respondemos con referencias publicadas.',
    primaryCta: 'Orientar monitoreo / anestesia',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver monitores en catálogo',
    heroImage: '/assets/img/equipamiento-biomedico-vanguardia.webp',
    heroImageAlt: 'Equipamiento biomédico de monitoreo — I-ME Colombia',
    manufacturer: {
      name: 'Northern Meditec',
      logo: '/assets/img/fabricantes/northern-meditec.png',
      logoAlt: 'Logo Northern Meditec',
      corpTitle: 'Quién es Northern Meditec (perfil de producto)',
      corpBody:
        'Shenzhen Northern Meditec Limited desarrolla monitores de paciente, máquinas de anestesia y ventilación asociada. Líneas conocidas: Virgo, Pisces, Venus, Taurus, Gemini, Aquarius, Atlas N3/N5/N7 y Crius V6. En I-ME se ofrecen referencias publicadas con orientación de implementación local.',
      advantagesTitle: 'Ventajas para intensivistas, anestesiólogos y biomédicos',
      advantages: [
        'Familia coherente de monitores (compactos a multiparámetro de sala)',
        'Anestesia Atlas con modos para neonato–adulto según modelo',
        'Opciones de conectividad/CMS en monitores de línea (según ficha)',
        'Asesoría I-ME para estandarizar flota y evitar “zoo de pantallas”',
      ],
    },
    problemTitle: 'El problema en unidades de cuidado',
    problemBody:
      'Monitores incompatibles entre salas, alarmas que fatigan, anestesia sin curva de aprendizaje clara y compras por urgencia que luego no se integran al protocolo.',
    solutionsTitle: 'Cómo Northern + I-ME ordenan la flota',
    solutions: [
      {
        pain: 'UCI / piso sin estándar de monitor',
        help: 'Comparamos Virgo, Gemini, Taurus, Venus y Aquarius Lite según parámetros, movilidad y presupuesto de proyecto.',
      },
      {
        pain: 'Quirófano necesita anestesia escalable',
        help: 'Orientamos Atlas N3 / N5 / N7 y Crius V6 según complejidad de casos y soporte de ventilación.',
      },
      {
        pain: 'Temen capacitación incompleta',
        help: 'Acordamos puesta en marcha y entrenamiento al personal que realmente opera el equipo.',
      },
    ],
    audienceYes: [
      'UCI, UCE y quirófano en ampliación',
      'Anestesia e ingeniería biomédica',
      'Proyectos de estandarización de flota',
    ],
    audienceNo: ['Uso doméstico', 'Pacientes', 'Contacto directo al fabricante'],
    situations: [
      {
        title: 'Estandarizar monitores',
        body: 'Misma lógica de alarmas y accesorios entre salas.',
      },
      {
        title: 'Nueva sala de cirugía',
        body: 'Anestesia + monitoreo coherentes desde el día uno.',
      },
      { title: 'Transporte / portátil', body: 'Autonomía y robustez para traslado interno.' },
    ],
    scopeTitle: 'Alcance I-ME',
    scope: [
      'Lectura de unidad y parámetros críticos',
      'Referencias Northern del catálogo',
      'Alcance de instalación y capacitación',
      'Propuesta formal',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Institución y ciudad', 'Unidad clínica', 'Horizonte'],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿Aquarius y Acuarius son lo mismo?',
        a: 'En catálogo hay Oxímetro Aquarius LITE y Monitor Multiparámetro Acuarius. Confirmamos la referencia exacta en asesoría según necesidad.',
      },
      {
        q: '¿Qué máquinas Atlas hay?',
        a: 'Publicadas Atlas N3, N5 y N7, más ventilador Crius V6 en la familia de anestesia/soporte.',
      },
    ],
    projectOptions: [
      { value: 'monitores_uci', label: 'Monitores UCI / piso' },
      { value: 'anestesia', label: 'Máquina de anestesia' },
      { value: 'estandarizacion', label: 'Estandarizar flota' },
      { value: 'orientacion', label: 'Orientación técnica' },
    ],
    productSlugs: ['virgo', 'acuarius', 'aquarius-lite', 'gemini', 'atlas-n5', 'crius-v6'],
    productsTitle: 'Referencias Northern Meditec en catálogo',
    productsNote:
      'Muestra clave. Hay más monitores (Pisces, Venus, Taurus, Atlas N3/N7) publicados.',
    catalogFilter: 'monitores',
  },
  en: {
    tag: 'Monitoring · Northern Meditec',
    title: 'Northern Meditec monitors & anesthesia (Virgo, Atlas) | I-ME Colombia',
    description:
      'ICU, OR or transport? Virgo/Gemini/Aquarius monitors and Atlas N3–N7 anesthesia from Northern Meditec with I-ME advisory in Colombia.',
    h1: 'Clear vitals when the shift will not forgive noise',
    lead: 'Northern Meditec (Shenzhen) builds multiparameter monitors, oximeters and anesthesia machines (Virgo, Aquarius, Atlas, Crius lines). I-ME lands the model on your unit: ICU, OR or transfer.',
    formIntro:
      'Name the unit (ICU, OR, neonates, transport) and which parameter or flow fails today. We reply with published references.',
    primaryCta: 'Guide monitoring / anesthesia',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse monitors catalog',
    heroImage: '/assets/img/equipamiento-biomedico-vanguardia.webp',
    heroImageAlt: 'Biomedical monitoring equipment — I-ME Colombia',
    manufacturer: {
      name: 'Northern Meditec',
      logo: '/assets/img/fabricantes/northern-meditec.png',
      logoAlt: 'Northern Meditec logo',
      corpTitle: 'Who is Northern Meditec (product profile)',
      corpBody:
        'Shenzhen Northern Meditec Limited develops patient monitors, anesthesia machines and related ventilation. Known lines: Virgo, Pisces, Venus, Taurus, Gemini, Aquarius, Atlas N3/N5/N7 and Crius V6. I-ME offers published references with local implementation guidance.',
      advantagesTitle: 'Advantages intensivists, anesthesiologists and biomed seek',
      advantages: [
        'Coherent monitor family (compact to full multiparameter)',
        'Atlas anesthesia with neonate–adult modes by model',
        'Connectivity/CMS options on line monitors (per sheet)',
        'I-ME help to standardize fleets and avoid a “screen zoo”',
      ],
    },
    problemTitle: 'The problem in care units',
    problemBody:
      'Incompatible monitors across rooms, alarm fatigue, anesthesia without a clear learning curve, and urgent buys that never fit protocol.',
    solutionsTitle: 'How Northern + I-ME organize the fleet',
    solutions: [
      {
        pain: 'ICU / ward without a monitor standard',
        help: 'We compare Virgo, Gemini, Taurus, Venus and Aquarius Lite by parameters, mobility and project budget.',
      },
      {
        pain: 'OR needs scalable anesthesia',
        help: 'We guide Atlas N3 / N5 / N7 and Crius V6 by case complexity and ventilation support.',
      },
      {
        pain: 'Fear of incomplete training',
        help: 'We agree commissioning and training for staff who actually run the device.',
      },
    ],
    audienceYes: [
      'ICU, step-down and OR expanding',
      'Anesthesia and biomedical engineering',
      'Fleet standardization projects',
    ],
    audienceNo: ['Home use', 'Patients', 'Direct manufacturer outreach'],
    situations: [
      { title: 'Standardize monitors', body: 'Same alarm logic and accessories across rooms.' },
      { title: 'New OR', body: 'Coherent anesthesia + monitoring from day one.' },
      { title: 'Transport / portable', body: 'Autonomy and ruggedness for internal transfer.' },
    ],
    scopeTitle: 'I-ME scope',
    scope: [
      'Unit and critical-parameter reading',
      'Northern catalog references',
      'Install and training scope',
      'Formal proposal',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Institution and city', 'Clinical unit', 'Horizon'],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Are Aquarius and Acuarius the same?',
        a: 'Catalog lists Aquarius LITE oximeter and Acuarius multiparameter monitor. We confirm the exact reference in advisory.',
      },
      {
        q: 'Which Atlas machines are listed?',
        a: 'Published Atlas N3, N5 and N7, plus Crius V6 ventilator in the anesthesia/support family.',
      },
    ],
    projectOptions: [
      { value: 'monitores_uci', label: 'ICU / ward monitors' },
      { value: 'anestesia', label: 'Anesthesia machine' },
      { value: 'estandarizacion', label: 'Standardize fleet' },
      { value: 'orientacion', label: 'Technical guidance' },
    ],
    productSlugs: ['virgo', 'acuarius', 'aquarius-lite', 'gemini', 'atlas-n5', 'crius-v6'],
    productsTitle: 'Northern Meditec catalog references',
    productsNote: 'Key sample. More monitors (Pisces, Venus, Taurus, Atlas N3/N7) are published.',
    catalogFilter: 'monitores',
  },
};

const ILUMITEC: Record<Locale, FabCopy> = {
  es: {
    tag: 'Quirófano · Ilumitec',
    title: 'Lámparas quirúrgicas LED Ilumitec Colombia | Asesoría I-ME',
    description:
      '¿Luz de quirófano opaca o halógena? Lámparas LED cielíticas y rodables Ilumitec (fábrica colombiana desde 1988) con orientación I-ME.',
    h1: 'Luz de sala que deja ver tejido — no solo “más lux en el brochure”',
    lead: 'Ilumitec S.A.S. diseña y fabrica en Colombia lámparas de cirugía y examinación desde 1988; LED desde 2010 con foco en durabilidad y color real. I-ME le ayuda a elegir cielítica o rodable según su sala.',
    formIntro: '¿Cielítica, rodable, upgrade desde halógena? Cuéntenos tipo de sala y plazo.',
    primaryCta: 'Orientar iluminación quirúrgica',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver quirófano en catálogo',
    heroImage: '/assets/img/quirofanos-inteligentes.webp',
    heroImageAlt: 'Quirófano con iluminación quirúrgica — I-ME Colombia',
    manufacturer: {
      name: 'Ilumitec',
      logo: '/assets/img/fabricantes/ilumitec.png',
      logoAlt: 'Logo Ilumitec',
      corpTitle: 'Quién es Ilumitec (perfil de producto)',
      corpBody:
        'Iluminación y Tecnología Médico Quirúrgica S.A.S. (Ilumitec) es fábrica colombiana dedicada a lámparas quirúrgicas y de examinación. Destaca fabricación local, registro INVIMA en sus líneas, LED con vida útil de decenas de miles de horas y opción de modernización tecnológica desde cabezales halógenos.',
      advantagesTitle: 'Ventajas para jefes de quirófano y biomédicos',
      advantages: [
        'Fabricación colombiana: cercanía de soporte y repuestos en territorio',
        'LED con reflexión/control de sombras y gamas de blanco mezclables',
        'Opciones cielíticas y rodables según infraestructura de sala',
        'Ruta de upgrade tecnológico sin necesariamente reemplazar toda la instalación',
      ],
    },
    problemTitle: 'Cuando la luz frena al cirujano',
    problemBody:
      'Sombras molestas, calor residual de halógeno, fatiga visual en jornadas largas y salas que heredaron lámparas sin plan de modernización.',
    solutionsTitle: 'Cómo Ilumitec + I-ME resuelven',
    solutions: [
      {
        pain: 'Sala necesita cielítica nueva',
        help: 'Orientamos LED-X18 / X36 y dobles satélite (X3618, X3636) según campo quirúrgico y montaje.',
      },
      {
        pain: 'Requieren movilidad (rodable)',
        help: 'Comparamos LED-RX18 / RX36 y versiones 100K–160K según intensidad y uso.',
      },
      {
        pain: 'Tienen Ilumitec halógena y quieren LED',
        help: 'Exploramos ruta de cambio de tecnología (cabezal/electrónica) cuando aplica al modelo instalado.',
      },
    ],
    audienceYes: [
      'Quirófanos en apertura o remodelación',
      'Clínicas que modernizan de halógeno a LED',
      'Ingeniería biomédica con proyecto de iluminación',
    ],
    audienceNo: ['Iluminación doméstica', 'Pacientes', 'Contacto directo al fabricante'],
    situations: [
      { title: 'Obra nueva', body: 'Definir cielítica antes de cerrar cielo falso.' },
      { title: 'Upgrade LED', body: 'Más intensidad y menos calor con plan de cambio.' },
      { title: 'Sala menor / procedimientos', body: 'Rodable cuando no hay montaje cielítico.' },
    ],
    scopeTitle: 'Alcance I-ME',
    scope: [
      'Lectura de sala y tipo de cirugía',
      'Referencias Ilumitec del catálogo',
      'Criterios de montaje e instalación',
      'Propuesta formal',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Institución y ciudad', 'Cielítica vs rodable', 'Horizonte'],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿Ilumitec es importado?',
        a: 'Ilumitec fabrica en Colombia. I-ME orienta referencias publicadas en catálogo para proyectos institucionales.',
      },
      {
        q: '¿Qué modelos LED hay?',
        a: 'Líneas rodables LED-RX y cielíticas LED-X (incl. dobles satélite), entre otras publicadas.',
      },
    ],
    projectOptions: [
      { value: 'cielitica', label: 'Lámpara cielítica' },
      { value: 'rodable', label: 'Lámpara rodable' },
      { value: 'upgrade_led', label: 'Upgrade halógeno → LED' },
      { value: 'orientacion', label: 'Orientación técnica' },
    ],
    productSlugs: ['led-x36', 'led-x3618', 'led-rx36-160k', 'led-rx18-100k', 'led-x18-100k'],
    productsTitle: 'Referencias Ilumitec en catálogo',
    productsNote: 'Modelos reales. Montaje y utilidades se confirman en visita/propuesta.',
    catalogFilter: 'sala-cirugia',
  },
  en: {
    tag: 'OR · Ilumitec',
    title: 'Ilumitec Colombia LED surgical lamps | I-ME advisory',
    description:
      'Dim OR light or halogen legacy? Ilumitec ceiling and mobile LED lamps (Colombian factory since 1988) with I-ME guidance.',
    h1: 'OR light that shows tissue — not just “more lux on the brochure”',
    lead: 'Ilumitec S.A.S. designs and manufactures surgical and exam lamps in Colombia since 1988; LED since 2010 focused on durability and true color. I-ME helps choose ceiling or mobile for your room.',
    formIntro: 'Ceiling, mobile, halogen upgrade? Tell us room type and timeline.',
    primaryCta: 'Guide surgical lighting',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse OR catalog',
    heroImage: '/assets/img/quirofanos-inteligentes.webp',
    heroImageAlt: 'Operating room surgical lighting — I-ME Colombia',
    manufacturer: {
      name: 'Ilumitec',
      logo: '/assets/img/fabricantes/ilumitec.png',
      logoAlt: 'Ilumitec logo',
      corpTitle: 'Who is Ilumitec (product profile)',
      corpBody:
        'Iluminación y Tecnología Médico Quirúrgica S.A.S. (Ilumitec) is a Colombian factory for surgical and examination lamps. Highlights: local manufacturing, INVIMA registration on its lines, LED with tens of thousands of hours lifetime, and technology upgrades from halogen heads.',
      advantagesTitle: 'Advantages OR chiefs and biomed seek',
      advantages: [
        'Colombian manufacturing: closer support and parts on territory',
        'LED with reflection/shadow control and blendable white ranges',
        'Ceiling and mobile options by room infrastructure',
        'Upgrade path without necessarily replacing the full install',
      ],
    },
    problemTitle: 'When light slows the surgeon',
    problemBody:
      'Annoying shadows, halogen residual heat, visual fatigue on long days, and rooms that inherited lamps with no modernization plan.',
    solutionsTitle: 'How Ilumitec + I-ME solve it',
    solutions: [
      {
        pain: 'Room needs a new ceiling lamp',
        help: 'We guide LED-X18 / X36 and dual-satellite (X3618, X3636) by surgical field and mount.',
      },
      {
        pain: 'Need mobility (mobile stand)',
        help: 'We compare LED-RX18 / RX36 and 100K–160K versions by intensity and use.',
      },
      {
        pain: 'Have Ilumitec halogen and want LED',
        help: 'We explore technology-change routes (head/electronics) when the installed model allows it.',
      },
    ],
    audienceYes: [
      'ORs opening or remodeling',
      'Clinics modernizing halogen to LED',
      'Biomed with a lighting project',
    ],
    audienceNo: ['Home lighting', 'Patients', 'Direct manufacturer outreach'],
    situations: [
      { title: 'New build', body: 'Define ceiling lamp before closing the false ceiling.' },
      { title: 'LED upgrade', body: 'More intensity, less heat, with a change plan.' },
      { title: 'Minor room / procedures', body: 'Mobile when ceiling mount is not available.' },
    ],
    scopeTitle: 'I-ME scope',
    scope: [
      'Room and surgery-type reading',
      'Ilumitec catalog references',
      'Mount and install criteria',
      'Formal proposal',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Institution and city', 'Ceiling vs mobile', 'Horizon'],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Is Ilumitec imported?',
        a: 'Ilumitec manufactures in Colombia. I-ME guides published catalog references for institutional projects.',
      },
      {
        q: 'Which LED models are listed?',
        a: 'Mobile LED-RX and ceiling LED-X lines (including dual satellite), among other published items.',
      },
    ],
    projectOptions: [
      { value: 'cielitica', label: 'Ceiling lamp' },
      { value: 'rodable', label: 'Mobile lamp' },
      { value: 'upgrade_led', label: 'Halogen → LED upgrade' },
      { value: 'orientacion', label: 'Technical guidance' },
    ],
    productSlugs: ['led-x36', 'led-x3618', 'led-rx36-160k', 'led-rx18-100k', 'led-x18-100k'],
    productsTitle: 'Ilumitec catalog references',
    productsNote: 'Real models. Mount and utilities confirmed in visit/proposal.',
    catalogFilter: 'sala-cirugia',
  },
};

const PERLONG: Record<Locale, FabCopy> = {
  es: {
    tag: 'Diagnóstico · Perlong',
    title: 'Balanzas médicas Perlong para consulta y pediatría | I-ME Colombia',
    description:
      '¿Peso y talla sin trazabilidad en consulta? Balanzas Perlong (adulto, bebé, doble regla) con asesoría I-ME para diagnóstico clínico básico.',
    h1: 'Medir bien al paciente es el primer dato clínico del día',
    lead: 'Perlong Medical (Nanjing) provee equipos de diagnóstico y balanzas clínicas para instituciones. I-ME orienta referencias de peso/talla adulto e infantil publicadas en catálogo.',
    formIntro: '¿Consulta externa, pediatría, nutrición? Indique volumen de pacientes y plazo.',
    primaryCta: 'Orientar balanzas clínicas',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver diagnóstico en catálogo',
    heroImage: '/assets/img/soluciones-biomedicas.webp',
    heroImageAlt: 'Soluciones de diagnóstico clínico — I-ME Colombia',
    manufacturer: {
      name: 'Perlong Medical',
      logo: '/assets/img/fabricantes/perlong.png',
      logoAlt: 'Logo Perlong Medical',
      corpTitle: 'Quién es Perlong (perfil de producto)',
      corpBody:
        'Perlong Medical Equipment Co., Ltd. es fabricante/exportador de equipos médicos y diagnóstico con sede en Nanjing. En el portafolio I-ME destacan balanzas corporales, infantiles y con tallímetro para consulta y programas nutricionales.',
      advantagesTitle: 'Ventajas para consulta, pediatría y nutrición',
      advantages: [
        'Referencias adulto e infantil en un mismo hilo de compra',
        'Opciones con tallímetro / doble regla para antropometría',
        'Lectura digital para reducir error de transcripción',
        'Asesoría I-ME para lotes de consulta externa o pediatría',
      ],
    },
    problemTitle: 'Cuando el peso “se estima” y el dato se pierde',
    problemBody:
      'Balanzas domésticas en consulta, tallas a ojo, pediatría sin bascula adecuada y lotes comprados sin pensar calibración ni flujo de enfermería.',
    solutionsTitle: 'Cómo Perlong + I-ME ordenan la medición',
    solutions: [
      {
        pain: 'Consulta externa sin balanza + talla confiable',
        help: 'Orientamos TCS-200B-RT y RGT-RT según flujo de pacientes y espacio.',
      },
      {
        pain: 'Pediatría / neonatos sin báscula específica',
        help: 'Comparamos EBSA-20 y YRBB-20 para peso infantil según protocolo del servicio.',
      },
      {
        pain: 'Lote institucional sin criterio',
        help: 'Armamos propuesta por cantidad de consultorios y tipo de población.',
      },
    ],
    audienceYes: [
      'Consulta externa y programas nutricionales',
      'Pediatría / gineco-obstetricia',
      'Compras de diagnóstico clínico básico',
    ],
    audienceNo: ['Uso doméstico retail', 'Pacientes', 'Contacto directo al fabricante'],
    situations: [
      { title: 'Apertura de consultorios', body: 'Estandarizar peso/talla desde el día uno.' },
      { title: 'Renovación pediátrica', body: 'Básculas infantiles alineadas al protocolo.' },
      { title: 'Lote IPS', body: 'Volumen y modelo único para mantenimiento.' },
    ],
    scopeTitle: 'Alcance I-ME',
    scope: [
      'Tipo de servicio y población',
      'Referencias Perlong publicadas',
      'Cantidades y propuesta',
      'Orientación de uso institucional',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Institución y ciudad', 'Adulto vs pediatría', 'Horizonte / cantidad'],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿Perlong solo vende balanzas?',
        a: 'El fabricante tiene portafolio amplio; en esta landing I-ME prioriza balanzas clínicas publicadas en catálogo local.',
      },
      {
        q: '¿Incluyen calibración?',
        a: 'El alcance de calibración/metrología se acuerda en propuesta según política institucional — no se asume automático.',
      },
    ],
    projectOptions: [
      { value: 'consulta', label: 'Consulta externa adulto' },
      { value: 'pediatria', label: 'Pediatría / bebé' },
      { value: 'lote', label: 'Lote institucional' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: ['tcs-200b-rt', 'rgt-rt', 'ebsa-20', 'yrbb-20'],
    productsTitle: 'Referencias Perlong en catálogo',
    productsNote: 'Modelos reales de diagnóstico clínico básico.',
    catalogFilter: 'diagnostico-clinico-basico',
  },
  en: {
    tag: 'Diagnostics · Perlong',
    title: 'Perlong medical scales for clinic & pediatrics | I-ME Colombia',
    description:
      'Weight and height without traceability? Perlong scales (adult, infant, height rod) with I-ME advisory for basic clinical diagnostics.',
    h1: 'Measuring the patient well is the first clinical data point of the day',
    lead: 'Perlong Medical (Nanjing) supplies diagnostic equipment and clinical scales. I-ME guides adult and infant weight/height references published in catalog.',
    formIntro: 'Outpatient, pediatrics, nutrition? Share patient volume and timeline.',
    primaryCta: 'Guide clinical scales',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse diagnostics catalog',
    heroImage: '/assets/img/soluciones-biomedicas.webp',
    heroImageAlt: 'Clinical diagnostic solutions — I-ME Colombia',
    manufacturer: {
      name: 'Perlong Medical',
      logo: '/assets/img/fabricantes/perlong.png',
      logoAlt: 'Perlong Medical logo',
      corpTitle: 'Who is Perlong (product profile)',
      corpBody:
        'Perlong Medical Equipment Co., Ltd. manufactures/exports medical and diagnostic equipment from Nanjing. In the I-ME portfolio, body scales, infant scales and height-rod models stand out for clinics and nutrition programs.',
      advantagesTitle: 'Advantages for clinic, pediatrics and nutrition',
      advantages: [
        'Adult and infant references in one purchasing thread',
        'Height-rod / dual-rule options for anthropometry',
        'Digital readout to cut transcription error',
        'I-ME advisory for outpatient or pediatric lots',
      ],
    },
    problemTitle: 'When weight is “estimated” and the data is lost',
    problemBody:
      'Home scales in clinic, eyeballed height, pediatrics without a proper scale, and lots bought without calibration or nursing flow in mind.',
    solutionsTitle: 'How Perlong + I-ME organize measurement',
    solutions: [
      {
        pain: 'Outpatient clinic without reliable weight + height',
        help: 'We guide TCS-200B-RT and RGT-RT by patient flow and space.',
      },
      {
        pain: 'Pediatrics / neonates without a dedicated scale',
        help: 'We compare EBSA-20 and YRBB-20 for infant weight by service protocol.',
      },
      {
        pain: 'Institutional lot without criteria',
        help: 'We build a proposal by number of rooms and population type.',
      },
    ],
    audienceYes: [
      'Outpatient and nutrition programs',
      'Pediatrics / OB-GYN',
      'Basic clinical diagnostics purchasing',
    ],
    audienceNo: ['Retail home use', 'Patients', 'Direct manufacturer outreach'],
    situations: [
      { title: 'New consult rooms', body: 'Standardize weight/height from day one.' },
      { title: 'Pediatric renewal', body: 'Infant scales aligned to protocol.' },
      { title: 'IPS lot', body: 'Volume and one model for maintenance.' },
    ],
    scopeTitle: 'I-ME scope',
    scope: [
      'Service and population type',
      'Published Perlong references',
      'Quantities and proposal',
      'Institutional-use guidance',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Institution and city', 'Adult vs pediatrics', 'Horizon / quantity'],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Does Perlong only sell scales?',
        a: 'The manufacturer has a broad portfolio; this I-ME landing prioritizes clinical scales published in the local catalog.',
      },
      {
        q: 'Is calibration included?',
        a: 'Calibration/metrology scope is agreed in the proposal per institutional policy — not assumed automatic.',
      },
    ],
    projectOptions: [
      { value: 'consulta', label: 'Adult outpatient' },
      { value: 'pediatria', label: 'Pediatrics / infant' },
      { value: 'lote', label: 'Institutional lot' },
      { value: 'orientacion', label: 'Guidance' },
    ],
    productSlugs: ['tcs-200b-rt', 'rgt-rt', 'ebsa-20', 'yrbb-20'],
    productsTitle: 'Perlong catalog references',
    productsNote: 'Real basic clinical diagnostics models.',
    catalogFilter: 'diagnostico-clinico-basico',
  },
};

const BM: Record<Locale, FabCopy> = {
  es: {
    tag: 'Confort · BM',
    title: 'Sillones reclinables BM (BME) para hospitalización | I-ME Colombia',
    description:
      '¿Acompañante y paciente sin postura segura? Sillones reclinables BM serie BME con asesoría I-ME para mobiliario de confort clínico.',
    h1: 'Descanso del acompañante que no es un “extra” — es seguridad de piso',
    lead: 'BM (Shanghai Brother Medical) fabrica mobiliario de cuidado y movilidad. En catálogo I-ME: sillones reclinables BME002 / BME006 / BME007 para hospitalización y zonas de espera clínica.',
    formIntro: '¿Hospitalización, oncología, diálisis, espera? Indique cantidad y plazo.',
    primaryCta: 'Orientar sillones clínicos',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver mobiliario en catálogo',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Área hospitalaria de confort — I-ME Colombia',
    manufacturer: {
      name: 'BM (Brother Medical)',
      logo: '/assets/img/fabricantes/bm.png',
      logoAlt: 'Logo BM Brother Medical',
      corpTitle: 'Quién es BM (perfil de producto)',
      corpBody:
        'Shanghai Brother Medical Manufacturer desarrolla equipos durables de cuidado: sillones, camas y soluciones de movilidad/rehabilitación. En I-ME priorizamos la serie BME de sillones reclinables publicada para entornos institucionales.',
      advantagesTitle: 'Ventajas para hospitalización y enfermería',
      advantages: [
        'Reclinación pensada en acompañante y periodos largos',
        'Serie BME con variantes según espacio y presupuesto',
        'Encaje en proyectos de confort sin mezclar “mueble de casa”',
        'Asesoría I-ME por lote de habitaciones o salas de terapia',
      ],
    },
    problemTitle: 'Cuando el acompañante improvisa sillas de oficina',
    problemBody:
      'Fatiga, posturas inseguras, quejas de familias y mobiliario que no resiste uso 24/7 de piso hospitalario.',
    solutionsTitle: 'Cómo BM + I-ME responden',
    solutions: [
      {
        pain: 'Habitaciones sin sillón adecuado',
        help: 'Orientamos BME002 / BME006 / BME007 según espacio libre y política de acompañante.',
      },
      {
        pain: 'Salas de terapia / espera clínica',
        help: 'Definimos cantidad y modelo único para mantenimiento simple.',
      },
      {
        pain: 'Compra “barata” que dura poco',
        help: 'Separamos uso institucional vs. retail y dejamos alcance claro en propuesta.',
      },
    ],
    audienceYes: [
      'Hospitalización y cuidados prolongados',
      'Oncología / diálisis / espera clínica',
      'Compras de mobiliario de confort',
    ],
    audienceNo: [
      'Muebles domésticos retail',
      'Pacientes particulares',
      'Contacto directo al fabricante',
    ],
    situations: [
      { title: 'Apertura de piso', body: 'Estandarizar sillón de acompañante.' },
      { title: 'Renovación', body: 'Reemplazar sillas improvisadas.' },
      { title: 'Lote', body: 'Volumen por habitaciones.' },
    ],
    scopeTitle: 'Alcance I-ME',
    scope: [
      'Servicio y cantidad',
      'Referencias BME',
      'Propuesta por lote',
      'Criterios de uso institucional',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Institución y ciudad', 'Cantidad aproximada', 'Horizonte'],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿BM es lo mismo que Saikang?',
        a: 'No. BM (Brother Medical) aporta la línea de sillones BME; Saikang cubre principalmente camillas/carros. I-ME orienta según el problema de piso.',
      },
      {
        q: '¿Hay más de tres modelos?',
        a: 'En catálogo publicamos BME002, BME006, BME007 y referencias afines (p. ej. SKE942). Confirmamos stock en cotización.',
      },
    ],
    projectOptions: [
      { value: 'hospitalizacion', label: 'Hospitalización' },
      { value: 'terapia', label: 'Terapia / espera clínica' },
      { value: 'lote', label: 'Lote institucional' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: ['bme002', 'bme006', 'bme007', 'ske942'],
    productsTitle: 'Referencias BM en catálogo',
    productsNote: 'Sillones reclinables institucionales publicados.',
    catalogFilter: 'mobiliario',
  },
  en: {
    tag: 'Comfort · BM',
    title: 'BM (BME) recliner chairs for inpatient care | I-ME Colombia',
    description:
      'Companion and patient without a safe posture? BM BME recliner chairs with I-ME advisory for clinical comfort furniture.',
    h1: 'Companion rest is not an “extra” — it is floor safety',
    lead: 'BM (Shanghai Brother Medical) builds care and mobility furniture. In the I-ME catalog: BME002 / BME006 / BME007 recliners for inpatient and clinical waiting zones.',
    formIntro: 'Inpatient, oncology, dialysis, waiting? Share quantity and timeline.',
    primaryCta: 'Guide clinical recliners',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse furniture catalog',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Hospital comfort area — I-ME Colombia',
    manufacturer: {
      name: 'BM (Brother Medical)',
      logo: '/assets/img/fabricantes/bm.png',
      logoAlt: 'BM Brother Medical logo',
      corpTitle: 'Who is BM (product profile)',
      corpBody:
        'Shanghai Brother Medical Manufacturer develops durable care equipment: chairs, beds and mobility/rehab solutions. At I-ME we prioritize the published BME recliner series for institutional settings.',
      advantagesTitle: 'Advantages for inpatient and nursing',
      advantages: [
        'Recline designed for companions and long stays',
        'BME series variants by space and budget',
        'Fits comfort projects without mixing “home furniture”',
        'I-ME advisory by room lot or therapy halls',
      ],
    },
    problemTitle: 'When companions improvise office chairs',
    problemBody:
      'Fatigue, unsafe postures, family complaints, and furniture that cannot survive 24/7 ward use.',
    solutionsTitle: 'How BM + I-ME respond',
    solutions: [
      {
        pain: 'Rooms without a proper recliner',
        help: 'We guide BME002 / BME006 / BME007 by free space and companion policy.',
      },
      {
        pain: 'Therapy / clinical waiting rooms',
        help: 'We set quantity and one model for simple maintenance.',
      },
      {
        pain: '“Cheap” buy that fails early',
        help: 'We separate institutional vs retail use and leave clear proposal scope.',
      },
    ],
    audienceYes: [
      'Inpatient and long-term care',
      'Oncology / dialysis / clinical waiting',
      'Comfort furniture purchasing',
    ],
    audienceNo: ['Retail home furniture', 'Individual patients', 'Direct manufacturer outreach'],
    situations: [
      { title: 'New ward', body: 'Standardize companion recliner.' },
      { title: 'Renewal', body: 'Replace improvised chairs.' },
      { title: 'Lot', body: 'Volume by rooms.' },
    ],
    scopeTitle: 'I-ME scope',
    scope: ['Service and quantity', 'BME references', 'Lot proposal', 'Institutional-use criteria'],
    requirementsTitle: 'Minimums',
    requirements: ['Institution and city', 'Approximate quantity', 'Horizon'],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Is BM the same as Saikang?',
        a: 'No. BM (Brother Medical) brings the BME recliner line; Saikang mainly covers stretchers/trolleys. I-ME guides by floor problem.',
      },
      {
        q: 'Are there more than three models?',
        a: 'Catalog publishes BME002, BME006, BME007 and related items (e.g. SKE942). Stock confirmed in quotation.',
      },
    ],
    projectOptions: [
      { value: 'hospitalizacion', label: 'Inpatient' },
      { value: 'terapia', label: 'Therapy / clinical waiting' },
      { value: 'lote', label: 'Institutional lot' },
      { value: 'orientacion', label: 'Guidance' },
    ],
    productSlugs: ['bme002', 'bme006', 'bme007', 'ske942'],
    productsTitle: 'BM catalog references',
    productsNote: 'Published institutional recliners.',
    catalogFilter: 'mobiliario',
  },
};

const ADVANCED: Record<Locale, FabCopy> = {
  es: {
    tag: 'Ultrasonido · Advanced',
    title: 'Ecógrafos Advanced DUS para diagnóstico | Asesoría I-ME Colombia',
    description:
      '¿Ultrasonido general o versátil para varios servicios? Sistemas DUS-3000 a DUS-7000 (línea Advanced en catálogo I-ME) con orientación de proyecto.',
    h1: 'El ecógrafo correcto es el que el servicio realmente va a usar',
    lead: 'La línea Advanced DUS del catálogo I-ME cubre ultrasonido desde sistemas versátiles hasta plataformas de mayor capacidad. Le ayudamos a elegir por servicio (urgencia, gineco, general) sin inflar el CapEx.',
    formIntro: '¿Urgencias, GGO, consulta, cardiología básica? Cuéntenos aplicaciones y plazo.',
    primaryCta: 'Orientar ultrasonido',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver ultrasonido en catálogo',
    heroImage: '/assets/img/sala-radiologia-diagnostica.webp',
    heroImageAlt: 'Sala de diagnóstico por imagen — I-ME Colombia',
    manufacturer: {
      name: 'Advanced',
      logo: '/assets/img/fabricantes/advanced.png',
      logoAlt: 'Logo Advanced',
      corpTitle: 'Línea Advanced en catálogo I-ME (perfil de producto)',
      corpBody:
        '“Advanced” agrupa en el catálogo I-ME sistemas de ultrasonido de la serie DUS (3000–7000) para diagnóstico clínico. La selección se hace por aplicaciones, transductores y flujo de pacientes — no por el nombre más alto de la serie.',
      advantagesTitle: 'Ventajas para radiología, GGO y urgencias',
      advantages: [
        'Escalera de modelos DUS según complejidad de examen',
        'Enfoque multipropósito para instituciones que comparten equipo entre servicios',
        'Ruta de crecimiento (empezar versátil, escalar después)',
        'Asesoría I-ME con aplicaciones reales del servicio',
      ],
    },
    problemTitle: 'Comprar “el más potente” y que quede subutilizado',
    problemBody:
      'Presupuesto gastado en funciones que nadie usa, faltan transductores clave, o el equipo no cabe en el flujo de urgencias.',
    solutionsTitle: 'Cómo Advanced + I-ME eligen con cabeza',
    solutions: [
      {
        pain: 'Necesitan ultrasonido versátil de entrada',
        help: 'Orientamos DUS-3000 / 5000 según volumen y aplicaciones básicas.',
      },
      {
        pain: 'Requieren más capacidad diagnóstica',
        help: 'Comparamos DUS-5000 Plus, 6000 y 7000 por tipo de examen — con honestidad de alcance.',
      },
      {
        pain: 'Varios servicios pelean el mismo equipo',
        help: 'Diseñamos propuesta de uso compartido o segundo equipo por cuello de botella.',
      },
    ],
    audienceYes: [
      'Imagen diagnóstica y GGO',
      'Urgencias con eco point-of-care institucional',
      'Compras e ingeniería con proyecto de ultrasonido',
    ],
    audienceNo: ['Uso doméstico', 'Pacientes', 'Pedidos sin institución'],
    situations: [
      { title: 'Primera compra', body: 'Modelo versátil que el personal sí opere.' },
      { title: 'Upgrade', body: 'Pasar de equipo básico a mayor capacidad.' },
      { title: 'Segundo equipo', body: 'Destrabar agenda entre servicios.' },
    ],
    scopeTitle: 'Alcance I-ME',
    scope: [
      'Aplicaciones clínicas prioritarias',
      'Referencias DUS publicadas',
      'Transductores / alcance de propuesta',
      'Capacitación básica acordada',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Institución y ciudad', 'Aplicaciones clave', 'Horizonte'],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿Advanced es una marca global única?',
        a: 'En I-ME “Advanced” identifica la línea DUS publicada en catálogo. Trabajamos con fichas de esos modelos y soporte local I-ME.',
      },
      {
        q: '¿Qué modelos DUS hay?',
        a: 'DUS-3000, 5000, 5000 Plus, 6000 y 7000, entre referencias de ultrasonido.',
      },
    ],
    projectOptions: [
      { value: 'general', label: 'Ultrasonido general / versátil' },
      { value: 'ggo', label: 'GGO / obstetricia' },
      { value: 'urgencias', label: 'Urgencias' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: ['dus-3000', 'dus-5000', 'dus-5000-plus', 'dus-6000', 'dus-7000'],
    productsTitle: 'Referencias Advanced DUS en catálogo',
    productsNote: 'Modelos reales. Transductores y configuración se confirman en cotización.',
    catalogFilter: 'ultrasonido',
  },
  en: {
    tag: 'Ultrasound · Advanced',
    title: 'Advanced DUS ultrasound systems for diagnosis | I-ME Colombia advisory',
    description:
      'General or multi-service ultrasound? DUS-3000 to DUS-7000 systems (Advanced line in I-ME catalog) with project guidance.',
    h1: 'The right ultrasound is the one your service will actually use',
    lead: 'The Advanced DUS line in the I-ME catalog covers ultrasound from versatile systems to higher-capacity platforms. We help choose by service (ED, OB-GYN, general) without inflating CapEx.',
    formIntro: 'ED, OB-GYN, clinic, basic cardiology? Share applications and timeline.',
    primaryCta: 'Guide ultrasound',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse ultrasound catalog',
    heroImage: '/assets/img/sala-radiologia-diagnostica.webp',
    heroImageAlt: 'Diagnostic imaging room — I-ME Colombia',
    manufacturer: {
      name: 'Advanced',
      logo: '/assets/img/fabricantes/advanced.png',
      logoAlt: 'Advanced logo',
      corpTitle: 'Advanced line in I-ME catalog (product profile)',
      corpBody:
        '“Advanced” groups the DUS ultrasound series (3000–7000) in the I-ME catalog for clinical diagnosis. Selection is by applications, transducers and patient flow — not the highest series name.',
      advantagesTitle: 'Advantages for radiology, OB-GYN and ED',
      advantages: [
        'DUS model ladder by exam complexity',
        'Multipurpose focus for institutions sharing devices across services',
        'Growth path (start versatile, scale later)',
        'I-ME advisory with real service applications',
      ],
    },
    problemTitle: 'Buying “the most powerful” and leaving it underused',
    problemBody:
      'Budget spent on unused features, missing key transducers, or a system that does not fit ED flow.',
    solutionsTitle: 'How Advanced + I-ME choose wisely',
    solutions: [
      {
        pain: 'Need entry versatile ultrasound',
        help: 'We guide DUS-3000 / 5000 by volume and basic applications.',
      },
      {
        pain: 'Need more diagnostic capacity',
        help: 'We compare DUS-5000 Plus, 6000 and 7000 by exam type — with honest scope.',
      },
      {
        pain: 'Several services fight over one device',
        help: 'We design shared-use or second-unit proposals around the bottleneck.',
      },
    ],
    audienceYes: [
      'Diagnostic imaging and OB-GYN',
      'ED with institutional point-of-care ultrasound',
      'Purchasing and engineering with an ultrasound project',
    ],
    audienceNo: ['Home use', 'Patients', 'Requests without an institution'],
    situations: [
      { title: 'First purchase', body: 'A versatile model staff will operate.' },
      { title: 'Upgrade', body: 'Move from basic to higher capacity.' },
      { title: 'Second unit', body: 'Unlock scheduling across services.' },
    ],
    scopeTitle: 'I-ME scope',
    scope: [
      'Priority clinical applications',
      'Published DUS references',
      'Transducers / proposal scope',
      'Agreed basic training',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Institution and city', 'Key applications', 'Horizon'],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Is Advanced a single global brand?',
        a: 'At I-ME, “Advanced” identifies the published DUS line. We work from those model sheets with local I-ME support.',
      },
      {
        q: 'Which DUS models are listed?',
        a: 'DUS-3000, 5000, 5000 Plus, 6000 and 7000, among ultrasound references.',
      },
    ],
    projectOptions: [
      { value: 'general', label: 'General / versatile ultrasound' },
      { value: 'ggo', label: 'OB-GYN' },
      { value: 'urgencias', label: 'Emergency' },
      { value: 'orientacion', label: 'Guidance' },
    ],
    productSlugs: ['dus-3000', 'dus-5000', 'dus-5000-plus', 'dus-6000', 'dus-7000'],
    productsTitle: 'Advanced DUS catalog references',
    productsNote: 'Real models. Transducers and configuration confirmed in quotation.',
    catalogFilter: 'ultrasonido',
  },
};

const M_LINE: Record<Locale, FabCopy> = {
  es: {
    tag: 'Infusión · M',
    title: 'Bombas de infusión M (VP-50 / IP-200) | Asesoría I-ME Colombia',
    description:
      '¿Terapia IV sin control de flujo confiable? Bombas de infusión VP-50 e IP-200 (línea M en catálogo I-ME) con orientación para UCI y hospitalización.',
    h1: 'La infusión no perdona: precisión de flujo o riesgo operativo',
    lead: 'La línea M del catálogo I-ME cubre bombas de infusión volumétricas para terapia IV institucional. Le ayudamos a dimensionar flota VP-50 / IP-200 según camas y protocolos.',
    formIntro: '¿UCI, hospitalización, oncología? Indique número de bombas estimado y plazo.',
    primaryCta: 'Orientar bombas de infusión',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver terapia IV en catálogo',
    heroImage: '/assets/img/equipos-biomedicos-vanguardia.webp',
    heroImageAlt: 'Equipos de terapia de infusión — I-ME Colombia',
    manufacturer: {
      name: 'M',
      logo: '/assets/img/fabricantes/m.svg',
      logoAlt: 'Marca M — línea de infusión',
      corpTitle: 'Línea M en catálogo I-ME (perfil de producto)',
      corpBody:
        'La denominación comercial “M” identifica en el catálogo I-ME bombas de infusión institucionales (VP-50, IP-200 y referencias afines). El foco es control de flujo para terapia IV en entornos clínicos — con soporte de implementación I-ME.',
      advantagesTitle: 'Ventajas para UCI, enfermería y biomédicos',
      advantages: [
        'Referencias volumétricas para terapia IV continua',
        'Escalabilidad por número de camas / protocolos',
        'Conversación de flota (no compra unitaria aislada)',
        'Asesoría I-ME en puesta en marcha y uso institucional',
      ],
    },
    problemTitle: 'Cuando la terapia IV depende de goteo “a ojo”',
    problemBody:
      'Errores de ritmo, enfermería saturada recalculando, flotas mixtas imposibles de capacitar y compras de urgencia sin estándar.',
    solutionsTitle: 'Cómo la línea M + I-ME responden',
    solutions: [
      {
        pain: 'UCI necesita bombas confiables',
        help: 'Orientamos VP-50 / IP-200 según tipo de terapia y densidad de camas.',
      },
      {
        pain: 'Flota heterogénea',
        help: 'Proponemos estandarizar modelo para capacitación y repuestos.',
      },
      {
        pain: 'Expansión de camas',
        help: 'Dimensionamos lote por fases de apertura.',
      },
    ],
    audienceYes: [
      'UCI y hospitalización',
      'Oncología / terapias IV',
      'Ingeniería biomédica con proyecto de flota',
    ],
    audienceNo: ['Uso doméstico', 'Pacientes', 'Pedidos sin institución'],
    situations: [
      { title: 'Nueva UCI', body: 'Flota desde el protocolo de infusión.' },
      { title: 'Estandarizar', body: 'Un modelo, una capacitación.' },
      { title: 'Ampliación', body: 'Lote por fases de camas.' },
    ],
    scopeTitle: 'Alcance I-ME',
    scope: [
      'Servicio y densidad de terapia IV',
      'Referencias M publicadas',
      'Cantidad y propuesta',
      'Capacitación acordada',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Institución y ciudad', 'Servicio', 'Cantidad estimada / horizonte'],
    ...SHARED_PROCESS_ES,
    faqs: [
      {
        q: '¿Qué bombas M hay en catálogo?',
        a: 'VP-50, IP-200 y referencias afines de terapia de infusión publicadas por I-ME.',
      },
      {
        q: '¿Incluyen sets consumibles?',
        a: 'Los consumibles se cotizan aparte según política del proyecto. Lo dejamos explícito en propuesta.',
      },
    ],
    projectOptions: [
      { value: 'uci', label: 'UCI' },
      { value: 'hospitalizacion', label: 'Hospitalización' },
      { value: 'flota', label: 'Estandarizar flota' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: ['vp-50', 'ip-200', 'bomba-de-infusion-volumetrica-uci'],
    productsTitle: 'Referencias M en catálogo',
    productsNote: 'Bombas institucionales publicadas. Configuración en cotización.',
    catalogFilter: 'soluciones-iv',
  },
  en: {
    tag: 'Infusion · M',
    title: 'M infusion pumps (VP-50 / IP-200) | I-ME Colombia advisory',
    description:
      'IV therapy without reliable flow control? VP-50 and IP-200 infusion pumps (M line in I-ME catalog) with guidance for ICU and wards.',
    h1: 'Infusion does not forgive: flow precision or operational risk',
    lead: 'The M line in the I-ME catalog covers volumetric infusion pumps for institutional IV therapy. We help size VP-50 / IP-200 fleets by beds and protocols.',
    formIntro: 'ICU, ward, oncology? Share estimated pump count and timeline.',
    primaryCta: 'Guide infusion pumps',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse IV therapy catalog',
    heroImage: '/assets/img/equipos-biomedicos-vanguardia.webp',
    heroImageAlt: 'Infusion therapy equipment — I-ME Colombia',
    manufacturer: {
      name: 'M',
      logo: '/assets/img/fabricantes/m.svg',
      logoAlt: 'M brand — infusion line',
      corpTitle: 'M line in I-ME catalog (product profile)',
      corpBody:
        'The commercial name “M” identifies institutional infusion pumps in the I-ME catalog (VP-50, IP-200 and related references). Focus is flow control for clinical IV therapy — with I-ME implementation support.',
      advantagesTitle: 'Advantages for ICU, nursing and biomed',
      advantages: [
        'Volumetric references for continuous IV therapy',
        'Scalability by bed count / protocols',
        'Fleet conversation (not one-off unit buys)',
        'I-ME advisory on commissioning and institutional use',
      ],
    },
    problemTitle: 'When IV therapy depends on “eyeball” drip rates',
    problemBody:
      'Rate errors, nursing recalculating under load, mixed fleets impossible to train, and emergency buys without a standard.',
    solutionsTitle: 'How the M line + I-ME respond',
    solutions: [
      {
        pain: 'ICU needs reliable pumps',
        help: 'We guide VP-50 / IP-200 by therapy type and bed density.',
      },
      {
        pain: 'Heterogeneous fleet',
        help: 'We propose standardizing one model for training and parts.',
      },
      {
        pain: 'Bed expansion',
        help: 'We size lots by opening phases.',
      },
    ],
    audienceYes: [
      'ICU and inpatient wards',
      'Oncology / IV therapies',
      'Biomed with a fleet project',
    ],
    audienceNo: ['Home use', 'Patients', 'Requests without an institution'],
    situations: [
      { title: 'New ICU', body: 'Fleet from the infusion protocol.' },
      { title: 'Standardize', body: 'One model, one training.' },
      { title: 'Expansion', body: 'Lots by bed phases.' },
    ],
    scopeTitle: 'I-ME scope',
    scope: [
      'Service and IV therapy density',
      'Published M references',
      'Quantity and proposal',
      'Agreed training',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Institution and city', 'Service', 'Estimated quantity / horizon'],
    ...SHARED_PROCESS_EN,
    faqs: [
      {
        q: 'Which M pumps are in catalog?',
        a: 'VP-50, IP-200 and related infusion-therapy references published by I-ME.',
      },
      {
        q: 'Are consumable sets included?',
        a: 'Consumables are quoted separately per project policy. We state it explicitly in the proposal.',
      },
    ],
    projectOptions: [
      { value: 'uci', label: 'ICU' },
      { value: 'hospitalizacion', label: 'Inpatient' },
      { value: 'flota', label: 'Standardize fleet' },
      { value: 'orientacion', label: 'Guidance' },
    ],
    productSlugs: ['vp-50', 'ip-200', 'bomba-de-infusion-volumetrica-uci'],
    productsTitle: 'M catalog references',
    productsNote: 'Published institutional pumps. Configuration in quotation.',
    catalogFilter: 'soluciones-iv',
  },
};

const META: Record<FabricanteLandingId, FabMeta> = {
  fab_tuttnauer: {
    id: 'fab_tuttnauer',
    slug: 'tuttnauer',
    slugEn: 'tuttnauer',
    familia_slug: 'esterilizacion-control-infecciones',
    tipo_slug: 'tuttnauer',
  },
  fab_saikang: {
    id: 'fab_saikang',
    slug: 'saikang',
    slugEn: 'saikang',
    familia_slug: 'mobiliario',
    tipo_slug: 'saikang',
  },
  fab_angell: {
    id: 'fab_angell',
    slug: 'angell-technology',
    slugEn: 'angell-technology',
    familia_slug: 'radiologia',
    tipo_slug: 'angell-technology',
  },
  fab_northern: {
    id: 'fab_northern',
    slug: 'northern-meditec',
    slugEn: 'northern-meditec',
    familia_slug: 'monitores',
    tipo_slug: 'northern-meditec',
  },
  fab_ilumitec: {
    id: 'fab_ilumitec',
    slug: 'ilumitec',
    slugEn: 'ilumitec',
    familia_slug: 'sala-cirugia',
    tipo_slug: 'ilumitec',
  },
  fab_perlong: {
    id: 'fab_perlong',
    slug: 'perlong',
    slugEn: 'perlong',
    familia_slug: 'diagnostico-clinico-basico',
    tipo_slug: 'perlong',
  },
  fab_bm: {
    id: 'fab_bm',
    slug: 'bm',
    slugEn: 'bm',
    familia_slug: 'mobiliario',
    tipo_slug: 'bm',
  },
  fab_advanced: {
    id: 'fab_advanced',
    slug: 'advanced',
    slugEn: 'advanced',
    familia_slug: 'ultrasonido',
    tipo_slug: 'advanced',
  },
  fab_m: {
    id: 'fab_m',
    slug: 'm',
    slugEn: 'm',
    familia_slug: 'soluciones-iv',
    tipo_slug: 'm',
  },
};

const BY_ID: Record<FabricanteLandingId, Record<Locale, FabCopy>> = {
  fab_tuttnauer: TUTTNAUER,
  fab_saikang: SAIKANG,
  fab_angell: ANGELL,
  fab_northern: NORTHERN,
  fab_ilumitec: ILUMITEC,
  fab_perlong: PERLONG,
  fab_bm: BM,
  fab_advanced: ADVANCED,
  fab_m: M_LINE,
};

const SLUG_TO_ID = new Map<string, FabricanteLandingId>();
for (const meta of Object.values(META)) {
  SLUG_TO_ID.set(meta.slug, meta.id);
  SLUG_TO_ID.set(meta.slugEn, meta.id);
}

export function getFabricanteLandingIdBySlug(slug: string): FabricanteLandingId | null {
  return SLUG_TO_ID.get(slug) ?? null;
}

export function listFabricanteSlugs(): string[] {
  return Object.values(META).map(m => m.slug);
}

export function getFabricanteLanding(
  id: FabricanteLandingId,
  locale: Locale
): CampaignLandingContent {
  const meta = META[id];
  const copy = BY_ID[id][locale];
  const path = `/es/fabricantes/${meta.slug}/`;
  const pathEn = `/en/manufacturers/${meta.slugEn}/`;
  return {
    id,
    familia_slug: meta.familia_slug,
    tipo_slug: meta.tipo_slug,
    path,
    pathEn,
    hubPath: locale === 'en' ? '/en/manufacturers/' : '/es/fabricantes/',
    hubLabel: locale === 'en' ? 'Manufacturers' : 'Fabricantes',
    ...copy,
  };
}

export function listFabricanteLandings(locale: Locale): CampaignLandingContent[] {
  return (Object.keys(BY_ID) as FabricanteLandingId[]).map(id => getFabricanteLanding(id, locale));
}
