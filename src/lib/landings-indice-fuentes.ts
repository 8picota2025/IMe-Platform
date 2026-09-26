/**
 * Calcula el índice de landings desde las fuentes de copy. Lo usan el script que genera
 * `src/data/landings-indice.ts` y el test que comprueba que el índice sigue al día. No se
 * importa desde el admin: cargaría todo el copy en su bundle.
 */
import { getCampaignLanding, listCampaignLandingIds } from '../data/comercial-landings';
import { listFabricanteLandings } from '../data/fabricante-landings';
import { CITY_LANDINGS } from '../data/city-landings';
import { FAMILIA_SEO } from '../data/familia-seo';
import type { EntradaIndiceLanding } from '../data/landings-indice';

export function calcularIndiceLandings(): EntradaIndiceLanding[] {
  return [
    ...listCampaignLandingIds().map(id => {
      const c = getCampaignLanding(id, 'es');
      return { tipo: 'campana' as const, clave: id, nombre: c.tag, path: c.path, pathEn: c.pathEn };
    }),
    ...listFabricanteLandings('es').map(f => ({
      tipo: 'fabricante' as const,
      clave: f.id,
      nombre: f.brandName ?? f.tag,
      path: f.path,
      pathEn: f.pathEn,
    })),
    ...CITY_LANDINGS.map(c => ({
      tipo: 'ciudad' as const,
      clave: c.slug,
      nombre: c.name_es,
      path: `/es/ciudades/${c.slug}/`,
      pathEn: `/en/cities/${c.slug}/`,
    })),
    ...FAMILIA_SEO.map(f => ({
      tipo: 'familia' as const,
      clave: f.slug,
      nombre: f.name_es,
      path: `/es/familias/${f.slug}/`,
      pathEn: `/en/families/${f.slug}/`,
    })),
  ];
}
