/**
 * Búsqueda rápida de productos activos (cotizaciones admin + comercial).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CatalogProductHit {
  id: string;
  slug: string;
  sku: string | null;
  nombre_es: string;
  precio?: number | null;
  precio_oferta?: number | null;
  precio_regular?: number | null;
  moneda?: string | null;
}

export async function searchCatalogProducts(
  supabase: SupabaseClient,
  q: string
): Promise<CatalogProductHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const safe = term.replace(/[%_,]/g, '');
  if (!safe) return [];
  const { data, error } = await supabase
    .from('productos')
    .select('id,slug,sku,nombre_es,precio,precio_oferta,precio_regular,moneda')
    .eq('activo', true)
    .or(`nombre_es.ilike.%${safe}%,sku.ilike.%${safe}%,slug.ilike.%${safe}%`)
    .order('nombre_es', { ascending: true })
    .limit(20);
  if (error) return [];
  return (data ?? []) as CatalogProductHit[];
}
