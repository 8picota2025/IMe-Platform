import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number(process.env.ENRICH_LIMIT ?? 0);
const BATCH_SIZE = Number(process.env.ENRICH_BATCH_SIZE ?? 30);

const mockProductos = JSON.parse(
  readFileSync(
    '/home/shoky/Documents/I-ME/0106-ime-web-claude-design/src/data/mock-productos.json',
    'utf8'
  )
);
const mockBySlug = new Map(mockProductos.map((p) => [p.slug, p]));

const NAME_PHRASE_RULES = [
  ['sistema radiografico 3d en carga', 'weight-bearing 3D radiographic system'],
  ['sistema radiografico', 'radiographic system'],
  ['monitoreo', 'monitoring'],
  ['monitor multiparametrico', 'multi-parameter monitor'],
  ['monitor multiparametro', 'multi-parameter monitor'],
  ['monitor de transporte', 'transport monitor'],
  ['monitor central', 'central monitor'],
  ['monitor fetal', 'fetal monitor'],
  ['cuna de calor radiante', 'radiant warmer'],
  ['cuna de calor', 'radiant warmer'],
  ['incubadora neonatal de transporte', 'neonatal transport incubator'],
  ['incubadora neonatal', 'neonatal incubator'],
  ['incubadora', 'incubator'],
  ['maquina de anestesia', 'anesthesia machine'],
  ['electrocardiografo', 'electrocardiograph'],
  ['desfibrilador bifasico', 'biphasic defibrillator'],
  ['desfibrilador', 'defibrillator'],
  ['arco en c', 'C-arm'],
  ['radiografia digital', 'digital radiography'],
  ['mamografia digital', 'digital mammography'],
  ['ultrasonido diagnostico', 'diagnostic ultrasound'],
  ['ultrasonido', 'ultrasound'],
  ['bomba de infusion', 'infusion pump'],
  ['bomba de jeringa', 'syringe pump'],
  ['ventilador mecanico', 'mechanical ventilator'],
  ['ventilador', 'ventilator'],
  ['cpap/bpap', 'CPAP/BiPAP'],
  ['cpap', 'CPAP'],
  ['bpap', 'BiPAP'],
  ['oximetro', 'pulse oximeter'],
  ['tensiometro', 'blood pressure monitor'],
  ['glucometro', 'glucometer'],
  ['termometro clinico', 'clinical thermometer'],
  ['cama hospitalaria', 'hospital bed'],
  ['cama pediatrica', 'pediatric bed'],
  ['cama de atencion domiciliaria', 'home care bed'],
  ['camilla hospitalaria', 'hospital stretcher'],
  ['camilla plegable', 'folding stretcher'],
  ['camilla', 'stretcher'],
  ['silla de ruedas', 'wheelchair'],
  ['silla de evacuacion', 'evacuation chair'],
  ['muleta canadiense', 'Canadian crutch'],
  ['caminador', 'walker'],
  ['andador', 'walker'],
  ['lampara quirurgica', 'surgical light'],
  ['mesa quirurgica', 'operating table'],
  ['carro de paro', 'crash cart'],
  ['autoclave', 'autoclave'],
  ['esterilizador', 'sterilizer'],
  ['nebulizador', 'nebulizer'],
  ['regulador de oxigeno', 'oxygen regulator'],
  ['oxigenoterapia', 'oxygen therapy'],
  ['fototerapia neonatal', 'neonatal phototherapy'],
  ['reanimacion neonatal', 'neonatal resuscitation'],
  ['reanimador neonatal', 'neonatal resuscitator'],
  ['circuito', 'circuit'],
  ['humificador', 'humidifier'],
  ['humidificador', 'humidifier'],
  ['carro clinico', 'clinical cart'],
  ['carro de infusion', 'infusion cart'],
  ['carro de acero inoxidable', 'stainless steel cart'],
  ['baston', 'cane'],
  ['muletas', 'crutches'],
  ['bomba', 'pump'],
  ['equipo', 'equipment'],
  ['portatil', 'portable'],
  ['inalambrico', 'wireless'],
  ['digital', 'digital'],
  ['manual', 'manual'],
  ['electrica', 'electric'],
  ['electrico', 'electric'],
  ['motorizada', 'motorized'],
  ['motorizado', 'motorized'],
  ['neonatal', 'neonatal'],
  ['pediatrica', 'pediatric'],
  ['pediatrico', 'pediatric'],
  ['adulto', 'adult'],
  ['adulta', 'adult'],
  ['bariatrica', 'bariatric'],
  ['bariatrico', 'bariatric'],
  ['hospitalario', 'hospital'],
  ['hospitalaria', 'hospital'],
  ['clinico', 'clinical'],
  ['clinica', 'clinical'],
  ['quirurgico', 'surgical'],
  ['quirurgica', 'surgical'],
  ['diagnostico', 'diagnostic'],
  ['diagnostica', 'diagnostic'],
  ['transporte', 'transport'],
  ['traslado', 'transport'],
  ['reanimacion', 'resuscitation'],
  ['rehabilitacion', 'rehabilitation'],
  ['movilidad', 'mobility'],
  ['inmovilizacion', 'immobilization'],
  ['esterilizacion', 'sterilization'],
  ['infecciones', 'infections'],
  ['signos vitales', 'vital signs'],
  ['saturacion', 'saturation'],
  ['presion', 'pressure'],
  ['flujo', 'flow'],
  ['temperatura', 'temperature'],
  ['glucosa', 'glucose'],
  ['peso', 'weight'],
  ['color plata', 'silver'],
  ['color verde', 'green'],
  ['color blanco', 'white'],
  ['con monitor', 'with monitor'],
  ['de nueva generacion', 'next-generation'],
  ['de alta complejidad', 'for high-complexity care'],
  ['de transporte', 'transport'],
  ['para uso terrestre y aereo', 'for ground and air use'],
  ['para recien nacidos', 'for newborns'],
  ['para reanimacion', 'for resuscitation'],
  ['para pacientes criticos', 'for critical patients'],
  ['para neonatos y pediatria', 'for neonates and pediatrics'],
  ['para neonatos', 'for neonates'],
  ['para adultos', 'for adults'],
  ['para uso hospitalario', 'for hospital use'],
  ['para el tratamiento', 'for treatment'],
  ['para la toma', 'for taking'],
  ['para control', 'for monitoring'],
  ['color', 'color'],
  ['serie', 'Series'],
  ['plus', 'Plus'],
];

