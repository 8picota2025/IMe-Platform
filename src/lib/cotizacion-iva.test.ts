import { describe, expect, it } from 'vitest';
import {
  aplicarDescuento,
  desgloseCotizacion,
  parseTratamientoIva,
  resolverPreciosLinea,
  resolverTratamientoLinea,
  revertirDescuento,
  totalPagarCotizacion,
} from './cotizacion-iva';
import { buildWompiCheckoutUrl } from './wompi-checkout';

const walker = {
  slug: 'caminador-con-ruedas-de-5-en-aluminio-color-gris-ref-kp153-al-19-konfort-plus',
  nombre: 'Caminador KP153-AL-19',
  cantidad: 1,
  precio_unitario: 178_900,
  subtotal: 178_900,
  moneda: 'COP',
  tratamiento_iva: 'excluido' as const,
};

describe('IVA por línea de la cotización', () => {
  it('IME-Q-2026-000039: caminador KP153-AL-19 con IVA 0 queda en 178.900 aunque el catálogo esté en blanco o al 19 %', () => {
    const productos = new Map([[walker.slug, { tarifa_iva_pct: null, excluido_iva: false }]]);
    const conCatalogoEnBlanco = desgloseCotizacion([walker], {
      impuestosIncluidos: true,
      moneda: 'COP',
      productos,
    });
    expect(conCatalogoEnBlanco.iva).toBe(0);
    expect(conCatalogoEnBlanco.total).toBe(178_900);
    expect(conCatalogoEnBlanco.base).toBe(178_900);

    const catalogo19 = new Map([[walker.slug, { tarifa_iva_pct: 19, excluido_iva: false }]]);
    const sobre19 = totalPagarCotizacion([walker], {
      impuestosIncluidos: false,
      moneda: 'COP',
      productos: catalogo19,
    });
    expect(sobre19).toBe(178_900);
    expect(resolverTratamientoLinea(walker, { tarifa_iva_pct: 19 }, 'COP')).toBe('excluido');
  });

  it('IME-Q-2026-000038: con IVA incluido el total a pagar es 178.900 y 150336.13 es solo la base', () => {
    const linea = {
      ...walker,
      tratamiento_iva: '19' as const,
    };
    const desglose = desgloseCotizacion([linea], {
      impuestosIncluidos: true,
      moneda: 'COP',
    });
    expect(desglose.base).toBe(150_336.13);
    expect(desglose.total).toBe(178_900);
    expect(desglose.total).not.toBe(desglose.base);
    expect(desglose.iva).toBeCloseTo(28_563.87, 2);
    expect(Math.round((desglose.base + desglose.iva) * 100) / 100).toBe(178_900);
  });

  it('sin el flag, el 19 % se suma y el total con IVA es el que se cobra', () => {
    const desglose = desgloseCotizacion(
      [{ ...walker, precio_unitario: 150_336.13, tratamiento_iva: '19' }],
      { impuestosIncluidos: false, moneda: 'COP' }
    );
    expect(desglose.base).toBe(150_336.13);
    expect(desglose.total).toBe(178_899.99);
  });

  it('la línea manda sobre el producto; el producto en blanco cae en 19 %', () => {
    const linea = { ...walker, tratamiento_iva: undefined };
    expect(resolverTratamientoLinea(linea, { tarifa_iva_pct: null }, 'COP')).toBe('19');
    expect(resolverTratamientoLinea(linea, { excluido_iva: true }, 'COP')).toBe('excluido');
    expect(resolverTratamientoLinea(linea, { tarifa_iva_pct: 0 }, 'COP')).toBe('excluido');
    expect(resolverTratamientoLinea(linea, { tarifa_iva_pct: 5 }, 'COP')).toBe('5');
    expect(parseTratamientoIva('exento')).toBe('exento');
    expect(parseTratamientoIva('cualquiera')).toBeNull();
  });

  it('suma IVA unitario por producto sin reescribirlo, aunque las tarifas difieran', () => {
    const desglose = desgloseCotizacion(
      [
        {
          slug: 'a',
          nombre: 'A',
          cantidad: 2,
          precio_unitario: 100000,
          precio_bruto: 100000,
          descuento_pct: 0,
          iva_unitario: 19000,
          subtotal: 200000,
          moneda: 'COP',
          tratamiento_iva: '19',
        },
        {
          slug: 'b',
          nombre: 'B',
          cantidad: 1,
          precio_unitario: 50000,
          precio_bruto: 50000,
          iva_unitario: 2500,
          subtotal: 50000,
          moneda: 'COP',
          tratamiento_iva: '5',
        },
      ],
      { impuestosIncluidos: false, moneda: 'COP' }
    );
    expect(desglose.lineas[0]!.ivaUnitario).toBe(19000);
    expect(desglose.lineas[0]!.iva).toBe(38000);
    expect(desglose.lineas[1]!.iva).toBe(2500);
    expect(desglose.iva).toBe(40500);
    expect(desglose.total).toBe(290500);
    expect(desglose.tasaUnica).toBeNull();
  });

  it('si el IVA está marcado y el unitario viene en 0, lo calcula y lo suma', () => {
    const desglose = desgloseCotizacion(
      [
        {
          slug: 'a',
          nombre: 'A',
          cantidad: 2,
          precio_unitario: 80000,
          precio_bruto: 100000,
          descuento_pct: 20,
          iva_unitario: 0,
          subtotal: 160000,
          moneda: 'COP',
          tratamiento_iva: '19',
        },
      ],
      { impuestosIncluidos: false, moneda: 'COP' }
    );
    expect(desglose.lineas[0]!.ivaUnitario).toBe(15200);
    expect(desglose.iva).toBe(30400);
    expect(desglose.base).toBe(160000);
    expect(desglose.total).toBe(190400);
  });

  it('el descuento baja el neto y no toca un IVA unitario guardado', () => {
    const desglose = desgloseCotizacion(
      [
        {
          slug: 'a',
          nombre: 'A',
          cantidad: 1,
          precio_unitario: 80000,
          precio_bruto: 100000,
          descuento_pct: 20,
          iva_unitario: 11111,
          subtotal: 80000,
          moneda: 'COP',
          tratamiento_iva: '19',
        },
      ],
      { impuestosIncluidos: false, moneda: 'COP' }
    );
    expect(desglose.base).toBe(80000);
    expect(desglose.iva).toBe(11111);
    expect(desglose.bruto).toBe(100000);
    expect(desglose.total).toBe(91111);
  });

  it('el descuento es directo desde bruto e inverso desde neto', () => {
    expect(aplicarDescuento(100000, 20)).toBe(80000);
    expect(revertirDescuento(80000, 20)).toBe(100000);
    expect(resolverPreciosLinea({ precio_bruto: 100000, descuento_pct: 10 }).neto).toBe(90000);
    expect(
      resolverPreciosLinea({ precio_neto: 90000, descuento_pct: 10 }, 'neto').bruto
    ).toBe(100000);
    expect(
      resolverPreciosLinea(
        { precio_bruto: 100000, precio_neto: 80000, descuento_pct: 20 },
        'neto'
      ).bruto
    ).toBe(100000);
  });

  it('exento también deja el total en el precio digitado', () => {
    const total = totalPagarCotizacion([{ ...walker, tratamiento_iva: 'exento' }], {
      impuestosIncluidos: true,
      moneda: 'COP',
    });
    expect(total).toBe(178_900);
  });
});

