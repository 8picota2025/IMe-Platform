/**
 * Subpáginas de modalidad. Los slugs son los canónicos del catálogo
 * (las URLs cortas dr-mobile, dr-uc-arm y arco-en-c-alc-280-series redirigen).
 * Sin precios, INVIMA, UNSPSC ni capacidades que no estén en la ficha.
 */
export interface GrupoModalidad {
  titulo_es: string;
  titulo_en: string;
  slugs: string[];
}

export interface PaginaModalidad {
  slug: string;
  title_es: string;
  title_en: string;
  description_es: string;
  description_en: string;
  h1_es: string;
  h1_en: string;
  intro_es: string;
  intro_en: string;
  body_es: string[];
  body_en: string[];
  grupos: GrupoModalidad[];
  /** Tabla solo con capacidades que la ficha ya publica. */
  tablaCapacidad?: boolean;
  todo_es?: string;
  todo_en?: string;
}

const DR_FIJO: GrupoModalidad = {
  titulo_es: 'Rayos X digital DR fijos y de sala',
  titulo_en: 'Fixed and room digital DR X-ray',
  slugs: [
    'sistema-de-rayos-x-dr-montado-en-techo-ref-dr-ceiling-angell',
    'sistema-de-rayos-x-dr-montado-en-suelo-ref-dr-floor-angell',
    'rx-techo-dinamico-qomo',
    'rx-techo-dinamico-changfeng',
    'rx-piso-mtp',
    'sistema-dr-de-mesa-telecomandada-ref-dr-telecomand-angell',
    'dr-dinamico-ref-dtp573-angell',
    'telemando-digital-rf-ref-talent-ii-angell',
  ],
};

const DR_BRAZO: GrupoModalidad = {
  titulo_es: 'DR de brazo UC',
  titulo_en: 'UC-arm DR',
  slugs: ['dr-dinamico-de-brazo-ref-dr-uc-arm-angell', 'rx-multifuncional-uc-arm-ref-dtp580'],
};

const DR_MOVIL: GrupoModalidad = {
  titulo_es: 'Rayos X digital DR móviles',
  titulo_en: 'Mobile digital DR X-ray',
  slugs: ['sistema-de-rayos-x-dr-movil-ref-dr-mobile-angell', 'rx-movil-dinamico-lingxi'],
};

