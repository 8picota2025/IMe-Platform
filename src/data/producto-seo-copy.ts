/**
 * Title, meta, H1 e intro de fichas concretas.
 * No cambia el nombre de catálogo ni inventa precio, marca o ficha.
 */
import type { Locale } from '../i18n/utils';
import { seoZuowei } from './zuowei-catalogo';

export interface ProductoSeoCopy {
  title: string;
  description: string;
  /** Sin h1/intro la ficha conserva el nombre del producto como H1 y su descripción corta. */
  h1?: string;
  intro?: string;
}

// Locale ausente → getProductoSeoCopy usa el fallback (seoZuowei) para ese idioma.
const COPY: Record<string, { es?: ProductoSeoCopy; en?: ProductoSeoCopy }> = {
  // UniX AI (robots humanoides y cuadrúpedo). Solo title/description: el H1 no cambia.
  // Cifras de las fichas del fabricante ya publicadas en mock-productos.json.
  'unix-wanda-2-0-pro-robot-humanoide-ref-wanda-2-0-pro-unix': {
    es: {
      title: 'Robot humanoide UniX Wanda 2.0 Pro en Colombia | I-ME',
      description:
        'Robot humanoide UniX Wanda 2.0 Pro: 23 GDL, brazos biónicos de 8 GDL, LiDAR y Jetson Orin NX 16G. Cotización por proyecto con I-ME en Colombia.',
    },
    en: {
      title: 'UniX Wanda 2.0 Pro Humanoid Robot in Colombia | I-ME',
      description:
        'UniX Wanda 2.0 Pro humanoid robot: 23 DoF, 8-DoF bionic arms, LiDAR and Jetson Orin NX 16G. Project-based quote from I-ME in Colombia and LATAM.',
    },
  },
  'unix-panther-pro-robot-humanoide-ref-panther-pro-unix': {
    es: {
      title: 'UniX Panther Pro: robot humanoide con ruedas en Colombia | I-ME',
      description:
        'UniX Panther Pro: humanoide con base omnidireccional 4WD, 34 GDL, brazos de 8 GDL y Jetson Orin NX 16G. Cotización por proyecto con I-ME en Colombia.',
    },
    en: {
      title: 'UniX Panther Pro Wheeled Humanoid Robot in Colombia | I-ME',
      description:
        'UniX Panther Pro wheeled humanoid: omnidirectional 4WD base, 34 DoF, 8-DoF arms, Jetson Orin NX 16G. Project-based quote from I-ME in Colombia.',
    },
  },
  'unix-pioneer-h-robot-cuadrupedo-ref-pioneer-h-unix': {
    es: {
      title: 'UniX Pioneer H: robot cuadrúpedo industrial en Colombia | I-ME',
      description:
        'UniX Pioneer H: cuadrúpedo industrial IP67 de ~41 kg con ruedas en las patas, carga de 25 kg y dos LiDAR 3D. Cotización por proyecto con I-ME en Colombia.',
    },
    en: {
      title: 'UniX Pioneer H Industrial Quadruped Robot in Colombia | I-ME',
      description:
        'UniX Pioneer H industrial quadruped: IP67, ~41 kg, wheel-on-leg, 25 kg payload, two 3D LiDARs. Project-based quote from I-ME in Colombia.',
    },
  },
  // arreglos011126 — PadBot C3 (ES/EN). Fuente: ficha técnica del fabricante (parámetros básicos).
  'c3-robot-limpieza-autonoma-ref-c3-cleaning-robot': {
    es: {
      title: 'Robot de limpieza autónoma C3 en Colombia | I-ME',
      description:
        'Robot de limpieza autónoma C3: batería de 46 Ah, duración de 2 a 3,5 h y ruido menor de 70 dB. Cotice por WhatsApp o en línea.',
      h1: 'Robot de limpieza autónoma C3 en Colombia',
      intro:
        'Robot de limpieza autónoma C3 con batería de 46 Ah, duración de 2 a 3,5 h, ruido menor de 70 dB y estación de carga con tiempo de carga de 2,5 h. Precio bajo cotización.',
    },
    en: {
      title: 'C3 autonomous cleaning robot in Colombia | I-ME',
      description:
        'C3 autonomous cleaning robot: 46 Ah battery, 2 to 3.5 h runtime and noise below 70 dB. Quote by WhatsApp or online.',
      h1: 'C3 autonomous cleaning robot in Colombia',
      intro:
        'C3 autonomous cleaning robot with a 46 Ah battery, 2 to 3.5 h runtime, noise below 70 dB and a charging dock with a 2.5 h charging period. Price on request.',
    },
  },
  // arreglos011126 — Bastón KP4202-20 (ES)
  'baston-4-apoyos-base-pequena-color-negro-ref-kp4202-20-konfort-plus': {
    es: {
      title: 'Bastón 4 apoyos Konfort Plus KP4202-20 – Colombia | I-ME',
      description:
        'Bastón de 4 apoyos Konfort Plus KP4202-20 en Colombia. Cotice por WhatsApp o en línea. Envío y soporte técnico.',
      h1: 'Bastón de 4 apoyos Konfort Plus KP4202-20 en Colombia',
      intro:
        'Bastón de 4 apoyos Konfort Plus KP4202-20 en Colombia. Cotice por WhatsApp o en línea. Envío y soporte técnico.',
    },
  },
  // arreglos011126 — Mindray BC-10 y BC-30S (EN): título adaptado a cada modelo, ≤60 caracteres
  'analizador-hematologico-automatico-mindray-ref-bc-10-mindray': {
    en: {
      title: 'Mindray BC-10 Hematology Analyzer – Colombia | I-ME',
      description:
        'Mindray BC-10 hematology analyzer in Colombia. Request a quote by WhatsApp or online. Documentation per reference.',
      h1: 'Mindray BC-10 hematology analyzer in Colombia',
      intro:
        'Mindray BC-10 hematology analyzer in Colombia. Request a quote by WhatsApp or online. Documentation per reference.',
    },
  },
  'analizador-hematologico-automatico-mindray-ref-bc-30s-mindray': {
    en: {
      title: 'Mindray BC-30S Hematology Analyzer – Colombia | I-ME',
      description:
        'Mindray BC-30S hematology analyzer in Colombia. Request a quote by WhatsApp or online. Documentation per reference.',
      h1: 'Mindray BC-30S hematology analyzer in Colombia',
      intro:
        'Mindray BC-30S hematology analyzer in Colombia. Request a quote by WhatsApp or online. Documentation per reference.',
    },
  },
  // arreglos011126 — Monitor M12 (EN): meta con «Request a quote», sin plazos de respuesta
  'monitor-de-paciente-ref-m12-biolight': {
    en: {
      title: 'Biolight M12 patient monitor in Colombia | I-ME',
      description:
        'Biolight M12 patient monitor in Colombia. Request a quote by WhatsApp or online. Shipping and technical support.',
      h1: 'Biolight M12 patient monitor in Colombia',
      intro:
        'Biolight M12 patient monitor in Colombia. Request a quote by WhatsApp or online. Shipping and technical support.',
    },
  },
  'monitor-de-paciente-ref-s12-biolight': {
    es: {
      title: 'Monitor Biolight S12 en Colombia | I-ME',
      description:
        'Monitor de paciente Biolight S12 en Colombia, pantalla HD de 12,1 pulgadas. Cotice por WhatsApp o en línea. Envío y soporte técnico.',
      h1: 'Monitor de paciente Biolight S12 en Colombia',
      intro:
        'Monitor de paciente Biolight S12 en Colombia, pantalla HD de 12,1 pulgadas. Cotice por WhatsApp o en línea. Envío y soporte técnico.',
    },
    en: {
      title: 'Biolight S12 patient monitor in Colombia | I-ME',
      description:
        'Biolight S12 patient monitor in Colombia, 12.1-inch HD display. Quote by WhatsApp or online. Shipping and technical support.',
      h1: 'Biolight S12 patient monitor in Colombia',
      intro:
        'Biolight S12 patient monitor in Colombia, 12.1-inch HD display. Quote by WhatsApp or online. Shipping and technical support.',
    },
  },
  'silla-de-ruedas-estandar-con-rin-estrella-kp-ref-kbe-9000d': {
    es: {
      title: 'Silla de ruedas KBE-9000D en Colombia | I-ME',
      description:
        'Silla de ruedas estándar plegable KBE-9000D, Konfort Plus, en Colombia. Cotice por WhatsApp o en línea. Envío y soporte técnico.',
      h1: 'Silla de ruedas KBE-9000D en Colombia',
      intro:
        'Silla de ruedas estándar plegable KBE-9000D, Konfort Plus, en Colombia. Cotice por WhatsApp o en línea. Envío y soporte técnico.',
    },
    en: {
      title: 'Wheelchair KBE-9000D in Colombia | I-ME',
      description:
        'Foldable standard wheelchair KBE-9000D, Konfort Plus, in Colombia. Quote by WhatsApp or online. Shipping and technical support.',
      h1: 'Wheelchair KBE-9000D in Colombia',
      intro:
        'Foldable standard wheelchair KBE-9000D, Konfort Plus, in Colombia. Quote by WhatsApp or online. Shipping and technical support.',
    },
  },
  'sistema-de-rayos-x-dr-movil-ref-dr-mobile-angell': {
    es: {
      title: 'Sistema de rayos X DR móvil para hospitales en Colombia | I-ME',
      description:
        'Sistema de rayos X DR móvil para hospitales en Colombia, con pantalla táctil de 19 pulgadas. El precio no está publicado: I-ME lo cotiza.',
      h1: 'Sistema de rayos X DR móvil para hospitales',
      intro:
        'Esta ficha es el sistema de rayos X DR móvil del catálogo. La descripción publicada incluye pantalla táctil de 19 pulgadas. No hay precio de lista: la cotización, la instalación y el servicio técnico se confirman por referencia.',
    },
    en: {
      title: 'Mobile DR system: DR system for hospitals, Colombia | I-ME',
      description:
        'Quote a mobile DR system (DR system) for hospitals in Colombia. Catalog unit with a 19-inch touch screen; the price is confirmed in the proposal.',
      h1: 'Mobile DR system for hospitals in Colombia',
      intro:
        'This page is the catalog mobile DR X-ray system. The published summary includes a 19-inch touch screen. There is no list price: I-ME quotes the DR system by reference, including installation and technical service in the proposal.',
    },
  },
  'dr-dinamico-de-brazo-ref-dr-uc-arm-angell': {
    es: {
      title: 'Precio UC-arm y proveedor hospitalario en Colombia | I-ME',
      description:
        'El precio del UC-arm no está publicado. I-ME es el proveedor en Colombia y cotiza este DR de brazo; la instalación se acuerda en la propuesta.',
      h1: 'UC-arm: precio y proveedor en Colombia',
      intro:
        'El precio del UC-arm no figura en el catálogo. I-ME es el proveedor y cotiza el DR dinámico de brazo por referencia. La instalación y el servicio técnico se escriben en la propuesta, no como una tarifa genérica.',
    },
    en: {
      title: 'UC-arm price and supplier for hospitals, Colombia | I-ME',
      description:
        'The UC-arm price is not listed. I-ME is the supplier in Colombia and quotes the dynamic UC-arm DR; installation is agreed in the proposal.',
      h1: 'UC-arm price and supplier in Colombia',
      intro:
        'The UC-arm price is not on this page. I-ME is the supplier and quotes the dynamic UC-arm DR by reference. Installation and technical service are defined in the proposal, not as a generic rate.',
    },
  },
};

export function getProductoSeoCopy(slug: string, locale: Locale): ProductoSeoCopy | undefined {
  return COPY[slug]?.[locale] ?? seoZuowei(slug, locale);
}
