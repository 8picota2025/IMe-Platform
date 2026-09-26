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
import { isSupabaseConfigured, getSupabaseClient } from './supabase';
import {
  getCampaignLanding,
  listCampaignLandingIds,
  type CampaignLandingContent,
  type StandardCampaignLandingId,
} from '../data/comercial-landings';
import {
  mezclarLandingCampana,
  validarCopyCampana,
  type CopyCampana,
  type TipoLanding,
} from './landings-cms-schema';

export * from './landings-cms-schema';

export interface FilaLanding {
  tipo: TipoLanding;
  clave: string;
  contenido_es: unknown;
  contenido_en: unknown;
  version?: number;
}

/** Indexa y valida las filas de campaña; lanza con el detalle si alguna no cumple. */
export function indexarFilasCampana(filas: FilaLanding[]): Map<string, FilaLanding> {
  const ids = new Set<string>(listCampaignLandingIds());
  const mapa = new Map<string, FilaLanding>();
  const problemas: string[] = [];
  for (const fila of filas) {
    if (fila.tipo !== 'campana') continue;
    if (!ids.has(fila.clave)) {
      problemas.push(`landing «${fila.clave}»: no existe en el código (rutas y página)`);
      continue;
    }
    for (const locale of ['es', 'en'] as const) {
      for (const e of validarCopyCampana(fila[`contenido_${locale}`])) {
        problemas.push(`landing «${fila.clave}» (${locale}): ${e}`);
      }
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

/** «La tabla aún no existe»: el deploy puede correr antes de aplicar la migración. */
function esTablaInexistente(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  return (
    /landings/.test(error.message ?? '') && /does not exist|schema cache/i.test(error.message ?? '')
  );
}

const REQUIRE_LIVE_DATA = import.meta.env?.['REQUIRE_LIVE_DATA'] === 'true';

async function cargarFilasCampana(): Promise<Map<string, FilaLanding>> {
  if (!isSupabaseConfigured()) return new Map();
  const supabase = getSupabaseClient()!;
  const { data, error } = await supabase
    .from('landings')
    .select('tipo, clave, contenido_es, contenido_en, version')
    .eq('tipo', 'campana');
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
  return indexarFilasCampana((data ?? []) as FilaLanding[]);
}

let cacheCampana: Promise<Map<string, FilaLanding>> | null = null;

function filasCampana(): Promise<Map<string, FilaLanding>> {
  cacheCampana ??= cargarFilasCampana();
  return cacheCampana;
}

/** Landing de campaña para la build: la versión publicada en el CMS o, si no hay, el código. */
export async function getCampaignLandingCms(
  id: StandardCampaignLandingId,
  locale: Locale
): Promise<CampaignLandingContent> {
  const base = getCampaignLanding(id, locale);
  const fila = (await filasCampana()).get(id);
  if (!fila) return base;
  return mezclarLandingCampana(base, fila[`contenido_${locale}`] as CopyCampana);
}

export async function listCampaignLandingsCms(locale: Locale): Promise<CampaignLandingContent[]> {
  return Promise.all(listCampaignLandingIds().map(id => getCampaignLandingCms(id, locale)));
}
