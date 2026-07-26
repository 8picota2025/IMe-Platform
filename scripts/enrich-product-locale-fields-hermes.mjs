import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HERMES_URL = (process.env.IMEIA_API_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
const HERMES_KEY = process.env.IMEIA_API_KEY || readHermesKey();
const MODEL = process.env.IMEIA_MODEL || 'imeia';
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number(process.env.ENRICH_LIMIT || 0);
const PRODUCT_BATCH_SIZE = Number(process.env.ENRICH_BATCH_SIZE || 6);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}
if (!HERMES_KEY) {
  throw new Error('Falta IMEIA_API_KEY o ~/.hermes/profiles/biomedsvc/.env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mockProductos = JSON.parse(
  readFileSync(
    '/home/shoky/Documents/I-ME/0106-ime-web-claude-design/src/data/mock-productos.json',
    'utf8'
  )
);
const mockBySlug = new Map(mockProductos.map((p) => [p.slug, p]));

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

const targetProductos = (productos ?? [])
  .filter(shouldUpdateProduct)
  .slice(0, LIMIT > 0 ? LIMIT : undefined);

const batches = chunk(targetProductos, PRODUCT_BATCH_SIZE);
const generatedUpdates = [];

for (const [index, batch] of batches.entries()) {
  const payload = batch.map((row) => toPromptItem(row));
  const result = await hermesJson({
    items: payload,
    instructions:
      'Devuelve JSON valido con la estructura {items:[...]} y conserva exactamente los slug. ' +
      'Para cada item devuelve siempre estas claves: slug, nombre_en, descripcion_corta_en, descripcion_larga_es, descripcion_larga_en, aplicaciones_es, aplicaciones_en. ' +
      'Si un valor ya existe, puedes repetirlo; si no existe, complétalo. Si no puedes inferir un campo, devuelve cadena vacía o arreglo vacío, pero no omitas la clave. ' +
      'No inventes GTIN ni codigo DIAN. Genera descripciones largas de 2 a 4 frases, tono tecnico-comercial prudente, sin exagerar prestaciones. ' +
      'Para aplicaciones devuelve entre 2 y 4 usos concretos. Mantén marcas, siglas, modelos y codigos tal como aparecen.',
  });

  const items = Array.isArray(result?.items) ? result.items : [];
  const bySlug = new Map(items.map((item) => [item.slug, item]));
  const batchUpdates = [];

  for (const row of batch) {
    const item = bySlug.get(row.slug) || {};
    const update = buildUpdate(row, item);
    if (Object.keys(update).length > 0) {
      batchUpdates.push({ id: row.id, ...update });
    }
  }

  if (DRY_RUN) {
    generatedUpdates.push(...batchUpdates);
  } else if (batchUpdates.length > 0) {
    await applyBatches('productos', batchUpdates);
  }

  console.log(`batch ${index + 1}/${batches.length}: ${batch.length} productos`);
}

if (DRY_RUN) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    total: productos?.length ?? 0,
    target: targetProductos.length,
    updates: generatedUpdates.slice(0, 10),
  }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify({
  mode: 'updated',
  total: productos?.length ?? 0,
  target: targetProductos.length,
}, null, 2));

function shouldUpdateProduct(row) {
  return (
    isMissing(row.nombre_en) ||
    isMissing(row.descripcion_corta_en) ||
    isMissing(row.descripcion_larga_es) ||
    isMissing(row.descripcion_larga_en) ||
    isMissing(row.aplicaciones_es) ||
    isMissing(row.aplicaciones_en) ||
    isPlaceholderGtin(row.gtin)
  );
}

function toPromptItem(row) {
  const mock = mockBySlug.get(row.slug);
  return {
    slug: row.slug,
    nombre_es: row.nombre_es,
    nombre_en: row.nombre_en || mock?.nombre_en || null,
    descripcion_corta_es: row.descripcion_corta_es || null,
    descripcion_corta_en: row.descripcion_corta_en || mock?.descripcion_corta_en || null,
    descripcion_larga_es: row.descripcion_larga_es || null,
    descripcion_larga_en: row.descripcion_larga_en || null,
    familia_es: row.familias?.nombre_es || null,
    familia_en: row.familias?.nombre_en || null,
    tipo_es: row.tipos?.nombre_es || null,
    tipo_en: row.tipos?.nombre_en || null,
    aplicaciones_es: normalizeStringArray(row.aplicaciones_es),
    aplicaciones_en: normalizeStringArray(row.aplicaciones_en),
    especificaciones: normalizeSpecs(row.especificaciones),
  };
}

