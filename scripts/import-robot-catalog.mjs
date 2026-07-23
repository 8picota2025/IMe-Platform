#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { createClient } from '@supabase/supabase-js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = process.cwd();
const SOURCE_DIR = '/home/shoky/0 IME/robots';
// Assets live in public/ so production serves them from Hostinger after deploy.
// Supabase stores only product metadata and these public URL paths.
const PUBLIC_ROOT = path.join(ROOT, 'public/assets/productos/importados');
const DATA_DIR = path.join(ROOT, 'src/data');

const SYNC_SUPABASE = process.argv.includes('--supabase');

const family = {
  id: 'd026ac8a-6d63-4fb7-8953-a7aa7a32e627',
  slug: 'robots',
  nombre_es: 'Robots',
  nombre_en: 'Robots',
  descripcion_es:
    'Robots de servicio, recepción, telepresencia, delivery, educación, limpieza y automatización operativa para instituciones de salud, hoteles, universidades, centros comerciales y empresas.',
  descripcion_en:
    'Service, reception, telepresence, delivery, education, cleaning and operational automation robots for healthcare institutions, hotels, universities, shopping centers and companies.',
  icono: 'bot',
  orden: 180,
  activo: true,
};

const types = [
  {
    id: '0a894f87-2fc5-435d-b17e-f5ccf3ef7c41',
    familia_id: family.id,
    familia_slug: family.slug,
    slug: 'robots-recepcion-atencion',
    nombre_es: 'Robots de recepción y atención',
    nombre_en: 'Reception and customer service robots',
    orden: 10,
    activo: true,
  },
  {
    id: 'e8116b0e-c6e0-4b4c-be0e-9090f2f69513',
    familia_id: family.id,
    familia_slug: family.slug,
    slug: 'robots-telepresencia',
    nombre_es: 'Robots de telepresencia',
    nombre_en: 'Telepresence robots',
    orden: 20,
    activo: true,
  },
  {
    id: '4eef3605-08fa-4f89-b899-0a469a94d5c6',
    familia_id: family.id,
    familia_slug: family.slug,
    slug: 'robots-delivery-institucional',
    nombre_es: 'Robots de delivery institucional',
    nombre_en: 'Institutional delivery robots',
    orden: 30,
    activo: true,
  },
  {
    id: 'd575af50-27d6-4a40-b270-e4dc6c6f5835',
    familia_id: family.id,
    familia_slug: family.slug,
    slug: 'robots-delivery-alimentos',
    nombre_es: 'Robots de delivery de alimentos',
    nombre_en: 'Food delivery robots',
    orden: 40,
    activo: true,
  },
  {
    id: '3e2982dc-eebb-4eb4-912e-087e2b08f3c7',
    familia_id: family.id,
    familia_slug: family.slug,
    slug: 'robots-limpieza-autonoma',
    nombre_es: 'Robots de limpieza autónoma',
    nombre_en: 'Autonomous cleaning robots',
    orden: 50,
    activo: true,
  },
  {
    id: 'b13c392a-83a8-4315-bc6e-db7c12d8c577',
    familia_id: family.id,
    familia_slug: family.slug,
    slug: 'robots-educativos-sociales',
    nombre_es: 'Robots educativos y sociales',
    nombre_en: 'Educational and social robots',
    orden: 60,
    activo: true,
  },
];

const typeBySlug = new Map(types.map(type => [type.slug, type]));

function spec(clave, valor, grupo = 'Ficha tecnica') {
  return { clave, valor, grupo };
}

const marketKeywords = {
  es: [
    'robots asistenciales',
    'robots de servicio',
    'robots hospitalarios',
    'robots para clínicas',
    'robots para hospitales',
    'robots para centros médicos',
    'robots para residencias de mayores',
    'robots para hogares geriátricos',
    'robots para adultos mayores',
    'robots para tercera edad',
    'automatización hospitalaria',
    'automatización institucional',
    'hospital 4.0',
    'hospital digital',
    'tecnología asistencial',
    'robótica asistencial',
    'robótica de servicio',
    'robots industriales de servicio',
    'robots para logística interna',
    'robots comerciales para empresas',
    'robots en Colombia',
    'robots asistenciales Colombia',
    'robots hospitalarios Colombia',
    'robots de servicio Latinoamérica',
    'robots para hospitales Latinoamérica',
    'robots asistenciales España',
    'robots para hospitales España',
  ],
  en: [
    'assistive robots',
    'service robots',
    'healthcare robots',
    'hospital robots',
    'clinic robots',
    'robots for medical centers',
    'robots for senior living',
    'robots for elderly care',
    'robots for older adults',
    'nursing home robots',
    'hospital automation',
    'institutional automation',
    'hospital 4.0',
    'digital hospital',
    'assistive technology',
    'assistive robotics',
    'service robotics',
    'industrial service robots',
    'internal logistics robots',
    'commercial robots for companies',
    'robots in Colombia',
    'healthcare robots Colombia',
    'hospital robots Colombia',
    'service robots Latin America',
    'hospital robots Latin America',
    'assistive robots Spain',
    'hospital robots Spain',
  ],
};

const typeKeywords = {
  'robots-recepcion-atencion': {
    es: [
      'robot de recepción',
      'robot recepcionista',
      'robot de atención al cliente',
      'robot de orientación hospitalaria',
      'robot para admisiones hospitalarias',
      'robot guía para visitantes',
      'robot humanoide de servicio',
      'robot con reconocimiento facial',
      'robot con interacción por voz',
      'robot con pantalla publicitaria',
      'kiosco robótico móvil',
      'automatización de recepción',
      'orientación de pacientes',
      'atención en lobby hospitalario',
      'robots para IPS',
      'robots para EPS',
      'robots para hoteles y clínicas',
    ],
    en: [
      'reception robot',
      'front desk robot',
      'customer service robot',
      'hospital wayfinding robot',
      'hospital admissions robot',
      'visitor guidance robot',
      'humanoid service robot',
      'face recognition robot',
      'voice interaction robot',
      'advertising screen robot',
      'mobile robotic kiosk',
      'reception automation',
      'patient wayfinding',
      'hospital lobby assistance',
      'robots for healthcare providers',
      'robots for hotels and clinics',
    ],
  },
  'robots-telepresencia': {
    es: [
      'robot de telepresencia',
      'robot para telemedicina',
      'robot de teleconsulta',
      'robot de teleasistencia',
      'robot para visitas remotas',
      'robot para rondas médicas remotas',
      'robot de videoatención',
      'robot para acompañamiento virtual',
      'robot para cuidado remoto',
      'robot para adultos mayores a distancia',
      'robot para especialistas remotos',
      'telepresencia en hospitales',
      'telepresencia en residencias de mayores',
    ],
    en: [
      'telepresence robot',
      'telemedicine robot',
      'teleconsultation robot',
      'teleassistance robot',
      'remote visit robot',
      'remote medical rounds robot',
      'video assistance robot',
      'virtual accompaniment robot',
      'remote care robot',
      'robot for remote elderly care',
      'robot for remote specialists',
      'hospital telepresence',
      'telepresence for senior care facilities',
    ],
  },
  'robots-delivery-institucional': {
    es: [
      'robot de delivery institucional',
      'robot de logística hospitalaria',
      'robot de transporte interno',
      'robot para entrega de insumos',
      'robot para documentos hospitalarios',
      'robot para muestras no críticas',
      'robot con locker',
      'robot de reparto en hospitales',
      'robot para rutas internas',
      'automatización logística hospitalaria',
      'logística interna en clínicas',
      'delivery autónomo institucional',
    ],
    en: [
      'institutional delivery robot',
      'hospital logistics robot',
      'internal transport robot',
      'supply delivery robot',
      'hospital document delivery robot',
      'non-critical sample delivery robot',
      'locker robot',
      'hospital delivery robot',
      'internal route robot',
      'hospital logistics automation',
      'clinic internal logistics',
      'autonomous institutional delivery',
    ],
  },
  'robots-delivery-alimentos': {
    es: [
      'robot de delivery de alimentos',
      'robot camarero',
      'robot para restaurantes',
      'robot para cafeterías hospitalarias',
      'robot para comedores institucionales',
      'robot para hoteles',
      'robot con bandeja',
      'robot de servicio de mesa',
      'robot para hospitalidad',
      'automatización de servicio de alimentos',
      'delivery autónomo de alimentos',
    ],
    en: [
      'food delivery robot',
      'robot waiter',
      'restaurant robot',
      'hospital cafeteria robot',
      'institutional dining robot',
      'hotel service robot',
      'tray robot',
      'table service robot',
      'hospitality robot',
      'food service automation',
      'autonomous food delivery',
    ],
  },
  'robots-limpieza-autonoma': {
    es: [
      'robot de limpieza autónoma',
      'robot limpiador industrial',
      'robot de limpieza institucional',
      'robot para limpieza hospitalaria no crítica',
      'robot para pisos duros',
      'robot trapeador industrial',
      'robot aspirador industrial',
      'robot para pasillos hospitalarios',
      'robot para hoteles y universidades',
      'automatización de limpieza',
      'limpieza autónoma de grandes superficies',
      'mantenimiento automatizado de pisos',
    ],
    en: [
      'autonomous cleaning robot',
      'industrial cleaning robot',
      'institutional cleaning robot',
      'robot for non-critical hospital cleaning',
      'hard floor cleaning robot',
      'industrial mopping robot',
      'industrial vacuum robot',
      'hospital corridor cleaning robot',
      'robot for hotels and universities',
      'cleaning automation',
      'autonomous large-surface cleaning',
      'automated floor maintenance',
    ],
  },
  'robots-educativos-sociales': {
    es: [
      'robot educativo',
      'robot social',
      'robot de acompañamiento',
      'robot para educación STEAM',
      'robot para universidades',
      'robot para colegios',
      'robot para pediatría no clínica',
      'robot interactivo para adultos mayores',
      'robot para activaciones institucionales',
      'robot para ferias de salud',
      'robot de entretenimiento educativo',
      'robótica social',
    ],
    en: [
      'educational robot',
      'social robot',
      'companion robot',
      'STEAM education robot',
      'robot for universities',
      'robot for schools',
      'robot for non-clinical pediatric spaces',
      'interactive robot for older adults',
      'robot for institutional activations',
      'robot for healthcare fairs',
      'educational entertainment robot',
      'social robotics',
    ],
  },
};

