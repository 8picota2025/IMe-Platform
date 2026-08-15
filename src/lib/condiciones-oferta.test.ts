import { describe, expect, it } from 'vitest';
import {
  defaultCondicionesOferta,
  isCondicionesSectionHeading,
  resolveCondicionesOferta,
} from './condiciones-oferta';

describe('condiciones-oferta', () => {
  it('default incluye secciones del boceto', () => {
    const text = defaultCondicionesOferta('es');
    expect(text).toContain('Entrega:');
    expect(text).toContain('Costo de envío:');
    expect(text).toContain('Garantía:');
    expect(text).toContain('Instalación:');
    expect(text).toContain('2,000,000');
    expect(text).toContain('No incluye instalación');
  });

  it('resolve usa default si vacío', () => {
    expect(resolveCondicionesOferta('')).toBe(defaultCondicionesOferta('es'));
    expect(resolveCondicionesOferta('  Pago contado  ')).toBe('Pago contado');
  });

  it('detecta headings de sección', () => {
    expect(isCondicionesSectionHeading('Entrega:')).toBe(true);
    expect(isCondicionesSectionHeading('Garantía:')).toBe(true);
    expect(isCondicionesSectionHeading('CPAP 8 días')).toBe(false);
  });
});
