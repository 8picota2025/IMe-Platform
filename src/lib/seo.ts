/**
 * Helpers de SEO: title, description, canonical, JSON-LD.
 * Solo datos reales — nunca inventa specs, precios ni testimonios.
 */

import type { Locale } from '../i18n/utils';

const SITE = 'https://i-me.com.co';
const BRAND = 'I-ME';
const LOGO = `${SITE}/assets/img/logo-ime.png`;

interface SeoPageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
}

const DEFAULT_OG_IMAGE = `${SITE}/assets/img/javier-fundador-ime.png`;

export function buildPageTitle(pageTitle: string): string {
  if (!pageTitle) return `${BRAND} — Equipos Biomédicos`;
  return `${pageTitle} | ${BRAND}`;
}

export function buildCanonical(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE}${normalized}`;
}

export function buildHomeSeo(locale: Locale): SeoPageMeta {
  const isEs = locale === 'es';
  return {
    title: isEs
      ? 'I-ME — Equipos Biomédicos Certificados para Hospitales y Clínicas en Colombia'
      : 'I-ME — Certified Biomedical Equipment for Hospitals and Clinics in Colombia',
    description: isEs
      ? 'Distribuimos tecnología médica de clase mundial certificada internacionalmente para hospitales, clínicas y centros de salud en todo Colombia. 24+ categorías, cobertura en 32 departamentos.'
      : 'We distribute internationally certified world-class medical technology for hospitals, clinics and health centers throughout Colombia. 24+ categories, national coverage.',
    canonical: buildCanonical(`/${locale}/`),
    ogImage: DEFAULT_OG_IMAGE,
  };
}

export function buildProductoSeo(
  producto: {
    nombre: string;
    descripcion_corta: string | null;
    imagen_principal: string | null;
    slug: string;
  },
  locale: Locale
): SeoPageMeta {
  const segment = locale === 'en' ? 'products' : 'productos';
  const description =
    typeof producto.descripcion_corta === 'string' && producto.descripcion_corta.trim().length > 0
      ? producto.descripcion_corta
      : locale === 'es'
        ? 'Consulta la ficha técnica y la disponibilidad de este equipo con el equipo comercial de I-ME.'
        : 'Contact the I-ME team for the full technical sheet and current availability of this equipment.';
  const ogImage = producto.imagen_principal
    ? producto.imagen_principal.startsWith('http')
      ? producto.imagen_principal
      : `${SITE}${producto.imagen_principal}`
    : `${SITE}/og-image.jpg`;
  return {
    title: buildPageTitle(producto.nombre),
    description: description.slice(0, 155),
    canonical: buildCanonical(`/${locale}/${segment}/${producto.slug}`),
    ogImage,
  };
}

export function buildCatalogoSeo(locale: Locale): SeoPageMeta {
  return {
    title:
      locale === 'es'
        ? 'Catálogo de Equipos Biomédicos | I-ME'
        : 'Biomedical Equipment Catalog | I-ME',
    description:
      locale === 'es'
        ? 'Explora nuestro catálogo de equipos biomédicos certificados: monitores, cardiología, sala de cirugía, neonatología, ultrasonido y más.'
        : 'Explore our catalog of certified biomedical equipment: monitors, cardiology, operating room, neonatology, ultrasound and more.',
    canonical: buildCanonical(locale === 'es' ? '/es/catalogo' : '/en/catalog'),
    ogImage: DEFAULT_OG_IMAGE,
  };
}

export function buildServiciosSeo(locale: Locale): SeoPageMeta {
  return {
    title:
      locale === 'es'
        ? 'Servicios Biomédicos | Venta, Soporte Técnico, Financiamiento y Asesoría | I-ME'
        : 'Biomedical Services | Sales, Technical Support, Financing & Advisory | I-ME',
    description:
      locale === 'es'
        ? 'I-ME ofrece venta de equipos biomédicos con registro INVIMA, soporte técnico por ingenieros certificados, financiamiento médico hasta 60 meses y asesoría biomédica integral para hospitales y clínicas en Colombia.'
        : 'I-ME offers INVIMA-registered biomedical equipment, certified technical support, medical financing up to 60 months and comprehensive biomedical advisory for hospitals and clinics in Colombia.',
    canonical: buildCanonical(locale === 'es' ? '/es/servicios' : '/en/services'),
    ogImage: `${SITE}/assets/img/javier-fundador-ime.png`,
  };
}

export function buildFaqJsonLd(items: Array<{ q: string; a: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

/**
 * JSON-LD Organization + MedicalBusiness — datos reales del cliente.
 * NIT: 901871720-1 · CL 28 SUR 29 83, Envigado, Antioquia, CO
 */
export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'MedicalBusiness'],
    '@id': `${SITE}/#organization`,
    name: 'I-ME International Medical Enterprise S.A.S.',
    alternateName: 'I-ME Biomedical',
    url: SITE,
    logo: {
      '@type': 'ImageObject',
      url: LOGO,
      width: 200,
      height: 60,
    },
    image: `${SITE}/assets/img/javier-fundador-ime.png`,
    email: 'info@i-me.com.co',
    taxID: '901871720-1',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'CL 28 SUR 29 83',
      addressLocality: 'Envigado',
      addressRegion: 'Antioquia',
      addressCountry: 'CO',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+57-313-867-4059',
        contactType: 'sales',
        availableLanguage: ['Spanish', 'English'],
        areaServed: 'CO',
        contactOption: 'TollFree',
      },
    ],
    sameAs: ['https://wa.me/573138674059'],
    areaServed: {
      '@type': 'Country',
      name: 'Colombia',
    },
    description:
      'I-ME International Medical Enterprise S.A.S. es una empresa colombiana con más de 15 años de experiencia en distribución, instalación, mantenimiento y asesoría de equipos biomédicos certificados (INVIMA, CE, FDA) para hospitales, clínicas y centros de salud en los 32 departamentos de Colombia.',
    knowsAbout: [
      'Equipos biomédicos',
      'Monitores multiparamétricos',
      'Desfibriladores',
      'Equipos de ultrasonido',
      'Ventiladores mecánicos',
      'Equipos de anestesia',
      'Registro INVIMA',
      'Certificación CE',
      'Mantenimiento preventivo de equipos médicos',
      'Financiamiento de tecnología médica',
      'Distribución de equipos hospitalarios en Colombia',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Catálogo de Equipos Biomédicos I-ME',
      url: `${SITE}/es/catalogo`,
      numberOfItems: 33,
    },
    founder: {
      '@type': 'Person',
      '@id': `${SITE}/#founder`,
      name: 'Javier',
      jobTitle: 'Fundador y Director General',
      image: `${SITE}/assets/img/javier-fundador-ime.png`,
      worksFor: { '@id': `${SITE}/#organization` },
      knowsAbout: [
        'Equipos biomédicos',
        'Distribución médica en Colombia',
        'INVIMA',
        'Financiamiento de tecnología hospitalaria',
      ],
    },
  };
}