export const MODALIDADES_IMAGEN: PaginaModalidad[] = [
  {
    slug: 'rayos-x-digital',
    title_es: 'Rayos X digital DR fijos y móviles en Colombia | I-ME',
    title_en: 'Fixed and mobile digital DR X-ray in Colombia | I-ME',
    description_es:
      'Rayos X digital DR fijos, de sala y móviles del catálogo I-ME en Colombia. Compare referencias y solicite cotización; el precio no está publicado aquí.',
    description_en:
      'Fixed, room and mobile digital DR X-ray systems from the I-ME catalog in Colombia. Compare references and request a quote; no list price is published here.',
    h1_es: 'Rayos X digital DR: equipos fijos y móviles',
    h1_en: 'Digital DR X-ray: fixed and mobile systems',
    intro_es:
      'Esta página reúne los sistemas de rayos X digital DR que ya están en el catálogo, separados en equipos de sala y equipos móviles. El precio, la instalación y la documentación regulatoria se confirman por referencia.',
    intro_en:
      'This page lists the digital DR X-ray systems already in the catalog, split between room systems and mobile systems. Price, installation and regulatory documentation are confirmed per reference.',
    body_es: [
      'Los enlaces van a la URL canónica de cada ficha. dr-mobile y dr-uc-arm son alias que redirigen a esas fichas.',
    ],
    body_en: [
      'Links go to each product’s canonical URL. dr-mobile and dr-uc-arm are aliases that redirect to those pages.',
    ],
    grupos: [DR_FIJO, DR_BRAZO, DR_MOVIL],
  },
  {
    slug: 'arco-en-c',
    title_es: 'Arco en C para quirófano en Colombia | I-ME',
    title_en: 'C-arm systems for the operating room in Colombia | I-ME',
    description_es:
      'Arcos en C del catálogo I-ME: ALC-280 Series y HUA II. Son dos referencias distintas. Cotice la que corresponda al servicio; no hay precio publicado.',
    description_en:
      'C-arms in the I-ME catalog: ALC-280 Series and HUA II. They are two different references. Quote the one that fits the service; no price is published.',
    h1_es: 'Arco en C: ALC-280 Series y HUA II',
    h1_en: 'C-arm: ALC-280 Series and HUA II',
    intro_es:
      'El catálogo publica dos arcos en C con nombre, imagen y texto distintos. No son la misma ficha ni un duplicado de URL.',
    intro_en:
      'The catalog publishes two C-arms with different names, images and text. They are not the same product page.',
    body_es: [
      'La URL canónica del ALC-280 es /es/productos/arco-en-c-alc-280-series-ref-alc-280-angell/. arco-en-c-alc-280-series redirige ahí.',
      'HUA II vive en /es/productos/arco-c-movil-dinamico-hua-ii/. No comparte slug, imagen ni descripción con el ALC-280.',
    ],
    body_en: [
      'The ALC-280 canonical URL is /en/products/arco-en-c-alc-280-series-ref-alc-280-angell/. arco-en-c-alc-280-series redirects there.',
      'HUA II lives at /en/products/arco-c-movil-dinamico-hua-ii/. It does not share slug, image or description with the ALC-280.',
    ],
    grupos: [
      {
        titulo_es: 'Referencias de arco en C',
        titulo_en: 'C-arm references',
        slugs: ['arco-en-c-alc-280-series-ref-alc-280-angell', 'arco-c-movil-dinamico-hua-ii'],
      },
    ],
  },
  {
    slug: 'mamografia-digital',
    title_es: 'Mamografía digital para clínicas en Colombia | I-ME',
    title_en: 'Digital mammography for clinics in Colombia | I-ME',
    description_es:
      'Mamografía digital del catálogo I-ME: DM156, DM166 y Fanghua. Abra cada ficha y cotice la referencia; no publicamos un precio único de mamógrafo.',
    description_en:
      'Digital mammography in the I-ME catalog: DM156, DM166 and Fanghua. Open each sheet and quote the reference; there is no single mammography price.',
    h1_es: 'Mamografía digital en el catálogo I-ME',
    h1_en: 'Digital mammography in the I-ME catalog',
    intro_es:
      'Tres sistemas de mamografía digital están activos en el catálogo. Las opciones de cada uno (tomosíntesis, detector u otras) están solo en su ficha, no se copian de un modelo a otro.',
    intro_en:
      'Three digital mammography systems are active in the catalog. Options on each one stay on its own page and are not copied from another model.',
    body_es: [],
    body_en: [],
    grupos: [
      {
        titulo_es: 'Sistemas publicados',
        titulo_en: 'Published systems',
        slugs: [
          'mamografo-digital-dm166-series-ref-dm166-angell',
          'mamografo-digital-dm156-series-angell-technology-ref-dm156-angell',
          'mamografo-digital-fanghua',
        ],
      },
    ],
  },
];

