/**
 * OCR presupuesto competencia: cámara/galería → edge → espejo local.
 */
import { callEdgeFunction, toast, type EdgeFunctionResult } from './shared';
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

/** Espejo a `/home/shoky/0 IME/presupuestos comp` vía servidor local (si corre). */
export async function mirrorPresupuestoCompLocal(input: {
  filename: string;
  image_base64: string;
  meta: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const res = await fetch(MIRROR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ocrPresupuestoCompetencia(input: {
  file: Blob;
  filename?: string;
  quoteId?: string;
}): Promise<EdgeFunctionResult<OcrCompetenciaResult>> {
  const { base64, mime } = await fileToBase64(input.file);
  const edge = await callEdgeFunction<OcrCompetenciaResult>('comercial-ocr-presupuesto', {
    method: 'POST',
    body: {
      image_base64: base64,
      mime,
      filename: input.filename || 'competencia.jpg',
      quote_id: input.quoteId || undefined,
    },
  });
  if (edge.data?.local_filename && edge.data.ok) {
    const mirrored = await mirrorPresupuestoCompLocal({
      filename: edge.data.local_filename,
      image_base64: base64,
      meta: {
        quote_id: edge.data.quote_id,
        numero: edge.data.numero,
        twenty_opportunity_id: edge.data.twenty_opportunity_id,
        storage_path: edge.data.storage_path,
      },
    });
    if (mirrored) {
      toast('Foto guardada en presupuestos comp (local).', 'success');
    } else if (!edge.data.local_mirror?.ok) {
      // Descarga con nombre canónico como respaldo.
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(input.file);
        a.download = edge.data.local_filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast(
          'Guarda la foto en «0 IME/presupuestos comp» (o arranca el mirror local :3847).',
          'success'
        );
      } catch {
        /* ignore */
      }
    }
  }
  return edge;
}

/** Input file oculto: cámara o galería. */
export function pickCompetenciaImage(mode: 'camera' | 'gallery'): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (mode === 'camera') input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    const cleanup = () => {
      input.remove();
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    });
    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
