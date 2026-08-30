/**
 * Landings consultivas B2B — copy amigable, SEO orientado a intención
 * de profesionales (quirófano, central, imagen, robótica).
 * Solo productos/slugs verificados en catálogo. Sin claims clínicos inventados.
 */
import type { CampaignLandingId, FabricanteLandingId } from '../lib/comercial-leads';
import type { Locale } from '../i18n/utils';

export interface CampaignFaq {
  q: string;
  a: string;
}

export interface CampaignOption {
  value: string;
  label: string;
}

export interface PainSolution {
  pain: string;
  help: string;
}

/** Tipología de producto (SEO consultivo) — sin ficha ni foto de catálogo */
export interface TypologyItem {
  name: string;
  body: string;
  problems: string[];
}

export interface CampaignLandingContent {
  id: CampaignLandingId;
  familia_slug: string;
  tipo_slug?: string;
  path: string;
  pathEn: string;
  /** Breadcrumb hub override (p. ej. /es/fabricantes/) */
  hubPath?: string;
  hubLabel?: string;
  /** Perfil de marca en texto — sin logo ni contacto del fabricante */
  brandName?: string;
  brandProfileTitle?: string;
  brandProfileBody?: string;
  typologiesTitle?: string;
  typologiesIntro?: string;
  typologies?: TypologyItem[];
  /** Visible eyebrow */
  tag: string;
  /** <title> + OG */
  title: string;
  /** meta description ~150–160 chars */
  description: string;
  h1: string;
  /** Subhead under H1 — spoken, human */
  lead: string;
  /** Short line above form */
  formIntro: string;
  primaryCta: string;
  secondaryCta: string;
  tertiaryCta: string;
  heroImage: string;
  heroImageAlt: string;
  problemTitle: string;
  problemBody: string;
  solutionsTitle: string;
  solutions: PainSolution[];
  audienceYes: string[];
  audienceNo: string[];
  situations: { title: string; body: string }[];
  scopeTitle: string;
  scope: string[];
  requirementsTitle: string;
  requirements: string[];
  financingNote: string;
  evidenceNote: string;
  processTitle: string;
  processSteps: string[];
  faqs: CampaignFaq[];
  projectOptions: CampaignOption[];
  productSlugs: string[];
  productsTitle: string;
  productsNote: string;
  catalogFilter?: string;
}

type Copy = Omit<
  CampaignLandingContent,
  'id' | 'familia_slug' | 'tipo_slug' | 'path' | 'pathEn' | 'productSlugs' | 'catalogFilter'
> & {
  productSlugs: string[];
  catalogFilter?: string;
};

type ContentMap = Record<Locale, Copy>;

const TORRES: ContentMap = {
  es: {
    tag: 'Quirófano',
    title: 'Torre de laparoscopia 4K y FHD para quirófano | Asesoría I-ME Colombia',
    description:
      '¿Renueva o arma su torre de laparoscopia? Le ayudamos a elegir entre 4K y FHD según su sala, con instalación y capacitación. Hable con un asesor I-ME.',
    h1: 'Su quirófano merece una torre que el equipo quiera usar',
    lead: 'Si está abriendo sala, pasando de FHD a 4K o estandarizando una segunda torre, lo acompañamos a decidir con calma: imagen clara, flujo de sala y soporte después de la compra.',
    formIntro:
      'Cuéntenos cómo es su sala y en qué plazo piensa moverse. Un asesor le responde con contexto — no con un catálogo genérico.',
    primaryCta: 'Quiero orientación para mi sala',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver torres en catálogo',
    heroImage: '/assets/img/torre-laparoscopia-quirofano-colombia.webp',
    heroImageAlt: 'Torre de laparoscopia en quirófano para mínima invasión — I-ME Colombia',
    problemTitle: 'Lo que suelen preguntar jefes de quirófano y biomédicos',
    problemBody:
      'No buscan “un monitor bonito”. Buscan ver mejor en laparoscopia y endoscopia, menos fatiga visual en jornadas largas, y un proveedor que instale, capacite y responda cuando la sala no puede parar.',
    solutionsTitle: 'Cómo le ayudamos en la práctica',
    solutions: [
      {
        pain: 'La imagen se ve opaca o el equipo duda entre FHD y 4K',
        help: 'Comparamos en lenguaje de sala la Torre 4K SonoScape SV-M4K120 y la FHD X-2600, según tipo de procedimientos y presupuesto del proyecto.',
      },
      {
        pain: 'Temen comprar y quedar solos en la instalación',
        help: 'Orientamos el alcance de puesta en marcha y capacitación para que el personal sepa operar el sistema desde el primer día acordado.',
      },
      {
        pain: 'Necesitan financiar sin frenar el cronograma de sala',
        help: 'Si aplica, revisamos planes de adquisición orientativos para instituciones y dejamos condiciones claras en propuesta formal.',
      },
    ],
    audienceYes: [
      'Clínicas e IPS con quirófano en apertura o renovación',
      'Ingeniería biomédica y compras que arman un proyecto real',
      'Cirugía general, gineco, urología u ORL que operan por mínima invasión',
    ],
    audienceNo: [
      'Pacientes o particulares',
      'Pedidos de empleo, cursos o manuales PDF',
      'Reparación “casera” sin institución detrás',
    ],
    situations: [
      {
        title: 'Primera torre o sala nueva',
        body: 'Arrancan laparoscopia institucional y necesitan una base confiable, no un experimento.',
      },
      {
        title: 'De FHD a 4K',
        body: 'El equipo ya opera y quiere más detalle de imagen sin reinventar todo el flujo.',
      },
      {
        title: 'Segunda sala igual',
        body: 'Quieren estandarizar para que el personal rote entre quirófanos sin sorpresas.',
      },
    ],
    scopeTitle: 'Qué incluye trabajar el proyecto con I-ME',
    scope: [
      'Conversación previa para entender su sala y sus procedimientos',
      'Alternativas reales del catálogo (hoy: SonoScape 4K y FHD)',
      'Instalación y puesta en marcha cuando el proyecto lo contemple',
      'Capacitación al personal según el alcance acordado',
      'Soporte y garantía según la propuesta formal',
    ],
    requirementsTitle: 'Para orientarle bien, nos ayuda saber…',
    requirements: [
      'Nombre de la institución y ciudad',
      'Si es torre nueva, upgrade o segunda sala',
      'En qué plazo piensan decidir (meses)',
      'Una frase sobre lo que hoy les duele en imagen o flujo',
    ],
    financingNote:
      'Muchas instituciones financian la torre junto con el resto del proyecto de sala. En I-ME compartimos planes orientativos; las condiciones finales van en propuesta formal. Detalle en la página de financiación.',
    evidenceNote:
      'Hablamos de lo que está en las fichas del catálogo (arquitectura, aplicaciones publicadas). No prometemos tiempos quirúrgicos ni resultados clínicos: eso depende del equipo médico y de cada caso.',
    processTitle: 'Así fluye la conversación',
    processSteps: [
      'Usted nos cuenta el proyecto en dos pasos cortos',
      'Priorizamos según su plazo (urgente, este año, o explorando)',
      'Un asesor le escribe o llama con contexto de su sala',
      'Si encaja, armamos orientación de modelos y, cuando toque, cotización',
    ],
    faqs: [
      {
        q: '¿Todavía no tengo presupuesto cerrado. Puedo escribirles igual?',
        a: 'Sí. Muchos proyectos empiezan por entender FHD vs 4K y qué implica instalar. El presupuesto se afina después.',
      },
      {
        q: '¿Qué torres tienen hoy en catálogo?',
        a: 'Torre de Laparoscopia 4K SonoScape SV-M4K120 y Torre FHD SonoScape X-2600. Le ayudamos a ver cuál encaja con su sala.',
      },
      {
        q: '¿La mesa de cirugía o la lámpara van en esta misma página?',
        a: 'Aquí nos centramos en la torre de video. Mesas y lámparas las vemos en quirófano / catálogo para no mezclar decisiones.',
      },
      {
        q: '¿En cuánto tiempo me responden?',
        a: 'Si su compra es en 0–3 meses, buscamos contactarle el mismo día hábil. Si el proyecto es más largo, le damos seguimiento sin saturarle.',
      },
    ],
    projectOptions: [
      { value: 'nueva_torre', label: 'Primera torre / sala nueva' },
      { value: 'upgrade_resolucion', label: 'Pasar de FHD a 4K (u otro upgrade)' },
      { value: 'segunda_sala', label: 'Segunda sala / estandarizar' },
      { value: 'reemplazo', label: 'Reemplazar torre actual' },
      { value: 'comparativo', label: 'Solo quiero comparar opciones' },
    ],
    productSlugs: [
      'torre-laparoscopia-4k-sonoscape-sv-m4k120',
      'torre-laparoscopia-fhd-sonoscape-x2600',
    ],
    productsTitle: 'Dos caminos claros en catálogo',
    productsNote:
      'Fichas reales, sin inventar specs. Entre a cada modelo si quiere detalle técnico; aquí le ayudamos a decidir con mirada de proyecto.',
    catalogFilter: 'sala-cirugia',
  },
  en: {
    tag: 'Operating room',
    title: '4K & FHD laparoscopy towers for the OR | I-ME advisory Colombia',
    description:
      'Renewing or building a laparoscopy tower? We help you choose 4K or FHD for your OR, with installation and training. Talk to an I-ME advisor.',
    h1: 'Your OR deserves a tower the team actually wants to use',
    lead: 'Opening a room, moving from FHD to 4K, or standardizing a second tower? We help you decide calmly: clear image, room workflow, and support after purchase.',
    formIntro:
      'Tell us about your room and timeline. An advisor replies with context — not a generic catalog dump.',
    primaryCta: 'I want guidance for my OR',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See towers in catalog',
    heroImage: '/assets/img/torre-laparoscopia-quirofano-colombia.webp',
    heroImageAlt: 'Laparoscopy tower in the OR for minimally invasive surgery — I-ME Colombia',
    problemTitle: 'What OR leads and biomeds usually ask',
    problemBody:
      'They are not shopping for “a nice monitor.” They need better visualization in laparoscopy/endoscopy, less eye strain on long lists, and a partner who installs, trains and answers when the room cannot stop.',
    solutionsTitle: 'How we help in practice',
    solutions: [
      {
        pain: 'Image looks flat, or the team is unsure between FHD and 4K',
        help: 'We compare the SonoScape 4K SV-M4K120 and FHD X-2600 in OR language, by procedure mix and project budget.',
      },
      {
        pain: 'Fear of buying and being alone at install',
        help: 'We scope commissioning and training so staff can run the system from the agreed go-live day.',
      },
      {
        pain: 'Need financing without freezing the OR timeline',
        help: 'When it fits, we review indicative acquisition plans for institutions; final terms land in a formal proposal.',
      },
    ],
    audienceYes: [
      'Clinics opening or renewing an OR',
      'Biomedical engineering and procurement with a real project',
      'General surgery, GYN, urology or ENT working MIS',
    ],
    audienceNo: [
      'Patients or individuals',
      'Job, course or PDF-manual requests',
      'Home repair with no institution behind it',
    ],
    situations: [
      {
        title: 'First tower or new room',
        body: 'Starting institutional laparoscopy on a reliable base — not an experiment.',
      },
      {
        title: 'FHD to 4K',
        body: 'The team already operates and wants more detail without redesigning the whole flow.',
      },
      {
        title: 'Second matching room',
        body: 'Standardize so staff can rotate between ORs without surprises.',
      },
    ],
    scopeTitle: 'What working the project with I-ME includes',
    scope: [
      'A prior conversation about your room and procedures',
      'Real catalog alternatives (today: SonoScape 4K and FHD)',
      'Installation and commissioning when the project includes them',
      'Staff training per agreed scope',
      'Support and warranty per formal proposal',
    ],
    requirementsTitle: 'To guide you well, it helps to know…',
    requirements: [
      'Institution name and city',
      'New tower, upgrade or second room',
      'Decision timeline in months',
      'One sentence on what hurts today in image or workflow',
    ],
    financingNote:
      'Many institutions finance the tower with the broader OR project. I-ME shares indicative plans; final terms are in a formal proposal. See the financing page.',
    evidenceNote:
      'We stick to catalog sheets (architecture, published applications). We do not promise OR times or clinical outcomes — those depend on the clinical team and each case.',
    processTitle: 'How the conversation flows',
    processSteps: [
      'You share the project in two short steps',
      'We prioritize by your timeline',
      'An advisor writes or calls with room context',
      'If it fits, we guide models and quote when ready',
    ],
    faqs: [
      {
        q: 'No closed budget yet — can I still reach out?',
        a: 'Yes. Many projects start by understanding FHD vs 4K and install implications. Budget comes next.',
      },
      {
        q: 'Which towers are in the catalog today?',
        a: '4K SonoScape SV-M4K120 and FHD SonoScape X-2600. We help you see which fits your room.',
      },
      {
        q: 'Do tables or lights belong on this page?',
        a: 'This page focuses on the video tower. Tables and lights live under OR / catalog so decisions stay clear.',
      },
      {
        q: 'How fast do you reply?',
        a: 'If purchase is in 0–3 months, we aim for same business day. Longer projects get consultative follow-up without spam.',
      },
    ],
    projectOptions: [
      { value: 'nueva_torre', label: 'First tower / new room' },
      { value: 'upgrade_resolucion', label: 'FHD to 4K (or other upgrade)' },
      { value: 'segunda_sala', label: 'Second room / standardize' },
      { value: 'reemplazo', label: 'Replace current tower' },
      { value: 'comparativo', label: 'I only want to compare options' },
    ],
    productSlugs: [
      'torre-laparoscopia-4k-sonoscape-sv-m4k120',
      'torre-laparoscopia-fhd-sonoscape-x2600',
    ],
    productsTitle: 'Two clear catalog paths',
    productsNote:
      'Real product sheets — no invented specs. Open each model for technical detail; here we help you decide as a project.',
    catalogFilter: 'sala-cirugia',
  },
};

