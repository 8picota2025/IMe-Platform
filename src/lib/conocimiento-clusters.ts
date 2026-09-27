/**
 * Topic clusters del Centro de Conocimiento (ADR-0014, Fase 2 del Growth
 * Engine). Lógica pura sobre artículos ya cargados: agrupar por tema, elegir
 * artículos relacionados y parsear borradores de preview. Sin acceso a datos.
 */
import type { Locale } from '../i18n/utils';

/** /es/conocimiento/… y /en/knowledge/… (los temas: /tema/ y /topic/). */
export const rutasConocimiento = {
  indice: (locale: Locale) => (locale === 'en' ? '/en/knowledge' : '/es/conocimiento'),
  articulo: (locale: Locale, slug: string) =>
    locale === 'en' ? `/en/knowledge/${slug}` : `/es/conocimiento/${slug}`,
  tema: (locale: Locale, slug: string) =>
    locale === 'en' ? `/en/knowledge/topic/${slug}` : `/es/conocimiento/tema/${slug}`,
};

export interface TopicClusterRef {
  slug: string;
  nombre: string;
}

export interface ArticuloConCluster {
  slug: string;
  titulo: string;
  cluster: TopicClusterRef | null;
  tags: string[];
  created_at: string;
}

export interface TemaConArticulos<T extends ArticuloConCluster> {
  cluster: TopicClusterRef;
  articulos: T[];
}

/** Artículo pilar de un tema: se marca con la etiqueta `pilar`. */
export const TAG_PILAR = 'pilar';

export function esPilar(articulo: Pick<ArticuloConCluster, 'tags'>): boolean {
  return articulo.tags.includes(TAG_PILAR);
}

/** Pilar primero; el resto, del más reciente al más antiguo. */
function ordenTema<T extends ArticuloConCluster>(a: T, b: T): number {
  const pilar = Number(esPilar(b)) - Number(esPilar(a));
  if (pilar !== 0) return pilar;
  return b.created_at.localeCompare(a.created_at);
}

/** Temas que tienen al menos un artículo, ordenados por número de artículos. */
export function agruparPorTema<T extends ArticuloConCluster>(
  articulos: T[]
): TemaConArticulos<T>[] {
  const porSlug = new Map<string, TemaConArticulos<T>>();
  for (const articulo of articulos) {
    if (!articulo.cluster) continue;
    const tema = porSlug.get(articulo.cluster.slug) ?? {
      cluster: articulo.cluster,
      articulos: [],
    };
    tema.articulos.push(articulo);
    porSlug.set(articulo.cluster.slug, tema);
  }
  return [...porSlug.values()]
    .map(tema => ({ ...tema, articulos: [...tema.articulos].sort(ordenTema) }))
    .sort(
      (a, b) =>
        b.articulos.length - a.articulos.length ||
        a.cluster.nombre.localeCompare(b.cluster.nombre, 'es')
    );
}

/**
 * Otros artículos del mismo tema (pilar primero), para enlazado interno.
 * Vacío si el artículo no tiene tema.
 */
export function relacionadosEnTema<T extends ArticuloConCluster>(
  articulo: T,
  todos: T[],
  limite = 4
): T[] {
  if (!articulo.cluster) return [];
  const slugTema = articulo.cluster.slug;
  return todos
    .filter(otro => otro.slug !== articulo.slug && otro.cluster?.slug === slugTema)
    .sort(ordenTema)
    .slice(0, limite);
}

/* ============================================================
   Borradores de preview
   ============================================================ */

export interface Borrador {
  slug: string;
  titulo_es: string;
  titulo_en: string;
  cluster: string;
  tags: string[];
  cuerpo_es: string;
  cuerpo_en: string;
}

const SEPARADOR_EN = /^<!--\s*en\s*-->$/m;

/**
 * Formato de un borrador (`src/data/conocimiento-borradores/<slug>.md`):
 *
 *   ---
 *   slug: registro-sanitario-invima-equipos-medicos
 *   titulo_es: ...
 *   titulo_en: ...
 *   cluster: invima-regulacion
 *   tags: pilar, registro-sanitario
 *   ---
 *   (cuerpo en español, markdown)
 *   <!-- en -->
 *   (cuerpo en inglés, markdown; opcional)
 *
 * Devuelve null si falta un campo obligatorio: un borrador mal formado no
 * debe colarse en el preview como si estuviera completo.
 */
export function parseBorrador(raw: string): Borrador | null {
  const match = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const [, cabecera = '', cuerpo = ''] = match;
  const campos = new Map<string, string>();
  for (const linea of cabecera.split('\n')) {
    const i = linea.indexOf(':');
    if (i <= 0) continue;
    campos.set(linea.slice(0, i).trim(), linea.slice(i + 1).trim());
  }
  const slug = campos.get('slug') ?? '';
  const titulo_es = campos.get('titulo_es') ?? '';
  const cluster = campos.get('cluster') ?? '';
  const [cuerpo_es = '', cuerpo_en = ''] = cuerpo.split(SEPARADOR_EN).map(parte => parte.trim());
  if (!slug || !titulo_es || !cluster || !cuerpo_es) return null;
  return {
    slug,
    titulo_es,
    titulo_en: campos.get('titulo_en') ?? '',
    cluster,
    tags: (campos.get('tags') ?? '')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean),
    cuerpo_es,
    cuerpo_en,
  };
}
