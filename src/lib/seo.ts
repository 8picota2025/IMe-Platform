/**
 * Helpers de SEO: title, description, canonical, JSON-LD.
 * Solo datos reales — nunca inventa specs, precios ni testimonios.
 */

import type { Locale } from '../i18n/utils';
import { normalizarMoneda, tienePrecioPublico } from './format';

const SITE = 'https://i-me.com.co';
const BRAND = 'I-ME';
const LOGO = `${SITE}/assets/img/logo-ime-site.webp`;
const OG_IMAGE_VERSION = '20260629e';

interface SeoPageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
}

function buildVersionedOgImage(path: string): string {
  return `${SITE}${path}?v=${OG_IMAGE_VERSION}`;
}

function truncateMetaDescription(value: string, maxLength = 155): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const boundary = clean.lastIndexOf(' ', maxLength - 1);
  return clean.slice(0, boundary > 120 ? boundary : maxLength).trim();
}

function compactMetaLead(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const punctuationBoundaries = ['.', ';', ':', ','].map(char =>
    clean.lastIndexOf(char, maxLength)
  );
  const boundary = Math.max(...punctuationBoundaries);
  if (boundary > 56) return clean.slice(0, boundary).trim();
  return truncateMetaDescription(clean, maxLength);
}

const DEFAULT_OG_IMAGE = buildVersionedOgImage('/assets/img/og-default-ime.png');
const INSTITUTIONAL_OG_IMAGE = buildVersionedOgImage('/assets/img/og-institutional-ime.png');

export function getDefaultOgImage(): string {
  return DEFAULT_OG_IMAGE;
}

export function getInstitutionalOgImage(): string {
  return INSTITUTIONAL_OG_IMAGE;
}

export function buildPageTitle(pageTitle: string): string {
  if (!pageTitle) return `${BRAND} — Equipos Biomédicos`;
  const cleaned = pageTitle
    .replace(/\s*\|\s*I-ME(?:\s*International(?:\s+Medical(?:\s+Enterprise)?)?)?\s*$/gi, '')
    .replace(/\s*—\s*I-ME\s*$/gi, '')
    .trim();
  if (!cleaned) return `${BRAND} — Equipos Biomédicos`;
  // Idempotent: never append brand twice (fixes "… | I-ME | I-ME" on family hubs).
  if (/(?:^|\|\s*)I-ME(?:\s|$)/i.test(cleaned) && cleaned.length <= 70) {
    return cleaned;
  }
  return `${cleaned} | ${BRAND}`;
}

/** Soft max for SERP title display (~60 chars including brand). */
export const PRODUCT_TITLE_MAX = 60;

function stripTrailingBrand(name: string): string {
  return name.replace(/\s*\|\s*I-ME\s*$/i, '').trim();
}

function includesLoose(haystack: string, needle: string, locale: Locale): boolean {
  const h = haystack.toLocaleLowerCase(locale);
  const n = needle.toLocaleLowerCase(locale).trim();
  if (!n) return false;
  if (h.includes(n)) return true;
  const words = n.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0 && words.every(w => h.includes(w))) return true;
  const tokens = words.length > 0 ? words : [n];
  for (const w of tokens) {
    const stem = w.replace(/es$/i, '').replace(/s$/i, '');
    if (stem.length > 3 && h.includes(stem)) return true;
  }
  return false;
}

function shortenTitlePart(value: string, maxLen: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.lastIndexOf(' ', maxLen - 1);
  const sliced = clean.slice(0, cut > maxLen * 0.55 ? cut : maxLen).trim();
  return sliced
    .replace(/\s+(con|de|del|la|el|los|las|y|para|por|en|with|and|for|the|a|an|of)$/i, '')
    .trim();
}