const LONG_PHRASE_RULES = [
  ['disenado para', 'designed for'],
  ['diseñado para', 'designed for'],
  ['diseñada para', 'designed for'],
  ['constituye', 'constitutes'],
  ['constituye un', 'constitutes a'],
  ['ofrece', 'offers'],
  ['permite', 'allows'],
  ['garantiza', 'ensures'],
  ['facilita', 'facilitates'],
  ['proporciona', 'provides'],
  ['brinda', 'provides'],
  ['ideal para', 'ideal for'],
  ['pensado para', 'intended for'],
  ['pensada para', 'intended for'],
  ['pensado para', 'intended for'],
  ['orientado a', 'oriented to'],
  ['orientada a', 'oriented to'],
  ['entorno', 'setting'],
  ['entornos', 'settings'],
  ['hospitalario', 'hospital'],
  ['hospitalaria', 'hospital'],
  ['hospitalarios', 'hospital'],
  ['hospitalarias', 'hospital'],
  ['clinico', 'clinical'],
  ['clinica', 'clinical'],
  ['clinicos', 'clinical'],
  ['clinicas', 'clinical'],
  ['paciente', 'patient'],
  ['pacientes', 'patients'],
  ['neonato', 'newborn'],
  ['neonatos', 'newborns'],
  ['recien nacido', 'newborn'],
  ['recien nacidos', 'newborns'],
  ['recien', 'new'],
  ['monitoreo', 'monitoring'],
  ['monitorea', 'monitors'],
  ['monitorizacion', 'monitoring'],
  ['temperatura', 'temperature'],
  ['presion', 'pressure'],
  ['flujo', 'flow'],
  ['humedad', 'humidity'],
  ['oxigeno', 'oxygen'],
  ['aire', 'air'],
  ['gas', 'gas'],
  ['ventilacion', 'ventilation'],
  ['respiratorio', 'respiratory'],
  ['respiratoria', 'respiratory'],
  ['reanimacion', 'resuscitation'],
  ['resucitacion', 'resuscitation'],
  ['transporte', 'transport'],
  ['traslado', 'transport'],
  ['segura', 'safe'],
  ['seguro', 'safe'],
  ['precisa', 'precise'],
  ['preciso', 'precise'],
  ['eficiente', 'efficient'],
  ['versatil', 'versatile'],
  ['portatil', 'portable'],
  ['ergonomico', 'ergonomic'],
  ['ergonomica', 'ergonomic'],
  ['confortable', 'comfortable'],
  ['robusto', 'robust'],
  ['robusta', 'robust'],
  ['control', 'control'],
  ['controlada', 'controlled'],
  ['controlado', 'controlled'],
  ['sistema', 'system'],
  ['equipo', 'equipment'],
  ['dispositivo', 'device'],
  ['dispositivos', 'devices'],
  ['circuito', 'circuit'],
  ['interfaz', 'interface'],
  ['accesorio', 'accessory'],
  ['accesorios', 'accessories'],
  ['consumibles', 'consumables'],
  ['consumible', 'consumable'],
  ['mantenimiento', 'maintenance'],
  ['calibracion', 'calibration'],
  ['instalacion', 'installation'],
  ['garantia', 'warranty'],
  ['soporte', 'support'],
  ['cotizacion', 'quotation'],
  ['cotización', 'quotation'],
  ['ficha tecnica', 'technical sheet'],
  ['ficha', 'sheet'],
  ['uso', 'use'],
  ['uso medico', 'medical use'],
  ['uso institucional', 'institutional use'],
  ['uso hospitalario', 'hospital use'],
  ['uso neonatal', 'neonatal use'],
  ['uso pediatrico', 'pediatric use'],
  ['uso adulto', 'adult use'],
  ['para', 'for'],
  ['con', 'with'],
  ['de', 'of'],
  ['y', 'and'],
  ['en', 'in'],
];