const ESTERILIZACION: ContentMap = {
  es: {
    tag: 'Central de esterilización',
    title: 'Autoclave hospitalario y equipos de esterilización | Asesoría I-ME',
    description:
      '¿Autoclave nuevo, reemplazo o ampliar la central? Le orientamos por volumen y espacio (5075, T-Max 6 y más). Asesoría I-ME para clínicas en Colombia.',
    h1: 'Cuando la central no da abasto, el problema no es “un autoclave barato”',
    lead: 'Si la carga se atasca, el equipo espera canastas o están abriendo/ampliando central, le ayudamos a dimensionar vapor, flujo y —si aplica— desinfección de alto nivel, con instalación y soporte claros.',
    formIntro:
      'Cuéntenos volumen aproximado, espacio y si es compra nueva o reemplazo. Le respondemos en clave de central, no de catálogo suelto.',
    primaryCta: 'Necesito orientar mi central',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver equipos de esterilización',
    heroImage: '/assets/img/esterilizacion-central-hospitalaria-colombia.webp',
    heroImageAlt: 'Central de esterilización hospitalaria con autoclave — I-ME Colombia',
    problemTitle: 'Dolores reales de central, CSS y biomédica',
    problemBody:
      'El riesgo no es solo “falló el ciclo”. Es cola de material, espacio mal aprovechado, o comprar un equipo que no cabe ni en metros ni en rutina del personal.',
    solutionsTitle: 'Cómo destrabamos el proyecto',
    solutions: [
      {
        pain: 'Alto volumen y necesitan cámara grande con doble puerta',
        help: 'Revisamos el Autoclave Horizontal 5075 (1010 L, doble puerta) cuando el flujo hospitalario lo exige.',
      },
      {
        pain: 'Central compacta o clínica con menos espacio',
        help: 'Orientamos el Autoclave T-Max 6 (430 L) cuando buscan capacidad seria en menor huella.',
      },
      {
        pain: 'Además del vapor, preocupa la desinfección ambiental',
        help: 'Si el proyecto lo pide, presentamos el Automate Saniswiss de desinfección de alto nivel — sin prometer “cero infecciones”.',
      },
    ],
    audienceYes: [
      'Clínicas, IPS y centrales de esterilización',
      'Compras / biomédica armando CapEx de central',
      'Proyectos de autoclave, ampliación o desinfección de alto nivel',
    ],
    audienceNo: [
      'Uso doméstico o particular',
      'Quienes buscan solo químicos sin un proyecto de equipo',
      'Promesas mágicas de eliminar por completo las IAAS',
    ],
    situations: [
      {
        title: 'Autoclave nuevo',
        body: 'Montan o formalizan capacidad de vapor y necesitan acertar tamaño.',
      },
      {
        title: 'Reemplazo',
        body: 'El equipo actual ya no acompaña el volumen o está al final de vida útil.',
      },
      {
        title: 'Ampliar la central',
        body: 'Más carga, mejor flujo entre zonas o redundancia para no parar.',
      },
    ],
    scopeTitle: 'Qué cubrimos con usted',
    scope: [
      'Escucha del volumen, espacio y rutina actual',
      'Alternativas CapEx del catálogo (autoclaves y, si aplica, desinfección)',
      'Instalación y puesta en marcha cuando el proyecto lo incluye',
      'Capacitación y soporte según propuesta formal',
      'Financiación orientativa institucional cuando encaje',
    ],
    requirementsTitle: 'Datos que aceleran una buena orientación',
    requirements: [
      'Institución y ciudad',
      'Autoclave, ampliación, desinfección o “aún no sé”',
      'Horizonte de compra',
      'Una nota sobre volumen, espacio o dolor actual',
    ],
    financingNote:
      'La central suele ser inversión fuerte. Compartimos planes orientativos para instituciones; lo contractual va en propuesta. Vea también la página de financiación.',
    evidenceNote:
      'Volúmenes de cámara y descripciones salen de las fichas publicadas. No afirmamos cumplimiento normativo automático ni eliminación total de infecciones asociadas a la atención.',
    processTitle: 'Paso a paso',
    processSteps: [
      'Nos cuenta el escenario de su central',
      'Clasificamos urgencia según su plazo',
      'Un asesor responde con contexto',
      'Orientamos equipos y cotizamos cuando el proyecto madura',
    ],
    faqs: [
      {
        q: '¿Qué autoclaves tienen publicados?',
        a: 'Entre otros: Autoclave Horizontal 5075 (1010 L, doble puerta) y Autoclave T-Max 6 (430 L). La conversación parte de su carga y su espacio.',
      },
      {
        q: '¿Los desinfectantes y toallitas son el foco aquí?',
        a: 'No. Esta página prioriza equipos. Los consumibles viven en insumos cuando el protocolo los pide.',
      },
      {
        q: '¿Garantizan que mi central quede “normativamente perfecta”?',
        a: 'No de forma automática. El alcance técnico y documental se acuerda en propuesta con la documentación del fabricante aplicable.',
      },
      {
        q: '¿Sirve si solo estoy explorando?',
        a: 'Sí. Márquelo en el formulario; le enviamos orientación sin seguimiento agresivo.',
      },
    ],
    projectOptions: [
      { value: 'autoclave_nuevo', label: 'Autoclave nuevo' },
      { value: 'reemplazo_autoclave', label: 'Reemplazar autoclave actual' },
      { value: 'ampliacion_central', label: 'Ampliar la central' },
      { value: 'desinfeccion_alto_nivel', label: 'Desinfección de alto nivel (equipo)' },
      { value: 'lavado_flujo', label: 'Lavado / mejorar el flujo' },
      { value: 'orientacion', label: 'Aún no sé — necesito que me orienten' },
    ],
    productSlugs: ['autoclave-horizontal-5075', 't-max-6', 'automate-ref-ahpv1115v-saniswiss'],
    productsTitle: 'Equipos CapEx que sí están en catálogo',
    productsNote:
      'Tres referencias para conversar con datos. Abra la ficha si quiere detalle; aquí decidimos por escenario de central.',
    catalogFilter: 'esterilizacion-control-infecciones',
  },
  en: {
    tag: 'Sterilization central',
    title: 'Hospital autoclave & sterilization equipment | I-ME advisory',
    description:
      'New autoclave, replacement or central expansion? We size by volume and space (5075, T-Max 6 and more). I-ME advisory for clinics in Colombia.',
    h1: 'When the central cannot keep up, the answer is not “the cheapest autoclave”',
    lead: 'If loads backlog, staff wait on baskets, or you are opening/expanding a central, we help size steam, workflow and — when needed — high-level disinfection, with clear install and support.',
    formIntro:
      'Share approximate volume, space and whether this is new or replacement. We reply in central language, not a random catalog dump.',
    primaryCta: 'I need guidance for my central',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See sterilization equipment',
    heroImage: '/assets/img/esterilizacion-central-hospitalaria-colombia.webp',
    heroImageAlt: 'Hospital sterile processing central with autoclave — I-ME Colombia',
    problemTitle: 'Real pains for centrals, CSS and biomeds',
    problemBody:
      'Risk is not only a failed cycle. It is material queues, wasted space, or buying gear that fits neither the floorplan nor staff routine.',
    solutionsTitle: 'How we unblock the project',
    solutions: [
      {
        pain: 'High volume needing a large double-door chamber',
        help: 'We review Horizontal Autoclave 5075 (1010 L, double door) when hospital flow demands it.',
      },
      {
        pain: 'Compact central or clinic with less space',
        help: 'We guide Autoclave T-Max 6 (430 L) when you need serious capacity in a smaller footprint.',
      },
      {
        pain: 'Beyond steam, environmental disinfection matters',
        help: 'When the project asks for it, we present Automate Saniswiss high-level disinfection — without “zero infection” promises.',
      },
    ],
    audienceYes: [
      'Clinics, providers and sterilization centrals',
      'Procurement / biomedical building central CapEx',
      'Autoclave, expansion or high-level disinfection projects',
    ],
    audienceNo: [
      'Home or personal use',
      'Chemicals-only requests with no equipment project',
      'Magic promises to erase all HAIs',
    ],
    situations: [
      {
        title: 'New autoclave',
        body: 'Building or formalizing steam capacity and needing the right size.',
      },
      {
        title: 'Replacement',
        body: 'Current unit cannot keep up with volume or is end-of-life.',
      },
      {
        title: 'Expand the central',
        body: 'More load, better zone flow or redundancy so you do not stop.',
      },
    ],
    scopeTitle: 'What we cover with you',
    scope: [
      'Listen to volume, space and current routine',
      'CapEx catalog alternatives (autoclaves and disinfection when relevant)',
      'Installation and commissioning when included',
      'Training and support per formal proposal',
      'Indicative institutional financing when it fits',
    ],
    requirementsTitle: 'Details that speed good guidance',
    requirements: [
      'Institution and city',
      'Autoclave, expansion, disinfection or “not sure yet”',
      'Purchase horizon',
      'A note on volume, space or current pain',
    ],
    financingNote:
      'Centrals are heavy CapEx. We share indicative institutional plans; contractual terms are in the proposal. See also the financing page.',
    evidenceNote:
      'Chamber volumes and descriptions come from published sheets. We do not claim automatic regulatory compliance or total elimination of healthcare-associated infections.',
    processTitle: 'Step by step',
    processSteps: [
      'You describe your central scenario',
      'We prioritize by your timeline',
      'An advisor replies with context',
      'We guide equipment and quote when the project matures',
    ],
    faqs: [
      {
        q: 'Which autoclaves are published?',
        a: 'Among others: Horizontal Autoclave 5075 (1010 L, double door) and Autoclave T-Max 6 (430 L). Conversation starts from your load and space.',
      },
      {
        q: 'Are disinfectants and wipes the focus here?',
        a: 'No. This page prioritizes equipment. Consumables live under supplies when the protocol needs them.',
      },
      {
        q: 'Do you guarantee a “perfectly compliant” central?',
        a: 'Not automatically. Technical and documentary scope is agreed in the proposal with applicable manufacturer documentation.',
      },
      {
        q: 'Is it OK if I am only exploring?',
        a: 'Yes. Mark it on the form; we share guidance without aggressive chase.',
      },
    ],
    projectOptions: [
      { value: 'autoclave_nuevo', label: 'New autoclave' },
      { value: 'reemplazo_autoclave', label: 'Replace current autoclave' },
      { value: 'ampliacion_central', label: 'Expand the central' },
      { value: 'desinfeccion_alto_nivel', label: 'High-level disinfection (equipment)' },
      { value: 'lavado_flujo', label: 'Wash / improve workflow' },
      { value: 'orientacion', label: 'Not sure yet — please guide me' },
    ],
    productSlugs: ['autoclave-horizontal-5075', 't-max-6', 'automate-ref-ahpv1115v-saniswiss'],
    productsTitle: 'CapEx equipment already in the catalog',
    productsNote:
      'Three references to talk with data. Open the sheet for detail; here we decide by central scenario.',
    catalogFilter: 'esterilizacion-control-infecciones',
  },
};

