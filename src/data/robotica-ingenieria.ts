/**
 * Landing de distribuidores de robots e ingeniería robótica en Colombia.
 * Especificaciones tomadas de los manuales de fabricante del dossier
 * 2026-10-28. Sin precios, sin registros INVIMA inventados y sin SKUs nuevos.
 */
import type { Locale } from '../i18n/utils';
import { rehabZuowei } from './zuowei-catalogo';
import {
  buildBreadcrumbJsonLd,
  buildCanonical,
  buildFaqJsonLd,
  buildOrganizationJsonLd,
  buildUrlItemList,
  combineJsonLd,
} from '../lib/seo';

/**
 * Slug canónico: keywords primarias del informe GSC + intención LatAm.
 * ES: distribuidores de robots, ingeniería robótica, Colombia, Latinoamérica.
 * EN: robot distributors, robotics engineering, Colombia, Latin America.
 * La ruta corta `/es/robotica-rehabilitacion/` redirige aquí con 301.
 */
export const ROBOTICA_SLUG = {
  es: 'distribuidores-de-robots-e-ingenieria-robotica-en-colombia-y-latinoamerica',
  en: 'robot-distributors-and-robotics-engineering-in-colombia-and-latin-america',
} as const;

export const ROBOTICA_PATH = {
  es: `/es/${ROBOTICA_SLUG.es}/`,
  en: `/en/${ROBOTICA_SLUG.en}/`,
} as const;

export const PHONE_DISPLAY = '+57 313 724 7353';
export const EMAIL = 'info@i-me.com.co';

export const WARRANTY = {
  es: 'Garantía oficial del fabricante con soporte electromecánico y de integración local por I-ME en Colombia.',
  en: 'Official manufacturer warranty with local electromechanical and integration support by I-ME in Colombia.',
} as const;

type L10n = { es: string; en: string };

const t = (locale: Locale, copy: L10n): string => (locale === 'en' ? copy.en : copy.es);

export interface RobotSpec {
  label: L10n;
  value: string;
}

export interface CatalogRobot {
  sku: string;
  model: string;
  slug: string;
  verticals: string[];
  image: string;
  width: number;
  height: number;
  pdf: string;
  role: L10n;
  summary: L10n;
  specs: RobotSpec[];
}

const img = (file: string) => `/assets/img/robots/${file}`;

