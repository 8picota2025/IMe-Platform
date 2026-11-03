import { describe, expect, it } from 'vitest';

import { calculateFiscalSummary, type ClienteFiscalProfile } from './fiscal';
import { stripUntrustedAgenteFlags } from './public-checkout-fiscal';

describe('stripUntrustedAgenteFlags', () => {
  const clienteConFlags: ClienteFiscalProfile = {
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

  it('clears self-asserted agente flags before fiscal total calculation', () => {
    const trusted = stripUntrustedAgenteFlags(clienteConFlags);
    expect(trusted.agente_retencion).toBe(false);
    expect(trusted.agente_reteica).toBe(false);
    expect(trusted.responsable_iva).toBe(true);

    const item = {
      producto_id: 'prod-1',
      slug: 'consumible-demo',
      nombre: 'Consumible Demo',
      cantidad: 2,
      precio_unitario: 100000,
      tarifa_iva_pct: 19,
      retencion_fuente_pct: 2.5,
      retencion_iva_pct: 15,
      retencion_ica_pct: 0.966,
    };

    const underpriced = calculateFiscalSummary([item], clienteConFlags, {
      moneda: 'COP',
      mercado: 'CO',
    });
    const charged = calculateFiscalSummary([item], trusted, {
      moneda: 'COP',
      mercado: 'CO',
    });

    expect(underpriced.total).toBe(225368);
    expect(charged.total).toBe(238000);
    expect(charged.retencion_total).toBe(0);
  });
});
