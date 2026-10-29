/**
 * Catálogo Shenzhen Zuowei (9 modelos), brief 2026-10-28.
 * Fuente única: brief_zuowei_catalogo_2026-10-28.md. Sin precio, sin INVIMA,
 * sin 110 V salvo el cargador confirmado del ZW365D-2, y sin las cifras en duda
 * (carga del ZW518, ficha ZW186-2, carga y autonomía del ZW502).
 */
import type { Locale } from '../i18n/utils';

const PHONE = '+57 313 724 7353';
const FABRICANTE = 'Shenzhen Zuowei Technology';
const MARCA = 'Zuowei';

export const ZUOWEI_GARANTIA = {
  es: `Garantía del fabricante (${FABRICANTE}). El plazo se confirma por escrito.`,
  en: `Manufacturer warranty (${FABRICANTE}). The term is confirmed in writing.`,
} as const;

const FAMILIA = {
  robots: 'd026ac8a-6d63-4fb7-8953-a7aa7a32e627',
  movilidad: '01a7591f-3603-4342-a698-d626fb8756e9',
  avd: 'de5498d0-4a86-43d8-a7a8-34cdf21e76ab',
} as const;

export const ZUOWEI_TIPOS = [
  {
    id: 'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b01',
    familia_id: FAMILIA.robots,
    familia_slug: 'robots',
    slug: 'exoesqueletos',
    nombre_es: 'Exoesqueletos',
    nombre_en: 'Exoskeletons',
    orden: 70,
  },
  {
    id: 'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b02',
    familia_id: FAMILIA.robots,
    familia_slug: 'robots',
    slug: 'bipedestacion-y-marcha',
    nombre_es: 'Bipedestación y marcha',
    nombre_en: 'Standing and gait',
    orden: 80,
  },
  {
    id: 'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b03',
    familia_id: FAMILIA.movilidad,
    familia_slug: 'movilidad-rehabilitacion',
    slug: 'sillas-de-transferencia',
    nombre_es: 'Sillas de transferencia',
    nombre_en: 'Transfer chairs',
    orden: 70,
  },
  {
    id: 'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b04',
    familia_id: FAMILIA.movilidad,
    familia_slug: 'movilidad-rehabilitacion',
    slug: 'scooters-electricos',
    nombre_es: 'Scooters eléctricos',
    nombre_en: 'Mobility scooters',
    orden: 80,
  },
  {
    id: 'a1e7c3d2-6b48-4f0a-9c11-7d2e8f4a1b05',
    familia_id: FAMILIA.avd,
    familia_slug: 'actividades-vida-diaria',
    slug: 'higiene-en-cama',
    nombre_es: 'Higiene en cama',
    nombre_en: 'Bed bathing',
    orden: 70,
  },
] as const;

const TIPO = {
  exoesqueletos: ZUOWEI_TIPOS[0].id,
  marcha: ZUOWEI_TIPOS[1].id,
  transferencia: ZUOWEI_TIPOS[2].id,
  scooters: ZUOWEI_TIPOS[3].id,
  higiene: ZUOWEI_TIPOS[4].id,
} as const;

export interface ZuoweiSpec {
  clave: string;
  valor: string;
  grupo?: string;
}

export interface ZuoweiImagen {
  src: string;
  alt_es: string;
  alt_en: string;
  ancho: number;
  alto: number;
}

export interface ZuoweiSeo {
  title: string;
  description: string;
  h1: string;
  intro: string;
}

interface L10n {
  es: string;
  en: string;
}

export interface ZuoweiProducto {
  id: string;
  sku: string;
  slug: string;
  orden: number;
  familia_id: string;
  familia_slug: string;
  tipo_id: string;
  nombre_es: string;
  nombre_en: string;
  descripcion_corta_es: string;
  descripcion_corta_en: string;
  descripcion_larga_es: string;
  descripcion_larga_en: string;
  seo_es: ZuoweiSeo;
  seo_en: ZuoweiSeo;
  especificaciones: ZuoweiSpec[];
  especificaciones_en: ZuoweiSpec[];
  aplicaciones_es: string[];
  aplicaciones_en: string[];
  beneficios_es: string[];
  beneficios_en: string[];
  seo_keywords_es: string[];
  seo_keywords_en: string[];
  imagenes: ZuoweiImagen[];
  landing: boolean;
  role: L10n;
  summary: L10n;
  cardSpecs: Array<{ label: L10n; value: L10n }>;
}

const grupoFicha = { es: 'Ficha del fabricante', en: 'Manufacturer sheet' };
const grupoAviso = { es: 'Advertencia del fabricante', en: 'Manufacturer warning' };
const grupoGarantia = { es: 'Garantía', en: 'Warranty' };

function ficha(clave: L10n, valor: L10n): { es: ZuoweiSpec; en: ZuoweiSpec } {
  return {
    es: { clave: clave.es, valor: valor.es, grupo: grupoFicha.es },
    en: { clave: clave.en, valor: valor.en, grupo: grupoFicha.en },
  };
}

function aviso(valor: L10n): { es: ZuoweiSpec; en: ZuoweiSpec } {
  return {
    es: { clave: 'Advertencia del fabricante', valor: valor.es, grupo: grupoAviso.es },
    en: { clave: 'Manufacturer warning', valor: valor.en, grupo: grupoAviso.en },
  };
}

function garantia(): { es: ZuoweiSpec; en: ZuoweiSpec } {
  return {
    es: { clave: 'Garantía', valor: ZUOWEI_GARANTIA.es, grupo: grupoGarantia.es },
    en: { clave: 'Warranty', valor: ZUOWEI_GARANTIA.en, grupo: grupoGarantia.en },
  };
}

function modelo(sku: string): { es: ZuoweiSpec; en: ZuoweiSpec } {
  return ficha({ es: 'Modelo', en: 'Model' }, { es: sku, en: sku });
}

function fabricante(): { es: ZuoweiSpec; en: ZuoweiSpec } {
  return ficha({ es: 'Fabricante', en: 'Manufacturer' }, { es: FABRICANTE, en: FABRICANTE });
}

function pares(
  items: Array<{ es: ZuoweiSpec; en: ZuoweiSpec }>
): { es: ZuoweiSpec[]; en: ZuoweiSpec[] } {
  return { es: items.map(item => item.es), en: items.map(item => item.en) };
}

function img(
  slug: string,
  file: string,
  alt: L10n,
  ancho: number,
  alto: number
): ZuoweiImagen {
  return {
    src: `/assets/productos/zuowei/${slug}/${file}`,
    alt_es: alt.es,
    alt_en: alt.en,
    ancho,
    alto,
  };
}

const cierre = {
  es: `Precio bajo cotización. ${ZUOWEI_GARANTIA.es} WhatsApp ${PHONE}.`,
  en: `Price on request. ${ZUOWEI_GARANTIA.en} WhatsApp ${PHONE}.`,
};

const S568 = 'exoesqueleto-rehabilitacion-marcha-zuowei-zw568';
const S598 = 'exoesqueleto-portatil-ultraligero-marcha-zuowei-zw598';
const S518 = 'silla-ruedas-electrica-bipedestacion-entrenamiento-marcha-zuowei-zw518';
const S302 = 'silla-transferencia-hidraulica-pacientes-zuowei-zw302';
const S365 = 'silla-transferencia-electrica-pacientes-asiento-ancho-zuowei-zw365d-2';
const S366 = 'silla-transferencia-manual-manivela-pacientes-zuowei-zw366s';
const S186 = 'maquina-ducha-portatil-pacientes-encamados-zuowei-zw186';
const S501 = 'scooter-electrico-movilidad-plegable-zuowei-zw501';
const S502 = 'scooter-electrico-4-ruedas-plegable-ultraligero-zuowei-zw502';