const SHORT_PHRASE_RULES = [
  ['de nueva generacion', 'next-generation'],
  ['para uso terrestre y aereo', 'for ground and air use'],
  ['para uso hospitalario', 'for hospital use'],
  ['para recien nacidos', 'for newborns'],
  ['para pacientes criticos', 'for critical patients'],
  ['de alta complejidad', 'for high-complexity care'],
  ['de transporte', 'transport'],
  ['con bateria', 'with battery'],
  ['con monitor', 'with monitor'],
  ['con impresora', 'with printer'],
  ['con wifi', 'with Wi-Fi'],
  ['portatil', 'portable'],
  ['manual', 'manual'],
  ['electrica', 'electric'],
  ['electrico', 'electric'],
  ['digital', 'digital'],
  ['inalambrico', 'wireless'],
  ['multiparametrico', 'multi-parameter'],
  ['multiparametro', 'multi-parameter'],
  ['neonatal', 'neonatal'],
  ['pediatrico', 'pediatric'],
  ['pediatrica', 'pediatric'],
  ['adulto', 'adult'],
  ['adulta', 'adult'],
  ['quirurgica', 'surgical'],
  ['quirurgico', 'surgical'],
  ['hospitalaria', 'hospital'],
  ['hospitalario', 'hospital'],
  ['clinica', 'clinical'],
  ['clinico', 'clinical'],
  ['para', 'for'],
  ['de', 'of'],
  ['y', 'and'],
];

