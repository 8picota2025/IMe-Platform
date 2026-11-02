import { describe, expect, it } from 'vitest';
import { LANDINGS_INDICE } from '../data/landings-indice';
import { calcularIndiceLandings } from './landings-indice-fuentes';

describe('índice de landings', () => {
  it('coincide con las fuentes (si falla: node scripts/landings-indice.mjs)', () => {
    expect(LANDINGS_INDICE).toEqual(calcularIndiceLandings());
  });

  it('claves únicas por tipo y 45 landings', () => {
    const claves = LANDINGS_INDICE.map(l => `${l.tipo}:${l.clave}`);
    expect(new Set(claves).size).toBe(claves.length);
    expect(LANDINGS_INDICE).toHaveLength(45);
  });
});
