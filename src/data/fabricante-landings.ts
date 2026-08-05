/**
 * Landings por fabricante — tipologías de producto + problemas del sector (SEO).
 * Sin fotos de fabricante, sin listado de productos, sin datos de contacto del fabricante.
 * Canal de asesoría: solo I-ME.
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

const TUTTNAUER: Record<Locale, FabCopy> = {
  es: {
    tag: 'Esterilización · Tuttnauer',
    title: 'Esterilización hospitalaria y tipologías CSSD | Asesoría I-ME Colombia',
    description:
      '¿Cuello de botella en central de esterilización? Tipologías de autoclave, baja temperatura y lavado: problemas reales de CSSD y quirófano. Orientación I-ME Colombia.',
    h1: 'Cuando la central no puede esperar al ciclo siguiente',
    lead: 'Tuttnauer se especializa en control de infecciones. Aquí no listamos equipos: explicamos tipologías de esterilización que el sector pregunta cada semana y cómo aterrizarlas a su carga real con I-ME.',
    formIntro:
      'Cuéntenos volumen de carga, tipo de instrumental y plazo. Un asesor responde en lenguaje de CSSD.',
    primaryCta: 'Orientar mi proyecto de esterilización',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia esterilización',
    heroImage: '/assets/img/esterilizacion-central-hospitalaria-colombia.webp',
    heroImageAlt: 'Central de esterilización hospitalaria — tipologías CSSD I-ME Colombia',
    brandName: 'Tuttnauer',
    brandProfileTitle: 'Especialidad: control de infecciones y esterilización',
    brandProfileBody:
      'Fabricante con foco centenario en autoclaves, esterilización de baja temperatura y lavado-desinfección. En esta página hablamos de tipologías y problemas de institución — no de fichas ni fotos de producto. I-ME es el canal de asesoría en Colombia.',
    typologiesTitle: 'Tipologías que suelen definir un proyecto CSSD',
    typologiesIntro:
      'Cada tipología responde a una pregunta distinta de biomédica, jefe de central o compras. Elija el lenguaje correcto antes de pedir cotización.',
    typologies: [
      {
        name: 'Autoclaves de vapor (cámara hospitalaria)',
        body: 'Esterilización por vapor saturado para instrumental termorresistente. La decisión institucional suele girar en torno a volumen de cámara, tipo de ciclo, utilidades (agua, vapor, drenaje) y trazabilidad — no al “modelo más grande del brochure”.',
        problems: [
          '¿La cámara satura en pico quirúrgico?',
          '¿Qué capacidad real necesito por turno, no por marketing?',
          '¿Cómo documento ciclos ante auditoría sin improvisar?',
          '¿Qué utilidades debe dejar lista ingeniería antes de instalar?',
        ],
      },
      {
        name: 'Autoclaves de mesa / clínica',
        body: 'Unidades compactas para consulta, odontología o volúmenes bajos. Útiles cuando el cuello de botella no es quirófano de alta carga, sino disponibilidad local y rotación corta.',
        problems: [
          '¿Mesa o hospitalario: dónde corta el volumen?',
          '¿Quién opera y valida el ciclo día a día?',
          '¿Espacio, toma eléctrica y ventilación del cuarto?',
        ],
      },
      {
        name: 'Esterilización de baja temperatura',
        body: 'Para materiales termosensibles donde el vapor no aplica. El sector pregunta por compatibilidad de carga, tiempos y evidencia documental — sin confundir tipología con “solución mágica”.',
        problems: [
          '¿Qué cargas no toleran vapor?',
          '¿Cómo convive con la línea de vapor en la misma central?',
          '¿Qué alcance documental pide calidad/INVIMA en sitio?',
        ],
      },
      {
        name: 'Lavadoras-desinfectadoras',
        body: 'Preparan el flujo de limpieza antes de esterilizar. Sin lavado consistente, el autoclave no “arregla” residual ni reproceso. Tipología clave en rediseño de central.',
        problems: [
          '¿El cuello de botella es lavado o esterilización?',
          '¿Flujo sucio/limpio y ergonomía del personal?',
          '¿Cómo dimensionar sin duplicar equipos innecesarios?',
        ],
      },
    ],
    problemTitle: 'Lo que pregunta el sector en esterilización',
    problemBody:
      'No buscan “un autoclave bonito”. Buscan liberar instrumental a tiempo, reducir reprocesos, evidenciar ciclos y no dejar quirófano esperando porque la tipología quedó mal dimensionada o las utilidades incompletas.',
    solutionsTitle: 'Cómo I-ME aterriza la tipología a su realidad',
    solutions: [
      {
        pain: 'Confunden tipología con marca o con “el más grande”',
        help: 'Separar vapor hospitalario, mesa, baja temperatura y lavado según carga, instrumental y turnos — antes de hablar referencias.',
      },
      {
        pain: 'Temen quedar solos tras la puesta en marcha',
        help: 'Acordar alcance de instalación, capacitación y soporte I-ME para que la central no improvise.',
      },
      {
        pain: 'Auditoría pide evidencia y no hay narrativa clara',
        help: 'Orientar qué documenta la tipología y qué debe operar la institución día a día — sin inventar certificaciones.',
      },
    ],
    audienceYes: [
      'CSSD / centrales en ampliación o renovación',
      'IPS con quirófano que satura ciclos',
      'Biomédica y compras con CapEx real',
    ],
    audienceNo: [
      'Pacientes o particulares',
      'Pedidos de repuesto sin institución',
      'Contacto directo al fabricante',
    ],
    situations: [
      {
        title: 'Apertura de central',
        body: 'Definir tipologías, utilidades y flujo antes de comprar capacidad “por si acaso”.',
      },
      {
        title: 'Reemplazo por obsolescencia',
        body: 'Migrar sin frenar quirófano: tipología de transición y plan B de carga.',
      },
      {
        title: 'Pico quirúrgico',
        body: 'Cuando el dolor es tiempo de ciclo y cuello de botella, no falta de voluntad.',
      },
    ],
    scopeTitle: 'Qué incluye la conversación',
    scope: [
      'Lectura de carga e instrumental',
      'Criterios por tipología (no catálogo infinito)',
      'Alcance de instalación y capacitación',
      'Propuesta formal cuando el proyecto madura',
    ],
    requirementsTitle: 'Para no perder tiempo',
    requirements: [
      'Institución, ciudad y servicio (CSSD / quirófano)',
      'Horizonte de compra',
      'Cuello de botella en una frase',
    ],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no muestran productos Tuttnauer aquí?',
        a: 'Porque esta landing educa tipologías y problemas de sector. Las referencias se discuten en asesoría cuando hay contexto de carga — no como vitrina.',
      },
      {
        q: '¿Qué tipología conviene si el quirófano espera instrumental?',
        a: 'Casi siempre hay que mirar vapor hospitalario vs lavado vs flujo; a veces el cuello no es el autoclave. Lo diagnosticamos con su volumen real.',
      },
      {
        q: '¿I-ME inventa claims clínicos?',
        a: 'No. Tipología + ficha aplicable + alcance acordado. Sin promesas de resultado clínico.',
      },
      {
        q: '¿Puedo contactar al fabricante?',
        a: 'No desde esta página. El canal de asesoría y cotización en Colombia es I-ME.',
      },
    ],
    projectOptions: [
      { value: 'nueva_central', label: 'Nueva central / ampliación' },
      { value: 'reemplazo', label: 'Reemplazo de tipología' },
      { value: 'pico_quirurgico', label: 'Cuello de botella en quirófano' },
      { value: 'orientacion', label: 'Solo orientación técnica' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'esterilizacion-control-infecciones',
  },
  en: {
    tag: 'Sterilization · Tuttnauer',
    title: 'Hospital sterilization & CSSD typologies | I-ME Colombia advisory',
    description:
      'CSSD bottleneck? Autoclave, low-temp and washer typologies: real OR/sterile-processing questions. I-ME Colombia guidance — no product gallery.',
    h1: 'When CSSD cannot wait for the next cycle',
    lead: 'Tuttnauer focuses on infection control. We do not list products here: we explain sterilization typologies the sector asks about weekly and how I-ME lands them on your real load.',
    formIntro:
      'Share load volume, instrument mix and timeline. An advisor replies in CSSD language.',
    primaryCta: 'Guide my sterilization project',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse sterilization family',
    heroImage: '/assets/img/esterilizacion-central-hospitalaria-colombia.webp',
    heroImageAlt: 'Hospital sterile processing — CSSD typologies I-ME Colombia',
    brandName: 'Tuttnauer',
    brandProfileTitle: 'Specialty: infection control and sterilization',
    brandProfileBody:
      'Manufacturer focused on autoclaves, low-temperature sterilization and washer-disinfectors. This page covers typologies and institutional problems — not product sheets or photos. I-ME is the advisory channel in Colombia.',
    typologiesTitle: 'Typologies that usually define a CSSD project',
    typologiesIntro:
      'Each typology answers a different biomed, CSSD lead or purchasing question. Pick the right language before requesting a quote.',
    typologies: [
      {
        name: 'Steam autoclaves (hospital chamber)',
        body: 'Saturated-steam sterilization for heat-resistant instruments. Institutional decisions turn on chamber volume, cycle type, utilities and traceability — not the biggest brochure.',
        problems: [
          'Does the chamber saturate at OR peak?',
          'What real capacity do I need per shift?',
          'How do I document cycles for audits?',
          'Which utilities must engineering prepare first?',
        ],
      },
      {
        name: 'Tabletop / clinic autoclaves',
        body: 'Compact units for clinic, dental or low volumes. Useful when the bottleneck is local availability, not high-load OR throughput.',
        problems: [
          'Tabletop vs hospital: where does volume cut?',
          'Who runs and validates cycles daily?',
          'Space, power and room ventilation?',
        ],
      },
      {
        name: 'Low-temperature sterilization',
        body: 'For heat-sensitive materials where steam does not apply. Sector asks about load compatibility, times and documentation — without confusing typology for a magic fix.',
        problems: [
          'Which loads cannot take steam?',
          'How does it coexist with steam lines?',
          'What documentation does quality expect on site?',
        ],
      },
      {
        name: 'Washer-disinfectors',
        body: 'Prepare cleaning flow before sterilization. Without consistent wash, the autoclave will not fix residue or rework. Key typology in CSSD redesign.',
        problems: [
          'Is the bottleneck wash or sterilization?',
          'Dirty/clean flow and staff ergonomics?',
          'How to size without duplicating gear?',
        ],
      },
    ],
    problemTitle: 'What the sector asks about sterilization',
    problemBody:
      'They do not want a pretty autoclave. They want instruments released on time, fewer reworks, documented cycles and an OR that is not waiting on an undersized typology or incomplete utilities.',
    solutionsTitle: 'How I-ME lands typology on your reality',
    solutions: [
      {
        pain: 'Typology confused with brand or “biggest unit”',
        help: 'Separate hospital steam, tabletop, low-temp and wash by load, instruments and shifts — before SKUs.',
      },
      {
        pain: 'Fear of being alone after commissioning',
        help: 'Agree install, training and I-ME support so CSSD is not improvising.',
      },
      {
        pain: 'Audit asks for evidence without a clear narrative',
        help: 'Guide what the typology documents vs what the institution must operate daily — no invented certifications.',
      },
    ],
    audienceYes: [
      'CSSD expanding or renewing',
      'IPS with OR cycle saturation',
      'Biomed and purchasing with real CapEx',
    ],
    audienceNo: [
      'Patients or individuals',
      'Spare-part requests without an institution',
      'Direct manufacturer contact',
    ],
    situations: [
      {
        title: 'New CSSD',
        body: 'Define typologies, utilities and flow before buying capacity “just in case”.',
      },
      {
        title: 'Replacement for obsolescence',
        body: 'Migrate without freezing the OR: transition typology and load plan B.',
      },
      {
        title: 'Surgical peak',
        body: 'When pain is cycle time and bottleneck, not lack of will.',
      },
    ],
    scopeTitle: 'What the conversation covers',
    scope: [
      'Load and instrument reading',
      'Criteria by typology (not infinite catalog)',
      'Install and training scope',
      'Formal proposal when the project matures',
    ],
    requirementsTitle: 'To avoid wasted time',
    requirements: [
      'Institution, city and service (CSSD / OR)',
      'Purchase horizon',
      'Bottleneck in one sentence',
    ],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why are there no Tuttnauer products here?',
        a: 'This landing teaches typologies and sector problems. References are discussed in advisory once load context exists — not as a showcase.',
      },
      {
        q: 'Which typology if the OR waits on instruments?',
        a: 'Often steam vs wash vs flow; sometimes the autoclave is not the bottleneck. We diagnose with your real volume.',
      },
      {
        q: 'Does I-ME invent clinical claims?',
        a: 'No. Typology + applicable sheet + agreed scope. No clinical outcome promises.',
      },
      {
        q: 'Can I contact the manufacturer?',
        a: 'Not from this page. Advisory and quoting in Colombia go through I-ME.',
      },
    ],
    projectOptions: [
      { value: 'nueva_central', label: 'New CSSD / expansion' },
      { value: 'reemplazo', label: 'Typology replacement' },
      { value: 'pico_quirurgico', label: 'OR bottleneck' },
      { value: 'orientacion', label: 'Technical orientation only' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'esterilizacion-control-infecciones',
  },
};

const SAIKANG: Record<Locale, FabCopy> = {
  es: {
    tag: 'Mobiliario · Saikang',
    title: 'Mobiliario hospitalario: camas, camillas y carros | I-ME Colombia',
    description:
      'Flujo de piso trabado? Tipologías de cama hospitalaria, camilla y carro clínico: ergonomía, transferencia y densidad. Orientación I-ME sin vitrina de producto.',
    h1: 'Cuando el mobiliario frena el flujo de atención',
    lead: 'Saikang se especializa en mobiliario clínico. Aquí enriquecemos SEO con tipologías y problemas de piso, hospitalización y transporte interno — sin fotos ni listados de producto.',
    formIntro:
      'Describa servicio, densidad de camas y plazo. Respondemos en lenguaje de piso y biomédica.',
    primaryCta: 'Orientar mobiliario de mi institución',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia mobiliario',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Pasillo hospitalario — tipologías de mobiliario clínico I-ME Colombia',
    brandName: 'Saikang',
    brandProfileTitle: 'Especialidad: mobiliario hospitalario y flujo de paciente',
    brandProfileBody:
      'Fabricante orientado a camas, camillas, carros y mobiliario de apoyo. Esta página explica tipologías y dolores institucionales. Sin logos de producto ni contactos del fabricante: canal I-ME.',
    typologiesTitle: 'Tipologías de mobiliario que pregunta el sector',
    typologiesIntro:
      'Compras y enfermería no piden “una cama bonita”: piden transferencia segura, limpieza, densidad y menos lesiones del personal.',
    typologies: [
      {
        name: 'Camas hospitalarias (hospitalización / críticos)',
        body: 'Tipología base de estancia. Variables: posiciones, barandas, ruedas, facilidad de limpieza y compatibilidad con protocolos de aislamiento.',
        problems: [
          '¿Cuántas posiciones necesito realmente por servicio?',
          '¿Barandas y frenos para qué perfil de paciente?',
          '¿Cómo estandarizar flota sin mezclar tipologías incompatibles?',
          '¿Peso, colchón y limpieza ante infecciones?',
        ],
      },
      {
        name: 'Camillas de transporte y transferencia',
        body: 'Mueven pacientes entre servicios. El dolor típico es transferencia insegura, desgaste de personal y cuellos en imagen o quirófano.',
        problems: [
          '¿Camilla de trauma, recuperación o transporte general?',
          '¿Altura y laterales para transferencia a mesa/camilla fija?',
          '¿Ruedas y radio de giro en pasillos estrechos?',
        ],
      },
      {
        name: 'Carros clínicos y de apoyo',
        body: 'Medicación, curaciones, emergencia o ropa. Mal tipificados saturan pasillos o obligan viajes extra al personal.',
        problems: [
          '¿Qué flujo falla: medicación, curación o lencería?',
          '¿Cuánto espacio útil vs ruido visual en piso?',
          '¿Materiales lavables y separación limpio/sucio?',
        ],
      },
    ],
    problemTitle: 'Problemas de piso que el sector formula cada semana',
    problemBody:
      'Mobiliario mal tipificado se traduce en transferencias lentas, más esfuerzo de enfermería, habitaciones que no rotan y compras que “cierran” sin estandarizar flota.',
    solutionsTitle: 'Cómo ayudamos sin catálogo infinito',
    solutions: [
      {
        pain: 'Compran por foto y no por flujo',
        help: 'Mapear tipología a servicio (hospitalización, transporte, apoyo) antes de referencias.',
      },
      {
        pain: 'Flota mezclada imposible de mantener',
        help: 'Criterios de estandarización y repuestos por tipología con I-ME.',
      },
      {
        pain: 'Ergonomía del personal ignorada',
        help: 'Revisar transferencia, alturas y densidad real de pasillo/habitación.',
      },
    ],
    audienceYes: [
      'Hospitalización y piso clínico',
      'Ingeniería biomédica renovando flota',
      'IPS en ampliación de camas',
    ],
    audienceNo: [
      'Pacientes particulares',
      'Decoración no clínica',
      'Contacto directo al fabricante',
    ],
    situations: [
      {
        title: 'Ampliación de camas',
        body: 'Tipificar hospitalización vs críticos antes del CapEx.',
      },
      {
        title: 'Renovación por desgaste',
        body: 'Sustituir flota sin romper protocolos de limpieza.',
      },
      {
        title: 'Cuello en transporte interno',
        body: 'Cuando imagen o quirófano esperan por camilla incorrecta.',
      },
    ],
    scopeTitle: 'Alcance de la conversación',
    scope: [
      'Diagnóstico de flujo y densidad',
      'Criterios por tipología de mobiliario',
      'Estandarización de flota',
      'Propuesta cuando hay presupuesto',
    ],
    requirementsTitle: 'Datos mínimos',
    requirements: [
      'Servicio y ciudad',
      'Número aproximado de unidades o camas',
      'Horizonte de compra',
    ],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no hay fotos de camas Saikang?',
        a: 'Priorizamos tipología y problemas de sector. Las referencias se evalúan en asesoría con contexto de sitio.',
      },
      {
        q: '¿Cama o camilla para mi cuello de botella?',
        a: 'Depende si el dolor es estancia o transporte. Lo separamos en la primera llamada.',
      },
      {
        q: '¿Financiación institucional?',
        a: 'Orientativa según proyecto; condiciones en propuesta formal I-ME.',
      },
    ],
    projectOptions: [
      { value: 'ampliacion_camas', label: 'Ampliación de camas' },
      { value: 'renovacion_flota', label: 'Renovación de flota' },
      { value: 'transporte', label: 'Transporte / camillas' },
      { value: 'orientacion', label: 'Solo orientación' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'mobiliario',
  },
  en: {
    tag: 'Furniture · Saikang',
    title: 'Hospital furniture: beds, stretchers and carts | I-ME Colombia',
    description:
      'Floor flow stuck? Hospital bed, stretcher and clinical cart typologies: ergonomics, transfer and density. I-ME guidance — no product gallery.',
    h1: 'When furniture slows care flow',
    lead: 'Saikang specializes in clinical furniture. We enrich SEO with typologies and floor/ward problems — no product photos or listings.',
    formIntro: 'Describe service, bed density and timeline. We reply in floor and biomed language.',
    primaryCta: 'Guide my furniture project',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse furniture family',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Hospital corridor — clinical furniture typologies I-ME Colombia',
    brandName: 'Saikang',
    brandProfileTitle: 'Specialty: hospital furniture and patient flow',
    brandProfileBody:
      'Manufacturer focused on beds, stretchers, carts and support furniture. This page explains typologies and institutional pain. No product logos or manufacturer contacts: I-ME channel.',
    typologiesTitle: 'Furniture typologies the sector asks about',
    typologiesIntro:
      'Purchasing and nursing do not ask for a pretty bed: they ask for safe transfer, cleaning, density and fewer staff injuries.',
    typologies: [
      {
        name: 'Hospital beds (ward / critical)',
        body: 'Core stay typology. Variables: positions, side rails, wheels, cleanability and isolation-protocol fit.',
        problems: [
          'How many positions does each service really need?',
          'Rails and brakes for which patient profile?',
          'How to standardize fleet without incompatible mixes?',
          'Weight, mattress and infection cleaning?',
        ],
      },
      {
        name: 'Transport and transfer stretchers',
        body: 'Move patients across services. Typical pain: unsafe transfer, staff strain and queues at imaging or OR.',
        problems: [
          'Trauma, recovery or general transport stretcher?',
          'Height and sides for table/fixed-bed transfer?',
          'Wheels and turning radius in narrow halls?',
        ],
      },
      {
        name: 'Clinical and support carts',
        body: 'Medication, dressings, emergency or linen. Wrong typology crowds halls or forces extra staff trips.',
        problems: [
          'Which flow fails: meds, dressings or linen?',
          'Useful space vs visual noise on the floor?',
          'Washable materials and clean/dirty separation?',
        ],
      },
    ],
    problemTitle: 'Floor problems the sector phrases weekly',
    problemBody:
      'Wrong furniture typology means slow transfers, more nursing strain, rooms that do not turn over and purchases that close without fleet standards.',
    solutionsTitle: 'How we help without an infinite catalog',
    solutions: [
      {
        pain: 'Buying by photo, not by flow',
        help: 'Map typology to service before SKUs.',
      },
      {
        pain: 'Mixed fleet impossible to maintain',
        help: 'Standardization and spare criteria by typology with I-ME.',
      },
      {
        pain: 'Staff ergonomics ignored',
        help: 'Review transfer, heights and real hall/room density.',
      },
    ],
    audienceYes: ['Ward and clinical floor', 'Biomed renewing fleet', 'IPS expanding beds'],
    audienceNo: ['Individual patients', 'Non-clinical décor', 'Direct manufacturer contact'],
    situations: [
      {
        title: 'Bed expansion',
        body: 'Typify ward vs critical before CapEx.',
      },
      {
        title: 'Wear replacement',
        body: 'Replace fleet without breaking cleaning protocols.',
      },
      {
        title: 'Internal transport bottleneck',
        body: 'When imaging or OR waits on the wrong stretcher.',
      },
    ],
    scopeTitle: 'Conversation scope',
    scope: [
      'Flow and density diagnosis',
      'Criteria by furniture typology',
      'Fleet standardization',
      'Proposal when budget exists',
    ],
    requirementsTitle: 'Minimum data',
    requirements: ['Service and city', 'Approx. units or beds', 'Purchase horizon'],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why no Saikang bed photos?',
        a: 'We prioritize typology and sector problems. References are evaluated in advisory with site context.',
      },
      {
        q: 'Bed or stretcher for my bottleneck?',
        a: 'Depends on stay vs transport pain. We separate that on the first call.',
      },
      {
        q: 'Institutional financing?',
        a: 'Indicative by project; terms in a formal I-ME proposal.',
      },
    ],
    projectOptions: [
      { value: 'ampliacion_camas', label: 'Bed expansion' },
      { value: 'renovacion_flota', label: 'Fleet renewal' },
      { value: 'transporte', label: 'Transport / stretchers' },
      { value: 'orientacion', label: 'Orientation only' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'mobiliario',
  },
};

const ANGELL: Record<Locale, FabCopy> = {
  es: {
    tag: 'Imagen · Angell Technology',
    title: 'Mamografía digital y tipologías de imagen diagnóstica | I-ME Colombia',
    description:
      'Proyecto de mamografía o imagen? Tipologías DR, mamografía digital y 3D: throughput, dosis y sala. Orientación I-ME — sin galería de equipos.',
    h1: 'Cuando el servicio de imagen necesita tipología, no brochure',
    lead: 'Angell Technology se especializa en imagen diagnóstica (mamografía, DR, arcos). Explicamos tipologías y preguntas de radiología institucional sin exponer productos ni fotos de fabricante.',
    formIntro:
      'Indique si es screening, diagnóstico, renovación de sala o nuevo servicio. Respondemos en lenguaje de imagen.',
    primaryCta: 'Orientar mi proyecto de imagen',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia radiología',
    heroImage: '/assets/img/imagenologia-radiologia-diagnostica-colombia.webp',
    heroImageAlt: 'Imagenología diagnóstica hospitalaria — tipologías I-ME Colombia',
    brandName: 'Angell Technology',
    brandProfileTitle: 'Especialidad: tipologías de imagen diagnóstica',
    brandProfileBody:
      'Enfoque en mamografía digital, sistemas de reconstrucción/3D y líneas de radiografía digital. Contenido educativo de tipología y problemas de sector. Sin fichas ni contactos del fabricante.',
    typologiesTitle: 'Tipologías de imagen que el sector investiga',
    typologiesIntro:
      'Jefes de radiología y biomédicos preguntan por flujo de pacientes, blindaje, dosis y sostenibilidad del servicio — no por “el equipo más nuevo”.',
    typologies: [
      {
        name: 'Mamografía digital',
        body: 'Tipología central de screening y diagnóstico mamario. Variables institucionales: throughput, ergonomía del tecnólogo, calidad de imagen documentable y preparación de sala.',
        problems: [
          '¿Screening, diagnóstico o ambos en la misma sala?',
          '¿Cuántos estudios/día sostiene el flujo real?',
          '¿Qué exige la sala (blindaje, HVAC, acceso pacientes)?',
          '¿Cómo planificar capacitación sin frenar agenda?',
        ],
      },
      {
        name: 'Sistemas 3D / reconstrucción avanzada',
        body: 'Complementan el flujo diagnóstico cuando la institución busca más información espacial. No sustituyen el diseño de sala ni el protocolo clínico.',
        problems: [
          '¿Cuándo aporta 3D vs mamografía 2D digital?',
          '¿Impacto en tiempo de estudio y lectura?',
          '¿Qué cambia en PACS/flujo de informes?',
        ],
      },
      {
        name: 'Radiografía digital (DR) y arcos',
        body: 'Tipologías de captura digital y apoyo perioperatorio/urgencia. Decisiones de movilidad, detector y uso compartido entre servicios.',
        problems: [
          '¿Fijo, móvil o arco según mix de casos?',
          '¿Quién opera y mantiene entre quirófano y urgencias?',
          '¿Estandarizar detectores sin fragmentar flota?',
        ],
      },
    ],
    problemTitle: 'Preguntas típicas de radiología institucional',
    problemBody:
      'El dolor no es “comprar un mamógrafo”. Es sostener agenda, dosis y calidad con personal limitado, salas que no están listas y proyectos que mezclan tipologías sin diseño de flujo.',
    solutionsTitle: 'Cómo orientamos el proyecto',
    solutions: [
      {
        pain: 'Confunden tipología de screening con diagnóstico',
        help: 'Aclarar objetivo clínico-operativo antes de CapEx.',
      },
      {
        pain: 'Sala no preparada (blindaje/utilidades)',
        help: 'Checklist de sitio con ingeniería antes de cronograma de compra.',
      },
      {
        pain: 'Miedo a quedar sin soporte post-instalación',
        help: 'Alcance de puesta en marcha y canal I-ME en Colombia.',
      },
    ],
    audienceYes: [
      'Servicios de imagen y mamografía',
      'IPS abriendo o renovando sala',
      'Biomédica / compras de imagen',
    ],
    audienceNo: [
      'Pacientes buscando cita',
      'Pedidos de estudio clínico',
      'Contacto directo al fabricante',
    ],
    situations: [
      {
        title: 'Nuevo servicio de mamografía',
        body: 'Tipología + sala + flujo de pacientes desde el día uno.',
      },
      {
        title: 'Renovación por obsolescencia',
        body: 'Migrar sin tumbar agenda de screening.',
      },
      {
        title: 'Ampliación a 3D',
        body: 'Evaluar aporte real vs tiempo de estudio/lectura.',
      },
    ],
    scopeTitle: 'Qué trabajamos juntos',
    scope: [
      'Objetivo clínico-operativo del servicio',
      'Criterios por tipología de imagen',
      'Preparación de sala y utilidades',
      'Propuesta formal madura',
    ],
    requirementsTitle: 'Para avanzar',
    requirements: [
      'Ciudad e institución',
      'Tipo de servicio (screening/diagnóstico/DR)',
      'Horizonte',
    ],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no hay equipos Angell listados?',
        a: 'Esta landing cubre tipologías y problemas SEO del sector imagen. Referencias en asesoría con contexto de sala.',
      },
      {
        q: '¿Mamografía digital o 3D primero?',
        a: 'Depende de mix de pacientes, lectura y capacidad de sala. Lo priorizamos con su realidad.',
      },
      {
        q: '¿I-ME da datos de contacto del fabricante?',
        a: 'No. Solo canal I-ME.',
      },
    ],
    projectOptions: [
      { value: 'nueva_sala', label: 'Nueva sala / servicio' },
      { value: 'renovacion', label: 'Renovación' },
      { value: 'upgrade_3d', label: 'Evaluación 3D' },
      { value: 'orientacion', label: 'Solo orientación' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'radiologia',
  },
  en: {
    tag: 'Imaging · Angell Technology',
    title: 'Digital mammography & diagnostic imaging typologies | I-ME Colombia',
    description:
      'Imaging project? DR, digital mammography and 3D typologies: throughput, dose and room. I-ME guidance — no equipment gallery.',
    h1: 'When imaging needs typology, not a brochure',
    lead: 'Angell Technology specializes in diagnostic imaging. We explain typologies and institutional radiology questions without manufacturer products or photos.',
    formIntro:
      'Tell us if screening, diagnosis, room renewal or a new service. We reply in imaging language.',
    primaryCta: 'Guide my imaging project',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse radiology family',
    heroImage: '/assets/img/imagenologia-radiologia-diagnostica-colombia.webp',
    heroImageAlt: 'Hospital diagnostic imaging — typologies I-ME Colombia',
    brandName: 'Angell Technology',
    brandProfileTitle: 'Specialty: diagnostic imaging typologies',
    brandProfileBody:
      'Focus on digital mammography, 3D/reconstruction and digital radiography lines. Educational typology content and sector problems. No sheets or manufacturer contacts.',
    typologiesTitle: 'Imaging typologies the sector researches',
    typologiesIntro:
      'Radiology leads and biomed ask about patient flow, shielding, dose and service sustainability — not the newest box.',
    typologies: [
      {
        name: 'Digital mammography',
        body: 'Core screening and breast-diagnosis typology. Variables: throughput, technologist ergonomics, documentable image quality and room readiness.',
        problems: [
          'Screening, diagnosis or both in one room?',
          'How many studies/day does real flow sustain?',
          'What does the room require (shielding, HVAC, access)?',
          'How to plan training without killing the schedule?',
        ],
      },
      {
        name: '3D / advanced reconstruction systems',
        body: 'Complement diagnostic flow when the institution wants more spatial information. They do not replace room design or clinical protocol.',
        problems: [
          'When does 3D add vs 2D digital mammo?',
          'Impact on exam and reading time?',
          'What changes in PACS/reporting flow?',
        ],
      },
      {
        name: 'Digital radiography (DR) and C-arms',
        body: 'Digital capture and peri-op/ER support typologies. Decisions on mobility, detector and shared use across services.',
        problems: [
          'Fixed, mobile or C-arm for case mix?',
          'Who operates/maintains across OR and ER?',
          'Standardize detectors without fragmenting fleet?',
        ],
      },
    ],
    problemTitle: 'Typical institutional radiology questions',
    problemBody:
      'Pain is not buying a mammo unit. It is sustaining schedule, dose and quality with limited staff, unready rooms and projects mixing typologies without flow design.',
    solutionsTitle: 'How we guide the project',
    solutions: [
      {
        pain: 'Screening typology confused with diagnosis',
        help: 'Clarify clinical-operational goal before CapEx.',
      },
      {
        pain: 'Room not ready (shielding/utilities)',
        help: 'Site checklist with engineering before purchase timeline.',
      },
      {
        pain: 'Fear of no post-install support',
        help: 'Commissioning scope and I-ME channel in Colombia.',
      },
    ],
    audienceYes: [
      'Imaging and mammo services',
      'IPS opening or renewing rooms',
      'Biomed / imaging purchasing',
    ],
    audienceNo: [
      'Patients seeking appointments',
      'Clinical study requests',
      'Direct manufacturer contact',
    ],
    situations: [
      {
        title: 'New mammo service',
        body: 'Typology + room + patient flow from day one.',
      },
      {
        title: 'Obsolescence renewal',
        body: 'Migrate without collapsing screening agenda.',
      },
      {
        title: '3D expansion',
        body: 'Assess real value vs exam/reading time.',
      },
    ],
    scopeTitle: 'What we work on together',
    scope: [
      'Clinical-operational goal',
      'Criteria by imaging typology',
      'Room and utilities readiness',
      'Mature formal proposal',
    ],
    requirementsTitle: 'To move forward',
    requirements: ['City and institution', 'Service type (screening/diagnosis/DR)', 'Horizon'],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why no Angell units listed?',
        a: 'This landing covers imaging typologies and SEO sector problems. References in advisory with room context.',
      },
      {
        q: 'Digital mammo or 3D first?',
        a: 'Depends on patient mix, reading and room capacity. We prioritize with your reality.',
      },
      {
        q: 'Does I-ME share manufacturer contacts?',
        a: 'No. I-ME channel only.',
      },
    ],
    projectOptions: [
      { value: 'nueva_sala', label: 'New room / service' },
      { value: 'renovacion', label: 'Renewal' },
      { value: 'upgrade_3d', label: '3D evaluation' },
      { value: 'orientacion', label: 'Orientation only' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'radiologia',
  },
};

const NORTHERN: Record<Locale, FabCopy> = {
  es: {
    tag: 'Monitoreo · Northern Meditec',
    title: 'Monitores de paciente y tipologías de anestesia | I-ME Colombia',
    description:
      '¿Flota de monitores o anestesia? Tipologías multiparámetro, quirófano y perioperatorio: alarmas, estandarización y soporte. Orientación I-ME sin vitrina.',
    h1: 'Cuando el monitoreo debe hablar el idioma del servicio',
    lead: 'Northern Meditec se especializa en monitores y sistemas de anestesia/ventilación perioperatoria. Aquí: tipologías y problemas de UCI, quirófano y piso — sin productos ni fotos.',
    formIntro: 'Indique servicio (UCI, quirófano, piso), tamaño de flota y plazo.',
    primaryCta: 'Orientar monitoreo / anestesia',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia monitores',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Entorno hospitalario de monitoreo — tipologías I-ME Colombia',
    brandName: 'Northern Meditec',
    brandProfileTitle: 'Especialidad: monitoreo y tipologías perioperatorias',
    brandProfileBody:
      'Enfoque en monitores multiparámetro y plataformas de anestesia/ventilación asociadas. Contenido de tipología para decisiones institucionales. Sin fichas ni contacto del fabricante.',
    typologiesTitle: 'Tipologías que preguntan UCI, quirófano y biomédica',
    typologiesIntro:
      'La pregunta correcta no es “qué marca”, sino qué tipología de monitoreo o anestesia encaja con el flujo y la fatiga de alarmas del servicio.',
    typologies: [
      {
        name: 'Monitores multiparámetro (UCI / críticos)',
        body: 'Tipología para vigilancia continua. Variables: parámetros requeridos, conectividad, estandarización de flota y carga de alarmas sobre el personal.',
        problems: [
          '¿Qué parámetros son obligatorios por servicio?',
          '¿Cómo reducir fatiga de alarmas sin perder seguridad?',
          '¿Estandarizar flota para capacitación y repuestos?',
          '¿Integración a estación central / HIS?',
        ],
      },
      {
        name: 'Monitoreo perioperatorio / quirófano',
        body: 'Monitoreo alineado a anestesia y tiempos quirúrgicos. Distinto perfil de uso que UCI de larga estancia.',
        problems: [
          '¿Misma tipología que UCI o flota separada?',
          '¿Montaje en torre/quirófano y ergonomía del anestesiólogo?',
          '¿Qué pasa en inducción y recuperación?',
        ],
      },
      {
        name: 'Máquinas de anestesia y soporte ventilatorio perioperatorio',
        body: 'Tipología de entrega de anestesia y ventilación en quirófano. Decisiones de flujo de gases, modos y mantenimiento institucional.',
        problems: [
          '¿Qué mix de procedimientos sostiene la sala?',
          '¿Utilidades de gases y evacuación listas?',
          '¿Plan de mantenimiento y backup de sala?',
        ],
      },
    ],
    problemTitle: 'Dolores reales de monitoreo institucional',
    problemBody:
      'Flotas mezcladas, alarmas que nadie prioriza, quirófanos con tipología de piso y compras urgentes sin estandarizar capacitación.',
    solutionsTitle: 'Cómo aterrizamos tipología con I-ME',
    solutions: [
      {
        pain: 'Compran monitor “genérico” para todos los servicios',
        help: 'Separar tipología UCI vs quirófano vs piso según uso real.',
      },
      {
        pain: 'Miedo a integración y soporte',
        help: 'Definir alcance de puesta en marcha y canal local I-ME.',
      },
      {
        pain: 'Presupuesto fraccionado que rompe flota',
        help: 'Plan por tipología y fases sin mezclar criterios.',
      },
    ],
    audienceYes: [
      'UCI, quirófano y biomédica',
      'IPS renovando flota de monitores',
      'Compras con proyecto de anestesia',
    ],
    audienceNo: [
      'Pacientes',
      'Pedidos de consumible suelto sin institución',
      'Contacto directo fabricante',
    ],
    situations: [
      {
        title: 'Renovación de UCI',
        body: 'Estandarizar tipología multiparámetro y alarmas.',
      },
      {
        title: 'Apertura de quirófano',
        body: 'Monitoreo + anestesia tipificados juntos.',
      },
      {
        title: 'Unificación de flota',
        body: 'Eliminar mezcla incompatible entre servicios.',
      },
    ],
    scopeTitle: 'Alcance',
    scope: [
      'Mapa de servicios y parámetros',
      'Criterios por tipología',
      'Estandarización y soporte',
      'Propuesta madura',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Servicios involucrados', 'Tamaño aproximado de flota', 'Horizonte'],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no listan monitores Northern?',
        a: 'Educamos tipologías y problemas de sector. Referencias en asesoría con contexto de servicio.',
      },
      {
        q: '¿Un solo monitor para UCI y quirófano?',
        a: 'A menudo no. Tipologías distintas; lo evaluamos con su mix.',
      },
      {
        q: '¿Contacto del fabricante?',
        a: 'No. Solo I-ME.',
      },
    ],
    projectOptions: [
      { value: 'renovacion_uci', label: 'Renovación UCI' },
      { value: 'quirofano', label: 'Quirófano / anestesia' },
      { value: 'unificacion', label: 'Unificación de flota' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'monitores',
  },
  en: {
    tag: 'Monitoring · Northern Meditec',
    title: 'Patient monitors & anesthesia typologies | I-ME Colombia',
    description:
      'Monitor fleet or anesthesia? Multiparameter, OR and peri-op typologies: alarms, standardization and support. I-ME — no product showcase.',
    h1: 'When monitoring must speak the service language',
    lead: 'Northern Meditec specializes in monitors and peri-op anesthesia/ventilation. Here: typologies and ICU/OR/ward problems — no products or photos.',
    formIntro: 'Share service (ICU, OR, ward), fleet size and timeline.',
    primaryCta: 'Guide monitoring / anesthesia',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse monitors family',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Hospital monitoring environment — typologies I-ME Colombia',
    brandName: 'Northern Meditec',
    brandProfileTitle: 'Specialty: monitoring and peri-op typologies',
    brandProfileBody:
      'Focus on multiparameter monitors and related anesthesia/ventilation platforms. Typology content for institutional decisions. No sheets or manufacturer contact.',
    typologiesTitle: 'Typologies ICU, OR and biomed ask about',
    typologiesIntro:
      'The right question is not which brand, but which monitoring or anesthesia typology fits flow and alarm burden.',
    typologies: [
      {
        name: 'Multiparameter monitors (ICU / critical)',
        body: 'Continuous surveillance typology. Variables: required parameters, connectivity, fleet standards and alarm load on staff.',
        problems: [
          'Which parameters are mandatory per service?',
          'How to cut alarm fatigue without losing safety?',
          'Standardize fleet for training and spares?',
          'Central station / HIS integration?',
        ],
      },
      {
        name: 'Peri-op / OR monitoring',
        body: 'Monitoring aligned to anesthesia and surgical timing. Different use profile than long-stay ICU.',
        problems: [
          'Same typology as ICU or separate fleet?',
          'Tower/OR mounting and anesthesiologist ergonomics?',
          'What happens at induction and recovery?',
        ],
      },
      {
        name: 'Anesthesia machines and peri-op ventilatory support',
        body: 'OR anesthesia delivery and ventilation typology. Decisions on gas flow, modes and institutional maintenance.',
        problems: [
          'Which procedure mix does the room sustain?',
          'Gas utilities and scavenging ready?',
          'Maintenance plan and room backup?',
        ],
      },
    ],
    problemTitle: 'Real institutional monitoring pains',
    problemBody:
      'Mixed fleets, alarms nobody prioritizes, ORs with ward typology and urgent buys without training standards.',
    solutionsTitle: 'How we land typology with I-ME',
    solutions: [
      {
        pain: 'Buying a “generic” monitor for every service',
        help: 'Separate ICU vs OR vs ward typology by real use.',
      },
      {
        pain: 'Fear of integration and support',
        help: 'Define commissioning scope and local I-ME channel.',
      },
      {
        pain: 'Split budgets that break the fleet',
        help: 'Phased plan by typology without mixing criteria.',
      },
    ],
    audienceYes: [
      'ICU, OR and biomed',
      'IPS renewing monitor fleets',
      'Purchasing with anesthesia projects',
    ],
    audienceNo: [
      'Patients',
      'Loose consumable orders without institution',
      'Direct manufacturer contact',
    ],
    situations: [
      {
        title: 'ICU renewal',
        body: 'Standardize multiparameter typology and alarms.',
      },
      {
        title: 'New OR',
        body: 'Monitoring + anesthesia typified together.',
      },
      {
        title: 'Fleet unification',
        body: 'Remove incompatible mixes across services.',
      },
    ],
    scopeTitle: 'Scope',
    scope: [
      'Service and parameter map',
      'Criteria by typology',
      'Standardization and support',
      'Mature proposal',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Services involved', 'Approx. fleet size', 'Horizon'],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why no Northern monitors listed?',
        a: 'We teach typologies and sector problems. References in advisory with service context.',
      },
      {
        q: 'One monitor for ICU and OR?',
        a: 'Often no. Different typologies; we assess with your mix.',
      },
      {
        q: 'Manufacturer contact?',
        a: 'No. I-ME only.',
      },
    ],
    projectOptions: [
      { value: 'renovacion_uci', label: 'ICU renewal' },
      { value: 'quirofano', label: 'OR / anesthesia' },
      { value: 'unificacion', label: 'Fleet unification' },
      { value: 'orientacion', label: 'Orientation' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'monitores',
  },
};

const ILUMITEC: Record<Locale, FabCopy> = {
  es: {
    tag: 'Quirófano · Ilumitec',
    title: 'Iluminación quirúrgica LED: tipologías de lámpara | I-ME Colombia',
    description:
      '¿Sombras en campo o foco antiguo? Tipologías de lámpara quirúrgica LED cielítica, doble cúpula y rodable. Orientación I-ME Colombia — sin catálogo visual.',
    h1: 'Cuando la luz del quirófano define el campo — y el estrés del equipo',
    lead: 'Ilumitec se especializa en iluminación quirúrgica LED. Explicamos tipologías y preguntas de sala (lux, sombra, techo, mantenimiento) sin fotos ni productos.',
    formIntro: 'Cuéntenos tipo de sala, altura de techo y si es renovación o apertura.',
    primaryCta: 'Orientar iluminación de quirófano',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia sala de cirugía',
    heroImage: '/assets/img/torre-laparoscopia-quirofano-colombia.webp',
    heroImageAlt: 'Quirófano institucional — tipologías de iluminación quirúrgica I-ME',
    brandName: 'Ilumitec',
    brandProfileTitle: 'Especialidad: tipologías de iluminación quirúrgica LED',
    brandProfileBody:
      'Fabricante colombiano enfocado en lámparas quirúrgicas LED (cielíticas, dobles, rodables). Contenido de tipología y problemas de quirófano. Sin exposiciones de producto ni datos de contacto del fabricante en esta página.',
    typologiesTitle: 'Tipologías de lámpara que pregunta el quirófano',
    typologiesIntro:
      'Cirujanos y biomédicos preguntan por sombra, temperatura de color, vida útil y si el techo aguanta — no por “la lámpara más brillante del PDF”.',
    typologies: [
      {
        name: 'Lámparas cielíticas LED (cúpula simple)',
        body: 'Tipología fija al techo para salas estándar. Variables: intensidad usable en campo, control de sombra, altura de montaje y acceso de mantenimiento.',
        problems: [
          '¿Lux reales en campo vs brochure?',
          '¿Altura de techo y estructura disponible?',
          '¿Control de sombra con un solo cabezal?',
          '¿Plan de repuestos a largo plazo?',
        ],
      },
      {
        name: 'Sistemas de doble cúpula',
        body: 'Dos cabezales para reducir sombra y cubrir campos más exigentes o posiciones de equipo. Más demanda de techo y coordinación de sala.',
        problems: [
          '¿Cuándo justifica doble vs simple?',
          '¿Peso y refuerzo estructural?',
          '¿Ergonomía de posicionamiento durante cirugía larga?',
        ],
      },
      {
        name: 'Lámparas rodables / de apoyo',
        body: 'Tipología móvil para salas compartidas, respaldo o procedimientos fuera de quirófano principal.',
        problems: [
          '¿Backup de sala o uso primario?',
          '¿Estabilidad y cableado en flujo de quirófano?',
          '¿Almacenamiento y limpieza entre casos?',
        ],
      },
    ],
    problemTitle: 'Lo que duele en iluminación de sala',
    problemBody:
      'Focos antiguos que calientan, sombras que obligan a pelear con la lámpara, techos no preparados y compras que ignoran mantenimiento a 5–10 años.',
    solutionsTitle: 'Cómo ayudamos',
    solutions: [
      {
        pain: 'Elegir por brillo de ficha',
        help: 'Traducir tipología a procedimiento, techo y sombra real.',
      },
      {
        pain: 'Techo no evaluado',
        help: 'Revisar montaje y estructura antes de cronograma.',
      },
      {
        pain: 'Sin plan de repuestos',
        help: 'Incluir disponibilidad y soporte I-ME en el alcance.',
      },
    ],
    audienceYes: [
      'Quirófanos en apertura o renovación',
      'Biomédica de sala de cirugía',
      'IPS estandarizando iluminación LED',
    ],
    audienceNo: [
      'Iluminación arquitectónica no clínica',
      'Pacientes',
      'Contacto directo fabricante',
    ],
    situations: [
      {
        title: 'Cambio de halógeno a LED',
        body: 'Tipología cielítica vs doble según mix quirúrgico.',
      },
      {
        title: 'Nueva sala',
        body: 'Montaje y tipología desde diseño de techo.',
      },
      {
        title: 'Sala compartida',
        body: 'Rodable como backup o apoyo.',
      },
    ],
    scopeTitle: 'Alcance',
    scope: [
      'Lectura de sala y procedimientos',
      'Criterios por tipología LED',
      'Montaje / techo',
      'Propuesta formal',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Número de salas', 'Altura de techo si se conoce', 'Horizonte'],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no muestran lámparas Ilumitec?',
        a: 'Prioridad: tipologías y problemas SEO de quirófano. Referencias en asesoría con datos de sala.',
      },
      {
        q: '¿Simple o doble cúpula?',
        a: 'Depende de sombra, mix y techo. Lo resolvemos con su contexto.',
      },
      {
        q: '¿Fabricante colombiano implica contacto directo aquí?',
        a: 'No. Canal de proyecto: I-ME.',
      },
    ],
    projectOptions: [
      { value: 'renovacion_led', label: 'Renovación LED' },
      { value: 'nueva_sala', label: 'Nueva sala' },
      { value: 'backup_rodable', label: 'Apoyo rodable' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'sala-cirugia',
  },
  en: {
    tag: 'OR · Ilumitec',
    title: 'Surgical LED lighting typologies | I-ME Colombia',
    description:
      'Field shadows or aging lights? Ceiling, dual-head and mobile surgical LED typologies. I-ME Colombia — no visual catalog.',
    h1: 'When OR light shapes the field — and team stress',
    lead: 'Ilumitec specializes in surgical LED lighting. We explain typologies and room questions (lux, shadow, ceiling, maintenance) without photos or products.',
    formIntro: 'Share room type, ceiling height and renewal vs opening.',
    primaryCta: 'Guide OR lighting',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse surgery-room family',
    heroImage: '/assets/img/torre-laparoscopia-quirofano-colombia.webp',
    heroImageAlt: 'Institutional OR — surgical lighting typologies I-ME',
    brandName: 'Ilumitec',
    brandProfileTitle: 'Specialty: surgical LED lighting typologies',
    brandProfileBody:
      'Colombian manufacturer focused on surgical LED lamps (ceiling, dual, mobile). Typology and OR problem content. No product displays or manufacturer contacts on this page.',
    typologiesTitle: 'Lamp typologies the OR asks about',
    typologiesIntro:
      'Surgeons and biomed ask about shadow, color temperature, lifespan and ceiling load — not the brightest PDF lamp.',
    typologies: [
      {
        name: 'Ceiling-mounted LED lamps (single head)',
        body: 'Fixed ceiling typology for standard rooms. Variables: usable field intensity, shadow control, mount height and maintenance access.',
        problems: [
          'Real field lux vs brochure?',
          'Ceiling height and structure available?',
          'Shadow control with one head?',
          'Long-term spare plan?',
        ],
      },
      {
        name: 'Dual-head systems',
        body: 'Two heads to cut shadow and cover demanding fields. More ceiling demand and room coordination.',
        problems: [
          'When does dual justify vs single?',
          'Weight and structural reinforcement?',
          'Positioning ergonomics in long cases?',
        ],
      },
      {
        name: 'Mobile / support lamps',
        body: 'Mobile typology for shared rooms, backup or procedures outside the main OR.',
        problems: [
          'Room backup or primary use?',
          'Stability and cabling in OR flow?',
          'Storage and cleaning between cases?',
        ],
      },
    ],
    problemTitle: 'What hurts in room lighting',
    problemBody:
      'Aging lights that heat, shadows that fight the lamp, unready ceilings and purchases that ignore 5–10 year maintenance.',
    solutionsTitle: 'How we help',
    solutions: [
      {
        pain: 'Choosing by datasheet brightness',
        help: 'Translate typology to procedure, ceiling and real shadow.',
      },
      {
        pain: 'Ceiling not assessed',
        help: 'Review mount and structure before timeline.',
      },
      {
        pain: 'No spare plan',
        help: 'Include availability and I-ME support in scope.',
      },
    ],
    audienceYes: [
      'ORs opening or renewing',
      'Surgery-room biomed',
      'IPS standardizing LED lighting',
    ],
    audienceNo: ['Non-clinical architectural lighting', 'Patients', 'Direct manufacturer contact'],
    situations: [
      {
        title: 'Halogen to LED',
        body: 'Ceiling vs dual typology by surgical mix.',
      },
      {
        title: 'New room',
        body: 'Mount and typology from ceiling design.',
      },
      {
        title: 'Shared room',
        body: 'Mobile as backup or support.',
      },
    ],
    scopeTitle: 'Scope',
    scope: [
      'Room and procedure reading',
      'LED typology criteria',
      'Mount / ceiling',
      'Formal proposal',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Number of rooms', 'Ceiling height if known', 'Horizon'],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why no Ilumitec lamps shown?',
        a: 'Priority: OR typologies and SEO problems. References in advisory with room data.',
      },
      {
        q: 'Single or dual head?',
        a: 'Depends on shadow, mix and ceiling. We resolve with your context.',
      },
      {
        q: 'Colombian manufacturer means direct contact here?',
        a: 'No. Project channel: I-ME.',
      },
    ],
    projectOptions: [
      { value: 'renovacion_led', label: 'LED renewal' },
      { value: 'nueva_sala', label: 'New room' },
      { value: 'backup_rodable', label: 'Mobile support' },
      { value: 'orientacion', label: 'Orientation' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'sala-cirugia',
  },
};

const PERLONG: Record<Locale, FabCopy> = {
  es: {
    tag: 'Diagnóstico · Perlong',
    title: 'Balanzas médicas y tipologías de diagnóstico básico | I-ME Colombia',
    description:
      'Consulta externa o pediatría sin medición confiable? Tipologías de balanza médica y diagnóstico básico: calibración, flujo y perfiles. Orientación I-ME.',
    h1: 'Cuando el diagnóstico básico falla por tipología, no por “falta de equipo”',
    lead: 'Perlong se especializa en tipologías de diagnóstico clínico básico (balanzas y equipos de consulta). SEO útil para compras y biomédica — sin vitrina de productos.',
    formIntro: 'Indique servicio (consulta, pediatría, nutrición) y volumen aproximado.',
    primaryCta: 'Orientar diagnóstico básico',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia diagnóstico',
    heroImage: '/assets/img/avances-tecnologicos-diagnostico-tratamiento-colombia.webp',
    heroImageAlt: 'Diagnóstico clínico institucional — tipologías I-ME Colombia',
    brandName: 'Perlong',
    brandProfileTitle: 'Especialidad: tipologías de diagnóstico clínico básico',
    brandProfileBody:
      'Enfoque en balanzas médicas y equipos de apoyo diagnóstico de consulta. Contenido educativo de tipología. Sin fotos de producto ni contactos del fabricante.',
    typologiesTitle: 'Tipologías que pregunta consulta y pediatría',
    typologiesIntro:
      'El sector pregunta por calibración, rango pediátrico/adulto y flujo de pacientes — no por el aparato más vistoso.',
    typologies: [
      {
        name: 'Balanzas médicas de adulto / consulta',
        body: 'Tipología de pesaje clínico para consulta externa y hospitalización. Variables: precisión usable, plataforma, movilidad y protocolo de calibración.',
        problems: [
          '¿Cada cuánto calibro y quién lo documenta?',
          '¿Fija o con ruedas según flujo de consulta?',
          '¿Cómo estandarizar entre sedes?',
        ],
      },
      {
        name: 'Balanzas pediátricas / infantiles',
        body: 'Tipología específica para neonatos y niños. Errores típicos: usar tipología de adulto o no tener protocolo de higiene entre pacientes.',
        problems: [
          '¿Rango y resolución adecuados a edad?',
          '¿Higiene entre mediciones?',
          '¿Flujo en crecimiento y nutrición?',
        ],
      },
      {
        name: 'Apoyo de diagnóstico de consulta',
        body: 'Equipos básicos que complementan valoración ambulatoria. Deben tipificarse por servicio para no comprar “colecciones” sin uso.',
        problems: [
          '¿Qué tipología pide realmente el servicio?',
          '¿Mantenimiento y consumibles asociados?',
          '¿Capacitación mínima del personal?',
        ],
      },
    ],
    problemTitle: 'Problemas de medición que escucha el sector',
    problemBody:
      'Datos inconsistentes entre sedes, tipologías mezcladas adulto/pediatría, calibración olvidada y compras sueltas sin estándar institucional.',
    solutionsTitle: 'Cómo orientamos',
    solutions: [
      {
        pain: 'Comprar balanza “genérica” para todos',
        help: 'Separar tipología adulto vs pediátrica vs flujo.',
      },
      {
        pain: 'Sin plan de calibración',
        help: 'Incluir responsabilidad documental en el alcance.',
      },
      {
        pain: 'Flota distinta por sede',
        help: 'Criterios de estandarización I-ME.',
      },
    ],
    audienceYes: [
      'Consulta externa y pediatría',
      'Nutrición clínica',
      'Biomédica de diagnóstico básico',
    ],
    audienceNo: ['Uso doméstico', 'Pacientes', 'Contacto fabricante'],
    situations: [
      {
        title: 'Apertura de consulta',
        body: 'Tipologías mínimas por perfil de paciente.',
      },
      {
        title: 'Unificación multi-sede',
        body: 'Mismo criterio de medición.',
      },
      {
        title: 'Pediatría saturada',
        body: 'Tipología infantil dedicada.',
      },
    ],
    scopeTitle: 'Alcance',
    scope: ['Perfil de pacientes', 'Criterios por tipología', 'Calibración / uso', 'Propuesta'],
    requirementsTitle: 'Mínimos',
    requirements: ['Servicio y ciudad', 'Volumen aproximado', 'Horizonte'],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no hay productos Perlong?',
        a: 'Enfocamos tipologías y preguntas SEO del diagnóstico básico.',
      },
      {
        q: '¿Una balanza sirve para adulto y niño?',
        a: 'A menudo no. Tipologías distintas; lo aclaramos en asesoría.',
      },
    ],
    projectOptions: [
      { value: 'consulta', label: 'Consulta externa' },
      { value: 'pediatria', label: 'Pediatría' },
      { value: 'multisede', label: 'Estandarización multi-sede' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'diagnostico-clinico-basico',
  },
  en: {
    tag: 'Diagnostics · Perlong',
    title: 'Medical scales & basic diagnostic typologies | I-ME Colombia',
    description:
      'Unreliable outpatient or pediatric measurement? Medical scale and basic diagnostic typologies: calibration, flow and profiles. I-ME guidance.',
    h1: 'When basic diagnostics fail by typology, not by “missing a device”',
    lead: 'Perlong specializes in basic clinical diagnostic typologies (scales and consult equipment). Useful SEO for purchasing and biomed — no product showcase.',
    formIntro: 'Share service (outpatient, pediatrics, nutrition) and approx. volume.',
    primaryCta: 'Guide basic diagnostics',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse diagnostics family',
    heroImage: '/assets/img/avances-tecnologicos-diagnostico-tratamiento-colombia.webp',
    heroImageAlt: 'Institutional clinical diagnostics — typologies I-ME Colombia',
    brandName: 'Perlong',
    brandProfileTitle: 'Specialty: basic clinical diagnostic typologies',
    brandProfileBody:
      'Focus on medical scales and outpatient diagnostic support. Educational typology content. No product photos or manufacturer contacts.',
    typologiesTitle: 'Typologies outpatient and pediatrics ask about',
    typologiesIntro:
      'The sector asks about calibration, pediatric/adult range and patient flow — not the flashiest device.',
    typologies: [
      {
        name: 'Adult / outpatient medical scales',
        body: 'Clinical weighing typology for outpatient and inpatient use. Variables: usable accuracy, platform, mobility and calibration protocol.',
        problems: [
          'How often to calibrate and who documents it?',
          'Fixed or wheeled for clinic flow?',
          'How to standardize across sites?',
        ],
      },
      {
        name: 'Pediatric / infant scales',
        body: 'Typology for neonates and children. Common errors: using adult typology or no hygiene protocol between patients.',
        problems: [
          'Range and resolution fit for age?',
          'Hygiene between measurements?',
          'Flow in growth and nutrition clinics?',
        ],
      },
      {
        name: 'Outpatient diagnostic support',
        body: 'Basic equipment that complements ambulatory assessment. Must be typified by service to avoid unused “collections”.',
        problems: [
          'Which typology does the service really need?',
          'Maintenance and related consumables?',
          'Minimum staff training?',
        ],
      },
    ],
    problemTitle: 'Measurement problems the sector hears',
    problemBody:
      'Inconsistent data across sites, mixed adult/pediatric typologies, forgotten calibration and one-off buys without institutional standard.',
    solutionsTitle: 'How we guide',
    solutions: [
      {
        pain: 'Buying a “generic” scale for everyone',
        help: 'Separate adult vs pediatric vs flow typology.',
      },
      {
        pain: 'No calibration plan',
        help: 'Include documentary responsibility in scope.',
      },
      {
        pain: 'Different fleet per site',
        help: 'I-ME standardization criteria.',
      },
    ],
    audienceYes: ['Outpatient and pediatrics', 'Clinical nutrition', 'Basic-diagnostics biomed'],
    audienceNo: ['Home use', 'Patients', 'Manufacturer contact'],
    situations: [
      {
        title: 'New clinic',
        body: 'Minimum typologies by patient profile.',
      },
      {
        title: 'Multi-site unification',
        body: 'Same measurement criteria.',
      },
      {
        title: 'Busy pediatrics',
        body: 'Dedicated infant typology.',
      },
    ],
    scopeTitle: 'Scope',
    scope: ['Patient profile', 'Criteria by typology', 'Calibration / use', 'Proposal'],
    requirementsTitle: 'Minimums',
    requirements: ['Service and city', 'Approx. volume', 'Horizon'],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why no Perlong products?',
        a: 'We focus on typologies and SEO questions for basic diagnostics.',
      },
      {
        q: 'One scale for adult and child?',
        a: 'Often no. Different typologies; we clarify in advisory.',
      },
    ],
    projectOptions: [
      { value: 'consulta', label: 'Outpatient' },
      { value: 'pediatria', label: 'Pediatrics' },
      { value: 'multisede', label: 'Multi-site standardization' },
      { value: 'orientacion', label: 'Orientation' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'diagnostico-clinico-basico',
  },
};

const BM: Record<Locale, FabCopy> = {
  es: {
    tag: 'Confort · BM',
    title: 'Sillones reclinables hospitalarios: tipología de confort | I-ME Colombia',
    description:
      'Estancia larga o recuperación sin confort? Tipología de sillón reclinable hospitalario: transferencia, limpieza y flujo. Orientación I-ME sin productos.',
    h1: 'Cuando el confort del sillón impacta estancia y carga de personal',
    lead: 'BM se especializa en tipologías de confort clínico (sillones reclinables y apoyo de movilidad). Contenido SEO de problemas de hospitalización — sin fotos de catálogo.',
    formIntro:
      'Describa servicio (hospitalización, oncología, diálisis, acompañante) y cantidad aproximada.',
    primaryCta: 'Orientar confort clínico',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia mobiliario',
    heroImage: '/assets/img/hospital-facility.webp',
    heroImageAlt: 'Infraestructura hospitalaria — tipologías de confort clínico I-ME',
    brandName: 'BM',
    brandProfileTitle: 'Especialidad: tipologías de confort y apoyo en estancia',
    brandProfileBody:
      'Enfoque en sillones reclinables hospitalarios y soluciones de apoyo al paciente. Tipologías y dolores de piso. Sin vitrina ni contactos del fabricante.',
    typologiesTitle: 'Tipologías de confort que pregunta hospitalización',
    typologiesIntro:
      'Enfermería y compras preguntan por transferencia, limpieza y espacio — no por “el sillón más acolchado”.',
    typologies: [
      {
        name: 'Sillones reclinables de hospitalización',
        body: 'Tipología para estancia y recuperación. Variables: posiciones, facilidad de limpieza, transferencia y densidad por habitación.',
        problems: [
          '¿Cuántas posiciones necesita el servicio?',
          '¿Cómo se limpia entre pacientes?',
          '¿Espacio real vs brochure?',
          '¿Carga ergonómica al movilizar al paciente?',
        ],
      },
      {
        name: 'Apoyo de acompañante / larga estancia',
        body: 'Tipología para acompañantes o pacientes en terapias prolongadas. Mal tipificada satura habitación y genera quejas.',
        problems: [
          '¿Acompañante vs paciente clínico?',
          '¿Protocolo de higiene compartido?',
          '¿Rotación y almacenamiento?',
        ],
      },
      {
        name: 'Movilidad y apoyo a transferencia',
        body: 'Cuando el dolor es mover al paciente con menos personal. Tipología de apoyo, no “mueble decorativo”.',
        problems: [
          '¿Transferencia cama-sillón segura?',
          '¿Personal disponible por turno?',
          '¿Compatibilidad con otras tipologías de cama/camilla?',
        ],
      },
    ],
    problemTitle: 'Por qué el sector pregunta por sillones “clínicos”',
    problemBody:
      'Quejas de confort, transferencias inseguras, muebles que no se limpian bien y compras domésticas que fallan en uso hospitalario.',
    solutionsTitle: 'Cómo ayudamos',
    solutions: [
      {
        pain: 'Comprar como mueble de hogar',
        help: 'Tipificar uso clínico: limpieza, transferencia, densidad.',
      },
      {
        pain: 'Sin estándar entre pisos',
        help: 'Unificar tipología por servicio con I-ME.',
      },
      {
        pain: 'Ignorar ergonomía del personal',
        help: 'Incluir transferencia en criterios.',
      },
    ],
    audienceYes: [
      'Hospitalización y oncología',
      'Servicios de larga estancia',
      'Biomédica de mobiliario clínico',
    ],
    audienceNo: ['Hogar / particulares', 'Decoración no clínica', 'Contacto fabricante'],
    situations: [
      {
        title: 'Renovación de habitaciones',
        body: 'Tipología reclinable + limpieza.',
      },
      {
        title: 'Nueva torre hospitalaria',
        body: 'Estandarizar confort por servicio.',
      },
      {
        title: 'Quejas de acompañantes',
        body: 'Separar tipología paciente vs acompañante.',
      },
    ],
    scopeTitle: 'Alcance',
    scope: [
      'Uso real del servicio',
      'Criterios de tipología de confort',
      'Limpieza y transferencia',
      'Propuesta',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Servicio', 'Cantidad aproximada', 'Horizonte'],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no hay sillones BM en foto?',
        a: 'Esta página educa tipologías. Referencias en asesoría.',
      },
      {
        q: '¿Sirve un sillón de hogar?',
        a: 'Casi nunca en protocolo hospitalario de limpieza y transferencia.',
      },
    ],
    projectOptions: [
      { value: 'hospitalizacion', label: 'Hospitalización' },
      { value: 'larga_estancia', label: 'Larga estancia / terapias' },
      { value: 'renovacion', label: 'Renovación' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'mobiliario',
  },
  en: {
    tag: 'Comfort · BM',
    title: 'Hospital recliner typologies | I-ME Colombia',
    description:
      'Long stay or recovery without comfort? Hospital recliner typology: transfer, cleaning and flow. I-ME guidance — no products.',
    h1: 'When recliner comfort hits length of stay and staff load',
    lead: 'BM specializes in clinical comfort typologies (recliners and mobility support). SEO content on ward problems — no catalog photos.',
    formIntro: 'Describe service (ward, oncology, dialysis, companion) and approx. quantity.',
    primaryCta: 'Guide clinical comfort',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse furniture family',
    heroImage: '/assets/img/hospital-facility.webp',
    heroImageAlt: 'Hospital infrastructure — clinical comfort typologies I-ME',
    brandName: 'BM',
    brandProfileTitle: 'Specialty: comfort and stay-support typologies',
    brandProfileBody:
      'Focus on hospital recliners and patient-support solutions. Typologies and floor pain. No showcase or manufacturer contacts.',
    typologiesTitle: 'Comfort typologies wards ask about',
    typologiesIntro:
      'Nursing and purchasing ask about transfer, cleaning and space — not the softest cushion.',
    typologies: [
      {
        name: 'Ward recliner chairs',
        body: 'Typology for stay and recovery. Variables: positions, cleanability, transfer and room density.',
        problems: [
          'How many positions does the service need?',
          'How is it cleaned between patients?',
          'Real space vs brochure?',
          'Ergonomic load when mobilizing the patient?',
        ],
      },
      {
        name: 'Companion / long-stay support',
        body: 'Typology for companions or long therapy patients. Wrong typology crowds rooms and drives complaints.',
        problems: [
          'Companion vs clinical patient?',
          'Shared hygiene protocol?',
          'Rotation and storage?',
        ],
      },
      {
        name: 'Mobility and transfer support',
        body: 'When pain is moving the patient with fewer staff. Support typology — not decorative furniture.',
        problems: [
          'Safe bed-to-recliner transfer?',
          'Staff available per shift?',
          'Compatibility with bed/stretcher typologies?',
        ],
      },
    ],
    problemTitle: 'Why the sector asks for “clinical” recliners',
    problemBody:
      'Comfort complaints, unsafe transfers, furniture that will not clean well and domestic buys that fail in hospital use.',
    solutionsTitle: 'How we help',
    solutions: [
      {
        pain: 'Buying like home furniture',
        help: 'Typify clinical use: cleaning, transfer, density.',
      },
      {
        pain: 'No standard across floors',
        help: 'Unify typology by service with I-ME.',
      },
      {
        pain: 'Ignoring staff ergonomics',
        help: 'Include transfer in criteria.',
      },
    ],
    audienceYes: ['Ward and oncology', 'Long-stay services', 'Clinical furniture biomed'],
    audienceNo: ['Home / individuals', 'Non-clinical décor', 'Manufacturer contact'],
    situations: [
      {
        title: 'Room renewal',
        body: 'Recliner typology + cleaning.',
      },
      {
        title: 'New hospital tower',
        body: 'Standardize comfort by service.',
      },
      {
        title: 'Companion complaints',
        body: 'Separate patient vs companion typology.',
      },
    ],
    scopeTitle: 'Scope',
    scope: ['Real service use', 'Comfort typology criteria', 'Cleaning and transfer', 'Proposal'],
    requirementsTitle: 'Minimums',
    requirements: ['Service', 'Approx. quantity', 'Horizon'],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why no BM recliner photos?',
        a: 'This page teaches typologies. References in advisory.',
      },
      {
        q: 'Will a home recliner work?',
        a: 'Almost never under hospital cleaning and transfer protocol.',
      },
    ],
    projectOptions: [
      { value: 'hospitalizacion', label: 'Ward' },
      { value: 'larga_estancia', label: 'Long stay / therapies' },
      { value: 'renovacion', label: 'Renewal' },
      { value: 'orientacion', label: 'Orientation' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'mobiliario',
  },
};

const ADVANCED: Record<Locale, FabCopy> = {
  es: {
    tag: 'Ultrasonido · Advanced',
    title: 'Ecografía institucional: tipologías de ultrasonido | I-ME Colombia',
    description:
      '¿Point-of-care o servicio de imagen? Tipologías de ecógrafo: sondas, formación y flujo. Orientación I-ME — sin galería de equipos.',
    h1: 'Cuando el ultrasonido debe tipificarse por servicio, no por “el más nuevo”',
    lead: 'Advanced se asocia en catálogo a tipologías de ultrasonido/diagnóstico por imagen. Aquí explicamos problemas que pregunta el sector: POC vs radiología, sondas y capacitación — sin productos.',
    formIntro: 'Indique servicio (urgencias, UCI, gineco, radiología) y uso esperado.',
    primaryCta: 'Orientar tipología de ultrasonido',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia ultrasonido',
    heroImage: '/assets/img/avances-tecnologicos-diagnostico-tratamiento-colombia.webp',
    heroImageAlt: 'Diagnóstico por imagen — tipologías de ultrasonido I-ME Colombia',
    brandName: 'Advanced',
    brandProfileTitle: 'Especialidad: tipologías de ultrasonido clínico',
    brandProfileBody:
      'Línea asociada a ecografía y diagnóstico por imagen en entornos institucionales. Contenido de tipología y preguntas de sector. Sin fichas, fotos de producto ni contactos del fabricante.',
    typologiesTitle: 'Tipologías de ultrasonido que investiga el sector',
    typologiesIntro:
      'La decisión institucional suele ser: ¿quién opera, qué sondas, qué calidad documentable y cómo se capacita sin frenar el servicio?',
    typologies: [
      {
        name: 'Ultrasonido point-of-care (POC)',
        body: 'Tipología para decisiones rápidas en urgencias, UCI o piso. Prioriza movilidad y curvas de aprendizaje cortas sobre menús de radiología avanzada.',
        problems: [
          '¿Quién opera: clínico de piso o imagen?',
          '¿Qué sondas mínimas por protocolo?',
          '¿Cómo documentar hallazgos sin saturar PACS?',
          '¿Limpieza de transductores entre pacientes?',
        ],
      },
      {
        name: 'Ultrasonido de servicio de imagen / cart',
        body: 'Tipología para radiología o servicios con mayor carga de estudios programados. Más énfasis en flujo de agenda y calidad de imagen sostenida.',
        problems: [
          '¿Cuántos estudios/día reales?',
          '¿Mezcla de especialidades en un solo equipo?',
          '¿Espacio, toma eléctrica y ergonomía del operador?',
        ],
      },
      {
        name: 'Perfiles por especialidad (OB/GYN, vascular, etc.)',
        body: 'Cuando un servicio necesita tipología orientada a un perfil clínico. Evita comprar “todo en uno” que nadie domina.',
        problems: [
          '¿Perfil clínico dominante?',
          '¿Capacitación específica disponible?',
          '¿Sondas compartidas vs dedicadas?',
        ],
      },
    ],
    problemTitle: 'Preguntas semanales sobre ecografía institucional',
    problemBody:
      'Equipos que nadie usa bien, sondas incorrectas, POC tratado como radiología (o al revés) y proyectos sin plan de formación.',
    solutionsTitle: 'Cómo aterrizamos',
    solutions: [
      {
        pain: 'Comprar por especificación de brochure',
        help: 'Tipificar POC vs imagen vs perfil clínico primero.',
      },
      {
        pain: 'Sin plan de sondas',
        help: 'Definir set mínimo por protocolo del servicio.',
      },
      {
        pain: 'Capacitación improvisada',
        help: 'Incluir alcance de entrenamiento en propuesta I-ME.',
      },
    ],
    audienceYes: [
      'Urgencias, UCI, gineco, radiología',
      'Biomédica de imagen',
      'IPS abriendo ultrasonido',
    ],
    audienceNo: ['Uso estético no clínico', 'Pacientes', 'Contacto fabricante'],
    situations: [
      {
        title: 'POC en urgencias',
        body: 'Tipología móvil + sondas mínimas.',
      },
      {
        title: 'Servicio de imagen',
        body: 'Cart / flujo de agenda.',
      },
      {
        title: 'Especialidad dedicada',
        body: 'Perfil clínico tipificado.',
      },
    ],
    scopeTitle: 'Alcance',
    scope: ['Uso y operador real', 'Tipología y sondas', 'Formación', 'Propuesta'],
    requirementsTitle: 'Mínimos',
    requirements: ['Servicio', 'Volumen estimado', 'Horizonte'],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no listan ecógrafos Advanced?',
        a: 'Educación de tipologías y problemas SEO. Referencias en asesoría.',
      },
      {
        q: '¿POC o equipo de radiología?',
        a: 'Depende de quién opera y qué decide el estudio. Lo separamos con su flujo.',
      },
    ],
    projectOptions: [
      { value: 'poc', label: 'Point-of-care' },
      { value: 'imagen', label: 'Servicio de imagen' },
      { value: 'especialidad', label: 'Perfil de especialidad' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'ultrasonido',
  },
  en: {
    tag: 'Ultrasound · Advanced',
    title: 'Institutional ultrasound typologies | I-ME Colombia',
    description:
      'Point-of-care or imaging service? Ultrasound typologies: probes, training and flow. I-ME guidance — no equipment gallery.',
    h1: 'When ultrasound must be typified by service, not by “newest unit”',
    lead: 'Advanced is associated in catalog with ultrasound/imaging typologies. We explain sector questions: POC vs radiology, probes and training — no products.',
    formIntro: 'Share service (ER, ICU, OB/GYN, radiology) and expected use.',
    primaryCta: 'Guide ultrasound typology',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse ultrasound family',
    heroImage: '/assets/img/avances-tecnologicos-diagnostico-tratamiento-colombia.webp',
    heroImageAlt: 'Diagnostic imaging — ultrasound typologies I-ME Colombia',
    brandName: 'Advanced',
    brandProfileTitle: 'Specialty: clinical ultrasound typologies',
    brandProfileBody:
      'Line associated with ultrasound and diagnostic imaging in institutions. Typology and sector Qs. No sheets, product photos or manufacturer contacts.',
    typologiesTitle: 'Ultrasound typologies the sector researches',
    typologiesIntro:
      'Institutional decisions usually ask: who operates, which probes, what documentable quality and how to train without freezing the service?',
    typologies: [
      {
        name: 'Point-of-care ultrasound (POC)',
        body: 'Typology for fast decisions in ER, ICU or ward. Prioritizes mobility and short learning curves over advanced radiology menus.',
        problems: [
          'Who operates: floor clinician or imaging?',
          'Minimum probes per protocol?',
          'How to document findings without flooding PACS?',
          'Transducer cleaning between patients?',
        ],
      },
      {
        name: 'Imaging-service / cart ultrasound',
        body: 'Typology for radiology or services with scheduled study load. More emphasis on agenda flow and sustained image quality.',
        problems: [
          'Real studies/day?',
          'Specialty mix on one system?',
          'Space, power and operator ergonomics?',
        ],
      },
      {
        name: 'Specialty profiles (OB/GYN, vascular, etc.)',
        body: 'When a service needs typology oriented to a clinical profile. Avoids buying an “all-in-one” nobody masters.',
        problems: [
          'Dominant clinical profile?',
          'Specific training available?',
          'Shared vs dedicated probes?',
        ],
      },
    ],
    problemTitle: 'Weekly questions on institutional ultrasound',
    problemBody:
      'Systems nobody uses well, wrong probes, POC treated as radiology (or reverse) and projects without a training plan.',
    solutionsTitle: 'How we land it',
    solutions: [
      {
        pain: 'Buying by brochure specs',
        help: 'Typify POC vs imaging vs clinical profile first.',
      },
      {
        pain: 'No probe plan',
        help: 'Define minimum set per service protocol.',
      },
      {
        pain: 'Improvised training',
        help: 'Include training scope in I-ME proposal.',
      },
    ],
    audienceYes: ['ER, ICU, OB/GYN, radiology', 'Imaging biomed', 'IPS opening ultrasound'],
    audienceNo: ['Non-clinical aesthetic use', 'Patients', 'Manufacturer contact'],
    situations: [
      {
        title: 'POC in ER',
        body: 'Mobile typology + minimum probes.',
      },
      {
        title: 'Imaging service',
        body: 'Cart / agenda flow.',
      },
      {
        title: 'Dedicated specialty',
        body: 'Typified clinical profile.',
      },
    ],
    scopeTitle: 'Scope',
    scope: ['Real use and operator', 'Typology and probes', 'Training', 'Proposal'],
    requirementsTitle: 'Minimums',
    requirements: ['Service', 'Estimated volume', 'Horizon'],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why no Advanced ultrasound units listed?',
        a: 'Typology education and SEO problems. References in advisory.',
      },
      {
        q: 'POC or radiology system?',
        a: 'Depends on who operates and what the study decides. We separate with your flow.',
      },
    ],
    projectOptions: [
      { value: 'poc', label: 'Point-of-care' },
      { value: 'imagen', label: 'Imaging service' },
      { value: 'especialidad', label: 'Specialty profile' },
      { value: 'orientacion', label: 'Orientation' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'ultrasonido',
  },
};

const M_LINE: Record<Locale, FabCopy> = {
  es: {
    tag: 'Infusión · M',
    title: 'Bombas de infusión: tipologías de terapia IV | I-ME Colombia',
    description:
      '¿Seguridad de medicación y flota de bombas? Tipologías volumétrica/jeringa, alarmas y estandarización UCI/piso. Orientación I-ME — sin listado de productos.',
    h1: 'Cuando la terapia IV pide tipología clara — no “más bombas”',
    lead: 'La línea M se asocia a tipologías de bombas de infusión. Explicamos problemas de seguridad, alarmas y flota que pregunta enfermería y biomédica — sin fotos ni fichas.',
    formIntro: 'Indique servicios (UCI, piso, quirófano), tamaño de flota y horizonte.',
    primaryCta: 'Orientar tipología de infusión',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia soluciones IV',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Entorno de terapia IV hospitalaria — tipologías I-ME Colombia',
    brandName: 'M',
    brandProfileTitle: 'Especialidad: tipologías de infusión y terapia IV',
    brandProfileBody:
      'Línea orientada a bombas de infusión institucionales. Contenido de tipología y seguridad de medicación. Sin productos expuestos ni contactos del fabricante.',
    typologiesTitle: 'Tipologías de bomba que pregunta el sector',
    typologiesIntro:
      'Enfermería no pregunta por “el modelo”: pregunta por alarmas, tipificación volumétrica vs jeringa, sets y quién capacita al turno.',
    typologies: [
      {
        name: 'Bombas volumétricas',
        body: 'Tipología para volúmenes mayores y terapias continuas en piso/UCI. Variables: precisión usable, biblioteca de fármacos (si aplica), alarmas y sets compatibles.',
        problems: [
          '¿Qué terapias dominan el servicio?',
          '¿Cómo se gestionan alarmas en turno corto de personal?',
          '¿Estandarizar sets y consumibles?',
          '¿Capacitación por tipología, no por “botones”?',
        ],
      },
      {
        name: 'Bombas de jeringa',
        body: 'Tipología para dosis precisas y volúmenes bajos (críticos, anestesia, pediatría). Confusión típica: usar volumétrica donde corresponde jeringa.',
        problems: [
          '¿Qué servicios requieren jeringa sí o sí?',
          '¿Flota mixta manejable en capacitación?',
          '¿Protocolo de cambio de jeringa/seguro?',
        ],
      },
      {
        name: 'Estandarización de flota IV',
        body: 'Más que un equipo: tipología institucional para reducir errores y stock. Incluye criterios de reemplazo y soporte.',
        problems: [
          '¿Cuántas tipologías distintas tolera la institución?',
          '¿Plan de reemplazo por obsolescencia?',
          '¿Quién es dueño del protocolo de uso?',
        ],
      },
    ],
    problemTitle: 'Problemas IV que escucha el sector cada semana',
    problemBody:
      'Alarmas que se silencian, flotas mezcladas, sets incorrectos, capacitación informal y compras urgentes que rompen el estándar de seguridad.',
    solutionsTitle: 'Cómo ayudamos',
    solutions: [
      {
        pain: 'Comprar bombas sin tipificar servicio',
        help: 'Separar volumétrica vs jeringa vs contexto UCI/piso.',
      },
      {
        pain: 'Flota imposible de entrenar',
        help: 'Reducir tipologías y estandarizar con I-ME.',
      },
      {
        pain: 'Consumibles olvidados',
        help: 'Incluir sets/criterios en la conversación de proyecto.',
      },
    ],
    audienceYes: [
      'UCI, piso y quirófano',
      'Enfermería / seguridad del paciente',
      'Biomédica de infusión',
    ],
    audienceNo: ['Uso domiciliario particular', 'Pacientes', 'Contacto fabricante'],
    situations: [
      {
        title: 'Renovación de flota IV',
        body: 'Tipologías mínimas por servicio.',
      },
      {
        title: 'Apertura de UCI',
        body: 'Volumétrica + jeringa tipificadas.',
      },
      {
        title: 'Incidentes de medicación',
        body: 'Revisar tipología y capacitación, no solo “más equipos”.',
      },
    ],
    scopeTitle: 'Alcance',
    scope: [
      'Mapa de terapias por servicio',
      'Criterios de tipología IV',
      'Estandarización y formación',
      'Propuesta',
    ],
    requirementsTitle: 'Mínimos',
    requirements: ['Servicios', 'Tamaño de flota aproximado', 'Horizonte'],
    processTitle: 'Cómo trabajamos con usted',
    processSteps: [
      'Comparte el contexto clínico-operativo (servicio, volumen, plazo)',
      'Priorizamos por tipología y horizonte de compra',
      'Orientamos criterios de selección sin empujar ficha suelta',
      'Si encaja: propuesta consultiva con alcance de instalación y soporte',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal I-ME.',
    evidenceNote:
      'Separamos tipología, capacidad documentable y lo que depende del sitio. Sin promesas clínicas ni ROI inventado. Contacto solo con I-ME — sin datos del fabricante.',
    faqs: [
      {
        q: '¿Por qué no hay bombas M listadas?',
        a: 'Priorizamos tipologías y preguntas de seguridad IV. Referencias en asesoría.',
      },
      {
        q: '¿Volumétrica o jeringa?',
        a: 'Depende de volumen, servicio y protocolo. Lo definimos con su mix.',
      },
      {
        q: '¿Contacto del fabricante?',
        a: 'No. Canal I-ME.',
      },
    ],
    projectOptions: [
      { value: 'renovacion_flota', label: 'Renovación de flota' },
      { value: 'uci', label: 'UCI' },
      { value: 'piso', label: 'Piso / hospitalización' },
      { value: 'orientacion', label: 'Orientación' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'soluciones-iv',
  },
  en: {
    tag: 'Infusion · M',
    title: 'Infusion pumps: IV therapy typologies | I-ME Colombia',
    description:
      'Medication safety and pump fleets? Volumetric/syringe typologies, alarms and ICU/ward standardization. I-ME — no product list.',
    h1: 'When IV therapy needs clear typology — not “more pumps”',
    lead: 'The M line associates with infusion-pump typologies. We explain safety, alarm and fleet problems nursing and biomed ask — no photos or sheets.',
    formIntro: 'Share services (ICU, ward, OR), fleet size and horizon.',
    primaryCta: 'Guide infusion typology',
    secondaryCta: 'WhatsApp us',
    tertiaryCta: 'Browse IV solutions family',
    heroImage: '/assets/img/hospital-uci-pasillo.webp',
    heroImageAlt: 'Hospital IV therapy environment — typologies I-ME Colombia',
    brandName: 'M',
    brandProfileTitle: 'Specialty: infusion and IV therapy typologies',
    brandProfileBody:
      'Line oriented to institutional infusion pumps. Typology and medication-safety content. No exposed products or manufacturer contacts.',
    typologiesTitle: 'Pump typologies the sector asks about',
    typologiesIntro:
      'Nursing does not ask for “the model”: they ask about alarms, volumetric vs syringe typing, sets and who trains the shift.',
    typologies: [
      {
        name: 'Volumetric pumps',
        body: 'Typology for larger volumes and continuous therapies on ward/ICU. Variables: usable accuracy, drug library (if any), alarms and compatible sets.',
        problems: [
          'Which therapies dominate the service?',
          'How are alarms managed with short staffing?',
          'Standardize sets and consumables?',
          'Train by typology, not by “buttons”?',
        ],
      },
      {
        name: 'Syringe pumps',
        body: 'Typology for precise doses and low volumes (critical, anesthesia, pediatrics). Typical mistake: using volumetric where syringe belongs.',
        problems: [
          'Which services require syringe for sure?',
          'Is mixed fleet trainable?',
          'Syringe change / safety protocol?',
        ],
      },
      {
        name: 'IV fleet standardization',
        body: 'More than a device: institutional typology to cut errors and stock. Includes replacement and support criteria.',
        problems: [
          'How many distinct typologies can the institution tolerate?',
          'Obsolescence replacement plan?',
          'Who owns the use protocol?',
        ],
      },
    ],
    problemTitle: 'IV problems the sector hears weekly',
    problemBody:
      'Silenced alarms, mixed fleets, wrong sets, informal training and urgent buys that break the safety standard.',
    solutionsTitle: 'How we help',
    solutions: [
      {
        pain: 'Buying pumps without typing the service',
        help: 'Separate volumetric vs syringe vs ICU/ward context.',
      },
      {
        pain: 'Untrainable fleet',
        help: 'Reduce typologies and standardize with I-ME.',
      },
      {
        pain: 'Forgotten consumables',
        help: 'Include sets/criteria in the project talk.',
      },
    ],
    audienceYes: ['ICU, ward and OR', 'Nursing / patient safety', 'Infusion biomed'],
    audienceNo: ['Home individual use', 'Patients', 'Manufacturer contact'],
    situations: [
      {
        title: 'IV fleet renewal',
        body: 'Minimum typologies per service.',
      },
      {
        title: 'New ICU',
        body: 'Volumetric + syringe typified.',
      },
      {
        title: 'Medication incidents',
        body: 'Review typology and training — not only more devices.',
      },
    ],
    scopeTitle: 'Scope',
    scope: [
      'Therapy map by service',
      'IV typology criteria',
      'Standardization and training',
      'Proposal',
    ],
    requirementsTitle: 'Minimums',
    requirements: ['Services', 'Approx. fleet size', 'Horizon'],
    processTitle: 'How we work with you',
    processSteps: [
      'Share the clinical-operational context (service, volume, timeline)',
      'We prioritize by typology and purchase horizon',
      'We guide selection criteria without pushing a loose datasheet',
      'If it fits: consultative proposal with installation and support scope',
    ],
    financingNote:
      'Indicative institutional financing by project. Terms in a formal I-ME proposal.',
    evidenceNote:
      'We separate typology, documentable capability and site-dependent factors. No clinical promises or invented ROI. Contact only via I-ME — no manufacturer contact data.',
    faqs: [
      {
        q: 'Why no M pumps listed?',
        a: 'We prioritize IV typologies and safety questions. References in advisory.',
      },
      {
        q: 'Volumetric or syringe?',
        a: 'Depends on volume, service and protocol. We define with your mix.',
      },
      {
        q: 'Manufacturer contact?',
        a: 'No. I-ME channel.',
      },
    ],
    projectOptions: [
      { value: 'renovacion_flota', label: 'Fleet renewal' },
      { value: 'uci', label: 'ICU' },
      { value: 'piso', label: 'Ward' },
      { value: 'orientacion', label: 'Orientation' },
    ],
    productSlugs: [],
    productsTitle: '',
    productsNote: '',
    catalogFilter: 'soluciones-iv',
  },
};

const CONTENT: Record<FabricanteLandingId, Record<Locale, FabCopy>> = {
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

const SLUG_TO_ID = new Map<string, FabricanteLandingId>(
  Object.values(META).flatMap(m => [
    [m.slug, m.id],
    [m.slugEn, m.id],
  ])
);

export function getFabricanteLandingIdBySlug(slug: string): FabricanteLandingId | undefined {
  return SLUG_TO_ID.get(slug);
}

export function listFabricanteSlugs(): string[] {
  return Object.values(META).map(m => m.slug);
}

export function getFabricanteLanding(
  id: FabricanteLandingId,
  locale: Locale
): CampaignLandingContent {
  const meta = META[id];
  const copy = CONTENT[id][locale];
  const hubPath = locale === 'en' ? '/en/manufacturers/' : '/es/fabricantes/';
  const hubLabel = locale === 'en' ? 'Manufacturers' : 'Fabricantes';
  return {
    ...copy,
    id,
    familia_slug: meta.familia_slug,
    tipo_slug: meta.tipo_slug,
    path: `/es/fabricantes/${meta.slug}/`,
    pathEn: `/en/manufacturers/${meta.slugEn}/`,
    hubPath,
    hubLabel,
  };
}

export function listFabricanteLandings(locale: Locale): CampaignLandingContent[] {
  return (Object.keys(META) as FabricanteLandingId[]).map(id => getFabricanteLanding(id, locale));
}
