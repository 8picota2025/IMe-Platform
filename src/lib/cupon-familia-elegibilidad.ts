/**
 * Coupon family filters are stored as TEXT[] of family slugs (admin UI) or
 * occasionally raw UUIDs. Product rows expose familia_id as UUID — comparing
 * slug≡UUID never matches and makes exclusions fail-open (discount applies
 * to families the admin intended to exclude).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export interface FamiliaFilterResolved {
  /** True when the coupon listed at least one family ref (slug or uuid). */
  configured: boolean;
  /** Resolved familia.id values (lowercase). */
  ids: Set<string>;
}

/**
 * Resolve coupon family refs (slugs and/or UUIDs) against a slug→id map.
 * `configured` stays true even if no slug resolves (typos) so inclusions
 * fail closed instead of treating an empty resolved set as “no filter”.
 */
export function resolveFamiliaFilter(
  refs: readonly string[] | null | undefined,
  familiasBySlug: ReadonlyMap<string, string>
): FamiliaFilterResolved {
  const cleaned = (refs ?? []).map(r => String(r ?? '').trim()).filter(Boolean);
  if (cleaned.length === 0) return { configured: false, ids: new Set() };

  const ids = new Set<string>();
  for (const ref of cleaned) {
    if (looksLikeUuid(ref)) {
      ids.add(ref.toLowerCase());
      continue;
    }
    const id = familiasBySlug.get(ref);
    if (id) ids.add(String(id).toLowerCase());
  }
  return { configured: true, ids };
}

export function isCuponLineaElegible(args: {
  slug: string;
  familiaId: string | null | undefined;
  productosIncluidos: ReadonlySet<string>;
  productosExcluidos: ReadonlySet<string>;
  familiasIncluidas: FamiliaFilterResolved;
  familiasExcluidas: FamiliaFilterResolved;
}): boolean {
  const slug = String(args.slug ?? '');
  const familiaId = args.familiaId ? String(args.familiaId).toLowerCase() : '';

  if (args.productosExcluidos.has(slug)) return false;
  if (familiaId && args.familiasExcluidas.ids.has(familiaId)) return false;

  if (args.productosIncluidos.size > 0 && !args.productosIncluidos.has(slug)) return false;
  if (args.familiasIncluidas.configured) {
    if (!familiaId || !args.familiasIncluidas.ids.has(familiaId)) return false;
  }
  return true;
}
