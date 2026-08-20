/**
 * OCR presupuesto competencia (PWA): cámara/galería/PDF → Edge → borrador CMS.
 * Mirror local es opcional/silencioso (desktop); no forma parte del UX móvil.
 */
import { callEdgeFunction, type EdgeFunctionResult } from './shared';
import type { CotizacionLineaOferta } from '../lib/cotizacion-oferta';

export interface OcrCompetenciaResult {
  ok: boolean;
  quote_id: string;
  numero?: string | null;
  twenty_opportunity_id?: string | null;
  storage_path?: string;
  local_filename?: string;
  local_mirror?: { ok: boolean; path?: string; error?: string };
  extract?: {
    cliente_nombre: string;
    cliente_empresa: string;
    cliente_email: string;
    cliente_telefono: string;
    moneda: 'COP' | 'USD';
    productos: Array<{
      nombre: string;
      cantidad: number;
      precio_unitario: number;
    }>;
    confianza: number;
  };
  improved_lines?: CotizacionLineaOferta[];
  total?: number;
  moneda?: 'COP' | 'USD';
}

const MIRROR_URL = 'http://127.0.0.1:3847/mirror';
const MAX_OCR_BYTES = 7.5 * 1024 * 1024;

export type PrepareOcrResult =
  | { ok: true; blob: Blob; filename: string }
  | { ok: false; error: string };

export async function fileToBase64(file: Blob): Promise<{ base64: string; mime: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    base64: btoa(binary),
    mime: file.type || 'image/jpeg',
  };
}

/** Best-effort desktop mirror; never blocks PWA UX. */
async function mirrorSilent(input: {
  filename: string;
  image_base64: string;
  meta: Record<string, unknown>;
}): Promise<void> {
  if (typeof location === 'undefined') return;
  // Solo intenta en localhost / desktop; móviles no tienen el mirror.
  const host = location.hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') return;
  try {
    await fetch(MIRROR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    /* ignore */
  }
}

export async function ocrPresupuestoCompetencia(input: {
  file: Blob;
  filename?: string;
  quoteId?: string;
}): Promise<EdgeFunctionResult<OcrCompetenciaResult>> {
  if (input.file.size > MAX_OCR_BYTES) {
    return {
      data: null,
      error: 'Archivo demasiado grande (máx. ~7.5 MB). Comprime o recorta y reintenta.',
      status: 413,
      code: 'IMAGE_TOO_LARGE',
    };
  }
  const { base64, mime } = await fileToBase64(input.file);
  const body: Record<string, string> = {
    image_base64: base64,
    mime: mime.startsWith('image/') ? mime : 'image/jpeg',
    filename: input.filename || 'competencia.jpg',
  };
  if (input.quoteId) body.quote_id = input.quoteId;

  const edge = await callEdgeFunction<OcrCompetenciaResult>('comercial-ocr-presupuesto', {
    method: 'POST',
    body,
  });

  if (edge.data?.ok && edge.data.local_filename) {
    void mirrorSilent({
      filename: edge.data.local_filename,
      image_base64: base64,
      meta: {
        quote_id: edge.data.quote_id,
        numero: edge.data.numero,
        twenty_opportunity_id: edge.data.twenty_opportunity_id,
        storage_path: edge.data.storage_path,
      },
    });
  }
  return edge;
}

function pickFile(accept: string, capture?: 'environment'): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.setAttribute('capture', capture);
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };
    const cleanup = () => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      window.removeEventListener('focus', onFocus);
      input.remove();
    };
    const onChange = () => finish(input.files?.[0] ?? null);
    const onCancel = () => finish(null);
    // iOS a veces no dispara cancel: si vuelve foco sin archivo, cerrar.
    const onFocus = () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) finish(null);
      }, 800);
    };
    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Abre picker en el mismo gesto del tap (iOS).
 * camera → capture=environment; gallery → sin capture (Android muestra galería).
 */
export function pickCompetenciaImage(mode: 'camera' | 'gallery'): Promise<File | null> {
  return pickFile('image/*', mode === 'camera' ? 'environment' : undefined);
}