const specs568 = pares([
  modelo('ZW568'),
  fabricante(),
  ficha(
    { es: 'Asistencia', en: 'Assistance' },
    { es: 'Ajustable en 5 niveles', en: 'Adjustable in 5 levels' }
  ),
  ficha(
    { es: 'Unidades de potencia', en: 'Power units' },
    {
      es: 'Dos unidades bilaterales, para flexión y extensión del muslo',
      en: 'Two bilateral units, for thigh flexion and extension',
    }
  ),
  ficha(
    { es: 'Colocación', en: 'Fit' },
    {
      es: 'Se ajusta a la cadera. El fabricante la describe como fácil de colocar',
      en: 'Fits at the hip. The manufacturer describes it as easy to put on',
    }
  ),
  ficha({ es: 'Batería', en: 'Battery' }, { es: 'DC 21,6 V', en: 'DC 21.6 V' }),
  ficha({ es: 'Autonomía', en: 'Runtime' }, { es: '120 min', en: '120 min' }),
  ficha({ es: 'Tiempo de carga', en: 'Charge time' }, { es: '4 h', en: '4 h' }),
  ficha(
    { es: 'Dimensiones', en: 'Dimensions' },
    { es: '515 × 345 × 335 mm', en: '515 × 345 × 335 mm' }
  ),
  ficha(
    { es: 'Uso', en: 'Use' },
    {
      es: 'Interior y exterior. No usar bajo la lluvia',
      en: 'Indoor and outdoor. Do not use in the rain',
    }
  ),
  ficha(
    { es: 'Usuario previsto', en: 'Intended user' },
    {
      es: 'Personas que pueden ponerse de pie y mantener el equilibrio por sí mismas',
      en: 'People who can stand and keep their balance on their own',
    }
  ),
  aviso({
    es: 'No apto para personas que no puedan estar de pie, caminar o mantener el equilibrio solas. El fabricante indica no usarlo en caso de cardiopatía, hipertensión o embarazo. No es impermeable.',
    en: 'Not for people who cannot stand, walk or keep their balance on their own. The manufacturer says not to use it with heart disease, hypertension or pregnancy. It is not waterproof.',
  }),
  garantia(),
]);

const specs598 = pares([
  modelo('ZW598'),
  fabricante(),
  ficha({ es: 'Peso', en: 'Weight' }, { es: '2,4 kg', en: '2.4 kg' }),
  ficha(
    { es: 'Motores', en: 'Motors' },
    { es: '2 motores, hasta 16 Nm', en: '2 motors, up to 16 Nm' }
  ),
  ficha(
    { es: 'Asistencia', en: 'Assistance' },
    { es: '6 niveles', en: '6 levels' }
  ),
  ficha(
    { es: 'Estructura', en: 'Frame' },
    { es: 'Aleación de aluminio, plegable', en: 'Aluminum alloy, foldable' }
  ),
  ficha(
    { es: 'Temperatura de operación', en: 'Operating temperature' },
    { es: '−10 °C a 45 °C', en: '−10 °C to 45 °C' }
  ),
  ficha(
    { es: 'Detección', en: 'Detection' },
    {
      es: 'Doble motor y algoritmo que detecta la intención de movimiento en tiempo real',
      en: 'Dual motor and an algorithm that detects movement intention in real time',
    }
  ),
  garantia(),
]);

const specs518 = pares([
  modelo('ZW518'),
  fabricante(),
  ficha(
    { es: 'Modos', en: 'Modes' },
    {
      es: 'Silla de ruedas eléctrica y bipedestación / entrenamiento de marcha con arnés. Un botón cambia de modo',
      en: 'Power wheelchair and standing / gait training with a harness. One button switches modes',
    }
  ),
  ficha(
    { es: 'Freno', en: 'Brake' },
    { es: 'Electromagnético automático', en: 'Automatic electromagnetic brake' }
  ),
  ficha({ es: 'Control', en: 'Control' }, { es: 'Joystick', en: 'Joystick' }),
  ficha(
    { es: 'Batería', en: 'Battery' },
    { es: 'Litio 24 V 15,4 Ah, extraíble', en: 'Lithium 24 V 15.4 Ah, removable' }
  ),
  ficha({ es: 'Autonomía', en: 'Range' }, { es: 'Más de 20 km', en: 'More than 20 km' }),
  ficha({ es: 'Tiempo de carga', en: 'Charge time' }, { es: '4 h', en: '4 h' }),
  ficha({ es: 'Velocidad', en: 'Speed' }, { es: '6 km/h, ajustable', en: '6 km/h, adjustable' }),
  ficha({ es: 'Peso del equipo', en: 'Unit weight' }, { es: '32 kg', en: '32 kg' }),
  ficha(
    { es: 'Dimensiones sentado', en: 'Seated size' },
    { es: '1000 × 690 × 1090 mm', en: '1000 × 690 × 1090 mm' }
  ),
  ficha(
    { es: 'Dimensiones de pie', en: 'Standing size' },
    { es: '1000 × 690 × 2000 mm', en: '1000 × 690 × 2000 mm' }
  ),
  ficha(
    { es: 'Estatura de usuario', en: 'User height' },
    { es: '140–180 cm', en: '140–180 cm' }
  ),
  ficha(
    { es: 'Arnés de seguridad', en: 'Safety harness' },
    { es: 'Hasta 150 kg', en: 'Up to 150 kg' }
  ),
  ficha({ es: 'Marco', en: 'Frame' }, { es: 'Aluminio', en: 'Aluminum' }),
  garantia(),
]);

const specs302 = pares([
  modelo('ZW302'),
  fabricante(),
  ficha(
    { es: 'Elevación', en: 'Lift' },
    { es: 'Hidráulica por pedal', en: 'Hydraulic, pedal operated' }
  ),
  ficha({ es: 'Carga máxima', en: 'Maximum load' }, { es: '120 kg', en: '120 kg' }),
  ficha(
    { es: 'Recorrido del asiento', en: 'Seat travel' },
    { es: '20 cm', en: '20 cm' }
  ),
  ficha(
    { es: 'Asiento', en: 'Seat' },
    { es: 'Dividido, apertura 180°', en: 'Split seat, 180° opening' }
  ),
  ficha(
    { es: 'Uso', en: 'Use' },
    { es: 'Hogar y residencias', en: 'Home and care residences' }
  ),
  garantia(),
]);

const specs365 = pares([
  modelo('ZW365D-2'),
  fabricante(),
  ficha(
    { es: 'Dimensiones', en: 'Dimensions' },
    { es: '860 × 621 × 862–1162 mm', en: '860 × 621 × 862–1162 mm' }
  ),
  ficha(
    { es: 'Ruedas', en: 'Wheels' },
    { es: '5 pulgadas delanteras y 3 pulgadas traseras', en: '5 in front and 3 in rear' }
  ),
  ficha({ es: 'Ancho de asiento', en: 'Seat width' }, { es: '510 mm', en: '510 mm' }),
  ficha({ es: 'Carga máxima', en: 'Maximum load' }, { es: '200 kg', en: '200 kg' }),
  ficha({ es: 'Recorrido', en: 'Travel' }, { es: '30 cm', en: '30 cm' }),
  ficha({ es: 'Motor', en: 'Motor' }, { es: '100 W', en: '100 W' }),
  ficha(
    { es: 'Entrada del cargador', en: 'Charger input' },
    { es: '110–240 V', en: '110–240 V' }
  ),
  ficha({ es: 'Salida', en: 'Output' }, { es: '29,4 V', en: '29.4 V' }),
  ficha(
    { es: 'Batería', en: 'Battery' },
    { es: '25,2 V 3.200 mAh', en: '25.2 V 3,200 mAh' }
  ),
  ficha({ es: 'Tiempo de carga', en: 'Charge time' }, { es: '3,5 h', en: '3.5 h' }),
  ficha(
    { es: 'Velocidad de elevación', en: 'Lift speed' },
    { es: '≤4 mm/s', en: '≤4 mm/s' }
  ),
  ficha(
    { es: 'Indicador', en: 'Indicator' },
    { es: 'Pantalla LED de batería', en: 'Battery LED display' }
  ),
  garantia(),
]);

const specs366 = pares([
  modelo('ZW366S'),
  fabricante(),
  ficha(
    { es: 'Elevación', en: 'Lift' },
    { es: 'Manual, por manivela', en: 'Manual, crank operated' }
  ),
  ficha({ es: 'Carga máxima', en: 'Maximum load' }, { es: '120 kg', en: '120 kg' }),
  ficha({ es: 'Recorrido', en: 'Travel' }, { es: '20 cm', en: '20 cm' }),
  ficha(
    { es: 'Asiento', en: 'Seat' },
    { es: 'Dividido, apertura 180°', en: 'Split seat, 180° opening' }
  ),
  ficha({ es: 'Alimentación', en: 'Power' }, { es: 'Sin batería', en: 'No battery' }),
  garantia(),
]);

const specs186 = pares([
  modelo('ZW186'),
  fabricante(),
  ficha(
    { es: 'Uso', en: 'Use' },
    {
      es: 'Aseo de pacientes encamados',
      en: 'Bathing for people who are in bed',
    }
  ),
  garantia(),
]);