describe('enlace Wompi de la cotización', () => {
  it('firma el total con IVA en centavos y la referencia es el número de cotización', async () => {
    const built = await buildWompiCheckoutUrl({
      publicKey: 'pub_test_ime',
      integritySecret: 'integrity-test',
      reference: 'IME-Q-2026-000039',
      total: 178_900,
      currency: 'COP',
      redirectUrl: 'https://i-me.com.co/es/pago/resultado?ref=IME-Q-2026-000039',
      email: 'cliente@example.com',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const url = new URL(built.url);
    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/');
    expect(url.searchParams.get('reference')).toBe('IME-Q-2026-000039');
    expect(url.searchParams.get('amount-in-cents')).toBe('17890000');
    expect(url.searchParams.get('currency')).toBe('COP');
    expect(url.searchParams.get('public-key')).toBe('pub_test_ime');
    expect(url.searchParams.get('signature:integrity')).toMatch(/^[0-9a-f]{64}$/);
    expect(built.url).not.toContain('integrity-test');
  });

  it('nombra la llave que falta y no inventa un enlace', async () => {
    const sinPublica = await buildWompiCheckoutUrl({
      publicKey: '',
      integritySecret: 'integrity-test',
      reference: 'IME-Q-2026-000039',
      total: 178_900,
      redirectUrl: 'https://i-me.com.co/es/pago/resultado',
    });
    expect(sinPublica).toEqual({
      ok: false,
      error: 'BLOQUEANTE_BACKEND: WOMPI_PUBLIC_KEY no configurado',
    });
    const sinIntegridad = await buildWompiCheckoutUrl({
      publicKey: 'pub_test_ime',
      integritySecret: '  ',
      reference: 'IME-Q-2026-000039',
      total: 178_900,
      redirectUrl: 'https://i-me.com.co/es/pago/resultado',
    });
    expect(sinIntegridad).toEqual({
      ok: false,
      error: 'BLOQUEANTE_BACKEND: WOMPI_INTEGRITY_SECRET no configurado',
    });
  });
});