export const MODALIDADES_ESTERILIZACION: PaginaModalidad[] = [
  {
    slug: 'autoclaves-hospitalarios',
    title_es: 'Autoclaves hospitalarios: capacidades publicadas | I-ME',
    title_en: 'Hospital autoclaves: published capacities | I-ME',
    description_es:
      'Autoclaves hospitalarios del catálogo I-ME. La tabla de capacidad solo muestra litros o STU que ya están en la ficha. El resto se cotiza sin cifra inventada.',
    description_en:
      'Hospital autoclaves in the I-ME catalog. The capacity table shows only liters or STU already on the product sheet. Anything else is quoted without an invented figure.',
    h1_es: 'Autoclaves hospitalarios del catálogo',
    h1_en: 'Hospital autoclaves in the catalog',
    intro_es:
      'Hay tres esterilizadores de vapor activos. Solo entran a la tabla las capacidades escritas en la ficha.',
    intro_en:
      'Three steam sterilizers are active. Only capacities written on the sheet go into the table.',
    body_es: [
      'Si una referencia no tiene volumen de cámara en su ficha, aparece en la lista y no en la tabla.',
    ],
    body_en: [
      'If a reference has no chamber volume on its sheet, it stays in the list and out of the table.',
    ],
    tablaCapacidad: true,
    grupos: [
      {
        titulo_es: 'Esterilizadores de vapor publicados',
        titulo_en: 'Published steam sterilizers',
        slugs: [
          'autoclave-horizontal-ref-5075-tuttnauer',
          'autoclave-ref-t-max-6-tuttnauer',
          'esterilizador-de-vapor-ref-sdl-d0313-saikang',
        ],
      },
    ],
  },
  {
    slug: 'plasma-peroxido',
    title_es: 'Esterilización por plasma o peróxido | I-ME',
    title_en: 'Plasma or peroxide sterilization | I-ME',
    description_es:
      'I-ME no publica hoy un esterilizador por plasma ni por peróxido de hidrógeno en el catálogo activo. Esta página no inventa modelo, capacidad ni registro.',
    description_en:
      'I-ME does not currently publish a plasma or hydrogen-peroxide sterilizer in the active catalog. This page does not invent a model, capacity or registration.',
    h1_es: 'Esterilización por plasma o peróxido de hidrógeno',
    h1_en: 'Plasma or hydrogen-peroxide sterilization',
    intro_es:
      'No hay una referencia activa de esterilización por plasma o por peróxido en el catálogo público. Mientras no exista, la vía es cotizar la central con los autoclaves publicados.',
    intro_en:
      'There is no active plasma or peroxide sterilization reference in the public catalog. Until there is one, the path is to quote the sterile service with the published autoclaves.',
    body_es: [],
    body_en: [],
    grupos: [],
    todo_es:
      'TODO_CLIENTE: confirmar con Shoky si hay un esterilizador por plasma o por peróxido para publicar (modelo, ficha, capacidad e INVIMA). El catálogo activo no trae esa referencia. El Automate Saniswiss aHPv1115v está inactivo y no se lista aquí.',
    todo_en:
      'TODO_CLIENTE: confirm with Shoky whether a plasma or peroxide sterilizer should be published (model, datasheet, capacity and INVIMA). The active catalog has no such reference. Automate Saniswiss aHPv1115v is inactive and is not listed here.',
  },
  {
    slug: 'lavadoras-termodesinfectoras',
    title_es: 'Lavadoras termodesinfectoras hospitalarias | I-ME',
    title_en: 'Hospital washer-disinfectors | I-ME',
    description_es:
      'El catálogo activo no trae una lavadora termodesinfectadora. El único equipo de lavado publicado es el carrito SKH041, que no es una termodesinfectadora.',
    description_en:
      'The active catalog has no washer-disinfector. The only published washing item is cart SKH041, which is not a washer-disinfector.',
    h1_es: 'Lavadoras termodesinfectoras: qué hay en el catálogo',
    h1_en: 'Washer-disinfectors: what the catalog has',
    intro_es:
      'No publicamos capacidad, ciclos ni registro de una termodesinfectadora porque esa referencia no está en el catálogo activo.',
    intro_en:
      'We do not publish capacity, cycles or a registration for a washer-disinfector because that reference is not in the active catalog.',
    body_es: [
      'El Carrito de Lavado SKH041 es un carro clínico del catálogo. Se enlaza para no confundirlo con una lavadora termodesinfectadora.',
    ],
    body_en: [
      'Washing Cart SKH041 is a clinical cart in the catalog. It is linked so it is not mistaken for a washer-disinfector.',
    ],
    grupos: [
      {
        titulo_es: 'Equipo de lavado publicado (no es termodesinfectadora)',
        titulo_en: 'Published washing item (not a washer-disinfector)',
        slugs: ['carrito-de-lavado-ref-skh041-saikang'],
      },
    ],
    todo_es:
      'TODO_CLIENTE: si I-ME va a ofrecer lavadoras termodesinfectoras, Shoky debe entregar modelo, capacidad y ficha. Hoy no hay esa referencia activa.',
    todo_en:
      'TODO_CLIENTE: if I-ME will offer washer-disinfectors, Shoky needs to provide model, capacity and datasheet. There is no active reference today.',
  },
];

export const ULTRASONIDO_SLUGS = [
  'sistema-de-ultrasonido-ref-dus-3000-advanced',
  'sistema-de-ultrasonido-ref-dus-5000-advanced',
  'sistema-de-ultrasonido-ref-dus-5000-plus-advanced',
  'sistema-de-ultrasonido-versatil-ref-dus-6000-advanced',
  'sistema-de-ultrasonido-ref-dus-7000-advanced',
  'ecografo-color-doppler-diagnostico-vascular',
  'ecografo-portatil-con-wifi-y-dicom',
  'ultrasonido-point-of-care-pocket',
];

export const TELEPRESENCIA_SLUG = 'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot';

export function slugsDeModalidad(pagina: PaginaModalidad): string[] {
  return pagina.grupos.flatMap(grupo => grupo.slugs);
}

export function getModalidad(lista: PaginaModalidad[], slug: string): PaginaModalidad | undefined {
  return lista.find(pagina => pagina.slug === slug);
}