export const ROBOTS: readonly CatalogRobot[] = [
  {
    sku: 'PADBOT-X3',
    model: 'PadBot X3',
    slug: 'padbot-x3-robot-recepcion-ref-padbot-x3-padbot',
    verticals: ['recepcion'],
    image: img('padbot-x3-frente-estudio.webp'),
    width: 1200,
    height: 1200,
    pdf: '/assets/productos/importados/padbot-x3-robot-recepcion/ficha-padbot-x3-robot-recepcion.pdf',
    role: {
      es: 'Recepción, orientación, turnos y servicio',
      en: 'Reception, wayfinding, ticketing and service',
    },
    summary: {
      es: 'Doble pantalla (cabeza 10.1" y cuerpo 19"), hasta 10.000 preguntas y respuestas en cloud.padbot.com, reconocimiento facial y videollamada. Mapeo con puntos de ascensor, control de acceso, muros virtuales y tours guiados.',
      en: 'Dual display (10.1" head and 19" body), up to 10,000 Q&As in cloud.padbot.com, face recognition and video calls. Mapping with elevator points, access control, virtual walls and guided tours.',
    },
    specs: [
      {
        label: { es: 'Dimensiones y peso', en: 'Size and weight' },
        value: '49 × 140 × 48 cm · 23 kg',
      },
      {
        label: { es: 'Pantallas', en: 'Displays' },
        value: '10.1" 1280×800 + 19" 1280×800',
      },
      {
        label: { es: 'Batería y carga', en: 'Battery and charge' },
        value: 'Li-ion 12.800 mAh · 25.9 V / 3 A · 9 h',
      },
      { label: { es: 'Autonomía', en: 'Runtime' }, value: '10 h' },
      {
        label: { es: 'Navegación', en: 'Navigation' },
        value: 'SLAM + LiDAR frontal + anticolisión / anticaída',
      },
      { label: { es: 'Conectividad', en: 'Connectivity' }, value: 'WiFi + 4G Micro-SIM' },
    ],
  },
  {
    sku: 'PADBOT-X2',
    model: 'PadBot X2',
    slug: 'padbot-x2-robot-servicio-interactivo-ref-padbot-x2-padbot',
    verticals: ['recepcion'],
    image: img('padbot-x2-frente-estudio.webp'),
    width: 1200,
    height: 1200,
    pdf: '/assets/productos/importados/padbot-x2-robot-servicio-interactivo/ficha-padbot-x2-robot-servicio-interactivo.pdf',
    role: {
      es: 'Servicio interactivo en espacios compactos',
      en: 'Interactive service in compact spaces',
    },
    summary: {
      es: 'Misma arquitectura PadBot Manager / Cloud que el X3 en un chasis de 15 kg. Q&A hasta 10.000 entradas, tours, puntos de ascensor y puertas automáticas. Parada de emergencia trasera.',
      en: 'Same PadBot Manager / Cloud architecture as the X3 in a 15 kg chassis. Up to 10,000 Q&As, tours, elevator points and automatic doors. Rear emergency stop.',
    },
    specs: [
      {
        label: { es: 'Dimensiones y peso', en: 'Size and weight' },
        value: '40 × 115 × 48 cm · 15 kg',
      },
      {
        label: { es: 'Pantallas', en: 'Displays' },
        value: '10.1" 1280×800 + 15.6" 1280×800',
      },
      {
        label: { es: 'Batería y carga', en: 'Battery and charge' },
        value: '20.000 mAh · 16.8 V / 3 A · 9 h',
      },
      { label: { es: 'Autonomía', en: 'Runtime' }, value: '10 h' },
      {
        label: { es: 'Navegación', en: 'Navigation' },
        value: 'SLAM + LiDAR en chasis + ultrasonido perimetral',
      },
      { label: { es: 'Conectividad', en: 'Connectivity' }, value: 'WiFi + 4G Micro-SIM' },
    ],
  },
  {
    sku: 'PADBOT-P2',
    model: 'PadBot P2',
    slug: 'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot',
    verticals: ['telepresencia'],
    image: img('padbot-p2-frente-estudio.webp'),
    width: 1200,
    height: 1200,
    pdf: '/assets/productos/importados/padbot-p2-robot-telepresencia/ficha-padbot-p2-robot-telepresencia.pdf',
    role: {
      es: 'Telepresencia y comunicación en instalaciones',
      en: 'Telepresence and on-site communication',
    },
    summary: {
      es: 'Videollamada HD en uno o dos sentidos con control remoto del desplazamiento y de la inclinación del cabezal. Seguimiento facial, comando de acercamiento y PadBot AI Brain opcional.',
      en: 'One-way or two-way HD video with remote drive and head-tilt control. Face follow, come-here command and optional PadBot AI Brain.',
    },
    specs: [
      {
        label: { es: 'Dimensiones y peso', en: 'Size and weight' },
        value: '27 × 37,2 × 110 cm · 6,5 kg',
      },
      { label: { es: 'Pantalla', en: 'Display' }, value: 'Táctil HD 10" 1280×800' },
      {
        label: { es: 'Batería y carga', en: 'Battery and charge' },
        value: '5.000 mAh · 12.6 V / 1.5 A · 6 h',
      },
      { label: { es: 'Autonomía', en: 'Runtime' }, value: '10 h · 40 h en espera' },
      {
        label: { es: 'Sensores', en: 'Sensors' },
        value: 'Anticolisión + infrarrojos anticaída · marchas 1–4',
      },
      { label: { es: 'Conectividad', en: 'Connectivity' }, value: 'WiFi (≥8 Mbps rec.) + 4G LTE' },
    ],
  },
  {
    sku: 'PADBOT-W2',
    model: 'PadBot W2',
    slug: 'padbot-w2-robot-delivery-institucional-ref-padbot-w2-padbot',
    verticals: ['logistica'],
    image: img('padbot-w2-frente-locker.webp'),
    width: 1200,
    height: 1200,
    pdf: '/assets/productos/importados/padbot-w2-robot-delivery-institucional/ficha-padbot-w2-robot-delivery-institucional.pdf',
    role: {
      es: 'Logística interna con gabinete PIN/QR',
      en: 'Internal logistics with PIN/QR cabinet',
    },
    summary: {
      es: 'Gabinete motorizado que abre con código PIN o QR para el transporte interno de insumos y documentos. Retorno automático tras 3 min. Conmutación multimapa, ascensores y torniquetes.',
      en: 'Motorized cabinet opened by PIN or QR for internal transport of supplies and documents. Automatic return after 3 min. Multi-map switching, elevators and turnstiles.',
    },
    specs: [
      {
        label: { es: 'Dimensiones y peso', en: 'Size and weight' },
        value: '50 × 120 × 50 cm · 40 kg',
      },
      { label: { es: 'Pantalla', en: 'Display' }, value: 'Táctil 10.1" 1280×800 + LED azul' },
      {
        label: { es: 'Batería y carga', en: 'Battery and charge' },
        value: '12.800 mAh · 25.9 V / 3 A · 9 h',
      },
      { label: { es: 'Autonomía', en: 'Runtime' }, value: '10 h' },
      {
        label: { es: 'Navegación', en: 'Navigation' },
        value: 'SLAM + LiDAR + RGB-D + ultrasonido en faldón',
      },
      { label: { es: 'Conectividad', en: 'Connectivity' }, value: 'WiFi + 4G Micro-SIM' },
    ],
  },
  {
    sku: 'PADBOT-W3S',
    model: 'PadBot W3s',
    slug: 'padbot-w3s-robot-delivery-alimentos-ref-padbot-w3s-padbot',
    verticals: ['logistica'],
    image: img('padbot-w3s-frente-bandejas.webp'),
    width: 1200,
    height: 1200,
    pdf: '/assets/productos/importados/padbot-w3s-robot-delivery-alimentos/ficha-padbot-w3s-robot-delivery-alimentos.pdf',
    role: {
      es: 'Reparto en bandejas y señalización digital',
      en: 'Tray delivery and digital signage',
    },
    summary: {
      es: 'Tres bandejas abiertas y pantalla trasera Full HD de 15.6". Modos Delivery, Dishwash Return y Cruise. Chasis de tres ruedas con giro sobre su eje.',
      en: 'Three open trays and a 15.6" Full HD rear display. Delivery, Dishwash Return and Cruise modes. Three-wheel chassis that turns in place.',
    },
    specs: [
      {
        label: { es: 'Dimensiones y peso', en: 'Size and weight' },
        value: '50 × 120 × 50 cm · 33,5 kg',
      },
      {
        label: { es: 'Pantallas', en: 'Displays' },
        value: '10.1" 1280×800 + 15.6" FHD 1920×1080',
      },
      {
        label: { es: 'Batería y carga', en: 'Battery and charge' },
        value: '12.800 mAh · 25.9 V / 3 A · 9 h',
      },
      { label: { es: 'Autonomía', en: 'Runtime' }, value: '10 h' },
      {
        label: { es: 'Navegación', en: 'Navigation' },
        value: 'SLAM + LiDAR frontal + ultrasonido 360°',
      },
      { label: { es: 'Conectividad', en: 'Connectivity' }, value: 'WiFi + 4G Micro-SIM' },
    ],
  },
  {
    sku: 'C3-CLEANING-ROBOT',
    model: 'C3 Cleaning Robot',
    slug: 'c3-robot-limpieza-autonoma-ref-c3-cleaning-robot',
    verticals: ['limpieza'],
    image: img('c3-robot-estacion-estudio.webp'),
    width: 1024,
    height: 1024,
    pdf: '/assets/productos/importados/c3-robot-limpieza-autonoma/ficha-c3-robot-limpieza-autonoma.pdf',
    role: {
      es: 'Limpieza autónoma 3-en-1 con estación de agua',
      en: '3-in-1 autonomous cleaning with water station',
    },
    summary: {
      es: 'Aspirado, fregado y mopa seca en suelos duros. Estación de 600 W con suministro de agua limpia y bombeo de residuales. Ruido inferior a 70 dB. Modo de ascensor documentado.',
      en: 'Vacuum, mop and dust-mop on hard floors. 600 W station with clean-water fill and wastewater pump. Noise under 70 dB. Documented elevator mode.',
    },
    specs: [
      {
        label: { es: 'Peso', en: 'Weight' },
        value: 'Robot 68,5 kg · estación 25 kg',
      },
      {
        label: { es: 'Batería y carga', en: 'Battery and charge' },
        value: '46 Ah extraíble · DC 29.5 V / 20 A · 2,5 h',
      },
      { label: { es: 'Autonomía', en: 'Runtime' }, value: '2 a 3,5 h · recarga <10 % o <24 V' },
      { label: { es: 'Ruido', en: 'Noise' }, value: '<70 dB' },
      {
        label: { es: 'Navegación', en: 'Navigation' },
        value: 'LiDAR Clase 1 IEC 60825-1:2014 + ultrasonido + bumper',
      },
      {
        label: { es: 'Normas del manual', en: 'Manual standards' },
        value: 'EN 60204-1 · EN ISO 12100 · EN 60335-1 · EN 60335-2-72',
      },
    ],
  },
  {
    sku: 'PADBOT-T2',
    model: 'PadBot T2',
    slug: 'padbot-t2-robot-educativo-social-ref-padbot-t2-padbot',
    verticals: ['educacion'],
    image: img('padbot-t2-frente-estudio.webp'),
    width: 1200,
    height: 1200,
    pdf: '/assets/productos/importados/padbot-t2-robot-educativo-social/ficha-padbot-t2-robot-educativo-social.pdf',
    role: {
      es: 'Educación STEM y acompañamiento social',
      en: 'STEM education and social companionship',
    },
    summary: {
      es: 'Conversación sin palabra de activación, videollamada con control desde la app y tracción por orugas. Recordatorios de hábitos y límites de uso configurables. No es un dispositivo de diagnóstico.',
      en: 'Wake-word-free conversation, app-controlled video calls and crawler treads. Habit reminders and configurable use limits. Not a diagnostic device.',
    },
    specs: [
      {
        label: { es: 'Dimensiones y peso', en: 'Size and weight' },
        value: '16,5 × 22,5 × 22 cm · 1,68 kg',
      },
      {
        label: { es: 'Pantalla', en: 'Display' },
        value: 'Táctil 5" 800×480 · cámara 230° HD 720P',
      },
      {
        label: { es: 'Batería y carga', en: 'Battery and charge' },
        value: 'Inductiva 5.200 mAh · DC 5 V · 2 h',
      },
      { label: { es: 'Autonomía', en: 'Runtime' }, value: '6 h · 18 h en espera' },
      {
        label: { es: 'Tracción', en: 'Drive' },
        value: 'Orugas · Cortex-A7 · 20 °C a 40 °C',
      },
      {
        label: { es: 'Sensores', en: 'Sensors' },
        value: 'Anticolisión y anticaída delanteros y traseros',
      },
    ],
  },
  {
    sku: 'CRUZR-AHUMAN-FUTURE',
    model: 'Cruzr',
    slug: 'cruzr-robot-comercial-inteligente-ref-cruzr-ahuman-future-ahuman-future',
    verticals: ['recepcion', 'humanoide'],
    image: img('cruzr-frente-estudio.webp'),
    width: 1200,
    height: 1200,
    pdf: '/assets/productos/importados/cruzr-robot-comercial-inteligente-ahuman-future/ficha-cruzr-robot-comercial-inteligente-ahuman-future.pdf',
    role: {
      es: 'Humanoide comercial con Open API',
      en: 'Commercial humanoid with Open API',
    },
    summary: {
      es: 'Brazos articulados, pantalla facial y Cloud Robotic OS. Navegación estereoscópica con LiDAR, detección facial y Open API para ERP o CRM. El alcance de integración se cotiza por proyecto.',
      en: 'Articulated arms, facial display and Cloud Robotic OS. Stereoscopic navigation with LiDAR, face detection and an Open API for ERP or CRM. Integration scope is quoted per project.',
    },
    specs: [
      {
        label: { es: 'Formato', en: 'Format' },
        value: 'Humanoide sobre base omnidireccional',
      },
      {
        label: { es: 'Interfaz', en: 'Interface' },
        value: 'Pantalla facial HD · voz, visión y tacto',
      },
      {
        label: { es: 'Energía', en: 'Power' },
        value: 'Retorno autónomo a estación de acoplamiento',
      },
      {
        label: { es: 'Navegación', en: 'Navigation' },
        value: 'Estereoscópica + LiDAR · evasión en tiempo real',
      },
      {
        label: { es: 'Brazos', en: 'Arms' },
        value: 'Hombros, codos y muñecas articulados',
      },
      { label: { es: 'Integración', en: 'Integration' }, value: 'Cloud Robotic OS · Open API' },
    ],
  },
];