function normalizeCategoriaLabel(categoria: string): string {
  return categoria
    .split(/[|/·•]/)[0]!
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * PDP title: `{nombre} | {categoría} | I-ME` when it fits.
 * Never declares a regulatory status unless it exists in that product's data.
 */
export function buildProductoPageTitle(
  nombre: string,
  locale: Locale,
  categoria?: string,
  marca?: string | null,
  primaryIntent?: string
): string {
  const brandSuffix = ` | ${BRAND}`;
  const budget = PRODUCT_TITLE_MAX - brandSuffix.length;
  const name = stripTrailingBrand(nombre);
  if (marca && includesLoose(name, marca, locale) === false) {
    /* keep manufacturer in product name as-is; do not append marca again */
  }

  const cat = categoria ? normalizeCategoriaLabel(categoria) : '';
  const intent = primaryIntent?.trim() ?? '';
  const catUsable = Boolean(cat) && !includesLoose(name, cat, locale);
  const intentUsable =
    Boolean(intent) &&
    !includesLoose(name, intent, locale) &&
    !(cat && includesLoose(cat, intent, locale));

  const middleCandidates: string[] = [];
  if (catUsable) {
    middleCandidates.push(shortenTitlePart(cat, 28));
  }
  if (intentUsable) {
    middleCandidates.push(shortenTitlePart(intent, 28));
  }
  middleCandidates.push('');

  for (const middle of middleCandidates) {
    const coreBudget = middle ? budget - middle.length - 3 : budget;
    if (coreBudget < 18) continue;
    const coreName = shortenTitlePart(name, coreBudget);
    if (coreName.length < 12) continue;
    const core = middle ? `${coreName} | ${middle}` : coreName;
    const full = `${core}${brandSuffix}`;
    if (full.length <= PRODUCT_TITLE_MAX + 8) return full;
  }

  return `${shortenTitlePart(name, budget)}${brandSuffix}`;
}

export function buildCanonical(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const [baseAndQuery, hash = ''] = normalized.split('#', 2);
  const [base, query = ''] = baseAndQuery.split('?', 2);
  const extensionless = !/\.[^/]+$/.test(base);
  const finalBase = extensionless && !base.endsWith('/') ? `${base}/` : base;
  return `${SITE}${finalBase}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

export function buildHomeSeo(locale: Locale): SeoPageMeta {
  const isEs = locale === 'es';
  return {
    // Brand-first titles: GSC showed impressions for "i me" / "ime" / "i-me.com" with ~0 CTR.
    title: isEs
      ? 'I-ME | Equipos biomédicos certificados en Colombia — venta, soporte e INVIMA'
      : 'I-ME | Certified biomedical equipment in Colombia — sales, support & INVIMA',
    description: isEs
      ? 'I-ME (International Medical Enterprise): equipos biomédicos con respaldo INVIMA/CE/FDA, soporte técnico, calibración y financiamiento para hospitales y clínicas en Colombia.'
      : 'I-ME (International Medical Enterprise): INVIMA/CE/FDA biomedical equipment, technical support, calibration and financing for hospitals and clinics across Colombia.',
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
    seo_keywords?: string[];
  },
  locale: Locale,
  categoria?: string,
  marca?: string | null
): SeoPageMeta {
  const segment = locale === 'en' ? 'products' : 'productos';
  const normalizedExclusions = [producto.nombre, marca, categoria]
    .filter((value): value is string => Boolean(value))
    .map(value => value.trim().toLocaleLowerCase(locale));
  const primaryIntent =
    (producto.seo_keywords ?? [])
      .map(k => k.trim())
      .filter(Boolean)
      .filter(keyword => !normalizedExclusions.includes(keyword.toLocaleLowerCase(locale)))
      .at(0) ??
    (categoria && !includesLoose(producto.nombre, categoria, locale)
      ? categoria.trim()
      : undefined);
  const market =
    locale === 'en'
      ? 'For Colombia, Latin America and Spain.'
      : 'Para Colombia, Latinoamérica y España.';
  const baseDescription = producto.descripcion_corta?.trim() || producto.nombre.trim();
  const seoTail = [primaryIntent ? `${primaryIntent}.` : '', market].filter(Boolean).join(' ');
  const baseBudget = seoTail ? 154 - seoTail.length : 155;
  const lead = compactMetaLead(baseDescription, Math.max(72, baseBudget));
  const leadWithStop = /[.!?]$/.test(lead) ? lead : `${lead}.`;
  const description = seoTail ? `${leadWithStop} ${seoTail}` : baseDescription;
  const ogImage = producto.imagen_principal
    ? producto.imagen_principal.startsWith('http')
      ? producto.imagen_principal
      : `${SITE}${producto.imagen_principal}`
    : DEFAULT_OG_IMAGE;
  return {
    title: buildProductoPageTitle(producto.nombre, locale, categoria, marca, primaryIntent),
    description: truncateMetaDescription(description),
    canonical: buildCanonical(`/${locale}/${segment}/${producto.slug}`),
    ogImage,
  };
}

export function buildCatalogoSeo(locale: Locale): SeoPageMeta {
  return {
    title:
      locale === 'es'
        ? 'Catálogo de equipos biomédicos certificados | Monitores, UCI y cirugía | I-ME'
        : 'Certified biomedical equipment catalog | Monitors, ICU and surgery | I-ME',
    description:
      locale === 'es'
        ? 'Explora equipos biomédicos certificados para monitores UCI, cardiología, sala de cirugía, neonatología, ultrasonido, anestesia, bombas y cuidados críticos.'
        : 'Explore certified biomedical equipment for ICU monitors, cardiology, operating room, neonatology, ultrasound, anesthesia, pumps and critical care.',
    canonical: buildCanonical(locale === 'es' ? '/es/catalogo' : '/en/catalog'),
    ogImage: DEFAULT_OG_IMAGE,
  };
}

export function buildServiciosSeo(locale: Locale): SeoPageMeta {
  return {
    title:
      locale === 'es'
        ? 'Servicios biomédicos en Colombia | venta, soporte técnico y financiamiento | I-ME'
        : 'I-ME biomedical services Colombia | medical device sales, renewal & support',
    description:
      locale === 'es'
        ? 'I-ME ofrece venta de equipos biomédicos con registro INVIMA, soporte técnico de ingenieros certificados, calibración, financiamiento y asesoría para hospitales y clínicas.'
        : 'I-ME International Medical Enterprise: leading biomedical distributor in Colombia — equipment sales, device renewal, INVIMA-registered imports, technical support and financing for hospitals.',
    canonical: buildCanonical(locale === 'es' ? '/es/servicios' : '/en/services'),
    ogImage: DEFAULT_OG_IMAGE,
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
export function buildOrganizationJsonLd(catalogItemCount?: number): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'MedicalBusiness'],
    '@id': `${SITE}/#organization`,
    name: 'I-ME International Medical Enterprise S.A.S.',
    alternateName: ['I-ME', 'I-ME Biomedical', 'IME', 'I ME', 'i-me.com.co'],
    url: SITE,
    logo: {
      '@type': 'ImageObject',
      url: LOGO,
      width: 200,
      height: 60,
    },
    image: `${SITE}/assets/img/ime-equipos-biomedicos-colombia-institucional.webp`,
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
        telephone: '+57-310-333-2607',
        contactType: 'sales',
        availableLanguage: ['Spanish', 'English'],
        areaServed: 'CO',
        contactOption: 'TollFree',
      },
    ],
    sameAs: ['https://wa.me/573137247353'],
    areaServed: {
      '@type': 'Country',
      name: 'Colombia',
    },
    description:
      'I-ME International Medical Enterprise S.A.S. es una empresa colombiana de distribución, soporte técnico y asesoría para instituciones de salud. La documentación regulatoria aplicable se confirma por referencia.',
    knowsAbout: [
      'Equipos biomédicos',
      'Monitores multiparamétricos',
      'Desfibriladores',
      'Equipos de ultrasonido',
      'Ventiladores mecánicos',
      'Equipos de anestesia',
      'Caminadores para adultos',
      'Sillas de ruedas',
      'Konfort Plus',
      'Registro INVIMA',
      'Certificación CE',
      'Mantenimiento preventivo de equipos médicos',
      'Financiamiento de tecnología médica',
      'Distribución de equipos hospitalarios en Colombia',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Catálogo de Equipos Biomédicos I-ME',
      url: `${SITE}/es/catalogo/`,
      ...(typeof catalogItemCount === 'number' && catalogItemCount >= 0
        ? { numberOfItems: catalogItemCount }
        : {}),
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
      'Catálogo de equipos biomédicos, soporte técnico, financiamiento y asesoría para instituciones de salud en Colombia',
    inLanguage: ['es-CO', 'en'],
    publisher: { '@id': `${SITE}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE}/es/catalogo/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** ISO date ~12 months ahead — priceValidUntil for Offer rich results. */
function buildPriceValidUntil(): string {
  const until = new Date();
  until.setUTCFullYear(until.getUTCFullYear() + 1);
  return until.toISOString().slice(0, 10);
}

/** Merchant return policy — alineada a /es/legal/devoluciones/ y términos B2B. */
export function buildMerchantReturnPolicyJsonLd(locale: Locale): Record<string, unknown> {
  const legalPath = locale === 'en' ? '/en/legal/returns/' : '/es/legal/devoluciones/';
  return {
    '@type': 'MerchantReturnPolicy',
    '@id': `${SITE}/#return-policy`,
    applicableCountry: 'CO',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 5,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    returnPolicyUrl: `${SITE}${legalPath}`,
  };
}

