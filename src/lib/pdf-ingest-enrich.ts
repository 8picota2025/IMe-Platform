/**
 * Utilidades compartidas para ingesta PDF → landing enriquecida de producto.
 * Usadas por admin (#/ingesta) y replicadas en scripts Node.
 */

export type EspecItem = { clave: string; valor: string; grupo?: string };

export type IngestEnrichedFields = {
  beneficios_es: string[];
  beneficios_en: string[];
  valor_es: string;
  valor_en: string;
  seo_keywords_es: string[];
  seo_keywords_en: string[];
  marca: string;
};

const FAMILY_HINTS: Array<[string, string[]]> = [
  ['Ventiladores', ['ventilador', 'respirador', 'monnal', 'vni', 'vmi']],
  ['Anestesia y soporte ventilatorio', ['anestesia', 'vaporizador', 'mascara laringea']],
  ['Radiología y Diagnóstico por Imagen', ['radiologia', 'rayos x', 'rx', 'mamogra', 'arco c']],
  ['Ultrasonido', ['ecogra', 'ultrasonido', 'doppler']],
  ['Monitores', ['monitor multiparam', 'monitor de signos', 'signos vitales']],
  ['Cardiología diagnóstica', ['ecg', 'electrocardio', 'holter']],
  ['Cardiología y reanimación', ['desfibrilador', 'reanimacion']],
  ['Neonatología', ['neonatal', 'incubadora', 'cpap', 'cuna radiante']],
  ['Soluciones IV', ['infusion', 'jeringa', 'bomba de infusion']],
  ['Mobiliario Hospitalario', ['camilla', 'cama hospital', 'carro de paro']],
  ['Sala de Cirugía', ['quirurg', 'mesa quirurg', 'cialitica']],
];

const TIPO_HINTS: Array<[string, string[]]> = [
  ['Ventiladores', ['ventilador', 'respirador', 'monnal']],
  ['Monitores multiparamétricos', ['monitor multiparam']],
  ['Ecógrafos', ['ecogra', 'ultrasonido']],
];

export function normalizeMatchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function inferFamiliaSugerida(textValue: string): string {
  const value = normalizeMatchText(textValue);
  return FAMILY_HINTS.find(([, keywords]) => keywords.some(k => value.includes(k)))?.[0] ?? '';
}

export function inferTipoSugerido(textValue: string): string {
  const value = normalizeMatchText(textValue);
  return TIPO_HINTS.find(([, keywords]) => keywords.some(k => value.includes(k)))?.[0] ?? '';
}

export function productPdfPublicPath(slug: string): string {
  return `/assets/productos/importados/${slug}/ficha-${slug}.pdf`;
}

export function productPdfStoragePath(slug: string): string {
  return `${slug}/ficha-${slug}.pdf`;
}

/** Fragmento JSON ampliado para prompts LLM (admin + Edge). */
export function ingestJsonSchemaFragment(): string {
  return `"beneficios": [{"valor": "", "origen": "pdf|inferido|ausente", "confianza": 0, "requiere_revision": true}],
    "valor_institucional": {"valor": "", "origen": "pdf|inferido|ausente", "confianza": 0, "requiere_revision": true},
    "marca": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "seo_keywords": [{"valor": "", "origen": "pdf|inferido|ausente", "confianza": 0, "requiere_revision": true}]`;
}

export function buildIngestUserPrompt(pdfText: string, pdfUrl: string): string {
  const truncated = pdfText.slice(0, 12000);
  return `Fuente PDF: ${pdfUrl || 'texto pegado por admin'}

Texto disponible:
${truncated || '[No se proporciono texto extraido. Marca todos los campos como ausentes y agrega advertencia de que se requiere extraer texto/OCR del PDF antes de validar.]'}

Estructura requerida:
{
  "producto_es": {
    "nombre": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "familia_sugerida": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "tipo_sugerido": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_corta": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_larga": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "especificaciones": [{"clave": "", "valor": "", "grupo": "", "origen": "pdf", "confianza": 0, "requiere_revision": true}],
    "aplicaciones": [{"valor": "", "origen": "pdf", "confianza": 0, "requiere_revision": true}],
    ${ingestJsonSchemaFragment()},
    "meta_seo": {"title": "", "description": ""}
  },
  "producto_en_borrador": {
    "nombre": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_corta": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_larga": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "aplicaciones": [{"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true}],
    "beneficios": [{"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true}],
    "valor_institucional": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "seo_keywords": [{"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true}],
    "meta_seo": {"title": "", "description": ""}
  },
  "campos_confianza": [],
  "ausentes": [],
  "advertencias": [],
  "raw_model_id": ""
}

Reglas de enriquecimiento:
- Genera entre 3 y 5 beneficios comerciales ES a partir de especificaciones y texto del PDF (no inventes certificaciones).
- valor_institucional: una frase de propuesta de valor para comprador hospitalario.
- seo_keywords: 3-6 frases cortas de intención de búsqueda B2B en Colombia.
- familia_sugerida y tipo_sugerido deben usar nombres de taxonomía IME cuando sea posible (p.ej. Ventiladores).
- Traduccion EN: traduce beneficios, valor y keywords; marca requiere_revision=true.

Reglas EN:
- Traduce al ingles solo los campos presentes en producto_es.
- Conserva marcas, modelos, unidades, cifras, certificaciones y nombres tecnicos sin alterarlos.
- Si el dato fuente esta ausente en ES, deja el campo EN vacio con origen="ausente".`;
}