export const VERTICALS: ReadonlyArray<{ id: string; label: L10n }> = [
  { id: 'todos', label: { es: 'Todos los robots', en: 'All robots' } },
  { id: 'recepcion', label: { es: 'Recepción e IA', en: 'Reception and AI' } },
  {
    id: 'telepresencia',
    label: {
      es: 'Telepresencia y comunicación en instalaciones',
      en: 'Telepresence and on-site communication',
    },
  },
  { id: 'logistica', label: { es: 'Logística y delivery', en: 'Logistics and delivery' } },
  { id: 'limpieza', label: { es: 'Limpieza autónoma', en: 'Autonomous cleaning' } },
  { id: 'humanoide', label: { es: 'Humanoide y Open API', en: 'Humanoid and Open API' } },
  { id: 'educacion', label: { es: 'Educación STEM', en: 'STEM education' } },
];

export const KPIS: ReadonlyArray<{ value: string; label: L10n }> = [
  {
    value: '10 h',
    label: {
      es: 'Autonomía publicada en la serie PadBot de servicio',
      en: 'Published runtime on the PadBot service line',
    },
  },
  {
    value: '<70 dB',
    label: { es: 'Operación del robot de limpieza C3', en: 'C3 cleaning robot operation' },
  },
  {
    value: '46 Ah',
    label: { es: 'Batería extraíble del robot C3', en: 'Removable battery on the C3 robot' },
  },
  {
    value: '10.000',
    label: { es: 'Preguntas y respuestas en la nube PadBot', en: 'Q&As in the PadBot cloud' },
  },
];

export const BADGES: readonly L10n[] = [
  { es: 'LiDAR SLAM', en: 'LiDAR SLAM' },
  { es: 'Integración IoT con ascensores', en: 'IoT elevator integration' },
  { es: 'Soporte biomédico en Colombia', en: 'Biomedical support in Colombia' },
  { es: 'Decreto 4725 · normas de máquinas', en: 'Decree 4725 · machinery standards' },
];

