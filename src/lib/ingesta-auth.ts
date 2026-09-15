/**
 * Authorization for the CMS PDF ingest Edge Function.
 * Any authenticated storefront session is intentionally NOT enough —
 * only active admin_profiles with catalog/sales privileges may spend LLM budget.
 */

export const INGESTA_PDF_ROLES = ['owner', 'admin', 'catalogo', 'ventas'] as const;

export type IngestaPdfRole = (typeof INGESTA_PDF_ROLES)[number];

export function canInvokeIngestaPdf(
  profile: { rol?: string | null; activo?: boolean | null } | null | undefined
): boolean {
  if (!profile || profile.activo !== true) return false;
  const rol = profile.rol ?? '';
  return (INGESTA_PDF_ROLES as readonly string[]).includes(rol);
}
