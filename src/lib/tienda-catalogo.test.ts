import { describe, expect, it } from 'vitest';
import {
  enlaceFamiliaTensiometro,
  itemDeTienda,
  rangoPrecios,
  textoSeoTienda,
} from './tienda-catalogo';
import type { CatalogoIndexItem } from './catalogo';

function item(
  partial: Partial<CatalogoIndexItem> & Pick<CatalogoIndexItem, 'slug'>
): CatalogoIndexItem {
  return {
    id: partial.slug,
    nombre: partial.nombre ?? partial.slug,
    familia: { slug: 'movilidad-rehabilitacion', nombre: 'Movilidad' },
    familias_filtro: [],
    tipo: partial.tipo ?? null,
    descripcion_corta: '',
    imagen_principal: null,
    tipo_comercial: 'equipo',
    fulfillment_mode: 'dropship',
    moneda: 'COP',
    stock: null,
    disponible: true,
    destacado: false,
    nuevo: false,
    texto_busqueda: partial.slug,
    especificaciones_reducidas: {},
    ...partial,
  };
}

describe('tienda catalogo', () => {
  it('separa bastones de recatones y muletas', () => {
    const baston = item({
      slug: 'baston-con-empunadura-en-t-ergonomico-color-negro-ref-kp4102-20-konfort-plus',
      tipo: { slug: 'bastones-y-muletas', nombre: 'Bastones' },
      precio: 26061,
    });
    const recaton = item({
      slug: 'recaton-color-negro-para-baston-de-1-apoyo-ref-kp4-1t-20d',
      tipo: { slug: 'bastones-y-muletas', nombre: 'Bastones' },
      precio: 4605,
    });
    const muleta = item({
      slug: 'muleta-canadiense-adulto-integral-color-plata-ref-kp321-al-19-konfort-plus',
      tipo: { slug: 'bastones-y-muletas', nombre: 'Bastones' },
      precio: 67711,
    });
    expect(itemDeTienda(baston, 'bastones')).toBe(true);
    expect(itemDeTienda(recaton, 'bastones')).toBe(false);
    expect(itemDeTienda(muleta, 'bastones')).toBe(false);
  });

  it('arma title con precio y envío solo si hay rango', () => {
    const seo = textoSeoTienda('es', 'sillas', { min: 327250, max: 2971430, count: 25 });
    expect(seo.title).toContain('327');
    expect(seo.title.toLowerCase()).toContain('envío a colombia');
    expect(seo.description).toContain('10 días hábiles');
    expect(seo.description).not.toMatch(/\$|COP|\d{3,}/);
    expect(seo.description.toLowerCase()).toContain('cotice');
    expect(
      textoSeoTienda('es', 'tensiometros', { min: 60829, max: 115418, count: 3 }).description
    ).not.toMatch(/\$|COP|\d{3,}/);
    expect(rangoPrecios([{ precio: null }, { precio: 100 }, { precio: 40 }])).toEqual({
      min: 40,
      max: 100,
      count: 2,
    });
    expect(rangoPrecios([{ precio: null }])).toBeNull();
  });

  it('enlaza la ficha del tensiómetro digital con la página de familia', () => {
    expect(
      enlaceFamiliaTensiometro('es', 'tensiometro-digital-carditek-vital-ref-cdk-bpm-65r')
    ).toEqual({
      href: '/es/tensiometros-digitales/',
      label: 'Ver tensiómetros digitales',
    });
    expect(
      enlaceFamiliaTensiometro('en', 'tensiometro-digital-carditek-smart-ref-cdk-bpm-66ep')?.href
    ).toBe('/en/digital-blood-pressure-monitors/');
    expect(
      enlaceFamiliaTensiometro('es', 'silla-de-ruedas-estandar-con-rin-estrella-kp-ref-kbe-9000d')
    ).toBeNull();
  });
});