/** Selector PDF del presupuesto competencia. */
export function pickCompetenciaPdf(): Promise<File | null> {
  return pickFile('application/pdf,.pdf');
}

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}

function isHeicLike(file: Blob): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.includes('heic') || t.includes('heif')) return true;
  if (file instanceof File) {
    const n = file.name.toLowerCase();
    return n.endsWith('.heic') || n.endsWith('.heif');
  }
  return false;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob | null> {
  return new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', quality));
}

/** Decodifica imagen vía &lt;img&gt; (fallback cuando createImageBitmap falla / HEIC). */
async function decodeViaHtmlImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode_failed'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterToJpegBlob(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
  quality: number
): Promise<Blob | null> {
  const srcW = 'width' in source ? source.width : 0;
  const srcH = 'height' in source ? source.height : 0;
  if (!srcW || !srcH) return null;
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return canvasToJpeg(canvas, quality);
}

/** Primera página PDF → JPEG (pdfjs). */
async function pdfFirstPageToJpeg(file: File, maxEdge = 1600, quality = 0.85): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  try {
    const workerUrl = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    /* worker opcional en algunos bundles */
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, maxEdge / Math.max(unscaled.width, unscaled.height));
  const viewport = page.getViewport({ scale: Math.max(1, scale) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const blob = await canvasToJpeg(canvas, quality);
  if (!blob) throw new Error('jpeg');
  return blob;
}

/** Comprime imagen grande antes de OCR (PWA móvil / datos). */
export async function compressImageForOcr(
  file: Blob,
  maxEdge = 1600,
  quality = 0.82
): Promise<{ blob: Blob; filename: string }> {
  const mime = (file.type || '').toLowerCase();
  const looksImage =
    mime.startsWith('image/') || (!mime && typeof createImageBitmap === 'function');
  if (!looksImage || typeof document === 'undefined') {
    return { blob: file, filename: 'competencia.jpg' };
  }

  try {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        const blob = await rasterToJpegBlob(bitmap, maxEdge, quality);
        bitmap.close();
        if (blob) return { blob, filename: 'competencia.jpg' };
      } catch {
        /* fallback HTMLImage */
      }
    }
    const img = await decodeViaHtmlImage(file);
    const blob = await rasterToJpegBlob(img, maxEdge, quality);
    if (blob) return { blob, filename: 'competencia.jpg' };
  } catch {
    /* fall through */
  }

  if (isHeicLike(file)) {
    // No reenviar HEIC crudo: Ollama/moondream suele fallar.
    throw new Error('HEIC_UNSUPPORTED');
  }
  return { blob: file, filename: 'competencia.jpg' };
}

/**
 * Prepara foto o PDF competencia para OCR (siempre JPEG hacia Edge).
 */
export async function prepareCompetenciaForOcr(file: File): Promise<PrepareOcrResult> {
  try {
    if (isPdfFile(file)) {
      const blob = await pdfFirstPageToJpeg(file);
      if (blob.size > MAX_OCR_BYTES) {
        return {
          ok: false,
          error: 'PDF demasiado pesado tras convertir. Prueba un PDF de 1 página o una foto.',
        };
      }
      return { ok: true, blob, filename: 'competencia-pdf.jpg' };
    }
    const compressed = await compressImageForOcr(file);
    if (compressed.blob.size > MAX_OCR_BYTES) {
      return {
        ok: false,
        error: 'Imagen demasiado grande. Acerca el encuadre o baja la resolución.',
      };
    }
    return { ok: true, blob: compressed.blob, filename: compressed.filename };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'HEIC_UNSUPPORTED') {
      return {
        ok: false,
        error:
          'Este iPhone envió HEIC. En Ajustes → Cámara → Formatos elige Más compatible, o usa Importar PDF / JPG.',
      };
    }
    if (isPdfFile(file)) {
      return {
        ok: false,
        error:
          'No se pudo leer el PDF. Prueba otro archivo o una foto nítida de la primera página.',
      };
    }
    return {
      ok: false,
      error: 'No se pudo procesar la imagen. Prueba JPG/PNG o Importar PDF.',
    };
  }
}
