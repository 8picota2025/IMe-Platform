/**
 * OCR/visión de presupuestos competencia → JSON estructurado.
 * Usa OpenAI (gpt-4o-mini) o Anthropic vision según claves disponibles.
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
  return `Analiza la imagen del presupuesto competencia y extrae:

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

async function callOpenAiVision(
  imageBase64: string,
  mime: string
): Promise<{ content: string; model: string }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurado');
  const model = Deno.env.get('LLM_VISION_MODEL')?.trim() || 'gpt-4o-mini';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 3500,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildUserPrompt() },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mime};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenAI vision HTTP ${res.status}`);
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    return {
      content: json.choices?.[0]?.message?.content?.trim() ?? '',
      model: json.model ?? model,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropicVision(
  imageBase64: string,
  mime: string
): Promise<{ content: string; model: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurado');
  const model =
    Deno.env.get('LLM_VISION_MODEL')?.trim() ||
    Deno.env.get('LLM_INGEST_MODEL')?.trim() ||
    'claude-3-5-sonnet-latest';
  const mediaType =
    mime === 'image/png' || mime === 'image/webp' || mime === 'image/gif' ? mime : 'image/jpeg';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 3500,
        temperature: 0,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              { type: 'text', text: buildUserPrompt() },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Anthropic vision HTTP ${res.status}`);
    const json = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      model?: string;
    };
    const content =
      json.content
        ?.map(b => (b.type === 'text' ? (b.text ?? '') : ''))
        .join('')
        .trim() ?? '';
    return { content, model: json.model ?? model };
  } finally {
    clearTimeout(timer);
  }
}

export async function extractQuoteFromImage(
  imageBase64: string,
  mime: string
): Promise<{ extract: OcrQuoteExtract; model: string; provider: string }> {
  const preferred = (Deno.env.get('LLM_PROVIDER') ?? 'openai').toLowerCase();
  let content = '';
  let model = '';
  let provider = preferred;

  const tryOpenAi = async () => {
    const r = await callOpenAiVision(imageBase64, mime);
    content = r.content;
    model = r.model;
    provider = 'openai';
  };
  const tryAnthropic = async () => {
    const r = await callAnthropicVision(imageBase64, mime);
    content = r.content;
    model = r.model;
    provider = 'anthropic';
  };

  try {
    if (preferred === 'anthropic') await tryAnthropic();
    else await tryOpenAi();
  } catch (first) {
    try {
      if (preferred === 'anthropic') await tryOpenAi();
      else await tryAnthropic();
    } catch {
      throw first instanceof Error ? first : new Error('Vision OCR falló');
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(content));
  } catch {
    throw new Error('OCR no devolvió JSON válido');
  }
  return { extract: normalizeExtract(parsed), model, provider };
}