const IMAGENOLOGIA: ContentMap = {
  es: {
    tag: 'Imagen diagnóstica',
    title: 'Mamografía digital y equipos de imagenología | Renovar con I-ME',
    description:
      'Mamografía digital DM166/DM156, arco en C, DR y ultrasonido: oriente la renovación o apertura de su servicio de imagen con asesoría I-ME en Colombia.',
    h1: 'Renovar imagen no es pedir un catálogo: es acertar modalidad y capacidad',
    lead: 'Si abre, renueva o amplía mamografía, arco en C, rayos X digital o ultrasonido, le ayudamos a aterrizar el proyecto con instalación, capacitación y un plan de adquisición realista.',
    formIntro:
      'Díganos qué servicio quiere mover y en cuánto tiempo. Le respondemos como proyecto de imagen, no como lista de precios.',
    primaryCta: 'Orientar mi proyecto de imagen',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver catálogo de imagenología',
    heroImage: '/assets/img/imagenologia-radiologia-diagnostica-colombia.webp',
    heroImageAlt: 'Sala de imagenología y radiología diagnóstica — I-ME Colombia',
    problemTitle: 'Lo que preocupa a dirección y biomédica de imagen',
    problemBody:
      'Elegir mal la modalidad atrasa habilitación, frustra al personal y congela capital. Preferimos hablar de volumen, sede y horizonte antes de empujar un SKU.',
    solutionsTitle: 'Cómo acompañamos',
    solutions: [
      {
        pain: 'No saben si empiezan por mamografía, arco en C o DR',
        help: 'Ordenamos la conversación por el servicio que quieren habilitar o renovar, con referencias reales del catálogo.',
      },
      {
        pain: 'Temen el vacío entre compra e instalación',
        help: 'Dejamos claro qué contempla puesta en marcha y capacitación en la propuesta.',
      },
      {
        pain: 'Necesitan ultrasonido además de radiología',
        help: 'También cubrimos ultrasonido diagnóstico en catálogo y lo enlazamos al mismo hilo de proyecto.',
      },
    ],
    audienceYes: [
      'Clínicas y centros de imagen en apertura o renovación',
      'IPS que amplían modalidad o sede',
      'Compras / biomédica con proyecto identificable',
    ],
    audienceNo: [
      'Pacientes buscando un estudio',
      'Empleo, cursos o definiciones escolares',
      'Equipos usados sin respaldo institucional',
    ],
    situations: [
      {
        title: 'Abrir el servicio',
        body: 'Primera mamografía, primer arco o primera sala DR en la institución.',
      },
      {
        title: 'Renovar equipo',
        body: 'La modalidad actual ya no acompaña calidad, flujo o soporte.',
      },
      {
        title: 'Ampliar capacidad',
        body: 'Más estudios al día o una modalidad adicional en la misma sede.',
      },
    ],
    scopeTitle: 'Qué hacemos con usted',
    scope: [
      'Escucha del servicio y del horizonte de compra',
      'Referencias del catálogo (arco, mamografía, DR, ultrasonido)',
      'Instalación, capacitación y soporte según propuesta',
      'Financiación orientativa para instituciones',
    ],
    requirementsTitle: 'Para avanzar con sentido',
    requirements: [
      'Institución y ciudad',
      'Apertura, renovación o ampliación',
      'Plazo aproximado',
      'Modalidad o dolor concreto',
    ],
    financingNote:
      'Los proyectos de imagen suelen financiarse. Compartimos planes orientativos; condiciones en propuesta formal.',
    evidenceNote:
      'Solo citamos lo publicado en catálogo. Sin ROI clínico inventado ni promesas de diagnóstico.',
    processTitle: 'Flujo',
    processSteps: [
      'Cuenta el proyecto en el formulario',
      'Priorizamos por plazo',
      'Asesor con contexto de su servicio',
      'Orientación de modalidad y cotización a tiempo',
    ],
    faqs: [
      {
        q: '¿Qué modalidades aparecen en catálogo?',
        a: 'Entre otras: arcos en C, mamografía digital, radiografía DR y ultrasonido diagnóstico.',
      },
      {
        q: '¿El primer paso es pedir precio?',
        a: 'Mejor primero entender el servicio. El precio llega cuando hay contexto de proyecto.',
      },
    ],
    projectOptions: [
      { value: 'apertura', label: 'Abrir un servicio de imagen' },
      { value: 'renovacion', label: 'Renovar equipo actual' },
      { value: 'ampliacion', label: 'Ampliar capacidad o modalidad' },
      { value: 'orientacion', label: 'Aún defino la modalidad' },
    ],
    productSlugs: [
      'mamografo-digital-dm166-series',
      'arco-en-c-alc-280-series',
      'mamografo-digital-dm156-series-angell-technology',
      'sistema-de-rayos-x-dr-montado-en-techo',
      'sistema-de-ultrasonido-dus-5000',
    ],
    productsTitle: 'Algunas referencias para empezar la charla',
    productsNote: 'Ejemplos reales del catálogo. El mix final depende de su sede y volumen.',
    catalogFilter: 'radiologia',
  },
  en: {
    tag: 'Diagnostic imaging',
    title: 'Imaging equipment for clinics | Renew or expand with I-ME',
    description:
      'C-arm, mammography, DR or ultrasound: guide renewal or opening of your imaging service with I-ME advisory in Colombia.',
    h1: 'Renewing imaging is not requesting a catalog — it is nailing modality and capacity',
    lead: 'Opening, renewing or expanding mammography, C-arm, digital X-ray or ultrasound? We help land the project with installation, training and a realistic acquisition plan.',
    formIntro:
      'Tell us which service you want to move and when. We reply as an imaging project, not a price list.',
    primaryCta: 'Guide my imaging project',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See imaging catalog',
    heroImage: '/assets/img/imagenologia-radiologia-diagnostica-colombia.webp',
    heroImageAlt: 'Diagnostic imaging and radiology room — I-ME Colombia',
    problemTitle: 'What imaging leadership and biomeds worry about',
    problemBody:
      'Choosing the wrong modality delays licensing, frustrates staff and freezes capital. We talk volume, site and horizon before pushing a SKU.',
    solutionsTitle: 'How we support you',
    solutions: [
      {
        pain: 'Unsure whether to start with mammography, C-arm or DR',
        help: 'We order the conversation by the service you want to enable or renew, with real catalog references.',
      },
      {
        pain: 'Fear of the gap between purchase and install',
        help: 'We clarify commissioning and training scope in the proposal.',
      },
      {
        pain: 'Need ultrasound besides radiology',
        help: 'Diagnostic ultrasound is also in catalog and joins the same project thread.',
      },
    ],
    audienceYes: [
      'Clinics and imaging centers opening or renewing',
      'Providers expanding modality or site',
      'Procurement / biomedical with an identifiable project',
    ],
    audienceNo: [
      'Patients looking for an exam',
      'Jobs, courses or school definitions',
      'Used gear without institutional backing',
    ],
    situations: [
      {
        title: 'Open the service',
        body: 'First mammography, first C-arm or first DR room at the institution.',
      },
      {
        title: 'Renew equipment',
        body: 'Current modality no longer matches quality, flow or support.',
      },
      {
        title: 'Expand capacity',
        body: 'More studies per day or an extra modality on the same site.',
      },
    ],
    scopeTitle: 'What we do with you',
    scope: [
      'Listen to the service and purchase horizon',
      'Catalog references (C-arm, mammography, DR, ultrasound)',
      'Installation, training and support per proposal',
      'Indicative institutional financing',
    ],
    requirementsTitle: 'To move with purpose',
    requirements: [
      'Institution and city',
      'Opening, renewal or expansion',
      'Approximate timeline',
      'Modality or concrete pain',
    ],
    financingNote:
      'Imaging projects are often financed. We share indicative plans; terms in a formal proposal.',
    evidenceNote:
      'We only cite published catalog data. No invented clinical ROI or diagnostic promises.',
    processTitle: 'Flow',
    processSteps: [
      'Share the project in the form',
      'We prioritize by timeline',
      'Advisor with service context',
      'Modality guidance and quote when ready',
    ],
    faqs: [
      {
        q: 'Which modalities are in the catalog?',
        a: 'Among others: C-arms, digital mammography, DR X-ray and diagnostic ultrasound.',
      },
      {
        q: 'Is the first step requesting a price?',
        a: 'Better understand the service first. Price comes once project context exists.',
      },
    ],
    projectOptions: [
      { value: 'apertura', label: 'Open an imaging service' },
      { value: 'renovacion', label: 'Renew current equipment' },
      { value: 'ampliacion', label: 'Expand capacity or modality' },
      { value: 'orientacion', label: 'Still defining modality' },
    ],
    productSlugs: [
      'mamografo-digital-dm166-series',
      'arco-en-c-alc-280-series',
      'mamografo-digital-dm156-series-angell-technology',
      'sistema-de-rayos-x-dr-montado-en-techo',
      'sistema-de-ultrasonido-dus-5000',
    ],
    productsTitle: 'A few references to start the talk',
    productsNote: 'Real catalog examples. Final mix depends on your site and volume.',
    catalogFilter: 'radiologia',
  },
};

