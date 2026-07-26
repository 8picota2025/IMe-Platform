// Regression: ISSUE-002 — specs Parámetro column always "Característica"
// Found by /qa on 2026-07-26
// Report: ~/.gstack/qa-reports/qa-report-i-me-com-co-2026-07-26.md
import { describe, expect, it } from 'vitest';
import { normalizarEspecificaciones } from './especificaciones';

describe('normalizarEspecificaciones', () => {
  it('splits legacy Característica rows into param/detail', () => {
    const result = normalizarEspecificaciones([
      { clave: 'Característica', valor: 'Tecnología: a-Si', grupo: 'Catálogo IME' },
      { clave: 'Característica', valor: 'Pixel: 140 μm', grupo: 'Catálogo IME' },
      { clave: 'Característica', valor: '1 batería recargable', grupo: 'Catálogo IME' },
    ]);

    expect(result).toEqual([
      { clave: 'Tecnología', valor: 'a-Si', grupo: 'Catálogo IME' },
      { clave: 'Pixel', valor: '140 μm', grupo: 'Catálogo IME' },
      { clave: 'Característica', valor: '1 batería recargable', grupo: 'Catálogo IME' },
    ]);
  });

  it('keeps already structured claves untouched', () => {
    const result = normalizarEspecificaciones([
      { clave: 'Pantalla', valor: '15.6" Full HD', grupo: 'Display' },
    ]);
    expect(result).toEqual([{ clave: 'Pantalla', valor: '15.6" Full HD', grupo: 'Display' }]);
  });

  it('filters invalid rows', () => {
    expect(normalizarEspecificaciones([null, { clave: 1, valor: 'x' }, 'bad'])).toEqual([]);
  });
});
