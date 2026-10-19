import { describe, expect, it } from 'vitest';
import {
  buildProductJsonLd,
  buildProductoPageTitle,
  buildProductoSeo,
  truncateMetaDescription,
  buildServiciosSeo,
  buildServiciosFaqItems,
  buildServiciosJsonLd,
  buildOrganizationJsonLd,
  PRODUCT_TITLE_MAX,
  resolveRobotsContent,
} from './seo';

describe('buildOrganizationJsonLd', () => {
  it('evita promesas regulatorias o de cobertura sin evidencia por referencia', () => {
    const description = String(buildOrganizationJsonLd().description);
    expect(description).not.toMatch(/15 años|32 departamentos|certificados \(INVIMA, CE, FDA\)/i);
    expect(description).toMatch(/se confirma por referencia/i);
  });

  it('usa el WhatsApp Business oficial +57 313 724 7353', () => {
    const org = buildOrganizationJsonLd();
    const contact = (org.contactPoint as Array<{ telephone?: string }>)[0];
    expect(contact?.telephone).toBe('+57-313-724-7353');
    expect(org.sameAs).toEqual(['https://wa.me/573137247353']);
    expect(JSON.stringify(org)).not.toContain('310-333-2607');
  });
});

describe('buildProductJsonLd', () => {
  const producto = {
    nombre: 'Monitor de Paciente Biolight M12',
    descripcion_corta: 'Monitor de paciente compacto.',
    imagen_principal: '/assets/productos/monitor-paciente.jpg',
    slug: 'eq-monitor-de-paciente-m12-biolight',
    precio: 12500000,
    moneda: 'COP',
  };

  function expectProductJsonLd(
    ...args: Parameters<typeof buildProductJsonLd>
  ): Record<string, unknown> {
    const jsonLd = buildProductJsonLd(...args);
    expect(jsonLd).not.toBeNull();
    return jsonLd as Record<string, unknown>;
  }

  it('usa la marca del fabricante cuando esta presente', () => {
    const jsonLd = expectProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect((jsonLd.brand as { name: string }).name).toBe('Biolight');
  });

  it('cae a I-ME cuando no hay marca', () => {
    const jsonLd = expectProductJsonLd(producto, 'es', 'Monitores', null);
    expect((jsonLd.brand as { name: string }).name).toBe('I-ME International Medical Enterprise');
  });

  it('marca MedicalDevice solo con certificaciones normativas reales', () => {
    const plain = expectProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect(plain['@type']).toBe('Product');
    const withCert = expectProductJsonLd(producto, 'es', 'Monitores', 'Biolight', {
      certificaciones: ['INVIMA'],
      familiaSlug: 'monitores',
    });
    expect(withCert['@type']).toEqual(['Product', 'MedicalDevice']);
    expect(withCert.additionalType).toContain('/es/familias/monitores/');
  });

  it('incluye precio y moneda cuando el producto los tiene visibles', () => {
    const jsonLd = expectProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect((jsonLd.offers as { price: number }).price).toBe(12500000);
    expect((jsonLd.offers as { priceCurrency: string }).priceCurrency).toBe('COP');
  });

  it('usa COP cuando la moneda no contiene un código ISO de tres letras', () => {
    const jsonLd = expectProductJsonLd({ ...producto, moneda: 'COP$' }, 'es');
    expect((jsonLd.offers as { priceCurrency: string }).priceCurrency).toBe('COP');
  });

  it('conserva una moneda ISO configurada', () => {
    const jsonLd = expectProductJsonLd({ ...producto, moneda: 'USD' }, 'en');
    expect((jsonLd.offers as { priceCurrency: string }).priceCurrency).toBe('USD');
  });

  it.each([0, null, undefined, NaN, 'invalido' as unknown as number])(
    'emite Product y Offer sin price cuando el precio no es público: %s',
    precio => {
      const jsonLd = buildProductJsonLd({ ...producto, precio }, 'es');
      expect(jsonLd['@type']).toBe('Product');
      const offers = jsonLd.offers as Record<string, unknown>;
      expect(offers['@type']).toBe('Offer');
      expect(offers.price).toBeUndefined();
      expect(offers.priceCurrency).toBeUndefined();
      expect(offers.availability).toBe('https://schema.org/InStock');
    }
  );

  it('Offer incluye campos merchant listing cuando hay precio', () => {
    const jsonLd = expectProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers.itemCondition).toBe('https://schema.org/NewCondition');
    expect(offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(offers.hasMerchantReturnPolicy).toBeDefined();
    expect(offers.shippingDetails).toBeDefined();
  });

  it('no añade reviews ni aggregateRating sin datos reales', () => {
    const jsonLd = expectProductJsonLd(producto, 'es');
    expect(jsonLd.review).toBeUndefined();
    expect(jsonLd.aggregateRating).toBeUndefined();
  });

  it('incluye SKU únicamente cuando existe en datos de producto', () => {
    const jsonLd = expectProductJsonLd({ ...producto, sku: 'M12-BIOLIGHT' }, 'es');
    expect(jsonLd.sku).toBe('M12-BIOLIGHT');
  });

  it('en imagen, esterilización y robots sin precio emite Product y no un Offer inválido', () => {
    for (const familiaSlug of ['radiologia', 'esterilizacion-control-infecciones', 'robots']) {
      const jsonLd = expectProductJsonLd(
        { ...producto, precio: null, sku: familiaSlug === 'robots' ? 'PADBOT-P2' : null },
        'es',
        'Imagen',
        'Angell',
        { familiaSlug, model: 'ALC-280' }
      );
      expect(jsonLd.offers).toBeUndefined();
      expect(jsonLd.seller).toBeUndefined();
      expect((jsonLd.brand as { name: string }).name).toBe('Angell');
      expect(jsonLd.model).toBe('ALC-280');
      expect(jsonLd.image).toContain('/assets/productos/monitor-paciente.jpg');
      if (familiaSlug === 'robots') expect(jsonLd.sku).toBe('PADBOT-P2');
      else expect(jsonLd.sku).toBeUndefined();
    }
  });

  it('sin precio y fuera de esas familias emite Offer sin price', () => {
    const jsonLd = expectProductJsonLd(
      { ...producto, precio: null },
      'es',
      'Monitores',
      'Biolight',
      {
        familiaSlug: 'monitores',
      }
    );
    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers['@type']).toBe('Offer');
    expect(offers.price).toBeUndefined();
    expect(offers.priceCurrency).toBeUndefined();
  });
});