/**
 * JSON-LD WebSite con SearchAction — habilita sitelinks search en Google.
 */
export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: SITE,
    name: 'I-ME International Medical Enterprise',
    description:
      'Distribuidor de equipos biomédicos certificados para hospitales y clínicas en Colombia',
    inLanguage: ['es-CO', 'en'],
    publisher: { '@id': `${SITE}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE}/es/catalogo?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * JSON-LD Product — solo si hay datos reales.
 */
export function buildProductJsonLd(
  producto: {
    nombre: string;
    descripcion_corta: string;
    imagen_principal: string | null;
    slug: string;
  },
  locale: Locale,
  categoria?: string
): Record<string, unknown> {
  const segment = locale === 'en' ? 'products' : 'productos';
  const canonicalUrl = `${SITE}/${locale}/${segment}/${producto.slug}`;
  const imageUrl = producto.imagen_principal
    ? producto.imagen_principal.startsWith('http')
      ? producto.imagen_principal
      : `${SITE}${producto.imagen_principal}`
    : `${SITE}/og-image.jpg`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: producto.nombre,
    description: producto.descripcion_corta,
    image: imageUrl,
    url: canonicalUrl,
    brand: {
      '@type': 'Brand',
      name: 'I-ME International Medical Enterprise',
    },
    seller: { '@id': `${SITE}/#organization` },
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE}/#organization` },
      areaServed: { '@type': 'Country', name: 'Colombia' },
      businessFunction: 'http://purl.org/goodrelations/v1#Sell',
    },
  };
  if (categoria) jsonLd.category = categoria;
  return jsonLd;
}

