import { describe, expect, it } from 'vitest';

import {
  buildDianInvoiceDraft,
  baseNetaDesdePrecioConIva,
  calculateFiscalSummary,
  digitoVerificacionNit,
  fiscalProfileFromLockedOffer,
  normalizeNumeroDocumento,
  validateClienteFiscal,
  type ClienteFiscalProfile,
} from './fiscal';

describe('fiscal', () => {
  const clienteFiscal: ClienteFiscalProfile = {
    solicitar_factura_electronica: true,
    tipo_documento: 'NIT',
    numero_documento: '900123456',
    tipo_persona: 'juridica',
    razon_social: 'Hospital Demo SAS',
    responsable_iva: true,
    agente_retencion: true,
    agente_reteica: true,
    email_facturacion: 'facturas@hospital-demo.test',
    direccion_facturacion: {
      direccion: 'Calle 1 # 2-3',
      ciudad: 'Medellin',
      departamento: 'Antioquia',
      pais: 'CO',
    },
  };

  it('deriva la base gravable desde un precio de oferta con IVA incluido', () => {
    expect(baseNetaDesdePrecioConIva(119000, 19)).toBe(100000);
    expect(baseNetaDesdePrecioConIva(100000, 0)).toBe(100000);
  });

  it('locked offer without FE charges the offered total (no catalog IVA stack)', () => {
    const line = fiscalProfileFromLockedOffer({
      producto_id: 'prod-1',
      slug: 'monitor-uci',
      nombre: 'Monitor UCI',
      cantidad: 1,
      precio_unitario_ofertado: 10_000_000,
      solicitar_factura_electronica: false,
      impuestos_incluidos: false,
      producto: { tarifa_iva_pct: 19, excluido_iva: false },
    });
    expect(line.excluido_iva).toBe(true);
    expect(line.precio_unitario).toBe(10_000_000);

    const stackedWrong = calculateFiscalSummary(
      [
        {
          cantidad: 1,
          precio_unitario: 10_000_000,
          tarifa_iva_pct: 19,
        },
      ],
      { solicitar_factura_electronica: false },
      { moneda: 'COP', mercado: 'CO', default_iva_pct: 0 }
    );
    expect(stackedWrong.total).toBe(11_900_000);

    const fixed = calculateFiscalSummary([line], { solicitar_factura_electronica: false }, {
      moneda: 'COP',
      mercado: 'CO',
      default_iva_pct: 0,
    });
    expect(fixed.total).toBe(10_000_000);
  });

  it('locked offer with FE + impuestos_incluidos rebuilds IVA without changing total', () => {
    const line = fiscalProfileFromLockedOffer({
      producto_id: 'prod-1',
      slug: 'monitor-uci',
      nombre: 'Monitor UCI',
      cantidad: 1,
      precio_unitario_ofertado: 11_900_000,
      solicitar_factura_electronica: true,
      impuestos_incluidos: true,
      producto: { tarifa_iva_pct: 19, excluido_iva: false, dian_codigo: '42142100' },
    });
    expect(line.precio_unitario).toBe(10_000_000);
    expect(line.tarifa_iva_pct).toBe(19);

    const fiscal = calculateFiscalSummary([line], clienteFiscal, {
      moneda: 'COP',
      mercado: 'CO',
      default_iva_pct: 0,
    });
    // Sin retenciones de producto, total == ofertado.
    expect(fiscal.impuesto_total).toBe(1_900_000);
    expect(fiscal.total).toBe(11_900_000);
  });

  it('locked offer with FE rejects missing impuestos_incluidos', () => {
    expect(() =>
      fiscalProfileFromLockedOffer({
        slug: 'monitor-uci',
        nombre: 'Monitor UCI',
        cantidad: 1,
        precio_unitario_ofertado: 10_000_000,
        solicitar_factura_electronica: true,
        impuestos_incluidos: false,
        producto: { tarifa_iva_pct: 19 },
      })
    ).toThrow(/impuestos/);
  });

  it('calcula iva y retenciones por linea', () => {
    const fiscal = calculateFiscalSummary(
      [
        {
          producto_id: 'prod-1',
          slug: 'consumible-demo',
          nombre: 'Consumible Demo',
          cantidad: 2,
          precio_unitario: 100000,
          tarifa_iva_pct: 19,
          retencion_fuente_pct: 2.5,
          retencion_iva_pct: 15,
          retencion_ica_pct: 0.966,
          dian_codigo: '42142500',
        },
      ],
      clienteFiscal,
      {
        moneda: 'COP',
        mercado: 'CO',
      }
    );

    expect(fiscal.subtotal).toBe(200000);
    expect(fiscal.impuesto_total).toBe(38000);
    expect(fiscal.retencion_fuente_total).toBe(5000);
    expect(fiscal.retencion_iva_total).toBe(5700);
    expect(fiscal.retencion_ica_total).toBe(1932);
    expect(fiscal.total).toBe(225368);
  });

  it('no calcula impuestos colombianos en mercado internacional', () => {
    const fiscal = calculateFiscalSummary(
      [
        {
          cantidad: 1,
          precio_unitario: 250,
          tarifa_iva_pct: 19,
          retencion_fuente_pct: 2.5,
        },
      ],
      clienteFiscal,
      {
        moneda: 'USD',
        mercado: 'INTL',
      }
    );

    expect(fiscal.impuesto_total).toBe(0);
    expect(fiscal.retencion_total).toBe(0);
    expect(fiscal.total).toBe(250);
  });

  it('valida datos minimos cuando se solicita factura electronica', () => {
    const errors = validateClienteFiscal(
      {
        solicitar_factura_electronica: true,
      },
      { moneda: 'COP', mercado: 'CO' }
    );

    expect(errors).toContain('tipo_documento requerido para facturacion electronica');
    expect(errors).toContain('direccion_facturacion.ciudad requerida para facturacion electronica');
  });

  it('normaliza NIT con espacios y rechaza NIT pegado en direccion', () => {
    expect(normalizeNumeroDocumento('NIT', '9 0 1 4 4 1 9 0 8 2')).toBe('9014419082');
    expect(normalizeNumeroDocumento('NIT', '901441908-2')).toBe('9014419082');
    expect(digitoVerificacionNit('901441908')).toBe(2);

    const errors = validateClienteFiscal(
      {
        solicitar_factura_electronica: true,
        tipo_documento: 'NIT',
        numero_documento: '9 0 1 4 4 1 9 0 8 2',
        tipo_persona: 'juridica',
        razon_social: 'JHBM',
        email_facturacion: 'a@b.co',
        direccion_facturacion: {
          direccion: '9 0 1 4 4 1 9 0 8-2',
          ciudad: 'Libano',
        },
      },
      { moneda: 'COP', mercado: 'CO' }
    );
    expect(errors.some(e => e.includes('direccion'))).toBe(true);
  });

  it('genera borrador DIAN con el desglose fiscal', () => {
    const fiscal = calculateFiscalSummary(
      [
        {
          slug: 'consumible-demo',
          nombre: 'Consumible Demo',
          cantidad: 1,
          precio_unitario: 100000,
          tarifa_iva_pct: 19,
          dian_codigo: '42142500',
        },
      ],
      clienteFiscal,
      { moneda: 'COP', mercado: 'CO' }
    );

    const draft = buildDianInvoiceDraft({
      referencia: 'pedido-1',
      fiscal,
      clienteFiscal,
      moneda: 'COP',
    });

    expect(draft?.cliente.numero_documento).toBe('900123456');
    expect(draft?.lineas[0]?.codigo).toBe('42142500');
    expect(draft?.lineas[0]?.slug).toBe('consumible-demo');
    expect(draft?.lineas[0]?.tarifa_iva_pct).toBe(19);
    expect(draft?.totales.total).toBe(fiscal.total);
  });
});