describe('buildProductoPageTitle', () => {
  it('añade categoría sin declarar certificación no verificada', () => {
    const title = buildProductoPageTitle('Bomba IP-200', 'es', 'Soluciones IV', null);
    expect(title).toContain('Bomba IP-200');
    expect(title).toContain('I-ME');
    expect(title).toMatch(/Soluciones IV/i);
    expect(title).not.toContain('INVIMA');
  });

  it('no duplica categoría si ya está en el nombre', () => {
    const title = buildProductoPageTitle(
      'Monitor Multiparamétrico UCI Avanzado',
      'es',
      'Monitores',
      null,
      'monitores multiparamétricos UCI'
    );
    expect(title.endsWith('| I-ME')).toBe(true);
    expect(title).not.toMatch(/Monitores INVIMA/i);
  });

  it('no duplica marca I-ME al final del nombre', () => {
    const title = buildProductoPageTitle('Ecógrafo Portátil | I-ME', 'es', 'Ultrasonido', null);
    expect(title.match(/I-ME/g)?.length).toBe(1);
  });

  it('mantiene títulos hermanos distintos con misma categoría', () => {
    const a = buildProductoPageTitle('Bomba SK-EM211', 'es', 'Terapia de Infusión', 'Saikang');
    const b = buildProductoPageTitle('Bomba SK-EM215', 'es', 'Terapia de Infusión', 'Saikang');
    expect(a).not.toBe(b);
    expect(a).toContain('SK-EM211');
    expect(b).toContain('SK-EM215');
  });

  it('trunca nombres muy largos cerca del presupuesto', () => {
    const long =
      'Ventilador Cuidado Intensivo Adulto Pediátrico Monnal Ref. T75 Air Liquide Medical Systems';
    const title = buildProductoPageTitle(long, 'es', 'Ventiladores', 'Air Liquide');
    expect(title.endsWith('| I-ME')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(PRODUCT_TITLE_MAX + 12);
  });

  it('mantiene la referencia cuando el nombre no cabe con la categoría', () => {
    // GSC 2026-09-16: 36 PDP compartían "Carro clínico Ref. | Mobiliario hospitalario e | I-ME".
    const a = buildProductoPageTitle(
      'Cama hospitalaria Ref. SK-A2 Saikang',
      'es',
      'Mobiliario hospitalario e insumos',
      'Saikang'
    );
    const b = buildProductoPageTitle(
      'Cama hospitalaria Ref. SK-A3 Saikang',
      'es',
      'Mobiliario hospitalario e insumos',
      'Saikang'
    );
    expect(a).toContain('SK-A2');
    expect(b).toContain('SK-A3');
    expect(a).not.toBe(b);
  });

  it('no deja "Ref." ni conjunción colgante en el título', () => {
    const title = buildProductoPageTitle(
      'Carro clínico Ref. SKB041-10 Saikang',
      'es',
      'Mobiliario hospitalario e insumos',
      'Saikang'
    );
    expect(title).not.toMatch(/Ref\.\s*\|/i);
    expect(title).not.toMatch(/\s(e|y|de|con)\s*\|/i);
  });

  it('conserva el código de modelo aunque el nombre exceda el máximo duro', () => {
    const title = buildProductoPageTitle(
      'Sistema de Radiografía Digital Dinámica Multipropósito UC-ARM DTP580 Series Fanghua',
      'es',
      'Radiología',
      'Fanghua'
    );
    expect(title).toContain('DTP580');
    expect(title.endsWith('| I-ME')).toBe(true);
  });

  it('no deja preposición colgante al truncar', () => {
    const title = buildProductoPageTitle(
      'Desfibrilador Bifásico con Monitor',
      'es',
      'Cardiología / reanimación',
      null
    );
    expect(title).not.toMatch(/\scon\s*\|/i);
    expect(title).toMatch(/Cardiología \| I-ME|Desfibrilador/);
    expect(title).not.toContain('Cardiología /');
  });
});

describe('buildProductoSeo', () => {
  it('usa keyword editorial en title/description cuando existe', () => {
    const seo = buildProductoSeo(
      {
        nombre: 'Bomba de Infusión IP-200',
        descripcion_corta: 'Bomba volumétrica para terapia IV hospitalaria.',
        imagen_principal: null,
        slug: 'bomba-de-infusion-ref-ip-200-advanced',
        seo_keywords: ['bombas infusión hospitalarias', 'terapia IV UCI'],
      },
      'es',
      'Soluciones IV',
      null
    );
    expect(seo.title).toContain('I-ME');
    expect(seo.description.toLowerCase()).toContain('bombas');
    expect(seo.canonical).toContain('/es/productos/bomba-de-infusion-ref-ip-200-advanced');
  });

  it('no mete «quote» ni «cotización» en el title', () => {
    const seo = buildProductoSeo(
      {
        nombre: 'Biolight S12 patient monitor',
        descripcion_corta: 'Biolight S12 patient monitor with a 12.1-inch display.',
        imagen_principal: null,
        slug: 'monitor-de-paciente-ref-s12-biolight',
        seo_keywords: ['biolight s12 patient monitor', 'biolight', 'quote', 'hospital equipment'],
      },
      'en',
      'Patient monitors',
      'Biolight'
    );
    expect(seo.title.toLowerCase()).not.toContain('quote');
    expect(seo.title).not.toContain('hospital equipment');
  });

  it('cae a categoría como intent si no hay seo_keywords', () => {
    const seo = buildProductoSeo(
      {
        nombre: 'Autoclave Horizontal 5075',
        descripcion_corta: 'Esterilización a vapor para CSSD.',
        imagen_principal: null,
        slug: 'autoclave-horizontal-ref-5075-tuttnauer',
        seo_keywords: [],
      },
      'es',
      'Esterilización',
      null
    );
    expect(seo.description.toLowerCase()).toContain('esterilización');
    expect(seo.title).toMatch(/Esterilización/);
  });
});

describe('descripciones hermanas', () => {
  const base = {
    descripcion_corta:
      'La Faja Abdominal Konfort Plus está diseñada para brindar soporte y mejorar la postura.',
    imagen_principal: null,
  };

  it('distingue productos que comparten la misma descripcion_corta', () => {
    const a = buildProductoSeo(
      { ...base, nombre: 'Faja Abdominal De 30 cm Talla S/M', slug: 'faja-30-sm' },
      'es',
      'Ortopedia',
      'Konfort Plus'
    );
    const b = buildProductoSeo(
      { ...base, nombre: 'Faja Abdominal De 30 cm Talla L/XL', slug: 'faja-30-lxl' },
      'es',
      'Ortopedia',
      'Konfort Plus'
    );
    expect(a.description).not.toBe(b.description);
    expect(a.description).toContain('S/M');
    expect(b.description).toContain('L/XL');
  });

  it('no antepone el nombre cuando la descripción ya lo distingue', () => {
    const seo = buildProductoSeo(
      {
        nombre: 'Monitor de Paciente P22 Biolight',
        descripcion_corta: 'El monitor P22 Biolight ofrece monitoreo multiparamétrico continuo.',
        imagen_principal: null,
        slug: 'monitor-p22',
      },
      'es',
      'Monitorización',
      'Biolight'
    );
    expect(seo.description.startsWith('El monitor P22')).toBe(true);
  });
});

describe('buildProductoPageTitle · títulos muy cortos', () => {
  it('añade la marca del fabricante cuando el título completo queda por debajo de 30 caracteres', () => {
    expect(buildProductoPageTitle('Cama Manual K3k', 'es', undefined, 'Saikang')).toBe(
      'Cama Manual K3k Saikang | I-ME'
    );
    expect(buildProductoPageTitle('Autoclave T-Max 6', 'es', undefined, 'Tuttnauer')).toBe(
      'Autoclave T-Max 6 Tuttnauer | I-ME'
    );
  });

  it('no repite la marca si el nombre ya la incluye', () => {
    expect(buildProductoPageTitle('Cama Saikang K3k', 'es', undefined, 'Saikang')).toBe(
      'Cama Saikang K3k | I-ME'
    );
  });

  it('no toca los títulos que ya tienen longitud suficiente', () => {
    const title = buildProductoPageTitle(
      'Monitor de paciente Ref. SK-EM005',
      'es',
      undefined,
      'Saikang'
    );
    expect(title).toBe('Monitor de paciente Ref. SK-EM005 | I-ME');
  });

  it('sin marca conserva el comportamiento anterior', () => {
    expect(buildProductoPageTitle('Cama Manual K3k', 'es')).toBe('Cama Manual K3k | I-ME');
  });
});

describe('resolveRobotsContent', () => {
  it('por defecto la página se indexa', () => {
    expect(resolveRobotsContent(false, false)).toBe('index, follow, max-image-preview:large');
    expect(resolveRobotsContent(undefined, false)).toBe('index, follow, max-image-preview:large');
  });

  it('una página que pide noindex lo conserva', () => {
    expect(resolveRobotsContent(true, false)).toBe('noindex, nofollow');
  });

  it('un build de vista previa (PUBLIC_NOINDEX=1) no indexa nada aunque la página lo permita', () => {
    expect(resolveRobotsContent(false, true)).toBe('noindex, nofollow');
    expect(resolveRobotsContent(undefined, true)).toBe('noindex, nofollow');
  });
});

describe('truncateMetaDescription', () => {
  it('recorta en el último espacio y no añade elipsis', () => {
    const head = 'palabra '.repeat(14);
    const value = `${head}${'Z'.repeat(50)} fin`;
    const out = truncateMetaDescription(value, 155);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith('palabra')).toBe(true);
    expect(out).not.toContain('Z');
    expect(out).not.toMatch(/…|\.\.\./);
  });

  it('deja intacto un texto que ya cabe', () => {
    expect(truncateMetaDescription('Cotice por WhatsApp.')).toBe('Cotice por WhatsApp.');
  });
});