const ACRO_MAP = new Map([
  ['cpap', 'CPAP'],
  ['bpap', 'BiPAP'],
  ['spo2', 'SpO2'],
  ['icu', 'ICU'],
  ['uci', 'ICU'],
  ['urpa', 'PACU'],
  ['dr', 'DR'],
  ['wr-3d', 'WR-3D'],
  ['wr-2d', 'WR-2D'],
  ['wr-1d', 'WR-1D'],
]);

const PRODUCT_APP_MAP = [
  {
    match: ['incubadora', 'cuna de calor', 'fototerapia', 'neonatal'],
    es: ['Neonatología', 'UCIN', 'Cuidado neonatal'],
    en: ['Neonatology', 'NICU', 'Neonatal care'],
  },
  {
    match: ['transporte neonatal', 'incubadora neonatal de transporte'],
    es: ['Transporte neonatal', 'UCIN', 'Neonatología'],
    en: ['Neonatal transport', 'NICU', 'Neonatology'],
  },
  {
    match: ['monitor multiparametrico', 'monitor multiparámetro', 'monitor'],
    es: ['Monitorización continua', 'Urgencias', 'UCI'],
    en: ['Continuous monitoring', 'Emergency care', 'ICU'],
  },
  {
    match: ['electrocardiografo', 'ecg', 'holter'],
    es: ['Cardiología diagnóstica', 'Consulta externa', 'Monitoreo cardíaco'],
    en: ['Diagnostic cardiology', 'Outpatient care', 'Cardiac monitoring'],
  },
  {
    match: ['desfibrilador', 'reanimacion', 'carro de paro'],
    es: ['Reanimación', 'Urgencias', 'UCI'],
    en: ['Resuscitation', 'Emergency care', 'ICU'],
  },
  {
    match: ['ventilador', 'cpap', 'bpap', 'oxigeno', 'respiratorio', 'alto flujo'],
    es: ['Soporte respiratorio', 'UCI', 'Hospitalización'],
    en: ['Respiratory support', 'ICU', 'Hospitalization'],
  },
  {
    match: ['bomba de infusion', 'bomba de jeringa', 'infusion'],
    es: ['Administración controlada de medicamentos', 'UCI', 'Hospitalización'],
    en: ['Controlled drug delivery', 'ICU', 'Hospitalization'],
  },
  {
    match: ['glucometro', 'tensiometro', 'oximetro', 'termometro'],
    es: ['Consulta externa', 'Triaje', 'Control de signos vitales'],
    en: ['Outpatient care', 'Triage', 'Vital signs monitoring'],
  },
  {
    match: ['cama', 'camilla'],
    es: ['Hospitalización', 'Traslado de pacientes', 'Atención general'],
    en: ['Hospitalization', 'Patient transport', 'General care'],
  },
  {
    match: ['silla de ruedas', 'muleta', 'caminador', 'andador', 'movilidad'],
    es: ['Movilidad', 'Rehabilitación', 'Traslado asistido'],
    en: ['Mobility', 'Rehabilitation', 'Assisted transport'],
  },
  {
    match: ['arco en c', 'radiografia', 'mamografia', 'ultrasonido', 'ecografo', 'imagenologia'],
    es: ['Diagnóstico por imágenes', 'Quirófano', 'Radiología'],
    en: ['Diagnostic imaging', 'Operating room', 'Radiology'],
  },
  {
    match: ['autoclave', 'esteriliz', 'desinfeccion'],
    es: ['Central de esterilización', 'Control de infecciones', 'Procesamiento de instrumental'],
    en: ['Sterile processing', 'Infection control', 'Instrument processing'],
  },
  {
    match: ['mesa quirurgica', 'lampara quirurgica', 'quirurgico'],
    es: ['Quirófano', 'Cirugía', 'Procedimientos quirúrgicos'],
    en: ['Operating room', 'Surgery', 'Surgical procedures'],
  },
  {
    match: ['carro clinico', 'carro de infusion', 'carro de acero inoxidable'],
    es: ['Hospitalización', 'Apoyo clínico', 'Logística interna'],
    en: ['Hospitalization', 'Clinical support', 'Internal logistics'],
  },
  {
    match: ['ortesis', 'inmoviliz', 'confort'],
    es: ['Ortopedia', 'Rehabilitación', 'Apoyo de movilidad'],
    en: ['Orthopedics', 'Rehabilitation', 'Mobility support'],
  },
  {
    match: ['actividades de la vida diaria', 'avd'],
    es: ['Atención domiciliaria', 'Rehabilitación', 'Apoyo al paciente'],
    en: ['Home care', 'Rehabilitation', 'Patient assistance'],
  },
];

