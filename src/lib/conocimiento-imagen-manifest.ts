import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Lee (en build time / SSR) el manifest generado por
 * scripts/mirror-cms-images.mjs, que mapea slug de articulo -> imagen
 * optimizada y servida como asset estatico del propio sitio (en vez de
 * proxear en vivo la URL de Supabase Storage).
 *
 * Lectura via fs (no import estatico) para no romper el build si el
 * manifest aun no se genero (build local sin credenciales de Supabase).
 *
 * Resuelto contra process.cwd() (no import.meta.url): el pipeline SSG de
 * Astro reubica los modulos compilados a una carpeta de prerender
 * transitoria, así que una ruta relativa al archivo fuente original
 * apuntaría al lugar equivocado.
 */

export interface ImagenMirror {
  src: string;
  width: number;
  height: number;
}

const MANIFEST_PATH = path.resolve(process.cwd(), 'src/data/generated/articulo-imagenes.json');

let cache: Record<string, ImagenMirror> | null = null;

function loadManifest(): Record<string, ImagenMirror> {
  if (cache) return cache;
  if (!existsSync(MANIFEST_PATH)) {
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as Record<string, ImagenMirror>;
  } catch {
    cache = {};
  }
  return cache;
}

export function imagenMirrorParaArticulo(slug: string): ImagenMirror | undefined {
  return loadManifest()[slug];
}
