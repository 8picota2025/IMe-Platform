import { describe, expect, it } from 'vitest';

import { calculateFiscalSummary, type ClienteFiscalProfile } from './fiscal';
import { mercadoDesdeMoneda, mercadoMonedaCompatibles } from './mercado-moneda';

describe('mercadoDesdeMoneda', () => {
  it('maps USD to INTL and COP/other to CO', () => {
    expect(mercadoDesdeMoneda('USD')).toBe('INTL');
    expect(mercadoDesdeMoneda('usd')).toBe('INTL');
    expect(mercadoDesdeMoneda('COP')).toBe('CO');
    expect(mercadoDesdeMoneda('')).toBe('CO');
    expect(mercadoDesdeMoneda(null)).toBe('CO');
  });
});

describe('mercadoMonedaCompatibles', () => {
  it('rejects INTL+COP (IVA escape hatch) and CO+USD', () => {
    expect(mercadoMonedaCompatibles('INTL', 'COP')).toBe(false);
    expect(mercadoMonedaCompatibles('CO', 'USD')).toBe(false);
    expect(mercadoMonedaCompatibles('CO', 'COP')).toBe(true);
    expect(mercadoMonedaCompatibles('INTL', 'USD')).toBe(true);
  });
});

describe('fiscal + mercado mismatch regression', () => {
  const cliente: ClienteFiscalProfile = {
    solicitar_factura_electronica: false,
    tipo_documento: null,
    numero_documento: null,
    tipo_persona: null,
    razon_social: null,
    responsable_iva: false,
    agente_retencion: false,
    agente_reteica: false,
    email_facturacion: null,
    direccion_facturacion: null,
  };

  const line = {
    producto_id: 'p1',
    slug: 'demo',
    nombre: 'Demo',
    cantidad: 1,
    precio_unitario: 100000,
    tarifa_iva_pct: 19,
  };

  it('CO+COP applies IVA; INTL+COP would skip IVA (guard must block checkout)', () => {
    const co = calculateFiscalSummary([line], cliente, {
      moneda: 'COP',
      mercado: 'CO',
      descuento_total: 0,
      envio_total: 0,
      default_iva_pct: 19,
    });
    const intlEscape = calculateFiscalSummary([line], cliente, {
      moneda: 'COP',
      mercado: 'INTL',
      descuento_total: 0,
      envio_total: 0,
      default_iva_pct: 19,
    });
    expect(co.impuesto_total).toBe(19000);
    expect(co.total).toBe(119000);
    expect(intlEscape.impuesto_total).toBe(0);
    expect(intlEscape.total).toBe(100000);
    expect(mercadoMonedaCompatibles('INTL', 'COP')).toBe(false);
  });
});
