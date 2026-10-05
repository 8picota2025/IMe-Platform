/**
 * Productos de prueba o de muestra que existen en el catálogo (p. ej. para probar la
 * pasarela de pagos) pero nunca deben salir en grillas, enlaces ni sitemap públicos.
 * Mantener alineado con `scripts/sitemap-indexability.mjs`, que ya los excluye del sitemap.
 */
export const SLUGS_PRODUCTO_DE_PRUEBA: ReadonlySet<string> = new Set([
  'test',
  'test-de-pasarela-de-pagos',
  'ejemplo-producto',
  'producto-de-ejemplo',
]);

export function esProductoDePrueba(slug: unknown): boolean {
  return typeof slug === 'string' && SLUGS_PRODUCTO_DE_PRUEBA.has(slug);
}