export const LAYERS: ReadonlyArray<{ n: string; title: L10n; body: L10n }> = [
  {
    n: '01',
    title: { es: 'LiDAR Clase 1', en: 'Class 1 LiDAR' },
    body: {
      es: 'Láser 240°–360°, IEC 60825-1, alcance documentado de hasta 25 m y posicionamiento centimétrico para el mapa SLAM, sin reflectores ni balizas magnéticas.',
      en: '240°–360° laser, IEC 60825-1, documented range up to 25 m and centimeter-level positioning for the SLAM map, without reflectors or magnetic tape.',
    },
  },
  {
    n: '02',
    title: { es: 'Visión RGB-D', en: 'RGB-D vision' },
    body: {
      es: 'Cámaras de profundidad o visión estereoscópica 3D con campo horizontal de 120° y detección de obstáculos suspendidos entre 0,1 m y 1,5 m.',
      en: 'Depth cameras or 3D stereo vision with a 120° horizontal field and detection of hanging obstacles from 0.1 m to 1.5 m.',
    },
  },
  {
    n: '03',
    title: { es: 'Ultrasonido y vidrio', en: 'Ultrasound and glass' },
    body: {
      es: 'Arreglo ultrasónico y láser lineal frontal para cristales, puertas de vidrio templado y obstáculos bajos en instalaciones y oficinas.',
      en: 'Ultrasonic array and front line laser for glass, tempered doors and low obstacles in facilities and offices.',
    },
  },
  {
    n: '04',
    title: { es: 'Infrarrojos anticaída', en: 'Infrared cliff sensors' },
    body: {
      es: 'Frenado ante escaleras, rampas pronunciadas o desniveles. En el PadBot P2 y el T2 el manual describe sensores anticaída delanteros.',
      en: 'Braking at stairs, steep ramps or floor drops. PadBot P2 and T2 manuals describe front cliff sensors.',
    },
  },
  {
    n: '05',
    title: { es: 'Bumper y E-Stop', en: 'Bumper and E-Stop' },
    body: {
      es: 'Parachoques táctil y botón físico de parada de emergencia. El corte de tracción se alinea con EN ISO 12100 y EN 60204-1 en los manuales que las citan.',
      en: 'Tactile bumper and a physical emergency-stop button. Traction cut follows EN ISO 12100 and EN 60204-1 in the manuals that cite them.',
    },
  },
];

export const PROJECTS: ReadonlyArray<{ title: L10n; body: L10n }> = [
  {
    title: {
      es: 'Limpieza industrial pesada',
      en: 'Heavy industrial cleaning',
    },
    body: {
      es: 'Bajo proyecto: arquitecturas seco-húmedo con succión de 19.000 a 23.500 Pa, ancho de 400 a 610 mm, productividad de 600 a 1.100 m²/h y baterías LiFePO4 (UN38.3 / MSDS) de intercambio rápido. No es un SKU nuevo del catálogo.',
      en: 'Project supply: wet-dry architectures with 19,000 to 23,500 Pa suction, 400 to 610 mm width, 600 to 1,100 m²/h throughput and hot-swap LiFePO4 batteries (UN38.3 / MSDS). Not a new catalog SKU.',
    },
  },
  {
    title: {
      es: 'Desinfección hospitalaria UV-C',
      en: 'Hospital UV-C disinfection',
    },
    body: {
      es: 'Bajo proyecto: plataformas autónomas de irradiación ultravioleta germicida para quirófano, UCI y aislamiento, integradas al protocolo de infecciones de la institución. Sin ficha nueva hasta aprobación de catálogo.',
      en: 'Project supply: autonomous germicidal ultraviolet platforms for operating rooms, ICU and isolation, aligned with the institution infection protocol. No new sheet until catalog approval.',
    },
  },
  {
    title: {
      es: 'Logística cerrada',
      en: 'Closed logistics',
    },
    body: {
      es: 'Bajo proyecto: transporte autónomo cerrado con acceso biométrico o QR. El PadBot W2 del catálogo cubre el gabinete PIN/QR; los formatos pesados se diseñan aparte.',
      en: 'Project supply: closed autonomous transport with biometric or QR access. Catalog PadBot W2 covers the PIN/QR cabinet; heavy formats are engineered separately.',
    },
  },
  {
    title: {
      es: 'Open API e inspección',
      en: 'Open API and inspection',
    },
    body: {
      es: 'Bajo proyecto: unidades móviles con telemetría y SDK para universidades, I+D y planta. Cruzr ya publica Open API en catálogo; otras plataformas se integran sin darlas de alta como producto.',
      en: 'Project supply: mobile units with telemetry and an SDK for universities, R&D and plants. Cruzr already publishes an Open API in the catalog; other platforms are integrated without a new product record.',
    },
  },
];

export const STEPS: ReadonlyArray<{ title: L10n; body: L10n }> = [
  {
    title: { es: 'Planos y recorrido', en: 'Drawings and route' },
    body: {
      es: 'Levantamiento CAD del edificio: pasillos, puertas, ascensores, rampas, puntos de carga y zonas restringidas en Bogotá, Medellín, Cali, Barranquilla o la sede que corresponda.',
      en: 'CAD survey of the building: corridors, doors, elevators, ramps, charge points and restricted zones in Bogotá, Medellín, Cali, Barranquilla or the relevant site.',
    },
  },
  {
    title: { es: 'Mapa SLAM', en: 'SLAM map' },
    body: {
      es: 'Mapa autónomo multiplanta con muros virtuales, zonas de velocidad y áreas transitables. Sin obra civil ni cinta magnética cuando el manual del modelo lo permite.',
      en: 'Multi-floor autonomous map with virtual walls, speed zones and passable areas. No civil works or magnetic tape when the model manual allows it.',
    },
  },
  {
    title: { es: 'Ascensores y accesos', en: 'Elevators and access' },
    body: {
      es: 'Punto de espera y punto de abordaje de ascensor con módulo IoT E-Box (contacto seco) o API Cloud. Puertas y torniquetes por relé, WiFi o 4G, con conmutación de mapa.',
      en: 'Elevator waiting and boarding points via the E-Box IoT module (dry contact) or a cloud API. Doors and turnstiles by relay, WiFi or 4G, with map switching.',
    },
  },
  {
    title: { es: 'Puesta en marcha', en: 'Commissioning' },
    body: {
      es: 'Comisionamiento en sitio, capacitación de operación y matriz de consumibles. En el C3 el manual cita batería 2–3 años a 2 ciclos/día, labio 1 mes, cepillo o mopa 1–2 meses y filtros 1 semana.',
      en: 'On-site commissioning, operator training and a consumable matrix. The C3 manual cites a battery life of 2–3 years at 2 cycles/day, squeegee 1 month, brush or mop 1–2 months and filters 1 week.',
    },
  },
];

