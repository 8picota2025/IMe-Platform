/**
 * Title, meta, H1 e intro de fichas concretas.
 * No cambia el nombre de catálogo ni inventa precio, marca o ficha.
 */
import type { Locale } from '../i18n/utils';

export interface ProductoSeoCopy {
  title: string;
  description: string;
  h1: string;
  intro: string;
}

const COPY: Record<string, { es: ProductoSeoCopy; en: ProductoSeoCopy }> = {
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
  return COPY[slug]?.[locale];
}