const specs501 = pares([
  modelo('ZW501'),
  fabricante(),
  ficha(
    { es: 'Configuración', en: 'Configuration' },
    { es: 'Scooter plegable de 3 ruedas', en: 'Foldable 3-wheel scooter' }
  ),
  ficha({ es: 'Plegado', en: 'Folding' }, { es: '3 segundos', en: '3 seconds' }),
  ficha(
    { es: 'Modos', en: 'Modes' },
    { es: 'Conducción, plegado y arrastre', en: 'Drive, fold and tow' }
  ),
  ficha({ es: 'Velocidades', en: 'Speeds' }, { es: '4', en: '4' }),
  ficha({ es: 'Velocidad máxima', en: 'Top speed' }, { es: '6,4 km/h', en: '6.4 km/h' }),
  ficha(
    { es: 'Autonomía', en: 'Range' },
    {
      es: '15 km con una batería; 30 km con dos baterías',
      en: '15 km with one battery; 30 km with two batteries',
    }
  ),
  ficha({ es: 'Peso bruto', en: 'Gross weight' }, { es: '27 kg', en: '27 kg' }),
  ficha({ es: 'Carga máxima', en: 'Maximum load' }, { es: '120 kg', en: '120 kg' }),
  ficha(
    { es: 'Freno', en: 'Brake' },
    { es: 'Electromagnético', en: 'Electromagnetic' }
  ),
  ficha(
    { es: 'Batería', en: 'Battery' },
    { es: 'Litio extraíble', en: 'Removable lithium' }
  ),
  garantia(),
]);

const specs502 = pares([
  modelo('ZW502'),
  fabricante(),
  ficha({ es: 'Ruedas', en: 'Wheels' }, { es: '4', en: '4' }),
  ficha({ es: 'Material', en: 'Material' }, { es: 'Aluminio', en: 'Aluminum' }),
  ficha({ es: 'Peso neto', en: 'Net weight' }, { es: '16 kg', en: '16 kg' }),
  ficha({ es: 'Plegado', en: 'Folding' }, { es: '1 segundo', en: '1 second' }),
  ficha({ es: 'Velocidad', en: 'Speed' }, { es: '8 km/h', en: '8 km/h' }),
  ficha({ es: 'Motor', en: 'Motor' }, { es: 'DC', en: 'DC' }),
  ficha({ es: 'Pendiente', en: 'Gradient' }, { es: '≥6°', en: '≥6°' }),
  ficha(
    { es: 'Transporte', en: 'Transport' },
    { es: 'Cabe en el baúl', en: 'Fits in a car trunk' }
  ),
  garantia(),
]);

function larga(cuerpo: L10n, extra?: L10n): L10n {
  return {
    es: [cuerpo.es, extra?.es, cierre.es].filter(Boolean).join('\n\n'),
    en: [cuerpo.en, extra?.en, cierre.en].filter(Boolean).join('\n\n'),
  };
}

