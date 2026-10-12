/**
 * Landings en el CMS (Fase 3B, ADR-0015, `docs/growth-engine/fase3b-plan.md`).
 *
 * - Esquema de campos editables (texto y fotos, nunca diseño ni rutas) compartido por la
 *   build y por el editor del admin.
 * - Validación estricta: una fila que no cumple rompe la build con el campo exacto; nunca se
 *   publica una landing rota ni se cae en silencio a otro texto.
 * - Carga en build: lo publicado en `landings` sustituye al copy del TypeScript; lo que aún no
 *   esté en la tabla sigue saliendo de `src/data/comercial-landings.ts`.
 */
import type { Locale } from '../i18n/utils';
import type { FabricanteLandingId } from './comercial-leads';
import { isSupabaseConfigured, getSupabaseClient } from './supabase';
import {
  getCampaignLanding,
  listCampaignLandingIds,
  type CampaignLandingContent,
  type StandardCampaignLandingId,
} from '../data/comercial-landings';
import { getFabricanteLanding, listFabricanteLandingIds } from '../data/fabricante-landings';
import { getCityLanding, listCitySlugs, type CityLanding } from '../data/city-landings';
import { getFamiliaSeo, listFamiliaSeoSlugs, type FamiliaSeoContent } from '../data/familia-seo';
import {
  mezclarCiudad,
  mezclarFamilia,
  mezclarLandingCampana,
  validarCopyLanding,
  validarParIdiomas,
  type CopyCampana,
  type TipoLanding,
  type TipoLandingCampana,
} from './landings-cms-schema';

export * from './landings-cms-schema';

export interface FilaLanding {
  tipo: TipoLanding;
  clave: string;
  contenido_es: unknown;
  contenido_en: unknown;
  version?: number;
}

const IDS_POR_TIPO: Record<TipoLanding, () => string[]> = {
  campana: listCampaignLandingIds,
  fabricante: listFabricanteLandingIds,
  ciudad: listCitySlugs,
  familia: listFamiliaSeoSlugs,
};

/** Indexa y valida las filas de un tipo; lanza con el detalle si alguna no cumple. */
export function indexarFilas(tipo: TipoLanding, filas: FilaLanding[]): Map<string, FilaLanding> {
  const ids = new Set<string>(IDS_POR_TIPO[tipo]());
  const mapa = new Map<string, FilaLanding>();
  const problemas: string[] = [];
  for (const fila of filas) {
    if (fila.tipo !== tipo) continue;
    if (!ids.has(fila.clave)) {
      problemas.push(`landing «${fila.clave}»: no existe en el código (rutas y página)`);
      continue;
    }
    for (const locale of ['es', 'en'] as const) {
      for (const e of validarCopyLanding(fila[`contenido_${locale}`], tipo)) {
        problemas.push(`landing «${fila.clave}» (${locale}): ${e}`);
      }
    }
    for (const e of validarParIdiomas(
      tipo,
      fila.contenido_es as CopyCampana,
      fila.contenido_en as CopyCampana
    )) {
      problemas.push(`landing «${fila.clave}»: ${e}`);
    }
    mapa.set(fila.clave, fila);
  }
  if (problemas.length > 0) {
    throw new Error(
      `[landings-cms] Contenido inválido en la tabla landings:\n- ${problemas.join('\n- ')}`
    );
  }
  return mapa;
}

/** Filas de campaña (se mantiene para los tests de la tanda 1). */
export function indexarFilasCampana(filas: FilaLanding[]): Map<string, FilaLanding> {
  return indexarFilas('campana', filas);
}

/** «La tabla aún no existe»: el deploy puede correr antes de aplicar la migración. */
function esTablaInexistente(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  return (
    /landings/.test(error.message ?? '') && /does not exist|schema cache/i.test(error.message ?? '')
  );
}

const REQUIRE_LIVE_DATA = import.meta.env?.['REQUIRE_LIVE_DATA'] === 'true';

async function cargarFilas(tipo: TipoLanding): Promise<Map<string, FilaLanding>> {
  if (!isSupabaseConfigured()) return new Map();
  const supabase = getSupabaseClient()!;
  const { data, error } = await supabase
    .from('landings')
    .select('tipo, clave, contenido_es, contenido_en, version')
    .eq('tipo', tipo);
  if (error) {
    if (esTablaInexistente(error)) {
      console.warn('[landings-cms] La tabla landings aún no existe: se usa el copy del código.');
      return new Map();
    }
    if (REQUIRE_LIVE_DATA)
      throw new Error(`[landings-cms] Supabase landings falló: ${error.message}`);
    console.error(
      '[landings-cms] Supabase landings falló, se usa el copy del código:',
      error.message
    );
    return new Map();
  }
  return indexarFilas(tipo, (data ?? []) as FilaLanding[]);
}

const cache = new Map<TipoLanding, Promise<Map<string, FilaLanding>>>();

function filasDe(tipo: TipoLanding): Promise<Map<string, FilaLanding>> {
  let filas = cache.get(tipo);
  if (!filas) {
    filas = cargarFilas(tipo);
    cache.set(tipo, filas);
  }
  return filas;
}

async function conCms(
  tipo: TipoLandingCampana,
  base: CampaignLandingContent,
  clave: string,
  locale: Locale
): Promise<CampaignLandingContent> {
  const fila = (await filasDe(tipo)).get(clave);
  if (!fila) return base;
  return mezclarLandingCampana(base, fila[`contenido_${locale}`] as CopyCampana);
}

/** Landing de campaña para la build: la versión publicada en el CMS o, si no hay, el código. */
export async function getCampaignLandingCms(
  id: StandardCampaignLandingId,
  locale: Locale
): Promise<CampaignLandingContent> {
  return conCms('campana', getCampaignLanding(id, locale), id, locale);
}

export async function listCampaignLandingsCms(locale: Locale): Promise<CampaignLandingContent[]> {
  return Promise.all(listCampaignLandingIds().map(id => getCampaignLandingCms(id, locale)));
}

/** Landing de fabricante para la build (tanda 2). */
export async function getFabricanteLandingCms(
  id: FabricanteLandingId,
  locale: Locale
): Promise<CampaignLandingContent> {
  return conCms('fabricante', getFabricanteLanding(id, locale), id, locale);
}

export async function listFabricanteLandingsCms(locale: Locale): Promise<CampaignLandingContent[]> {
  return Promise.all(listFabricanteLandingIds().map(id => getFabricanteLandingCms(id, locale)));
}

/** Landing de ciudad para la build (tanda 3): CMS si está publicada, si no el código. */
export async function getCityLandingCms(slug: string): Promise<CityLanding | undefined> {
  const base = getCityLanding(slug);
  if (!base) return undefined;
  const fila = (await filasDe('ciudad')).get(slug);
  if (!fila) return base;
  return mezclarCiudad(base, fila.contenido_es as CopyCampana, fila.contenido_en as CopyCampana);
}

/** Texto SEO de familia para la build (tanda 3): CMS si está publicado, si no el código. */
export async function getFamiliaSeoCms(slug: string): Promise<FamiliaSeoContent | undefined> {
  const base = getFamiliaSeo(slug);
  if (!base) return undefined;
  const fila = (await filasDe('familia')).get(slug);
  if (!fila) return base;
  return mezclarFamilia(base, fila.contenido_es as CopyCampana, fila.contenido_en as CopyCampana);
}
