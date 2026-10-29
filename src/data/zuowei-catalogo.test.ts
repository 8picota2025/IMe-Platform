import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildProductJsonLd } from '../lib/seo';
import { vistasZuowei } from './zuowei-catalogo';
import {
  ZUOWEI_GARANTIA,
  ZUOWEI_PRODUCTOS,
  ZUOWEI_SLUGS,
  enlacesZuowei,
  rehabZuowei,
  seoZuowei,
} from './zuowei-catalogo';

const PHONE = '+57 313 724 7353';

describe('catálogo Zuowei', () => {
  it('publica los 9 modelos como nuevo, destacado y bajo cotización', () => {
    expect(ZUOWEI_PRODUCTOS.map(producto => producto.sku)).toEqual([
      'ZW568',
      'ZW598',
      'ZW518',
      'ZW302',
      'ZW365D-2',
      'ZW366S',
      'ZW186',
      'ZW501',
      'ZW502',
    ]);
    for (const locale of ['es', 'en'] as const) {
      for (const vista of vistasZuowei(locale)) {
        expect(vista.nuevo).toBe(true);
        expect(vista.destacado).toBe(true);
        expect(vista.precio).toBeNull();
        expect(vista.fulfillment_mode).toBe('cotizacion');
        expect(vista.alt_imagen.length).toBeGreaterThan(10);
        expect(vista.imagen_ancho).toBeGreaterThan(0);
        expect(vista.imagen_alto).toBeGreaterThan(0);
        expect(existsSync(`public${vista.imagen_principal}`)).toBe(true);
        for (const src of vista.galeria) expect(existsSync(`public${src}`)).toBe(true);
        const jsonLd = buildProductJsonLd(vista, locale, 'Zuowei', vista.marca);
        expect(jsonLd).toBeNull();
      }
    }
  });

  it('usa el teléfono único, la garantía del fabricante y no inventa INVIMA ni voltaje', () => {
    const texto = JSON.stringify(ZUOWEI_PRODUCTOS);
    expect(texto).toContain(PHONE);
    expect(texto).toContain(ZUOWEI_GARANTIA.es);
    expect(texto).not.toMatch(/Equitronic|Northern|Monnal|INVIMA/);
    expect(texto).not.toMatch(/220\s*V/);
    const conCargador = ZUOWEI_PRODUCTOS.filter(producto =>
      JSON.stringify(producto.especificaciones).includes('110–240 V')
    );
    expect(conCargador.map(producto => producto.sku)).toEqual(['ZW365D-2']);
  });

  it('omite carga del ZW518, cifras del ZW186-2 y carga o autonomía del ZW502', () => {
    const zw518 = JSON.stringify(ZUOWEI_PRODUCTOS.find(producto => producto.sku === 'ZW518'));
    expect(zw518).not.toMatch(/120\s*kg|130\s*kg/);
    const zw186 = JSON.stringify(ZUOWEI_PRODUCTOS.find(producto => producto.sku === 'ZW186'));
    expect(zw186).not.toMatch(/ZW186-2|5,2|25–45|infeccion/i);
    const zw502 = JSON.stringify(ZUOWEI_PRODUCTOS.find(producto => producto.sku === 'ZW502'));
    expect(zw502).not.toMatch(/20–30|130\s*kg|6–8\s*h/);
    expect(zw502).toContain('16 kg');
  });

  it('enlaza la marcha con la landing y conserva title y meta del brief', () => {
    expect(rehabZuowei().map(producto => producto.sku)).toEqual(['ZW568', 'ZW598', 'ZW518']);
    expect(ZUOWEI_SLUGS).toHaveLength(9);
    const seo = seoZuowei(ZUOWEI_SLUGS[0]!, 'es');
    expect(seo?.title).toBe('Exoesqueleto de marcha Zuowei ZW568 | I-ME Colombia');
    expect(seo?.description.length).toBeLessThanOrEqual(155);
    for (const producto of ZUOWEI_PRODUCTOS) {
      expect(seoZuowei(producto.slug, 'es')?.description.length).toBeLessThanOrEqual(155);
      expect(seoZuowei(producto.slug, 'en')?.description.length).toBeLessThanOrEqual(155);
    }
    const enlaces = enlacesZuowei(ZUOWEI_SLUGS[0]!, 'es');
    expect(enlaces[0]?.href).toContain('/es/distribuidores-de-robots-');
    expect(enlaces.map(enlace => enlace.href).join(' ')).toContain('zw598');
    expect(enlaces.map(enlace => enlace.href).join(' ')).toContain('zw518');
  });
});
