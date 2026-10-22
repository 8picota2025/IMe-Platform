/**
 * Enlaces accesorio ↔ equipo a partir del SKU publicado.
 * No se inventa un equipo padre si su SKU no está en el catálogo.
 */
import type { Producto } from './datos';

const REF_CAP = 6;

const PIEZA =
  /\b(?:para|tapon|tirillas?|lancetas?|filtro|repuesto|asiento|espaldar|balde|patas?|llantas?|aro|respaldo|kit|frenos?|reposapies|deslizador|faja)\b/;

function normalizar(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function skuDe(producto: Pick<Producto, 'sku'>): string {
  return (producto.sku ?? '').trim().toUpperCase();
}

/** Consumible, o equipo cuyo nombre/slug es una pieza o un repuesto. */
export function esPieza(producto: Pick<Producto, 'tipo_comercial' | 'nombre' | 'slug'>): boolean {
  if (producto.tipo_comercial === 'consumible') return true;
  return PIEZA.test(normalizar(`${producto.nombre} ${producto.slug}`));
}

function equipoPadre(pieza: Producto, todos: readonly Producto[]): Producto | null {
  const sku = skuDe(pieza);
  if (!sku || !esPieza(pieza)) return null;
  let mejor: Producto | null = null;
  let mejorLargo = 0;
  for (const candidato of todos) {
    if (candidato.slug === pieza.slug || esPieza(candidato)) continue;
    const padre = skuDe(candidato);
    if (!padre || padre.length <= mejorLargo) continue;
    if (sku.startsWith(`${padre}-`)) {
      mejor = candidato;
      mejorLargo = padre.length;
    }
  }
  return mejor;
}

/** Prefijo de SKU que no es otro producto (el equipo padre no está en el catálogo). */
function talloHuerfano(sku: string, skus: ReadonlySet<string>): string {
  if (!sku.includes('-')) return '';
  let tallo = sku.slice(0, sku.lastIndexOf('-'));
  while (tallo.length >= 6 && skus.has(tallo) && tallo.includes('-')) {
    tallo = tallo.slice(0, tallo.lastIndexOf('-'));
  }
  if (tallo.length < 6 || skus.has(tallo)) return '';
  return tallo;
}

function mismoTallo(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`);
}

function porSlug(a: Producto, b: Producto): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * Referencias por SKU primero (padre, hermanos de pieza, racimo huérfano),
 * luego productos de la misma familia hasta `limite`.
 */
export function seleccionarRelacionados(
  producto: Producto,
  mismaFamilia: readonly Producto[],
  todos: readonly Producto[],
  limite = 8
): Producto[] {
  const elegidos = new Map<string, Producto>();
  const agregar = (item: Producto): void => {
    if (elegidos.size >= REF_CAP || item.slug === producto.slug || elegidos.has(item.slug)) return;
    elegidos.set(item.slug, item);
  };

  const padre = equipoPadre(producto, todos);
  if (padre) {
    agregar(padre);
    for (const hermano of todos) {
      if (hermano.slug === producto.slug || !esPieza(hermano)) continue;
      if (equipoPadre(hermano, todos)?.slug === padre.slug) agregar(hermano);
    }
  } else if (!esPieza(producto)) {
    const hijos = todos
      .filter(
        item => item.slug !== producto.slug && equipoPadre(item, todos)?.slug === producto.slug
      )
      .sort(porSlug);
    for (const hijo of hijos) agregar(hijo);
  } else {
    const skus = new Set(todos.map(skuDe).filter(Boolean));
    const tallo = talloHuerfano(skuDe(producto), skus);
    if (tallo) {
      const pares = todos
        .filter(item => {
          if (item.slug === producto.slug || !esPieza(item) || equipoPadre(item, todos))
            return false;
          const otro = talloHuerfano(skuDe(item), skus);
          return otro !== '' && mismoTallo(tallo, otro);
        })
        .sort(porSlug);
      for (const par of pares) agregar(par);
    }
  }

  const referencias = [...elegidos.values()];
  const familia = mismaFamilia
    .filter(item => item.slug !== producto.slug && !elegidos.has(item.slug))
    .sort(porSlug);
  return [...referencias, ...familia].slice(0, limite);
}
