import { describe, expect, it } from 'vitest';

import { buildDianInvoiceDraft, calculateFiscalSummary, type ClienteFiscalProfile } from './fiscal';
import { computeSiigoInvoicePaymentValue } from './siigo-payment';

describe('computeSiigoInvoicePaymentValue', () => {
  const clienteConRetencion: ClienteFiscalProfile = {
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

  it('usa base+IVA y no el total neto de retenciones', () => {
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
      clienteConRetencion,
      { moneda: 'COP', mercado: 'CO' }
    );

    const draft = buildDianInvoiceDraft({
      referencia: 'pedido-retencion',
      fiscal,
      clienteFiscal: clienteConRetencion,
      moneda: 'COP',
    });
    if (!draft) throw new Error('draft nulo');

    // Pedido/cobro al cliente: 225368 (tras retenciones).
    expect(draft.totales.total).toBe(225368);
    expect(draft.totales.retencion_total).toBe(12632);

    // Siigo debe recibir el total de líneas (base + IVA), no el neto.
    expect(computeSiigoInvoicePaymentValue(draft)).toBe(238000);
    expect(computeSiigoInvoicePaymentValue(draft)).not.toBe(draft.totales.total);
  });

  it('coincide con totales.total cuando no hay retenciones ni envio', () => {
    const clienteSinRetencion: ClienteFiscalProfile = {
      ...clienteConRetencion,
      agente_retencion: false,
      agente_reteica: false,
    };
    const fiscal = calculateFiscalSummary(
      [
        {
          producto_id: 'prod-1',
          slug: 'consumible-demo',
          nombre: 'Consumible Demo',
          cantidad: 2,
          precio_unitario: 100000,
          tarifa_iva_pct: 19,
          dian_codigo: '42142500',
        },
      ],
      clienteSinRetencion,
      { moneda: 'COP', mercado: 'CO' }
    );
    const draft = buildDianInvoiceDraft({
      referencia: 'pedido-sin-retencion',
      fiscal,
      clienteFiscal: clienteSinRetencion,
      moneda: 'COP',
    });
    if (!draft) throw new Error('draft nulo');

    expect(computeSiigoInvoicePaymentValue(draft)).toBe(draft.totales.total);
    expect(computeSiigoInvoicePaymentValue(draft)).toBe(238000);
  });
});