describe('buildServiciosSeo', () => {
  it('no afirma registro INVIMA ni ingenieros certificados', () => {
    for (const locale of ['es', 'en'] as const) {
      const seo = buildServiciosSeo(locale);
      const faq = buildServiciosFaqItems(locale)
        .map(item => `${item.q} ${item.a}`)
        .join(' ');
      const json = JSON.stringify(buildServiciosJsonLd(locale));
      const blob = `${seo.description} ${faq} ${json}`;
      expect(seo.description.length).toBeLessThanOrEqual(155);
      expect(blob).not.toMatch(/registro INVIMA|INVIMA-registered|ingenieros certificados/i);
      expect(blob.toLowerCase()).not.toContain('certified engineers');
    }
    expect(buildServiciosSeo('es').description.toLowerCase()).toContain('calibración incluida');
    expect(buildServiciosSeo('en').description.toLowerCase()).toContain('calibration included');
    expect(buildServiciosSeo('es').description).not.toMatch(/venta,\s*calibración/i);
    expect(buildServiciosSeo('en').title.toLowerCase()).toContain('renewal');
    expect(buildServiciosSeo('en').title.toLowerCase()).toContain('health sector');
  });
});

describe('buildProductoSeo · meta description sin cortes a mitad de palabra', () => {
  // Regresión: la meta salía como "…movilidad co. silla de ruedas…" y "Konfort Plu.".
  const source =
    'La Silla de Ruedas Estándar con Rin Estrella KP está diseñada para ofrecer movilidad confiable, confort y resistencia para uso diario en hogares y clínicas de Colombia.';

  it('la parte inicial de la descripción termina en una palabra completa', () => {
    const seo = buildProductoSeo(
      {
        nombre: 'Silla De Ruedas Estándar Con Rin Estrella KP',
        descripcion_corta: source,
        imagen_principal: null,
        slug: 'silla-de-ruedas-estandar-con-rin-estrella-kp-ref-kbe-9000',
        seo_keywords: ['silla de ruedas estándar KP'],
      },
      'es',
      'Sillas de ruedas',
      'Konfort Plus'
    );
    const lead = seo.description.split(' silla de ruedas')[0].replace(/\.$/, '');
    expect(source.startsWith(lead)).toBe(true);
    expect(' .,;:'.includes(source.charAt(lead.length))).toBe(true);
  });
});
