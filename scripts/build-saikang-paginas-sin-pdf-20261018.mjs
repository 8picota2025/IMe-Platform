#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const hall = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'docs/audits/fichas-faltantes-2026-10-18/hallazgos-saikang-v2.json'),
    'utf8'
  )
);
const mock = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mock-productos.json'), 'utf8'));
const withPdf = new Set(mock.filter((p) => p.ficha_pdf).map((p) => p.slug));

const isPriority = (slug, nombre) => {
  const s = `${slug} ${nombre}`.toLowerCase();
  return /cama|bed|camilla|stretcher|trolley|carro|mesa.?quir|operating|traslado|hospitalaria|manual-bed|electric-bed|treatment-trolley|case-history|transportation/.test(
    s
  );
};

const candidates = hall.items
  .filter((i) => i.pagina_fabricante && !withPdf.has(i.slug))
  .filter((i) => isPriority(i.slug, i.nombre_es))
  .slice(0, 25);

function spec(clave, valor, grupo = 'Página fabricante (Saikang)') {
  return { grupo, clave, valor };
}

function faqEs(nombre, modelo, url, specsSummary, aplicaciones) {
  return [
    {
      q: `¿Qué producto es ${nombre}?`,
      a: `Equipo Saikang en catálogo IME Colombia. Referencia oficial del fabricante: ${url}.`,
    },
    {
      q: '¿Qué datos técnicos publica Saikang en su página?',
      a: specsSummary || 'La página consultada no mostró tabla de parámetros; solicite confirmación a IME.',
    },
    {
      q: '¿Hay ficha PDF en IME?',
      a: 'Este landing se enriquece con la página del fabricante; IME puede confirmar PDF al cotizar.',
    },
    {
      q: '¿Aplicaciones habituales?',
      a: aplicaciones.length ? aplicaciones.join('; ') : 'Según área clínica y evaluación hospitalaria.',
    },
    {
      q: '¿Cómo cotizar con IME Colombia?',
      a: `Indique el modelo ${modelo} y el uso clínico; IME valida referencia Saikang y disponibilidad.`,
    },
  ];
}

function faqEn(nombre, modelo, url, specsSummary, aplicaciones) {
  return [
    {
      q: `What is ${nombre}?`,
      a: `Saikang device in the IME Colombia catalog. Manufacturer page: ${url}.`,
    },
    {
      q: 'What specs does Saikang publish on its product page?',
      a: specsSummary || 'The consulted page had no parameter table; confirm with IME.',
    },
    {
      q: 'Is there a PDF datasheet on IME?',
      a: 'This landing uses the manufacturer page; IME can confirm PDF when quoting.',
    },
    {
      q: 'Typical applications?',
      a: aplicaciones.length ? aplicaciones.join('; ') : 'Per clinical area and hospital evaluation.',
    },
    {
      q: 'How to quote with IME Colombia?',
      a: `Provide model ${modelo} and clinical use; IME validates Saikang reference and availability.`,
    },
  ];
}