export const ZUOWEI_PRODUCTOS: readonly ZuoweiProducto[] = [
  {
    id: '44522403-323a-5610-b089-d65e27884d74',
    sku: 'ZW568',
    slug: S568,
    orden: -9,
    familia_id: FAMILIA.robots,
    familia_slug: 'robots',
    tipo_id: TIPO.exoesqueletos,
    nombre_es: 'Exoesqueleto de asistencia de marcha Zuowei ZW568',
    nombre_en: 'Zuowei ZW568 gait assistance exoskeleton',
    descripcion_corta_es:
      'Dispositivo portátil que se ajusta a la cadera. Dos unidades de potencia bilaterales asisten la flexión y extensión del muslo durante la marcha. Pensado para usuarios que pueden ponerse de pie y mantener el equilibrio por sí mismos, y para programas de entrenamiento de marcha en centros de rehabilitación, residencias y hogar.',
    descripcion_corta_en:
      'Portable device that fits at the hip. Two bilateral power units assist thigh flexion and extension during gait. Intended for users who can stand and keep their balance on their own, and for gait-training programs in rehabilitation centers, residences and at home.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Exoesqueleto de marcha Zuowei ZW568 | I-ME Colombia',
      description:
        'Exoesqueleto de cadera Zuowei ZW568 con doble unidad de potencia y 5 niveles de asistencia para entrenamiento de marcha. Cotiza con I-ME en Colombia.',
      h1: 'Exoesqueleto de asistencia de marcha Zuowei ZW568',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW568 gait exoskeleton | I-ME Colombia',
      description:
        'Zuowei ZW568 hip exoskeleton with dual power units and 5 assistance levels for gait training. Request a quote from I-ME in Colombia.',
      h1: 'Zuowei ZW568 gait assistance exoskeleton',
      intro: '',
    },
    especificaciones: specs568.es,
    especificaciones_en: specs568.en,
    aplicaciones_es: [
      'Entrenamiento de marcha en centros de rehabilitación, residencias y hogar',
      'Uso interior y exterior, no bajo la lluvia',
    ],
    aplicaciones_en: [
      'Gait training in rehabilitation centers, residences and at home',
      'Indoor and outdoor use, not in the rain',
    ],
    beneficios_es: [
      'Asistencia ajustable en 5 niveles',
      'Dos unidades de potencia bilaterales',
      'Autonomía publicada de 120 min',
    ],
    beneficios_en: [
      'Assistance adjustable in 5 levels',
      'Two bilateral power units',
      'Published runtime of 120 min',
    ],
    seo_keywords_es: ['exoesqueleto de marcha', 'Zuowei ZW568', 'rehabilitación Colombia'],
    seo_keywords_en: ['gait exoskeleton', 'Zuowei ZW568', 'rehabilitation Colombia'],
    imagenes: [
      img(
        S568,
        'principal-zuowei-zw568-exoesqueleto-rehabilitacion-marcha-colombia.webp',
        {
          es: 'Exoesqueleto de rehabilitación de marcha Zuowei ZW568, vista de estudio',
          en: 'Zuowei ZW568 gait rehabilitation exoskeleton, studio view',
        },
        800,
        560
      ),
      img(
        S568,
        'galeria-zuowei-zw568-exoesqueleto-rehabilitacion-marcha-colombia-01.webp',
        {
          es: 'Exoesqueleto Zuowei ZW568, vista frontal de la asistencia de cadera',
          en: 'Zuowei ZW568 exoskeleton, front view of the hip assistance',
        },
        800,
        560
      ),
      img(
        S568,
        'galeria-zuowei-zw568-exoesqueleto-rehabilitacion-marcha-colombia-02.webp',
        {
          es: 'Exoesqueleto Zuowei ZW568 en entrenamiento de marcha al aire libre',
          en: 'Zuowei ZW568 exoskeleton during outdoor gait training',
        },
        1253,
        1253
      ),
      img(
        S568,
        'galeria-zuowei-zw568-exoesqueleto-rehabilitacion-marcha-colombia-03.webp',
        {
          es: 'Exoesqueleto Zuowei ZW568 con dos unidades de potencia bilaterales',
          en: 'Zuowei ZW568 exoskeleton with two bilateral power units',
        },
        800,
        560
      ),
    ],
    landing: true,
    role: {
      es: 'Exoesqueleto de cadera para entrenamiento de marcha',
      en: 'Hip exoskeleton for gait training',
    },
    summary: {
      es: 'Dos unidades bilaterales asisten la flexión y extensión del muslo. Para personas que pueden ponerse de pie y mantener el equilibrio solas. Uso interior y exterior, no bajo la lluvia.',
      en: 'Two bilateral units assist thigh flexion and extension. For people who can stand and keep their balance on their own. Indoor and outdoor use, not in the rain.',
    },
    cardSpecs: [
      {
        label: { es: 'Asistencia', en: 'Assistance' },
        value: { es: '5 niveles', en: '5 levels' },
      },
      {
        label: { es: 'Potencia', en: 'Power' },
        value: { es: 'Dos unidades bilaterales', en: 'Two bilateral units' },
      },
      {
        label: { es: 'Batería', en: 'Battery' },
        value: { es: 'DC 21,6 V · 120 min', en: 'DC 21.6 V · 120 min' },
      },
      {
        label: { es: 'Dimensiones', en: 'Size' },
        value: { es: '515 × 345 × 335 mm', en: '515 × 345 × 335 mm' },
      },
    ],
  },
  {
    id: '6ff22f71-27fc-5f79-b4d6-07d4410f269f',
    sku: 'ZW598',
    slug: S598,
    orden: -8,
    familia_id: FAMILIA.robots,
    familia_slug: 'robots',
    tipo_id: TIPO.exoesqueletos,
    nombre_es: 'Exoesqueleto portátil ultraligero Zuowei ZW598',
    nombre_en: 'Zuowei ZW598 ultralight portable exoskeleton',
    descripcion_corta_es:
      'Asistencia de cadera con doble motor y algoritmo que detecta la intención de movimiento en tiempo real. Seis niveles de asistencia y estructura de aleación de aluminio plegable.',
    descripcion_corta_en:
      'Hip assistance with a dual motor and an algorithm that detects movement intention in real time. Six assistance levels and a foldable aluminum-alloy frame.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Exoesqueleto ultraligero Zuowei ZW598 2,4 kg | I-ME',
      description:
        'Exoesqueleto portátil Zuowei ZW598 de 2,4 kg con doble motor de hasta 16 Nm y 6 niveles de asistencia. Plegable, para uso diario. Cotiza con I-ME.',
      h1: 'Exoesqueleto portátil ultraligero Zuowei ZW598',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW598 ultralight exoskeleton, 2.4 kg | I-ME',
      description:
        'Portable Zuowei ZW598 exoskeleton, 2.4 kg, with a dual motor up to 16 Nm and 6 assistance levels. Foldable, for daily use. Request a quote from I-ME.',
      h1: 'Zuowei ZW598 ultralight portable exoskeleton',
      intro: '',
    },
    especificaciones: specs598.es,
    especificaciones_en: specs598.en,
    aplicaciones_es: ['Asistencia de cadera en uso diario, según la ficha del fabricante'],
    aplicaciones_en: ['Daily hip assistance, as described on the manufacturer sheet'],
    beneficios_es: ['Peso publicado de 2,4 kg', 'Hasta 16 Nm por motor', 'Estructura plegable'],
    beneficios_en: ['Published weight of 2.4 kg', 'Up to 16 Nm per motor', 'Foldable frame'],
    seo_keywords_es: ['exoesqueleto ultraligero', 'Zuowei ZW598', 'asistencia de cadera'],
    seo_keywords_en: ['ultralight exoskeleton', 'Zuowei ZW598', 'hip assistance'],
    imagenes: [
      img(
        S598,
        'principal-zuowei-zw598-exoesqueleto-portatil-ultraligero-cadera-colombia.webp',
        {
          es: 'Exoesqueleto portátil ultraligero de cadera Zuowei ZW598',
          en: 'Zuowei ZW598 ultralight portable hip exoskeleton',
        },
        1031,
        777
      ),
      img(
        S598,
        'galeria-zuowei-zw598-exoesqueleto-portatil-ultraligero-cadera-colombia-01.webp',
        {
          es: 'Exoesqueleto Zuowei ZW598 con doble motor, vista de estudio',
          en: 'Zuowei ZW598 exoskeleton with dual motor, studio view',
        },
        152,
        226
      ),
    ],
    landing: true,
    role: {
      es: 'Exoesqueleto ultraligero de cadera',
      en: 'Ultralight hip exoskeleton',
    },
    summary: {
      es: 'Doble motor de hasta 16 Nm, seis niveles y estructura de aluminio plegable. Peso publicado: 2,4 kg.',
      en: 'Dual motor up to 16 Nm, six levels and a foldable aluminum frame. Published weight: 2.4 kg.',
    },
    cardSpecs: [
      { label: { es: 'Peso', en: 'Weight' }, value: { es: '2,4 kg', en: '2.4 kg' } },
      {
        label: { es: 'Motores', en: 'Motors' },
        value: { es: '2, hasta 16 Nm', en: '2, up to 16 Nm' },
      },
      {
        label: { es: 'Asistencia', en: 'Assistance' },
        value: { es: '6 niveles', en: '6 levels' },
      },
      {
        label: { es: 'Estructura', en: 'Frame' },
        value: { es: 'Aluminio plegable', en: 'Foldable aluminum' },
      },
    ],
  },
  {
    id: '0b8291e8-af95-53d5-b34e-723ada3b79b4',
    sku: 'ZW518',
    slug: S518,
    orden: -7,
    familia_id: FAMILIA.robots,
    familia_slug: 'robots',
    tipo_id: TIPO.marcha,
    nombre_es: 'Silla de ruedas eléctrica con bipedestación y marcha Zuowei ZW518',
    nombre_en: 'Zuowei ZW518 power wheelchair with standing and gait',
    descripcion_corta_es:
      'Un botón cambia entre modo silla eléctrica y modo de bipedestación o entrenamiento de marcha con arnés. Freno electromagnético automático, joystick, batería extraíble y marco de aluminio.',
    descripcion_corta_en:
      'One button switches between power-wheelchair mode and standing or gait-training mode with a harness. Automatic electromagnetic brake, joystick, removable battery and aluminum frame.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Silla eléctrica con bipedestación Zuowei ZW518 | I-ME',
      description:
        'Zuowei ZW518: silla de ruedas eléctrica y equipo de bipedestación y marcha asistida en uno, con freno electromagnético y joystick. Cotiza con I-ME.',
      h1: 'Silla de ruedas eléctrica con bipedestación y marcha Zuowei ZW518',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW518 standing power wheelchair | I-ME',
      description:
        'Zuowei ZW518 combines a power wheelchair with standing and assisted gait, electromagnetic brake and joystick. Request a quote from I-ME.',
      h1: 'Zuowei ZW518 power wheelchair with standing and gait',
      intro: '',
    },
    especificaciones: specs518.es,
    especificaciones_en: specs518.en,
    aplicaciones_es: [
      'Desplazamiento en silla de ruedas eléctrica',
      'Bipedestación y entrenamiento de marcha con arnés',
    ],
    aplicaciones_en: ['Power wheelchair travel', 'Standing and gait training with a harness'],
    beneficios_es: [
      'Dos modos en el mismo equipo',
      'Freno electromagnético automático',
      'Batería de litio extraíble',
    ],
    beneficios_en: [
      'Two modes in the same unit',
      'Automatic electromagnetic brake',
      'Removable lithium battery',
    ],
    seo_keywords_es: ['silla de bipedestación', 'Zuowei ZW518', 'entrenamiento de marcha'],
    seo_keywords_en: ['standing wheelchair', 'Zuowei ZW518', 'gait training'],
    imagenes: [
      img(
        S518,
        'principal-zuowei-zw518-silla-ruedas-electrica-entrenamiento-marcha-colombia.webp',
        {
          es: 'Silla de ruedas eléctrica Zuowei ZW518 para entrenamiento de marcha',
          en: 'Zuowei ZW518 power wheelchair for gait training',
        },
        800,
        560
      ),
      img(
        S518,
        'galeria-zuowei-zw518-silla-ruedas-electrica-entrenamiento-marcha-colombia-01.webp',
        {
          es: 'Zuowei ZW518 en bipedestación y rehabilitación de marcha',
          en: 'Zuowei ZW518 in standing position and gait rehabilitation',
        },
        826,
        826
      ),
      img(
        S518,
        'galeria-zuowei-zw518-silla-ruedas-electrica-entrenamiento-marcha-colombia-02.webp',
        {
          es: 'Silla de ruedas de rehabilitación Zuowei ZW518, vista lateral',
          en: 'Zuowei ZW518 rehabilitation wheelchair, side view',
        },
        800,
        560
      ),
      img(
        S518,
        'galeria-zuowei-zw518-silla-ruedas-electrica-entrenamiento-marcha-colombia-03.webp',
        {
          es: 'Arneses de seguridad de la silla de rehabilitación Zuowei ZW518',
          en: 'Safety harnesses on the Zuowei ZW518 rehabilitation wheelchair',
        },
        800,
        560
      ),
    ],
    landing: true,
    role: {
      es: 'Silla eléctrica con bipedestación y marcha',
      en: 'Power wheelchair with standing and gait',
    },
    summary: {
      es: 'Un botón cambia entre silla eléctrica y bipedestación con arnés. Freno electromagnético, joystick y batería extraíble. Marco de aluminio.',
      en: 'One button switches between power wheelchair and standing with a harness. Electromagnetic brake, joystick and removable battery. Aluminum frame.',
    },
    cardSpecs: [
      {
        label: { es: 'Modos', en: 'Modes' },
        value: { es: 'Silla eléctrica y bipedestación', en: 'Power chair and standing' },
      },
      {
        label: { es: 'Freno', en: 'Brake' },
        value: { es: 'Electromagnético', en: 'Electromagnetic' },
      },
      {
        label: { es: 'Batería', en: 'Battery' },
        value: { es: 'Litio 24 V · más de 20 km', en: 'Lithium 24 V · over 20 km' },
      },
      {
        label: { es: 'Velocidad', en: 'Speed' },
        value: { es: '6 km/h', en: '6 km/h' },
      },
    ],
  },
  {
    id: 'bfa1da7b-246b-544b-bbb1-8a8a06b7f6b5',
    sku: 'ZW302',
    slug: S302,
    orden: -6,
    familia_id: FAMILIA.movilidad,
    familia_slug: 'movilidad-rehabilitacion',
    tipo_id: TIPO.transferencia,
    nombre_es: 'Silla de transferencia hidráulica Zuowei ZW302',
    nombre_en: 'Zuowei ZW302 hydraulic transfer chair',
    descripcion_corta_es:
      'Silla de transferencia con elevación hidráulica por pedal, carga máxima de 120 kg, recorrido del asiento de 20 cm y asiento dividido de 180°. Para hogar y residencias.',
    descripcion_corta_en:
      'Transfer chair with pedal hydraulic lift, 120 kg maximum load, 20 cm seat travel and a 180° split seat. For home and care residences.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Silla de transferencia hidráulica Zuowei ZW302 | I-ME',
      description:
        'Silla de transferencia Zuowei ZW302 con elevación hidráulica por pedal, asiento dividido 180° y 120 kg de carga. Para hogar y residencias. Cotiza con I-ME.',
      h1: 'Silla de transferencia hidráulica Zuowei ZW302',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW302 hydraulic transfer chair | I-ME',
      description:
        'Zuowei ZW302 transfer chair with pedal hydraulic lift, 180° split seat and 120 kg load. For home and care residences. Request a quote from I-ME.',
      h1: 'Zuowei ZW302 hydraulic transfer chair',
      intro: '',
    },
    especificaciones: specs302.es,
    especificaciones_en: specs302.en,
    aplicaciones_es: ['Traslado de la persona en hogar y residencias'],
    aplicaciones_en: ['Transfers at home and in care residences'],
    beneficios_es: ['Elevación por pedal', 'Asiento dividido de 180°', 'Carga máxima de 120 kg'],
    beneficios_en: ['Pedal lift', '180° split seat', '120 kg maximum load'],
    seo_keywords_es: ['silla de transferencia hidráulica', 'Zuowei ZW302'],
    seo_keywords_en: ['hydraulic transfer chair', 'Zuowei ZW302'],
    imagenes: [
      img(
        S302,
        'principal-zuowei-zw302-silla-transferencia-hidraulica-pacientes-colombia.webp',
        {
          es: 'Silla de transferencia hidráulica Zuowei ZW302',
          en: 'Zuowei ZW302 hydraulic transfer chair',
        },
        800,
        560
      ),
      img(
        S302,
        'galeria-zuowei-zw302-silla-transferencia-hidraulica-pacientes-colombia-01.webp',
        {
          es: 'Zuowei ZW302 con elevación hidráulica por pedal y asiento de 180°',
          en: 'Zuowei ZW302 with pedal hydraulic lift and 180° seat',
        },
        800,
        560
      ),
      img(
        S302,
        'galeria-zuowei-zw302-silla-transferencia-hidraulica-pacientes-colombia-02.webp',
        {
          es: 'Silla de transferencia Zuowei ZW302 para inodoro y ducha',
          en: 'Zuowei ZW302 transfer chair for toilet and shower',
        },
        800,
        560
      ),
      img(
        S302,
        'galeria-zuowei-zw302-silla-transferencia-hidraulica-pacientes-colombia-03.webp',
        {
          es: 'Silla de elevación hidráulica Zuowei ZW302, vista de estudio',
          en: 'Zuowei ZW302 hydraulic lift chair, studio view',
        },
        188,
        237
      ),
    ],
    landing: false,
    role: { es: 'Traslado hidráulico', en: 'Hydraulic transfer' },
    summary: { es: '', en: '' },
    cardSpecs: [],
  },
  {
    id: 'd4b3b95b-f584-5ca9-94d9-cecb5134a9a7',
    sku: 'ZW365D-2',
    slug: S365,
    orden: -5,
    familia_id: FAMILIA.movilidad,
    familia_slug: 'movilidad-rehabilitacion',
    tipo_id: TIPO.transferencia,
    nombre_es: 'Silla de transferencia eléctrica Zuowei ZW365D-2',
    nombre_en: 'Zuowei ZW365D-2 electric transfer chair',
    descripcion_corta_es:
      'Silla de transferencia eléctrica con elevación de 30 cm, asiento de 510 mm, carga máxima de 200 kg, motor de 100 W e indicador LED de batería.',
    descripcion_corta_en:
      'Electric transfer chair with 30 cm lift, 510 mm seat, 200 kg maximum load, 100 W motor and a battery LED indicator.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Silla de transferencia eléctrica Zuowei ZW365D-2 | I-ME',
      description:
        'Silla de transferencia eléctrica Zuowei ZW365D-2: elevación de 30 cm, asiento de 51 cm, 200 kg de carga y pantalla LED de batería. Cotiza con I-ME.',
      h1: 'Silla de transferencia eléctrica Zuowei ZW365D-2',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW365D-2 electric transfer chair | I-ME',
      description:
        'Zuowei ZW365D-2 electric transfer chair: 30 cm lift, 51 cm seat, 200 kg load and battery LED display. Request a quote from I-ME.',
      h1: 'Zuowei ZW365D-2 electric transfer chair',
      intro: '',
    },
    especificaciones: specs365.es,
    especificaciones_en: specs365.en,
    aplicaciones_es: ['Traslado con elevación eléctrica y asiento ancho'],
    aplicaciones_en: ['Transfers with electric lift and a wide seat'],
    beneficios_es: ['Asiento de 510 mm', 'Carga máxima de 200 kg', 'Indicador LED de batería'],
    beneficios_en: ['510 mm seat', '200 kg maximum load', 'Battery LED indicator'],
    seo_keywords_es: ['silla de transferencia eléctrica', 'Zuowei ZW365D-2'],
    seo_keywords_en: ['electric transfer chair', 'Zuowei ZW365D-2'],
    imagenes: [
      img(
        S365,
        'principal-zuowei-zw365d-2-silla-transferencia-electrica-pacientes-colombia.webp',
        {
          es: 'Silla de transferencia eléctrica Zuowei ZW365D-2',
          en: 'Zuowei ZW365D-2 electric transfer chair',
        },
        800,
        560
      ),
      img(
        S365,
        'galeria-zuowei-zw365d-2-silla-transferencia-electrica-pacientes-colombia-01.webp',
        {
          es: 'Zuowei ZW365D-2 con elevación eléctrica y asiento de 51 cm',
          en: 'Zuowei ZW365D-2 with electric lift and 51 cm seat',
        },
        800,
        560
      ),
      img(
        S365,
        'galeria-zuowei-zw365d-2-silla-transferencia-electrica-pacientes-colombia-02.webp',
        {
          es: 'Silla de traslado eléctrica Zuowei ZW365D-2 para cuidado domiciliario',
          en: 'Zuowei ZW365D-2 electric transfer chair for home care',
        },
        1110,
        1110
      ),
      img(
        S365,
        'galeria-zuowei-zw365d-2-silla-transferencia-electrica-pacientes-colombia-03.webp',
        {
          es: 'Silla de transferencia eléctrica Zuowei ZW365D-2, vista de estudio',
          en: 'Zuowei ZW365D-2 electric transfer chair, studio view',
        },
        188,
        199
      ),
    ],
    landing: false,
    role: { es: 'Traslado eléctrico', en: 'Electric transfer' },
    summary: { es: '', en: '' },
    cardSpecs: [],
  },
  {
    id: '774eff3a-2f0e-5908-b35d-6d43fea0b710',
    sku: 'ZW366S',
    slug: S366,
    orden: -4,
    familia_id: FAMILIA.movilidad,
    familia_slug: 'movilidad-rehabilitacion',
    tipo_id: TIPO.transferencia,
    nombre_es: 'Silla de transferencia manual con manivela Zuowei ZW366S',
    nombre_en: 'Zuowei ZW366S manual crank transfer chair',
    descripcion_corta_es:
      'Silla de transferencia con elevación por manivela, carga máxima de 120 kg, recorrido de 20 cm y asiento dividido de 180°. No usa batería.',
    descripcion_corta_en:
      'Transfer chair with crank lift, 120 kg maximum load, 20 cm travel and a 180° split seat. It does not use a battery.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Silla de transferencia manual Zuowei ZW366S | I-ME',
      description:
        'Silla de transferencia Zuowei ZW366S con elevación por manivela, asiento dividido 180° y 120 kg de carga. Sin batería. Cotiza con I-ME Colombia.',
      h1: 'Silla de transferencia manual con manivela Zuowei ZW366S',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW366S manual transfer chair | I-ME',
      description:
        'Zuowei ZW366S transfer chair with crank lift, 180° split seat and 120 kg load. No battery. Request a quote from I-ME in Colombia.',
      h1: 'Zuowei ZW366S manual crank transfer chair',
      intro: '',
    },
    especificaciones: specs366.es,
    especificaciones_en: specs366.en,
    aplicaciones_es: ['Traslado manual, sin batería'],
    aplicaciones_en: ['Manual transfers, with no battery'],
    beneficios_es: ['Elevación por manivela', 'Sin batería', 'Asiento dividido de 180°'],
    beneficios_en: ['Crank lift', 'No battery', '180° split seat'],
    seo_keywords_es: ['silla de transferencia manual', 'Zuowei ZW366S'],
    seo_keywords_en: ['manual transfer chair', 'Zuowei ZW366S'],
    imagenes: [
      img(
        S366,
        'principal-zuowei-zw366s-silla-transferencia-manual-manivela-pacientes-colombia.webp',
        {
          es: 'Silla de transferencia manual con manivela Zuowei ZW366S',
          en: 'Zuowei ZW366S manual crank transfer chair',
        },
        800,
        560
      ),
      img(
        S366,
        'galeria-zuowei-zw366s-silla-transferencia-manual-manivela-pacientes-colombia-01.webp',
        {
          es: 'Zuowei ZW366S para traslado manual hacia inodoro o ducha',
          en: 'Zuowei ZW366S for manual transfer to a toilet or shower',
        },
        800,
        560
      ),
      img(
        S366,
        'galeria-zuowei-zw366s-silla-transferencia-manual-manivela-pacientes-colombia-02.webp',
        {
          es: 'Silla de elevación manual Zuowei ZW366S, vista frontal de la manivela',
          en: 'Zuowei ZW366S manual lift chair, front view of the crank',
        },
        800,
        560
      ),
      img(
        S366,
        'galeria-zuowei-zw366s-silla-transferencia-manual-manivela-pacientes-colombia-03.webp',
        {
          es: 'Silla de transferencia manual Zuowei ZW366S, vista de estudio',
          en: 'Zuowei ZW366S manual transfer chair, studio view',
        },
        209,
        237
      ),
    ],
    landing: false,
    role: { es: 'Traslado manual', en: 'Manual transfer' },
    summary: { es: '', en: '' },
    cardSpecs: [],
  },
  {
    id: '8fd800cf-e89b-56fa-9742-0d78fb228767',
    sku: 'ZW186',
    slug: S186,
    orden: -3,
    familia_id: FAMILIA.avd,
    familia_slug: 'actividades-vida-diaria',
    tipo_id: TIPO.higiene,
    nombre_es: 'Máquina de ducha portátil para pacientes encamados Zuowei ZW186',
    nombre_en: 'Zuowei ZW186 portable shower for people in bed',
    descripcion_corta_es:
      'Máquina de ducha portátil para el aseo de pacientes encamados. Está pensada para la higiene en cama y para el cuidado de la dignidad de la persona.',
    descripcion_corta_en:
      'Portable shower machine for bathing people who are in bed. It is intended for in-bed hygiene and for the person’s dignity.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Ducha portátil para pacientes en cama Zuowei ZW186 | I-ME',
      description:
        'Zuowei ZW186: máquina de ducha portátil para el aseo de pacientes encamados. Higiene en cama, con atención a la dignidad. Cotiza con I-ME Colombia.',
      h1: 'Máquina de ducha portátil para pacientes encamados Zuowei ZW186',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW186 portable bed shower | I-ME',
      description:
        'Zuowei ZW186 portable shower for bathing people who are in bed. In-bed hygiene, with attention to dignity. Request a quote from I-ME in Colombia.',
      h1: 'Zuowei ZW186 portable shower for people in bed',
      intro: '',
    },
    especificaciones: specs186.es,
    especificaciones_en: specs186.en,
    aplicaciones_es: ['Higiene en cama de pacientes encamados'],
    aplicaciones_en: ['In-bed hygiene for people who remain in bed'],
    beneficios_es: ['Equipo portátil para el aseo en cama'],
    beneficios_en: ['Portable unit for bathing in bed'],
    seo_keywords_es: ['ducha portátil encamados', 'Zuowei ZW186', 'higiene en cama'],
    seo_keywords_en: ['portable bed shower', 'Zuowei ZW186', 'in-bed hygiene'],
    imagenes: [
      img(
        S186,
        'principal-zuowei-zw186-maquina-ducha-portatil-pacientes-encamados-colombia.webp',
        {
          es: 'Máquina de ducha portátil Zuowei ZW186 para pacientes encamados',
          en: 'Zuowei ZW186 portable shower machine for people in bed',
        },
        800,
        560
      ),
      img(
        S186,
        'galeria-zuowei-zw186-maquina-ducha-portatil-pacientes-encamados-colombia-01.webp',
        {
          es: 'Sistema de ducha en cama Zuowei ZW186',
          en: 'Zuowei ZW186 in-bed shower system',
        },
        800,
        560
      ),
      img(
        S186,
        'galeria-zuowei-zw186-maquina-ducha-portatil-pacientes-encamados-colombia-02.webp',
        {
          es: 'Accesorios de la ducha portátil asistencial Zuowei ZW186',
          en: 'Accessories of the Zuowei ZW186 portable care shower',
        },
        800,
        560
      ),
      img(
        S186,
        'galeria-zuowei-zw186-maquina-ducha-portatil-pacientes-encamados-colombia-03.webp',
        {
          es: 'Equipo de higiene en cama Zuowei ZW186',
          en: 'Zuowei ZW186 in-bed hygiene unit',
        },
        1400,
        1226
      ),
    ],
    landing: false,
    role: { es: 'Higiene en cama', en: 'In-bed hygiene' },
    summary: { es: '', en: '' },
    cardSpecs: [],
  },
  {
    id: 'd21edddb-878f-59bb-8269-9722dadcbefc',
    sku: 'ZW501',
    slug: S501,
    orden: -2,
    familia_id: FAMILIA.movilidad,
    familia_slug: 'movilidad-rehabilitacion',
    tipo_id: TIPO.scooters,
    nombre_es: 'Scooter eléctrico de movilidad plegable Zuowei ZW501',
    nombre_en: 'Zuowei ZW501 foldable mobility scooter',
    descripcion_corta_es:
      'Scooter de movilidad plegable, de 3 ruedas, con modos de conducción, plegado y arrastre. Velocidad máxima de 6,4 km/h, freno electromagnético y batería de litio extraíble.',
    descripcion_corta_en:
      'Foldable 3-wheel mobility scooter with drive, fold and tow modes. Top speed 6.4 km/h, electromagnetic brake and removable lithium battery.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Scooter eléctrico plegable Zuowei ZW501 | I-ME',
      description:
        'Scooter de movilidad Zuowei ZW501: plegado en 3 segundos, 6,4 km/h, hasta 30 km con dos baterías de litio y 120 kg de carga. Cotiza con I-ME Colombia.',
      h1: 'Scooter eléctrico de movilidad plegable Zuowei ZW501',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW501 foldable mobility scooter | I-ME',
      description:
        'Zuowei ZW501 mobility scooter: folds in 3 seconds, 6.4 km/h, up to 30 km with two lithium batteries and a 120 kg load. Request a quote from I-ME.',
      h1: 'Zuowei ZW501 foldable mobility scooter',
      intro: '',
    },
    especificaciones: specs501.es,
    especificaciones_en: specs501.en,
    aplicaciones_es: ['Movilidad personal en interiores y exteriores, según la ficha'],
    aplicaciones_en: ['Personal mobility indoors and outdoors, as described on the sheet'],
    beneficios_es: ['Plegado en 3 segundos', 'Batería de litio extraíble', 'Freno electromagnético'],
    beneficios_en: ['Folds in 3 seconds', 'Removable lithium battery', 'Electromagnetic brake'],
    seo_keywords_es: ['scooter eléctrico plegable', 'Zuowei ZW501', 'movilidad'],
    seo_keywords_en: ['foldable mobility scooter', 'Zuowei ZW501'],
    imagenes: [
      img(
        S501,
        'principal-zuowei-zw501-scooter-electrico-movilidad-plegable-colombia.webp',
        {
          es: 'Scooter eléctrico de movilidad plegable Zuowei ZW501',
          en: 'Zuowei ZW501 foldable electric mobility scooter',
        },
        800,
        560
      ),
      img(
        S501,
        'galeria-zuowei-zw501-scooter-electrico-movilidad-plegable-colombia-01.webp',
        {
          es: 'Zuowei ZW501 plegado en 3 segundos',
          en: 'Zuowei ZW501 folded in 3 seconds',
        },
        800,
        560
      ),
      img(
        S501,
        'galeria-zuowei-zw501-scooter-electrico-movilidad-plegable-colombia-02.webp',
        {
          es: 'Scooter de movilidad Zuowei ZW501 en un paseo exterior',
          en: 'Zuowei ZW501 mobility scooter on an outdoor path',
        },
        1355,
        1263
      ),
      img(
        S501,
        'galeria-zuowei-zw501-scooter-electrico-movilidad-plegable-colombia-03.webp',
        {
          es: 'Batería de litio extraíble del scooter Zuowei ZW501',
          en: 'Removable lithium battery of the Zuowei ZW501 scooter',
        },
        800,
        560
      ),
    ],
    landing: false,
    role: { es: 'Scooter plegable', en: 'Foldable scooter' },
    summary: { es: '', en: '' },
    cardSpecs: [],
  },
  {
    id: 'fcf7861d-5994-544a-af1b-419f7a171de1',
    sku: 'ZW502',
    slug: S502,
    orden: -1,
    familia_id: FAMILIA.movilidad,
    familia_slug: 'movilidad-rehabilitacion',
    tipo_id: TIPO.scooters,
    nombre_es: 'Scooter eléctrico de 4 ruedas plegable Zuowei ZW502',
    nombre_en: 'Zuowei ZW502 foldable 4-wheel electric scooter',
    descripcion_corta_es:
      'Scooter eléctrico de 4 ruedas en aluminio, peso neto de 16 kg, plegado en 1 segundo y velocidad de 8 km/h. El fabricante indica que cabe en el baúl.',
    descripcion_corta_en:
      'Four-wheel aluminum electric scooter, 16 kg net weight, folds in 1 second and travels at 8 km/h. The manufacturer states that it fits in a car trunk.',
    descripcion_larga_es: '',
    descripcion_larga_en: '',
    seo_es: {
      title: 'Scooter 4 ruedas ultraligero Zuowei ZW502 16 kg | I-ME',
      description:
        'Scooter eléctrico Zuowei ZW502 de 4 ruedas en aluminio: 16 kg, plegado en 1 s y 8 km/h. Cabe en el baúl. Cotiza con I-ME.',
      h1: 'Scooter eléctrico de 4 ruedas plegable Zuowei ZW502',
      intro: '',
    },
    seo_en: {
      title: 'Zuowei ZW502 ultralight 4-wheel scooter, 16 kg | I-ME',
      description:
        'Zuowei ZW502 four-wheel aluminum scooter: 16 kg, folds in 1 s and travels at 8 km/h. Fits in a trunk. Request a quote from I-ME.',
      h1: 'Zuowei ZW502 foldable 4-wheel electric scooter',
      intro: '',
    },
    especificaciones: specs502.es,
    especificaciones_en: specs502.en,
    aplicaciones_es: ['Movilidad personal. El fabricante indica que cabe en el baúl'],
    aplicaciones_en: ['Personal mobility. The manufacturer states that it fits in a car trunk'],
    beneficios_es: ['Peso neto de 16 kg', 'Plegado en 1 segundo', 'Marco de aluminio de 4 ruedas'],
    beneficios_en: ['16 kg net weight', 'Folds in 1 second', 'Four-wheel aluminum frame'],
    seo_keywords_es: ['scooter 4 ruedas', 'Zuowei ZW502', 'plegable'],
    seo_keywords_en: ['4-wheel scooter', 'Zuowei ZW502', 'foldable'],
    imagenes: [
      img(
        S502,
        'principal-zuowei-zw502-scooter-electrico-4-ruedas-plegable-ultraligero-colombia.webp',
        {
          es: 'Scooter eléctrico de 4 ruedas plegable y ultraligero Zuowei ZW502',
          en: 'Zuowei ZW502 ultralight foldable 4-wheel electric scooter',
        },
        800,
        800
      ),
      img(
        S502,
        'galeria-zuowei-zw502-scooter-electrico-4-ruedas-plegable-ultraligero-colombia-01.webp',
        {
          es: 'Scooter Zuowei ZW502 de aluminio, 16 kg, plegado',
          en: 'Zuowei ZW502 aluminum scooter, 16 kg, folded',
        },
        800,
        800
      ),
      img(
        S502,
        'galeria-zuowei-zw502-scooter-electrico-4-ruedas-plegable-ultraligero-colombia-02.webp',
        {
          es: 'Detalle del maletero con el scooter Zuowei ZW502',
          en: 'Trunk detail with the Zuowei ZW502 scooter',
        },
        800,
        800
      ),
      img(
        S502,
        'galeria-zuowei-zw502-scooter-electrico-4-ruedas-plegable-ultraligero-colombia-03.webp',
        {
          es: 'Scooter eléctrico Zuowei ZW502 en un paseo exterior',
          en: 'Zuowei ZW502 electric scooter on an outdoor ride',
        },
        1269,
        846
      ),
    ],
    landing: false,
    role: { es: 'Scooter de 4 ruedas', en: '4-wheel scooter' },
    summary: { es: '', en: '' },
    cardSpecs: [],
  },
];

