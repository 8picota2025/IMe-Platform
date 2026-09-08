/**
 * Guards for admin-import productos rows.
 *
 * ventas may create inactive drafts for quote ingest, but must never resolve
 * to / overwrite an existing live catalog row (by slug, sku, or client-supplied id).
 */

export type ProductImportRow = Record<string, unknown>;

export interface ExistingProductRef {
  id: string;
}

/**
 * Strip client-supplied id and force activo=false for ventas draft imports.
 */
export function prepareVentasProductDraftRows(rows: ProductImportRow[]): ProductImportRow[] {
  return rows.map(row => {
    const { id: _id, ...rest } = row;
    return { ...rest, activo: false };
  });
}

/**
 * Resolve slug/sku matches to existing product ids. When forbidExisting is true
 * (ventas draft path), any match throws so live catalog rows cannot be mutated.
 */
export function resolveProductImportRows(
  rows: ProductImportRow[],
  existingBySku: Map<string, ExistingProductRef>,
  existingBySlug: Map<string, ExistingProductRef>,
  options: { forbidExisting?: boolean } = {}
): ProductImportRow[] {
  const forbidExisting = options.forbidExisting === true;

  return rows.map((row, index) => {
    const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
    const sku = typeof row.sku === 'string' ? row.sku.trim() : '';
    const bySku = sku ? (existingBySku.get(sku) ?? null) : null;
    const bySlug = slug ? (existingBySlug.get(slug) ?? null) : null;

    if (bySku && bySlug && bySku.id !== bySlug.id) {
      throw new Error(
        `Fila ${index + 2}: sku ${sku} ya pertenece a otro producto distinto del slug ${slug}.`
      );
    }

    const existing = bySku ?? bySlug;
    if (existing) {
      if (forbidExisting) {
        const key = bySku ? `sku ${sku}` : `slug ${slug}`;
        throw new Error(
          `Fila ${index + 2}: ${key} ya existe en el catalogo. El rol ventas solo puede crear borradores nuevos (activo=false), no modificar productos existentes.`
        );
      }
      return { ...row, id: existing.id };
    }

    // Drop stray client id so a forged UUID cannot target an existing row.
    if (forbidExisting && 'id' in row) {
      const { id: _id, ...rest } = row;
      return rest;
    }

    return row;
  });
}
