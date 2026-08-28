/**
 * Ingesta de ficha PDF → producto borrador → línea de cotización.
 * Compartido entre `/comercial` y admin `#/cotizacion`.
 */
import {
  buildIngestUserPrompt,
  deriveEnrichedFields,
  inferFamiliaSugerida,
  inferTipoSugerido,
  type EspecItem,
} from './pdf-ingest-enrich';
import { resolveCatalogUnitPrice } from './cotizacion-oferta';
import type { CotizacionLineaOferta } from './cotizacion-oferta';
import type { CatalogProductHit } from './catalog-search';

export const QUOTE_INGEST_PDF_MAX_BYTES = 25 * 1024 * 1024;

export interface QuoteIngestDraft {
  nombre_es: string;
  nombre_en: string;
  slug: string;
  descripcion_corta_es: string;
  descripcion_larga_es: string;
  especificaciones: EspecItem[];
  aplicaciones_es: string[];
  beneficios_es: string[];
  valor_es: string;
  marca: string;
  ficha_pdf: string;
}

type RevisableField = { valor?: string };
type IngestJson = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function revisableValor(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'valor' in (value as RevisableField)) {
    return str((value as RevisableField).valor);
  }
  return '';
}

function revisableList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => revisableValor(item)).filter(Boolean);
}

export function slugifyProductName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function uniqueProductSlug(base: string): string {
  const clean = slugifyProductName(base) || 'producto';
  return `${clean}-${Date.now().toString(36)}`;
}

export function parseIngestDraftResponse(json: IngestJson, pdfUrl = ''): QuoteIngestDraft | null {
  const productoEs =
    json.producto_es && typeof json.producto_es === 'object'
      ? (json.producto_es as IngestJson)
      : json;
  const nombre_es = revisableValor(productoEs.nombre);
  if (!nombre_es) return null;
  const productoEn =
    json.producto_en_borrador && typeof json.producto_en_borrador === 'object'
      ? (json.producto_en_borrador as IngestJson)
      : {};
  const specsRaw = Array.isArray(productoEs.especificaciones) ? productoEs.especificaciones : [];
  const especificaciones: EspecItem[] = specsRaw
    .map(item => {
      const row = item && typeof item === 'object' ? (item as IngestJson) : {};
      const grupo = revisableValor(row.grupo);
      return {
        clave: revisableValor(row.clave),
        valor: revisableValor(row.valor),
        ...(grupo ? { grupo } : {}),
      };
    })
    .filter(s => s.clave || s.valor);
  return {
    nombre_es,
    nombre_en: revisableValor(productoEn.nombre) || nombre_es,
    slug: slugifyProductName(nombre_es),
    descripcion_corta_es: revisableValor(productoEs.descripcion_corta),
    descripcion_larga_es: revisableValor(productoEs.descripcion_larga),
    especificaciones,
    aplicaciones_es: revisableList(productoEs.aplicaciones),
    beneficios_es: revisableList(productoEs.beneficios),
    valor_es: revisableValor(productoEs.valor_institucional),
    marca: revisableValor(productoEs.marca),
    ficha_pdf: pdfUrl,
  };
}

/** Fallback local cuando la Edge no responde (misma heurística que admin). */
export function buildLocalIngestDraftFromText(pdfText: string, pdfUrl: string): QuoteIngestDraft {
  const clean = pdfText
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const title =
    clean.find(line => line.length > 8 && line.length < 140 && !/^pagina\s+\d+/i.test(line)) ??
    'Producto importado desde PDF';
  const description = clean
    .filter(line => line.length > 35 && !/^pagina\s+\d+/i.test(line))
    .slice(0, 4)
    .join(' ')
    .slice(0, 900);
  const specs: EspecItem[] = clean
    .filter(line => line.includes(':') && line.length < 180)
    .slice(0, 12)
    .map(line => {
      const [clave, ...rest] = line.split(':');
      return { clave: (clave ?? '').trim(), valor: rest.join(':').trim() };
    })
    .filter(s => s.clave && s.valor);
  const enriched = deriveEnrichedFields({
    nombre: title,
    descripcionCorta: description.slice(0, 240),
    descripcionLarga: description,
    especificaciones: specs,
    aplicaciones: [],
    textoCompleto: pdfText,
  });
  return {
    nombre_es: title,
    nombre_en: title,
    slug: slugifyProductName(title),
    descripcion_corta_es: description.slice(0, 240),
    descripcion_larga_es: description,
    especificaciones: specs,
    aplicaciones_es: [],
    beneficios_es: enriched.beneficios_es,
    valor_es: enriched.valor_es,
    marca: enriched.marca,
    ficha_pdf: pdfUrl,
  };
}

