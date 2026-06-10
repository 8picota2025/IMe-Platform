/**
 * Helpers de SEO: title, description, canonical, JSON-LD.
 * Solo datos reales — nunca inventa specs, precios ni testimonios.
 */

import type { Locale } from '../i18n/utils'

const SITE = 'https://i-me.com.co'
const BRAND = 'I-ME'

interface SeoPageMeta {
  title: string
  description: string
  canonical: string
  ogImage: string
}

const DEFAULT_OG_IMAGE = `${SITE}/assets/extraccion/img/Img11.jpg`

export function buildPageTitle(pageTitle: string): string {
  if (!pageTitle) return `${BRAND} — Equipos Biomédicos`
  return `${pageTitle} | ${BRAND}`
}

export function buildCanonical(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE}${normalized}`
}

export function buildHomeSeo(locale: Locale): SeoPageMeta {
  const isEs = locale === 'es'
  return {
    title: isEs
      ? 'I-ME — Equipos Biomédicos Certificados para Hospitales y Clínicas en Colombia'
      : 'I-ME — Certified Biomedical Equipment for Hospitals and Clinics in Colombia',
    description: isEs
      ? 'Distribuimos tecnología médica de clase mundial certificada internacionalmente para hospitales, clínicas y centros de salud en todo Colombia. 24+ categorías, cobertura en 32 departamentos.'
      : 'COPY_CLIENTE_REVISAR — We distribute internationally certified world-class medical technology for hospitals, clinics and health centers throughout Colombia.',
    canonical: buildCanonical(`/${locale}/`),
    ogImage: DEFAULT_OG_IMAGE,
  }
}

export function buildProductoSeo(
  producto: { nombre: string; descripcion_corta: string; imagen_principal: string; slug: string },
  locale: Locale
): SeoPageMeta {
  return {
    title: buildPageTitle(producto.nombre),
    description: producto.descripcion_corta.slice(0, 155),
    canonical: buildCanonical(`/${locale}/productos/${producto.slug}`),
    ogImage: producto.imagen_principal.startsWith('http')
      ? producto.imagen_principal
      : `${SITE}${producto.imagen_principal}`,
  }
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
        : 'COPY_CLIENTE_REVISAR — Explore our catalog of certified biomedical equipment: monitors, cardiology, operating room, neonatology, ultrasound and more.',
    canonical: buildCanonical(locale === 'es' ? '/es/catalogo' : '/en/catalog'),
    ogImage: DEFAULT_OG_IMAGE,
  }
}

/**
 * JSON-LD Organization — solo datos reales de contenido_ime.json.
 */
export function buildOrganizationJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'I-ME International Medical Enterprise',
    url: SITE,
    logo: `${SITE}/assets/extraccion/img/logo-ime.png`,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+57-313-867-4059',
        contactType: 'sales',
        availableLanguage: ['Spanish'],
        areaServed: 'CO',
      },
    ],
    sameAs: ['https://wa.me/573138674059'],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CO',
    },
    description:
      'Empresa colombiana con más de 15 años de experiencia en la distribución, instalación y mantenimiento de equipos biomédicos de alta tecnología para el sector salud.',
  })
}

/**
 * JSON-LD Product — solo si hay datos reales.
 */
export function buildProductJsonLd(producto: {
  nombre: string
  descripcion_corta: string
  imagen_principal: string
  slug: string
}): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: producto.nombre,
    description: producto.descripcion_corta,
    image: producto.imagen_principal.startsWith('http')
      ? producto.imagen_principal
      : `${SITE}${producto.imagen_principal}`,
    url: `${SITE}/es/productos/${producto.slug}`,
    brand: {
      '@type': 'Brand',
      name: 'I-ME International Medical Enterprise',
    },
  })
}