const marketParagraphs = {
  'robots-recepcion-atencion': {
    es:
      'Para proyectos en Colombia, Latinoamérica y España, esta categoría responde a búsquedas de robots asistenciales, robots de recepción, robots hospitalarios, orientación de pacientes, admisiones automatizadas, atención a visitantes, hospitales 4.0 y automatización de servicios en clínicas, IPS, hoteles, universidades y edificios corporativos.',
    en:
      'For projects in Colombia, Latin America and Spain, this category matches searches for assistive robots, reception robots, hospital robots, patient wayfinding, automated admissions, visitor assistance, hospital 4.0 and service automation in clinics, healthcare providers, hotels, universities and corporate buildings.',
  },
  'robots-telepresencia': {
    es:
      'Para servicios médicos, tercera edad y atención remota en Colombia, Latinoamérica y España, este modelo cubre búsquedas de robot de telepresencia, telemedicina, teleconsulta, teleasistencia, acompañamiento virtual, rondas remotas, especialistas a distancia y soporte para adultos mayores o residencias de cuidado.',
    en:
      'For medical services, senior care and remote assistance in Colombia, Latin America and Spain, this model covers searches for telepresence robots, telemedicine, teleconsultation, teleassistance, virtual accompaniment, remote rounds, remote specialists and support for older adults or care residences.',
  },
  'robots-delivery-institucional': {
    es:
      'Para logística institucional y salud en Colombia, Latinoamérica y España, esta solución se alinea con búsquedas de robots industriales de servicio, robot de delivery hospitalario, logística interna en clínicas, transporte de documentos, insumos no estériles, muestras no críticas y automatización de rutas repetitivas.',
    en:
      'For institutional logistics and healthcare in Colombia, Latin America and Spain, this solution aligns with searches for industrial service robots, hospital delivery robots, clinic internal logistics, document transport, non-sterile supplies, non-critical samples and repetitive route automation.',
  },
  'robots-delivery-alimentos': {
    es:
      'Para hospitality, alimentación institucional y servicios complementarios de salud en Colombia, Latinoamérica y España, este robot responde a búsquedas de robot camarero, robot de delivery de alimentos, robot para cafeterías hospitalarias, robot para hoteles, comedores institucionales y automatización de servicio de mesa.',
    en:
      'For hospitality, institutional dining and complementary healthcare services in Colombia, Latin America and Spain, this robot targets searches for robot waiter, food delivery robot, hospital cafeteria robot, hotel robot, institutional dining robot and table service automation.',
  },
  'robots-limpieza-autonoma': {
    es:
      'Para operación industrial, edificios de salud y mantenimiento institucional en Colombia, Latinoamérica y España, este equipo cubre búsquedas de robot de limpieza autónoma, robot limpiador industrial, limpieza hospitalaria no crítica, limpieza de pasillos, pisos duros, universidades, hoteles y grandes superficies.',
    en:
      'For industrial operations, healthcare buildings and institutional maintenance in Colombia, Latin America and Spain, this device covers searches for autonomous cleaning robot, industrial cleaning robot, non-critical hospital cleaning, corridor cleaning, hard floors, universities, hotels and large surfaces.',
  },
  'robots-educativos-sociales': {
    es:
      'Para educación, tercera edad y experiencias institucionales en Colombia, Latinoamérica y España, esta categoría responde a búsquedas de robot educativo, robot social, robot de acompañamiento, robótica STEAM, interacción con adultos mayores, ferias de salud y activaciones tecnológicas.',
    en:
      'For education, senior care and institutional experiences in Colombia, Latin America and Spain, this category matches searches for educational robot, social robot, companion robot, STEAM robotics, interaction with older adults, healthcare fairs and technology activations.',
  },
};

function uniqueStrings(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
}

function buildSeoKeywords(product, locale) {
  const lang = locale === 'en' ? 'en' : 'es';
  const type = typeBySlug.get(product.tipo_slug);
  return uniqueStrings([
    locale === 'en' ? product.nombre_en : product.nombre_es,
    product.marca,
    type?.[locale === 'en' ? 'nombre_en' : 'nombre_es'],
    ...marketKeywords[lang],
    ...(typeKeywords[product.tipo_slug]?.[lang] ?? []),
  ]);
}

function enrichDescription(product, locale) {
  const paragraph = marketParagraphs[product.tipo_slug]?.[locale === 'en' ? 'en' : 'es'];
  const base = locale === 'en' ? product.descripcion_larga_en : product.descripcion_larga_es;
  return paragraph ? `${base}\n\n${paragraph}` : base;
}

function enrichApplications(product, locale) {
  const base = locale === 'en' ? product.aplicaciones_en : product.aplicaciones_es;
  const additions =
    locale === 'en'
      ? [
          'Healthcare institutions in Colombia, Latin America and Spain',
          'Senior care, service and assisted-living environments when validated by workflow',
          'Hospital 4.0 and institutional automation projects',
          'Commercial and industrial service automation',
        ]
      : [
          'Instituciones de salud en Colombia, Latinoamérica y España',
          'Entornos de tercera edad, cuidado y vida asistida cuando el flujo lo valide',
          'Proyectos de hospital 4.0 y automatización institucional',
          'Automatización comercial e industrial de servicios',
        ];
  return uniqueStrings([...base, ...additions]);
}

