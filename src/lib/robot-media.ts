/**
 * Medios de robots importados.
 *
 * El slug público (SEO) no coincide con el directorio legado en
 * `public/assets/productos/importados/`. Construir la ruta con el slug
 * público produce 404 aunque el archivo exista.
 */

export const ROBOT_ASSET_DIR: Record<string, string> = {
  'padbot-x3-robot-recepcion-ref-padbot-x3-padbot': 'padbot-x3-robot-recepcion',
  'padbot-x2-robot-servicio-interactivo-ref-padbot-x2-padbot':
    'padbot-x2-robot-servicio-interactivo',
  'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot': 'padbot-p2-robot-telepresencia',
  'padbot-w2-robot-delivery-institucional-ref-padbot-w2-padbot':
    'padbot-w2-robot-delivery-institucional',
  'padbot-w3s-robot-delivery-alimentos-ref-padbot-w3s-padbot':
    'padbot-w3s-robot-delivery-alimentos',
  'c3-robot-limpieza-autonoma-ref-c3-cleaning-robot': 'c3-robot-limpieza-autonoma',
  'padbot-t2-robot-educativo-social-ref-padbot-t2-padbot': 'padbot-t2-robot-educativo-social',
  'cruzr-robot-comercial-inteligente-ref-cruzr-ahuman-future-ahuman-future':
    'cruzr-robot-comercial-inteligente-ahuman-future',
};

export const ROBOT_IMPORT_GALLERY_COUNT: Record<string, number> = {
  'padbot-x3-robot-recepcion-ref-padbot-x3-padbot': 2,
  'padbot-x2-robot-servicio-interactivo-ref-padbot-x2-padbot': 2,
  'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot': 2,
  'padbot-w2-robot-delivery-institucional-ref-padbot-w2-padbot': 2,
  'padbot-w3s-robot-delivery-alimentos-ref-padbot-w3s-padbot': 2,
  'c3-robot-limpieza-autonoma-ref-c3-cleaning-robot': 2,
  'padbot-t2-robot-educativo-social-ref-padbot-t2-padbot': 2,
  'cruzr-robot-comercial-inteligente-ref-cruzr-ahuman-future-ahuman-future': 1,
};

const ROBOT_MEDIA_SEO_SLUG: Record<string, string> = {
  'cruzr-robot-comercial-inteligente-ref-cruzr-ahuman-future-ahuman-future':
    'robot-asistencial-recepcion-hospitalaria-cruzr-ahuman-future',
  'padbot-x3-robot-recepcion-ref-padbot-x3-padbot':
    'robot-asistencial-recepcion-clinicas-hospitales-padbot-x3',
  'padbot-x2-robot-servicio-interactivo-ref-padbot-x2-padbot':
    'robot-asistencial-servicio-interactivo-clinicas-hospitales-padbot-x2',
  'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot':
    'robot-telepresencia-telemedicina-tercera-edad-padbot-p2',
  'padbot-w2-robot-delivery-institucional-ref-padbot-w2-padbot':
    'robot-delivery-hospitalario-industrial-logistica-padbot-w2',
  'padbot-w3s-robot-delivery-alimentos-ref-padbot-w3s-padbot':
    'robot-delivery-alimentos-restaurantes-hospitales-padbot-w3s',
  'c3-robot-limpieza-autonoma-ref-c3-cleaning-robot':
    'robot-limpieza-industrial-hospitalaria-autonoma-c3',
  'padbot-t2-robot-educativo-social-ref-padbot-t2-padbot':
    'robot-educativo-social-tercera-edad-padbot-t2',
};

export function robotAssetDirectory(slug: string): string | null {
  if (!(slug in ROBOT_IMPORT_GALLERY_COUNT)) return null;
  return ROBOT_ASSET_DIR[slug] ?? slug;
}

export function robotImportedAssetPath(slug: unknown, filename: string): string | null {
  if (typeof slug !== 'string') return null;
  const dir = robotAssetDirectory(slug);
  if (!dir) return null;
  return `/assets/productos/importados/${dir}/${filename}`;
}

function robotMediaFilename(
  slug: string,
  role: 'robot-producto' | 'robot-galeria',
  index?: number
): string {
  const seoSlug = ROBOT_MEDIA_SEO_SLUG[slug] ?? slug;
  const suffix = typeof index === 'number' ? `-${String(index).padStart(2, '0')}` : '';
  return `${role}-${seoSlug}${suffix}.webp`;
}

export function robotImportedMainImage(slug: unknown): string | null {
  if (typeof slug !== 'string' || !(slug in ROBOT_IMPORT_GALLERY_COUNT)) return null;
  return robotImportedAssetPath(slug, robotMediaFilename(slug, 'robot-producto'));
}

export function robotImportedGallery(slug: unknown): string[] | null {
  if (typeof slug !== 'string' || !(slug in ROBOT_IMPORT_GALLERY_COUNT)) return null;
  const main = robotImportedMainImage(slug);
  if (!main) return null;
  const count = ROBOT_IMPORT_GALLERY_COUNT[slug] ?? 0;
  return [
    main,
    ...Array.from({ length: count }, (_, index) => {
      const path = robotImportedAssetPath(
        slug,
        robotMediaFilename(slug, 'robot-galeria', index + 2)
      );
      return path ?? '';
    }).filter(path => path.length > 0),
  ];
}

/** Ruta de ficha PDF dentro del directorio legado. `null` si el slug no es un robot importado. */
export function robotImportedPdfPath(slug: unknown, value: unknown): string | null {
  if (typeof slug !== 'string' || !robotAssetDirectory(slug)) return null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const filename = value.split('?')[0]?.split('/').pop();
  if (!filename) return null;
  return robotImportedAssetPath(slug, filename);
}
