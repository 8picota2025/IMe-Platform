import { describe, expect, it } from 'vitest';

import { buildAsesorStaticFallback, esConsultaSitioOLegal } from './asesor-knowledge';

describe('asesor knowledge', () => {
  // 2026-07-15: el intercepto estático se acotó a contacto y páginas legales
  // del sitio. Lo regulatorio (INVIMA, certificaciones), comercial (cotización,
  // garantía, financiación) y de catálogo debe llegar a IMEIA, no al enlatado.
  it('deja pasar a IMEIA las consultas regulatorias, comerciales y de catálogo', () => {
    expect(esConsultaSitioOLegal('Certificaciones')).toBe(false);
    expect(esConsultaSitioOLegal('tienen registro INVIMA y CE?')).toBe(false);
    expect(esConsultaSitioOLegal('Resume invima')).toBe(false);
    expect(esConsultaSitioOLegal('garantia y mantenimiento del monitor')).toBe(false);
    expect(esConsultaSitioOLegal('quiero una cotización de 3 bombas de infusión')).toBe(false);
    expect(esConsultaSitioOLegal('qué financiación ofrecen')).toBe(false);
    expect(esConsultaSitioOLegal('cuáles son sus productos destacados')).toBe(false);
  });

  it('intercepta solo contacto y páginas legales del sitio', () => {
    expect(esConsultaSitioOLegal('¿Cuál es su WhatsApp?')).toBe(true);
    expect(esConsultaSitioOLegal('dame el teléfono')).toBe(true);
    expect(esConsultaSitioOLegal('what is your email')).toBe(true);
    expect(esConsultaSitioOLegal('política de privacidad')).toBe(true);
    expect(esConsultaSitioOLegal('uso de cookies')).toBe(true);
    expect(esConsultaSitioOLegal('términos y condiciones')).toBe(true);
  });

  it('responde contacto con los canales oficiales', () => {
    const respuesta = buildAsesorStaticFallback('es', '¿Cuál es su WhatsApp?');

    expect(respuesta).toContain('313 724 7353');
    expect(respuesta).not.toContain('313 867 4059');
    expect(respuesta).toContain('info@i-me.com.co');
  });

  it('responde privacidad con el marco legal aplicable', () => {
    const respuesta = buildAsesorStaticFallback('es', 'política de privacidad y habeas data');

    expect(respuesta).toContain('Ley 1581');
  });
});
