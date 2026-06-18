import { describe, expect, it } from 'vitest'

import {
  buildDianInvoiceDraft,
  calculateFiscalSummary,
  validateClienteFiscal,
  type ClienteFiscalProfile,
} from './fiscal'

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
  }

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
    )

    expect(fiscal.subtotal).toBe(200000)
    expect(fiscal.impuesto_total).toBe(38000)
    expect(fiscal.retencion_fuente_total).toBe(5000)
    expect(fiscal.retencion_iva_total).toBe(5700)
    expect(fiscal.retencion_ica_total).toBe(1932)
    expect(fiscal.total).toBe(225368)
  })

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
    )

    expect(fiscal.impuesto_total).toBe(0)
    expect(fiscal.retencion_total).toBe(0)
    expect(fiscal.total).toBe(250)
  })

  it('valida datos minimos cuando se solicita factura electronica', () => {
    const errors = validateClienteFiscal(
      {
        solicitar_factura_electronica: true,
      },
      { moneda: 'COP', mercado: 'CO' }
    )

    expect(errors).toContain('tipo_documento requerido para facturacion electronica')
    expect(errors).toContain('direccion_facturacion.ciudad requerida para facturacion electronica')
  })

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
    )

    const draft = buildDianInvoiceDraft({
      referencia: 'pedido-1',
      fiscal,
      clienteFiscal,
      moneda: 'COP',
    })

    expect(draft?.cliente.numero_documento).toBe('900123456')
    expect(draft?.lineas[0]?.codigo).toBe('42142500')
    expect(draft?.totales.total).toBe(fiscal.total)
  })
})
