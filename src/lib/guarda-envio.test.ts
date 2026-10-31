import { describe, it, expect } from 'vitest';
import { contieneNoEnviar, verificarEnvioPermitido } from '../../supabase/functions/_shared/guarda-envio.ts';

describe('guarda-envio', () => {
  it('detecta NO ENVIAR con tildes, mayúsculas y separadores', () => {
    for (const t of ['no enviar', 'NO ENVÍAR', 'No-enviar aún', 'NO_ENVIAR']) expect(contieneNoEnviar(t)).toBe(true);
    expect(contieneNoEnviar('enviar al cliente')).toBe(false);
  });
  it('bloquea sin aprobación y permite con marca', () => {
    expect(verificarEnvioPermitido({ condiciones: 'ok' }).ok).toBe(false);
    expect(verificarEnvioPermitido({ condiciones: 'NO ENVIAR', aprobado_por: 'shoky', aprobado_at: '2026-10-31' }).ok).toBe(false);
    expect(verificarEnvioPermitido({ condiciones: 'ok', aprobado_por: 'shoky', aprobado_at: '2026-10-31' }).ok).toBe(true);
  });
});