const aviso568: L10n = {
  es: 'Advertencia del fabricante: no apto para quien no pueda estar de pie, caminar o mantener el equilibrio solo. Indica no usarlo en caso de cardiopatía, hipertensión o embarazo. No es impermeable.',
  en: 'Manufacturer warning: not for someone who cannot stand, walk or keep their balance alone. The manufacturer says not to use it with heart disease, hypertension or pregnancy. It is not waterproof.',
};

for (const producto of ZUOWEI_PRODUCTOS) {
  const cuerpo = { es: producto.descripcion_corta_es, en: producto.descripcion_corta_en };
  const texto = larga(cuerpo, producto.sku === 'ZW568' ? aviso568 : undefined);
  producto.descripcion_larga_es = texto.es;
  producto.descripcion_larga_en = texto.en;
  producto.seo_es.intro = producto.descripcion_corta_es;
  producto.seo_en.intro = producto.descripcion_corta_en;
}

export const ZUOWEI_SLUGS = ZUOWEI_PRODUCTOS.map(producto => producto.slug);

export const ZUOWEI_LANDING = {
  es: '/es/distribuidores-de-robots-e-ingenieria-robotica-en-colombia-y-latinoamerica/',
  en: '/en/robot-distributors-and-robotics-engineering-in-colombia-and-latin-america/',
} as const;

