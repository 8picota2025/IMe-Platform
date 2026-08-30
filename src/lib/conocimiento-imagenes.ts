/**
 * Imágenes de artículos del blog/conocimiento.
 *
 * Prioridad (resolverImagenArticulo):
 * 1. Mirror estático generado en build desde articulos.imagen (CMS)
 * 2. URL CMS articulos.imagen (Supabase)
 * 3. Fallback por slug/palabra SOLO si no hay imagen en CMS
 */
import { imagenMirrorParaArticulo } from './conocimiento-imagen-manifest';

export interface ImagenArticulo {
  src: string;
  width: number;
  height: number;
}

const POR_SLUG: Record<string, ImagenArticulo> = {
  'ime-certificaciones-calidad': {
    src: '/assets/img/equipos-biomedicos-vanguardia-opt.webp',
    width: 900,
    height: 900,
  },
  'ime-quienes-somos': {
    src: '/assets/img/tienda-material-biomedico-opt.webp',
    width: 1200,
    height: 800,
  },
  'ime-proceso-compra': {
    src: '/assets/img/venta-distribucion-equipos-biomedicos-opt.webp',
    width: 1100,
    height: 1375,
  },
  'ime-servicios': {
    src: '/assets/img/soporte-tecnico-especializado-opt.webp',
    width: 1200,
    height: 675,
  },
  'ime-financiamiento': {
    src: '/assets/img/asesoramiento-tecnico-especializado-opt.webp',
    width: 1100,
    height: 1375,
  },
  'como-elegir-un-monitor-biomedico': {
    src: '/assets/img/hospital-uci-pasillo.webp',
    width: 1400,
    height: 787,
  },
  'rutina-basica-de-mantenimiento-preventivo': {
    src: '/assets/img/equipamiento-biomedico-vanguardia.webp',
    width: 1200,
    height: 1200,
  },
  'como-preparar-una-solicitud-de-cotizacion': {
    src: '/assets/img/soluciones-biomedicas-opt.webp',
    width: 900,
    height: 506,
  },
  'avances-tecnologicos-diagnostico-tratamiento-institucional': {
    src: '/assets/img/avances-tecnologicos-diagnostico-tratamiento-colombia.webp',
    width: 1168,
    height: 784,
  },
  'robots-asistenciales-atencion-reduccion-carga-personal': {
    src: '/assets/img/robots-asistenciales-atencion-institucional-colombia.webp',
    width: 1168,
    height: 784,
  },
  'caminadores-para-adultos-guia-compra-colombia': {
    src: '/assets/img/caminadores-adultos-konfort-plus-colombia.webp',
    width: 1600,
    height: 1200,
  },
  'guia-monitores-multiparametricos-uci': {
    src: '/assets/img/hospital-uci-pasillo.webp',
    width: 1400,
    height: 787,
  },
};

const POR_PALABRA: Array<{ patron: RegExp; imagen: ImagenArticulo }> = [
  {
    patron: /certificacion|calidad|invima/,
    imagen: POR_SLUG['ime-certificaciones-calidad']!,
  },
  { patron: /servicio|soporte|mantenimiento/, imagen: POR_SLUG['ime-servicios']! },
  { patron: /financia/, imagen: POR_SLUG['ime-financiamiento']! },
  { patron: /compra|cotizacion|proceso/, imagen: POR_SLUG['ime-proceso-compra']! },
  {
    patron: /caminador|rollator|andador|movilidad/,
    imagen: POR_SLUG['caminadores-para-adultos-guia-compra-colombia']!,
  },
  { patron: /monitor|uci/, imagen: POR_SLUG['como-elegir-un-monitor-biomedico']! },
  {
    patron: /avance|tecnolog|diagnost|tratamiento/,
    imagen: POR_SLUG['avances-tecnologicos-diagnostico-tratamiento-institucional']!,
  },
  {
    patron: /robot|asistencial|padbot/,
    imagen: POR_SLUG['robots-asistenciales-atencion-reduccion-carga-personal']!,
  },
];

const POR_DEFECTO: ImagenArticulo = {
  src: '/assets/img/soluciones-biomedicas-opt.webp',
  width: 800,
  height: 479,
};

/** Fallback sin CMS (mock / artículo sin imagen). */
export function imagenParaArticulo(slug: string): ImagenArticulo {
  const directa = POR_SLUG[slug];
  if (directa) return directa;
  const porPalabra = POR_PALABRA.find(({ patron }) => patron.test(slug));
  return porPalabra?.imagen ?? POR_DEFECTO;
}

export interface ArticuloImagenInput {
  slug: string;
  imagen?: string | null;
}

/**
 * Fuente de verdad: imagen CMS. El mirror solo sirve esa misma imagen
 * optimizada; nunca se sustituye por un fallback de slug/keyword si hay CMS.
 */
export function resolverImagenArticulo(articulo: ArticuloImagenInput): ImagenArticulo {
  const cmsUrl = typeof articulo.imagen === 'string' ? articulo.imagen.trim() : '';
  if (cmsUrl) {
    const mirrored = imagenMirrorParaArticulo(articulo.slug);
    if (mirrored) return mirrored;
    return { src: cmsUrl, width: 1200, height: 675 };
  }
  const mirrored = imagenMirrorParaArticulo(articulo.slug);
  if (mirrored) return mirrored;
  return imagenParaArticulo(articulo.slug);
}

/** Absolute URL for JSON-LD / OG (handles already-absolute Supabase URLs). */
export function absoluteImagenUrl(src: string, site = 'https://i-me.com.co'): string {
  if (/^https?:\/\//i.test(src)) return src;
  const path = src.startsWith('/') ? src : `/${src}`;
  return `${site.replace(/\/$/, '')}${path}`;
}

const OG_SOCIAL_SIZE = { width: 1200, height: 630 } as const;

/**
 * Imagen para compartir en redes: prioriza variante OG del mirror (1200×630 crop).
 */
export function resolverOgImagenArticulo(articulo: ArticuloImagenInput): ImagenArticulo {
  const mirrored = imagenMirrorParaArticulo(articulo.slug);
  if (mirrored?.og_src) {
    return {
      src: mirrored.og_src,
      width: mirrored.og_width ?? OG_SOCIAL_SIZE.width,
      height: mirrored.og_height ?? OG_SOCIAL_SIZE.height,
    };
  }
  const hero = resolverImagenArticulo(articulo);
  if (/^https?:\/\//i.test(hero.src)) {
    return { ...hero, ...OG_SOCIAL_SIZE };
  }
  return { ...hero, ...OG_SOCIAL_SIZE };
}