const products = [
  {
    id: 'b0e856bd-b2c9-4dd1-b53e-6e60831df04d',
    slug: 'cruzr-robot-comercial-inteligente-ahuman-future',
    sku: 'CRUZR-AHUMAN-FUTURE',
    tipo_slug: 'robots-recepcion-atencion',
    pdf: 'AOMANFUTURE Cruzr .pdf',
    pdfName: 'ficha-cruzr-robot-comercial-inteligente-ahuman-future.pdf',
    imagePage: 2,
    galleryPages: [3],
    nombre_es: 'Cruzr Robot Comercial Inteligente AHuman Future',
    nombre_en: 'Cruzr Intelligent Commercial Service Robot AHuman Future',
    descripcion_corta_es:
      'Robot humanoide de servicio comercial basado en la nube, diseñado para recepción, interacción con visitantes y experiencias institucionales personalizadas.',
    descripcion_corta_en:
      'Cloud-based humanoid commercial service robot for reception, visitor interaction and personalized institutional experiences.',
    descripcion_larga_es:
      'Cruzr es un robot comercial inteligente de AHuman Future orientado a automatizar atención presencial, bienvenida y presentación de servicios en espacios institucionales. Su propuesta combina sistema robótico en la nube, API abierta y soluciones personalizables por industria, lo que permite adaptar guiones, interacciones y flujos de atención a cada sede.\n\nPara clínicas, hospitales, hoteles, universidades, centros comerciales y empresas con alto tráfico de visitantes, Cruzr ayuda a reducir tareas repetitivas, optimizar recursos humanos y elevar la calidad percibida del servicio. Su diseño humanoide facilita una experiencia de contacto más amable que un kiosco fijo, mientras sus capacidades de detección facial, navegación estereoscópica, evitación de obstáculos e interacción humano-maquina permiten acompañar recorridos y activar mensajes comerciales o informativos.\n\nI-ME lo posiciona como solución de automatización de experiencia, recepción y mercadeo presencial para instituciones que buscan diferenciar su servicio, mejorar satisfacción y fortalecer imagen corporativa sin depender solo de personal en punto fijo.',
    descripcion_larga_en:
      'Cruzr is an intelligent commercial service robot from AHuman Future designed to automate in-person assistance, greetings and service presentation in institutional spaces. Its value proposition combines a cloud-based robotic OS, an open API and industry-specific customization, allowing scripts, interactions and service flows to be adapted to each site.\n\nFor clinics, hospitals, hotels, universities, shopping centers and companies with high visitor traffic, Cruzr helps reduce repetitive tasks, optimize human resources and improve perceived service quality. Its humanoid design creates a friendlier touchpoint than a fixed kiosk, while face detection, stereoscopic navigation, real-time obstacle avoidance and human-machine interaction support guided experiences and commercial or informational messaging.\n\nI-ME positions Cruzr as an experience automation, reception and on-site marketing solution for institutions that want to differentiate service, improve satisfaction and strengthen brand image without relying only on fixed-front-desk staffing.',
    aplicaciones_es: [
      'Recepcion institucional y bienvenida de visitantes',
      'Orientacion en hospitales, clinicas y edificios corporativos',
      'Presentacion comercial en puntos de alto trafico',
      'Automatizacion de preguntas frecuentes y mensajes de marca',
    ],
    aplicaciones_en: [
      'Institutional reception and visitor greeting',
      'Wayfinding in hospitals, clinics and corporate buildings',
      'Commercial presentation in high-traffic points',
      'FAQ automation and brand messaging',
    ],
    beneficios_es: [
      'Sistema robotico basado en la nube con API abierta',
      'Deteccion facial e interaccion humano-maquina',
      'Navegacion estereoscopica con evitacion de obstaculos en tiempo real',
      'Mensajes, presentaciones y flujos personalizables por industria',
      'Reduce tareas repetitivas y mejora experiencia del visitante',
    ],
    beneficios_en: [
      'Cloud-based robotic OS with open API',
      'Face detection and human-machine interaction',
      'Stereoscopic navigation with real-time obstacle avoidance',
      'Industry-specific messages, presentations and flows',
      'Reduces repetitive tasks and improves visitor experience',
    ],
    valor_es:
      'Cruzr convierte recepcion y puntos de informacion en un canal activo de servicio, orientacion y marketing institucional.',
    valor_en:
      'Cruzr turns reception and information points into an active channel for service, wayfinding and institutional marketing.',
    especificaciones: [
      spec('Producto', 'Cruzr', 'Identificacion'),
      spec('Fabricante / marca visible', 'AHuman Future', 'Identificacion'),
      spec('Categoria visible en ficha', 'Cloud-based Intelligent Commercial Service Robot', 'Identificacion'),
      spec('Arquitectura', 'Cloud-based Robotic OS', 'Plataforma'),
      spec('Integracion', 'Open API', 'Plataforma'),
      spec('Personalizacion', 'Industry-specific solutions / customized personalization', 'Plataforma'),
      spec('Interaccion', 'Human-machine interaction', 'Funciones'),
      spec('Percepcion', 'Face detection', 'Funciones'),
      spec('Navegacion', 'Stereoscopic navigation', 'Funciones'),
      spec('Seguridad operativa', 'Real-time obstacle avoidance', 'Funciones'),
      spec('Presentacion', 'Flexible presentation / marketing upgrade', 'Funciones'),
    ],
    marca: 'AHuman Future',
    destacado: true,
    orden: 470,
  },
  {
    id: '8132d872-63da-4f0a-b410-27894a84a575',
    slug: 'padbot-x3-robot-recepcion',
    sku: 'PADBOT-X3',
    tipo_slug: 'robots-recepcion-atencion',
    pdf: 'X3英文说明书0115.pdf',
    pdfName: 'ficha-padbot-x3-robot-recepcion.pdf',
    imagePage: 3,
    galleryPages: [10, 13],
    nombre_es: 'PadBot X3 Robot de Recepción',
    nombre_en: 'PadBot X3 Reception Robot',
    descripcion_corta_es:
      'Robot de recepción con pantalla corporal de 19 pulgadas, reconocimiento facial, interacción por voz, navegación por mapas y videoatención remota.',
    descripcion_corta_en:
      'Reception robot with 19-inch body screen, face recognition, voice interaction, map navigation and remote video support.',
    descripcion_larga_es:
      'PadBot X3 está diseñado para recepción, orientación y atención inicial en instituciones con flujo permanente de visitantes. Integra pantalla principal de 10.1 pulgadas, pantalla corporal de 19 pulgadas, conectividad 4G/WiFi, reconocimiento facial, Q&A personalizable y gestión de sueño con reproducción de videos o slogans para comunicación institucional.\n\nEl robot permite crear mapas, definir puntos de destino, puntos de carga, espera de ascensor, acceso, cambio de mapa, muros virtuales, zonas restringidas y limites de velocidad. Esta lógica de navegación lo hace útil para lobby hospitalario, admisiones, consultorios, centros de diagnóstico, hoteles y campus corporativos donde se requiere orientar personas, contestar preguntas frecuentes y escalar atención a un operador.\n\nDesde la app PadBot se habilita video bidireccional o unidireccional: el administrador puede ver la escena, controlar movimiento y convertir texto en voz del robot. En modelos equipados, X3 puede incorporar impresora opcional, útil para turnos, comprobantes o información de visita cuando el flujo lo requiera.',
    descripcion_larga_en:
      'PadBot X3 is designed for reception, wayfinding and first-line assistance in institutions with constant visitor flow. It combines a 10.1-inch main screen, a 19-inch body screen, 4G/WiFi connectivity, face recognition, customizable Q&A and sleep-mode video or slogan playback for institutional communication.\n\nThe robot supports map creation, destination points, charging points, elevator waiting points, access-control points, map switching points, virtual walls, restricted areas and speed-limit areas. This navigation logic makes it suitable for hospital lobbies, admissions desks, clinics, diagnostic centers, hotels and corporate campuses that need to guide people, answer FAQs and escalate assistance to a remote operator.\n\nThe PadBot app enables two-way or one-way video: an administrator can see the on-site scene, control movement and convert typed text into robot speech. Equipped models may include an optional printer for tickets, receipts or visitor information when the workflow requires it.',
    aplicaciones_es: [
      'Recepcion hospitalaria y admisiones',
      'Orientacion de visitantes en edificios',
      'Atencion remota con videooperador',
      'Mensajes institucionales y promocionales en lobby',
    ],
    aplicaciones_en: [
      'Hospital reception and admissions',
      'Visitor wayfinding inside buildings',
      'Remote assistance with video operator',
      'Institutional and promotional lobby messaging',
    ],
    beneficios_es: [
      'Pantalla corporal amplia para comunicacion visual',
      'Reconocimiento facial con saludos por grupos registrados',
      'Navegacion por mapas con puntos, zonas restringidas y limites',
      'Videoatencion remota bidireccional o unidireccional',
      'Opcion de impresora para flujos de recepcion',
    ],
    beneficios_en: [
      'Large body screen for visual communication',
      'Face recognition with registered group greetings',
      'Map navigation with points, restricted areas and limits',
      'Two-way or one-way remote video assistance',
      'Optional printer for reception workflows',
    ],
    valor_es:
      'PadBot X3 refuerza la primera linea de atención y convierte el lobby en un punto automatizado de orientación, respuesta y experiencia.',
    valor_en:
      'PadBot X3 strengthens front-desk service and turns the lobby into an automated point for guidance, answers and experience.',
    especificaciones: [
      spec('Dimensiones', '49 x 140 x 48 cm'),
      spec('Pantalla principal', '10.1 pulgadas'),
      spec('Pantalla corporal', '19 pulgadas'),
      spec('Resolucion', '1280 x 800'),
      spec('Peso neto', '23 kg'),
      spec('Bateria', '12800 mAh'),
      spec('Entrada de carga', '25.9V / 3A'),
      spec('Puerto de carga', 'DC 5.5 x 2.1'),
      spec('Tiempo de carga', '9 h'),
      spec('Autonomia', '10 h'),
      spec('Conectividad', '4G con Micro-SIM y WiFi', 'Conectividad'),
      spec('Seguridad', 'Boton de parada de emergencia; sensores anti-colision y anti-caida', 'Seguridad'),
      spec('Funciones', 'Voz, Q&A personalizado, reconocimiento facial, video remoto', 'Funciones'),
      spec('Impresora', 'Opcional segun configuracion', 'Funciones'),
    ],
    marca: 'PadBot',
    destacado: true,
    orden: 471,
  },
  {
    id: 'e986e120-882c-4292-9097-122b54ebec98',
    slug: 'padbot-x2-robot-servicio-interactivo',
    sku: 'PADBOT-X2',
    tipo_slug: 'robots-recepcion-atencion',
    pdf: 'X2英文说明书0701.pdf',
    pdfName: 'ficha-padbot-x2-robot-servicio-interactivo.pdf',
    imagePage: 3,
    galleryPages: [9, 13],
    nombre_es: 'PadBot X2 Robot de Servicio Interactivo',
    nombre_en: 'PadBot X2 Interactive Service Robot',
    descripcion_corta_es:
      'Robot interactivo de servicio con pantalla de cabeza de 10.1 pulgadas, pantalla corporal de 15.6 pulgadas, 4G/WiFi y navegación autónoma por mapas.',
    descripcion_corta_en:
      'Interactive service robot with 10.1-inch head screen, 15.6-inch body screen, 4G/WiFi and autonomous map navigation.',
    descripcion_larga_es:
      'PadBot X2 es una solución compacta para atención, orientación y comunicación en puntos de servicio. Combina interacción por voz, Q&A personalizado, reconocimiento facial, reproducción de anuncios en modo reposo y videoatención remota con control de movimiento desde la app.\n\nSu navegación se gestiona mediante mapas con puntos objetivo, puntos de carga, zonas restringidas, muros virtuales, zonas transitables, límites de velocidad y puntos asociados a ascensores o accesos. Esto permite instalarlo en recepciones, salas de espera, centros comerciales, instituciones educativas y edificios corporativos donde se requiere guiar usuarios y automatizar respuestas frecuentes.\n\nLa batería de 20000 mAh y su peso de 15 kg lo hacen una alternativa liviana frente a robots de recepción de mayor formato, manteniendo pantalla corporal para comunicación visual y presencia de marca.',
    descripcion_larga_en:
      'PadBot X2 is a compact solution for assistance, wayfinding and communication at service points. It combines voice interaction, customizable Q&A, face recognition, sleep-mode advertising playback and remote video assistance with movement control from the app.\n\nNavigation is managed through maps with target points, charging points, restricted areas, virtual walls, passable areas, speed limits and points associated with elevators or access gates. This makes it suitable for reception areas, waiting rooms, shopping centers, educational institutions and corporate buildings where users need guidance and frequent answers can be automated.\n\nIts 20000 mAh battery and 15 kg weight make it a lighter alternative to larger reception robots, while preserving a body screen for visual communication and brand presence.',
    aplicaciones_es: [
      'Puntos de informacion y orientacion',
      'Salas de espera y recepciones compactas',
      'Promocion institucional en pantalla',
      'Atencion remota por video',
    ],
    aplicaciones_en: [
      'Information and wayfinding points',
      'Waiting rooms and compact receptions',
      'Institutional promotion on screen',
      'Remote video assistance',
    ],
    beneficios_es: [
      'Formato liviano con doble pantalla',
      'Bateria de 20000 mAh para jornadas extendidas',
      'Reconocimiento facial y Q&A configurable',
      'Mapas con zonas restringidas y puntos de destino',
      'Auto carga desde base cuando se habilita en app',
    ],
    beneficios_en: [
      'Lightweight format with dual screen',
      '20000 mAh battery for extended shifts',
      'Face recognition and configurable Q&A',
      'Maps with restricted areas and destination points',
      'Auto-charge from dock when enabled in app',
    ],
    valor_es:
      'PadBot X2 automatiza orientación y atención de primer nivel sin ocupar el espacio físico de un punto fijo tradicional.',
    valor_en:
      'PadBot X2 automates guidance and first-line service without taking the space of a traditional fixed desk.',
    especificaciones: [
      spec('Dimensiones', '40 x 115 x 48 cm'),
      spec('Pantalla de cabeza', '10.1 pulgadas'),
      spec('Pantalla corporal', '15.6 pulgadas'),
      spec('Resolucion', '1280 x 800'),
      spec('Peso neto', '15 kg'),
      spec('Bateria', '20000 mAh'),
      spec('Entrada de carga', '16.8V / 3A'),
      spec('Puerto de carga', 'DC 5.5 x 2.1'),
      spec('Tiempo de carga', '9 h'),
      spec('Autonomia', '10 h'),
      spec('Conectividad', '4G con Micro-SIM y WiFi', 'Conectividad'),
      spec('Seguridad', 'Boton de parada de emergencia; sensores anti-colision y anti-caida', 'Seguridad'),
      spec('Funciones', 'Voz, Q&A personalizado, reconocimiento facial, video remoto', 'Funciones'),
    ],
    marca: 'PadBot',
    orden: 472,
  },
  {
    id: '8e24c076-ace2-408a-9f46-53cd1ab05835',
    slug: 'padbot-p2-robot-telepresencia',
    sku: 'PADBOT-P2',
    tipo_slug: 'robots-telepresencia',
    pdf: 'P2英文说明书.pptx.pdf',
    pdfName: 'ficha-padbot-p2-robot-telepresencia.pdf',
    imagePage: 3,
    galleryPages: [13, 15],
    nombre_es: 'PadBot P2 Robot de Telepresencia',
    nombre_en: 'PadBot P2 Telepresence Robot',
    descripcion_corta_es:
      'Robot de telepresencia plegable con pantalla HD de 10 pulgadas, WiFi/4G, video llamada, control remoto y auto carga.',
    descripcion_corta_en:
      'Foldable telepresence robot with 10-inch HD screen, WiFi/4G, video calling, remote control and auto charging.',
    descripcion_larga_es:
      'PadBot P2 está pensado para presencia remota, acompañamiento virtual y atención con operador a distancia. Su pantalla HD de 10 pulgadas, cuerpo plegable, conectividad WiFi/4G y sistema de video llamada permiten que un usuario remoto se desplace, converse, vea el entorno y controle el robot desde la aplicación PadBot Admin.\n\nEl equipo incorpora PadBot AI Brain para comunicación por voz, preguntas y respuestas personalizadas, reconocimiento facial, fotos, bloqueo de pantalla, mensajes de bienvenida y gestión de permisos entre administrador y usuarios normales. La función de video unidireccional permite que el operador observe la escena y controle el robot sin mostrar su video al público cuando el flujo lo requiere.\n\nEn salud y servicios, P2 puede apoyar teleorientación, rondas administrativas, visitas remotas, acompañamiento en instituciones educativas, recepción secundaria y soporte a pacientes o usuarios en salas de espera, siempre como herramienta de comunicación y no como dispositivo medico.',
    descripcion_larga_en:
      'PadBot P2 is designed for remote presence, virtual accompaniment and operator-assisted service. Its 10-inch HD screen, foldable body, WiFi/4G connectivity and video calling system allow a remote user to move, talk, view the environment and control the robot from the PadBot Admin app.\n\nThe device includes PadBot AI Brain for voice communication, customized Q&A, face recognition, photos, screen lock, welcome messages and permission management between administrators and normal users. One-way video mode lets an operator observe the on-site scene and control the robot without showing the remote video to the public when the workflow requires it.\n\nIn healthcare and service environments, P2 can support tele-orientation, administrative rounds, remote visits, educational accompaniment, secondary reception and support for patients or users in waiting areas, as a communication tool rather than a medical device.',
    aplicaciones_es: [
      'Telepresencia en instituciones de salud',
      'Rondas administrativas remotas',
      'Acompañamiento virtual en salas de espera',
      'Videoatencion y control remoto',
    ],
    aplicaciones_en: [
      'Telepresence in healthcare institutions',
      'Remote administrative rounds',
      'Virtual accompaniment in waiting rooms',
      'Video assistance and remote control',
    ],
    beneficios_es: [
      'Cuerpo plegable y peso de 6.5 kg',
      'WiFi y 4G con Micro-SIM',
      'Video llamada bidireccional o unidireccional',
      'Reconocimiento facial y Q&A personalizable',
      'Auto carga desde base cuando se habilita en app',
    ],
    beneficios_en: [
      'Foldable body and 6.5 kg weight',
      'WiFi and 4G with Micro-SIM',
      'Two-way or one-way video calling',
      'Face recognition and customizable Q&A',
      'Auto-charge from dock when enabled in app',
    ],
    valor_es:
      'PadBot P2 acerca especialistas, administrativos y acompañantes remotos a espacios físicos sin desplazar personas.',
    valor_en:
      'PadBot P2 brings remote specialists, administrators and companions into physical spaces without moving people.',
    especificaciones: [
      spec('Dimensiones', '27 x 37.2 x 110 cm'),
      spec('Pantalla', '10 pulgadas HD'),
      spec('Resolucion', 'HD 1280 x 800'),
      spec('Peso neto', '6.5 kg'),
      spec('Bateria', '5000 mAh'),
      spec('Entrada de carga', '12.6V / 1.5A'),
      spec('Interfaz de carga', '5.5 x 2.1'),
      spec('Tiempo de carga', '6 h'),
      spec('Autonomia', '10 h'),
      spec('Standby', '40 h'),
      spec('Conectividad', 'WiFi y 4G con Micro-SIM', 'Conectividad'),
      spec('Seguridad', 'Sistema de prevencion de colision y anti-caida', 'Seguridad'),
      spec('Funciones', 'PadBot AI Brain, video llamada, control remoto, reconocimiento facial', 'Funciones'),
    ],
    marca: 'PadBot',
    orden: 473,
  },
  {
    id: 'e067c073-02ce-4ccf-873f-0c630f210ddb',
    slug: 'padbot-w2-robot-delivery-institucional',
    sku: 'PADBOT-W2',
    tipo_slug: 'robots-delivery-institucional',
    pdf: 'W2英文说明书0115.pdf',
    pdfName: 'ficha-padbot-w2-robot-delivery-institucional.pdf',
    imagePage: 3,
    galleryPages: [9, 11],
    nombre_es: 'PadBot W2 Robot de Delivery Institucional',
    nombre_en: 'PadBot W2 Institutional Delivery Robot',
    descripcion_corta_es:
      'Robot de delivery con locker, pantalla de 10.1 pulgadas, navegación por mapas, 4G/WiFi, sensores anti-colisión y base de carga.',
    descripcion_corta_en:
      'Delivery robot with locker, 10.1-inch screen, map navigation, 4G/WiFi, anti-collision sensors and charging dock.',
    descripcion_larga_es:
      'PadBot W2 está orientado a transporte interno y delivery institucional en sedes donde se requiere mover elementos entre puntos definidos con trazabilidad operativa. Integra locker, pantalla de 10.1 pulgadas, conectividad 4G/WiFi, botón de parada de emergencia y sensores anti-colisión y anti-caída.\n\nLa plataforma permite crear mapas, editar puntos objetivo, puntos de carga, espera de ascensor, puntos de acceso, cambio de mapa, muros virtuales, zonas restringidas, áreas transitables y límites de velocidad. Esta granularidad ayuda a adaptar el robot a corredores, lobbies, áreas administrativas, hoteles, universidades y espacios de servicio con rutas repetitivas.\n\nPara entornos de salud, W2 puede analizarse como apoyo logístico para documentos, muestras no críticas, insumos no estériles o elementos administrativos bajo protocolo interno; I-ME recomienda validación operativa y de bioseguridad antes de usarlo en circuitos clínicos sensibles.',
    descripcion_larga_en:
      'PadBot W2 is aimed at internal transport and institutional delivery in facilities that need to move items between defined points with operational traceability. It integrates a locker, 10.1-inch screen, 4G/WiFi connectivity, emergency stop button and anti-collision and anti-fall sensors.\n\nThe platform supports map creation, editable target points, charging points, elevator waiting points, access points, map switching, virtual walls, restricted areas, passable areas and speed limits. This granularity helps adapt the robot to corridors, lobbies, administrative areas, hotels, universities and service spaces with repetitive routes.\n\nFor healthcare environments, W2 can be evaluated as logistical support for documents, non-critical samples, non-sterile supplies or administrative items under internal protocol; I-ME recommends operational and biosafety validation before using it in sensitive clinical circuits.',
    aplicaciones_es: [
      'Delivery interno de documentos e insumos no esteriles',
      'Rutas repetitivas en edificios institucionales',
      'Hoteles, universidades y sedes corporativas',
      'Apoyo logistico en areas administrativas',
    ],
    aplicaciones_en: [
      'Internal delivery of documents and non-sterile supplies',
      'Repetitive routes inside institutional buildings',
      'Hotels, universities and corporate facilities',
      'Logistics support in administrative areas',
    ],
    beneficios_es: [
      'Locker integrado para transporte controlado',
      'Mapas con puntos, zonas restringidas y limites de velocidad',
      'Soporte de puntos de ascensor y control de acceso',
      '4G/WiFi para gestion operativa',
      'Boton de emergencia y sensores anti-colision/anti-caida',
    ],
    beneficios_en: [
      'Integrated locker for controlled transport',
      'Maps with points, restricted areas and speed limits',
      'Support for elevator and access-control points',
      '4G/WiFi for operational management',
      'Emergency button and anti-collision/anti-fall sensors',
    ],
    valor_es:
      'PadBot W2 reduce recorridos repetitivos del personal y ordena flujos internos de entrega en sedes con rutas definidas.',
    valor_en:
      'PadBot W2 reduces repetitive staff trips and organizes internal delivery flows in facilities with defined routes.',
    especificaciones: [
      spec('Dimensiones', '50 x 120 x 50 cm'),
      spec('Pantalla', '10.1 pulgadas'),
      spec('Resolucion', '1280 x 800'),
      spec('Peso neto', '40 kg'),
      spec('Bateria', '12800 mAh'),
      spec('Entrada de carga', '25.9V / 3A'),
      spec('Tiempo de carga', '9 h'),
      spec('Autonomia', '10 h'),
      spec('Conectividad', '4G con Micro-SIM y WiFi', 'Conectividad'),
      spec('Carga', 'Carga directa o base de carga', 'Energia'),
      spec('Seguridad', 'Boton de parada de emergencia; sensores anti-colision y anti-caida', 'Seguridad'),
      spec('Navegacion', 'Mapas, puntos objetivo, muros virtuales, zonas restringidas y limites de velocidad', 'Navegacion'),
      spec('Almacenamiento', 'Locker integrado', 'Funciones'),
    ],
    marca: 'PadBot',
    orden: 474,
  },
  {
    id: '97d6eb5d-668a-4444-99ee-04f037d41efa',
    slug: 'padbot-w3s-robot-delivery-alimentos',
    sku: 'PADBOT-W3S',
    tipo_slug: 'robots-delivery-alimentos',
    pdf: 'W3s英文说明书0518.pdf',
    pdfName: 'ficha-padbot-w3s-robot-delivery-alimentos.pdf',
    imagePage: 3,
    galleryPages: [11, 15],
    nombre_es: 'PadBot W3s Robot de Delivery de Alimentos',
    nombre_en: 'PadBot W3s Food Delivery Robot',
    descripcion_corta_es:
      'Robot de delivery de alimentos con bandeja, pantalla publicitaria de 15.6 pulgadas, mapas con puntos de cocina y retorno, 4G/WiFi y base de carga.',
    descripcion_corta_en:
      'Food delivery robot with tray, 15.6-inch advertising screen, maps with kitchen and return points, 4G/WiFi and charging dock.',
    descripcion_larga_es:
      'PadBot W3s está diseñado para delivery de alimentos y servicio interno en cafeterías, hoteles, restaurantes, comedores institucionales y áreas de hospitalidad. Incorpora bandeja, pantalla de operación de 10.1 pulgadas y pantalla publicitaria de 15.6 pulgadas Full HD para comunicación visual durante el recorrido.\n\nSu software permite crear mapas, editar puntos de destino y usar puntos específicos de cocina y lavaplatos/retorno, además de puntos de carga, muros virtuales, zonas restringidas, zonas transitables y límites de velocidad. Esta orientación funcional lo diferencia de robots de delivery general, ya que está pensado para rutas de servicio de mesa, recogida y retorno.\n\nEn entornos clínicos, W3s debe evaluarse para cafeterías, servicio de alimentación no crítico o áreas de hospitalidad, no para transporte clínico sensible sin validación sanitaria y operacional.',
    descripcion_larga_en:
      'PadBot W3s is designed for food delivery and internal service in cafeterias, hotels, restaurants, institutional dining rooms and hospitality areas. It includes a tray, 10.1-inch operating screen and 15.6-inch Full HD advertising screen for visual communication during routes.\n\nIts software supports map creation, editable destination points and specific kitchen and dishwash/return points, plus charging points, virtual walls, restricted areas, passable areas and speed limits. This functional orientation sets it apart from general delivery robots because it is designed for table service, pick-up and return routes.\n\nIn clinical environments, W3s should be evaluated for cafeterias, non-critical food service or hospitality areas, not for sensitive clinical transport without health and operational validation.',
    aplicaciones_es: [
      'Cafeterias y restaurantes institucionales',
      'Hoteles y servicio de alimentos',
      'Comedores empresariales o universitarios',
      'Promocion visual durante recorridos',
    ],
    aplicaciones_en: [
      'Institutional cafeterias and restaurants',
      'Hotels and food service',
      'Corporate or university dining rooms',
      'Visual promotion during routes',
    ],
    beneficios_es: [
      'Bandeja integrada para servicio de alimentos',
      'Pantalla publicitaria Full HD de 15.6 pulgadas',
      'Puntos de cocina y retorno/lavado en mapas',
      'Rutas con zonas restringidas y limites de velocidad',
      '4G/WiFi y base de carga',
    ],
    beneficios_en: [
      'Integrated tray for food service',
      '15.6-inch Full HD advertising screen',
      'Kitchen and return/dishwash map points',
      'Routes with restricted areas and speed limits',
      '4G/WiFi and charging dock',
    ],
    valor_es:
      'PadBot W3s automatiza recorridos de servicio de alimentos y agrega comunicacion visual durante la entrega.',
    valor_en:
      'PadBot W3s automates food service routes and adds visual communication during delivery.',
    especificaciones: [
      spec('Dimensiones', '50 x 120 x 50 cm'),
      spec('Pantalla principal', '10.1 pulgadas'),
      spec('Resolucion principal', '1280 x 800'),
      spec('Pantalla publicitaria', '15.6 pulgadas'),
      spec('Resolucion pantalla publicitaria', '1920 x 1080'),
      spec('Peso neto', '33.5 kg'),
      spec('Bateria', '12800 mAh'),
      spec('Entrada de carga', '25.9V / 3A'),
      spec('Tiempo de carga', '9 h'),
      spec('Autonomia', '10 h'),
      spec('Conectividad', '4G con Micro-SIM y WiFi', 'Conectividad'),
      spec('Seguridad', 'Boton de parada de emergencia; sensores anti-colision y anti-caida', 'Seguridad'),
      spec('Navegacion', 'Puntos objetivo, cocina, dishwash/retorno, muros virtuales y zonas restringidas', 'Navegacion'),
      spec('Servicio', 'Bandeja y pantalla publicitaria', 'Funciones'),
    ],
    marca: 'PadBot',
    orden: 475,
  },
  {
    id: '9f7f8781-1fda-40d7-bb1c-0def7e7156e6',
    slug: 'c3-robot-limpieza-autonoma',
    sku: 'C3-CLEANING-ROBOT',
    tipo_slug: 'robots-limpieza-autonoma',
    pdf: 'C3英文说明书.pdf',
    pdfName: 'ficha-c3-robot-limpieza-autonoma.pdf',
    imagePage: 14,
    galleryPages: [33, 6],
    nombre_es: 'C3 Robot de Limpieza Autónoma',
    nombre_en: 'C3 Autonomous Cleaning Robot',
    descripcion_corta_es:
      'Robot de limpieza para pisos duros interiores con aspirado, trapeado, empuje de polvo, base multifunción y gestión de agua limpia/residual.',
    descripcion_corta_en:
      'Indoor hard-floor cleaning robot with vacuuming, mopping, dust-mopping, multifunction charging dock and clean/sewage water management.',
    descripcion_larga_es:
      'C3 es un robot de limpieza autónoma para pisos duros interiores como baldosa, mármol y madera. El manual describe modos de aspirado, trapeado y empuje de polvo, panel de control en el tirador, retorno a base por batería baja, gestión de agua limpia/residual y base multifunción con carga e intercambio de agua.\n\nSu operación está orientada a grandes superficies institucionales donde se necesita estandarizar recorridos de limpieza, reducir carga operativa repetitiva y mantener continuidad durante jornadas de mantenimiento. El equipo integra sensores de desnivel, sensor láser clase 1 conforme IEC 60825-1:2014, botón de emergencia, indicador de estados y batería removible.\n\nI-ME lo presenta para áreas interiores no clínicas críticas: lobbies, pasillos, zonas administrativas, hoteles, universidades, oficinas y espacios comerciales. En instituciones de salud debe validarse protocolo de limpieza, química permitida y restricciones del fabricante antes de integrarlo a circuitos asistenciales.',
    descripcion_larga_en:
      'C3 is an autonomous cleaning robot for indoor hard floors such as tile, marble and wood. The manual describes vacuuming, mopping and dust-mopping modes, a pull-rod control panel, return-to-dock behavior for low battery, clean/sewage water management and a multifunction dock for charging and water exchange.\n\nIt is aimed at large institutional surfaces where teams need to standardize cleaning routes, reduce repetitive operational workload and maintain continuity during maintenance shifts. The device includes cliff sensors, a Class 1 laser sensor compliant with IEC 60825-1:2014, emergency stop, status indicators and removable battery.\n\nI-ME presents it for non-critical indoor areas such as lobbies, corridors, administrative zones, hotels, universities, offices and commercial spaces. In healthcare institutions, cleaning protocol, allowed chemistry and manufacturer restrictions should be validated before integrating it into clinical circuits.',
    aplicaciones_es: [
      'Lobbies, pasillos y zonas administrativas',
      'Hoteles, universidades y edificios corporativos',
      'Mantenimiento de pisos duros interiores',
      'Automatizacion de limpieza repetitiva',
    ],
    aplicaciones_en: [
      'Lobbies, corridors and administrative areas',
      'Hotels, universities and corporate buildings',
      'Indoor hard-floor maintenance',
      'Automation of repetitive cleaning',
    ],
    beneficios_es: [
      'Aspirado, trapeado y empuje de polvo en un solo equipo',
      'Base multifuncion con carga y gestion de agua',
      'Retorno automatico por bateria o niveles de agua',
      'Sensor laser clase 1 y sensores de desnivel',
      'Ruido inferior a 70 dB segun ficha',
    ],
    beneficios_en: [
      'Vacuuming, mopping and dust-mopping in one device',
      'Multifunction dock with charging and water management',
      'Automatic return for battery or water levels',
      'Class 1 laser sensor and cliff sensors',
      'Noise below 70 dB according to datasheet',
    ],
    valor_es:
      'C3 automatiza limpieza de superficies duras interiores con base de carga y agua para mantener recorridos repetitivos bajo control operativo.',
    valor_en:
      'C3 automates indoor hard-floor cleaning with charging and water dock to keep repetitive routes under operational control.',
    especificaciones: [
      spec('Uso recomendado', 'Pisos duros interiores: baldosa, marmol, madera', 'Uso'),
      spec('Modos', 'Vacuuming, mopping, dust-mopping', 'Funciones'),
      spec('Peso robot', '68.5 kg'),
      spec('Bateria', '46 Ah'),
      spec('Ruido', '<70 dB'),
      spec('Duracion', '2.5 h'),
      spec('Periodo de carga', '2-3.5 h'),
      spec('Entrada robot', 'DC 29.5V / 20A'),
      spec('Base', 'Multi-Functional Charging Dock', 'Base'),
      spec('Peso base', '25 kg', 'Base'),
      spec('Potencia base', '600 W', 'Base'),
      spec('Entrada base', 'AC 100-240V 50/60Hz 10A', 'Base'),
      spec('Salida base', 'DC 29.5V / 20A', 'Base'),
      spec('Seguridad laser', 'Class 1 laser product, IEC 60825-1:2014', 'Normativa'),
    ],
    marca: 'C3',
    destacado: true,
    orden: 476,
  },
  {
    id: '16361e0e-1e44-4242-9523-4388ca98430b',
    slug: 'padbot-t2-robot-educativo-social',
    sku: 'PADBOT-T2',
    tipo_slug: 'robots-educativos-sociales',
    pdf: 'T2英文说明书0525.pdf',
    pdfName: 'ficha-padbot-t2-robot-educativo-social.pdf',
    imagePage: 3,
    galleryPages: [8, 10],
    nombre_es: 'PadBot T2 Robot Educativo y Social',
    nombre_en: 'PadBot T2 Educational and Social Robot',
    descripcion_corta_es:
      'Robot social compacto con pantalla de 5 pulgadas, interacción por voz, cámara gran angular 720P, juegos, video llamada y control desde app.',
    descripcion_corta_en:
      'Compact social robot with 5-inch screen, voice interaction, 720P wide-angle camera, games, video calling and app control.',
    descripcion_larga_es:
      'PadBot T2 es un robot social de pequeño formato para interacción educativa, acompañamiento y demostraciones de robótica. Integra pantalla de 5 pulgadas, cámara gran angular de 230 grados HD 720P, conectividad WiFi, interacción por voz sin palabra de activación después de conectarse a internet, juegos, música, historias, danza, fotos y video llamada desde la app.\n\nSu tamaño y peso facilitan uso en colegios, universidades, ferias, salas de pediatría no asistenciales, espacios de experiencia y programas de educación STEAM. El manual describe interacciones táctiles, comandos de movimiento, control por app y respuestas emocionales frente a posiciones o contacto.\n\nI-ME lo clasifica como robot educativo/social y no como equipo biomédico. Su valor comercial está en engagement, educación, demostración tecnológica y acompañamiento ligero en entornos controlados.',
    descripcion_larga_en:
      'PadBot T2 is a small social robot for educational interaction, accompaniment and robotics demonstrations. It integrates a 5-inch screen, 230-degree HD 720P wide-angle camera, WiFi connectivity, voice interaction without a wake word after internet connection, games, music, stories, dancing, photos and video calling from the app.\n\nIts size and weight make it suitable for schools, universities, fairs, non-clinical pediatric spaces, experience areas and STEAM education programs. The manual describes touch interactions, movement commands, app control and emotional responses to position or contact.\n\nI-ME classifies it as an educational/social robot, not as biomedical equipment. Its commercial value lies in engagement, education, technology demonstration and light accompaniment in controlled environments.',
    aplicaciones_es: [
      'Educacion STEAM y demostraciones de robotica',
      'Interaccion social en espacios controlados',
      'Ferias, universidades y activaciones institucionales',
      'Acompañamiento no clinico en areas pediátricas o educativas',
    ],
    aplicaciones_en: [
      'STEAM education and robotics demonstrations',
      'Social interaction in controlled spaces',
      'Fairs, universities and institutional activations',
      'Non-clinical accompaniment in pediatric or educational areas',
    ],
    beneficios_es: [
      'Formato compacto de 1.68 kg',
      'Camara gran angular HD 720P de 230 grados',
      'Interaccion por voz, tacto, app y video llamada',
      'Juegos, historias, musica, danza y fotografias',
      'Autonomia de 6 h y standby de 18 h',
    ],
    beneficios_en: [
      'Compact 1.68 kg format',
      '230-degree HD 720P wide-angle camera',
      'Voice, touch, app and video-call interaction',
      'Games, stories, music, dancing and photos',
      '6 h runtime and 18 h standby',
    ],
    valor_es:
      'PadBot T2 crea experiencias educativas e interactivas de bajo riesgo para acercar robotica a usuarios, estudiantes y visitantes.',
    valor_en:
      'PadBot T2 creates low-risk educational and interactive experiences that bring robotics closer to users, students and visitors.',
    especificaciones: [
      spec('Dimensiones', '16.5 x 22.5 x 22 cm'),
      spec('Pantalla', '5 pulgadas'),
      spec('Resolucion', '800 x 480'),
      spec('Peso neto', '1.68 kg'),
      spec('Bateria', '5200 mAh'),
      spec('Entrada de carga', 'DC 5V'),
      spec('Tiempo de carga', '2 h'),
      spec('Autonomia', '6 h'),
      spec('Standby', '18 h'),
      spec('Temperatura de trabajo', '20C - 40C'),
      spec('Procesador', 'Quad-core Cortex-A7'),
      spec('Camara', '230-degree wide-angle HD 720P'),
      spec('Conectividad', 'WiFi', 'Conectividad'),
      spec('Funciones', 'Voz, juegos, video llamada, fotos, musica, historias y danza', 'Funciones'),
    ],
    marca: 'PadBot',
    orden: 477,
  },
];

