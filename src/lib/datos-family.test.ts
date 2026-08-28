import { describe, expect, it } from 'vitest';
import { correctedFamilySlug, PRODUCT_FAMILY_CORRECTIONS } from './datos';

describe('correcciones editoriales de familia', () => {
  it('aplica las 45 correcciones verificadas', () => {
    expect(Object.keys(PRODUCT_FAMILY_CORRECTIONS)).toHaveLength(45);
    expect(correctedFamilySlug('monitor-de-paciente-ref-sk-em005-saikang', 'mobiliario')).toBe(
      'monitores'
    );
    expect(correctedFamilySlug('skb-1a-skb2a10', 'radiologia')).toBe(
      'emergencias-traslado-inmovilizacion'
    );
  });

  it('conserva la familia cuando no existe evidencia para mover el producto', () => {
    expect(correctedFamilySlug('carro-de-anestesia-ref-sk-at75077a2-saikang', 'mobiliario')).toBe(
      'mobiliario'
    );
  });
});
