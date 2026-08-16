#!/usr/bin/env node
/**
 * Puente OCR moondream (local).
 *
 * Edge NO manda la imagen por el túnel (Cloudflare cuelga con base64 grande).
 * Flujo: Edge sube a Storage → POST aquí con image_url firmada → Ollama local.
 *
 *   OCR_BRIDGE_PORT=3850 OCR_BRIDGE_SECRET=... node scripts/ocr-moondream-bridge.mjs
 *
 * Endpoints:
 *   GET  /health
 *   POST /ocr  { image_url } | { image_base64 }  → { extract, model, provider, raw }
 */
import http from 'node:http';
import { Buffer } from 'node:buffer';

const PORT = Number(process.env.OCR_BRIDGE_PORT || 3850);
const SECRET = (process.env.OCR_BRIDGE_SECRET || '').trim();
const OLLAMA = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const MODEL = process.env.LLM_VISION_MODEL || 'moondream';
const TIMEOUT_MS = Number(process.env.OLLAMA_VISION_TIMEOUT_MS || 180_000);

const SYSTEM = `Eres un extractor OCR de presupuestos/cotizaciones médicas o biomédicas (competencia).
Devuelve SOLO JSON válido, sin markdown ni texto extra.
No inventes datos: si un campo no aparece, usa "" o 0 o [].
Normaliza teléfonos con dígitos; emails en minúsculas.
Precios como número (sin símbolos). Cantidades enteras >= 1.
Si la moneda no es clara y precios parecen COP (miles/millones), usa COP; si hay USD/$ internacionales, USD.
Mejora implícita: captura el precio de la competencia tal cual (precio_unitario).`;

const USER_PROMPT = `${SYSTEM}

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

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function unauthorized(res) {
  json(res, 401, { error: 'unauthorized' });
}

function checkAuth(req) {
  if (!SECRET) return true;
  const h = req.headers.authorization || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  return token === SECRET;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function stripJsonFence(raw) {
  const trimmed = String(raw || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseLooseJson(raw) {
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('OCR no devolvió JSON válido');
  }
}

function normalizeExtract(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const monedaRaw = String(obj.moneda ?? 'COP').toUpperCase();
  const moneda = monedaRaw === 'USD' ? 'USD' : 'COP';
  const productosIn = Array.isArray(obj.productos) ? obj.productos : [];
  const productos = [];
  for (const item of productosIn) {
    if (!item || typeof item !== 'object') continue;
    const nombre = String(item.nombre ?? '')
      .trim()
      .slice(0, 200);
    if (!nombre) continue;
    productos.push({
      nombre,
      sku:
        String(item.sku ?? '')
          .trim()
          .slice(0, 80) || undefined,
      cantidad: Math.max(1, Math.round(Number(item.cantidad) || 1)),
      precio_unitario: Math.max(0, Number(item.precio_unitario) || 0),
      moneda: String(item.moneda ?? moneda).toUpperCase() === 'USD' ? 'USD' : moneda,
      notas:
        String(item.notas ?? '')
          .trim()
          .slice(0, 240) || undefined,
    });
  }
  let validez = null;
  const v = String(obj.validez_hasta ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) validez = v;
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
    confianza: Math.min(1, Math.max(0, Number(obj.confianza) || 0)),
  };
}

async function fetchImageBase64(imageUrl) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(imageUrl, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Descarga imagen HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) throw new Error('Imagen > 8 MB');
    return buf.toString('base64');
  } finally {
    clearTimeout(t);
  }
}

async function callMoondream(imageBase64) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: 'json',
        options: { temperature: 0, num_predict: 2048 },
        messages: [
          {
            role: 'user',
            content: USER_PROMPT,
            images: [imageBase64],
          },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Ollama HTTP ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
    }
    const data = await res.json();
    return {
      content: String(data?.message?.content ?? '').trim(),
      model: data?.model || MODEL,
    };
  } finally {
    clearTimeout(t);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, model: MODEL, ollama: OLLAMA });
  }
  if (req.method === 'POST' && url.pathname === '/ocr') {
    if (!checkAuth(req)) return unauthorized(res);
    try {
      const body = await readBody(req);
      let b64 = String(body.image_base64 || '')
        .replace(/^data:[^;]+;base64,/, '')
        .replace(/\s/g, '');
      if (!b64 && body.image_url) {
        b64 = await fetchImageBase64(String(body.image_url));
      }
      if (!b64 || b64.length < 32) {
        return json(res, 400, { error: 'image_url o image_base64 requerido' });
      }
      const started = Date.now();
      const { content, model } = await callMoondream(b64);
      if (!content) return json(res, 502, { error: 'Moondream vacío' });
      const extract = normalizeExtract(parseLooseJson(content));
      return json(res, 200, {
        ok: true,
        extract,
        model,
        provider: 'ollama',
        ms: Date.now() - started,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR bridge falló';
      console.error('[ocr-bridge]', message);
      return json(res, 502, { error: message });
    }
  }
  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[ocr-bridge] :${PORT} → ${OLLAMA} model=${MODEL} secret=${SECRET ? 'yes' : 'no'}`
  );
});
