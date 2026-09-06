/**
 * Composición IMEIA para el canal WhatsApp Cloud API.
 * Reutiliza catálogo publicado + guardrails (PR #82). Nunca llama al SOUL `imeia`.
 */

import {
  composeWhatsAppImeiaReply,
  type ComposedWhatsAppImeiaReply,
} from '../../../src/lib/whatsapp-cloud.ts';
import type { CatalogGroundingProduct } from '../../../src/lib/asesor-guardrails.ts';
import type { getServerSupabase } from './supabase-server.ts';

type Locale = 'es' | 'en';
type ServerClient = ReturnType<typeof getServerSupabase>;

interface ProductoRow {
  slug: unknown;
  sku: unknown;
  nombre_es: unknown;
  nombre_en: unknown;
  descripcion_corta_es: unknown;
  descripcion_corta_en: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizarConsulta(value: string): string[] {
  const stopwords = new Set([
    'al',
    'con',
    'de',
    'del',
    'el',
    'en',
    'la',
    'las',
    'le',
    'lo',
    'los',
    'me',
    'para',
    'por',
    'que',
    'se',
    'su',
    'un',
    'una',
    'y',
  ]);
  return normalizeSearchText(value)
    .split(' ')
    .filter(token => token.length >= 2 && !stopwords.has(token));
}

export async function buscarProductosCatalogoWhatsApp(
  supabase: ServerClient,
  mensaje: string,
  locale: Locale
): Promise<CatalogGroundingProduct[]> {
  const consulta = normalizeSearchText(mensaje);
  const tokens = tokenizarConsulta(mensaje);
  if (!consulta || tokens.length === 0) return [];

  const { data, error } = await supabase
    .from('productos')
    .select('slug, sku, nombre_es, nombre_en, descripcion_corta_es, descripcion_corta_en')
    .eq('activo', true);
  if (error || !data) return [];

  return (data as ProductoRow[])
    .map(product => {
      const nombre =
        locale === 'en'
          ? asString(product.nombre_en) || asString(product.nombre_es)
          : asString(product.nombre_es);
      const slug = asString(product.slug);
      const sku = asString(product.sku);
      const descripcion =
        locale === 'en'
          ? asString(product.descripcion_corta_en) || asString(product.descripcion_corta_es)
          : asString(product.descripcion_corta_es);
      const nombreNormalizado = normalizeSearchText(nombre);
      const slugNormalizado = normalizeSearchText(slug);
      const skuNormalizado = normalizeSearchText(sku);
      const descripcionNormalizada = normalizeSearchText(descripcion);
      let score = 0;
      if (slugNormalizado && consulta.includes(slugNormalizado)) score += 500;
      if (skuNormalizado && consulta.includes(skuNormalizado)) score += 500;
      if (nombreNormalizado && consulta.includes(nombreNormalizado)) score += 420;
      for (const token of tokens) {
        if (nombreNormalizado.includes(token)) score += 40;
        if (slugNormalizado.includes(token)) score += 35;
        if (skuNormalizado.includes(token)) score += 45;
        if (descripcionNormalizada.includes(token)) score += 12;
      }
      return {
        slug,
        nombre: nombre || slug,
        descripcion_corta: descripcion || null,
        url_canonica:
          locale === 'en'
            ? `https://i-me.com.co/en/products/${slug}`
            : `https://i-me.com.co/es/productos/${slug}`,
        score,
      };
    })
    .filter(item => item.slug && item.score >= 90)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score: _score, ...product }) => product);
}

export async function composeImeiaWhatsAppReply(params: {
  mensaje: string;
  locale: Locale;
  supabase: ServerClient | null;
}): Promise<ComposedWhatsAppImeiaReply> {
  let products: CatalogGroundingProduct[] = [];
  if (params.supabase) {
    try {
      products = await buscarProductosCatalogoWhatsApp(
        params.supabase,
        params.mensaje,
        params.locale
      );
    } catch (err) {
      console.warn(
        '[whatsapp-imeia] catalogo no disponible:',
        err instanceof Error ? err.message : err
      );
    }
  }
  return composeWhatsAppImeiaReply({
    mensaje: params.mensaje,
    locale: params.locale,
    products,
  });
}
