import { describe, expect, it } from 'vitest';

import { buildAsesorStaticFallback, esConsultaSitioOLegal } from './asesor-knowledge';

describe('asesor knowledge', () => {
  it('detecta certificaciones como consulta de sitio o regulatoria', () => {
    expect(esConsultaSitioOLegal('Certificaciones')).toBe(true);
    expect(esConsultaSitioOLegal('tienen registro INVIMA y CE?')).toBe(true);
  });

  it('responde con contexto util sobre certificaciones aunque no haya producto', () => {
    const respuesta = buildAsesorStaticFallback('es', 'Certificaciones');

    expect(respuesta).toContain('registros INVIMA');
    expect(respuesta).toContain('CE/FDA');
    expect(respuesta).toContain('producto específico');
  });

  it('responde con limites claros para financiacion y garantia', () => {
    const financiacion = buildAsesorStaticFallback('es', 'financiacion y tasas');
    const garantia = buildAsesorStaticFallback('es', 'garantia y mantenimiento');
    const sitio = buildAsesorStaticFallback('es', 'inicio y artículos del sitio');

    expect(financiacion).toContain('propuesta formal');
    expect(garantia).toContain('cotización formal');
    expect(sitio).toContain('página de inicio');
    expect(sitio).toContain('artículos');
  });

  it('prioriza INVIMA como orientacion regulatoria de dispositivos medicos', () => {
    const respuesta = buildAsesorStaticFallback(
      'es',
      'Que dice INVIMA sobre dispositivos medicos?'
    );

    expect(respuesta).toContain('autoridad sanitaria');
    expect(respuesta).toContain('dispositivos médicos');
    expect(respuesta).toContain('documentación vigente');
    expect(respuesta).not.toContain('Ley 1581');
  });
});