function buildEntry(meta) {
  const {
    sku,
    slug,
    nombreIme,
    nombrePagina,
    codigos,
    url,
    categoria,
    highlights,
    specs,
    config,
    aplicaciones,
    introExtra,
  } = meta;

  const specLines = specs.map((s) => `${s.clave}: ${s.valor}`);
  const configLines = config.map((c) => `${c.clave}: ${c.valor}`);
  const specsSummary = [...specLines, ...configLines].slice(0, 8).join('; ');

  const descripcion_es = [
    `${nombreIme} (Saikang) en catálogo IME Colombia para instituciones de salud.`,
    introExtra || '',
    nombrePagina ? `Según la página oficial Saikang: ${nombrePagina}.` : '',
    categoria ? `Categoría en sitio fabricante: ${categoria}.` : '',
    codigos.length ? `Códigos visibles en fabricante: ${codigos.join(', ')}.` : '',
    specLines.length
      ? `Parámetros publicados: ${specLines.join('; ')}.`
      : 'Parámetros: consulte la página del fabricante (sin tabla visible al momento del enriquecimiento).',
    configLines.length ? `Configuración declarada: ${configLines.join('; ')}.` : '',
    `Referencia: ${url}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const descripcion_en = [
    `${nombreIme} (Saikang) in the IME Colombia catalog for healthcare institutions.`,
    introExtra ? introExtra.replace(/Según/g, 'Per') : '',
    nombrePagina ? `Per Saikang official page: ${nombrePagina}.` : '',
    categoria ? `Manufacturer site category: ${categoria}.` : '',
    codigos.length ? `Codes on manufacturer page: ${codigos.join(', ')}.` : '',
    specLines.length
      ? `Published parameters: ${specLines.join('; ')}.`
      : 'Parameters: see manufacturer page (no table visible at enrichment time).',
    configLines.length ? `Declared configuration: ${configLines.join('; ')}.` : '',
    `Reference: ${url}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const beneficios_es = highlights.length
    ? highlights
    : specLines.slice(0, 4).map((l) => `Dato fabricante: ${l}`);

  const keywords_es = [
    nombreIme,
    `${nombreIme} Saikang`,
    ...codigos.map((c) => `${c} Saikang`),
    'equipo médico Colombia',
    'IME Colombia',
    'Saikang',
  ].filter((v, i, a) => a.indexOf(v) === i);

  const keywords_en = [
    nombreIme,
    `${nombreIme} Saikang`,
    'medical equipment Colombia',
    'IME Colombia',
  ];

  const especificaciones = [
    spec('Fabricante', 'Saikang', 'Identificación'),
    spec('Modelo IME / SKU', sku, 'Identificación'),
    ...codigos.map((c) => spec('Código Saikang (página)', c, 'Identificación')),
    ...specs,
    ...config.map((c) => spec(c.clave, c.valor, 'Configuración (página Saikang)')),
  ];

  return {
    sku,
    slug,
    descripcion_larga_es: descripcion_es,
    descripcion_larga_en: descripcion_en,
    beneficios_es,
    beneficios_en: beneficios_es,
    valor_es: `${nombreIme} (Saikang) — contenido SEO desde página oficial, sin PDF en mock IME.`,
    valor_en: `${nombreIme} (Saikang) — SEO content from official page, no PDF in IME mock.`,
    aplicaciones_es: aplicaciones,
    aplicaciones_en: aplicaciones,
    faq_es: faqEs(nombreIme, sku, url, specsSummary, aplicaciones),
    faq_en: faqEn(nombreIme, sku, url, specsSummary, aplicaciones),
    seo_keywords_es: keywords_es,
    seo_keywords_en: keywords_en,
    especificaciones,
    append_descripcion: false,
  };
}

/** Page facts captured 2026-10-18 from saikangmedical.com product pages */
const PAGE = {
  'cama-de-hospital-ref-sk-c1-saikang': {
    nombrePagina: 'K2k MANUAL BED (SK-C1)',
    codigos: ['K2k', 'SK-C1'],
    categoria: 'Manual Hospital Bed',
    highlights: [
      'Plataforma metálica estampada; carga de trabajo segura 200 kg (página Saikang)',
      'Dos manivelas retráctiles para respaldo y rodillas',
      'Ruedas cubiertas de 5" y barandillas plegables',
    ],
    specs: [
      spec('Tamaño externo (L×W)', '2160×980 mm±10 mm'),
      spec('Plataforma colchón', '1930×830 mm'),
      spec('Carga de trabajo segura', '200 kg'),
      spec('Altura', '505 mm'),
      spec('Respaldo', '0-80° (±10°)'),
      spec('Rodillas', '0-35° (±10°)'),
    ],
    config: [
      spec('Manual Cranks', '2 pcs'),
      spec('5" Covered Castors', '4 pcs'),
      spec('Foldable Side Rail', '1 set'),
      spec('PP Bed Ends with Safe Lock', '1 set'),
    ],
    aplicaciones: ['Hospitalización', 'Ward general'],
  },
  'cama-manual-v4w-ref-sk-cd1-v4w-saikang': {
    nombrePagina: 'V4W MANUAL BED (SK-CF1)',
    codigos: ['V4W', 'SK-CF1'],
    categoria: 'Four-Crank Manual Hospital Bed',
    highlights: [
      'Plataforma PP integrada de 4-5 secciones (página Saikang)',
      'Cuatro manivelas: respaldo, rodillas, altura, Trendelenburg',
      'Barandilla L plegable con ProErgo-Handle',
    ],
    specs: [
      spec('Tamaño externo (L×W)', '2130×1020 mm'),
      spec('Plataforma colchón', '1925×900 mm'),
      spec('Carga de trabajo segura', '200 kg'),
      spec('Altura', '475-725 mm'),
      spec('Respaldo', '0-70° (±5°)'),
      spec('Rodillas', '0-38° (±5°)'),
      spec('Trendelenburg', '0-12°'),
      spec('Trendelenburg inverso', '0-12°'),
    ],
    config: [
      spec('Manual Crank', '4 pcs'),
      spec('5" Hardshell Castors', '4 pcs'),
      spec('IV pole 4 hooks', '1 set'),
    ],
    aplicaciones: ['Hospitalización', 'Postoperatorio'],
  },
  'cama-hospitalaria-manual-ref-v4w-saikang': {
    reuse: 'cama-manual-v4w-ref-sk-cd1-v4w-saikang',
  },
  'cama-de-atencion-pediatrica-z0n-ref-skd-a-z0n-saikang': {
    nombrePagina: 'CQ8k ELECTRIC CHILDREN BED (SKD-C)',
    codigos: ['CQ8k', 'SKD-C'],
    categoria: 'Electric Children Bed / Pediatric',
    introExtra:
      'En IME la referencia comercial es Z0N; la página Saikang enlazada describe la serie CQ8k (SKD-C). Confirme equivalencia al cotizar.',
    highlights: [
      'Cama eléctrica pediátrica CQ8k con motor lineal (página Saikang)',
      'Cabecero/piecero PP y barandilla acero inoxidable',
      'Control manual en mango con cable espiral',
    ],
    specs: [
      spec('Tamaño externo (L×W×H)', '1975×880×465-760 mm'),
      spec('Plataforma colchón', '1730×780 mm'),
      spec('Carga de trabajo segura', '200 kg'),
      spec('Respaldo', '0-75° (±5°)'),
      spec('Rodillas', '0-35° (±5°)'),
      spec('Trendelenburg', '0-12°'),
      spec('Trendelenburg inverso', '0-12°'),
    ],
    config: [
      spec('Linear motor', '4 pcs'),
      spec('5" castors central locking', '4 pcs'),
      spec('IV pole', '1 set'),
    ],
    aplicaciones: ['Pediatría', 'Hospital infantil'],
  },
  'cama-de-atencion-domiciliaria-ref-hb421-saikang': {
    nombrePagina: 'Atención domiciliaria VIP (listado categoría)',
    codigos: ['HB421'],
    categoria: 'Camas de hospital — Atención domiciliaria VIP',
    introExtra:
      'La URL de categoría Saikang (móvil) no respondió al fetch 2026-10-18; no se extrajeron parámetros. Modelo HB421 según catálogo IME.',
    highlights: ['Cama domiciliaria VIP Saikang — referencia HB421 en catálogo IME'],
    specs: [],
    config: [],
    aplicaciones: ['Atención domiciliaria'],
  },
  'cama-de-atencion-domiciliaria-ref-hb422-saikang': {
    reuse: 'cama-de-atencion-domiciliaria-ref-hb421-saikang',
    codigos: ['HB422'],
    introExtra:
      'La URL de categoría Saikang no respondió al fetch 2026-10-18. Modelo HB422 según catálogo IME.',
  },
  'cama-de-atencion-domiciliaria-ref-hb424-saikang': {
    reuse: 'cama-de-atencion-domiciliaria-ref-hb421-saikang',
    codigos: ['HB424'],
    introExtra:
      'La URL de categoría Saikang no respondió al fetch 2026-10-18. Modelo HB424 según catálogo IME.',
  },
  'cama-de-atencion-domiciliaria-vip-h6k-ref-skd-d-h6k-saikang': {
    nombrePagina: 'K6k ELECTRIC BED (SKD-D)',
    codigos: ['K6k', 'SKD-D'],
    categoria: 'Electric Hospital Bed',
    introExtra:
      'En IME la referencia es H6k VIP; la página Saikang publica K6k (SKD-D). Confirme equivalencia al cotizar.',
    highlights: [
      'Plataforma troquelada robot-soldada; carga 200 kg',
      'Motores lineales (3) y control manual',
      'Retenedor de colchón ABS y ganchos de drenaje integrados',
    ],
    specs: [
      spec('Tamaño externo (L×W)', '2105×980 mm'),
      spec('Plataforma colchón', '1925×820±10 mm'),
      spec('Carga de trabajo segura', '200 kg'),
      spec('Altura', '400-710 mm±10'),
      spec('Respaldo', '0-84° (±10°)'),
      spec('Rodillas', '0-47° (±10°)'),
      spec('Voltaje', '100-240 V'),
      spec('Frecuencia', '50/60 Hz'),
    ],
    config: [
      spec('Linear Motor', '3 pcs'),
      spec('Hand Controller', '1 pc'),
      spec('5" Covered Castors', '4 pcs'),
    ],
    aplicaciones: ['Atención domiciliaria', 'Hospitalización'],
  },
  'carro-de-enfermeria-ref-skr058-ct-saikang': {
    nombrePagina: 'SKR058-CT NURSING TROLLEY',
    codigos: ['SKR058-CT'],
    categoria: 'Nursing Trolley / Medication Distribution Cart',
    highlights: [
      'Material ABS antibacteriano según página Saikang',
      'Mesas de trabajo plegables 340×250 mm',
      'Cerradura central en todos los cajones',
    ],
    specs: [
      spec('Tamaño externo (L×W×H)', '965×610×1100 mm'),
      spec('Work board size', '340×250 mm'),
      spec('Upper left drawer size', '440×75 mm'),
      spec('Lower left drawer size', '440×160 mm'),
    ],
    config: [
      spec('Work board', '1 pc'),
      spec('Drawer divider system', '1 set'),
      spec('Silent directional castors', '4 pcs'),
    ],
    aplicaciones: ['Enfermería', 'Distribución de medicamentos'],
  },
  'carro-abs-skr-ref-ct750-1-saikang': {
    nombrePagina: 'SKR-CT750-1 Treatment Trolley (URL audit)',
    codigos: ['SKR-CT750-1'],
    categoria: 'Medical Trolley',
    introExtra:
      'La URL del audit (skr-ct750-1-treatment-trolley) devolvió HTTP 404 el 2026-10-18; no se importaron datos de otros modelos Saikang.',
    highlights: ['Carro de tratamiento ABS Saikang — referencia SKR-CT750-1 en IME'],
    specs: [],
    config: [],
    aplicaciones: ['Enfermería', 'Tratamiento'],
  },
  'cama-hospitalaria-electrica-ref-skd-a-saikang': {
    nombrePagina: 'SKD-A Electric Hospital Bed',
    codigos: ['SKD-A'],
    categoria: 'Electric Hospital Bed',
    highlights: [
      'Motores LINAK (4) y bloqueo central de ruedas',
      'Barandillas PP Grace con indicador de ángulo',
      'CPR manual y pedal de bloqueo central',
    ],
    specs: [
      spec('Tamaño externo (L×W×H)', '2280×1090×435-725 mm±10'),
      spec('Plataforma colchón (L×W)', '1920×900±10 mm'),
      spec('Respaldo', '75°±10°'),
      spec('Rodillas', '35°±10°'),
      spec('Trendelenburg inverso', '12°±2°'),
      spec('Trendelenburg', '12°±2°'),
    ],
    config: [
      spec('LINAK Motor', '4 pcs'),
      spec('5" Double Side Castors, Central Locking', '4 pcs'),
      spec('Hand Controller', '1 pc'),
    ],
    aplicaciones: ['Hospitalización', 'Cuidados generales'],
  },
  'cama-hospitalaria-electrica-ref-skd-b-saikang': {
    nombrePagina: 'SKD-B Electric Hospital Bed',
    codigos: ['SKD-B'],
    reuse: 'cama-hospitalaria-electrica-ref-skd-a-saikang',
    highlights: [
      'Motores LINAK (4) — misma tabla de parámetros publicada que SKD-A en sitio Saikang',
      'Barandillas PP Grace con indicador de ángulo',
    ],
  },
  'carro-clinico-ref-skr021-5-saikang': {
    nombrePagina: 'SKR021-5 CASE HISTORY TROLLEY',
    codigos: ['SKR021-5'],
    categoria: 'Case History Trolley',
    highlights: [
      'Cuerpo ABS; columna de acero pintado',
      'Cerradura central y 50 portadores para historias',
      'Ruedas silenciosas con 2 frenos',
    ],
    specs: [spec('Tamaño (L×W×H)', '750×410×895 mm')],
    config: [
      spec('Drawer', '2 pcs'),
      spec('Castor', '4 pcs'),
    ],
    aplicaciones: ['Archivo clínico', 'Enfermería'],
  },
  'cama-hospitalaria-ref-sk-a2-saikang': {
    nombrePagina: 'SK-A2 Hospital Bed',
    codigos: ['SK-A2'],
    categoria: 'Hospital Bed',
    highlights: [
      'Incluye bassinet, mosquitero y canasta utilitaria (página Saikang)',
      'Ruedas 4" (100 mm) y poste para suero',
    ],
    specs: [
      spec('Tamaño externo (L×W×H)', '810×520×990 mm'),
      spec('Trendelenburg', '0-18°'),
    ],
    config: [
      spec('Bassinet', '1 pc'),
      spec('4"(100mm) Castors', '4 pcs'),
      spec('IV Pole', '1 set'),
    ],
    aplicaciones: ['Ward general'],
  },
  'cama-hospitalaria-ref-sk-a3-saikang': {
    nombrePagina: 'SK-A3 Hospital Bed',
    codigos: ['SK-A3'],
    categoria: 'Three Crank Manual Hospital Bed',
    highlights: [
      'Cama manual de tres manivelas según titular Saikang',
      'Misma tabla de parámetros publicada que SK-A2 en sitio consultado',
    ],
    specs: [
      spec('Tamaño externo (L×W×H)', '810×520×990 mm'),
      spec('Trendelenburg', '0-18°'),
    ],
    config: [
      spec('Bassinet', '1 pc'),
      spec('4"(100mm) Castors', '4 pcs'),
    ],
    aplicaciones: ['Hospitalización'],
  },
  'camilla-de-traslado-ref-skk-b-saikang': {
    nombrePagina: 'SKK-B Patient Transportation Trolley',
    codigos: ['SKK-B'],
    categoria: 'Patient Transportation Trolley',
    highlights: [
      'Tablero dorsal HPL con pinza para radiografía',
      'Frenos centrales y quinta rueda direccional',
      'Capacidad estática 250 kg / dinámica 135 kg',
    ],
    specs: [
      spec('Dimensiones', 'L 2120 × W 840 × H 590-900 mm ±10'),
      spec('Respaldo', '0-85° ±5°'),
      spec('Piernas', '0-30° ±5°'),
      spec('Trendelenburg inverso', '0-15° ±2°'),
      spec('Trendelenburg', '0-15° ±2°'),
      spec('Carga estática', '250 kg'),
      spec('Carga dinámica', '135 kg'),
    ],
    config: [
      spec('8-inch Central Control Casters', '4 pcs'),
      spec('Hydraulic Pumps', '2 pcs'),
      spec('Stainless Steel Infusion Pole', '1 pc'),
    ],
    aplicaciones: ['Traslado de pacientes', 'Radiología'],
  },
  'mesa-quirurgica-electrica-ref-skl-c-saikang': {
    nombrePagina: 'SKL-C Electric Operating Table | Delivery Bed',
    codigos: ['SKL-C'],
    categoria: 'Operating Room / Delivery Bed',
    highlights: [
      'Mesa eléctrica / camilla de parto según titular Saikang',
      'Submarca SKsurgitech para equipamiento obstétrico (mención en página)',
    ],
    specs: [],
    config: [],
    aplicaciones: ['Quirófano', 'Obstetricia'],
  },
  'mesa-quirurgica-electrica-ref-skl-d-saikang': {
    nombrePagina: 'SKL-D Electric Operating Table | Delivery Bed',
    codigos: ['SKL-D'],
    categoria: 'Operating Room / Delivery Bed',
    highlights: ['Mesa eléctrica SKL-D — titular oficial Saikang'],
    specs: [],
    config: [],
    aplicaciones: ['Quirófano', 'Obstetricia'],
  },
  'mesa-quirurgica-electrica-ref-skl-e-saikang': {
    nombrePagina: 'SKL-E Electric Operating Table',
    codigos: ['SKL-E'],
    categoria: 'Electric Operating Table',
    highlights: ['Mesa quirúrgica eléctrica SKL-E según página Saikang'],
    specs: [],
    config: [],
    aplicaciones: ['Quirófano'],
  },
};

const sources = [];
const enriched = [];

for (const item of candidates) {
  const base = PAGE[item.slug];
  if (!base) {
    console.warn('Missing PAGE data for', item.slug);
    continue;
  }
  let meta = { ...base };
  if (base.reuse) {
    const parent = PAGE[base.reuse];
    meta = { ...parent, ...base, reuse: undefined };
  }
  delete meta.reuse;

  const entry = buildEntry({
    sku: item.ref_hint,
    slug: item.slug,
    nombreIme: item.nombre_es,
    url: item.pagina_fabricante,
    ...meta,
  });
  enriched.push(entry);

  sources.push({
    slug: item.slug,
    sku: item.ref_hint,
    pagina_fabricante: item.pagina_fabricante,
    titulo_pagina: meta.nombrePagina,
    codigos: meta.codigos,
    fetch_ok: meta.specs.length > 0 || (meta.highlights?.length > 1 && !(meta.introExtra || '').includes('404')),
    notas: meta.introExtra || null,
  });
}

const outPath = path.join(
  ROOT,
  'src/data/fichas-enriquecimiento/saikang-paginas-sin-pdf-20261018.json'
);
fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2) + '\n');

