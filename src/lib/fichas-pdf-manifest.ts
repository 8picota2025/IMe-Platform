import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Manifest de fichas PDF espejadas en el hosting por scripts/mirror-fichas-pdf.mjs.
 * Solo para el build (SSG): lectura vía fs para no romper si no existe.
 */
export interface FichaPdfMirror {
  src: string;
  source_url: string;
  bytes: number;
  sha1: string;
}

const MANIFEST_PATH = path.resolve(process.cwd(), 'src/data/generated/fichas-pdf.json');
let cache: Record<string, FichaPdfMirror> | null = null;

function manifest(): Record<string, FichaPdfMirror> {
  if (cache) return cache;
  if (!existsSync(MANIFEST_PATH)) {
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as Record<string, FichaPdfMirror>;
  } catch {
    cache = {};
  }
  return cache;
}

/** Ruta local (/assets/productos/<slug>/ficha-tecnica.pdf) si el PDF de Storage se espejó. */
export function fichaPdfEspejo(slug: string, fichaPdf: string | null | undefined): string | null {
  const entry = manifest()[slug];
  if (!entry || !fichaPdf || entry.source_url !== fichaPdf) return null;
  return entry.src;
}
