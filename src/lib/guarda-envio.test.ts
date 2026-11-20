import { describe, it, expect } from 'vitest';
import { contieneNoEnviar, verificarEnvioPermitido } from '../../supabase/functions/_shared/guarda-envio.ts';

describe('guarda-envio', () => {
  it('detecta NO ENVIAR con tildes, mayúsculas y separadores', () => {
    for (const t of ['no enviar', 'NO ENVÍAR', 'No-enviar aún', 'NO_ENVIAR']) expect(contieneNoEnviar(t)).toBe(true);
    expect(contieneNoEnviar('enviar al cliente')).toBe(false);
  });
  it('permite enviar sin aprobación y sigue bloqueando NO ENVIAR', () => {
    expect(verificarEnvioPermitido({ condiciones: 'ok' }).ok).toBe(true);
    const marcado = verificarEnvioPermitido({
      condiciones: 'NO ENVIAR',
      aprobado_por: 'shoky',
      aprobado_at: '2026-10-31',
    });
    expect(marcado.ok).toBe(false);
    if (!marcado.ok) expect(marcado.code).toBe('NO_ENVIAR_MARCADO');
    expect(verificarEnvioPermitido({ condiciones: 'ok', aprobado_por: 'shoky', aprobado_at: '2026-10-31' }).ok).toBe(true);
  });
});