const notesPath = path.join(
  ROOT,
  'docs/audits/fichas-faltantes-2026-10-18/enrich-saikang-pages-notes.json'
);
fs.writeFileSync(
  notesPath,
  JSON.stringify(
    {
      fecha: '2026-10-18',
      archivo: 'src/data/fichas-enriquecimiento/saikang-paginas-sin-pdf-20261018.json',
      criterio:
        'pagina_fabricante presente, sin ficha_pdf en mock-productos.json; prioridad camas/carros/camillas/mesas OR',
      enriquecidos: enriched.length,
      fuentes: sources,
    },
    null,
    2
  ) + '\n'
);

const manifestPath = path.join(ROOT, 'src/data/fichas-enriquecimiento/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const bySlug = new Map(manifest.map((m) => [m.slug, m]));

for (const item of candidates) {
  const existing = bySlug.get(item.slug);
  const row = existing || {
    slug: item.slug,
    sku: item.ref_hint,
    fabricante: 'Saikang',
    fab_slug: 'saikang',
    lang: 'es',
  };
  row.origen_local = '';
  row.url = item.pagina_fabricante;
  row.fabricante = 'Saikang';
  row.fab_slug = 'saikang';
  if (!existing) {
    manifest.push(row);
    bySlug.set(item.slug, row);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Wrote', enriched.length, 'entries to', outPath);