export const FAQS: ReadonlyArray<{ q: L10n; a: L10n }> = [
  {
    q: {
      es: '¿Quiénes distribuyen robots de servicio, limpieza y telepresencia en Colombia?',
      en: 'Who distributes service, cleaning and telepresence robots in Colombia?',
    },
    a: {
      es: `I-ME (International Medical Enterprise IME S.A.S.) distribuye en Colombia los ocho robots de servicio del catálogo activo: PadBot X3, PadBot X2, PadBot P2, PadBot W2, PadBot W3s, robot C3 de limpieza autónoma, PadBot T2 y Cruzr (AHuman Future). La rehabilitación de la marcha suma el exoesqueleto Zuowei ZW568, el exoesqueleto Zuowei ZW598 y la silla de bipedestación Zuowei ZW518. La cotización y el alcance de instalación se confirman por proyecto. WhatsApp ${PHONE_DISPLAY} · ${EMAIL}.`,
      en: `I-ME (International Medical Enterprise IME S.A.S.) distributes in Colombia the eight service robots in the active catalog: PadBot X3, PadBot X2, PadBot P2, PadBot W2, PadBot W3s, the C3 autonomous cleaning robot, PadBot T2 and Cruzr (AHuman Future). Gait rehabilitation adds the Zuowei ZW568 exoskeleton, the Zuowei ZW598 exoskeleton and the Zuowei ZW518 standing chair. Quote and installation scope are confirmed per project. WhatsApp ${PHONE_DISPLAY} · ${EMAIL}.`,
    },
  },
  {
    q: {
      es: '¿Cómo funciona la navegación LiDAR SLAM y la integración con ascensores y torniquetes?',
      en: 'How do LiDAR SLAM navigation and elevator or turnstile integration work?',
    },
    a: {
      es: 'El mapa se construye con LiDAR láser Clase 1 (IEC 60825-1), visión RGB-D o estereoscópica, ultrasonido, infrarrojos anticaída y parachoques con parada de emergencia. En varias plantas se configuran puntos de espera y de abordaje de ascensor con el módulo IoT E-Box o una API Cloud, y puntos de control de acceso para puertas y torniquetes.',
      en: 'The map is built with Class 1 LiDAR (IEC 60825-1), RGB-D or stereo vision, ultrasound, infrared cliff sensors and a bumper with emergency stop. Multi-floor jobs use elevator waiting and boarding points via the E-Box IoT module or a cloud API, plus access-control points for doors and turnstiles.',
    },
  },
  {
    q: {
      es: '¿Qué autonomía publican los robots PadBot y el robot de limpieza C3?',
      en: 'What runtime do the PadBot robots and the C3 cleaning robot publish?',
    },
    a: {
      es: 'Los manuales de PadBot X3, X2, P2, W2 y W3s publican 10 h de autonomía (el P2 añade 40 h en espera). El PadBot T2 publica 6 h (18 h en espera). El robot C3 publica de 2 a 3,5 h por ciclo, con batería extraíble de 46 Ah y recarga automática por debajo del 10 % o de 24 V. El resultado en cada sede depende del recorrido y del modo.',
      en: 'PadBot X3, X2, P2, W2 and W3s manuals publish 10 h of runtime (P2 also lists 40 h standby). PadBot T2 publishes 6 h (18 h standby). The C3 robot publishes 2 to 3.5 h per cycle, with a 46 Ah removable battery and automatic recharge below 10% or 24 V. Results on site depend on the route and the mode.',
    },
  },
  {
    q: {
      es: '¿Cómo es el soporte técnico en Bogotá, Medellín, Cali y Barranquilla?',
      en: 'What does technical support look like in Bogotá, Medellín, Cali and Barranquilla?',
    },
    a: {
      es: `${WARRANTY.es} El mantenimiento preventivo, los repuestos y la visita en Bogotá, Medellín, Cali, Barranquilla y el resto del país se definen en la propuesta. No publicamos plazos de entrega genéricos.`,
      en: `${WARRANTY.en} Preventive maintenance, spare parts and visits in Bogotá, Medellín, Cali, Barranquilla and the rest of the country are defined in the proposal. We do not publish generic lead times.`,
    },
  },
  {
    q: {
      es: '¿Estos robots de recepción, telepresencia, logística o limpieza tienen registro INVIMA?',
      en: 'Do these reception, telepresence, logistics or cleaning robots have an INVIMA registration?',
    },
    a: {
      es: 'No realizan diagnóstico, monitoreo clínico ni tratamiento sobre el paciente: operan como automatización, logística e infraestructura. La documentación aplicable se confirma por referencia, en el marco del Decreto 4725 cuando el equipo sea un dispositivo médico y de las normas de máquinas del manual (EN ISO 12100, EN 60335-2-72, IEC 60825-1, entre otras citadas en el C3). I-ME no publica un número de registro INVIMA genérico para la línea.',
      en: 'They do not diagnose, monitor or treat a patient: they operate as automation, logistics and infrastructure. Applicable documentation is confirmed per reference, under Decree 4725 when the unit is a medical device and under the machinery standards in the manual (EN ISO 12100, EN 60335-2-72, IEC 60825-1, among others cited for the C3). I-ME does not publish a generic INVIMA registration number for the line.',
    },
  },
  {
    q: {
      es: '¿I-ME distribuye robots en Colombia y también en Latinoamérica?',
      en: 'Does I-ME distribute robots in Colombia and also in Latin America?',
    },
    a: {
      es: 'El catálogo, la ingeniería de integración y el soporte electromecánico se operan desde Colombia, con visitas en Bogotá, Medellín, Cali, Barranquilla y el resto del país. I-ME también atiende proyectos de distribución e ingeniería robótica para instituciones en Latinoamérica; la logística y el alcance de cada sede se confirman en la propuesta. No publicamos sucursales ni plazos genéricos por país.',
      en: 'The catalog, integration engineering and electromechanical support run from Colombia, with visits in Bogotá, Medellín, Cali, Barranquilla and the rest of the country. I-ME also takes distribution and robotics engineering projects for institutions in Latin America; logistics and scope for each site are confirmed in the proposal. We do not publish branches or generic lead times by country.',
    },
  },
];

