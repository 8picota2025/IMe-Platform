import { describe, expect, it } from 'vitest';
import type { Producto } from './datos';
import { esPieza, seleccionarRelacionados } from './relacion-accesorios';

function producto(
  partial: Pick<Producto, 'slug' | 'nombre' | 'sku' | 'tipo_comercial'> &
    Partial<Pick<Producto, 'familia_slug'>>
): Producto {
  return {
    id: partial.slug,
    slug: partial.slug,
    familia_id: 'fam',
    familia_slug: partial.familia_slug ?? 'fam',
    tipo_id: null,
    nombre: partial.nombre,
    descripcion_corta: '',
    descripcion_larga: '',
    especificaciones: [],
    aplicaciones: [],
    beneficios: [],
    valor: null,
    preguntas_frecuentes: [],
    seo_keywords: [],
    marca: null,
    imagen_principal: null,
    galeria: [],
    ficha_pdf: null,
    tipo_comercial: partial.tipo_comercial,
    fulfillment_mode: 'cotizacion',
    precio: null,
    moneda: 'COP',
    sku: partial.sku,
    stock: null,
    disponible: true,
    destacado: false,
    nuevo: false,
    activo: true,
    orden: 0,
  };
}

const glucometro = producto({
  slug: 'glucometro-latidos-ref-ltd-b10',
  nombre: 'Glucómetro Latidos',
  sku: 'LTD-B10',
  tipo_comercial: 'equipo',
  familia_slug: 'diagnostico',
});
const tirillas = producto({
  slug: 'tirillas-reactivas-para-el-glucometro-ltd-b10-x-50-unidades-ref-ltd-b10-tr',
  nombre: 'Tirillas reactivas para el glucómetro',
  sku: 'LTD-B10-TR',
  tipo_comercial: 'consumible',
  familia_slug: 'diagnostico',
});
const lancetas = producto({
  slug: 'lancetas-ref-ltd-b10-l',
  nombre: 'Lancetas para glucómetros',
  sku: 'LTD-B10-L',
  tipo_comercial: 'consumible',
  familia_slug: 'diagnostico',
});
const kit = producto({
  slug: 'kit-ref-ltd-b10-k',
  nombre: 'Kit de glucometría',
  sku: 'LTD-B10-K',
  tipo_comercial: 'equipo',
  familia_slug: 'diagnostico',
});
const tapon = producto({
  slug: 'tapon-para-comodo-kp2-6542sr-ref-kp2-6542sr-tipn',
  nombre: 'Tapón para cómodo KP2-6542SR',
  sku: 'KP2-6542SR-TIPN',
  tipo_comercial: 'equipo',
  familia_slug: 'avd',
});
const asiento = producto({
  slug: 'asiento-kp2-6542sr',
  nombre: 'Asiento para cómodo sanitario KP2-6542SR',
  sku: 'KP2-6542SR-AP1-A',
  tipo_comercial: 'equipo',
  familia_slug: 'avd',
});
const espaldar = producto({
  slug: 'espaldar-kp2-6542sr',
  nombre: 'Espaldar para cómodo sanitario KP2-6542SR',
  sku: 'KP2-6542SR-AP1-R',
  tipo_comercial: 'equipo',
  familia_slug: 'avd',
});
const fajaLxl = producto({
  slug: 'faja-lumbo-sacra-tipo-camp-talla-l-xl-ref-kbf-camp-lxl',
  nombre: 'Faja lumbo sacra tipo camp talla L-XL',
  sku: 'KBF-CAMP-LXL',
  tipo_comercial: 'consumible',
  familia_slug: 'ortopedia',
});
const fajaSm = producto({
  slug: 'faja-lumbo-sacra-tipo-camp-talla-s-m-ref-kbf-camp-sm',
  nombre: 'Faja lumbo sacra tipo camp talla S-M',
  sku: 'KBF-CAMP-SM',
  tipo_comercial: 'consumible',
  familia_slug: 'ortopedia',
});
const cama = producto({
  slug: 'cama-sk-c1',
  nombre: 'Cama hospitalaria SK-C1',
  sku: 'SK-C1',
  tipo_comercial: 'equipo',
  familia_slug: 'camas',
});
const camaVariante = producto({
  slug: 'cama-sk-c1-r00',
  nombre: 'Cama hospitalaria SK-C1 R00',
  sku: 'SK-C1-R00',
  tipo_comercial: 'equipo',
  familia_slug: 'camas',
});

const catalogo = [
  glucometro,
  tirillas,
  lancetas,
  kit,
  tapon,
  asiento,
  espaldar,
  fajaLxl,
  fajaSm,
  cama,
  camaVariante,
];

describe('relacion-accesorios', () => {
  it('trata consumibles y piezas por nombre como pieza, no variantes de equipo', () => {
    expect(esPieza(tirillas)).toBe(true);
    expect(esPieza(tapon)).toBe(true);
    expect(esPieza(kit)).toBe(true);
    expect(esPieza(glucometro)).toBe(false);
    expect(esPieza(cama)).toBe(false);
    expect(esPieza(camaVariante)).toBe(false);
  });

  it('enlaza tirillas con el glucómetro y sus piezas, sin inventar precio ni padre', () => {
    const slugs = seleccionarRelacionados(tirillas, [glucometro, tirillas, lancetas], catalogo).map(
      item => item.slug
    );
    expect(slugs[0]).toBe(glucometro.slug);
    expect(slugs).toContain(lancetas.slug);
    expect(slugs).toContain(kit.slug);
    expect(slugs).not.toContain(tapon.slug);
  });

  it('el glucómetro lista sus accesorios de SKU', () => {
    const slugs = seleccionarRelacionados(glucometro, [glucometro, tirillas], catalogo).map(
      item => item.slug
    );
    expect(slugs).toEqual(expect.arrayContaining([tirillas.slug, lancetas.slug, kit.slug]));
    expect(slugs).not.toContain(cama.slug);
  });

  it('agrupa tapón, asiento y espaldar sin inventar el cómodo ausente', () => {
    const slugs = seleccionarRelacionados(tapon, [tapon, asiento, espaldar], catalogo).map(
      item => item.slug
    );
    expect(slugs).toContain(asiento.slug);
    expect(slugs).toContain(espaldar.slug);
    expect(slugs.every(slug => slug !== 'comodo-kp2-6542sr')).toBe(true);
  });

  it('enlaza tallas de la misma faja', () => {
    const slugs = seleccionarRelacionados(fajaLxl, [fajaLxl, fajaSm], catalogo).map(
      item => item.slug
    );
    expect(slugs[0]).toBe(fajaSm.slug);
  });

  it('no relaciona variantes de equipo que solo comparten prefijo de SKU', () => {
    const slugs = seleccionarRelacionados(cama, [], catalogo).map(item => item.slug);
    expect(slugs).not.toContain(camaVariante.slug);
    const inversa = seleccionarRelacionados(camaVariante, [], catalogo).map(item => item.slug);
    expect(inversa).not.toContain(cama.slug);
  });
});
