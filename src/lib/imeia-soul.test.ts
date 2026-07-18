import { describe, expect, it } from 'vitest';

import {
  buildLeadResumenComercial,
  extractLeadHintsFromText,
  isLeadCaptureReady,
  mergeImeiaLead,
  parseImeiaStructuredReply,
  EMPTY_IMEIA_LEAD,
} from './imeia-soul';

describe('imeia-soul', () => {
  it('fusiona slots de lead sin pisar datos previos con vacíos', () => {
    const merged = mergeImeiaLead(
      { ...EMPTY_IMEIA_LEAD, nombre: 'Ana', empresa: 'IPS Norte' },
      { email: 'ana@ips.example', empresa: null, necesidad: 'Monitor UCI' }
    );
    expect(merged.nombre).toBe('Ana');
    expect(merged.empresa).toBe('IPS Norte');
    expect(merged.email).toBe('ana@ips.example');
    expect(merged.necesidad).toBe('Monitor UCI');
  });

  it('detecta email y teléfono en texto libre', () => {
    const hints = extractLeadHintsFromText(
      'Soy Carlos, mi correo es compras@clinica.example y el celular 3001234567'
    );
    expect(hints.email).toBe('compras@clinica.example');
    expect(hints.telefono).toContain('300');
  });

  it('marca listo para captura con identidad + contacto + necesidad', () => {
    expect(
      isLeadCaptureReady({
        ...EMPTY_IMEIA_LEAD,
        nombre: 'Ana',
        email: 'ana@example.com',
        necesidad: 'Cotizar bomba de infusión para UCI',
      })
    ).toBe(true);
    expect(isLeadCaptureReady({ ...EMPTY_IMEIA_LEAD, email: 'a@b.com' })).toBe(false);
  });

  it('parsea JSON de IMEIA con fase y lead', () => {
    const raw = JSON.stringify({
      texto: 'Para UCI yo partiría por una volumétrica y una de jeringa.',
      productos_citados: ['bomba-a'],
      accion_handoff: null,
      lead: {
        servicio_clinico: 'UCI',
        necesidad: 'Bombas de infusión',
        listo_para_captura: false,
      },
      fase: 'recomendacion',
    });
    const parsed = parseImeiaStructuredReply(raw);
    expect(parsed.fase).toBe('recomendacion');
    expect(parsed.productos_citados).toEqual(['bomba-a']);
    expect(parsed.lead.servicio_clinico).toBe('UCI');
  });

  it('arma resumen comercial útil para ventas', () => {
    const resumen = buildLeadResumenComercial(
      {
        ...EMPTY_IMEIA_LEAD,
        nombre: 'Ana',
        email: 'ana@ips.example',
        empresa: 'IPS Norte',
        ciudad: 'Medellín',
        necesidad: 'Monitor multiparamétrico urgencias',
        servicio_clinico: 'Urgencias',
      },
      [{ nombre: 'Monitor P1' }]
    );
    expect(resumen).toContain('IPS Norte');
    expect(resumen).toContain('Monitor P1');
    expect(resumen).toContain('ana@ips.example');
  });
});
