import { describe, it, expect } from 'vitest';
import {
  contieneNoEnviar,
  verificarEnvioPermitido,
} from '../../supabase/functions/_shared/guarda-envio.ts';

describe('guarda-envio', () => {
  it('detecta NO ENVIAR con tildes, mayúsculas y separadores', () => {
    for (const t of ['no enviar', 'NO ENVÍAR', 'No-enviar aún', 'NO_ENVIAR'])
      expect(contieneNoEnviar(t)).toBe(true);
    expect(contieneNoEnviar('enviar al cliente')).toBe(false);
  });
  it('bloquea sin aprobación y permite con marca', () => {
    expect(verificarEnvioPermitido({ condiciones: 'ok' }).ok).toBe(false);
    expect(
      verificarEnvioPermitido({
        condiciones: 'NO ENVIAR',
        aprobado_por: 'shoky',
        aprobado_at: '2026-10-31',
      }).ok
    ).toBe(false);
    expect(
      verificarEnvioPermitido({
        condiciones: 'ok',
        aprobado_por: 'shoky',
        aprobado_at: '2026-10-31',
      }).ok
    ).toBe(true);
  });

  // convertir-cotizacion-pedido must reuse this gate: it mints a payable
  // checkout from locked quote prices without transitioning to 'enviada',
  // so the SQL send-approval trigger never fires.
  it('bloquea borrador underpriced tipico de convertir sin OK', () => {
    const borrador = {
      estado: 'nueva',
      condiciones: 'Pago de contado',
      productos: [{ slug: 'equipo-x', precio_unitario: 50000, cantidad: 1 }],
      precio_total_ofertado: 50000,
    };
    const sinOk = verificarEnvioPermitido(borrador);
    expect(sinOk.ok).toBe(false);
    if (!sinOk.ok) expect(sinOk.code).toBe('SIN_APROBACION');

    const conNoEnviar = verificarEnvioPermitido({
      ...borrador,
      notas_internas: 'NO ENVIAR hasta margen',
      aprobado_por: 'shoky',
      aprobado_at: '2026-10-31T12:00:00Z',
    });
    expect(conNoEnviar.ok).toBe(false);
    if (!conNoEnviar.ok) expect(conNoEnviar.code).toBe('NO_ENVIAR_MARCADO');
  });
});