/**
 * JSON-LD para la página de servicios — cuatro Service items bajo un @graph.
 */
export function buildServiciosJsonLd(locale: Locale): Record<string, unknown> {
  const isEs = locale === 'es';
  const pageUrl = `${SITE}/${locale}/${isEs ? 'servicios' : 'services'}`;
  const orgRef = { '@id': `${SITE}/#organization` };

  const servicios = isEs
    ? [
        {
          '@type': 'Service',
          serviceType: 'Venta y distribución de equipos biomédicos',
          name: 'Venta y distribución de equipos biomédicos',
          description:
            'Distribución de equipos médicos de alta tecnología con certificaciones CE, FDA e INVIMA vigentes. Incluye instalación, puesta en marcha y capacitación al personal clínico en todo Colombia.',
          url: `${pageUrl}#venta`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Soporte técnico de equipos biomédicos',
          name: 'Soporte técnico certificado',
          description:
            'Mantenimiento preventivo, correctivo, calibración y verificación metrológica por ingenieros biomédicos certificados. Respuesta en campo en menos de 48 horas en cualquier departamento de Colombia.',
          url: `${pageUrl}#soporte`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Financiamiento médico para equipos hospitalarios',
          name: 'Financiamiento médico flexible',
          description:
            'Planes de adquisición a medida para instituciones de salud. Cuotas mensuales fijas, plazos de 12 a 60 meses, sin codeudor para hospitales y aprobación en 48 horas hábiles.',
          url: `${pageUrl}#financiamiento`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Asesoría biomédica integral',
          name: 'Asesoría biomédica integral',
          description:
            'Consultoría especializada para la selección, adquisición y gestión del parque tecnológico biomédico. Diagnóstico, plan de renovación, especificaciones para licitaciones y acompañamiento INVIMA.',
          url: `${pageUrl}#asesoria`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
      ]
    : [
        {
          '@type': 'Service',
          serviceType: 'Biomedical equipment sales and distribution',
          name: 'Sales and distribution of biomedical equipment',
          description:
            'Distribution of high-technology medical equipment with CE, FDA and INVIMA certifications. Includes installation, commissioning and clinical staff training across Colombia.',
          url: `${pageUrl}#venta`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Biomedical equipment technical support',
          name: 'Certified technical support',
          description:
            'Preventive and corrective maintenance, calibration and metrological verification by certified biomedical engineers. Field response within 48 hours in any Colombian department.',
          url: `${pageUrl}#soporte`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Medical equipment financing',
          name: 'Flexible medical financing',
          description:
            'Tailored acquisition plans for healthcare institutions. Fixed monthly payments, 12 to 60-month terms, no co-signer for hospitals, approval within 48 business hours.',
          url: `${pageUrl}#financiamiento`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Comprehensive biomedical advisory',
          name: 'Comprehensive biomedical advisory',
          description:
            'Specialized consulting for biomedical technology portfolio selection, acquisition and management. Technology audit, renewal plan, tender specifications and INVIMA compliance support.',
          url: `${pageUrl}#asesoria`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
      ];

  return {
    '@context': 'https://schema.org',
    '@graph': servicios,
  };
}

/**
 * JSON-LD BreadcrumbList — a partir de una lista ordenada {name, url}.
 */
export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Combina varios bloques JSON-LD en un único <script type="application/ld+json">
 * usando @graph. Aplana bloques que ya tienen @graph propio.
 */
export function combineJsonLd(...blocks: Record<string, unknown>[]): string {
  const nodes: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const { '@context': _ctx, '@graph': graph, ...rest } = block;
    if (Array.isArray(graph)) {
      nodes.push(...(graph as Record<string, unknown>[]));
    } else if (Object.keys(rest).length > 0) {
      nodes.push(rest);
    }
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}
