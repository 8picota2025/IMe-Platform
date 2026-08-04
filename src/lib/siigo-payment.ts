/**
 * Monto de `payments[].value` para Siigo/DIAN.
 *
 * Siigo calcula el total de la factura desde líneas (base + IVA). Las retenciones
 * colombianas las practica el comprador al pagar y no viajan en el payload de
 * factura de venta — por eso NO debe usarse `draft.totales.total` (neto de
 * retenciones / posible envío) como valor de pago.
 */
import type { DianInvoiceDraft } from './fiscal';

export function computeSiigoInvoicePaymentValue(draft: Pick<DianInvoiceDraft, 'lineas'>): number {
  return draft.lineas.reduce((acc, linea) => acc + linea.base_neta + linea.iva, 0);
}