const ROBOTICA: ContentMap = {
  es: {
    tag: 'Robótica institucional',
    title: 'Robots de servicio y apoyo institucional para clínicas | I-ME',
    description:
      '¿Recepción, telepresencia o delivery en su institución? Evalúe robots PadBot y soluciones de movilidad con asesoría I-ME — sin promesas clínicas vacías.',
    h1: 'Robótica que alivia operación — no ciencia ficción en el lobby',
    lead: 'Si exploran recepción automatizada, telepresencia, delivery interno o movilidad para programas institucionales, le ayudamos a ver qué encaja con su flujo real y qué queda fuera.',
    formIntro:
      'Cuéntenos el problema operativo (filas, recorridos, acompañamiento). Le proponemos caminos del catálogo con los pies en la tierra.',
    primaryCta: 'Quiero evaluar una demo u orientación',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver robots en catálogo',
    heroImage: '/assets/img/robotica-rehabilitacion-institucional-colombia.webp',
    heroImageAlt: 'Robótica y rehabilitación en entorno clínico institucional — I-ME Colombia',
    problemTitle: 'Problemas de operación, no de brochure',
    problemBody:
      'Las instituciones nos escriben por filas en recepción, recorridos eternos de insumos o la necesidad de presencia remota. La robótica solo tiene sentido si baja fricción medible.',
    solutionsTitle: 'Caminos que sí existen en catálogo',
    solutions: [
      {
        pain: 'Recepción saturada o experiencia poco clara',
        help: 'Revisamos robots de recepción/servicio PadBot cuando el caso es atención e interacción institucional.',
      },
      {
        pain: 'Necesitan presencia remota o acompañamiento a distancia',
        help: 'Telepresencia PadBot P2 para escenarios donde el valor es conectar personas, no “hacer magia clínica”.',
      },
      {
        pain: 'Logística interna que consume personal',
        help: 'Delivery institucional PadBot W2 u otras referencias según el recorrido real del edificio.',
      },
    ],
    audienceYes: [
      'Clínicas y centros con operación de servicio tangible',
      'Proyectos de recepción, telepresencia, delivery o movilidad',
      'Personas que deciden o influyen en el presupuesto',
    ],
    audienceNo: [
      'Pacientes buscando terapia personal',
      'Quienes piden garantías de resultado clínico o ROI inventado',
      'Curiosidad sin institución',
    ],
    situations: [
      {
        title: 'Robótica de servicio',
        body: 'Recepción, interacción o apoyo en zonas institucionales.',
      },
      {
        title: 'Movilidad / rehab institucional',
        body: 'Equipamiento de movilidad para programas — conversación aparte si es el foco.',
      },
      {
        title: 'Ver antes de comprar',
        body: 'Demo o sesión de evaluación para no comprometer CapEx a ciegas.',
      },
    ],
    scopeTitle: 'Qué ofrecemos con honestidad',
    scope: [
      'Escucha del problema operativo',
      'Alternativas publicadas en catálogo',
      'Demo o evaluación cuando aplique',
      'Instalación, capacitación y soporte según propuesta',
    ],
    requirementsTitle: 'Para no perder el tiempo de nadie',
    requirements: [
      'Institución y ciudad',
      'Tipo de proyecto y plazo',
      'El cuello de botella operativo en una frase',
    ],
    financingNote:
      'Financiación orientativa institucional disponible según proyecto. Condiciones en propuesta formal.',
    evidenceNote:
      'Separamos capacidad del equipo, lo publicado en ficha y lo que puede variar en cada sede. Sin promesas clínicas ni retornos inventados.',
    processTitle: 'Cómo seguimos',
    processSteps: [
      'Nos cuenta el caso',
      'Priorizamos por plazo',
      'Proponemos demo u orientación',
      'Si encaja, cotización consultiva',
    ],
    faqs: [
      {
        q: '¿Qué robots hay publicados?',
        a: 'Línea PadBot (recepción, servicio, telepresencia, delivery) y robot de limpieza autónoma, entre otros del catálogo.',
      },
      {
        q: '¿Garantizan resultados de rehabilitación?',
        a: 'No. Aquí no prometemos outcomes clínicos; hablamos de equipos, implementación y soporte documentados.',
      },
    ],
    projectOptions: [
      { value: 'robot_servicio', label: 'Robótica de servicio / recepción' },
      { value: 'movilidad_rehab', label: 'Movilidad / rehabilitación' },
      { value: 'demo', label: 'Quiero una demostración' },
      { value: 'diseno_servicio', label: 'Diseñar el servicio con ustedes' },
    ],
    productSlugs: [
      'padbot-x3-robot-recepcion',
      'padbot-p2-robot-telepresencia',
      'padbot-w2-robot-delivery-institucional',
      'c3-robot-limpieza-autonoma',
    ],
    productsTitle: 'Referencias para aterrizar la idea',
    productsNote: 'Modelos reales. La demo confirma si encajan en su edificio y protocolo.',
    catalogFilter: 'robots',
  },
  en: {
    tag: 'Institutional robotics',
    title: 'Service robots for clinics & institutions | I-ME Colombia',
    description:
      'Reception, telepresence or delivery at your institution? Evaluate PadBot robots and mobility with I-ME advisory — no empty clinical promises.',
    h1: 'Robotics that eases operations — not science fiction in the lobby',
    lead: 'Exploring automated reception, telepresence, internal delivery or mobility for institutional programs? We help see what fits your real workflow — and what does not.',
    formIntro:
      'Tell us the operational problem (queues, routes, remote presence). We propose grounded catalog paths.',
    primaryCta: 'I want a demo or guidance',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See robots in catalog',
    heroImage: '/assets/img/robotica-rehabilitacion-institucional-colombia.webp',
    heroImageAlt: 'Service robotics and rehabilitation in a clinical setting — I-ME Colombia',
    problemTitle: 'Operations problems, not brochure problems',
    problemBody:
      'Institutions write about reception queues, endless supply routes or remote presence needs. Robotics only makes sense if it cuts measurable friction.',
    solutionsTitle: 'Paths that exist in the catalog',
    solutions: [
      {
        pain: 'Saturated reception or unclear front-desk experience',
        help: 'We review PadBot reception/service robots when the case is institutional interaction.',
      },
      {
        pain: 'Need remote presence or distance accompaniment',
        help: 'PadBot P2 telepresence where the value is connecting people — not “clinical magic.”',
      },
      {
        pain: 'Internal logistics that consumes staff time',
        help: 'PadBot W2 institutional delivery or other references matching the real building route.',
      },
    ],
    audienceYes: [
      'Clinics and centers with tangible service operations',
      'Reception, telepresence, delivery or mobility projects',
      'People who decide or influence budget',
    ],
    audienceNo: [
      'Patients seeking personal therapy',
      'Requests for guaranteed clinical outcomes or invented ROI',
      'Curiosity without an institution',
    ],
    situations: [
      {
        title: 'Service robotics',
        body: 'Reception, interaction or support in institutional zones.',
      },
      {
        title: 'Institutional mobility / rehab',
        body: 'Mobility equipment for programs — separate thread if that is the focus.',
      },
      {
        title: 'See before buying',
        body: 'Demo or evaluation session so CapEx is not blind.',
      },
    ],
    scopeTitle: 'What we offer honestly',
    scope: [
      'Listen to the operational problem',
      'Published catalog alternatives',
      'Demo or evaluation when applicable',
      'Installation, training and support per proposal',
    ],
    requirementsTitle: 'So nobody wastes time',
    requirements: [
      'Institution and city',
      'Project type and timeline',
      'The operational bottleneck in one sentence',
    ],
    financingNote:
      'Indicative institutional financing available by project. Terms in a formal proposal.',
    evidenceNote:
      'We separate equipment capability, published sheet facts and what may vary by site. No clinical promises or invented returns.',
    processTitle: 'How we follow up',
    processSteps: [
      'You share the case',
      'We prioritize by timeline',
      'We propose demo or guidance',
      'If it fits, a consultative quote',
    ],
    faqs: [
      {
        q: 'Which robots are published?',
        a: 'PadBot line (reception, service, telepresence, delivery) and autonomous cleaning robot, among other catalog items.',
      },
      {
        q: 'Do you guarantee rehabilitation outcomes?',
        a: 'No. We do not promise clinical outcomes; we discuss documented equipment, implementation and support.',
      },
    ],
    projectOptions: [
      { value: 'robot_servicio', label: 'Service / reception robotics' },
      { value: 'movilidad_rehab', label: 'Mobility / rehabilitation' },
      { value: 'demo', label: 'I want a demonstration' },
      { value: 'diseno_servicio', label: 'Design the service with you' },
    ],
    productSlugs: [
      'padbot-x3-robot-recepcion',
      'padbot-p2-robot-telepresencia',
      'padbot-w2-robot-delivery-institucional',
      'c3-robot-limpieza-autonoma',
    ],
    productsTitle: 'References to land the idea',
    productsNote: 'Real models. A demo confirms fit for your building and protocol.',
    catalogFilter: 'robots',
  },
};

const MONITORES_BIOLIGHT: ContentMap = {
  es: {
    tag: 'UCI · Monitores Biolight',
    title: 'Monitores Biolight P15 y S12 para UCI | Multiparamétricos | I-ME',
    description:
      'Monitores de paciente Biolight P15 modular y S12 para UCI y áreas críticas en Colombia. Orientación I-ME: parámetros, central y soporte — sin catálogo infinito.',
    h1: 'Monitores Biolight para UCI — P15 modular y S12 con criterio institucional',
    lead: 'Si busca monitor multiparamétrico UCI, Biolight P15 o S12, o está renovando la central de monitoreo, le ayudamos a acotar módulos, alarmas y soporte con referencias reales del catálogo.',
    formIntro:
      'Indique servicio (UCI, urgencias, transporte), cantidad de puntos y si necesita central. Un asesor responde con alternativas Biolight publicadas.',
    primaryCta: 'Quiero orientación de monitores UCI',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver familia monitores',
    heroImage: '/assets/img/monitores-biolight-p15-uci-colombia.webp',
    heroImageAlt: 'Monitor de paciente Biolight P15 modular en UCI — I-ME Colombia',
    problemTitle: 'Lo que suele fallar al comprar monitores UCI',
    problemBody:
      'No es “el que más parámetros en brochure”. Es modularidad real, alarmas usables en turno, central multicama, capacitación y soporte local. Un mismatch genera alarmas ignoradas y CapEx subutilizado.',
    solutionsTitle: 'Cómo acotamos el modelo Biolight',
    solutions: [
      {
        pain: 'Necesitan P15 modular para UCI adulta con expansión futura',
        help: 'Partimos del P15 publicado y definimos módulos obligatorios vs opcionales según protocolo.',
      },
      {
        pain: 'Comparan S12 vs P12 para observación o pasillo crítico',
        help: 'Revisamos criticidad del servicio, transporte y conectividad antes de empujar un SKU.',
      },
      {
        pain: 'Quieren homogeneizar flota sin perder flexibilidad por área',
        help: 'Estructuramos por unidad (UCI, urgencias, recuperación) con el mismo checklist técnico.',
      },
    ],
    audienceYes: [
      'Hospitales e IPS renovando monitoreo en UCI o áreas críticas',
      'Biomédica / compras que buscan Biolight P15, S12 o equivalente documentado',
      'Proyectos con central multicama o expansión por fases',
    ],
    audienceNo: [
      'Pedidos sin servicio ni cantidad de puntos definidos',
      'Quienes exigen claims clínicos inventados o precios de vitrina',
      'Urgencias de marketplace sin institución ni datos de contacto',
    ],
    situations: [
      {
        title: 'Renovación de central UCI',
        body: 'Reemplazo de flota con criterio de modularidad, alarmas y soporte.',
      },
      {
        title: 'Ampliación de camas críticas',
        body: 'Nuevos puntos compatibles con la estación y protocolo existente.',
      },
      {
        title: 'Homologar antes de licitar',
        body: 'Checklist técnico y referencias publicadas para proceso de compra.',
      },
    ],
    scopeTitle: 'Qué cubrimos en esta conversación',
    scope: [
      'Tipología Biolight según servicio y criticidad',
      'Referencias P15, S12, P12 y M12 del catálogo I-ME',
      'Alcance de instalación, capacitación y soporte en propuesta',
      'Financiación orientativa para instituciones',
    ],
    requirementsTitle: 'Para cotizar con sentido',
    requirements: [
      'Servicio y ciudad',
      'Cantidad de puntos y plazo',
      'Parámetros obligatorios (ECG, SpO₂, NIBP, IBP, EtCO₂, etc.)',
      '¿Central multicama o monitores standalone?',
    ],
    financingNote:
      'Proyectos de monitoreo suelen financiarse por fases. Condiciones en propuesta formal.',
    evidenceNote:
      'Hablamos de equipos y fichas publicadas. No prometemos outcomes clínicos ni tiempos de respuesta genéricos.',
    processTitle: 'Cómo seguimos',
    processSteps: [
      'Cuéntenos el servicio en el formulario',
      'Priorizamos por plazo y criticidad',
      'Proponemos 1–3 referencias Biolight del catálogo',
      'Cotización formal con alcance técnico',
    ],
    faqs: [
      {
        q: '¿Tienen monitor Biolight P15 en catálogo?',
        a: 'Sí. El P15 modular está publicado. Confirmamos configuración, módulos y disponibilidad al cotizar.',
      },
      {
        q: '¿Sirve el S12 para UCI?',
        a: 'Depende del protocolo y criticidad. Lo evaluamos contra P15/P12 según parámetros y flujo del servicio.',
      },
      {
        q: '¿Incluyen instalación y capacitación?',
        a: 'El alcance se define en la propuesta según sede, cantidad y central.',
      },
    ],
    projectOptions: [
      { value: 'renovacion_uci', label: 'Renovar monitores UCI' },
      { value: 'ampliacion_camas', label: 'Ampliar puntos de monitoreo' },
      { value: 'central_multicama', label: 'Proyecto con central multicama' },
      { value: 'orientacion', label: 'Aún comparando modelos Biolight' },
    ],
    productSlugs: [
      'monitor-de-paciente-modular-serie-p-ref-p15-biolight',
      'monitor-de-paciente-s12-biolight',
      'monitor-de-paciente-p12-biolight',
      'monitor-de-paciente-m12-biolight',
      'monitor-modular-de-paciente-pm-200m',
    ],
    productsTitle: 'Referencias Biolight con demanda real',
    productsNote: 'Modelos del catálogo I-ME. Configuración y central se confirman al cotizar.',
    catalogFilter: 'monitores',
  },
  en: {
    tag: 'ICU · Biolight monitors',
    title: 'Biolight P15 & S12 ICU patient monitors | Multiparameter | I-ME',
    description:
      'Biolight modular P15 and S12 patient monitors for ICU and critical areas in Colombia. I-ME guidance on parameters, central station and support.',
    h1: 'Biolight monitors for ICU — modular P15 and S12 with institutional criteria',
    lead: 'Looking for an ICU multiparameter monitor, Biolight P15 or S12, or renewing a central station? We help narrow modules, alarms and support with real catalog references.',
    formIntro:
      'Share service (ICU, ED, transport), number of points and whether you need a central station. An advisor replies with published Biolight options.',
    primaryCta: 'I want ICU monitor guidance',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See monitors family',
    heroImage: '/assets/img/monitores-biolight-p15-uci-colombia.webp',
    heroImageAlt: 'Biolight modular P15 patient monitor in ICU — I-ME Colombia',
    problemTitle: 'What usually goes wrong when buying ICU monitors',
    problemBody:
      'It is not “most parameters on the brochure”. It is real modularity, shift-usable alarms, multi-bed central, training and local support. A mismatch yields ignored alarms and underused CapEx.',
    solutionsTitle: 'How we narrow the Biolight model',
    solutions: [
      {
        pain: 'Need modular P15 for adult ICU with future expansion',
        help: 'We start from the published P15 and define mandatory vs optional modules by protocol.',
      },
      {
        pain: 'Comparing S12 vs P12 for observation or critical ward',
        help: 'We review service criticality, transport and connectivity before pushing a SKU.',
      },
      {
        pain: 'Want to homogenize fleet without losing per-area flexibility',
        help: 'We structure by unit (ICU, ED, recovery) with the same technical checklist.',
      },
    ],
    audienceYes: [
      'Hospitals and networks renewing ICU monitoring',
      'Biomed / procurement seeking documented Biolight P15, S12 or equivalent',
      'Projects with multi-bed central or phased expansion',
    ],
    audienceNo: [
      'Orders with no service or point count defined',
      'Requests for invented clinical claims or shelf prices',
      'Marketplace urgency with no institution or contact data',
    ],
    situations: [
      {
        title: 'ICU central renewal',
        body: 'Fleet replacement with modularity, alarms and support criteria.',
      },
      {
        title: 'Critical bed expansion',
        body: 'New points compatible with existing station and protocol.',
      },
      {
        title: 'Homologate before tender',
        body: 'Technical checklist and published references for purchasing.',
      },
    ],
    scopeTitle: 'What this conversation covers',
    scope: [
      'Biolight typology by service and criticality',
      'P15, S12, P12 and M12 references in the I-ME catalog',
      'Install, training and support scope in the proposal',
      'Indicative institutional financing',
    ],
    requirementsTitle: 'To quote meaningfully',
    requirements: [
      'Service and city',
      'Point count and timeline',
      'Mandatory parameters (ECG, SpO₂, NIBP, IBP, EtCO₂, etc.)',
      'Multi-bed central or standalone monitors?',
    ],
    financingNote: 'Monitoring projects are often financed in phases. Terms in a formal proposal.',
    evidenceNote:
      'We discuss published equipment and sheets. No invented clinical outcomes or generic response times.',
    processTitle: 'How we follow up',
    processSteps: [
      'Share the service in the form',
      'We prioritize by timeline and criticality',
      'We propose 1–3 Biolight catalog references',
      'Formal quote with technical scope',
    ],
    faqs: [
      {
        q: 'Do you carry the Biolight P15 monitor?',
        a: 'Yes. The modular P15 is published. We confirm configuration, modules and availability when quoting.',
      },
      {
        q: 'Is the S12 suitable for ICU?',
        a: 'It depends on protocol and criticality. We evaluate it against P15/P12 by parameters and workflow.',
      },
      {
        q: 'Do you include installation and training?',
        a: 'Scope is defined in the proposal by site, quantity and central station.',
      },
    ],
    projectOptions: [
      { value: 'renovacion_uci', label: 'Renew ICU monitors' },
      { value: 'ampliacion_camas', label: 'Expand monitoring points' },
      { value: 'central_multicama', label: 'Multi-bed central project' },
      { value: 'orientacion', label: 'Still comparing Biolight models' },
    ],
    productSlugs: [
      'monitor-de-paciente-modular-serie-p-ref-p15-biolight',
      'monitor-de-paciente-s12-biolight',
      'monitor-de-paciente-p12-biolight',
      'monitor-de-paciente-m12-biolight',
      'monitor-modular-de-paciente-pm-200m',
    ],
    productsTitle: 'Biolight references with real demand',
    productsNote: 'I-ME catalog models. Configuration and central station confirmed when quoting.',
    catalogFilter: 'monitores',
  },
};