const FAMILIA_PATH = {
  robots: { es: '/es/familias/robots/', en: '/en/families/robots/' },
  'movilidad-rehabilitacion': {
    es: '/es/familias/movilidad-rehabilitacion/',
    en: '/en/families/movilidad-rehabilitacion/',
  },
  'actividades-vida-diaria': {
    es: '/es/familias/actividades-vida-diaria/',
    en: '/en/families/actividades-vida-diaria/',
  },
} as const;

export function seoZuowei(slug: string, locale: Locale): ZuoweiSeo | undefined {
  const producto = ZUOWEI_PRODUCTOS.find(item => item.slug === slug);
  if (!producto) return undefined;
  return locale === 'en' ? producto.seo_en : producto.seo_es;
}

export function rehabZuowei(): readonly ZuoweiProducto[] {
  return ZUOWEI_PRODUCTOS.filter(producto => producto.landing);
}

export interface EnlaceZuowei {
  href: string;
  label: string;
}

export function enlacesZuowei(slug: string, locale: Locale): EnlaceZuowei[] {
  const producto = ZUOWEI_PRODUCTOS.find(item => item.slug === slug);
  if (!producto) return [];
  const grupo = ZUOWEI_PRODUCTOS.filter(item =>
    producto.landing
      ? item.landing && item.slug !== slug
      : item.tipo_id === producto.tipo_id && item.slug !== slug
  );
  const segmento = locale === 'en' ? '/en/products/' : '/es/productos/';
  const hermanos = grupo.map(item => ({
    href: `${segmento}${item.slug}/`,
    label: locale === 'en' ? item.nombre_en : item.nombre_es,
  }));
  if (producto.landing) {
    return [
      {
        href: ZUOWEI_LANDING[locale],
        label:
          locale === 'en'
            ? 'Rehabilitation robots in the catalog'
            : 'Robots de rehabilitación en el catálogo',
      },
      ...hermanos,
    ];
  }
  const familia = FAMILIA_PATH[producto.familia_slug as keyof typeof FAMILIA_PATH];
  return [
    {
      href: familia[locale],
      label: locale === 'en' ? 'See the family in the catalog' : 'Ver la familia en el catálogo',
    },
    ...hermanos,
  ];
}

