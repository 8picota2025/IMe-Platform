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
    slug: 'actividades-vida-diaria',
    name_es: 'Actividades de la vida diaria',
    name_en: 'Activities of daily living',
    title_es: 'Ayudas para actividades de la vida diaria | I-ME',
    title_en: 'Daily living aids and institutional equipment | I-ME',
    description_es:
      'Ayudas, accesorios y equipos para movilidad cotidiana, higiene y transferencia en instituciones y cuidado asistido.',
    description_en:
      'Aids, accessories and equipment for daily mobility, hygiene and transfer in institutions and assisted care.',
    intro_es:
      'Esta familia reúne ayudas para tareas cotidianas, higiene, transferencia y apoyo funcional. La selección depende del usuario, el entorno y la compatibilidad entre equipo y accesorio.',
    intro_en:
      'This family brings together aids for daily tasks, hygiene, transfer and functional support. Selection depends on user, environment and equipment-accessory compatibility.',
    body_es: [
      'Antes de cotizar conviene documentar espacio, recorrido, tipo de asistencia, frecuencia de uso y limpieza.',
      'Arneses, asientos, baldes, actuadores y repuestos se validan por referencia; piezas parecidas no son automáticamente compatibles.',
    ],
    body_en: [
      'Before quoting, document space, route, assistance type, use frequency and cleaning.',
      'Slings, seats, buckets, actuators and spare parts are validated per model; similar-looking parts are not automatically compatible.',
    ],
    faq: [
      {
        q_es: '¿Cómo confirmo compatibilidad de un accesorio?',
        a_es: 'Con modelo, referencia y ficha del equipo principal. I-ME confirma la correspondencia antes de cotizar.',
        q_en: 'How do I confirm accessory compatibility?',
        a_en: 'Use model, reference and main-equipment documentation. I-ME confirms fit before quoting.',
      },
    ],
    relatedSlugs: [],
  },
  {
    slug: 'diagnostico-clinico-basico',
    name_es: 'Diagnóstico clínico básico',
    name_en: 'Basic clinical diagnostics',
    title_es: 'Equipos de diagnóstico clínico y laboratorio básico | I-ME',
    title_en: 'Basic clinical and laboratory diagnostic equipment | I-ME',
    description_es:
      'Equipos de diagnóstico clínico básico y laboratorio para instituciones: analizadores, medición y referencias documentadas.',
    description_en:
      'Basic clinical and laboratory diagnostic equipment for institutions: analyzers, measurement and documented models.',
    intro_es:
      'El diagnóstico básico reúne tecnologías distintas. Para comparar correctamente hay que separar medición clínica, procesamiento de muestras, capacidad y flujo documental.',
    intro_en:
      'Basic diagnostics includes different technologies. Sound comparison separates clinical measurement, sample processing, capacity and documentation workflow.',
    body_es: [
      'El volumen esperado, tipo de muestra o medición, espacio, consumibles y gestión de resultados definen la tipología.',
      'Cada analizador o equipo se revisa contra documentación oficial, requisitos de instalación y alcance de capacitación y soporte.',
    ],
    body_en: [
      'Expected volume, sample or measurement type, space, consumables and result management define the equipment class.',
      'Each analyzer or device is reviewed against official documentation, installation requirements, training and support scope.',
    ],
    faq: [
      {
        q_es: '¿Qué información necesita una cotización?',
        a_es: 'Tipo de prueba o medición, volumen, infraestructura, consumibles y flujo de resultados.',
        q_en: 'What information is needed for a quote?',
        a_en: 'Test or measurement type, volume, infrastructure, consumables and result workflow.',
      },
    ],
    relatedSlugs: [],
  },
  {
    slug: 'emergencias-traslado-inmovilizacion',
    name_es: 'Emergencias, traslado e inmovilización',
    name_en: 'Emergency, transport and immobilization',
    title_es: 'Camillas médicas y equipos de traslado hospitalario | I-ME',
    title_en: 'Medical stretchers and hospital transport equipment | I-ME',
    description_es:
      'Camillas médicas, de ambulancia, procedimientos, tableros e inmovilización para urgencias e instituciones de salud en Colombia.',
    description_en:
      'Medical stretchers, ambulance stretchers, procedure stretchers, spine boards and immobilization for ER and healthcare institutions in Colombia.',
    intro_es:
      'Traslado e inmovilización se dimensionan por recorrido, vehículo o área, manipulación, almacenamiento y protocolo institucional.',
    intro_en:
      'Transport and immobilization are sized by route, vehicle or area, handling, storage and institutional protocol.',
    body_es: [
      'Camillas de ambulancia, plegables, cuchara, tableros y accesorios responden a escenarios operativos diferentes.',
      'Antes de comprar se revisan dimensiones, carga declarada, plegado, anclaje, limpieza, accesorios y mantenimiento según fabricante.',
    ],
    body_en: [
      'Ambulance, folding and scoop stretchers, spine boards and accessories fit different operating scenarios.',
      'Before purchase, review dimensions, declared load, folding, anchoring, cleaning, accessories and maintenance per manufacturer.',
    ],
    faq: [
      {
        q_es: '¿Una camilla sirve para cualquier ambulancia?',
        a_es: 'No se debe asumir. Hay que validar dimensiones, sistema de anclaje y referencia del vehículo o instalación.',
        q_en: 'Does one stretcher fit every ambulance?',
        a_en: 'Do not assume so. Validate dimensions, anchoring system and vehicle or installation reference.',
      },
      {
        q_es: '¿Qué camilla necesito para urgencias o procedimientos?',
        a_es: 'Camilla de ambulancia, plegable, de procedimientos o cuchara responden a usos distintos. Documente recorrido, manipulación y protocolo antes de cotizar.',
        q_en: 'Which stretcher do I need for ER or procedures?',
        a_en: 'Ambulance, folding, procedure or scoop stretchers fit different uses. Document route, handling and protocol before quoting.',
      },
    ],
    relatedSlugs: [],
  },
  {
    slug: 'esterilizacion-control-infecciones',
    name_es: 'Esterilización y control de infecciones',
    name_en: 'Sterilization and infection control',
    title_es: 'Esterilización y control de infecciones hospitalarias | I-ME',
    title_en: 'Hospital sterilization and infection-control equipment | I-ME',
    description_es:
      'Autoclaves, esterilizadores, desinfección y apoyo para centrales e instituciones de salud.',
    description_en:
      'Autoclaves, sterilizers, disinfection and support equipment for sterile services and healthcare institutions.',
    intro_es:
      'Esta familia combina procesos, equipos y consumibles. La compra debe partir del material a procesar, capacidad, ciclo, infraestructura y trazabilidad requeridos.',
    intro_en:
      'This family combines processes, equipment and consumables. Purchasing starts from processed material, capacity, cycle, infrastructure and traceability needs.',
    body_es: [
      'Autoclaves, esterilizadores y sistemas de desinfección no son intercambiables: cada tecnología tiene alcance y condiciones documentadas.',
      'Se validan agua, energía, ventilación, drenaje, carga, instalación, capacitación y mantenimiento para la referencia seleccionada.',
    ],
    body_en: [
      'Autoclaves, sterilizers and disinfection systems are not interchangeable: each technology has documented scope and conditions.',
      'Water, power, ventilation, drainage, load, installation, training and maintenance are validated for the selected model.',
    ],
    faq: [
      {
        q_es: '¿Cómo se define capacidad?',
        a_es: 'Desde tipos de carga, volumen por jornada y flujo de la central; no solo por litros nominales.',
        q_en: 'How is capacity defined?',
        a_en: 'From load types, daily volume and sterile-services workflow—not nominal liters alone.',
      },
    ],
    relatedSlugs: [],
  },
  {
    slug: 'insumos-accesorios',
    name_es: 'Insumos y accesorios',
    name_en: 'Consumables and accessories',
    title_es: 'Insumos y accesorios para equipos biomédicos | I-ME',
    title_en: 'Biomedical equipment consumables and accessories | I-ME',
    description_es:
      'Circuitos, cables, interfaces, repuestos y accesorios identificados por modelo para equipos biomédicos.',
    description_en:
      'Circuits, cables, interfaces, spare parts and accessories identified by model for biomedical equipment.',
    intro_es:
      'En accesorios, compatibilidad y trazabilidad importan más que la apariencia. Cada pedido debe identificar equipo principal, marca, modelo y referencia.',
    intro_en:
      'For accessories, compatibility and traceability matter more than appearance. Each order should identify main equipment, brand, model and reference.',
    body_es: [
      'El catálogo incluye circuitos, cables, interfaces, mezcladores, arneses y repuestos para distintas líneas.',
      'I-ME confirma presentación, compatibilidad, unidad de empaque y disponibilidad dentro de la propuesta formal.',
    ],
    body_en: [
      'The catalog includes circuits, cables, interfaces, blenders, harnesses and spare parts across different lines.',
      'I-ME confirms presentation, compatibility, pack unit and availability in the formal proposal.',
    ],
    faq: [
      {
        q_es: '¿Puedo comprar por fotografía?',
        a_es: 'No es suficiente. Envíe etiqueta, modelo y referencia del equipo para reducir errores de compatibilidad.',
        q_en: 'Can I purchase from a photo?',
        a_en: 'A photo is not enough. Send label, model and equipment reference to reduce compatibility errors.',
      },
    ],
    relatedSlugs: [],
  },
  {
    slug: 'mobiliario',
    name_es: 'Mobiliario hospitalario e infraestructura clínica',
    name_en: 'Hospital furniture and clinical infrastructure',
    title_es: 'Mobiliario hospitalario e infraestructura clínica | I-ME',
    title_en: 'Hospital furniture and clinical infrastructure | I-ME',
    description_es:
      'Camas, camillas, carros, mesas y mobiliario clínico para hospitalización, UCI y áreas asistenciales.',
    description_en:
      'Beds, stretchers, carts, tables and clinical furniture for wards, ICU and care areas.',
    intro_es:
      'Mobiliario hospitalario se selecciona por servicio, espacio, recorrido, ergonomía, limpieza y carga operativa; no como una lista genérica de muebles.',
    intro_en:
      'Hospital furniture is selected by service, space, route, ergonomics, cleaning and operating load—not as a generic furniture list.',
    body_es: [
      'Camas, camillas, carros y mesas deben compararse dentro de su uso previsto y dimensiones reales del área.',
      'Se revisan funciones, accesorios, materiales declarados, movilidad, mantenimiento y condiciones de entrega por referencia.',
    ],
    body_en: [
      'Beds, stretchers, carts and tables should be compared within intended use and actual area dimensions.',
      'Functions, accessories, declared materials, mobility, maintenance and delivery conditions are reviewed per model.',
    ],
    faq: [
      {
        q_es: '¿Qué medidas debo enviar?',
        a_es: 'Espacio útil, puertas, ascensores, recorridos y restricciones del área, además del uso previsto.',
        q_en: 'Which measurements should I send?',
        a_en: 'Usable space, doors, elevators, routes and area restrictions, plus intended use.',
      },
    ],
    relatedSlugs: [],
  },
  {
    slug: 'movilidad-rehabilitacion',
    name_es: 'Movilidad y rehabilitación',
    name_en: 'Mobility and rehabilitation',
    title_es: 'Caminadores para adultos y sillas Konfort Plus | Movilidad | I-ME',
    title_en: 'Adult walkers & Konfort Plus wheelchairs | Mobility | I-ME',
    description_es:
      'Caminadores para adultos, rollators Konfort Plus, sillas de ruedas estándar y transporte. Orientación y cotización institucional en Colombia.',
    description_en:
      'Adult walkers, Konfort Plus rollators and wheelchairs — standard and transport models. Institutional guidance and quotes in Colombia.',
    intro_es:
      'Movilidad no se resuelve solo con talla. Entorno, postura, transferencia, autonomía, acompañante y mantenimiento determinan la configuración.',
    intro_en:
      'Mobility is not solved by size alone. Environment, posture, transfer, independence, caregiver and maintenance determine configuration.',
    body_es: [
      'La familia incluye sillas, bastones, muletas, ayudas de transferencia y repuestos identificados por modelo.',
      'La selección institucional debe documentar recorrido, almacenamiento, ajuste y compatibilidad; la evaluación individual corresponde al profesional responsable.',
    ],
    body_en: [
      'This family includes wheelchairs, canes, crutches, transfer aids and model-identified spare parts.',
      'Institutional selection should document route, storage, adjustment and compatibility; individual assessment belongs to the responsible professional.',
    ],
    faq: [
      {
        q_es: '¿Cómo elijo una silla o ayuda de marcha?',
        a_es: 'I-ME compara referencias y entorno; la indicación y ajuste individual deben confirmarse por el profesional competente.',
        q_en: 'How do I choose a wheelchair or walking aid?',
        a_en: 'I-ME compares models and environment; individual prescription and fitting must be confirmed by the competent professional.',
      },
      {
        q_es: '¿Tienen caminadores para adultos Konfort Plus?',
        a_es: 'Sí. Hay caminadores y rollators Konfort Plus en catálogo. Para orientación por uso y presupuesto, consulte la guía de caminadores o solicite cotización.',
        q_en: 'Do you carry Konfort Plus adult walkers?',
        a_en: 'Yes. Konfort Plus walkers and rollators are in the catalog. For use-case and budget guidance, see the walkers hub or request a quote.',
      },
      {
        q_es: '¿Venden sillas de ruedas Konfort Plus?',
        a_es: 'Sí. Konfort Plus incluye sillas estándar, transporte y reclinables publicadas en catálogo. Confirmamos variante y disponibilidad al cotizar.',
        q_en: 'Do you sell Konfort Plus wheelchairs?',
        a_en: 'Yes. Konfort Plus standard, transport and reclining wheelchairs are published in the catalog. We confirm variant and availability when quoting.',
      },
    ],
    relatedSlugs: [],
  },
  {
    slug: 'ortopedia-confort',
    name_es: 'Ortopedia y confort',
    name_en: 'Orthopedics and comfort',
    title_es: 'Productos de ortopedia y confort institucional | I-ME',
    title_en: 'Orthopedic and comfort products for institutions | I-ME',
    description_es:
      'Cabestrillos, fajas y productos de soporte y confort identificados por talla y referencia.',
    description_en:
      'Slings, binders and support and comfort products identified by size and reference.',
    intro_es:
      'Talla, referencia y uso indicado por el profesional responsable deben confirmarse antes de seleccionar productos de soporte y confort.',
    intro_en:
      'Size, model and use indicated by the responsible professional should be confirmed before selecting support and comfort products.',
    body_es: [
      'El catálogo separa referencias y tallas para evitar tratar productos visualmente parecidos como equivalentes.',
      'I-ME confirma presentación y disponibilidad comercial; no realiza prescripción ni ajuste clínico.',
    ],
    body_en: [
      'The catalog separates models and sizes so visually similar products are not treated as equivalents.',
      'I-ME confirms commercial presentation and availability; it does not prescribe or perform clinical fitting.',
    ],
    faq: [
      {
        q_es: '¿I-ME recomienda talla o tratamiento?',
        a_es: 'No. La talla y el uso deben venir definidos por el profesional responsable; I-ME confirma la referencia comercial.',
        q_en: 'Does I-ME recommend size or treatment?',
        a_en: 'No. Size and use must be defined by the responsible professional; I-ME confirms the commercial model.',
      },
    ],
    relatedSlugs: [],
  },
  {
    slug: 'terapia-respiratoria-soporte-vital',
    name_es: 'Terapia respiratoria y soporte vital',
    name_en: 'Respiratory therapy and life support',
    title_es: 'Alto flujo Fisher Paykel Airvo y terapia respiratoria | I-ME',
    title_en: 'Fisher Paykel Airvo high flow & respiratory therapy | I-ME',
    description_es:
      'Sistemas de alto flujo Fisher Paykel Airvo, circuitos Optiflow, aspiración e interfaces respiratorias para UCI, neonatología y urgencias.',
    description_en:
      'Fisher Paykel Airvo high-flow systems, Optiflow circuits, suction and respiratory interfaces for ICU, neonatal and emergency care.',
    intro_es:
      'La familia respiratoria combina equipos y accesorios con funciones distintas. Entorno, gases, flujo, población y protocolo institucional definen la selección.',
    intro_en:
      'The respiratory family combines equipment and accessories with different functions. Setting, gases, flow, population and institutional protocol define selection.',
    body_es: [
      'Aspiradores, mezcladores, humidificación e interfaces deben compararse por función y compatibilidad documentada.',
      'Antes de cotizar se validan infraestructura, accesorios, consumibles, limpieza, capacitación y mantenimiento por referencia.',
    ],
    body_en: [
      'Suction units, blenders, humidification and interfaces should be compared by function and documented compatibility.',
      'Before quoting, infrastructure, accessories, consumables, cleaning, training and maintenance are validated per model.',
    ],
    faq: [
      {
        q_es: '¿Todos los accesorios respiratorios son compatibles?',
        a_es: 'No se debe asumir. Modelo, conexión, rango y documentación del fabricante deben coincidir.',
        q_en: 'Are all respiratory accessories compatible?',
        a_en: 'Do not assume so. Model, connection, range and manufacturer documentation must match.',
      },
      {
        q_es: '¿Tienen sistemas de alto flujo Fisher Paykel?',
        a_es: 'Sí. En catálogo hay Airvo y circuitos Optiflow Fisher Paykel. Confirmamos referencia, interfaces y consumibles al cotizar.',
        q_en: 'Do you carry Fisher Paykel high-flow systems?',
        a_en: 'Yes. The catalog includes Airvo and Fisher Paykel Optiflow circuits. We confirm model, interfaces and consumables when quoting.',
      },
    ],
    relatedSlugs: [
      'sistema-de-alto-flujo-ref-airvo-3-fisher-paykel',
      'circuito-para-alto-flujo-optiflow-junior-ref-rt330-fisher-paykel',
      'circuito-desechable-para-canula-de-alto-flujo-adulto-ref-rt202-fisher-paykel',
    ],
  },
  {
    slug: 'robots',
    name_es: 'Robots de servicio y asistencia',
    name_en: 'Service and assistive robots',
    title_es: 'Robots de servicio, recepción y logística institucional | I-ME',
    title_en: 'Service, reception and institutional logistics robots | I-ME',
    description_es:
      'Robots de recepción, telepresencia, delivery, limpieza y asistencia para instituciones. Compare funciones, entorno y soporte con I-ME.',
    description_en:
      'Reception, telepresence, delivery, cleaning and assistive robots for institutions. Compare functions, environment and support with I-ME.',
    intro_es:
      'Un robot institucional se selecciona desde el proceso que debe resolver: orientar visitantes, conectar personas a distancia, transportar elementos, apoyar actividades o automatizar limpieza.',
    intro_en:
      'An institutional robot should be selected from the workflow it must support: visitor wayfinding, remote presence, internal delivery, activities or cleaning automation.',
    body_es: [
      'El catálogo reúne ocho referencias oficiales para recepción, servicio interactivo, telepresencia, delivery institucional y de alimentos, educación social y limpieza autónoma.',
      'La comparación debe empezar por el entorno real: recorridos, puertas, ascensores, superficies, puntos de carga, conectividad y responsables de operación. Después se valida cada función contra la ficha del fabricante.',
      'I-ME estructura el alcance comercial y técnico por proyecto. La autonomía, integración, accesorios y puesta en marcha se confirman para la referencia cotizada.',
    ],
    body_en: [
      'The catalog includes eight official models for reception, interactive service, telepresence, institutional and food delivery, social education and autonomous cleaning.',
      'Comparison starts with the real environment: routes, doors, elevators, surfaces, charging points, connectivity and operating owners. Each function is then validated against manufacturer documentation.',
      'I-ME structures commercial and technical scope by project. Runtime, integration, accessories and commissioning are confirmed for the quoted model.',
    ],
    faq: [
      {
        q_es: '¿Qué tipo de robot necesita una institución?',
        a_es: 'Depende del flujo objetivo. Recepción, telepresencia, delivery y limpieza son categorías distintas; primero documentamos recorrido, interacción y responsable operativo.',
        q_en: 'What type of robot does an institution need?',
        a_en: 'It depends on the target workflow. Reception, telepresence, delivery and cleaning are different categories; first document route, interaction and operating owner.',
      },
      {
        q_es: '¿Puede integrarse con ascensores o sistemas existentes?',
        a_es: 'La integración depende del modelo y de la infraestructura. Se confirma con documentación del fabricante y revisión técnica del proyecto.',
        q_en: 'Can it integrate with elevators or existing systems?',
        a_en: 'Integration depends on model and infrastructure. It is confirmed through manufacturer documentation and project technical review.',
      },
    ],
    relatedSlugs: [
      'padbot-x3-robot-recepcion',
      'padbot-x2-robot-servicio-interactivo',
      'padbot-p2-robot-telepresencia',
      'padbot-w2-robot-delivery-institucional',
      'padbot-w3s-robot-delivery-alimentos',
      'padbot-t2-robot-educativo-social',
      'c3-robot-limpieza-autonoma',
      'cruzr-robot-comercial-inteligente-ahuman-future',
    ],
  },
  {
    slug: 'radiologia',
    name_es: 'Imagenología y radiología',
    name_en: 'Medical imaging and radiology',
    title_es: 'Mamografía digital y equipos de imagenología hospitalaria | I-ME',
    title_en: 'Digital mammography & hospital imaging equipment | I-ME',
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
    title_es: 'Monitores Biolight P15/S12 y multiparamétricos UCI | I-ME',
    title_en: 'Biolight P15/S12 & ICU multiparameter monitors | I-ME',
    description_es:
      'Monitores de paciente Biolight P15, S12 y multiparamétricos UCI para hospitales. Orientación I-ME: parámetros, modularidad y soporte en Colombia.',
    description_en:
      'Biolight P15, S12 and ICU multiparameter patient monitors for hospitals. I-ME guidance on parameters, modularity and support in Colombia.',
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
      {
        q_es: '¿Tienen monitores Biolight P15 o S12?',
        a_es: 'Sí. P15 modular y S12 están en catálogo activo. Confirmamos configuración, central y disponibilidad al cotizar.',
        q_en: 'Do you carry Biolight P15 or S12 monitors?',
        a_en: 'Yes. Modular P15 and S12 are in the active catalog. We confirm configuration, central station and availability when quoting.',
      },
    ],
    relatedSlugs: [
      'monitor-de-paciente-modular-serie-p-ref-p15-biolight',
      'monitor-de-paciente-s12-biolight',
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

/** Guías de decisión institucional. No son indicaciones clínicas ni fichas de producto. */
export interface FamiliaGuide {
  criteria_es: string[];
  criteria_en: string[];
}

const GUIAS_FAMILIA: Record<string, FamiliaGuide> = {
  'actividades-vida-diaria': {
    criteria_es: [
      'Identificar actividad, entorno, medidas del usuario y nivel de asistencia requerido.',
      'Validar dimensiones, ajustes, materiales, limpieza y capacidad de carga por referencia.',
      'Probar ergonomía y seguridad con el equipo asistencial antes de estandarizar.',
    ],
    criteria_en: [
      'Identify activity, environment, user measurements and required assistance level.',
      'Validate dimensions, adjustments, materials, cleaning and load capacity per SKU.',
      'Test ergonomics and safety with the care team before standardizing.',
    ],
  },
  'diagnostico-clinico-basico': {
    criteria_es: [
      'Definir parámetros, población, frecuencia de uso y necesidad de portabilidad.',
      'Comparar rango, resolución, accesorios, limpieza y requisitos de calibración documentados.',
      'Planear recepción, capacitación, control metrológico y reposición de accesorios.',
    ],
    criteria_en: [
      'Define parameters, population, use frequency and portability needs.',
      'Compare documented range, resolution, accessories, cleaning and calibration requirements.',
      'Plan acceptance, training, metrology control and accessory replacement.',
    ],
  },
  'emergencias-traslado-inmovilizacion': {
    criteria_es: [
      'Mapear escenarios de rescate, rutas, vehículos, espacios y número de operadores.',
      'Validar dimensiones, carga, plegado, sujeción, limpieza y accesorios compatibles.',
      'Incluir inspección periódica, entrenamiento y disponibilidad de repuestos en el protocolo.',
    ],
    criteria_en: [
      'Map rescue scenarios, routes, vehicles, spaces and number of operators.',
      'Validate dimensions, load, folding, restraints, cleaning and compatible accessories.',
      'Include periodic inspection, training and spare-part availability in protocol.',
    ],
  },
  'esterilizacion-control-infecciones': {
    criteria_es: [
      'Definir carga, materiales, ciclos, capacidad diaria y flujo limpio-sucio institucional.',
      'Confirmar utilidades, instalación, monitoreo, trazabilidad y consumibles por referencia.',
      'Acordar calificación, capacitación, mantenimiento y controles de proceso aplicables.',
    ],
    criteria_en: [
      'Define load, materials, cycles, daily capacity and institutional clean-dirty flow.',
      'Confirm utilities, installation, monitoring, traceability and consumables per SKU.',
      'Agree on qualification, training, maintenance and applicable process controls.',
    ],
  },
  'insumos-accesorios': {
    criteria_es: [
      'Vincular cada insumo o accesorio con equipo, referencia y uso institucional previsto.',
      'Verificar compatibilidad, presentación, almacenamiento, vida útil y documentación oficial.',
      'Definir consumo, inventario de seguridad, rotación y trazabilidad antes de comprar.',
    ],
    criteria_en: [
      'Link every supply or accessory to equipment, SKU and intended institutional use.',
      'Verify compatibility, packaging, storage, shelf life and official documentation.',
      'Define consumption, safety stock, rotation and traceability before purchasing.',
    ],
  },
  mobiliario: {
    criteria_es: [
      'Levantar espacio, circulación, usuarios, carga y flujo de limpieza de cada área.',
      'Comparar dimensiones, materiales, ajustes, ruedas, frenos y accesorios por referencia.',
      'Revisar montaje, recepción, repuestos y mantenimiento para el ciclo de vida esperado.',
    ],
    criteria_en: [
      'Survey space, circulation, users, load and cleaning flow in each area.',
      'Compare dimensions, materials, adjustments, casters, brakes and accessories per SKU.',
      'Review assembly, acceptance, spare parts and maintenance for expected lifecycle.',
    ],
  },
  'movilidad-rehabilitacion': {
    criteria_es: [
      'Definir objetivo funcional, entorno, medidas del usuario y nivel de apoyo profesional.',
      'Validar ajuste, estabilidad, capacidad, maniobrabilidad y accesorios según referencia.',
      'Incluir prueba, capacitación, seguimiento y mantenimiento en el proceso de entrega.',
    ],
    criteria_en: [
      'Define functional goal, environment, user measurements and professional support level.',
      'Validate adjustment, stability, capacity, maneuverability and accessories per SKU.',
      'Include trial, training, follow-up and maintenance in delivery process.',
    ],
  },
  'ortopedia-confort': {
    criteria_es: [
      'Precisar zona corporal, medidas, entorno de uso y objetivo definido por el profesional tratante.',
      'Comparar talla, ajuste, materiales, cuidado y contraindicaciones documentadas por fabricante.',
      'Verificar adaptación, instrucciones de uso y criterios institucionales de seguimiento.',
    ],
    criteria_en: [
      'Specify body area, measurements, use environment and treating professional’s goal.',
      'Compare size, fit, materials, care and manufacturer-documented contraindications.',
      'Verify fitting, use instructions and institutional follow-up criteria.',
    ],
  },
  'terapia-respiratoria-soporte-vital': {
    criteria_es: [
      'Separar oxigenoterapia, aerosolterapia, aspiración y soporte respiratorio por flujo clínico.',
      'Confirmar fuente, interfaces, consumibles, alarmas, limpieza y compatibilidad por referencia.',
      'Coordinar capacitación, recepción técnica, mantenimiento y contingencia con biomédica.',
    ],
    criteria_en: [
      'Separate oxygen, aerosol, suction and respiratory-support workflows.',
      'Confirm source, interfaces, consumables, alarms, cleaning and compatibility per SKU.',
      'Coordinate training, technical acceptance, maintenance and contingency with biomed.',
    ],
  },
  robots: {
    criteria_es: [
      'Definir tarea, recorrido, usuarios y responsable operativo antes de comparar modelos.',
      'Levantar puertas, ascensores, pendientes, superficies, red y puntos de carga del entorno real.',
      'Validar navegación, integración, autonomía, accesorios, soporte y puesta en marcha por referencia.',
    ],
    criteria_en: [
      'Define task, route, users and operating owner before comparing models.',
      'Survey doors, elevators, slopes, surfaces, network and charging points in the real environment.',
      'Validate navigation, integration, runtime, accessories, support and commissioning per model.',
    ],
  },
  radiologia: {
    criteria_es: [
      'Definir estudios, volumen esperado y continuidad requerida antes de comparar modalidades.',
      'Validar sala, energía, blindaje, conectividad e integración con el flujo de imágenes.',
      'Solicitar por referencia el alcance de instalación, aceptación, capacitación y mantenimiento.',
    ],
    criteria_en: [
      'Define studies, expected volume and required continuity before comparing modalities.',
      'Validate room, power, shielding, connectivity and image-workflow integration.',
      'Request installation, acceptance, training and maintenance scope per SKU.',
    ],
  },
  monitores: {
    criteria_es: [
      'Separar observación, transporte, urgencias y UCI: no tienen el mismo flujo ni criticidad.',
      'Acordar parámetros, alarmas, accesorios, centralización e interoperabilidad que realmente usará el servicio.',
      'Planear capacitación, pruebas de aceptación y mantenimiento con ingeniería biomédica.',
    ],
    criteria_en: [
      'Separate observation, transport, ER and ICU: they do not share the same workflow or criticality.',
      'Agree on parameters, alarms, accessories, centralization and interoperability the service will actually use.',
      'Plan training, acceptance testing and maintenance with biomedical engineering.',
    ],
  },
  'cardiologia-reanimacion': {
    criteria_es: [
      'Definir ubicación, responsable operativo y protocolo institucional aplicable.',
      'Diferenciar equipos de diagnóstico, monitoreo y reanimación para comparar propuestas equivalentes.',
      'Revisar accesorios, consumibles, capacitación, mantenimiento y trazabilidad documental por referencia.',
    ],
    criteria_en: [
      'Define location, operating owner and applicable institutional protocol.',
      'Separate diagnostic, monitoring and resuscitation equipment to compare equivalent proposals.',
      'Review accessories, consumables, training, maintenance and documentation traceability per SKU.',
    ],
  },
  cardiologia: {
    criteria_es: [
      'Partir del flujo de atención, volumen y necesidad de registro o archivo de datos.',
      'Confirmar compatibilidad operativa con los procesos y sistemas existentes de la institución.',
      'Comparar alcance de capacitación, accesorios, mantenimiento y documentación por referencia.',
    ],
    criteria_en: [
      'Start from care workflow, volume and record or data-archive needs.',
      'Confirm operational compatibility with the institution’s existing processes and systems.',
      'Compare training, accessories, maintenance and documentation scope per SKU.',
    ],
  },
  'sala-cirugia': {
    criteria_es: [
      'Mapear especialidades, turnos, ergonomía y circulación del quirófano antes de armar el paquete.',
      'Validar dimensiones, cargas, utilidades y compatibilidad entre mesa, iluminación y accesorios.',
      'Acordar instalación, recepción técnica, capacitación y plan de mantenimiento desde la cotización.',
    ],
    criteria_en: [
      'Map specialties, shifts, ergonomics and OR circulation before assembling a package.',
      'Validate dimensions, loads, utilities and compatibility among table, lighting and accessories.',
      'Agree on installation, technical acceptance, training and maintenance plan in the quotation.',
    ],
  },
  neonatologia: {
    criteria_es: [
      'Definir nivel de cuidado, capacidad instalada y flujo entre áreas antes de seleccionar tipologías.',
      'Revisar espacio, alimentación eléctrica, accesorios, consumibles y limpieza según ficha del fabricante.',
      'Coordinar capacitación, recepción técnica y mantenimiento con pediatría y biomédica.',
    ],
    criteria_en: [
      'Define level of care, installed capacity and flow between areas before selecting typologies.',
      'Review space, power, accessories, consumables and cleaning according to manufacturer documentation.',
      'Coordinate training, technical acceptance and maintenance with pediatrics and biomed.',
    ],
  },
  anestesia: {
    criteria_es: [
      'Dimensionar por quirófanos activos, especialidades, utilidades y plan de continuidad operativa.',
      'Separar requerimientos de anestesia de los de ventilación crítica para no mezclar alcances.',
      'Validar instalación, pruebas de aceptación, accesorios y mantenimiento por referencia.',
    ],
    criteria_en: [
      'Size by active operating rooms, specialties, utilities and continuity plan.',
      'Separate anesthesia requirements from critical ventilation requirements to avoid mixing scopes.',
      'Validate installation, acceptance tests, accessories and maintenance per SKU.',
    ],
  },
  ventiladores: {
    criteria_es: [
      'Definir entorno de uso, población atendida y flujo de traslado con el equipo clínico y biomédico.',
      'Confirmar infraestructura, accesorios, consumibles, alarmas y conectividad según referencia.',
      'Establecer capacitación, pruebas de recepción, mantenimiento y soporte antes de la compra.',
    ],
    criteria_en: [
      'Define use setting, population served and transport workflow with clinical and biomed teams.',
      'Confirm infrastructure, accessories, consumables, alarms and connectivity per SKU.',
      'Set training, receiving tests, maintenance and support before purchase.',
    ],
  },
  ultrasonido: {
    criteria_es: [
      'Partir de aplicaciones autorizadas, volumen, portabilidad y flujo de archivo que requiere el servicio.',
      'Comparar transductores, conectividad, espacio y accesorios únicamente contra fichas oficiales.',
      'Acordar capacitación, aceptación técnica y mantenimiento por referencia.',
    ],
    criteria_en: [
      'Start from authorized applications, volume, portability and archive workflow required by the service.',
      'Compare transducers, connectivity, space and accessories only against official datasheets.',
      'Agree on training, technical acceptance and maintenance per SKU.',
    ],
  },
  'soluciones-iv': {
    criteria_es: [
      'Mapear terapias, camas y flujo de programación con enfermería y biomédica.',
      'Revisar compatibilidad de accesorios y consumibles por referencia, sin asumir equivalencias.',
      'Incluir capacitación, mantenimiento y trazabilidad de activos en el plan de compra.',
    ],
    criteria_en: [
      'Map therapies, beds and programming workflow with nursing and biomed.',
      'Review accessory and consumable compatibility per SKU; do not assume equivalence.',
      'Include training, maintenance and asset traceability in the purchase plan.',
    ],
  },
  'terapia-de-infusion': {
    criteria_es: [
      'Definir terapias concurrentes, servicios y estandarización deseada antes de seleccionar equipos.',
      'Validar consumibles compatibles, disponibilidad operativa, capacitación y mantenimiento por referencia.',
      'Documentar recepción, inventario y plan de soporte desde el inicio.',
    ],
    criteria_en: [
      'Define concurrent therapies, services and desired standardization before selecting equipment.',
      'Validate compatible consumables, operational availability, training and maintenance per SKU.',
      'Document acceptance, inventory and support plan from the start.',
    ],
  },
};

export function getFamiliaGuide(slug: string, locale: Locale): string[] {
  const guide = GUIAS_FAMILIA[slug];
  if (guide) return locale === 'en' ? guide.criteria_en : guide.criteria_es;
  return locale === 'en'
    ? [
        'Define the institutional need and operating environment.',
        'Validate manufacturer documentation and applicable requirements per SKU.',
        'Agree on acceptance, training, maintenance and support before purchase.',
      ]
    : [
        'Definir necesidad institucional y entorno de operación.',
        'Validar documentación del fabricante y requisitos aplicables por referencia.',
        'Acordar aceptación, capacitación, mantenimiento y soporte antes de comprar.',
      ];
}

/** GSC-driven quick links on family hub pages (high-click PDPs / campaign landings). */
export interface FamiliaHubLink {
  href_es: string;
  href_en: string;
  label_es: string;
  label_en: string;
}

const FAMILIA_HUB_LINKS: Record<string, FamiliaHubLink[]> = {
  'movilidad-rehabilitacion': [
    {
      href_es: '/es/caminadores-para-adultos/',
      href_en: '/en/adult-walkers/',
      label_es: 'Guía de caminadores para adultos',
      label_en: 'Adult walkers guide',
    },
    {
      href_es: '/es/conocimiento/caminadores-para-adultos-guia-compra-colombia/',
      href_en: '/en/knowledge/caminadores-para-adultos-guia-compra-colombia/',
      label_es: 'Artículo: cómo elegir caminador',
      label_en: 'Article: how to choose a walker',
    },
    {
      href_es: '/es/sillas-de-ruedas/',
      href_en: '/en/wheelchairs/',
      label_es: 'Guía Konfort Plus sillas',
      label_en: 'Konfort Plus wheelchairs guide',
    },
  ],
  monitores: [
    {
      href_es: '/es/monitores-biolight-uci/',
      href_en: '/en/biolight-icu-monitors/',
      label_es: 'Guía monitores Biolight UCI',
      label_en: 'Biolight ICU monitors guide',
    },
    {
      href_es: '/es/productos/monitor-de-paciente-modular-serie-p-ref-p15-biolight/',
      href_en: '/en/products/monitor-de-paciente-modular-serie-p-ref-p15-biolight/',
      label_es: 'Monitor Biolight P15',
      label_en: 'Biolight P15 monitor',
    },
  ],
  radiologia: [
    {
      href_es: '/es/imagenologia/',
      href_en: '/en/imaging/',
      label_es: 'Proyecto de imagenología',
      label_en: 'Imaging project guide',
    },
  ],
  'terapia-respiratoria-soporte-vital': [
    {
      href_es: '/es/alto-flujo-fisher-paykel/',
      href_en: '/en/fisher-paykel-high-flow/',
      label_es: 'Guía alto flujo Fisher Paykel Airvo',
      label_en: 'Fisher Paykel Airvo high-flow guide',
    },
    {
      href_es: '/es/productos/sistema-de-alto-flujo-ref-airvo-3-fisher-paykel/',
      href_en: '/en/products/sistema-de-alto-flujo-ref-airvo-3-fisher-paykel/',
      label_es: 'Alto flujo Fisher Paykel Airvo 3',
      label_en: 'Fisher Paykel Airvo 3 high flow',
    },
    {
      href_es: '/es/productos/circuito-para-alto-flujo-optiflow-junior-ref-rt330-fisher-paykel/',
      href_en: '/en/products/circuito-para-alto-flujo-optiflow-junior-ref-rt330-fisher-paykel/',
      label_es: 'Circuitos Optiflow Fisher Paykel',
      label_en: 'Fisher Paykel Optiflow circuits',
    },
  ],
  'emergencias-traslado-inmovilizacion': [
    {
      href_es: '/es/camillas-medicas/',
      href_en: '/en/medical-stretchers/',
      label_es: 'Guía camillas médicas y traslado',
      label_en: 'Medical stretchers & transport guide',
    },
  ],
};

export function getFamiliaHubLinks(
  slug: string,
  locale: Locale
): Array<{ href: string; label: string }> {
  const links = FAMILIA_HUB_LINKS[slug];
  if (!links?.length) return [];
  return links.map(link => ({
    href: locale === 'en' ? link.href_en : link.href_es,
    label: locale === 'en' ? link.label_en : link.label_es,
  }));
}
