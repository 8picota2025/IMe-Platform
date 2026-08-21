#!/usr/bin/env node
/**
 * Puente OCR presupuestos (local).
 *
 * Pipeline (OCR_ENGINE o auto):
 *   1. gemini         — Gemini Flash visión → JSON (rápido, gratis con API key)
 *   2. google_vision  — Cloud Vision OCR → qwen texto → JSON
 *   3. rapid          — RapidOCR local → qwen texto → JSON
 *   4. moondream      — VLM local (último recurso)
 *
 * Edge: Storage signed URL → POST /ocr { image_url }  (sin base64 por túnel).
 *
 *   OCR_BRIDGE_PORT=3850 OCR_BRIDGE_SECRET=... node scripts/ocr-moondream-bridge.mjs
 */
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.OCR_BRIDGE_PORT || 3850);
const SECRET = (process.env.OCR_BRIDGE_SECRET || '').trim();
const OLLAMA = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const VISION_FALLBACK = process.env.LLM_VISION_MODEL || 'moondream';
const TEXT_MODEL = process.env.OCR_TEXT_MODEL || 'qwen3-imeia';
const GEMINI_MODEL = process.env.OCR_GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_KEY = (
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  ''
).trim();
const VISION_KEY = (process.env.GOOGLE_VISION_API_KEY || process.env.GCP_VISION_API_KEY || '').trim();
const RAPID_PYTHON = (
  process.env.OCR_RAPID_PYTHON ||
  '/home/shoky/cursor/ime-platform/.venv-ocr/bin/python'
).trim();
const ENGINE_PREF = (process.env.OCR_ENGINE || 'auto').trim().toLowerCase();
const TIMEOUT_MS = Number(process.env.OLLAMA_VISION_TIMEOUT_MS || 180_000);

const JSON_SCHEMA_HINT = `{
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
}`;

const SYSTEM = `Eres un extractor OCR de presupuestos/cotizaciones médicas o biomédicas (competencia).
Devuelve SOLO JSON válido, sin markdown ni texto extra.
No inventes datos: si un campo no aparece, usa "" o 0 o [].
NUNCA digas que la imagen "no se ve nítida" ni rechaces el trabajo: extrae TODO lo legible (nombres, precios, cantidades, empresa, fechas) y baja confianza si hace falta.
Normaliza teléfonos con dígitos; emails en minúsculas.
Precios como número (sin símbolos). Cantidades enteras >= 1.
Si la moneda no es clara y precios parecen COP (miles/millones), usa COP; si hay USD/$ internacionales, USD.
Captura el precio de la competencia tal cual (precio_unitario).`;

const USER_VISION = `${SYSTEM}

Analiza la imagen del presupuesto competencia y extrae este JSON exacto:

${JSON_SCHEMA_HINT}

confianza 0-1 según legibilidad. validez_hasta en YYYY-MM-DD o null.`;

const USER_FROM_TEXT = `${SYSTEM}

A partir del texto OCR de un presupuesto competencia, extrae este JSON exacto:

${JSON_SCHEMA_HINT}

confianza 0-1 según legibilidad del texto. validez_hasta en YYYY-MM-DD o null.`;

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
  let notas = String(obj.notas ?? '')
    .trim()
    .slice(0, 2000);
  // Strip useless "not sharp" refusals from weak VLMs
  if (/no se ve n[ií]tid|not (clear|sharp|legible)|blurry|ilegible/i.test(notas) && productos.length === 0) {
    notas = '';
  }
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
    notas,
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

function mimeFromB64(b64) {
  const buf = Buffer.from(b64.slice(0, 24), 'base64');
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'image/webp';
  return 'image/jpeg';
}

async function callGeminiVision(imageBase64) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY no configurado');
  const mime = mimeFromB64(imageBase64);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.min(TIMEOUT_MS, 90_000));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: USER_VISION },
              { inline_data: { mime_type: mime, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Gemini respuesta no JSON HTTP ${res.status}`);
    }
    if (!res.ok) {
      const msg = data?.error?.message || raw.slice(0, 200);
      throw new Error(`Gemini HTTP ${res.status}: ${msg}`);
    }
    const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    if (!text) throw new Error('Gemini vacío');
    return { content: text, model: GEMINI_MODEL };
  } finally {
    clearTimeout(t);
  }
}

async function callGoogleVisionOcr(imageBase64) {
  if (!VISION_KEY) throw new Error('GOOGLE_VISION_API_KEY no configurado');
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(VISION_KEY)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Vision HTTP ${res.status}: ${data?.error?.message || 'error'}`);
    }
    const err = data?.responses?.[0]?.error;
    if (err) throw new Error(`Vision: ${err.message || JSON.stringify(err)}`);
    const text = String(data?.responses?.[0]?.fullTextAnnotation?.text || '').trim();
    if (!text) throw new Error('Vision sin texto');
    return text;
  } finally {
    clearTimeout(t);
  }
}

