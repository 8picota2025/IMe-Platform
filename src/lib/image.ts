/**
 * URLs de imágenes optimizadas para Supabase Storage.
 *
 * Las imágenes ajenas o locales se conservan tal cual: alterar sus rutas
 * cambiaría el contrato de publicación. Las que están en Supabase usan su
 * endpoint de transformación para reducir bytes sin duplicar archivos.
 */
type ImageFormat = 'avif' | 'webp';

const SUPABASE_OBJECT_PATH = '/storage/v1/object/public/';
const SUPABASE_RENDER_PATH = '/storage/v1/render/image/public/';

export function isSupabaseStorageImage(source: string): boolean {
  try {
    const url = new URL(source);
    return url.hostname.endsWith('.supabase.co') && url.pathname.startsWith(SUPABASE_OBJECT_PATH);
  } catch {
    return false;
  }
}

export function getOptimizedImageUrl(
  source: string,
  width: number,
  format: ImageFormat,
  quality = 76
): string {
  try {
    const url = new URL(source);
    if (!isSupabaseStorageImage(source)) {
      return source;
    }

    url.pathname = url.pathname.replace(SUPABASE_OBJECT_PATH, SUPABASE_RENDER_PATH);
    url.searchParams.set('width', String(width));
    url.searchParams.set('quality', String(quality));
    url.searchParams.set('format', format);
    return url.toString();
  } catch {
    return source;
  }
}