const ALTO_FLUJO_FISHER_PAYKEL: ContentMap = {
  es: {
    tag: 'Terapia respiratoria · Alto flujo',
    title: 'Alto flujo Fisher Paykel Airvo y Optiflow | UCI y urgencias | I-ME',
    description:
      'Sistemas de alto flujo Fisher Paykel Airvo 2/3, circuitos Optiflow y cánulas para UCI, neonatología y urgencias en Colombia. Orientación I-ME sin catálogo infinito.',
    h1: 'Alto flujo Fisher Paykel — Airvo y Optiflow con criterio institucional',
    lead: 'Si busca sistema de alto flujo, Airvo 3, circuitos Optiflow o consumibles Fisher Paykel, le ayudamos a acotar equipo principal, interfaces y repuestos con referencias reales del catálogo.',
    formIntro:
      'Indique servicio (UCI, neonatología, urgencias), población y si cotiza equipo, circuitos o ambos. Un asesor responde con alternativas Fisher Paykel publicadas.',
    primaryCta: 'Quiero orientación de alto flujo',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver terapia respiratoria',
    heroImage: '/assets/img/alto-flujo-fisher-paykel-airvo-uci-colombia.webp',
    heroImageAlt: 'Sistema de alto flujo Fisher Paykel Airvo 3 en UCI — I-ME Colombia',
    problemTitle: 'Lo que suele fallar al comprar alto flujo',
    problemBody:
      'No es “el circuito más barato”. Es compatibilidad Airvo ↔ Optiflow, población (adulto/pediátrico), humidificación, consumibles recurrentes y soporte documentado. Un mismatch genera stock inútil y paradas operativas.',
    solutionsTitle: 'Cómo acotamos la solución Fisher Paykel',
    solutions: [
      {
        pain: 'Renovación o primera compra de Airvo para UCI o urgencias',
        help: 'Partimos del Airvo 3 o Airvo 2 publicado y definimos interfaces y circuitos obligatorios según protocolo.',
      },
      {
        pain: 'Reposición de circuitos Optiflow o cánulas sin mezclar referencias',
        help: 'Confirmamos modelo de equipo, talla/población y SKU exacto (RT202, RT330, cánula adulto, etc.).',
      },
      {
        pain: 'Homologar flota antes de licitar o ampliar camas',
        help: 'Estructuramos checklist técnico por servicio con fichas publicadas — sin equivalencias inventadas.',
      },
    ],
    audienceYes: [
      'Hospitales e IPS con UCI, neonatología o urgencias',
      'Biomédica / compras que buscan Fisher Paykel Airvo u Optiflow',
      'Reposición de consumibles con trazabilidad por referencia',
    ],
    audienceNo: [
      'Pedidos sin equipo principal ni población definida',
      'Quienes exigen claims clínicos inventados o precios de vitrina',
      'Compatibilidad “genérica” sin documentación del fabricante',
    ],
    situations: [
      {
        title: 'Equipo + consumibles',
        body: 'Proyecto con Airvo y primera dotación de circuitos Optiflow.',
      },
      {
        title: 'Solo reposición',
        body: 'Circuitos, cánulas o accesorios para flota existente.',
      },
      {
        title: 'Ampliación por fases',
        body: 'Nuevas camas o servicio con el mismo estándar Fisher Paykel.',
      },
    ],
    scopeTitle: 'Qué cubrimos en esta conversación',
    scope: [
      'Tipología Airvo y consumibles según servicio',
      'Referencias Airvo 2/3, Optiflow RT202/RT330 y cánulas del catálogo I-ME',
      'Alcance de instalación, capacitación y soporte en propuesta',
      'Financiación orientativa para instituciones',
    ],
    requirementsTitle: 'Para cotizar con sentido',
    requirements: [
      'Servicio y ciudad',
      'Población (adulto, pediátrico, neonatal)',
      '¿Equipo, consumibles o ambos?',
      'Cantidad y plazo',
    ],
    financingNote:
      'Proyectos respiratorios suelen financiarse por fases. Condiciones en propuesta formal.',
    evidenceNote:
      'Hablamos de equipos y fichas publicadas. No prometemos outcomes clínicos ni tiempos de respuesta genéricos.',
    processTitle: 'Cómo seguimos',
    processSteps: [
      'Cuéntenos el servicio en el formulario',
      'Priorizamos por plazo y criticidad',
      'Proponemos 1–3 referencias Fisher Paykel del catálogo',
      'Cotización formal con alcance técnico',
    ],
    faqs: [
      {
        q: '¿Tienen Airvo 3 Fisher Paykel?',
        a: 'Sí. Airvo 3 y Airvo 2 están publicados. Confirmamos configuración, interfaces y disponibilidad al cotizar.',
      },
      {
        q: '¿Venden solo el circuito Optiflow?',
        a: 'Sí, hay circuitos RT202, RT330 y cánulas Optiflow adulto en catálogo. Indique modelo de equipo y población.',
      },
      {
        q: '¿Los accesorios son intercambiables entre marcas?',
        a: 'No se debe asumir. Validamos compatibilidad por referencia y documentación del fabricante.',
      },
    ],
    projectOptions: [
      { value: 'airvo_equipo', label: 'Compra o renovación Airvo' },
      { value: 'optiflow_consumibles', label: 'Circuitos / cánulas Optiflow' },
      { value: 'proyecto_uci', label: 'Proyecto UCI o urgencias' },
      { value: 'orientacion', label: 'Aún comparando referencias' },
    ],
    productSlugs: [
      'sistema-de-alto-flujo-ref-airvo-3-fisher-paykel',
      'sistema-de-alto-flujo-airvo-2-fisher-paykel',
      'circuito-para-alto-flujo-optiflow-junior-ref-rt330-fisher-paykel',
      'circuito-desechable-para-canula-de-alto-flujo-adulto-ref-rt202-fisher-paykel',
      'canula-nasal-optiflow-adulto-fisher-paykel',
    ],
    productsTitle: 'Referencias Fisher Paykel con demanda real',
    productsNote: 'Modelos del catálogo I-ME. Configuración y consumibles confirmados al cotizar.',
    catalogFilter: 'terapia-respiratoria-soporte-vital',
  },
  en: {
    tag: 'Respiratory therapy · High flow',
    title: 'Fisher Paykel Airvo high flow & Optiflow | ICU & ER | I-ME',
    description:
      'Fisher Paykel Airvo 2/3 high-flow systems, Optiflow circuits and cannulas for ICU, neonatal and emergency care in Colombia. I-ME guidance without an infinite catalog.',
    h1: 'Fisher Paykel high flow — Airvo and Optiflow with institutional criteria',
    lead: 'Searching for a high-flow system, Airvo 3, Optiflow circuits or Fisher Paykel consumables? We help narrow main equipment, interfaces and spares with real catalog references.',
    formIntro:
      'Share service (ICU, neonatal, ER), population and whether you need equipment, circuits or both. An advisor replies with published Fisher Paykel options.',
    primaryCta: 'I want high-flow guidance',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See respiratory therapy',
    heroImage: '/assets/img/alto-flujo-fisher-paykel-airvo-uci-colombia.webp',
    heroImageAlt: 'Fisher Paykel Airvo 3 high-flow system in ICU — I-ME Colombia',
    problemTitle: 'What usually goes wrong when buying high flow',
    problemBody:
      'It is not “cheapest circuit”. It is Airvo ↔ Optiflow compatibility, population (adult/pediatric), humidification, recurring consumables and documented support.',
    solutionsTitle: 'How we scope the Fisher Paykel solution',
    solutions: [
      {
        pain: 'Airvo renewal or first purchase for ICU or ER',
        help: 'We start from published Airvo 3 or Airvo 2 and define mandatory interfaces and circuits by protocol.',
      },
      {
        pain: 'Optiflow circuit or cannula replenishment without mixing SKUs',
        help: 'We confirm equipment model, population/size and exact SKU (RT202, RT330, adult cannula, etc.).',
      },
      {
        pain: 'Fleet standardization before tender or bed expansion',
        help: 'We structure a technical checklist per service with published sheets — no invented equivalents.',
      },
    ],
    audienceYes: [
      'Hospitals and clinics with ICU, neonatal or ER',
      'Biomed / procurement seeking Fisher Paykel Airvo or Optiflow',
      'Consumable replenishment with traceability per SKU',
    ],
    audienceNo: [
      'Orders with no main equipment or population defined',
      'Requests for invented clinical claims or shelf prices',
      '“Generic” compatibility without manufacturer documentation',
    ],
    situations: [
      {
        title: 'Equipment + consumables',
        body: 'Airvo project with first Optiflow circuit allocation.',
      },
      {
        title: 'Replenishment only',
        body: 'Circuits, cannulas or accessories for an existing fleet.',
      },
      {
        title: 'Phased expansion',
        body: 'New beds or service with the same Fisher Paykel standard.',
      },
    ],
    scopeTitle: 'What we cover in this conversation',
    scope: [
      'Airvo typology and consumables by service',
      'Airvo 2/3, Optiflow RT202/RT330 and cannula references in the I-ME catalog',
      'Installation, training and support scope in the proposal',
      'Indicative institutional financing',
    ],
    requirementsTitle: 'To quote with purpose',
    requirements: [
      'Service and city',
      'Population (adult, pediatric, neonatal)',
      'Equipment, consumables or both?',
      'Quantity and timeline',
    ],
    financingNote: 'Respiratory projects are often financed in phases. Terms in a formal proposal.',
    evidenceNote:
      'We discuss published equipment and datasheets. No invented clinical outcomes or generic response times.',
    processTitle: 'How we follow up',
    processSteps: [
      'Share the service in the form',
      'We prioritize by timeline and criticality',
      'We propose 1–3 Fisher Paykel catalog references',
      'Formal quote with technical scope',
    ],
    faqs: [
      {
        q: 'Do you carry Fisher Paykel Airvo 3?',
        a: 'Yes. Airvo 3 and Airvo 2 are published. We confirm configuration, interfaces and availability when quoting.',
      },
      {
        q: 'Do you sell Optiflow circuits only?',
        a: 'Yes. RT202, RT330 circuits and adult Optiflow cannulas are in catalog. Share equipment model and population.',
      },
      {
        q: 'Are accessories interchangeable across brands?',
        a: 'Do not assume so. We validate compatibility per SKU and manufacturer documentation.',
      },
    ],
    projectOptions: [
      { value: 'airvo_equipo', label: 'Airvo purchase or renewal' },
      { value: 'optiflow_consumibles', label: 'Optiflow circuits / cannulas' },
      { value: 'proyecto_uci', label: 'ICU or ER project' },
      { value: 'orientacion', label: 'Still comparing references' },
    ],
    productSlugs: [
      'sistema-de-alto-flujo-ref-airvo-3-fisher-paykel',
      'sistema-de-alto-flujo-airvo-2-fisher-paykel',
      'circuito-para-alto-flujo-optiflow-junior-ref-rt330-fisher-paykel',
      'circuito-desechable-para-canula-de-alto-flujo-adulto-ref-rt202-fisher-paykel',
      'canula-nasal-optiflow-adulto-fisher-paykel',
    ],
    productsTitle: 'Fisher Paykel references with real demand',
    productsNote: 'I-ME catalog models. Configuration and consumables confirmed when quoting.',
    catalogFilter: 'terapia-respiratoria-soporte-vital',
  },
};