function readJson(file) {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

function writeJson(file, data) {
  writeFileSync(path.join(DATA_DIR, file), `${JSON.stringify(data, null, 2)}\n`);
}

function upsertByKey(rows, item, keyFn) {
  const key = keyFn(item);
  const index = rows.findIndex(row => keyFn(row) === key);
  if (index >= 0) {
    rows[index] = { ...rows[index], ...item };
  } else {
    rows.push(item);
  }
}

function dedupeByKey(rows, keyFn) {
  const seen = new Set();
  const result = [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const key = keyFn(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.unshift(row);
  }
  return result;
}

async function renderPdfPage(sourcePdf, pageNumber, targetPng) {
  const data = new Uint8Array(readFileSync(sourcePdf));
  const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.65 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, viewport }).promise;
  writeFileSync(targetPng, canvas.toBuffer('image/png'));
}

async function prepareAssets(product) {
  const sourcePdf = path.join(SOURCE_DIR, product.pdf);
  if (!existsSync(sourcePdf)) throw new Error(`No existe PDF fuente: ${sourcePdf}`);
  const productDir = path.join(PUBLIC_ROOT, product.slug);
  mkdirSync(productDir, { recursive: true });
  const pdfTarget = path.join(productDir, product.pdfName);
  copyFileSync(sourcePdf, pdfTarget);

  const imageTarget = path.join(productDir, `imagen-principal-${product.slug}.png`);
  await renderPdfPage(sourcePdf, product.imagePage, imageTarget);
  const galleryTargets = [];
  for (const [index, pageNumber] of product.galleryPages.entries()) {
    const galleryTarget = path.join(productDir, `galeria-${product.slug}-${String(index + 2).padStart(2, '0')}.png`);
    await renderPdfPage(sourcePdf, pageNumber, galleryTarget);
    galleryTargets.push(`/assets/productos/importados/${product.slug}/${path.basename(galleryTarget)}`);
  }

  return {
    imagen_principal: `/assets/productos/importados/${product.slug}/${path.basename(imageTarget)}`,
    galeria: [
      `/assets/productos/importados/${product.slug}/${path.basename(imageTarget)}`,
      ...galleryTargets,
    ],
    ficha_pdf: `/assets/productos/importados/${product.slug}/${product.pdfName}`,
  };
}

