/**
 * Slug seguro para artículos del blog. Evita URLs pegadas (https://...)
 * y caracteres inválidos en rutas estáticas.
 */
export function slugifyArticulo(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Extrae segmento final si pegaron URL completa; luego slugify. */
export function sanitizeArticuloSlug(value: string): string {
  let raw = String(value ?? '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      raw = parts[parts.length - 1] ?? '';
    } catch {
      raw = raw.replace(/^https?:\/\//i, '').replace(/^\/+/, '');
    }
  }

  raw = raw.replace(/^\/+|\/+$/g, '');
  return slugifyArticulo(raw);
}

const RESERVED_ARTICULO_SLUGS = new Set([
  'conocimiento',
  'knowledge',
  'publicar',
  'publish',
  'blog',
  'articulos',
  'articles',
]);

export function isValidArticuloSlug(slug: string): boolean {
  if (!slug || slug.length > 120) return false;
  if (slug.includes('://') || /^https?:/i.test(slug)) return false;
  if (RESERVED_ARTICULO_SLUGS.has(slug)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
