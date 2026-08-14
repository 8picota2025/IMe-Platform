import { describe, expect, it } from 'vitest';
import { mapQuoteRow } from './quote-api';

describe('mapQuoteRow', () => {
  it('mapea fila mínima de producción (sin numero/created_by)', () => {
    const quote = mapQuoteRow({
      id: '11111111-1111-4111-8111-111111111111',
      estado: 'nueva',
      nombre: 'Ana',
      email: 'ana@clinic.co',
      telefono: '300',
      moneda: 'COP',
      productos: [
        {
          slug: 'demo',
          nombre: 'Equipo demo',
          cantidad: 1,
          precio_unitario: 0,
          subtotal: 0,
          moneda: 'COP',
        },
      ],
      condiciones: '',
      campaign: 'pwa-comercial',
      landing_path: '/comercial',
    });
    expect(quote.editable).toBe(true);
    expect(quote.origen).toBe('pwa');
    expect(quote.numero).toBeNull();
    expect(quote.incompleta).toBe(true);
  });
});