const TYPE_HINTS = [
  ['incubadoras neonatales', ['Neonatology', 'NICU', 'Transport if applicable']],
  ['cunas de calor radiante', ['Neonatology', 'NICU', 'Delivery room']],
  ['monitores de paciente multiparametro', ['ICU', 'Emergency care', 'General wards']],
  ['oximetros de pulso', ['Vital signs monitoring', 'Outpatient care', 'Triage']],
  ['electrocardiografos', ['Cardiology', 'Emergency care', 'Outpatient care']],
  ['desfibriladores', ['Resuscitation', 'Emergency care', 'ICU']],
  ['bombas de infusion', ['Medication delivery', 'ICU', 'Hospitalization']],
  ['bombas de jeringa', ['Microdosing', 'ICU', 'Neonatology']],
  ['maquinas de anestesia', ['Operating room', 'Anesthesia', 'Surgical procedures']],
  ['arcos en c', ['Radiology', 'Operating room', 'Interventional procedures']],
  ['radiografia digital dr', ['Radiology', 'Diagnostic imaging', 'Trauma']],
  ['sistemas de ultrasonido diagnostico', ['Diagnostic imaging', 'Outpatient care', 'Emergency care']],
  ['camas hospitalarias', ['Hospitalization', 'Inpatient care', 'General wards']],
  ['camillas hospitalarias', ['Patient transport', 'Emergency care', 'Hospitalization']],
  ['sillas de ruedas', ['Mobility', 'Rehabilitation', 'Patient transport']],
  ['bastones y muletas', ['Mobility support', 'Rehabilitation', 'Ambulatory care']],
  ['caminadores y andadores', ['Mobility support', 'Rehabilitation', 'Ambulatory care']],
  ['reguladores de oxigeno', ['Respiratory support', 'Oxygen therapy', 'Home care']],
  ['cpap/bpap', ['Respiratory support', 'ICU', 'Neonatology']],
  ['oxigenoterapia', ['Respiratory support', 'Hospitalization', 'Emergency care']],
  ['nebulizadores', ['Respiratory therapy', 'Outpatient care', 'Emergency care']],
  ['autoclaves y esterilizadores', ['Sterile processing', 'Infection control', 'Central sterilization']],
  ['lámparas quirúrgicas', ['Operating room', 'Surgery', 'Procedures']],
];

const COUNTS = {
  productos: 0,
  productosActualizados: 0,
  tipos: 0,
  tiposActualizados: 0,
  gtinLimpios: 0,
};

const { data: productos, error: productosError } = await supabase
  .from('productos')
  .select(`
    id, slug, sku, gtin, nombre_es, nombre_en, descripcion_corta_es, descripcion_corta_en,
    descripcion_larga_es, descripcion_larga_en, aplicaciones_es, aplicaciones_en,
    especificaciones, familias(nombre_es, nombre_en), tipos(nombre_es, nombre_en)
  `)
  .eq('activo', true)
  .order('orden', { ascending: true })
  .order('slug', { ascending: true });

if (productosError) throw productosError;

const { data: tipos, error: tiposError } = await supabase
  .from('tipos')
  .select('id, slug, familia_id, nombre_es, nombre_en, activo')
  .eq('activo', true)
  .order('slug', { ascending: true });

if (tiposError) throw tiposError;