const CAMILLAS_MEDICAS: ContentMap = {
  es: {
    tag: 'Emergencias · Camillas',
    title: 'Camillas médicas y de traslado hospitalario | Saikang | I-ME',
    description:
      'Camillas médicas de traslado, plegables, cuchara y procedimientos para urgencias, ambulancia e instituciones en Colombia. Orientación I-ME y cotización formal.',
    h1: 'Camillas médicas que encajan en su recorrido — no solo en el brochure',
    lead: 'Si busca camillas médicas, camilla de traslado, plegable o cuchara para urgencias, ambulancia o traslado intrahospitalario, le ayudamos a elegir según dimensiones, carga y protocolo — con referencias Saikang del catálogo.',
    formIntro:
      'Indique institución, ciudad, tipo de uso (urgencias, ambulancia, traslado interno) y cantidad. Un asesor responde con alternativas concretas.',
    primaryCta: 'Quiero orientación de camillas',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver emergencias y traslado',
    heroImage: '/assets/img/camillas-medicas-traslado-hospitalario-colombia.webp',
    heroImageAlt: 'Camilla médica de traslado Saikang en hospital — I-ME Colombia',
    problemTitle: 'Lo que suele fallar al comprar camillas',
    problemBody:
      'No es “la más barata del catálogo genérico”. Es recorrido real, anclaje en ambulancia, plegado, carga declarada, limpieza y mantenimiento. Una camilla mal dimensionada frena urgencias y genera devoluciones.',
    solutionsTitle: 'Cómo acotamos el modelo',
    solutions: [
      {
        pain: 'Traslado intrahospitalario entre urgencias, imagenología y hospitalización',
        help: 'Comparamos camillas de traslado Saikang según radio, respaldo y accesorios publicados.',
      },
      {
        pain: 'Dudan entre camilla plegable, cuchara o estándar',
        help: 'Revisamos escenario (extricación, procedimiento, ambulancia) antes de empujar un SKU.',
      },
      {
        pain: 'Reposición de flota con el mismo protocolo',
        help: 'Documentamos medidas, carga y referencia exacta para no mezclar variantes incompatibles.',
      },
    ],
    audienceYes: [
      'Hospitales, clínicas, ambulancias y compras institucionales',
      'Biomédica que busca camillas médicas con ficha y cotización',
      'Proyectos de renovación o ampliación de urgencias',
    ],
    audienceNo: [
      'Pedidos sin contexto de recorrido o vehículo',
      'Quienes asumen que “cualquier camilla sirve” sin medir',
      'Urgencias de marketplace sin institución ni datos de contacto',
    ],
    situations: [
      {
        title: 'Urgencias y traslado interno',
        body: 'Camillas de traslado para recorridos frecuentes entre servicios.',
      },
      {
        title: 'Ambulancia o prehospitalario',
        body: 'Validación de dimensiones, anclaje y plegado según vehículo.',
      },
      {
        title: 'Reposición por lote',
        body: 'Varias unidades con el mismo checklist técnico.',
      },
    ],
    scopeTitle: 'Qué cubrimos en esta conversación',
    scope: [
      'Tipología de camilla según uso (traslado, plegable, cuchara)',
      'Referencias Saikang publicadas en catálogo I-ME',
      'Cotización formal cuando el caso esté claro',
      'Entrega y soporte según propuesta',
    ],
    requirementsTitle: 'Para cotizar con sentido',
    requirements: [
      'Institución y ciudad',
      'Uso: urgencias, ambulancia, traslado interno u otro',
      'Cantidad aproximada y plazo',
      '¿Hay restricciones de espacio o anclaje?',
    ],
    financingNote:
      'Financiación institucional orientativa disponible según proyecto. Condiciones en propuesta formal.',
    evidenceNote:
      'Hablamos de equipos y fichas publicadas. No prometemos tiempos clínicos ni cargas no documentadas en ficha.',
    processTitle: 'Cómo seguimos',
    processSteps: [
      'Cuéntenos el caso en el formulario',
      'Priorizamos por plazo y volumen',
      'Proponemos 1–3 referencias del catálogo',
      'Cotización formal si encaja',
    ],
    faqs: [
      {
        q: '¿Tienen camillas médicas para hospitales?',
        a: 'Sí. Hay camillas de traslado, plegables y cuchara Saikang publicadas. La variante se confirma al cotizar.',
      },
      {
        q: '¿Sirve la misma camilla para ambulancia y urgencias?',
        a: 'No siempre. Hay que validar dimensiones, anclaje y protocolo antes de recomendar referencia.',
      },
      {
        q: '¿El precio está en la web?',
        a: 'Suelen cotizarse según cantidad, ciudad y configuración. Pedimos contexto para un número útil.',
      },
    ],
    projectOptions: [
      { value: 'traslado_interno', label: 'Traslado intrahospitalario' },
      { value: 'ambulancia', label: 'Ambulancia / prehospitalario' },
      { value: 'reposicion_lote', label: 'Reposición de varias unidades' },
      { value: 'orientacion', label: 'Aún comparando tipologías' },
    ],
    productSlugs: [
      'camilla-de-traslado-ref-skb041-6-saikang',
      'camilla-de-traslado-ref-skb041-1-saikang',
      'camilla-plegable-ref-skb1a04-saikang',
      'camilla-cuchara-ref-skb2b01-saikang',
      'camilla-manual-st-100',
    ],
    productsTitle: 'Referencias de camillas médicas',
    productsNote: 'Modelos reales del catálogo. Confirmamos variante y accesorios al cotizar.',
    catalogFilter: 'emergencias-traslado-inmovilizacion',
  },
  en: {
    tag: 'Emergency · Stretchers',
    title: 'Medical stretchers & hospital transport | Saikang | I-ME',
    description:
      'Medical transport, folding, scoop and procedure stretchers for ER, ambulance and institutions in Colombia. I-ME guidance and formal quotes.',
    h1: 'Medical stretchers that fit your route — not just the brochure',
    lead: 'Looking for medical stretchers, transport, folding or scoop models for ER, ambulance or intra-hospital transfer? We help match dimensions, load and protocol — with published Saikang references.',
    formIntro:
      'Share institution, city, use type (ER, ambulance, internal transfer) and quantity. An advisor replies with concrete options.',
    primaryCta: 'I want stretcher guidance',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See emergency & transport',
    heroImage: '/assets/img/camillas-medicas-traslado-hospitalario-colombia.webp',
    heroImageAlt: 'Saikang medical transport stretcher in hospital — I-ME Colombia',
    problemTitle: 'What usually goes wrong when buying stretchers',
    problemBody:
      'It is not “cheapest generic catalog SKU”. It is real route, ambulance anchoring, folding, declared load, cleaning and maintenance.',
    solutionsTitle: 'How we narrow the model',
    solutions: [
      {
        pain: 'Intra-hospital transfer between ER, imaging and wards',
        help: 'We compare Saikang transport stretchers by radius, backrest and published accessories.',
      },
      {
        pain: 'Choosing between folding, scoop or standard stretcher',
        help: 'We review scenario (extrication, procedure, ambulance) before pushing a SKU.',
      },
      {
        pain: 'Fleet replenishment with the same protocol',
        help: 'We document dimensions, load and exact reference to avoid incompatible variants.',
      },
    ],
    audienceYes: [
      'Hospitals, clinics, ambulance operators and institutional buyers',
      'Biomed teams needing stretchers with datasheets and quotes',
      'ER renewal or expansion projects',
    ],
    audienceNo: [
      'Orders with no route or vehicle context',
      'Assuming “any stretcher works” without measuring',
      'Marketplace urgency with no institution or contact data',
    ],
    situations: [
      {
        title: 'ER and internal transfer',
        body: 'Transport stretchers for frequent routes between services.',
      },
      {
        title: 'Ambulance or pre-hospital',
        body: 'Dimension, anchoring and folding validation per vehicle.',
      },
      {
        title: 'Batch replenishment',
        body: 'Multiple units with the same technical checklist.',
      },
    ],
    scopeTitle: 'What we cover in this conversation',
    scope: [
      'Stretcher typology by use (transport, folding, scoop)',
      'Published Saikang references in the I-ME catalog',
      'Formal quote when the case is clear',
      'Delivery and support per proposal',
    ],
    requirementsTitle: 'To quote with purpose',
    requirements: [
      'Institution and city',
      'Use: ER, ambulance, internal transfer or other',
      'Approximate quantity and timeline',
      'Any space or anchoring constraints?',
    ],
    financingNote:
      'Indicative institutional financing available by project. Terms in a formal proposal.',
    evidenceNote:
      'We discuss published equipment and datasheets. No invented clinical timelines or undocumented loads.',
    processTitle: 'How we follow up',
    processSteps: [
      'Tell us the case in the form',
      'We prioritize by timeline and volume',
      'We propose 1–3 catalog references',
      'Formal quote if it fits',
    ],
    faqs: [
      {
        q: 'Do you carry medical stretchers for hospitals?',
        a: 'Yes. Saikang transport, folding and scoop stretchers are published. Variant confirmed when quoting.',
      },
      {
        q: 'Does one stretcher fit ambulance and ER alike?',
        a: 'Not always. Dimensions, anchoring and protocol must be validated before recommending a model.',
      },
      {
        q: 'Is the price on the website?',
        a: 'Usually quoted by quantity, city and configuration. We ask for context for a useful number.',
      },
    ],
    projectOptions: [
      { value: 'traslado_interno', label: 'Intra-hospital transfer' },
      { value: 'ambulancia', label: 'Ambulance / pre-hospital' },
      { value: 'reposicion_lote', label: 'Replenish several units' },
      { value: 'orientacion', label: 'Still comparing typologies' },
    ],
    productSlugs: [
      'camilla-de-traslado-ref-skb041-6-saikang',
      'camilla-de-traslado-ref-skb041-1-saikang',
      'camilla-plegable-ref-skb1a04-saikang',
      'camilla-cuchara-ref-skb2b01-saikang',
      'camilla-manual-st-100',
    ],
    productsTitle: 'Medical stretcher references',
    productsNote: 'Real catalog models. Variant and accessories confirmed when quoting.',
    catalogFilter: 'emergencias-traslado-inmovilizacion',
  },
};