export function buildProductImportRow(
  draft: QuoteIngestDraft,
  options: { activo?: boolean; slug?: string; precio?: number | null } = {}
): Record<string, unknown> {
  const slug = options.slug?.trim() || draft.slug || uniqueProductSlug(draft.nombre_es);
  const atributos: Record<string, unknown> = {
    origen_ingesta: 'quote_pdf',
    familia_sugerida: inferFamiliaSugerida(`${draft.nombre_es} ${draft.descripcion_larga_es}`),
    tipo_sugerido: inferTipoSugerido(`${draft.nombre_es} ${draft.descripcion_larga_es}`),
  };
  if (draft.beneficios_es.length) atributos.beneficios_es = draft.beneficios_es;
  if (draft.valor_es) atributos.valor_es = draft.valor_es;
  if (draft.marca) atributos.marca = draft.marca;
  const row: Record<string, unknown> = {
    slug,
    nombre_es: draft.nombre_es,
    nombre_en: draft.nombre_en || draft.nombre_es,
    descripcion_corta_es: draft.descripcion_corta_es || null,
    descripcion_larga_es: draft.descripcion_larga_es || null,
    especificaciones: draft.especificaciones,
    aplicaciones_es: draft.aplicaciones_es,
    ficha_pdf: draft.ficha_pdf || null,
    atributos,
    tipo_comercial: 'equipo',
    fulfillment_mode: 'cotizacion',
    moneda: 'COP',
    activo: options.activo ?? false,
    destacado: false,
    nuevo: false,
    orden: 0,
  };
  if (options.precio != null && options.precio > 0) row.precio = options.precio;
  return row;
}

export function catalogHitToQuoteLine(
  hit: CatalogProductHit,
  moneda: 'COP' | 'USD',
  cantidad = 1
): CotizacionLineaOferta {
  const precio = resolveCatalogUnitPrice(hit);
  const lineMoneda = precio > 0 ? (hit.moneda === 'USD' ? 'USD' : 'COP') : moneda;
  return {
    slug: hit.slug,
    nombre: hit.nombre_es,
    cantidad: Math.max(1, cantidad),
    precio_unitario: precio,
    subtotal: precio > 0 ? Math.round(precio * cantidad * 100) / 100 : 0,
    moneda: lineMoneda,
    ...(precio <= 0 ? { precio_pendiente_validar: true } : {}),
  };
}

export function draftToQuoteLine(
  draft: QuoteIngestDraft,
  slug: string,
  moneda: 'COP' | 'USD',
  cantidad: number,
  precio: number
): CotizacionLineaOferta {
  const qty = Math.max(1, cantidad);
  const unit = Math.max(0, precio);
  if (unit <= 0) {
    return {
      slug,
      nombre: draft.nombre_es,
      cantidad: qty,
      precio_unitario: 0,
      subtotal: 0,
      moneda,
      precio_pendiente_validar: true,
    };
  }
  return {
    slug,
    nombre: draft.nombre_es,
    cantidad: qty,
    precio_unitario: unit,
    subtotal: Math.round(unit * qty * 100) / 100,
    moneda,
  };
}

let pdfWorkerSrcPromise: Promise<string> | null = null;

async function resolvePdfWorkerSrc(): Promise<string> {
  if (!pdfWorkerSrcPromise) {
    pdfWorkerSrcPromise = (async () => {
      const builtWorkerUrl = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
        import.meta.url
      ).toString();
      try {
        const response = await fetch(builtWorkerUrl);
        if (!response.ok) throw new Error(`Worker HTTP ${response.status}`);
        const code = await response.text();
        return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      } catch {
        return builtWorkerUrl;
      }
    })();
  }
  return pdfWorkerSrcPromise;
}

export async function extractPdfTextFromFile(file: File): Promise<string> {
  if (file.size > QUOTE_INGEST_PDF_MAX_BYTES) {
    throw new Error('El PDF supera 25 MB.');
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = await resolvePdfWorkerSrc();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, 40);
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ('str' in item ? String(item.str) : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push(text);
  }
  return pages.join('\n\n').slice(0, 120000);
}

export { buildIngestUserPrompt };
