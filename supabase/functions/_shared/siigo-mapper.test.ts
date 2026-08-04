import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildDianInvoiceDraft,
  calculateFiscalSummary,
  type ClienteFiscalProfile,
} from '../../../src/lib/fiscal.ts';
import { mapDianDraftToSiigoInvoice } from './siigo-mapper.ts';
import type { SiigoConfig } from './siigo-client.ts';

const CONFIG: SiigoConfig = {
  username: 'info@i-me.com.co',
  accessKey: 'fake',
  partnerId: 'IMECOMCO',
  documentTypeId: 31158,
  sellerId: 304,
  paymentTypeId: 12939,
  accountGroupId: 603,
  taxMap: { '19': 6331, '5': 6332, '0': 13962 },
};

const CLIENTE_FISCAL: ClienteFiscalProfile = {
  solicitar_factura_electronica: true,
  tipo_documento: 'NIT',
  numero_documento: '900123456',
  tipo_persona: 'juridica',
  razon_social: 'Hospital Demo SAS',
  responsable_iva: true,
  email_facturacion: 'facturas@hospital-demo.test',
  direccion_facturacion: {
    direccion: 'Calle 1 # 2-3',
    ciudad: 'Medellin',
    departamento: 'Antioquia',
    pais: 'CO',
  },
};

function buildDraft() {
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
    CLIENTE_FISCAL,
    { moneda: 'COP', mercado: 'CO' }
  );

  const draft = buildDianInvoiceDraft({
    referencia: 'pedido-123',
    fiscal,
    clienteFiscal: CLIENTE_FISCAL,
    moneda: 'COP',
  });
  if (!draft) throw new Error('draft nulo en fixture de test');
  return draft;
}

Deno.test('mapDianDraftToSiigoInvoice: arma el payload exacto de Siigo', () => {
  const draft = buildDraft();

  const payload = mapDianDraftToSiigoInvoice({
    draft,
    config: CONFIG,
    clienteIdentification: '900123456',
    codigosProducto: ['consumible-demo'],
    fecha: '2026-07-07',
  });

  assertEquals(payload.document, { id: 31158 });
  assertEquals(payload.date, '2026-07-07');
  assertEquals(payload.customer, { identification: '900123456', branch_office: 0 });
  assertEquals(payload.seller, 304);
  assertEquals(payload.items.length, 1);
  assertEquals(payload.items[0]?.code, 'consumible-demo');
  assertEquals(payload.items[0]?.quantity, 2);
  // base_neta (200000, sin descuento) / cantidad(2) = 100000 por unidad
  assertEquals(payload.items[0]?.price, 100000);
  assertEquals(payload.items[0]?.taxes, [{ id: 6331 }]);
  // Sin retenciones: payments = base+IVA = draft.totales.total
  assertEquals(payload.payments, [{ id: 12939, value: 238000 }]);
  assertEquals(payload.payments[0]?.value, draft.totales.total);
  assertEquals(payload.stamp, { send: true });
  assertEquals(payload.mail, { send: true });
});

Deno.test('mapDianDraftToSiigoInvoice: payments.value usa base+IVA aunque haya retenciones', () => {
  const clienteRetencion: ClienteFiscalProfile = {
    ...CLIENTE_FISCAL,
    agente_retencion: true,
    agente_reteica: true,
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
        retencion_fuente_pct: 2.5,
        retencion_iva_pct: 15,
        retencion_ica_pct: 0.966,
        dian_codigo: '42142500',
      },
    ],
    clienteRetencion,
    { moneda: 'COP', mercado: 'CO' }
  );
  const draft = buildDianInvoiceDraft({
    referencia: 'pedido-retencion',
    fiscal,
    clienteFiscal: clienteRetencion,
    moneda: 'COP',
  });
  if (!draft) throw new Error('draft nulo en fixture de test');

  // Cobro al cliente neto de retenciones ≠ total Siigo de líneas.
  assertEquals(draft.totales.total, 225368);
  assertEquals(draft.totales.retencion_total, 12632);

  const payload = mapDianDraftToSiigoInvoice({
    draft,
    config: CONFIG,
    clienteIdentification: '900123456',
    codigosProducto: ['consumible-demo'],
    fecha: '2026-07-07',
  });

  assertEquals(payload.payments, [{ id: 12939, value: 238000 }]);
  assertEquals(payload.payments[0]?.value === draft.totales.total, false);
});

Deno.test('mapDianDraftToSiigoInvoice: error si codigosProducto no coincide en longitud', () => {
  const draft = buildDraft();
  assertThrows(() =>
    mapDianDraftToSiigoInvoice({
      draft,
      config: CONFIG,
      clienteIdentification: '900123456',
      codigosProducto: [],
      fecha: '2026-07-07',
    })
  );
});

Deno.test('mapDianDraftToSiigoInvoice: error si tarifa IVA sin mapeo en SIIGO_TAX_MAP', () => {
  const draft = buildDraft();
  const configSinMapeo: SiigoConfig = { ...CONFIG, taxMap: {} };
  assertThrows(() =>
    mapDianDraftToSiigoInvoice({
      draft,
      config: configSinMapeo,
      clienteIdentification: '900123456',
      codigosProducto: ['consumible-demo'],
      fecha: '2026-07-07',
    })
  );
});