const CAMINADORES: ContentMap = {
  es: {
    tag: 'Movilidad · Caminadores',
    title: 'Caminadores para adultos en Colombia | Konfort Plus y rollators | I-ME',
    description:
      'Caminadores para adultos, rollators y andadores Konfort Plus para instituciones y cuidado prolongado. Orientación I-ME, cotización y soporte en Colombia.',
    h1: 'Caminadores para adultos que sí se usan — no solo se cotizan',
    lead: 'Si busca caminador para adulto, opciones económicas o rollator con ruedas para residencia, rehabilitación o hospitalización, le ayudamos a elegir según peso, entorno y protocolo — con referencias reales del catálogo.',
    formIntro:
      'Indique institución (o contexto de compra), ciudad y si el uso es clínico, domiciliario o mixto. Un asesor responde con alternativas concretas.',
    primaryCta: 'Quiero orientación de caminadores',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver movilidad en catálogo',
    heroImage: '/assets/img/caminadores-adultos-konfort-plus-colombia.webp',
    heroImageAlt: 'Caminador para adultos Konfort Plus en rehabilitación — I-ME Colombia',
    problemTitle: 'Lo que suele fallar al comprar caminadores',
    problemBody:
      'No es “el más barato del marketplace”. Es estabilidad, altura, ruedas vs fijo, peso del usuario y si el equipo vive en pasillo clínico o en casa. Un mal match genera devoluciones y riesgo de caída.',
    solutionsTitle: 'Cómo le acotamos el modelo',
    solutions: [
      {
        pain: 'Necesitan caminador para adulto “económico” sin sacrificar seguridad básica',
        help: 'Comparamos líneas Konfort Plus y referencias de aluminio/acero publicadas, según presupuesto institucional y uso real.',
      },
      {
        pain: 'Dudan entre caminador fijo, con ruedas o rollator',
        help: 'Revisamos tipología (stand-up, doble función, rollator con reposapiés) según marcha, fatiga y entorno.',
      },
      {
        pain: 'Quieren marca conocida (p. ej. Konfort Plus) con ficha clara',
        help: 'Partimos de modelos Konfort Plus del catálogo I-ME y dejamos por escrito qué incluye la propuesta (equipo, entrega, soporte).',
      },
    ],
    audienceYes: [
      'Clínicas, residencias, programas de rehab o compras institucionales',
      'Quienes buscan caminadores para adultos / rollators en Colombia',
      'Compras o biomédica que necesitan ficha y cotización formal',
    ],
    audienceNo: [
      'Pedidos sin contexto de uso (peso, entorno, cantidad)',
      'Quienes exigen claims clínicos inventados (“cura”, “garantiza marcha”)',
      'Urgencias de marketplace sin institución ni datos de contacto',
    ],
    situations: [
      {
        title: 'Reposición de flota',
        body: 'Varias unidades para piso, rehab o residencia con el mismo criterio de seguridad.',
      },
      {
        title: 'Alta y cuidado prolongado',
        body: 'Caminador o rollator para acompañar deambulación con supervisión.',
      },
      {
        title: 'Comparar antes de comprar',
        body: 'Orientación entre referencias publicadas — sin catálogo infinito.',
      },
    ],
    scopeTitle: 'Qué cubrimos en esta conversación',
    scope: [
      'Tipología de caminador / rollator según uso',
      'Referencias publicadas en catálogo I-ME',
      'Cotización formal cuando el caso esté claro',
      'Entrega y soporte según propuesta',
    ],
    requirementsTitle: 'Para cotizar con sentido',
    requirements: [
      'Ciudad y tipo de comprador (institución / distribuidor / otro)',
      'Uso: clínico, domiciliario o mixto',
      'Cantidad aproximada y plazo',
    ],
    financingNote:
      'Financiación institucional orientativa disponible según proyecto. Condiciones en propuesta formal.',
    evidenceNote:
      'Hablamos de equipos y fichas publicadas. No prometemos resultados de rehabilitación ni precios de vitrina no confirmados.',
    processTitle: 'Cómo seguimos',
    processSteps: [
      'Cuéntenos el caso en el formulario',
      'Priorizamos por plazo y volumen',
      'Proponemos 1–3 referencias del catálogo',
      'Cotización formal si encaja',
    ],
    faqs: [
      {
        q: '¿Tienen caminadores para adultos Konfort Plus?',
        a: 'Sí. En catálogo hay caminadores y rollators Konfort Plus (por ejemplo desarmable en aluminio y stand-up doble función). La disponibilidad se confirma al cotizar.',
      },
      {
        q: '¿Venden solo a hospitales?',
        a: 'Atendemos instituciones de salud y canales B2B. Si el caso es particular, indíquelo: orientamos según política comercial vigente.',
      },
      {
        q: '¿El precio está en la web?',
        a: 'Los equipos de movilidad suelen cotizarse según cantidad, ciudad y configuración. Pedimos contexto para no mandar un número genérico e inútil.',
      },
    ],
    projectOptions: [
      { value: 'caminador_adulto', label: 'Caminador para adulto' },
      { value: 'rollator', label: 'Rollator / caminador con ruedas' },
      { value: 'reposicion_flota', label: 'Reposición de varias unidades' },
      { value: 'orientacion', label: 'Aún comparando tipologías' },
    ],
    productSlugs: [
      'g-kp1-8160l',
      'g-kp1-816l-19',
      'g-kp153-al-19',
      'g-kp285-al-19',
      'g-kp271-al-2',
      'g-kp1-8130g-5',
    ],
    productsTitle: 'Referencias de caminadores y rollators',
    productsNote: 'Modelos reales del catálogo. Confirmamos stock y variante al cotizar.',
    catalogFilter: 'movilidad-rehabilitacion',
  },
  en: {
    tag: 'Mobility · Walkers',
    title: 'Adult walkers in Colombia | Konfort Plus & rollators | I-ME',
    description:
      'Adult walkers, rollators and Konfort Plus gait aids for institutions and long-term care. I-ME guidance, quotes and support in Colombia.',
    h1: 'Adult walkers that get used — not just quoted',
    lead: 'Looking for an adult walker, a value option or a wheeled rollator for rehab, ward or residence? We help match weight, environment and protocol — with real catalog references.',
    formIntro:
      'Share institution (or buyer context), city and clinical vs home use. An advisor replies with concrete options.',
    primaryCta: 'I want walker guidance',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See mobility in catalog',
    heroImage: '/assets/img/caminadores-adultos-konfort-plus-colombia.webp',
    heroImageAlt: 'Konfort Plus adult walker in rehabilitation — I-ME Colombia',
    problemTitle: 'What usually goes wrong when buying walkers',
    problemBody:
      'It is not “cheapest marketplace SKU”. It is stability, height, fixed vs wheeled, user weight and whether the unit lives in a clinical corridor or at home.',
    solutionsTitle: 'How we narrow the model',
    solutions: [
      {
        pain: 'Need an adult walker that is affordable without skipping basic safety',
        help: 'We compare Konfort Plus lines and published aluminum/steel references by institutional budget and real use.',
      },
      {
        pain: 'Choosing between fixed walker, wheeled walker or rollator',
        help: 'We review typology (stand-up, dual-function, rollator with footrest) by gait, fatigue and environment.',
      },
      {
        pain: 'Want a known brand (e.g. Konfort Plus) with a clear sheet',
        help: 'We start from Konfort Plus models in the I-ME catalog and document what the proposal includes.',
      },
    ],
    audienceYes: [
      'Clinics, residences, rehab programs or institutional buyers',
      'Teams searching adult walkers / rollators in Colombia',
      'Procurement or biomed needing a formal quote',
    ],
    audienceNo: [
      'Orders with no use context (weight, environment, quantity)',
      'Requests for invented clinical claims',
      'Marketplace urgency with no institution or contact data',
    ],
    situations: [
      {
        title: 'Fleet replacement',
        body: 'Several units for ward, rehab or residence under one safety standard.',
      },
      {
        title: 'Discharge and long-term care',
        body: 'Walker or rollator to support ambulation with supervision.',
      },
      {
        title: 'Compare before buying',
        body: 'Guidance across published references — not an endless catalog dump.',
      },
    ],
    scopeTitle: 'What this conversation covers',
    scope: [
      'Walker / rollator typology by use case',
      'Published I-ME catalog references',
      'Formal quote when the case is clear',
      'Delivery and support per proposal',
    ],
    requirementsTitle: 'To quote meaningfully',
    requirements: [
      'City and buyer type (institution / distributor / other)',
      'Use: clinical, home or mixed',
      'Approx. quantity and timeline',
    ],
    financingNote:
      'Indicative institutional financing available by project. Terms in a formal proposal.',
    evidenceNote:
      'We discuss published equipment and sheets. No rehab outcome promises or unconfirmed shelf prices.',
    processTitle: 'How we follow up',
    processSteps: [
      'Share the case in the form',
      'We prioritize by timeline and volume',
      'We propose 1–3 catalog references',
      'Formal quote if it fits',
    ],
    faqs: [
      {
        q: 'Do you carry Konfort Plus adult walkers?',
        a: 'Yes. The catalog includes Konfort Plus walkers and rollators (e.g. foldable aluminum and dual-function stand-up). Availability is confirmed when quoting.',
      },
      {
        q: 'Do you only sell to hospitals?',
        a: 'We serve healthcare institutions and B2B channels. If the case is different, say so — we follow current commercial policy.',
      },
      {
        q: 'Is the price on the website?',
        a: 'Mobility equipment is usually quoted by quantity, city and configuration. Context beats a useless generic number.',
      },
    ],
    projectOptions: [
      { value: 'caminador_adulto', label: 'Adult walker' },
      { value: 'rollator', label: 'Rollator / wheeled walker' },
      { value: 'reposicion_flota', label: 'Multi-unit replacement' },
      { value: 'orientacion', label: 'Still comparing typologies' },
    ],
    productSlugs: [
      'g-kp1-8160l',
      'g-kp1-816l-19',
      'g-kp153-al-19',
      'g-kp285-al-19',
      'g-kp271-al-2',
      'g-kp1-8130g-5',
    ],
    productsTitle: 'Walker and rollator references',
    productsNote: 'Real catalog models. We confirm stock and variant when quoting.',
    catalogFilter: 'movilidad-rehabilitacion',
  },
};

