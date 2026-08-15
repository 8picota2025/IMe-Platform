/**
 * OCR/visión de presupuestos competencia → JSON estructurado.
 * Proveedor por defecto: Ollama local `moondream` (sin ChatGPT).
 * Requiere `OLLAMA_BASE_URL` alcanzable desde la Edge Function
 * (localhost en serve local; túnel/cloudflare en prod).
 */

export interface OcrQuoteLine {
  nombre: string;
  sku?: string;
  cantidad: number;
  precio_unitario: number;
  moneda?: string;
  notas?: string;
}

export interface OcrQuoteExtract {
  cliente_nombre: string;
  cliente_empresa: string;
  cliente_email: string;
  cliente_telefono: string;
  moneda: 'COP' | 'USD';
  validez_hasta: string | null;
  productos: OcrQuoteLine[];
  notas: string;
  confianza: number;
}

const SYSTEM = `Eres un extractor OCR de presupuestos/cotizaciones médicas o biomédicas (competencia).
Devuelve SOLO JSON válido, sin markdown ni texto extra.
No inventes datos: si un campo no aparece, usa "" o 0 o [].
Normaliza teléfonos con dígitos; emails en minúsculas.
Precios como número (sin símbolos). Cantidades enteras >= 1.
Si la moneda no es clara y precios parecen COP (miles/millones), usa COP; si hay USD/$ internacionales, USD.
Mejora implícita: captura el precio de la competencia tal cual (precio_unitario).`;

function buildUserPrompt(): string {
  return `${SYSTEM}

Analiza la imagen del presupuesto competencia y extrae este JSON exacto:

{
  "cliente_nombre": "",
  "cliente_empresa": "",
  "cliente_email": "",
  "cliente_telefono": "",
  "moneda": "COP",
  "validez_hasta": null,
  "productos": [
    {"nombre": "", "sku": "", "cantidad": 1, "precio_unitario": 0, "moneda": "COP", "notas": ""}
  ],
  "notas": "",
  "confianza": 0.0
}

confianza 0-1 según legibilidad. validez_hasta en YYYY-MM-DD o null.`;
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

/** Moondream a veces envuelve JSON o añade texto; intenta recuperar objeto. */
function parseLooseJson(raw: string): unknown {
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('OCR no devolvió JSON válido');
  }
}

function normalizeExtract(raw: unknown): OcrQuoteExtract {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const monedaRaw = String(obj.moneda ?? 'COP').toUpperCase();
  const moneda: 'COP' | 'USD' = monedaRaw === 'USD' ? 'USD' : 'COP';
  const productosIn = Array.isArray(obj.productos) ? obj.productos : [];
  const productos: OcrQuoteLine[] = [];
  for (const item of productosIn) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const nombre = String(row.nombre ?? '')
      .trim()
      .slice(0, 200);
    if (!nombre) continue;
    const cantidad = Math.max(1, Math.round(Number(row.cantidad) || 1));
    const precio = Math.max(0, Number(row.precio_unitario) || 0);
    productos.push({
      nombre,
      sku:
        String(row.sku ?? '')
          .trim()
          .slice(0, 80) || undefined,
      cantidad,
      precio_unitario: precio,
      moneda: String(row.moneda ?? moneda).toUpperCase() === 'USD' ? 'USD' : moneda,
      notas:
        String(row.notas ?? '')
          .trim()
          .slice(0, 240) || undefined,
    });
  }
  let validez: string | null = null;
  const v = String(obj.validez_hasta ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) validez = v;
  const confianza = Math.min(1, Math.max(0, Number(obj.confianza) || 0));
  return {
    cliente_nombre: String(obj.cliente_nombre ?? '')
      .trim()
      .slice(0, 120),
    cliente_empresa: String(obj.cliente_empresa ?? '')
      .trim()
      .slice(0, 160),
    cliente_email: String(obj.cliente_email ?? '')
      .trim()
      .toLowerCase()
      .slice(0, 160),
    cliente_telefono: String(obj.cliente_telefono ?? '')
      .replace(/[^\d+]/g, '')
      .slice(0, 32),
    moneda,
    validez_hasta: validez,
    productos,
    notas: String(obj.notas ?? '')
      .trim()
      .slice(0, 2000),
    confianza,
  };
}

function ollamaBaseUrl(): string {
  return (Deno.env.get('OLLAMA_BASE_URL') ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
}

function visionModel(): string {
  return Deno.env.get('LLM_VISION_MODEL')?.trim() || 'moondream';
}

/**
 * Ollama vision (moondream): messages[].images = [base64 sin data-URL].
 * https://github.com/ollama/ollama/blob/main/docs/api.md
 */
async function callOllamaMoondream(
  imageBase64: string
): Promise<{ content: string; model: string }> {
  const model = visionModel();
  const base = ollamaBaseUrl();
  const timeoutMs = Number(Deno.env.get('OLLAMA_VISION_TIMEOUT_MS') ?? 180_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        options: {
          temperature: 0,
          num_predict: 2048,
        },
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(),
            images: [imageBase64],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Ollama moondream HTTP ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`
      );
    }
    const json = (await res.json()) as {
      message?: { content?: string };
      model?: string;
    };
    return {
      content: json.message?.content?.trim() ?? '',
      model: json.model ?? model,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function extractQuoteFromImage(
  imageBase64: string,
  _mime: string
): Promise<{ extract: OcrQuoteExtract; model: string; provider: string }> {
  const provider = (Deno.env.get('OCR_VISION_PROVIDER') ?? 'ollama').toLowerCase();
  if (provider !== 'ollama') {
    throw new Error(`OCR_VISION_PROVIDER=${provider} no soportado. Usa ollama (moondream local).`);
  }

  let result: { content: string; model: string };
  try {
    result = await callOllamaMoondream(imageBase64);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ollama vision falló';
    throw new Error(
      `${msg}. Comprueba OLLAMA_BASE_URL (${ollamaBaseUrl()}) y modelo ${visionModel()}.`,
      { cause: err }
    );
  }

  if (!result.content) {
    throw new Error('Moondream devolvió respuesta vacía');
  }

  let parsed: unknown;
  try {
    parsed = parseLooseJson(result.content);
  } catch (err) {
    throw new Error('OCR moondream no devolvió JSON válido', { cause: err });
  }

  return {
    extract: normalizeExtract(parsed),
    model: result.model,
    provider: 'ollama',
  };
}