const tipoMap = new Map((tipos ?? []).map((t) => [t.id, t]));
const familiaById = new Map();
for (const row of productos ?? []) {
  if (row.familias?.nombre_es && row.familias?.nombre_en) {
    familiaById.set(row.familias.nombre_es, row.familias.nombre_en);
  }
}

const tipoUpdates = [];
for (const tipo of tipos ?? []) {
  const update = buildTipoUpdate(tipo);
  if (Object.keys(update).length > 0) {
    tipoUpdates.push({ id: tipo.id, ...update });
  }
}

const productUpdates = [];
for (const row of productos ?? []) {
  const update = buildProductUpdate(row, tipoMap);
  if (Object.keys(update).length > 0) {
    productUpdates.push({ id: row.id, ...update });
  }
}

COUNTS.productos = productos?.length ?? 0;
COUNTS.tipos = tipos?.length ?? 0;

if (DRY_RUN) {
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        totals: COUNTS,
        tipoUpdates: tipoUpdates.slice(0, 10),
        productUpdates: productUpdates.slice(0, 10),
      },
      null,
      2
    )
  );
  process.exit(0);
}

await applyBatches('tipos', tipoUpdates);
await applyBatches('productos', productUpdates);

console.log(
  JSON.stringify(
    {
      mode: 'updated',
      totals: COUNTS,
      tipo_updates: tipoUpdates.length,
      producto_updates: productUpdates.length,
    },
    null,
    2
  )
);

function buildTipoUpdate(tipo) {
  const update = {};
  if (isEmpty(tipo.nombre_en)) {
    const mocked = translateWithMock(tipo.slug, 'nombre_en');
    update.nombre_en = mocked || translateTypeName(tipo.nombre_es);
  }
  return update;
}

function buildProductUpdate(row, tipoMapLocal) {
  const update = {};
  const mock = mockBySlug.get(row.slug);
  const tipoEs = row.tipos?.nombre_es ?? '';
  const tipoEn =
    row.tipos?.nombre_en ??
    (tipoEs ? translateTypeName(tipoEs) : '') ??
    (row.tipo_id && tipoMapLocal.get(row.tipo_id)?.nombre_en) ??
    '';
  const familiaEs = row.familias?.nombre_es ?? '';
  const familiaEn = row.familias?.nombre_en ?? translateSentence(familiaEs);
  const targetAplicacionesEs = getApplicationsEs(row, mock);
  const targetAplicacionesEn = getApplicationsEn(row, mock, targetAplicacionesEs);

  if (isPlaceholderGtin(row.gtin)) {
    update.gtin = null;
    COUNTS.gtinLimpios += 1;
  }

  if (isEmpty(row.nombre_en)) {
    update.nombre_en = translateWithMock(row.slug, 'nombre_en') || translateName(row.nombre_es);
  }

  if (isEmpty(row.descripcion_corta_en) && !isEmpty(row.descripcion_corta_es)) {
    update.descripcion_corta_en =
      translateWithMock(row.slug, 'descripcion_corta_en') ||
      translateSentence(row.descripcion_corta_es);
  }

  if (isEmpty(row.aplicaciones_es) && targetAplicacionesEs.length > 0) {
    update.aplicaciones_es = targetAplicacionesEs;
  }

  if (isEmpty(row.aplicaciones_en) && targetAplicacionesEn.length > 0) {
    update.aplicaciones_en = targetAplicacionesEn;
  }

  if (isEmpty(row.descripcion_larga_es)) {
    update.descripcion_larga_es = buildLongDescriptionEs({
      nombreEs: row.nombre_es,
      familiaEs,
      tipoEs,
      shortEs: row.descripcion_corta_es,
      aplicacionesEs: targetAplicacionesEs,
      specs: row.especificaciones ?? [],
    });
  }

  if (isEmpty(row.descripcion_larga_en)) {
    if (!isEmpty(row.descripcion_larga_es)) {
      update.descripcion_larga_en = translateLongText(row.descripcion_larga_es);
    } else {
      update.descripcion_larga_en = buildLongDescriptionEn({
        nombreEn: row.nombre_en || translateName(row.nombre_es),
        familiaEn,
        tipoEn,
        shortEn: row.descripcion_corta_en || translateSentence(row.descripcion_corta_es ?? ''),
        aplicacionesEn: targetAplicacionesEn,
        specs: row.especificaciones ?? [],
      });
    }
  }

  if (Object.keys(update).length > 0) COUNTS.productosActualizados += 1;
  return update;
}