function toMockProduct(product, assets) {
  const type = typeBySlug.get(product.tipo_slug);
  if (!type) throw new Error(`Tipo no encontrado: ${product.tipo_slug}`);
  const seoKeywordsEs = buildSeoKeywords(product, 'es');
  const seoKeywordsEn = buildSeoKeywords(product, 'en');
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    familia_id: family.id,
    familia_slug: family.slug,
    tipo_id: type.id,
    nombre_es: product.nombre_es,
    nombre_en: product.nombre_en,
    descripcion_corta_es: product.descripcion_corta_es,
    descripcion_corta_en: product.descripcion_corta_en,
    descripcion_larga_es: enrichDescription(product, 'es'),
    descripcion_larga_en: enrichDescription(product, 'en'),
    especificaciones: product.especificaciones,
    imagen_principal: assets.imagen_principal,
    galeria: assets.galeria,
    ficha_pdf: assets.ficha_pdf,
    tipo_comercial: 'equipo',
    fulfillment_mode: 'cotizacion',
    precio: null,
    moneda: 'COP',
    stock: null,
    disponible: true,
    destacado: product.destacado ?? false,
    nuevo: true,
    activo: true,
    orden: product.orden,
    aplicaciones_es: enrichApplications(product, 'es'),
    aplicaciones_en: enrichApplications(product, 'en'),
    beneficios_es: product.beneficios_es,
    beneficios_en: product.beneficios_en,
    valor_es: product.valor_es,
    valor_en: product.valor_en,
    seo_keywords_es: seoKeywordsEs,
    seo_keywords_en: seoKeywordsEn,
    marca: product.marca,
    proveedor_ref: 'ahuman-future-padbot-robots',
  };
}