/** Shipping defaults for Colombia — coste final se confirma en cotización. */
function buildOfferShippingDetails(currency: string): Record<string, unknown> {
  return {
    '@type': 'OfferShippingDetails',
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'CO',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 5,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 2,
        maxValue: 15,
        unitCode: 'DAY',
      },
    },
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: 0,
      currency,
    },
  };
}

/**
 * JSON-LD Product — solo cuando hay precio público (Offer válido para Google Shopping/snippets).
 * Sin precio visible no emitimos Product: GSC exige offers, review o aggregateRating.
 * MedicalDevice se añade únicamente cuando hay sellos de normativa en specs.
 */
export function buildProductJsonLd(
  producto: {
    nombre: string;
    descripcion_corta: string;
    imagen_principal: string | null;
    slug: string;
    seo_keywords?: string[];
    precio?: number | null | undefined;
    moneda?: string | null;
    disponible?: boolean;
    mpn?: string | null;
    sku?: string | null;
  },
  locale: Locale,
  categoria?: string,
  marca?: string | null,
  opts?: { certificaciones?: string[]; familiaSlug?: string }
): Record<string, unknown> | null {
  if (!tienePrecioPublico(producto.precio)) return null;

  const segment = locale === 'en' ? 'products' : 'productos';
  const canonicalUrl = buildCanonical(`/${locale}/${segment}/${producto.slug}`);
  const imageUrl = producto.imagen_principal
    ? producto.imagen_principal.startsWith('http')
      ? producto.imagen_principal
      : `${SITE}${producto.imagen_principal}`
    : DEFAULT_OG_IMAGE;

  const certs = (opts?.certificaciones ?? []).map(c => c.trim()).filter(Boolean);
  const hasRegulatory = certs.some(c => /invima|ce\b|fda|iso/i.test(c));

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': hasRegulatory ? ['Product', 'MedicalDevice'] : 'Product',
    name: producto.nombre,
    description: producto.descripcion_corta,
    image: imageUrl,
    url: canonicalUrl,
    brand: {
      '@type': 'Brand',
      name: marca && marca.trim().length > 0 ? marca : 'I-ME International Medical Enterprise',
    },
    seller: { '@id': `${SITE}/#organization` },
  };
  const priceCurrency = normalizarMoneda(producto.moneda);
  jsonLd.offers = {
    '@type': 'Offer',
    url: canonicalUrl,
    price: producto.precio,
    priceCurrency,
    priceValidUntil: buildPriceValidUntil(),
    itemCondition: 'https://schema.org/NewCondition',
    availability:
      producto.disponible === false
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
    seller: { '@id': `${SITE}/#organization` },
    areaServed: { '@type': 'Country', name: 'Colombia' },
    businessFunction: 'http://purl.org/goodrelations/v1#Sell',
    hasMerchantReturnPolicy: buildMerchantReturnPolicyJsonLd(locale),
    shippingDetails: buildOfferShippingDetails(priceCurrency),
  };
  if (categoria) jsonLd.category = categoria;
  if (opts?.familiaSlug) {
    const famSeg = locale === 'en' ? 'families' : 'familias';
    jsonLd.additionalType = `${SITE}/${locale}/${famSeg}/${opts.familiaSlug}/`;
  }
  const mpn = producto.mpn?.trim() || producto.sku?.trim();
  if (mpn) jsonLd.mpn = mpn;
  if (producto.sku?.trim()) jsonLd.sku = producto.sku.trim();

  const extraProps: Array<Record<string, unknown>> = [];
  if (producto.seo_keywords && producto.seo_keywords.length > 0) {
    extraProps.push({
      '@type': 'PropertyValue',
      name: locale === 'en' ? 'Search use cases' : 'Casos de uso de búsqueda',
      value: producto.seo_keywords.slice(0, 18).join(', '),
    });
  }
  for (const cert of certs.slice(0, 8)) {
    extraProps.push({
      '@type': 'PropertyValue',
      name: locale === 'en' ? 'Regulatory / standard' : 'Normativa / certificación',
      value: cert,
    });
  }
  if (extraProps.length > 0) jsonLd.additionalProperty = extraProps;
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
            'Distribución de equipos médicos para instituciones de salud. La disponibilidad, instalación, capacitación y documentación aplicable se confirman en la propuesta formal.',
          url: `${pageUrl}#venta`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Soporte técnico de equipos biomédicos',
          name: 'Soporte técnico de equipos biomédicos',
          description:
            'Mantenimiento preventivo y correctivo, calibración y verificación metrológica según el alcance acordado. Los tiempos de atención se confirman para cada solicitud.',
          url: `${pageUrl}#soporte`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Financiamiento médico para equipos hospitalarios',
          name: 'Financiamiento médico flexible',
          description:
            'Alternativas de adquisición para instituciones de salud. Tasas, plazos, requisitos y aprobación se definen en cotización; el simulador no constituye una oferta vinculante.',
          url: `${pageUrl}#financiamiento`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Asesoría biomédica integral',
          name: 'Asesoría biomédica integral',
          description:
            'Acompañamiento comercial y técnico para selección, adquisición y gestión de tecnología biomédica. La validación regulatoria se realiza por referencia y documentación vigente.',
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
            'Medical equipment distribution for healthcare institutions. Availability, installation, training and applicable documentation are confirmed in the formal proposal.',
          url: `${pageUrl}#venta`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Biomedical equipment technical support',
          name: 'Biomedical equipment technical support',
          description:
            'Preventive and corrective maintenance, calibration and metrological verification according to the agreed scope. Service times are confirmed for each request.',
          url: `${pageUrl}#soporte`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Medical equipment financing',
          name: 'Flexible medical financing',
          description:
            'Acquisition alternatives for healthcare institutions. Rates, terms, requirements and approval are defined in the quote; the simulator is not a binding offer.',
          url: `${pageUrl}#financiamiento`,
          provider: orgRef,
          areaServed: { '@type': 'Country', name: 'Colombia' },
        },
        {
          '@type': 'Service',
          serviceType: 'Comprehensive biomedical advisory',
          name: 'Comprehensive biomedical advisory',
          description:
            'Commercial and technical guidance for biomedical technology selection, acquisition and management. Regulatory validation is confirmed per reference and current documentation.',
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
export function combineJsonLd(
  ...blocks: Array<Record<string, unknown> | null | undefined>
): string {
  const nodes: Record<string, unknown>[] = [];
  for (const block of blocks) {
    if (!block) continue;
    const { '@context': _ctx, '@graph': graph, ...rest } = block;
    if (Array.isArray(graph)) {
      nodes.push(...(graph as Record<string, unknown>[]));
    } else if (Object.keys(rest).length > 0) {
      nodes.push(rest);
    }
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}

export function buildFamiliaSeo(
  locale: Locale,
  input: { slug: string; name: string; description: string }
): SeoPageMeta {
  const seg = locale === 'en' ? 'families' : 'familias';
  return {
    title: buildPageTitle(input.name),
    description: truncateMetaDescription(input.description),
    canonical: buildCanonical(`/${locale}/${seg}/${input.slug}`),
    ogImage: DEFAULT_OG_IMAGE,
  };
}

export function buildCitySeo(
  locale: Locale,
  input: { slug: string; name: string; description: string }
): SeoPageMeta {
  const seg = locale === 'en' ? 'cities' : 'ciudades';
  return {
    title: buildPageTitle(input.name),
    description: truncateMetaDescription(input.description),
    canonical: buildCanonical(`/${locale}/${seg}/${input.slug}`),
    ogImage: INSTITUTIONAL_OG_IMAGE,
  };
}

/** Service + areaServed City — HQ NAP stays Envigado (no fake local offices). */
export function buildCityServiceJsonLd(
  locale: Locale,
  city: { name: string; slug: string }
): Record<string, unknown> {
  const seg = locale === 'en' ? 'cities' : 'ciudades';
  const pageUrl = buildCanonical(`/${locale}/${seg}/${city.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name:
      locale === 'en'
        ? `Biomedical equipment supply for ${city.name}`
        : `Suministro de equipos biomédicos para ${city.name}`,
    serviceType:
      locale === 'en'
        ? 'Biomedical equipment distribution and technical support'
        : 'Distribución de equipos biomédicos y soporte técnico',
    provider: { '@id': `${SITE}/#organization` },
    areaServed: {
      '@type': 'City',
      name: city.name,
      containedInPlace: { '@type': 'Country', name: 'Colombia' },
    },
    url: pageUrl,
  };
}