export function deriveEnrichedFields(input: {
  nombre: string;
  descripcionCorta: string;
  descripcionLarga: string;
  especificaciones: EspecItem[];
  aplicaciones: string[];
  textoCompleto?: string;
}): IngestEnrichedFields {
  const corpus = [
    input.nombre,
    input.descripcionCorta,
    input.descripcionLarga,
    input.textoCompleto ?? '',
    ...input.especificaciones.map(s => `${s.clave} ${s.valor}`),
  ]
    .join(' ')
    .toLowerCase();

  const marca = detectMarca(corpus, input.nombre);
  const beneficios_es = buildBeneficiosEs(input.especificaciones, input.aplicaciones, corpus);
  const valor_es = buildValorEs(input.nombre, input.aplicaciones);
  const seo_keywords_es = buildSeoKeywordsEs(input.nombre, input.aplicaciones, marca);

  return {
    beneficios_es,
    beneficios_en: beneficios_es.map(b => b),
    valor_es,
    valor_en: valor_es,
    seo_keywords_es,
    seo_keywords_en: seo_keywords_es.map(k => k),
    marca,
  };
}

function detectMarca(corpus: string, nombre: string): string {
  const brands = [
    'Air Liquide',
    'Philips',
    'GE Healthcare',
    'Mindray',
    'Drager',
    'Draeger',
    'Hamilton',
    'Medtronic',
    'Saikang',
    'Equitronic',
  ];
  const hit = brands.find(
    b => corpus.includes(b.toLowerCase()) || nombre.toLowerCase().includes(b.toLowerCase())
  );
  return hit ?? '';
}

function buildBeneficiosEs(specs: EspecItem[], aplicaciones: string[], corpus: string): string[] {
  const out: string[] = [];
  const pick = (clave: string) =>
    specs.find(s => normalizeMatchText(s.clave).includes(normalizeMatchText(clave)));

  const pantalla = pick('pantalla');
  if (pantalla?.valor) {
    out.push(`Interfaz ${pantalla.valor.toLowerCase()} para ajustes rápidos en cuidado crítico.`);
  }

  const filtro = specs.find(s => /hepa|filtro/i.test(`${s.clave} ${s.valor}`));
  if (filtro?.valor) {
    out.push(`Protección respiratoria con ${filtro.clave}: ${filtro.valor}.`);
  }

  const modos = pick('modos');
  if (modos?.valor) {
    out.push(
      `Amplio portafolio de modos (${modos.valor}) para ventilación invasiva y no invasiva.`
    );
  } else if (/ventilacion invasiva|vni|psv|cpap/i.test(corpus)) {
    out.push('Cubre ventilación invasiva y no invasiva en una misma plataforma clínica.');
  }

  const capno = specs.find(s => /co2|capnograf/i.test(`${s.clave} ${s.valor}`));
  if (capno?.valor) {
    out.push(`Monitorización avanzada de CO2: ${capno.valor}.`);
  }

  const bateria = pick('autonom');
  if (bateria?.valor) {
    out.push(
      `Autonomía de batería ${bateria.valor} para continuidad en traslados intrahospitalarios.`
    );
  }

  if (aplicaciones.length) {
    out.push(`Aplicaciones clínicas: ${aplicaciones.slice(0, 4).join(', ')}.`);
  }

  return dedupeStrings(out).slice(0, 5);
}

function buildValorEs(nombre: string, aplicaciones: string[]): string {
  const corto = nombre.split(/\s+/).slice(0, 6).join(' ');
  const apps = aplicaciones.slice(0, 2).join(' y ');
  if (apps) {
    return `${corto} con enfoque en ${apps.toLowerCase()}, listo para evaluación técnica y cotización institucional.`;
  }
  return `${corto} para entornos hospitalarios que requieren ventilación segura y trazabilidad clínica.`;
}

function buildSeoKeywordsEs(nombre: string, aplicaciones: string[], marca: string): string[] {
  const base = [
    slugWords(nombre).slice(0, 3).join(' '),
    'equipo médico hospitalario Colombia',
    'cotización equipos biomédicos',
  ];
  if (marca) base.push(`${marca} Colombia`);
  for (const app of aplicaciones.slice(0, 2)) {
    base.push(`${app.toLowerCase()} hospital`);
  }
  return dedupeStrings(base.filter(Boolean)).slice(0, 6);
}

function slugWords(value: string): string[] {
  return normalizeMatchText(value)
    .split(' ')
    .filter(w => w.length > 3 && !['para', 'con', 'ref', 'adulto', 'pediatrico'].includes(w));
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = normalizeMatchText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

export function revisableStringsFromDraft(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'valor' in item) {
        return String((item as { valor?: unknown }).valor ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

export function buildAtributosPayload(fields: {
  beneficios_es: string[];
  beneficios_en: string[];
  valor_es: string;
  valor_en: string;
  seo_keywords_es: string[];
  seo_keywords_en: string[];
  meta_title?: string;
  meta_description?: string;
  marca?: string;
}): Record<string, unknown> {
  return {
    beneficios_es: fields.beneficios_es,
    beneficios_en: fields.beneficios_en,
    valor_es: fields.valor_es || null,
    valor_en: fields.valor_en || null,
    seo_keywords_es: fields.seo_keywords_es,
    seo_keywords_en: fields.seo_keywords_en,
    meta_title: fields.meta_title ?? null,
    meta_description: fields.meta_description ?? null,
    marca: fields.marca ?? null,
  };
}
