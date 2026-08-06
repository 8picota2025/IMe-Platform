import { describe, expect, it } from 'vitest';

import { formatearNitConDv, verificarNitCampo } from './nit-dian';

describe('nit-dian', () => {
  it('verifica NIT JHBM con espacios y calcula DV', () => {
    const r = verificarNitCampo('9 0 1 4 4 1 9 0 8 2', 'NIT');
    expect(r.ok).toBe(true);
    expect(r.numero).toBe('9014419082');
    expect(r.nit_base).toBe('901441908');
    expect(r.digito_verificacion).toBe(2);
    expect(r.numero_formateado).toBe('901441908-2');
  });

  it('acepta NIT sin DV y lo completa', () => {
    const r = verificarNitCampo('901441908', 'NIT');
    expect(r.ok).toBe(true);
    expect(r.numero).toBe('9014419082');
    expect(r.avisos.some(a => a.includes('calculado'))).toBe(true);
  });

  it('rechaza DV incorrecto', () => {
    const r = verificarNitCampo('901441908-9', 'NIT');
    expect(r.ok).toBe(false);
    expect(r.errores[0]).toMatch(/Digito de verificacion incorrecto/);
  });

  it('formatea NIT con guion', () => {
    expect(formatearNitConDv('9014419082')).toBe('901441908-2');
  });
});
