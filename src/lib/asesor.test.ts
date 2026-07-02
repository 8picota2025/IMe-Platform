import { describe, expect, it } from 'vitest';

import { buildBiomedicalFallback } from './asesor';

const contextoVacio: Parameters<typeof buildBiomedicalFallback>[0] = [];

describe('asesor biomedical fallback', () => {
  it('responde a un medico de urgencias sobre monitores sin derivar a WhatsApp', () => {
    const respuesta = buildBiomedicalFallback(
      contextoVacio,
      'es',
      'Soy médico de urgencias. Necesito un monitor para triage y observación, ¿qué debería considerar?'
    );

    expect(respuesta).toContain('robustez operativa');
    expect(respuesta).toContain('ECG');
    expect(respuesta).toContain('SpO2');
    expect(respuesta).not.toContain('WhatsApp');
  });

  it('responde orientacion INVIMA para importar monitor multiparametrico', () => {
    const respuesta = buildBiomedicalFallback(
      contextoVacio,
      'es',
      '¿Qué exige INVIMA para importar un monitor multiparamétrico a Colombia?'
    );

    expect(respuesta).toContain('clasificación de riesgo INVIMA');
    expect(respuesta).toContain('registro sanitario');
    expect(respuesta).toContain('documentación del fabricante');
  });

  it('diferencia bomba volumetrica y bomba de jeringa para UCI', () => {
    const respuesta = buildBiomedicalFallback(
      contextoVacio,
      'es',
      'Para una UCI de 10 camas, ¿qué diferencia práctica hay entre bomba de infusión volumétrica y bomba de jeringa?'
    );

    expect(respuesta).toContain('bomba volumétrica');
    expect(respuesta).toContain('bomba de jeringa');
    expect(respuesta).toContain('microdosis');
  });

  it('cualifica cotizacion de ecografo portatil con DICOM', () => {
    const respuesta = buildBiomedicalFallback(
      contextoVacio,
      'es',
      'Tenemos una IPS nivel 2 y queremos cotizar un ecógrafo portátil con DICOM. ¿Qué información necesitas?'
    );

    expect(respuesta).toContain('ecógrafo portátil con DICOM');
    expect(respuesta).toContain('servicio clínico');
    expect(respuesta).toContain('transductores');
  });
});