function getApplicationsEs(row, mock) {
  const current = normalizeStringArray(row.aplicaciones_es);
  if (current.length > 0) return current;
  const fromMock = normalizeStringArray(mock?.aplicaciones_es);
  if (fromMock.length > 0) return fromMock;
  return inferApplications(row, 'es');
}

function getApplicationsEn(row, mock, sourceEs) {
  const current = normalizeStringArray(row.aplicaciones_en);
  if (current.length > 0) return current;
  const fromMock = normalizeStringArray(mock?.aplicaciones_en);
  if (fromMock.length > 0) return fromMock;
  if (sourceEs.length > 0) return sourceEs.map((item) => translateSentence(item));
  return inferApplications(row, 'en');
}

function inferApplications(row, lang) {
  const name = normalizeForMatch(row.nombre_es);
  const short = normalizeForMatch(row.descripcion_corta_es);
  const family = normalizeForMatch(row.familias?.nombre_es);
  const type = normalizeForMatch(row.tipos?.nombre_es);
  const hay = (...items) => items.some((item) => name.includes(item) || short.includes(item) || family.includes(item) || type.includes(item));

  for (const entry of PRODUCT_APP_MAP) {
    if (hay(...entry.match)) return [...entry[lang]];
  }

  for (const [needle, apps] of TYPE_HINTS) {
    if (type.includes(needle) || name.includes(needle)) {
      return lang === 'es' ? [...apps.map((a) => translateSentence(a))] : [...apps];
    }
  }

  if (lang === 'es') return ['Uso clínico', 'Atención institucional'];
  return ['Clinical use', 'Institutional care'];
}

function buildLongDescriptionEs({ nombreEs, familiaEs, tipoEs, shortEs, aplicacionesEs, specs }) {
  const parts = [];
  const short = cleanSentenceEs(shortEs || `uso clínico e institucional`);
  parts.push(
    `${nombreEs} es un producto de la familia ${familiaEs}${tipoEs ? `, tipo ${tipoEs}` : ''}.`
  );
  parts.push(
    `Está orientado a ${short.replace(/\.$/, '')}.`
  );
  if (aplicacionesEs.length > 0) {
    parts.push(`Sus aplicaciones documentadas incluyen ${joinEsList(aplicacionesEs)}.`);
  }
  const specsText = summarizeSpecsEs(specs);
  if (specsText) {
    parts.push(`Entre los datos documentados destacan ${specsText}.`);
  }
  parts.push(
    'La compatibilidad, accesorios, consumibles, instalación, garantía y condiciones de suministro deben confirmarse en la cotización formal.'
  );
  return parts.join(' ');
}

function buildLongDescriptionEn({ nombreEn, familiaEn, tipoEn, shortEn, aplicacionesEn, specs }) {
  const parts = [];
  const short = cleanSentenceEn(shortEn || 'clinical and institutional use');
  parts.push(
    `${nombreEn} is a product in the ${familiaEn} family${tipoEn ? `, within the ${tipoEn} type` : ''}.`
  );
  parts.push(`It is designed for ${short.replace(/\.$/, '')}.`);
  if (aplicacionesEn.length > 0) {
    parts.push(`Its documented applications include ${joinEnList(aplicacionesEn)}.`);
  }
  const specsText = summarizeSpecsEn(specs);
  if (specsText) {
    parts.push(`Documented data include ${specsText}.`);
  }
  parts.push(
    'Compatibility, accessories, consumables, installation, warranty and supply conditions must be confirmed in the formal quotation.'
  );
  return parts.join(' ');
}