function runRapidOcr(imageBase64) {
  return new Promise(async (resolve, reject) => {
    const path = join(tmpdir(), `ime-ocr-${randomBytes(8).toString('hex')}.jpg`);
    try {
      await writeFile(path, Buffer.from(imageBase64, 'base64'));
    } catch (e) {
      reject(e);
      return;
    }
    const py = `
import json, sys
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
result, _ = ocr(sys.argv[1])
lines = []
if result:
  for row in result:
    if row and len(row) >= 2 and row[1]:
      lines.append(str(row[1]))
print(json.dumps({"text": "\\n".join(lines)}, ensure_ascii=False))
`;
    const child = spawn(RAPID_PYTHON, ['-c', py, path], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('RapidOCR timeout'));
    }, 120_000);
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('close', async (code) => {
      clearTimeout(timer);
      try {
        await unlink(path);
      } catch {
        /* ignore */
      }
      if (code !== 0) {
        reject(new Error(`RapidOCR exit ${code}: ${(err || out).slice(0, 200)}`));
        return;
      }
      try {
        const parsed = JSON.parse(out.trim());
        const text = String(parsed.text || '').trim();
        if (!text) reject(new Error('RapidOCR sin texto'));
        else resolve(text);
      } catch (e) {
        reject(new Error(`RapidOCR parse: ${e.message}`));
      }
    });
  });
}

async function callOllamaText(ocrText) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TEXT_MODEL,
        stream: false,
        format: 'json',
        options: { temperature: 0, num_predict: 2048 },
        messages: [
          {
            role: 'user',
            content: `${USER_FROM_TEXT}\n\n--- TEXTO OCR ---\n${ocrText.slice(0, 12000)}`,
          },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Ollama text HTTP ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
    }
    const data = await res.json();
    return {
      content: String(data?.message?.content ?? '').trim(),
      model: data?.model || TEXT_MODEL,
    };
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
        model: VISION_FALLBACK,
        stream: false,
        format: 'json',
        options: { temperature: 0, num_predict: 2048 },
        messages: [
          {
            role: 'user',
            content: USER_VISION,
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
      model: data?.model || VISION_FALLBACK,
    };
  } finally {
    clearTimeout(t);
  }
}

function resolveEngines() {
  if (ENGINE_PREF === 'gemini') return ['gemini'];
  if (ENGINE_PREF === 'google_vision') return ['google_vision'];
  if (ENGINE_PREF === 'rapid') return ['rapid'];
  if (ENGINE_PREF === 'moondream') return ['moondream'];
  // auto: prefer fastest high-quality
  const list = [];
  if (GEMINI_KEY) list.push('gemini');
  if (VISION_KEY) list.push('google_vision');
  list.push('rapid');
  list.push('moondream');
  return list;
}

async function runPipeline(imageBase64) {
  const engines = resolveEngines();
  const errors = [];
  for (const engine of engines) {
    try {
      if (engine === 'gemini') {
        const { content, model } = await callGeminiVision(imageBase64);
        return {
          extract: normalizeExtract(parseLooseJson(content)),
          model,
          provider: 'gemini',
        };
      }
      if (engine === 'google_vision') {
        const text = await callGoogleVisionOcr(imageBase64);
        const { content, model } = await callOllamaText(text);
        return {
          extract: normalizeExtract(parseLooseJson(content)),
          model: `vision+${model}`,
          provider: 'google_vision+ollama',
          ocr_chars: text.length,
        };
      }
      if (engine === 'rapid') {
        const text = await runRapidOcr(imageBase64);
        const { content, model } = await callOllamaText(text);
        return {
          extract: normalizeExtract(parseLooseJson(content)),
          model: `rapid+${model}`,
          provider: 'rapid+ollama',
          ocr_chars: text.length,
        };
      }
      if (engine === 'moondream') {
        const { content, model } = await callMoondream(imageBase64);
        if (!content) throw new Error('Moondream vacío');
        return {
          extract: normalizeExtract(parseLooseJson(content)),
          model,
          provider: 'ollama',
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ocr-bridge] engine=${engine} fail:`, message);
      errors.push(`${engine}: ${message}`);
    }
  }
  throw new Error(`OCR falló (${errors.join(' | ')})`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      engine: ENGINE_PREF,
      engines: resolveEngines(),
      gemini: Boolean(GEMINI_KEY),
      google_vision: Boolean(VISION_KEY),
      text_model: TEXT_MODEL,
      vision_fallback: VISION_FALLBACK,
      ollama: OLLAMA,
    });
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
      const result = await runPipeline(b64);
      return json(res, 200, {
        ok: true,
        extract: result.extract,
        model: result.model,
        provider: result.provider,
        ocr_chars: result.ocr_chars,
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
    `[ocr-bridge] :${PORT} engine=${ENGINE_PREF} engines=${resolveEngines().join(',')} gemini=${GEMINI_KEY ? 'yes' : 'no'} secret=${SECRET ? 'yes' : 'no'}`
  );
});