function toSupabaseProduct(mockProduct, product) {
  return {
    id: mockProduct.id,
    slug: mockProduct.slug,
    sku: mockProduct.sku,
    familia_id: mockProduct.familia_id,
    tipo_id: mockProduct.tipo_id,
    nombre_es: mockProduct.nombre_es,
    nombre_en: mockProduct.nombre_en,
    descripcion_corta_es: mockProduct.descripcion_corta_es,
    descripcion_corta_en: mockProduct.descripcion_corta_en,
    descripcion_larga_es: mockProduct.descripcion_larga_es,
    descripcion_larga_en: mockProduct.descripcion_larga_en,
    especificaciones: mockProduct.especificaciones,
    aplicaciones_es: mockProduct.aplicaciones_es,
    aplicaciones_en: mockProduct.aplicaciones_en,
    imagen_principal: mockProduct.imagen_principal,
    galeria: mockProduct.galeria,
    ficha_pdf: mockProduct.ficha_pdf,
    atributos: {
      beneficios_es: mockProduct.beneficios_es,
      beneficios_en: mockProduct.beneficios_en,
      valor_es: mockProduct.valor_es,
      valor_en: mockProduct.valor_en,
      seo_keywords_es: mockProduct.seo_keywords_es,
      seo_keywords_en: mockProduct.seo_keywords_en,
      marca: mockProduct.marca,
      origen: mockProduct.proveedor_ref,
      source_pdf: product.pdf,
      tipo_uso_robot: product.tipo_slug,
    },
    dimensiones_cm: {},
    peso_kg: null,
    tipo_comercial: mockProduct.tipo_comercial,
    fulfillment_mode: mockProduct.fulfillment_mode,
    precio: null,
    moneda: mockProduct.moneda,
    stock: null,
    disponible: true,
    destacado: mockProduct.destacado,
    nuevo: true,
    activo: true,
    orden: mockProduct.orden,
  };
}

