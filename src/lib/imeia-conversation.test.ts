import { describe, expect, it } from 'vitest';

import {
  buildImeiaSystemPrompt,
  createEmptyDiscoveryProfile,
  normalizeImeiaTurn,
  parseImeiaTurnProposal,
  type ImeiaTurnProposal,
} from './imeia-conversation';

const baseProposal: ImeiaTurnProposal = {
  schema_version: 'imeia-turn-proposal/1',
  texto: 'Para UCI conviene revisar continuidad de infusión, alarmas y operación del servicio.',
  productos_citados: ['bomba-vp-50', 'producto-inventado'],
  descubrimiento: {
    etapa: 'discovering',
    actualizaciones: {
      clinicalService: 'UCI',
      volume: '10 camas',
    },
    pregunta_siguiente: {
      field: 'timeline',
      text: '¿Para qué plazo necesitan tomar la decisión?',
    },
  },
  accion_handoff: null,
};

describe('imeia conversation policy', () => {
  it('define una identidad senior, consultiva y no clínica', () => {
    const prompt = buildImeiaSystemPrompt('es');

    expect(prompt).toContain('ingeniera biomédica senior');
    expect(prompt).toContain('Responde primero');
    expect(prompt).toContain('una sola pregunta');
    expect(prompt).toContain('No diagnostiques');
    expect(prompt).toContain('JSON');
  });

  it('rechaza respuestas que no sean JSON estructurado exacto', () => {
    expect(() => parseImeiaTurnProposal('Respuesta libre')).toThrow();
    expect(() => parseImeiaTurnProposal('```json\n{}\n```')).toThrow();
  });

  it('acepta solo productos recuperados y conserva una pregunta material', () => {
    const turn = normalizeImeiaTurn(baseProposal, {
      locale: 'es',
      mensaje: 'Somos una UCI de 10 camas y necesitamos bombas.',
      historial: [],
      profile: createEmptyDiscoveryProfile(),
      allowedSlugs: ['bomba-vp-50'],
    });

    expect(turn.productSlugs).toEqual(['bomba-vp-50']);
    expect(turn.discovery.profile_patch).toEqual({
      clinicalService: 'UCI',
      volume: '10 camas',
    });
    expect(turn.discovery.next_question?.field).toBe('timeline');
  });

  it('no repite una pregunta cuyo campo ya está respondido', () => {
    const turn = normalizeImeiaTurn(baseProposal, {
      locale: 'es',
      mensaje: 'Somos una UCI de 10 camas y necesitamos bombas.',
      historial: [],
      profile: {
        ...createEmptyDiscoveryProfile(),
        timeline: 'este trimestre',
      },
      allowedSlugs: ['bomba-vp-50'],
    });

    expect(turn.discovery.next_question).toBeNull();
  });

  it('elimina un handoff prematuro de una consulta informativa', () => {
    const turn = normalizeImeiaTurn(
      {
        ...baseProposal,
        accion_handoff: {
          tipo: 'cotizacion',
          resumen: 'Solicitar cotización.',
        },
      },
      {
        locale: 'es',
        mensaje: '¿Cuál es la diferencia entre una bomba volumétrica y una de jeringa?',
        historial: [],
        profile: createEmptyDiscoveryProfile(),
        allowedSlugs: [],
      }
    );

    expect(turn.accionHandoff).toBeNull();
  });

  it('autoriza cotización por intención explícita y resume palabras del cliente', () => {
    const turn = normalizeImeiaTurn(
      {
        ...baseProposal,
        accion_handoff: {
          tipo: 'cotizacion',
          resumen: 'Texto inventado por el modelo.',
        },
      },
      {
        locale: 'es',
        mensaje: 'Quiero cotizar 10 bombas para nuestra UCI.',
        historial: [],
        profile: createEmptyDiscoveryProfile(),
        allowedSlugs: ['bomba-vp-50'],
      }
    );

    expect(turn.accionHandoff).toEqual({
      tipo: 'cotizacion',
      resumen: 'Quiero cotizar 10 bombas para nuestra UCI.',
    });
  });

  it('bloquea CTA comercial ante una solicitud clínica', () => {
    const turn = normalizeImeiaTurn(
      {
        ...baseProposal,
        accion_handoff: {
          tipo: 'whatsapp',
          resumen: 'Contactar.',
        },
      },
      {
        locale: 'es',
        mensaje: 'Dime qué medicamento y dosis debo administrarle al paciente.',
        historial: [],
        profile: createEmptyDiscoveryProfile(),
        allowedSlugs: [],
      }
    );

    expect(turn.accionHandoff).toBeNull();
  });
});
