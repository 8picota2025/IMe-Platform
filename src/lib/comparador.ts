/**
 * Estado del comparador de productos — localStorage, máx. 3 ítems.
 * Solo cliente. Compartido entre catálogo y landings de producto.
 */

const STORAGE_KEY = 'ime-comparador'
export const MAX_COMPARADOR = 3
export const COMPARADOR_EVENT = 'ime:comparador-change'

export function getComparador(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

function persist(slugs: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs))
  } catch {
    // localStorage no disponible: el comparador queda solo en memoria de la sesión actual
  }
  window.dispatchEvent(new CustomEvent(COMPARADOR_EVENT, { detail: slugs }))
}

/**
 * Añade o quita un slug del comparador. Si ya hay MAX_COMPARADOR y se intenta
 * añadir uno nuevo, no hace nada y devuelve { ok: false }.
 */
export function toggleComparador(slug: string): { slugs: string[]; ok: boolean } {
  const actuales = getComparador()
  if (actuales.includes(slug)) {
    const slugs = actuales.filter((s) => s !== slug)
    persist(slugs)
    return { slugs, ok: true }
  }
  if (actuales.length >= MAX_COMPARADOR) {
    return { slugs: actuales, ok: false }
  }
  const slugs = [...actuales, slug]
  persist(slugs)
  return { slugs, ok: true }
}

export function clearComparador(): void {
  persist([])
}