function buildUpdate(row, item) {
  const update = {};
  const mock = mockBySlug.get(row.slug);

  if (isPlaceholderGtin(row.gtin)) {
    update.gtin = null;
  }
  if (isMissing(row.nombre_en) && isString(item.nombre_en)) {
    update.nombre_en = cleanText(item.nombre_en);
  } else if (isMissing(row.nombre_en) && isString(mock?.nombre_en)) {
    update.nombre_en = cleanText(mock.nombre_en);
  }
  if (isMissing(row.descripcion_corta_en) && isString(item.descripcion_corta_en)) {
    update.descripcion_corta_en = cleanText(item.descripcion_corta_en);
  } else if (isMissing(row.descripcion_corta_en) && isString(mock?.descripcion_corta_en)) {
    update.descripcion_corta_en = cleanText(mock.descripcion_corta_en);
  }
  if (isMissing(row.descripcion_larga_es) && isString(item.descripcion_larga_es)) {
    update.descripcion_larga_es = cleanText(item.descripcion_larga_es);
  }
  if (isMissing(row.descripcion_larga_en) && isString(item.descripcion_larga_en)) {
    update.descripcion_larga_en = cleanText(item.descripcion_larga_en);
  }
  if (isMissing(row.aplicaciones_es) && Array.isArray(item.aplicaciones_es) && item.aplicaciones_es.length > 0) {
    update.aplicaciones_es = normalizeStringArray(item.aplicaciones_es);
  }
  if (isMissing(row.aplicaciones_en) && Array.isArray(item.aplicaciones_en) && item.aplicaciones_en.length > 0) {
    update.aplicaciones_en = normalizeStringArray(item.aplicaciones_en);
  }

  return update;
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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isMissing(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === '';
}

function isPlaceholderGtin(gtin) {
  if (!gtin) return false;
  return !/^\d{8,14}$/.test(String(gtin).trim());
}

async function hermesJson(payload) {
  const baseMessages = [
    {
      role: 'system',
      content:
        'Eres un editor de catalogo biomedico. Responde solo JSON valido, sin markdown ni texto adicional. No inventes GTIN, DIAN, certificaciones, registros ni especificaciones. Usa un tono tecnico-comercial prudente. Si no puedes cumplir, devuelve exactamente {"items":[]} sin texto extra.',
    },
  ];

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(`${HERMES_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HERMES_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          ...baseMessages,
          {
            role: 'user',
            content:
              attempt === 0
                ? JSON.stringify(payload)
                : JSON.stringify({
                    retry: true,
                    previous_error: String(lastError?.message || 'invalid_json'),
                    payload,
                    instruction: 'Devuelve solo JSON valido y ninguna otra cosa.',
                  }),
          },
        ],
      }),
    });

    if (!res.ok) {
      lastError = new Error(`Hermes HTTP ${res.status}`);
      continue;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1) {
      lastError = new Error(`Respuesta Hermes no JSON: ${content.slice(0, 200)}`);
      continue;
    }

    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Hermes no devolvió JSON válido');
}

async function applyBatches(table, rows) {
  if (!rows.length) return;
  const BATCH_SIZE = Number(process.env.WRITE_BATCH_SIZE || 20);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ({ id, ...rest }) => {
        const { error } = await supabase.from(table).update(rest).eq('id', id);
        if (error) throw error;
      })
    );
    console.log(`${table} ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function readHermesKey() {
  try {
    const env = readFileSync('/home/shoky/.hermes/profiles/biomedsvc/.env', 'utf8');
    const match = env.match(/^API_SERVER_KEY=(.*)$/m);
    return match?.[1]?.trim() || '';
  } catch {
    return '';
  }
}
