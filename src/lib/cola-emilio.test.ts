import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { correoEntregado, filaColaEmilio } from './cola-emilio';

describe('cola de Emilio', () => {
  it('exige quién pide el correo y no lo da por entregado', () => {
    const fila = filaColaEmilio({
      solicitante: 'shoky',
      origen: 'enviar-cotizacion',
      destinatarios: ['cliente@hospital.test'],
      asunto: 'Presupuesto',
      html: '<p>hola</p>',
    });
    expect(fila.estado).toBe('pendiente');
    expect(fila.solicitante).toBe('shoky');
    expect(correoEntregado({ ok: true, encolado: true })).toBe(false);
    expect(correoEntregado({ ok: true })).toBe(true);
    expect(() =>
      filaColaEmilio({
        solicitante: ' ',
        origen: 'x',
        destinatarios: ['a@b.c'],
        asunto: 'a',
        html: 'b',
      })
    ).toThrow(/solicitante/);
  });

  it('el repo no llama a Resend desde las funciones', () => {
    const archivos = [
      'supabase/functions/_shared/email.ts',
      'supabase/functions/notificar-proveedor/index.ts',
      'supabase/functions/reporte-semanal/index.ts',
      'supabase/functions/crm-digest/index.ts',
    ];
    for (const ruta of archivos) {
      const texto = readFileSync(ruta, 'utf8');
      expect(texto, ruta).not.toContain('api.resend.com');
    }
  });
});