export const PAGE = {
  es: {
    title: 'Distribuidores de robots en Colombia y Latinoamérica | I-ME',
    description:
      'Distribuidores de robots e ingeniería robótica en Colombia y Latinoamérica: limpieza autónoma, recepción, telepresencia y logística con LiDAR SLAM. Cotice con I-ME.',
    h1: 'Distribuidores de Robots e Ingeniería Robótica en Colombia y Latinoamérica',
    eyebrow:
      'Distribuidores de robots e ingeniería robótica en Colombia y Latinoamérica · soporte I-ME',
    lead: 'I-ME distribuye robots de servicio, limpieza autónoma, recepción, telepresencia y logística AMR para clínicas, hoteles, universidades y empresas en Colombia, y atiende proyectos de ingeniería robótica en Latinoamérica. Ocho robots de servicio están en catálogo. La rehabilitación de la marcha suma los Zuowei ZW568, ZW598 y ZW518. Otras arquitecturas se ingenian bajo proyecto.',
    heroAlt:
      'Robot humanoide de servicio en un lobby institucional, referencia visual de robótica de servicio en Colombia',
    primaryCta: 'Cotizar ingeniería robótica',
    secondaryCta: 'WhatsApp',
    catalogCta: 'Ver la familia de robots',
    filterLegend: 'Filtrar por función',
    catalogTitle: 'Ocho robots de servicio en distribución directa',
    catalogLead:
      'Robots de recepción, telepresencia, logística interna, limpieza autónoma y educación. Cada cifra sale del manual del fabricante. El precio es bajo cotización.',
    sheetCta: 'Ver ficha',
    pdfCta: 'PDF técnico',
    quoteCta: 'Cotizar este modelo',
    tableTitle: 'Tabla comparativa de ingeniería',
    tableLead:
      'Comparación indexable de los ocho modelos: aplicación, tamaño, energía, autonomía, sensores y conectividad.',
    tableCaption: 'Especificaciones publicadas en los manuales de PadBot, robot C3 y Cruzr.',
    engineeringTitle: 'Ingeniería robótica: navegación SLAM de cinco capas',
    engineeringLead:
      'La fusión sensorial permite mapear la sede sin obra civil. La integración con el edificio —ascensores, puertas y torniquetes— es parte del comisionamiento, no un accesorio genérico.',
    stationTitle: 'Estación de agua y energía del robot C3',
    stationBody:
      'El robot pesa 68,5 kg. La estación multifunción pesa 25 kg, consume 600 W y acepta 100–240 V, 50/60 Hz, 10 A. Acopla recarga, llenado de agua limpia y drenaje de residuales. El ciclo continuo publicado es de 2 a 3,5 h, con carga rápida en 2,5 h.',
    stationAlt: 'Esquema del robot C3 acoplado a la estación de recarga, agua limpia y drenaje',
    stepsTitle: 'Comisionamiento en Colombia',
    stepsLead:
      'El comisionamiento en sitio cubre Bogotá, Medellín, Cali, Barranquilla y el resto de Colombia. Los proyectos de Latinoamérica se coordinan desde esa base; el alcance de cada visita queda en la propuesta.',
    projectsTitle: 'Otras soluciones de ingeniería robótica bajo proyecto',
    projectsLead:
      'Capacidades de los fabricantes aliados que I-ME puede integrar. No son fichas nuevas del catálogo y no se venden como un SKU publicado.',
    projectsBadge: 'Bajo proyecto',
    promoTitle: 'Equipamiento de quirófano e imagenología',
    formTitle: 'Cuéntenos el edificio y el flujo',
    formIntro:
      'Institución, ciudad y el cuello de botella: recepción, telepresencia, logística AMR, limpieza o integración con ascensores. Respondemos con los modelos publicados y, si aplica, un alcance de ingeniería.',
    familyHref: '/es/familias/robots/',
    familyLabel: 'Catálogo de la familia robots',
    teleHref: '/es/robotica-rehabilitacion/telepresencia/',
    teleLabel: 'Ficha de telepresencia PadBot P2',
    guideHref: '/es/conocimiento/robots-asistenciales-atencion-reduccion-carga-personal/',
    guideLabel: 'Guía: robots de servicio y carga operativa',
    crumbHub: 'Proyectos',
    crumbHubHref: '/es/proyectos/',
    crumbHere: 'Distribuidores de robots',
    home: 'Inicio',
    homeHref: '/es/',
    productBase: '/es/productos/',
    regulatory:
      'La documentación regulatoria se confirma por referencia. Esta página no publica registros INVIMA, códigos UNSPSC ni precios.',
    rehabTitle: 'Nuevo · Rehabilitación de la marcha',
    rehabLead:
      'Exoesqueletos Zuowei ZW568 y ZW598, y silla de bipedestación Zuowei ZW518. Precio bajo cotización. Garantía del fabricante Shenzhen Zuowei Technology.',
    rehabQuote: 'Solicitar cotización',
  },
  en: {
    title: 'Robot Distributors in Colombia and Latin America | I-ME',
    description:
      'Robot distributors and robotics engineering in Colombia and Latin America: autonomous cleaning, reception, telepresence and logistics with LiDAR SLAM. Contact I-ME.',
    h1: 'Robot Distributors and Robotics Engineering in Colombia and Latin America',
    eyebrow: 'Robot distributors and robotics engineering in Colombia and Latin America · I-ME',
    lead: 'I-ME distributes service, autonomous cleaning, reception, telepresence and AMR logistics robots for clinics, hotels, universities and companies in Colombia, and takes robotics engineering projects across Latin America. Eight service robots are in the catalog. Gait rehabilitation adds the Zuowei ZW568, ZW598 and ZW518. Other architectures are engineered per project.',
    heroAlt:
      'Service humanoid robot in an institutional lobby, a visual reference for service robotics in Colombia',
    primaryCta: 'Request robotics engineering',
    secondaryCta: 'WhatsApp',
    catalogCta: 'Browse the robot family',
    filterLegend: 'Filter by function',
    catalogTitle: 'Eight service robots in direct distribution',
    catalogLead:
      'Reception, telepresence, internal logistics, autonomous cleaning and education. Every figure comes from the manufacturer manual. Price is on request.',
    sheetCta: 'View sheet',
    pdfCta: 'Technical PDF',
    quoteCta: 'Quote this model',
    tableTitle: 'Engineering comparison table',
    tableLead:
      'Indexable comparison of the eight models: job, size, energy, runtime, sensors and connectivity.',
    tableCaption: 'Specifications published in the PadBot, C3 robot and Cruzr manuals.',
    engineeringTitle: 'Robotics engineering: five-layer SLAM navigation',
    engineeringLead:
      'Sensor fusion maps the site without civil works. Building integration — elevators, doors and turnstiles — is part of commissioning, not a generic accessory.',
    stationTitle: 'C3 robot water and power station',
    stationBody:
      'The robot weighs 68.5 kg. The multifunction station weighs 25 kg, draws 600 W and accepts 100–240 V, 50/60 Hz, 10 A. It docks for recharge, clean-water fill and wastewater drain. Published continuous runtime is 2 to 3.5 h, with a 2.5 h fast charge.',
    stationAlt: 'Drawing of the C3 robot docked to the recharge, clean-water and drain station',
    stepsTitle: 'Commissioning in Colombia',
    stepsLead:
      'On-site commissioning covers Bogotá, Medellín, Cali, Barranquilla and the rest of Colombia. Latin American projects are scoped from that base; each visit is written into the proposal.',
    projectsTitle: 'Other robotics engineering solutions supplied per project',
    projectsLead:
      'Capabilities from allied manufacturers that I-ME can integrate. They are not new catalog sheets and are not sold as a published SKU.',
    projectsBadge: 'Per project',
    promoTitle: 'Operating-room and imaging equipment',
    formTitle: 'Tell us the building and the workflow',
    formIntro:
      'Institution, city and the bottleneck: reception, telepresence, AMR logistics, cleaning or elevator integration. We answer with published models and, when it applies, an engineering scope.',
    familyHref: '/en/families/robots/',
    familyLabel: 'Robot family catalog',
    teleHref: '/en/robotics-rehabilitation/telepresencia/',
    teleLabel: 'PadBot P2 telepresence page',
    guideHref: '/en/knowledge/robots-asistenciales-atencion-reduccion-carga-personal/',
    guideLabel: 'Guide: service robots and task load',
    crumbHub: 'Projects',
    crumbHubHref: '/en/projects/',
    crumbHere: 'Robot distributors',
    home: 'Home',
    homeHref: '/en/',
    productBase: '/en/products/',
    regulatory:
      'Applicable documentation is confirmed per reference. This page does not publish INVIMA registrations, UNSPSC codes or prices.',
    rehabTitle: 'New · Gait rehabilitation',
    rehabLead:
      'Zuowei ZW568 and ZW598 exoskeletons, and the Zuowei ZW518 standing chair. Price on request. Manufacturer warranty from Shenzhen Zuowei Technology.',
    rehabQuote: 'Request a quote',
  },
};

