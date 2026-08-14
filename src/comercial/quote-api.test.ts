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

  it('recupera numero, PDF y error desde metadata en esquema legado', () => {
    const quote = mapQuoteRow({
      id: '22222222-2222-4222-8222-222222222222',
      estado: 'respondida',
      nombre: 'Luis',
      email: 'luis@clinic.co',
      telefono: '301',
      moneda: 'COP',
      productos: [],
      metadata: {
        numero_presupuesto: 'IME-Q-2026-000042',
        pdf_storage_path: '22222222-2222-4222-8222-222222222222/1.pdf',
        pdf_revision: 1,
        quote_send_error: 'MAILER_API_KEY no configurada',
      },
    });
    expect(quote.numero).toBe('IME-Q-2026-000042');
    expect(quote.pdf_storage_path).toContain('/1.pdf');
    expect(quote.pdf_revision).toBe(1);
    expect(quote.send_error).toContain('MAILER_API_KEY');
  });
});
