/**
 * Traduce el `DianInvoiceDraft` (única fuente de verdad de montos, calculada
 * en `src/lib/fiscal.ts`) a la forma exacta que exige `POST /v1/invoices` de
 * Siigo. Solo traduce forma: no recalcula IVA ni retenciones.
 *
 * Nota retenciones: el catálogo real de Siigo para facturas de venta no tiene
 * campo de retención por línea (la retención en Colombia la practica el
 * comprador al pagar, no el vendedor al facturar) — por eso `dian_draft`
 * calcula retenciones para el desglose interno (`pedidos`) pero no viajan al
 * payload de Siigo.
 *
 * Nota descuento: para que el total que calcula Siigo (price * quantity)
 * cuadre con `base_neta` (ya neta de descuento en fiscal.ts) sin duplicar el
 * descuento, se envía `price` como el precio unitario ya neto
 * (`base_neta / cantidad`) en vez de precio de lista + campo `discount`.
 */

import type { DianInvoiceDraft } from '../../../src/lib/fiscal.ts';
import type { SiigoConfig, SiigoInvoicePayload } from './siigo-client.ts';

export function mapDianDraftToSiigoInvoice(args: {
  draft: DianInvoiceDraft;
  config: SiigoConfig;
  clienteIdentification: string;
  codigosProducto: readonly string[];
  fecha: string;
}): SiigoInvoicePayload {
  const { draft, config, clienteIdentification, codigosProducto, fecha } = args;

  if (codigosProducto.length !== draft.lineas.length) {
    throw new Error(
      `codigosProducto (${codigosProducto.length}) no coincide con lineas del draft (${draft.lineas.length})`
    );
  }

  const items = draft.lineas.map((linea, index) => {
    const taxId = config.taxMap[String(linea.tarifa_iva_pct)];
    if (taxId === undefined) {
      throw new Error(
        `Sin mapeo SIIGO_TAX_MAP para tarifa IVA ${linea.tarifa_iva_pct}% (linea ${index})`
      );
    }
    const precioNetoUnitario =
      linea.cantidad > 0 ? Math.round(linea.base_neta / linea.cantidad) : linea.base_neta;

    return {
      code: codigosProducto[index]!,
      description: linea.descripcion,
      quantity: linea.cantidad,
      price: precioNetoUnitario,
      taxes: [{ id: taxId }],
    };
  });

  // Siigo recalcula IVA con 2 decimales (price * qty * tarifa). El payment
  // debe cuadrar con ESE total, no con el entero COP de fiscal.ts.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalSiigo = round2(
    items.reduce((acc, item, index) => {
      const base = round2(item.price * item.quantity);
      const ivaPct = draft.lineas[index]?.tarifa_iva_pct ?? 0;
      const iva = round2(base * (ivaPct / 100));
      return acc + base + iva;
    }, 0)
  );

  return {
    document: { id: config.documentTypeId },
    date: fecha,
    customer: { identification: clienteIdentification, branch_office: 0 },
    seller: config.sellerId,
    items,
    payments: [{ id: config.paymentTypeId, value: totalSiigo }],
    observations: `Pedido I-ME ${draft.referencia}`,
    stamp: { send: true },
    mail: { send: true },
  };
}
