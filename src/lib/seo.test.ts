import { describe, expect, it } from 'vitest';
import {
  buildProductJsonLd,
  buildProductoPageTitle,
  buildProductoSeo,
  PRODUCT_TITLE_MAX,
} from './seo';

describe('buildProductJsonLd', () => {
  const producto = {
    nombre: 'Monitor de Paciente Biolight M12',
    descripcion_corta: 'Monitor de paciente compacto.',
    imagen_principal: '/assets/importados/equitronic/img/monitor-de-paciente-m12-biolight-1.jpg',
    slug: 'eq-monitor-de-paciente-m12-biolight',
    precio: 12500000,
    moneda: 'COP',
  };

  it('usa la marca del fabricante cuando esta presente', () => {
    const jsonLd = buildProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect((jsonLd.brand as { name: string }).name).toBe('Biolight');
  });

  it('cae a I-ME cuando no hay marca', () => {
    const jsonLd = buildProductJsonLd(producto, 'es', 'Monitores', null);
    expect((jsonLd.brand as { name: string }).name).toBe('I-ME International Medical Enterprise');
  });

  it('marca MedicalDevice solo con certificaciones normativas reales', () => {
    const plain = buildProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect(plain['@type']).toBe('Product');
    const withCert = buildProductJsonLd(producto, 'es', 'Monitores', 'Biolight', {
      certificaciones: ['INVIMA'],
      familiaSlug: 'monitores',
    });
    expect(withCert['@type']).toEqual(['Product', 'MedicalDevice']);
    expect(withCert.additionalType).toContain('/es/familias/monitores/');
  });

  it('incluye precio y moneda cuando el producto los tiene visibles', () => {
    const jsonLd = buildProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect((jsonLd.offers as { price: number }).price).toBe(12500000);
    expect((jsonLd.offers as { priceCurrency: string }).priceCurrency).toBe('COP');
  });
});

describe('buildProductoPageTitle', () => {
  it('añade categoría e INVIMA cuando cabe', () => {
    const title = buildProductoPageTitle('Bomba IP-200', 'es', 'Soluciones IV', null);
    expect(title).toContain('Bomba IP-200');
    expect(title).toContain('I-ME');
    expect(title).toMatch(/Soluciones IV/i);
    expect(title).toContain('INVIMA');
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

  it('no deja preposición colgante al truncar', () => {
    const title = buildProductoPageTitle(
      'Desfibrilador Bifásico con Monitor',
      'es',
      'Cardiología / reanimación',
      null
    );
    expect(title).not.toMatch(/\scon\s*\|/i);
    expect(title).toMatch(/Cardiología INVIMA|Cardiología \| I-ME|Desfibrilador/);
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
        slug: 'bomba-de-infusion-ip-200',
        seo_keywords: ['bombas infusión hospitalarias', 'terapia IV UCI'],
      },
      'es',
      'Soluciones IV',
      null
    );
    expect(seo.title).toContain('I-ME');
    expect(seo.description.toLowerCase()).toContain('bombas');
    expect(seo.canonical).toContain('/es/productos/bomba-de-infusion-ip-200');
  });

  it('cae a categoría como intent si no hay seo_keywords', () => {
    const seo = buildProductoSeo(
      {
        nombre: 'Autoclave Horizontal 5075',
        descripcion_corta: 'Esterilización a vapor para CSSD.',
        imagen_principal: null,
        slug: 'autoclave-horizontal-5075',
        seo_keywords: [],
      },
      'es',
      'Esterilización',
      null
    );
    expect(seo.description.toLowerCase()).toContain('esterilización');
    expect(seo.title).toMatch(/INVIMA|Esterilización/);
  });
});
