/**
 * Índice de catálogo para búsqueda y filtros en cliente.
 * Generado en build a partir de la capa de datos (mock⇄Supabase).
 */

import type { Locale } from '../i18n/utils';
import { getFamilias, getProductos, getTipos, type Producto } from './datos';
import { getFamiliasFiltro } from './taxonomia-catalogo';

export interface CatalogoIndexItem {
  id: string;
  slug: string;
  nombre: string;
  familia: { slug: string; nombre: string };
  familias_filtro: string[];
  tipo: { slug: string; nombre: string } | null;
  descripcion_corta: string;
  imagen_principal: string | null;
  tipo_comercial: Producto['tipo_comercial'];
  fulfillment_mode: Producto['fulfillment_mode'];
  precio?: number;
  moneda: string;
  stock: number | null;
  disponible: boolean;
  destacado: boolean;
  nuevo: boolean;
  texto_busqueda: string;
  especificaciones_reducidas: Record<string, string>;
}

export const CATALOG_PAGE_SIZE = 48;

export interface CatalogPage<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

/**
 * Parte una lista ya ordenada sin alterar su orden canónico. Las rutas Astro
 * usan esta función para que cada PDP tenga una única posición paginada.
 */
export function paginateCatalogItems<T>(
  items: readonly T[],
  page: number,
  pageSize = CATALOG_PAGE_SIZE
): CatalogPage<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
  if (normalizedPage > pageCount) return { items: [], page: normalizedPage, pageCount, total };
  const start = (normalizedPage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: normalizedPage, pageCount, total };
}

/**
 * Minúsculas + sin acentos, para búsqueda y comparación tolerante.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function reducirEspecificaciones(especificaciones: unknown[]): Record<string, string> {
  const reducidas: Record<string, string> = {};
  for (const spec of especificaciones) {
    if (
      spec &&
      typeof spec === 'object' &&
      'clave' in spec &&
      'valor' in spec &&
      typeof (spec as { clave: unknown }).clave === 'string' &&
      typeof (spec as { valor: unknown }).valor === 'string'
    ) {
      reducidas[(spec as { clave: string }).clave] = (spec as { valor: string }).valor;
    }
  }
  return reducidas;
}

const catalogIndexCache = new Map<Locale, Promise<CatalogoIndexItem[]>>();

async function buildCatalogoIndexUncached(locale: Locale): Promise<CatalogoIndexItem[]> {
  const familias = await getFamilias(locale);
  const productos = await getProductos({ pageSize: 1000 }, locale);

  const tiposPorFamilia = new Map<string, Map<string, { slug: string; nombre: string }>>();
  for (const familia of familias) {
    const tipos = await getTipos(familia.slug, locale);
    tiposPorFamilia.set(
      familia.id,
      new Map(tipos.map(tipo => [tipo.id, { slug: tipo.slug, nombre: tipo.nombre }]))
    );
  }

  return productos.map((producto): CatalogoIndexItem => {
    const familia = familias.find(f => f.slug === producto.familia_slug);
    const tipo = producto.tipo_id
      ? (tiposPorFamilia.get(producto.familia_id)?.get(producto.tipo_id) ?? null)
      : null;
    const especificacionesReducidas = reducirEspecificaciones(producto.especificaciones);

    const textoBusqueda = normalizarTexto(
      [
        producto.nombre,
        producto.descripcion_corta,
        familia?.nombre ?? '',
        tipo?.nombre ?? '',
        ...Object.values(especificacionesReducidas),
      ].join(' ')
    );

    const item: CatalogoIndexItem = {
      id: producto.id,
      slug: producto.slug,
      nombre: producto.nombre,
      familia: { slug: producto.familia_slug, nombre: familia?.nombre ?? producto.familia_slug },
      familias_filtro: getFamiliasFiltro(producto),
      tipo,
      descripcion_corta: producto.descripcion_corta,
      imagen_principal: producto.imagen_principal,
      tipo_comercial: producto.tipo_comercial,
      fulfillment_mode: producto.fulfillment_mode,
      moneda: producto.moneda,
      stock: producto.stock,
      disponible: producto.disponible,
      destacado: producto.destacado,
      nuevo: producto.nuevo,
      texto_busqueda: textoBusqueda,
      especificaciones_reducidas: especificacionesReducidas,
    };
    if (producto.precio != null) item.precio = producto.precio;
    return item;
  });
}

/** Comparte una sola lectura del catálogo por idioma durante cada build estático. */
export function buildCatalogoIndex(locale: Locale): Promise<CatalogoIndexItem[]> {
  const cached = catalogIndexCache.get(locale);
  if (cached) return cached;
  const pending = buildCatalogoIndexUncached(locale);
  catalogIndexCache.set(locale, pending);
  return pending;
}

/**
 * Genera facetas desde especificaciones_reducidas.
 * Solo incluye claves con 2 o más valores distintos (filtro útil).
 */
export function buildFacetas(items: CatalogoIndexItem[]): Record<string, string[]> {
  const valoresPorClave = new Map<string, Set<string>>();
  for (const item of items) {
    for (const [clave, valor] of Object.entries(item.especificaciones_reducidas)) {
      if (!valoresPorClave.has(clave)) valoresPorClave.set(clave, new Set());
      valoresPorClave.get(clave)!.add(valor);
    }
  }
  const facetas: Record<string, string[]> = {};
  for (const [clave, valores] of valoresPorClave) {
    if (valores.size >= 2) facetas[clave] = [...valores].sort();
  }
  return facetas;
}
