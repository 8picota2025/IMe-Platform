import { describe, expect, it } from 'vitest';
import {
  etiquetaDisponibilidad,
  nivelDisponibilidad,
  valorCortoDisponibilidad,
} from './disponibilidad-producto';

const stockLimitado = (stock: number) => `Stock disponible: ${stock}`;

describe('nivelDisponibilidad', () => {
  it('stock null/undefined sin precio nunca es «disponible»', () => {
    expect(
      nivelDisponibilidad({
        disponible: true,
        stock: null,
        precio: null,
        fulfillment_mode: 'cotizacion',
      })
    ).toBe('bajo_cotizacion');
    expect(nivelDisponibilidad({ disponible: true, stock: undefined })).toBe('bajo_cotizacion');
  });

  it('stock null con modo individualizado queda bajo cotización aunque tenga precio', () => {
    expect(
      nivelDisponibilidad({ stock: null, precio: 1000, fulfillment_mode: 'individualizado' })
    ).toBe('bajo_cotizacion');
  });

  it('stock null en producto con precio publicado queda en consultar', () => {
    expect(nivelDisponibilidad({ stock: null, precio: 90000, fulfillment_mode: 'dropship' })).toBe(
      'consultar'
    );
  });

  it('stock documentado mayor que cero es stock_documentado', () => {
    expect(nivelDisponibilidad({ disponible: true, stock: 4, precio: null })).toBe(
      'stock_documentado'
    );
  });

  it('stock 0 o producto marcado no disponible es no_disponible', () => {
    expect(nivelDisponibilidad({ stock: 0 })).toBe('no_disponible');
    expect(nivelDisponibilidad({ disponible: false, stock: 10 })).toBe('no_disponible');
  });
});

describe('etiquetas de disponibilidad', () => {
  it('ES: UniX sin stock documentado muestra «Disponibilidad bajo cotización»', () => {
    const entrada = { disponible: true, stock: null, precio: null, fulfillment_mode: 'cotizacion' };
    expect(etiquetaDisponibilidad(entrada, 'es', stockLimitado)).toBe(
      'Disponibilidad bajo cotización'
    );
    expect(valorCortoDisponibilidad(entrada, 'es', stockLimitado)).toBe('Bajo cotización');
  });

  it('EN: UniX sin stock documentado muestra «Availability on request»', () => {
    const entrada = { disponible: true, stock: null, precio: null, fulfillment_mode: 'cotizacion' };
    expect(etiquetaDisponibilidad(entrada, 'en', stockLimitado)).toBe('Availability on request');
    expect(valorCortoDisponibilidad(entrada, 'en', stockLimitado)).toBe('On request');
  });

  it('nunca produce «Disponible» ni «Available» sin stock documentado', () => {
    const casos = [
      { stock: null, precio: null, fulfillment_mode: 'cotizacion' },
      { stock: undefined, precio: 5000, fulfillment_mode: 'dropship' },
      { stock: null, precio: 5000, fulfillment_mode: 'consumible' },
    ];
    for (const entrada of casos) {
      for (const locale of ['es', 'en'] as const) {
        for (const valor of [
          etiquetaDisponibilidad(entrada, locale, stockLimitado),
          valorCortoDisponibilidad(entrada, locale, stockLimitado),
        ]) {
          expect(valor).not.toMatch(/^disponible$/i);
          expect(valor).not.toMatch(/^available$/i);
          expect(valor).not.toMatch(/stock disponible/i);
          expect(valor).not.toMatch(/^stock available/i);
        }
      }
    }
  });

  it('stock documentado conserva el texto de stock limitado', () => {
    const entrada = { stock: 3, precio: 1000, fulfillment_mode: 'dropship' };
    expect(etiquetaDisponibilidad(entrada, 'es', stockLimitado)).toBe('Stock disponible: 3');
    expect(valorCortoDisponibilidad(entrada, 'en', stockLimitado)).toBe('Stock disponible: 3');
  });
});