async function syncSupabase(mockProducts) {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const familyPayload = {
    id: family.id,
    slug: family.slug,
    nombre_es: family.nombre_es,
    nombre_en: family.nombre_en,
    descripcion_es: family.descripcion_es,
    descripcion_en: family.descripcion_en,
    orden: family.orden,
    activo: family.activo,
  };
  const { error: familyError } = await supabase.from('familias').upsert(familyPayload, { onConflict: 'slug' });
  if (familyError) throw familyError;

  const typePayload = types.map(({ familia_slug, ...type }) => type);
  const { error: typeError } = await supabase.from('tipos').upsert(typePayload, { onConflict: 'familia_id,slug' });
  if (typeError) throw typeError;

  const productPayload = mockProducts.map((mockProduct, index) =>
    toSupabaseProduct(mockProduct, products[index])
  );
  const { error: productError } = await supabase.from('productos').upsert(productPayload, { onConflict: 'id' });
  if (productError) throw productError;
}

async function main() {
  const familias = readJson('mock-familias.json');
  const tipos = readJson('mock-tipos.json');
  const productos = readJson('mock-productos.json');

  upsertByKey(familias, family, row => row.slug);
  for (const type of types) {
    upsertByKey(tipos, type, row => `${row.familia_id}:${row.slug}`);
  }

  const mockProducts = [];
  for (const product of products) {
    const assets = await prepareAssets(product);
    const mockProduct = toMockProduct(product, assets);
    upsertByKey(productos, mockProduct, row => row.id);
    mockProducts.push(mockProduct);
  }

  const productosSinDuplicados = dedupeByKey(productos, row => row.id);
  writeJson('mock-familias.json', familias);
  writeJson('mock-tipos.json', tipos);
  writeJson('mock-productos.json', productosSinDuplicados);

  if (SYNC_SUPABASE) {
    await syncSupabase(mockProducts);
  }

  console.log(
    JSON.stringify(
      {
        family: family.slug,
        types: types.length,
        products: mockProducts.length,
        supabase: SYNC_SUPABASE ? 'synced' : 'skipped',
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