export interface VistaZuowei {
  id: string;
  slug: string;
  familia_id: string;
  familia_slug: string;
  tipo_id: string;
  nombre: string;
  descripcion_corta: string;
  descripcion_larga: string;
  especificaciones: ZuoweiSpec[];
  especificaciones_en: ZuoweiSpec[];
  aplicaciones: string[];
  beneficios: string[];
  valor: null;
  preguntas_frecuentes: [];
  seo_keywords: string[];
  marca: string;
  imagen_principal: string;
  galeria: string[];
  alt_imagen: string;
  galeria_alt: string[];
  imagen_ancho: number;
  imagen_alto: number;
  ficha_pdf: null;
  tipo_comercial: 'equipo';
  fulfillment_mode: 'cotizacion';
  precio: null;
  moneda: 'COP';
  sku: string;
  stock: null;
  disponible: true;
  destacado: true;
  nuevo: true;
  activo: true;
  orden: number;
}

export function vistasZuowei(locale: Locale): VistaZuowei[] {
  return ZUOWEI_PRODUCTOS.map(producto => {
    const en = locale === 'en';
    const [principal, ...resto] = producto.imagenes;
    return {
      id: producto.id,
      slug: producto.slug,
      familia_id: producto.familia_id,
      familia_slug: producto.familia_slug,
      tipo_id: producto.tipo_id,
      nombre: en ? producto.nombre_en : producto.nombre_es,
      descripcion_corta: en ? producto.descripcion_corta_en : producto.descripcion_corta_es,
      descripcion_larga: en ? producto.descripcion_larga_en : producto.descripcion_larga_es,
      especificaciones: producto.especificaciones,
      especificaciones_en: producto.especificaciones_en,
      aplicaciones: en ? producto.aplicaciones_en : producto.aplicaciones_es,
      beneficios: en ? producto.beneficios_en : producto.beneficios_es,
      valor: null,
      preguntas_frecuentes: [],
      seo_keywords: en ? producto.seo_keywords_en : producto.seo_keywords_es,
      marca: MARCA,
      imagen_principal: principal!.src,
      galeria: resto.map(imagen => imagen.src),
      alt_imagen: en ? principal!.alt_en : principal!.alt_es,
      galeria_alt: producto.imagenes.map(imagen => (en ? imagen.alt_en : imagen.alt_es)),
      imagen_ancho: principal!.ancho,
      imagen_alto: principal!.alto,
      ficha_pdf: null,
      tipo_comercial: 'equipo',
      fulfillment_mode: 'cotizacion',
      precio: null,
      moneda: 'COP',
      sku: producto.sku,
      stock: null,
      disponible: true,
      destacado: true,
      nuevo: true,
      activo: true,
      orden: producto.orden,
    };
  });
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values: string[]): string {
  if (values.length === 0) return `'{}'::text[]`;
  return `ARRAY[${values.map(sqlText).join(', ')}]::text[]`;
}

