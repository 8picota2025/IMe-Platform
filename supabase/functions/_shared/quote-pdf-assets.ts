/**
 * Assets + annex enrichment for IPS-style quote PDFs (Edge).
 */
// deno-lint-ignore-file no-explicit-any
import type { CotizacionLineaOferta } from '../../../src/lib/cotizacion-oferta.ts';
import type { QuotePdfAnnex } from './render-quote-pdf.ts';

type ProductRow = Record<string, unknown>;

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveImageUrl(raw: unknown, siteUrl: string): string | null {
  const src = String(raw ?? '').trim();
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/')) return `${siteUrl}${src}`;
  return `${siteUrl}/${src}`;
}

function imageCandidates(url: string): string[] {
  const out = [url];
  if (/\.(webp|avif)(\?|$)/i.test(url)) {
    out.push(url.replace(/\.(webp|avif)(\?|$)/i, '.jpg$2'));
    out.push(url.replace(/\.(webp|avif)(\?|$)/i, '.png$2'));
    out.push(url.replace(/\.(webp|avif)(\?|$)/i, '.jpeg$2'));
  }
  return out;
}

async function fetchImageBytes(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  for (const candidate of imageCandidates(url)) {
    try {
      const res = await fetch(candidate);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength < 32) continue;
      const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      if (isJpg || isPng) return bytes;
    } catch {
      /* next */
    }
  }
  return null;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function readLocalFont(
  name: 'Poppins-Regular.ttf' | 'Poppins-Bold.ttf'
): Promise<Uint8Array | null> {
  try {
    return await Deno.readFile(new URL(`./fonts/${name}`, import.meta.url));
  } catch {
    return null;
  }
}

export async function loadQuotePdfFonts(siteUrl: string): Promise<{
  regular: Uint8Array | null;
  bold: Uint8Array | null;
}> {
  const base = siteUrl.replace(/\/$/, '');
  const regular =
    (await readLocalFont('Poppins-Regular.ttf')) ||
    (await fetchBytes(`${base}/fonts/Poppins-Regular.ttf`)) ||
    (await fetchBytes(
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Regular.ttf'
    ));
  const bold =
    (await readLocalFont('Poppins-Bold.ttf')) ||
    (await fetchBytes(`${base}/fonts/Poppins-Bold.ttf`)) ||
    (await fetchBytes(
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Bold.ttf'
    ));
  return { regular, bold };
}

export async function loadQuotePdfLogo(siteUrl: string): Promise<Uint8Array | null> {
  const base = siteUrl.replace(/\/$/, '');
  for (const path of ['/assets/img/logo-ime-pdf.png', '/assets/img/logo-ime.png']) {
    const bytes = await fetchBytes(`${base}${path}`);
    if (bytes?.byteLength) return bytes;
  }
  return null;
}

export async function buildQuoteAnnexes(
  // Supabase client shape varies between Edge helpers; only `.from().select()...` is used.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lineas: CotizacionLineaOferta[],
  siteUrl: string
): Promise<QuotePdfAnnex[]> {
  const base = siteUrl.replace(/\/$/, '');
  const slugs = [...new Set(lineas.map(l => l.slug).filter(Boolean))];
  const bySlug = new Map<string, ProductRow>();

  if (slugs.length > 0) {
    const { data } = await supabase
      .from('productos')
      .select(
        'slug,sku,nombre_es,descripcion_corta_es,descripcion_larga_es,especificaciones,aplicaciones_es,imagen_principal'
      )
      .in('slug', slugs)
      .eq('activo', true);
    for (const row of (data ?? []) as ProductRow[]) {
      bySlug.set(String(row.slug ?? ''), row);
    }
  }

  const annexes: QuotePdfAnnex[] = [];
  for (const l of lineas) {
    const row = bySlug.get(l.slug);
    const corta = String(row?.descripcion_corta_es ?? '').trim();
    const larga = stripHtml(String(row?.descripcion_larga_es ?? ''));
    const specs = Array.isArray(row?.especificaciones) ? row!.especificaciones : [];
    const apps = Array.isArray(row?.aplicaciones_es) ? row!.aplicaciones_es : [];
    const caracteristicas: string[] = [];
    for (const s of specs) {
      if (!s || typeof s !== 'object') continue;
      const rec = s as Record<string, unknown>;
      const k = String(rec.clave ?? '').trim();
      const v = String(rec.valor ?? '').trim();
      if (k && v) caracteristicas.push(`${k}: ${v}`);
      else if (v) caracteristicas.push(v);
    }
    for (const a of apps) {
      const t = String(a ?? '').trim();
      if (t) caracteristicas.push(t);
    }
    const imageBytes = await fetchImageBytes(resolveImageUrl(row?.imagen_principal, base));
    annexes.push({
      slug: l.slug || String(row?.slug ?? ''),
      nombre: String(row?.nombre_es ?? l.nombre),
      sku: typeof row?.sku === 'string' ? row.sku : null,
      resumen: corta || l.nombre,
      descripcion: larga || corta || l.nombre,
      caracteristicas,
      url: l.slug ? `${base}/es/productos/${l.slug}/` : null,
      imageBytes,
    });
  }
  return annexes;
}