function summarizeSpecsEs(specs) {
  const items = normalizeSpecs(specs).slice(0, 3);
  if (!items.length) return '';
  return items.join('; ');
}

function summarizeSpecsEn(specs) {
  const items = normalizeSpecs(specs).slice(0, 3).map((item) => translateSentence(item));
  if (!items.length) return '';
  return items.join('; ');
}

function normalizeSpecs(specs) {
  if (!Array.isArray(specs)) return [];
  return specs
    .map((spec) => {
      if (spec && typeof spec === 'object') {
        const clave = String(spec.clave ?? spec.key ?? '').trim();
        const valor = String(spec.valor ?? spec.value ?? '').trim();
        if (clave && valor) return `${clave}: ${valor}`;
        return clave || valor;
      }
      return String(spec ?? '').trim();
    })
    .filter(Boolean);
}

function translateWithMock(slug, field) {
  const mock = mockBySlug.get(slug);
  const value = mock?.[field];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

function translateTypeName(value) {
  const translated = translateSentence(value);
  return translated ? smartTitleCase(translated) : '';
}

function translateName(value) {
  const normalized = normalizeForMatch(value);
  const viaRules = applyPhraseRules(normalized, NAME_PHRASE_RULES);
  return smartTitleCase(viaRules);
}

function translateSentence(value) {
  const normalized = normalizeForMatch(value);
  const viaRules = applyPhraseRules(normalized, LONG_PHRASE_RULES.length ? LONG_PHRASE_RULES : SHORT_PHRASE_RULES);
  return sentenceCase(viaRules);
}

function translateLongText(value) {
  const normalized = normalizeForMatch(value).replace(/\n+/g, ' ');
  const viaRules = applyPhraseRules(normalized, LONG_PHRASE_RULES);
  return sentenceCase(viaRules);
}

function applyPhraseRules(text, rules) {
  let out = String(text ?? '');
  for (const [needle, replacement] of rules) {
    const re = new RegExp(escapeRegExp(needle), 'gi');
    out = out.replace(re, replacement);
  }
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

function sentenceCase(value) {
  const cleaned = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return '';
  const first = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return first.replace(/(^|[.!?]\s+)([a-záéíóúüñ])/g, (m, p1, p2) => `${p1}${p2.toUpperCase()}`);
}

function smartTitleCase(value) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text
    .split(' ')
    .map((word) => titleToken(word))
    .join(' ');
}

function titleToken(word) {
  const clean = word.trim();
  if (!clean) return clean;
  const normalized = clean.replace(/[()]/g, '');
  const lower = normalized.toLowerCase();
  if (ACRO_MAP.has(lower)) return ACRO_MAP.get(lower);
  if (/^[A-Z0-9-]+$/.test(normalized)) return normalized;
  if (/[0-9]/.test(normalized) && /^[A-Za-z0-9-]+$/.test(normalized)) {
    return normalized.toUpperCase();
  }
  if (normalized.includes('-')) {
    return normalized
      .split('-')
      .map((part) => titleToken(part))
      .join('-');
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function joinEsList(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

function joinEnList(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function normalizeForMatch(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSentenceEs(value) {
  return sentenceCase(
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function cleanSentenceEn(value) {
  return sentenceCase(String(value ?? '').replace(/\s+/g, ' ').trim());
}

function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === '';
}

function isPlaceholderGtin(gtin) {
  if (!gtin) return false;
  return !/^\d{8,14}$/.test(String(gtin).trim());
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function applyBatches(table, rows) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const payload = batch.map(({ id, ...rest }) => ({ id, ...rest }));
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    if (table === 'productos') {
      console.log('productos ' + Math.min(i + BATCH_SIZE, rows.length) + '/' + rows.length);
    } else {
      console.log('tipos ' + Math.min(i + BATCH_SIZE, rows.length) + '/' + rows.length);
    }
  }
}
