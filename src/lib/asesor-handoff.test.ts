import { describe, expect, it } from 'vitest';

import {
  buildConversationFilename,
  buildConversationTranscript,
  buildDetailedHandoffSummary,
} from './asesor-handoff';

const historial = [
  {
    rol: 'usuario' as const,
    contenido: 'Busco bombas de infusión para una UCI de 10 camas.',
    timestamp: new Date('2026-07-24T01:00:00.000Z'),
  },
  {
    rol: 'asesor' as const,
    contenido: 'Podemos revisar opciones volumétricas y de jeringa.',
    timestamp: new Date('2026-07-24T01:01:00.000Z'),
  },
  {
    rol: 'usuario' as const,
    contenido: 'Necesitamos instalación, capacitación y documentación INVIMA.',
    timestamp: new Date('2026-07-24T01:02:00.000Z'),
  },
  {
    rol: 'asesor' as const,
    contenido: 'La cotización debe validar cantidades y documentación por referencia.',
    timestamp: new Date('2026-07-24T01:03:00.000Z'),
  },
];

describe('IMEIA handoff', () => {
  it('builds a detailed summary from the whole customer context', () => {
    const summary = buildDetailedHandoffSummary({
      handoff: {
        tipo: 'cotizacion',
        resumen: 'Necesitamos instalación, capacitación y documentación INVIMA.',
      },
      historial,
      productos: [
        {
          slug: 'bomba-vp-50',
          nombre: 'Bomba de Infusión VP-50',
          imagen: null,
          urlLanding: '/es/productos/bomba-vp-50/',
          score: 0.9,
        },
      ],
      locale: 'es',
    });

    expect(summary).toContain('Busco bombas de infusión para una UCI de 10 camas.');
    expect(summary).toContain('Necesitamos instalación, capacitación y documentación INVIMA.');
    expect(summary).toContain('La cotización debe validar cantidades');
    expect(summary).toContain('Bomba de Infusión VP-50');
  });

  it('exports every customer and IMEIA message to plain text', () => {
    const transcript = buildConversationTranscript(
      historial,
      'es',
      new Date('2026-07-24T02:00:00.000Z')
    );

    expect(transcript).toContain('Conversación completa con IMEIA');
    expect(transcript.match(/Cliente:/g)).toHaveLength(2);
    expect(transcript.match(/IMEIA:/g)).toHaveLength(2);
    for (const message of historial) expect(transcript).toContain(message.contenido);
  });

  it('uses a safe localized TXT filename', () => {
    expect(buildConversationFilename('en', new Date('2026-07-24T02:00:00.000Z'))).toBe(
      'imeia-conversation-2026-07-24T02-00-00-000Z.txt'
    );
  });
});
