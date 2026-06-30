import type { Locale } from '../i18n/utils';
import type { Familia, Producto } from './datos';

export interface FamiliaPrincipal {
  slug: string;
  nombre: string;
  descripcion: string;
  icono: string;
  subfamilias: Familia[];
}

const PRINCIPALES = [
  {
    slug: 'diagnostico-monitoreo',
    icono: 'activity',
    es: 'Diagnóstico y monitoreo',
    en: 'Diagnostics & monitoring',
    descEs: 'Monitoreo, cardiología, ultrasonido, radiología e imagen diagnóstica.',
    descEn: 'Monitoring, cardiology, ultrasound, radiology and diagnostic imaging.',
    subfamilias: ['monitores', 'cardiologia', 'ultrasonido', 'radiologia', 'imagenologia'],
  },
  {
    slug: 'terapia-soporte-vital',
    icono: 'wind',
    es: 'Terapia y soporte vital',
    en: 'Therapy & life support',
    descEs: 'Anestesia, ventilación, terapia IV y soporte respiratorio.',
    descEn: 'Anesthesia, ventilation, IV therapy and respiratory support.',
    subfamilias: ['anestesia', 'soluciones-iv', 'neonatologia'],
  },
  {
    slug: 'quirofano-cuidado-critico',
    icono: 'scissors',
    es: 'Quirófano y cuidado crítico',
    en: 'OR & critical care',
    descEs: 'Equipamiento para cirugía, UCI, urgencias y neonatología.',
    descEn: 'Equipment for surgery, ICU, emergency care and neonatology.',
    subfamilias: ['sala-cirugia', 'anestesia', 'monitores', 'neonatologia'],
  },
  {
    slug: 'infraestructura-clinica',
    icono: 'bed',
    es: 'Infraestructura clínica',
    en: 'Clinical infrastructure',
    descEs: 'Mobiliario, camas, camillas, carros y apoyo operativo hospitalario.',
    descEn: 'Furniture, beds, stretchers, carts and hospital operational support.',
    subfamilias: ['mobiliario'],
  },
] as const;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function contiene(texto: string, palabras: string[]): boolean {
  return palabras.some(p => texto.includes(p));
}

function canonicalFamiliaSlug(slug: string): string {
  const aliases: Record<string, string> = {
    'cardiolog-a': 'cardiologia',
    'neonatolog-a': 'neonatologia',
    'radiolog-a-y-diagn-stico-por-imagen': 'radiologia',
    'mobiliario-clinico': 'mobiliario',
    'monitorizacion-diagnostico': 'monitores',
    'control-y-prevenci-n': 'monitores',
    'equipamiento-clinico-general': 'mobiliario',
    'terapia-infusion': 'soluciones-iv',
    'terapia-respiratoria-soporte-vital': 'anestesia',
    'quirofano-anestesia': 'sala-cirugia',
    'nebulizacion-oxigenoterapia': 'anestesia',
  };
  return aliases[slug] ?? slug;
}

export function getCatalogoTaxonomia(
  familias: Familia[],
  locale: Locale,
  familiasConProductos?: Set<string>
): FamiliaPrincipal[] {
  const familiasVisibles = familiasConProductos
    ? familias.filter(f => familiasConProductos.has(f.slug))
    : familias;
  const porSlug = new Map(familiasVisibles.map(f => [f.slug, f]));
  const usadas = new Set<string>();

  const principales: FamiliaPrincipal[] = PRINCIPALES.map((grupo): FamiliaPrincipal => {
    const subfamilias = grupo.subfamilias
      .map(slug => porSlug.get(slug))
      .filter((familia): familia is Familia => Boolean(familia));
    subfamilias.forEach(f => usadas.add(f.slug));
    return {
      slug: grupo.slug,
      nombre: locale === 'en' ? grupo.en : grupo.es,
      descripcion: locale === 'en' ? grupo.descEn : grupo.descEs,
      icono: grupo.icono,
      subfamilias,
    };
  }).filter(grupo => grupo.subfamilias.length > 0);

  const sinGrupo = familiasVisibles.filter(f => !usadas.has(f.slug));
  if (sinGrupo.length > 0) {
    principales.push({
      slug: 'otras-especialidades',
      nombre: locale === 'en' ? 'Other specialties' : 'Otras especialidades',
      descripcion:
        locale === 'en' ? 'Additional biomedical product lines.' : 'Líneas biomédicas adicionales.',
      icono: 'activity',
      subfamilias: sinGrupo,
    });
  }

  return principales;
}

export function getFamiliasFiltro(producto: Producto): string[] {
  const slugs = new Set<string>([canonicalFamiliaSlug(producto.familia_slug)]);
  const texto = normalizar(
    [
      producto.nombre,
      producto.descripcion_corta,
      producto.descripcion_larga,
      producto.fulfillment_mode,
      producto.tipo_comercial,
      JSON.stringify(producto.especificaciones ?? []),
    ].join(' ')
  );

  if (contiene(texto, ['monitor', 'signos vitales', 'uci', 'transporte'])) slugs.add('monitores');
  if (contiene(texto, ['ecg', 'electrocard', 'desfibril', 'holter', 'cardiac', 'cardio'])) {
    slugs.add('cardiologia');
  }
  if (contiene(texto, ['neonat', 'fetal', 'incubadora', 'cuna de calor', 'cpap'])) {
    slugs.add('neonatologia');
  }
  if (contiene(texto, ['anestesia', 'ventilador', 'ventilation', 'respiratorio'])) {
    slugs.add('anestesia');
  }
  if (contiene(texto, ['infusion', 'infusion', 'jeringa', 'bomba'])) slugs.add('soluciones-iv');
  if (contiene(texto, ['quirofano', 'quirurg', 'surgical', 'operatoria', 'cialitica'])) {
    slugs.add('sala-cirugia');
  }
  if (contiene(texto, ['cama', 'camilla', 'carro', 'mesa auxiliar', 'mobiliario'])) {
    slugs.add('mobiliario');
  }
  if (contiene(texto, ['ecogra', 'ultrason', 'doppler'])) slugs.add('ultrasonido');
  if (contiene(texto, ['rx', 'radiograf', 'radiolog', 'fluoroscop', 'mamograf', 'arco c'])) {
    slugs.add('radiologia');
    slugs.add('imagenologia');
  }

  for (const grupo of PRINCIPALES) {
    if (grupo.subfamilias.some(slug => slugs.has(slug))) slugs.add(grupo.slug);
  }

  return [...slugs].filter(Boolean);
}