const SILLAS: ContentMap = {
  es: {
    tag: 'Movilidad · Sillas de ruedas',
    title: 'Konfort Plus sillas de ruedas en Colombia | estándar y transporte | I-ME',
    description:
      'Sillas de ruedas Konfort Plus, transporte y estándar para clínicas y programas de movilidad. Asesoría I-ME, cotización y soporte en Colombia.',
    h1: 'Sillas de ruedas para institución — Konfort Plus y tipologías claras',
    lead: 'Si llegó buscando “Konfort Plus silla de ruedas” o una flota estándar/transporte para su sede, le ayudamos a acotar ancho de asiento, peso, reclinación y uso (piso, traslado, bariátrica) con referencias reales.',
    formIntro:
      'Cuéntenos ciudad, volumen aproximado y si necesita estándar, transporte, reclinable o bariátrica. Respondemos con opciones del catálogo.',
    primaryCta: 'Quiero orientación de sillas',
    secondaryCta: 'Escribir por WhatsApp',
    tertiaryCta: 'Ver sillas en catálogo',
    heroImage: '/assets/img/equipos-biomedicos-vanguardia.webp',
    heroImageAlt: 'Sillas de ruedas y movilidad institucional — I-ME Colombia',
    problemTitle: 'Comprar silla no es elegir color',
    problemBody:
      'Ancho de asiento, peso del usuario, reclinación, desarmado para traslado y política de mantenimiento importan más que la foto. Un mismatch genera quejas de enfermería y compras repetidas.',
    solutionsTitle: 'Cómo le ayudamos',
    solutions: [
      {
        pain: 'Buscan Konfort Plus por nombre y necesitan ficha + cotización',
        help: 'Partimos de sillas Konfort Plus publicadas (estándar, transporte, reclinable, bariátrica) y confirmamos variante al cotizar.',
      },
      {
        pain: 'Flota mixta: traslado corto vs uso prolongado en piso',
        help: 'Separamos tipologías de transporte y estándar para no comprar “una sola silla para todo”.',
      },
      {
        pain: 'Casos bariátricos o anchos especiales',
        help: 'Revisamos referencias de mayor ancho publicadas y dejamos claro límites de uso según ficha.',
      },
    ],
    audienceYes: [
      'Hospitales, clínicas, residencias y programas de movilidad',
      'Compras buscando Konfort Plus u otras sillas institucionales',
      'Quienes necesitan varias unidades con criterio homogéneo',
    ],
    audienceNo: [
      'Pedidos sin talla/uso (transporte vs piso)',
      'Claims de “mejor silla del mercado” sin contexto',
      'Urgencias sin datos de contacto institucionales',
    ],
    situations: [
      {
        title: 'Reposición Konfort Plus',
        body: 'Mantener línea conocida por personal clínico o de almacén.',
      },
      {
        title: 'Apertura de servicio',
        body: 'Mix inicial estándar + transporte según flujo de pacientes.',
      },
      {
        title: 'Caso bariátrico / ancho especial',
        body: 'Orientación con referencias de mayor ancho del catálogo.',
      },
    ],
    scopeTitle: 'Alcance de esta página',
    scope: [
      'Tipología de silla según uso',
      'Referencias Konfort Plus y estándar del catálogo',
      'Cotización formal por cantidad y ciudad',
      'Soporte según propuesta',
    ],
    requirementsTitle: 'Datos mínimos',
    requirements: [
      'Ciudad y cantidad aproximada',
      'Uso: transporte, estándar, reclinable o bariátrica',
      'Plazo de compra',
    ],
    financingNote:
      'Financiación institucional orientativa según proyecto. Condiciones en propuesta formal.',
    evidenceNote:
      'Solo referencias y fichas publicadas. Disponibilidad y precio se confirman al cotizar.',
    processTitle: 'Siguiente paso',
    processSteps: [
      'Envíe el caso',
      'Priorizamos por plazo',
      'Proponemos tipologías del catálogo',
      'Cotización formal',
    ],
    faqs: [
      {
        q: '¿Manejan sillas de ruedas Konfort Plus?',
        a: 'Sí. Hay varias referencias Konfort Plus en catálogo (estándar, transporte, reclinable y bariátrica). Confirmamos modelo y stock al cotizar.',
      },
      {
        q: '¿También tienen otras marcas?',
        a: 'Sí. Además de Konfort Plus hay líneas estándar y activas en la familia de movilidad. La landing prioriza lo que la gente busca por nombre en Google.',
      },
      {
        q: '¿Sirve para compra particular?',
        a: 'El foco es B2B institucional. Si su caso es otro, indíquelo en el formulario y aplicamos la política comercial vigente.',
      },
    ],
    projectOptions: [
      { value: 'konfort_plus', label: 'Konfort Plus (línea conocida)' },
      { value: 'transporte', label: 'Silla de transporte' },
      { value: 'estandar_piso', label: 'Estándar / uso en piso' },
      { value: 'bariatrico', label: 'Bariátrica / ancho especial' },
    ],
    productSlugs: [
      'g-kbe-9953',
      'g-kbe-9125t',
      'g-kbe-9630l',
      'g-kbe-9113',
      'g-kbe-9953-iii',
      'g-kbe-622',
    ],
    productsTitle: 'Referencias de sillas de ruedas',
    productsNote: 'Incluye Konfort Plus y estándar. Stock y variante se confirman al cotizar.',
    catalogFilter: 'movilidad-rehabilitacion',
  },
  en: {
    tag: 'Mobility · Wheelchairs',
    title: 'Konfort Plus & institutional wheelchairs in Colombia | I-ME',
    description:
      'Konfort Plus, transport and standard wheelchairs for clinics and mobility programs. I-ME advisory, quotes and support in Colombia.',
    h1: 'Institutional wheelchairs — Konfort Plus with clear typologies',
    lead: 'Searching “Konfort Plus wheelchair” or a standard/transport fleet for your site? We help narrow seat width, weight, recline and use case with real catalog references.',
    formIntro:
      'Share city, approx. volume and whether you need standard, transport, recliner or bariatric. We reply with catalog options.',
    primaryCta: 'I want wheelchair guidance',
    secondaryCta: 'Message on WhatsApp',
    tertiaryCta: 'See wheelchairs in catalog',
    heroImage: '/assets/img/equipos-biomedicos-vanguardia.webp',
    heroImageAlt: 'Institutional wheelchairs and mobility — I-ME Colombia',
    problemTitle: 'Buying a chair is not picking a color',
    problemBody:
      'Seat width, user weight, recline, fold-for-transport and maintenance policy matter more than the photo.',
    solutionsTitle: 'How we help',
    solutions: [
      {
        pain: 'Looking for Konfort Plus by name with sheet + quote',
        help: 'We start from published Konfort Plus chairs (standard, transport, recliner, bariatric) and confirm variant when quoting.',
      },
      {
        pain: 'Mixed fleet: short transport vs longer ward use',
        help: 'We separate transport vs standard typologies so you do not buy “one chair for everything”.',
      },
      {
        pain: 'Bariatric or special widths',
        help: 'We review wider published references and document use limits from the sheet.',
      },
    ],
    audienceYes: [
      'Hospitals, clinics, residences and mobility programs',
      'Buyers looking for Konfort Plus or institutional chairs',
      'Teams replacing multiple units under one standard',
    ],
    audienceNo: [
      'Orders with no size/use context',
      '“Best chair” claims with no site context',
      'Urgent buys with no institutional contact data',
    ],
    situations: [
      {
        title: 'Konfort Plus replacement',
        body: 'Keep a line staff already knows.',
      },
      {
        title: 'Service opening',
        body: 'Initial mix of standard + transport by patient flow.',
      },
      {
        title: 'Bariatric / special width',
        body: 'Guidance with wider catalog references.',
      },
    ],
    scopeTitle: 'Scope of this page',
    scope: [
      'Chair typology by use',
      'Konfort Plus and standard catalog references',
      'Formal quote by quantity and city',
      'Support per proposal',
    ],
    requirementsTitle: 'Minimum data',
    requirements: [
      'City and approx. quantity',
      'Use: transport, standard, recliner or bariatric',
      'Purchase timeline',
    ],
    financingNote: 'Indicative institutional financing by project. Terms in a formal proposal.',
    evidenceNote:
      'Published references and sheets only. Availability and price confirmed when quoting.',
    processTitle: 'Next step',
    processSteps: [
      'Send the case',
      'We prioritize by timeline',
      'We propose catalog typologies',
      'Formal quote',
    ],
    faqs: [
      {
        q: 'Do you carry Konfort Plus wheelchairs?',
        a: 'Yes. Several Konfort Plus references are in the catalog (standard, transport, recliner, bariatric). Model and stock are confirmed when quoting.',
      },
      {
        q: 'Other brands too?',
        a: 'Yes. Beyond Konfort Plus there are standard and active lines in the mobility family. This page prioritizes what people search by name.',
      },
      {
        q: 'Retail / consumer purchase?',
        a: 'Focus is institutional B2B. If your case differs, say so — we apply current commercial policy.',
      },
    ],
    projectOptions: [
      { value: 'konfort_plus', label: 'Konfort Plus (known line)' },
      { value: 'transporte', label: 'Transport chair' },
      { value: 'estandar_piso', label: 'Standard / ward use' },
      { value: 'bariatrico', label: 'Bariatric / special width' },
    ],
    productSlugs: [
      'g-kbe-9953',
      'g-kbe-9125t',
      'g-kbe-9630l',
      'g-kbe-9113',
      'g-kbe-9953-iii',
      'g-kbe-622',
    ],
    productsTitle: 'Wheelchair references',
    productsNote: 'Includes Konfort Plus and standard. Stock/variant confirmed when quoting.',
    catalogFilter: 'movilidad-rehabilitacion',
  },
};

type StandardCampaignLandingId = Exclude<
  CampaignLandingId,
  'proyectos' | 'pdf_descarga' | 'evento' | FabricanteLandingId
>;

const META: Record<
  StandardCampaignLandingId,
  { familia_slug: string; tipo_slug?: string; path: string; pathEn: string }
> = {
  torres_laparoscopia: {
    familia_slug: 'sala-cirugia',
    tipo_slug: 'torres-laparoscopia',
    path: '/es/torres-laparoscopia/',
    pathEn: '/en/laparoscopy-towers/',
  },
  esterilizacion: {
    familia_slug: 'esterilizacion-control-infecciones',
    path: '/es/esterilizacion/',
    pathEn: '/en/sterilization/',
  },
  imagenologia: {
    familia_slug: 'radiologia',
    path: '/es/imagenologia/',
    pathEn: '/en/imaging/',
  },
  robotica_rehabilitacion: {
    familia_slug: 'robots',
    path: '/es/robotica-rehabilitacion/',
    pathEn: '/en/robotics-rehabilitation/',
  },
  caminadores_adultos: {
    familia_slug: 'movilidad-rehabilitacion',
    tipo_slug: 'caminadores',
    path: '/es/caminadores-para-adultos/',
    pathEn: '/en/adult-walkers/',
  },
  sillas_ruedas: {
    familia_slug: 'movilidad-rehabilitacion',
    tipo_slug: 'sillas-de-ruedas',
    path: '/es/sillas-de-ruedas/',
    pathEn: '/en/wheelchairs/',
  },
  monitores_biolight: {
    familia_slug: 'monitores',
    path: '/es/monitores-biolight-uci/',
    pathEn: '/en/biolight-icu-monitors/',
  },
  alto_flujo_fisher_paykel: {
    familia_slug: 'terapia-respiratoria-soporte-vital',
    path: '/es/alto-flujo-fisher-paykel/',
    pathEn: '/en/fisher-paykel-high-flow/',
  },
  camillas_medicas: {
    familia_slug: 'emergencias-traslado-inmovilizacion',
    path: '/es/camillas-medicas/',
    pathEn: '/en/medical-stretchers/',
  },
};

const BY_ID: Record<StandardCampaignLandingId, ContentMap> = {
  torres_laparoscopia: TORRES,
  esterilizacion: ESTERILIZACION,
  imagenologia: IMAGENOLOGIA,
  robotica_rehabilitacion: ROBOTICA,
  caminadores_adultos: CAMINADORES,
  sillas_ruedas: SILLAS,
  monitores_biolight: MONITORES_BIOLIGHT,
  alto_flujo_fisher_paykel: ALTO_FLUJO_FISHER_PAYKEL,
  camillas_medicas: CAMILLAS_MEDICAS,
};

export function getCampaignLanding(
  id: StandardCampaignLandingId,
  locale: Locale
): CampaignLandingContent {
  const meta = META[id];
  const copy = BY_ID[id][locale];
  return {
    id,
    ...meta,
    ...copy,
  };
}

export function listCampaignLandings(locale: Locale): CampaignLandingContent[] {
  return (Object.keys(BY_ID) as StandardCampaignLandingId[]).map(id =>
    getCampaignLanding(id, locale)
  );
}