/** SQL idempotente para tipos y los 9 productos. Lo aplica la migración y el CMS. */
export function sqlZuowei(): string {
  const tipos = ZUOWEI_TIPOS.map(
    tipo =>
      `(${sqlText(tipo.id)}::uuid, ${sqlText(tipo.familia_id)}::uuid, ${sqlText(tipo.slug)}, ${sqlText(tipo.nombre_es)}, ${sqlText(tipo.nombre_en)}, ${tipo.orden}, true)`
  ).join(',\n');

  const productos = ZUOWEI_PRODUCTOS.map(producto => {
    const principal = producto.imagenes[0]!;
    const galeria = producto.imagenes.slice(1).map(imagen => imagen.src);
    const atributos = {
      marca: MARCA,
      fabricante: FABRICANTE,
      beneficios_es: producto.beneficios_es,
      beneficios_en: producto.beneficios_en,
      valor_es: null,
      valor_en: null,
      preguntas_frecuentes_es: [],
      preguntas_frecuentes_en: [],
      seo_keywords_es: producto.seo_keywords_es,
      seo_keywords_en: producto.seo_keywords_en,
      alt_imagen_es: principal.alt_es,
      alt_imagen_en: principal.alt_en,
      galeria_alt_es: producto.imagenes.map(imagen => imagen.alt_es),
      galeria_alt_en: producto.imagenes.map(imagen => imagen.alt_en),
      imagen_ancho: principal.ancho,
      imagen_alto: principal.alto,
      especificaciones_en: producto.especificaciones_en,
      linea: 'zuowei-2026-10',
    };
    return `(
      ${sqlText(producto.id)}::uuid,
      ${sqlText(producto.slug)},
      ${sqlText(producto.sku)},
      ${sqlText(producto.familia_id)}::uuid,
      ${sqlText(producto.tipo_id)}::uuid,
      ${sqlText(producto.nombre_es)},
      ${sqlText(producto.nombre_en)},
      ${sqlText(producto.descripcion_corta_es)},
      ${sqlText(producto.descripcion_corta_en)},
      ${sqlText(producto.descripcion_larga_es)},
      ${sqlText(producto.descripcion_larga_en)},
      ${sqlJson(producto.especificaciones)},
      ${sqlTextArray(producto.aplicaciones_es)},
      ${sqlTextArray(producto.aplicaciones_en)},
      ${sqlText(principal.src)},
      ${sqlTextArray(galeria)},
      ${sqlJson(atributos)},
      'equipo',
      'cotizacion',
      NULL, NULL, NULL, 'COP',
      NULL, false, true, true, true, true,
      ${producto.orden}
    )`;
  }).join(',\n');

  return `-- Catálogo Zuowei: 9 modelos, precio bajo cotización, nuevo y destacado.
INSERT INTO tipos (id, familia_id, slug, nombre_es, nombre_en, orden, activo)
VALUES
${tipos}
ON CONFLICT (familia_id, slug) DO UPDATE SET
  nombre_es = EXCLUDED.nombre_es,
  nombre_en = EXCLUDED.nombre_en,
  orden = EXCLUDED.orden,
  activo = true;

INSERT INTO productos (
  id, slug, sku, familia_id, tipo_id,
  nombre_es, nombre_en,
  descripcion_corta_es, descripcion_corta_en,
  descripcion_larga_es, descripcion_larga_en,
  especificaciones, aplicaciones_es, aplicaciones_en,
  imagen_principal, galeria, atributos,
  tipo_comercial, fulfillment_mode,
  precio, precio_regular, precio_oferta, moneda,
  stock, gestionar_stock, disponible, destacado, nuevo, activo, orden
) VALUES
${productos}
ON CONFLICT (slug) DO UPDATE SET
  sku = EXCLUDED.sku,
  familia_id = EXCLUDED.familia_id,
  tipo_id = EXCLUDED.tipo_id,
  nombre_es = EXCLUDED.nombre_es,
  nombre_en = EXCLUDED.nombre_en,
  descripcion_corta_es = EXCLUDED.descripcion_corta_es,
  descripcion_corta_en = EXCLUDED.descripcion_corta_en,
  descripcion_larga_es = EXCLUDED.descripcion_larga_es,
  descripcion_larga_en = EXCLUDED.descripcion_larga_en,
  especificaciones = EXCLUDED.especificaciones,
  aplicaciones_es = EXCLUDED.aplicaciones_es,
  aplicaciones_en = EXCLUDED.aplicaciones_en,
  imagen_principal = EXCLUDED.imagen_principal,
  galeria = EXCLUDED.galeria,
  atributos = COALESCE(productos.atributos, '{}'::jsonb) || EXCLUDED.atributos,
  tipo_comercial = EXCLUDED.tipo_comercial,
  fulfillment_mode = EXCLUDED.fulfillment_mode,
  precio = NULL,
  precio_regular = NULL,
  precio_oferta = NULL,
  moneda = EXCLUDED.moneda,
  stock = NULL,
  gestionar_stock = false,
  disponible = true,
  destacado = true,
  nuevo = true,
  activo = true,
  orden = EXCLUDED.orden;
`;
}