export type RoboticaPageCopy = (typeof PAGE)['es'];

export function pageCopy(locale: Locale): RoboticaPageCopy {
  return locale === 'en' ? PAGE.en : PAGE.es;
}

export function l10n(locale: Locale, copy: L10n): string {
  return t(locale, copy);
}

const PRODUCT_SLUGS = ROBOTS.map(robot => robot.slug);

export const ROBOTICA_COPY = {
  es: {
    tag: 'Distribuidores de robots',
    title: PAGE.es.title,
    description: PAGE.es.description,
    h1: PAGE.es.h1,
    lead: PAGE.es.lead,
    modalityLinks: [
      { title: 'Telepresencia y comunicación en instalaciones', href: PAGE.es.teleHref },
      { title: 'Familia de robots en catálogo', href: PAGE.es.familyHref },
    ],
    formIntro: PAGE.es.formIntro,
    primaryCta: PAGE.es.primaryCta,
    secondaryCta: PAGE.es.secondaryCta,
    tertiaryCta: PAGE.es.catalogCta,
    heroImage: '/assets/img/robots-asistenciales-atencion-institucional-colombia.webp',
    heroImageAlt: PAGE.es.heroAlt,
    heroImageWidth: 1168,
    heroImageHeight: 784,
    relatedGuides: [{ title: PAGE.es.guideLabel, href: PAGE.es.guideHref }],
    problemTitle: 'Operación real, no un lobby de ciencia ficción',
    problemBody:
      'Las instituciones buscan distribuidores de robots en Colombia para filas de recepción, recorridos de insumos, presencia remota o limpieza de grandes superficies. La ingeniería robótica solo avanza si el mapa, los ascensores y el responsable de operación están definidos.',
    solutionsTitle: 'Empresas de robótica: qué resuelve el catálogo',
    solutions: [
      {
        pain: 'Recepción, turnos y preguntas repetidas',
        help: 'PadBot X3, PadBot X2 y Cruzr cubren orientación, Q&A e interacción. Cruzr añade brazos y Open API.',
      },
      {
        pain: 'Telepresencia y comunicación en instalaciones',
        help: 'PadBot P2 publica videollamada HD, 10 h de autonomía y sensores anticaída.',
      },
      {
        pain: 'Logística interna y alimentos',
        help: 'PadBot W2 cierra el gabinete con PIN o QR. PadBot W3s reparte en tres bandejas con pantalla Full HD.',
      },
      {
        pain: 'Limpieza autónoma de suelos',
        help: 'El robot C3 aspira, friega y pasa mopa, con estación de agua y ruido inferior a 70 dB.',
      },
    ],
    audienceYes: [
      'Clínicas, hospitales, hoteles, universidades y empresas con un flujo medible',
      'Proyectos de recepción, telepresencia, AMR, limpieza o integración con ascensores',
      'Quienes deciden o influyen en el presupuesto institucional',
    ],
    audienceNo: [
      'Pacientes que buscan terapia personal',
      'Quienes piden un resultado clínico o un retorno inventado',
      'Consultas sin institución ni sede',
    ],
    situations: [
      {
        title: 'Robots de servicio',
        body: 'Recepción, telepresencia, delivery y humanoide comercial publicados en catálogo.',
      },
      {
        title: 'Ingeniería de edificio',
        body: 'Mapa SLAM, E-Box, puertas automáticas y comisionamiento en la sede.',
      },
      {
        title: 'Soluciones bajo proyecto',
        body: 'Limpieza pesada, UV-C y logística cerrada, sin SKU nuevo.',
      },
    ],
    scopeTitle: 'Alcance con los pies en la tierra',
    scope: [
      'Ocho robots del catálogo activo, con ficha y PDF del fabricante',
      'Ingeniería de navegación LiDAR SLAM e integración IoT',
      'Puesta en marcha y capacitación según propuesta',
      WARRANTY.es,
    ],
    requirementsTitle: 'Para preparar la visita',
    requirements: [
      'Institución y ciudad',
      'Flujo a resolver y plazo',
      'Planos o una descripción de ascensores, puertas y superficies',
    ],
    financingNote:
      'Hay financiación institucional orientativa. Tasas y plazos se confirman en la propuesta formal, no en esta página.',
    evidenceNote:
      'Solo se citan cifras de los manuales. Sin precios, sin registros INVIMA genéricos y sin códigos UNSPSC.',
    processTitle: 'Cómo sigue I-ME',
    processSteps: [
      'Escuchamos el edificio y el flujo',
      'Elegimos modelos publicados o un alcance bajo proyecto',
      'Levantamos el mapa y los puntos de ascensor',
      'Cotizamos instalación, capacitación y soporte',
    ],
    faqs: FAQS.map(item => ({ q: item.q.es, a: item.a.es })),
    projectOptions: [
      { value: 'recepcion_ia', label: 'Recepción, orientación e IA' },
      { value: 'telepresencia', label: 'Telepresencia y comunicación en instalaciones' },
      { value: 'logistica_amr', label: 'Logística AMR y delivery' },
      { value: 'limpieza', label: 'Limpieza autónoma' },
      { value: 'ingenieria_integracion', label: 'Integración con ascensores y accesos' },
      { value: 'demo', label: 'Quiero una demostración' },
    ],
    productSlugs: PRODUCT_SLUGS,
    productsTitle: 'Ocho robots en catálogo',
    productsNote: 'Modelos reales. La demo confirma si encajan en el edificio.',
    catalogFilter: 'robots',
  },
  en: {
    tag: 'Robot distributors',
    title: PAGE.en.title,
    description: PAGE.en.description,
    h1: PAGE.en.h1,
    lead: PAGE.en.lead,
    modalityLinks: [
      { title: 'Telepresence and on-site communication', href: PAGE.en.teleHref },
      { title: 'Robot family in the catalog', href: PAGE.en.familyHref },
    ],
    formIntro: PAGE.en.formIntro,
    primaryCta: PAGE.en.primaryCta,
    secondaryCta: PAGE.en.secondaryCta,
    tertiaryCta: PAGE.en.catalogCta,
    heroImage: '/assets/img/robots-asistenciales-atencion-institucional-colombia.webp',
    heroImageAlt: PAGE.en.heroAlt,
    heroImageWidth: 1168,
    heroImageHeight: 784,
    relatedGuides: [{ title: PAGE.en.guideLabel, href: PAGE.en.guideHref }],
    problemTitle: 'Real operations, not a science-fiction lobby',
    problemBody:
      'Institutions look for robot distributors in Colombia to fix reception queues, supply routes, remote presence or large-floor cleaning. Robotics engineering only moves forward when the map, the elevators and the operating owner are defined.',
    solutionsTitle: 'What the catalog actually solves',
    solutions: [
      {
        pain: 'Reception, tickets and repeated questions',
        help: 'PadBot X3, PadBot X2 and Cruzr cover wayfinding, Q&A and interaction. Cruzr adds arms and an Open API.',
      },
      {
        pain: 'Telepresence and on-site communication',
        help: 'PadBot P2 publishes HD video, 10 h runtime and cliff sensors.',
      },
      {
        pain: 'Internal logistics and meals',
        help: 'PadBot W2 locks the cabinet with a PIN or QR. PadBot W3s delivers on three trays with a Full HD display.',
      },
      {
        pain: 'Autonomous floor cleaning',
        help: 'The C3 robot vacuums, mops and dust-mops, with a water station and noise under 70 dB.',
      },
    ],
    audienceYes: [
      'Clinics, hospitals, hotels, universities and companies with a measurable flow',
      'Reception, telepresence, AMR, cleaning or elevator-integration projects',
      'People who decide or influence the institutional budget',
    ],
    audienceNo: [
      'Patients seeking personal therapy',
      'Requests for a clinical outcome or an invented return',
      'Inquiries without an institution or a site',
    ],
    situations: [
      {
        title: 'Service robots',
        body: 'Reception, telepresence, delivery and a commercial humanoid published in the catalog.',
      },
      {
        title: 'Building engineering',
        body: 'SLAM map, E-Box, automatic doors and on-site commissioning.',
      },
      {
        title: 'Project-only solutions',
        body: 'Heavy cleaning, UV-C and closed logistics, without a new SKU.',
      },
    ],
    scopeTitle: 'Scope, stated plainly',
    scope: [
      'Eight robots in the active catalog, with manufacturer sheet and PDF',
      'LiDAR SLAM navigation engineering and IoT integration',
      'Commissioning and training per proposal',
      WARRANTY.en,
    ],
    requirementsTitle: 'To prepare the visit',
    requirements: [
      'Institution and city',
      'Workflow to solve and timeline',
      'Drawings or a description of elevators, doors and floors',
    ],
    financingNote:
      'Indicative institutional financing is available. Rates and terms are confirmed in the formal proposal, not on this page.',
    evidenceNote:
      'Only manual figures are cited. No prices, no generic INVIMA registrations and no UNSPSC codes.',
    processTitle: 'How I-ME follows up',
    processSteps: [
      'We listen to the building and the flow',
      'We select published models or a project scope',
      'We survey the map and elevator points',
      'We quote installation, training and support',
    ],
    faqs: FAQS.map(item => ({ q: item.q.en, a: item.a.en })),
    projectOptions: [
      { value: 'recepcion_ia', label: 'Reception, wayfinding and AI' },
      { value: 'telepresencia', label: 'Telepresence and on-site communication' },
      { value: 'logistica_amr', label: 'AMR logistics and delivery' },
      { value: 'limpieza', label: 'Autonomous cleaning' },
      { value: 'ingenieria_integracion', label: 'Elevator and access integration' },
      { value: 'demo', label: 'I want a demonstration' },
    ],
    productSlugs: PRODUCT_SLUGS,
    productsTitle: 'Eight catalog robots',
    productsNote: 'Real models. A demo confirms whether they fit the building.',
    catalogFilter: 'robots',
  },
};

