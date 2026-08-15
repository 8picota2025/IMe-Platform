/**
 * OCR presupuesto competencia (PWA): cámara/galería → Edge → borrador CMS.
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
  const { base64, mime } = await fileToBase64(input.file);
  const body: Record<string, string> = {
    image_base64: base64,
    mime,
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

/**
 * Abre picker en el mismo gesto del tap (iOS).
 * camera → capture=environment; gallery → sin capture (Android muestra galería).
 */
export function pickCompetenciaImage(mode: 'camera' | 'gallery'): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (mode === 'camera') input.setAttribute('capture', 'environment');
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

/** Comprime imagen grande antes de OCR (PWA móvil / datos). */
export async function compressImageForOcr(
  file: Blob,
  maxEdge = 1600,
  quality = 0.82
): Promise<{ blob: Blob; filename: string }> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
    return { blob: file, filename: 'competencia.jpg' };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return { blob: file, filename: 'competencia.jpg' };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>(res =>
      canvas.toBlob(b => res(b), 'image/jpeg', quality)
    );
    if (!blob) return { blob: file, filename: 'competencia.jpg' };
    return { blob, filename: 'competencia.jpg' };
  } catch {
    return { blob: file, filename: 'competencia.jpg' };
  }
}
