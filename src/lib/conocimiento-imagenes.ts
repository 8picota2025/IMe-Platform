/**
 * Los artículos del CMS no tienen campo de imagen: se asigna una imagen
 * real del proyecto por slug (con fallback por palabra clave) para las
 * tarjetas y cabeceras del centro de conocimiento.
 */
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
};

const POR_PALABRA: Array<{ patron: RegExp; imagen: ImagenArticulo }> = [
  {
    patron: /certificacion|calidad|invima/,
    imagen: POR_SLUG['ime-certificaciones-calidad']!,
  },
  { patron: /servicio|soporte|mantenimiento/, imagen: POR_SLUG['ime-servicios']! },
  { patron: /financia/, imagen: POR_SLUG['ime-financiamiento']! },
  { patron: /compra|cotizacion|proceso/, imagen: POR_SLUG['ime-proceso-compra']! },
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
  src: '/assets/img/soluciones-biomedicas-opt.jpg',
  width: 800,
  height: 479,
};

export function imagenParaArticulo(slug: string): ImagenArticulo {
  const directa = POR_SLUG[slug];
  if (directa) return directa;
  const porPalabra = POR_PALABRA.find(({ patron }) => patron.test(slug));
  return porPalabra?.imagen ?? POR_DEFECTO;
}