export function buildRoboticaJsonLd(locale: Locale): string {
  const copy = pageCopy(locale);
  const origin = 'https://i-me.com.co';
  const path = locale === 'en' ? ROBOTICA_PATH.en : ROBOTICA_PATH.es;
  const canonical = buildCanonical(path);
  const faqs = FAQS.map(item => ({ q: t(locale, item.q), a: t(locale, item.a) }));
  return combineJsonLd(
    buildOrganizationJsonLd(),
    buildBreadcrumbJsonLd([
      { name: copy.home, url: `${origin}${copy.homeHref}` },
      { name: copy.crumbHub, url: `${origin}${copy.crumbHubHref}` },
      { name: copy.crumbHere, url: canonical },
    ]),
    buildFaqJsonLd(faqs),
    buildUrlItemList({
      name: copy.catalogTitle,
      items: ROBOTS.map(robot => ({
        name: robot.model,
        url: buildCanonical(`${copy.productBase}${robot.slug}`),
      })),
    }),
    buildUrlItemList({
      name: copy.rehabTitle,
      items: rehabZuowei().map(producto => ({
        name: locale === 'en' ? producto.nombre_en : producto.nombre_es,
        url: buildCanonical(`${copy.productBase}${producto.slug}`),
      })),
    }),
    {
      '@context': 'https://schema.org',
      '@type': ['WebPage', 'CollectionPage'],
      name: copy.h1,
      description: copy.description,
      url: canonical,
      inLanguage: locale === 'en' ? 'en' : 'es-CO',
      isPartOf: { '@type': 'WebSite', name: 'I-ME', url: `${origin}/` },
    }
  );
}
