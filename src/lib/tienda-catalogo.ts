/**
 * Categorías de tienda con precio público (IVA incluido vía resolvePrecioPublico).
 * No inventa precios: el rango sale de las fichas activas del catálogo.
 */
import type { Locale } from '../i18n/utils';
import { buildCatalogoIndex, type CatalogoIndexItem } from './catalogo';
import { getProductosBySlugs, type Producto } from './datos';
import { formatMoneda, tienePrecioPublico } from './format';
import { truncateMetaDescription } from './seo';

export type TiendaCategoria = 'sillas' | 'caminadores' | 'bastones' | 'tensiometros';

const TIPO: Record<TiendaCategoria, string> = {
  sillas: 'sillas-de-ruedas',
  caminadores: 'caminadores-y-andadores',
  bastones: 'bastones-y-muletas',
  tensiometros: 'tensiometros',
};

/** Accesorios y repuestos que no son el equipo que rankea la categoría. */
const EXCLUIR: Record<TiendaCategoria, RegExp | null> = {
  sillas: null,
  caminadores: /tapon|recaton/,
  bastones: /recaton|manilar|axilar|muleta/,
  tensiometros: /adaptador/,
};

const INCLUIR: Record<TiendaCategoria, RegExp | null> = {
  sillas: null,
  caminadores: null,
  bastones: /baston/,
  tensiometros: /tensiometro-digital/,
};

export function itemDeTienda(item: CatalogoIndexItem, categoria: TiendaCategoria): boolean {
  if (item.tipo?.slug !== TIPO[categoria]) return false;
  const slug = item.slug;
  const incluir = INCLUIR[categoria];
  if (incluir && !incluir.test(slug)) return false;
  const excluir = EXCLUIR[categoria];
  if (excluir && excluir.test(slug)) return false;
  return true;
}

export function rangoPrecios(
  items: Array<{ precio?: number | null }>
): { min: number; max: number; count: number } | null {
  const precios = items
    .map(item => item.precio)
    .filter((precio): precio is number => tienePrecioPublico(precio))
    .sort((a, b) => a - b);
  const min = precios[0];
  const max = precios[precios.length - 1];
  if (min === undefined || max === undefined) return null;
  return { min, max, count: precios.length };
}

export function textoSeoTienda(
  locale: Locale,
  categoria: TiendaCategoria,
  rango: { min: number; max: number; count: number }
): { title: string; description: string; h1: string; lead: string } {
  const min = formatMoneda(rango.min, 'COP', locale) ?? '';
  const max = formatMoneda(rango.max, 'COP', locale) ?? '';
  const es = locale === 'es';
  const envio = es ? 'envío a Colombia' : 'shipping to Colombia';
  const entrega = es
    ? 'Entrega en menos de 10 días hábiles.'
    : 'Delivery in under 10 business days.';
  const nombres = {
    sillas: es ? 'Sillas de ruedas' : 'Wheelchairs',
    caminadores: es ? 'Caminadores para adultos' : 'Adult walkers',
    bastones: es ? 'Bastones' : 'Walking canes',
    tensiometros: es ? 'Tensiómetros digitales' : 'Digital blood pressure monitors',
  } as const;
  const nombre = nombres[categoria];
  const title = es ? `${nombre} desde ${min} | ${envio}` : `${nombre} from ${min} | ${envio}`;
  // El precio sigue en el title, el lead y la ficha. La meta no publica cifras.
  const description = truncateMetaDescription(
    es
      ? `${nombre} en el catálogo I-ME. Vea el precio en cada ficha o cotice por WhatsApp. Envío a Colombia. ${entrega}`
      : `${nombre} in the I-ME catalog. See the price on each product page or request a quote. Shipping and support in Colombia.`
  );
  const h1 = es ? `${nombre} con precio publicado` : `${nombre} with a published price`;
  const lead = es
    ? `${nombre} desde ${min} hasta ${max} COP, IVA incluido. Envío a Colombia. ${entrega} El flete no está incluido en el precio.`
    : `${nombre} from ${min} to ${max} COP, VAT included. Shipping to Colombia. ${entrega} Freight is not included in the price.`;
  return { title, description, h1, lead };
}

export function conSeoTienda<
  T extends {
    title: string;
    description: string;
    h1: string;
    lead: string;
    faqs: Array<{ q: string; a: string }>;
  },
>(
  content: T,
  locale: Locale,
  categoria: TiendaCategoria,
  rango: { min: number; max: number; count: number } | null
): T {
  if (!rango) return content;
  const seo = textoSeoTienda(locale, categoria, rango);
  const envio =
    locale === 'es'
      ? {
          q: '¿Hacen envío a Colombia y en qué plazo?',
          a: 'Sí, hay envío a Colombia. La entrega es en menos de 10 días hábiles. El flete no está incluido en el precio publicado.',
        }
      : {
          q: 'Do you ship to Colombia, and how soon?',
          a: 'Yes, we ship to Colombia. Delivery is in under 10 business days. Freight is not included in the published price.',
        };
  const faqs = content.faqs.filter(
    f => !/precio está en la web|price on the website/i.test(`${f.q} ${f.a}`)
  );
  if (!faqs.some(f => /envío a colombia|ship to colombia/i.test(f.q))) faqs.push(envio);
  return {
    ...content,
    title: seo.title,
    description: seo.description,
    h1: seo.h1,
    lead: seo.lead,
    faqs,
  };
}

/** Ficha de tensiómetro digital → página de familia de la tienda. */
export function enlaceFamiliaTensiometro(
  locale: Locale,
  slug: string
): { href: string; label: string } | null {
  if (!/tensiometro-digital/.test(slug)) return null;
  return locale === 'es'
    ? { href: '/es/tensiometros-digitales/', label: 'Ver tensiómetros digitales' }
    : {
        href: '/en/digital-blood-pressure-monitors/',
        label: 'See digital blood pressure monitors',
      };
}

export async function productosTienda(
  locale: Locale,
  categoria: TiendaCategoria
): Promise<{ productos: Producto[]; rango: { min: number; max: number; count: number } | null }> {
  const indice = await buildCatalogoIndex(locale);
  const items = indice.filter(item => itemDeTienda(item, categoria));
  const slugs = items.map(item => item.slug);
  const productos = (await getProductosBySlugs(slugs, locale)).sort((a, b) => {
    const ap = tienePrecioPublico(a.precio) ? a.precio : Number.POSITIVE_INFINITY;
    const bp = tienePrecioPublico(b.precio) ? b.precio : Number.POSITIVE_INFINITY;
    return ap - bp || a.nombre.localeCompare(b.nombre, locale);
  });
  return { productos, rango: rangoPrecios(productos) };
}
