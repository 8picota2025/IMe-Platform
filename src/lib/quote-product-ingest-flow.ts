/**
 * Orquestación: PDF ficha → borrador ingesta → producto → línea cotización.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildLocalIngestDraftFromText,
  buildProductImportRow,
  extractPdfTextFromFile,
  parseIngestDraftResponse,
  uniqueProductSlug,
  type QuoteIngestDraft,
} from './quote-product-ingest';

function slugifyFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function uploadQuoteIngestPdf(supabase: SupabaseClient, file: File): Promise<string> {
  const path = `ingesta/${Date.now()}-${slugifyFileName(file.name)}`;
  const { error } = await supabase.storage.from('fichas').upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from('fichas').getPublicUrl(path).data.publicUrl;
}

export async function fetchIngestDraftFromPdf(
  file: File,
  options: {
    supabase: SupabaseClient;
    invokeIngestaPdf: (body: { pdf_text: string; pdf_url: string }) => Promise<unknown>;
  }
): Promise<{ draft: QuoteIngestDraft; pdfUrl: string; pdfText: string }> {
  const pdfText = await extractPdfTextFromFile(file);
  if (!pdfText.trim()) {
    throw new Error('El PDF no tiene texto seleccionable. Pega el texto o usa otro archivo.');
  }
  const pdfUrl = await uploadQuoteIngestPdf(options.supabase, file);
  let json: unknown;
  try {
    json = await options.invokeIngestaPdf({ pdf_text: pdfText, pdf_url: pdfUrl });
  } catch {
    json = null;
  }
  const parsed =
    json && typeof json === 'object'
      ? parseIngestDraftResponse(json as Record<string, unknown>, pdfUrl)
      : null;
  const draft = parsed ?? buildLocalIngestDraftFromText(pdfText, pdfUrl);
  return { draft, pdfUrl, pdfText };
}

export async function importProductFromDraft(
  importProduct: (row: Record<string, unknown>) => Promise<void>,
  draft: QuoteIngestDraft,
  options: {
    slug?: string;
    precio?: number | null;
    activo?: boolean;
  } = {}
): Promise<{ slug: string; nombre_es: string }> {
  const slug = options.slug?.trim() || draft.slug || uniqueProductSlug(draft.nombre_es);
  const row = buildProductImportRow(draft, {
    slug,
    precio: options.precio ?? null,
    activo: options.activo ?? false,
  });
  await importProduct(row);
  return { slug, nombre_es: draft.nombre_es };
}

export async function callAdminImportProduct(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sesión expirada.');
  const url = `${import.meta.env['PUBLIC_SUPABASE_URL']}/functions/v1/admin-import`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env['PUBLIC_SUPABASE_ANON_KEY'] as string,
    },
    body: JSON.stringify({ entity: 'productos', rows: [row] }),
  });
  const json = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    ok?: boolean;
  } | null;
  if (!response.ok) {
    throw new Error(json?.error?.message ?? `Importación falló (${response.status})`);
  }
}
