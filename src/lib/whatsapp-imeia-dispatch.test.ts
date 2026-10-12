import { describe, expect, it } from 'vitest';

import {
  elegirMensajeEspera,
  esAcuseTrivial,
  MENSAJES_ESPERA_EN,
  MENSAJES_ESPERA_ES,
} from './whatsapp-espera';
import {
  planWhatsAppDispatch,
  reclamarLoteWhatsApp,
  WHATSAPP_CLAIM_TTL_MS,
  WHATSAPP_HOLDING_AFTER_MS,
  WHATSAPP_HOLDING_MIN_GAP_MS,
  WHATSAPP_QUIET_MS,
  type FilaReclamo,
  type InboundEventRow,
  type OutboundEventRow,
} from './whatsapp-imeia-dispatch';

const T0 = Date.parse('2026-09-25T15:00:00.000Z');
const FROM = '573001112233';
const FRASE_VIEJA = 'Un momento, reviso su consulta…';

function pendiente(
  partial: Partial<InboundEventRow> & Pick<InboundEventRow, 'wamid' | 'createdAt'>
): InboundEventRow {
  return {
    fromWa: FROM,
    body: '¿Tienen monitores de paciente?',
    phoneNumberId: 'PHONE',
    status: 'pending_agent',
    agentClaimedAt: null,
    ...partial,
  };
}

function salida(
  partial: Partial<OutboundEventRow> & Pick<OutboundEventRow, 'createdAt'>
): OutboundEventRow {
  return {
    toWa: FROM,
    body: MENSAJES_ESPERA_ES[0],
    kind: 'holding',
    sendStatus: 'sent',
    turnKey: 'wamid.hold',
    ...partial,
  };
}

describe('acuse trivial', () => {
  it('reconoce ok, gracias, listo y solo emoji', () => {
    for (const texto of [
      'ok',
      'OK!',
      'okay',
      'vale',
      'listo.',
      'Gracias',
      'muchas gracias',
      'mil gracias',
      'thanks',
      'thank you',
      '👍',
      '🙏  ',
      'ok 👍',
      'ok, gracias',
    ]) {
      expect(esAcuseTrivial(texto), texto).toBe(true);
    }
  });

  it('no trata una consulta como acuse', () => {
    expect(esAcuseTrivial('¿Tienen monitores de paciente?')).toBe(false);
    expect(esAcuseTrivial('ok, ¿tienen monitores?')).toBe(false);
    expect(esAcuseTrivial('gracias por la info del monitor')).toBe(false);
  });
});

describe('rotación del mensaje de espera', () => {
  it('rota frases en tú y no repite la última enviada a ese cliente', () => {
    expect(MENSAJES_ESPERA_ES).toContain(
      'Dame un momento, estoy revisando la información para responderte bien.'
    );
    expect(MENSAJES_ESPERA_ES).not.toContain(FRASE_VIEJA);
    const primero = elegirMensajeEspera('es', null, '573001112233:wamid.1');
    const siguiente = elegirMensajeEspera('es', primero, '573001112233:wamid.1');
    expect(siguiente).not.toBe(primero);
    expect(MENSAJES_ESPERA_ES).toContain(siguiente);
    expect(elegirMensajeEspera('en', null, 'seed')).toSatisfy((texto: string) =>
      (MENSAJES_ESPERA_EN as readonly string[]).includes(texto)
    );
  });
});

describe('reclamo de lote', () => {
  const base: FilaReclamo[] = [
    {
      wamid: 'wamid.a',
      fromWa: FROM,
      createdAtMs: T0,
      status: 'pending_agent',
      agentClaimedAtMs: null,
    },
    {
      wamid: 'wamid.b',
      fromWa: FROM,
      createdAtMs: T0 + 9_000,
      status: 'pending_agent',
      agentClaimedAtMs: null,
    },
    {
      wamid: 'wamid.c',
      fromWa: FROM,
      createdAtMs: T0 + 18_000,
      status: 'pending_agent',
      agentClaimedAtMs: null,
    },
    {
      wamid: 'wamid.d',
      fromWa: FROM,
      createdAtMs: T0 + 27_000,
      status: 'pending_agent',
      agentClaimedAtMs: null,
    },
  ];

  it('una ráfaga no se reclama hasta que hay silencio, y el segundo reclamo sale vacío', () => {
    expect(reclamarLoteWhatsApp(base, FROM, T0 + 27_000 + 10_000)).toEqual([]);
    const ahora = T0 + 27_000 + WHATSAPP_QUIET_MS;
    const primero = reclamarLoteWhatsApp(base, FROM, ahora);
    expect(primero).toEqual(['wamid.a', 'wamid.b', 'wamid.c', 'wamid.d']);
    const aplicadas = base.map(fila =>
      primero.includes(fila.wamid) ? { ...fila, agentClaimedAtMs: ahora } : fila
    );
    expect(reclamarLoteWhatsApp(aplicadas, FROM, ahora + 1_000)).toEqual([]);
  });

  it('otro remitente reclama su propio lote y un grupo no reclama nada', () => {
    const otro = T0 + WHATSAPP_QUIET_MS;
    const filas: FilaReclamo[] = [
      ...base.map(fila => ({ ...fila, agentClaimedAtMs: otro })),
      {
        wamid: 'wamid.otro',
        fromWa: '573009998877',
        createdAtMs: T0,
        status: 'pending_agent',
        agentClaimedAtMs: null,
      },
    ];
    expect(reclamarLoteWhatsApp(filas, '573009998877', T0 + WHATSAPP_QUIET_MS)).toEqual([
      'wamid.otro',
    ]);
    expect(
      reclamarLoteWhatsApp(
        [
          {
            wamid: 'wamid.g',
            fromWa: '1203630-99',
            createdAtMs: T0,
            status: 'pending_agent',
            agentClaimedAtMs: null,
          },
        ],
        '1203630-99',
        T0 + WHATSAPP_QUIET_MS
      )
    ).toEqual([]);
  });

  it('un cliente en pausa no se reclama', () => {
    const ahora = T0 + 27_000 + WHATSAPP_QUIET_MS;
    expect(reclamarLoteWhatsApp(base, FROM, ahora, { paused: true })).toEqual([]);
  });

  it('no reclama un contacto ignorado y sí recupera un reclamo vencido', () => {
    const ahora = T0 + WHATSAPP_QUIET_MS + 5_000;
    const ignorado: FilaReclamo[] = [
      {
        wamid: 'wamid.p',
        fromWa: FROM,
        createdAtMs: T0,
        status: 'pending_agent',
        agentClaimedAtMs: null,
      },
      {
        wamid: 'wamid.i',
        fromWa: FROM,
        createdAtMs: T0 + 1_000,
        status: 'ignored',
        agentClaimedAtMs: null,
      },
    ];
    expect(reclamarLoteWhatsApp(ignorado, FROM, ahora)).toEqual([]);

    const vencido: FilaReclamo[] = [
      {
        wamid: 'wamid.p',
        fromWa: FROM,
        createdAtMs: T0,
        status: 'pending_agent',
        agentClaimedAtMs: ahora - WHATSAPP_CLAIM_TTL_MS - 1,
      },
    ];
    expect(reclamarLoteWhatsApp(vencido, FROM, ahora)).toEqual(['wamid.p']);
  });
});

describe('plan de despacho', () => {
  it('agrupa una ráfaga en un solo wake y no manda espera antes del minuto', () => {
    const events = [0, 9_000, 18_000, 27_000].map((offset, index) =>
      pendiente({
        wamid: `wamid.${index}`,
        createdAt: new Date(T0 + offset).toISOString(),
        body: index === 0 ? '¿Tienen monitores?' : 'el de 12 pulgadas',
      })
    );
    const pronto = planWhatsAppDispatch({
      now: new Date(T0 + 27_000 + 10_000),
      events,
      outbound: [],
    });
    expect(pronto.wakes).toEqual([]);
    expect(pronto.holdings).toEqual([]);

    const listo = planWhatsAppDispatch({
      now: new Date(T0 + 27_000 + WHATSAPP_QUIET_MS),
      events,
      outbound: [],
    });
    expect(listo.wakes).toHaveLength(1);
    expect(listo.wakes[0]).toMatchObject({
      fromWa: FROM,
      wamid: 'wamid.3',
      text: 'el de 12 pulgadas',
    });
    expect(listo.holdings).toEqual([]);
  });

  it('un cliente en pausa no despierta al agente ni recibe espera', () => {
    const events = [pendiente({ wamid: 'wamid.pausa', createdAt: new Date(T0).toISOString() })];
    const plan = planWhatsAppDispatch({
      now: new Date(T0 + WHATSAPP_HOLDING_AFTER_MS + 5_000),
      events,
      outbound: [],
      pausedWaIds: [FROM],
    });
    expect(plan.wakes).toEqual([]);
    expect(plan.holdings).toEqual([]);
  });

  it('manda una sola espera variada si el pendiente supera el minuto y nadie ha escrito', () => {
    const events = [pendiente({ wamid: 'wamid.q', createdAt: new Date(T0).toISOString() })];
    const plan = planWhatsAppDispatch({
      now: new Date(T0 + WHATSAPP_HOLDING_AFTER_MS + 1_000),
      events,
      outbound: [],
    });
    expect(plan.wakes).toHaveLength(1);
    expect(plan.holdings).toHaveLength(1);
    expect(plan.holdings[0]?.turnKey).toBe('wamid.q');
    expect(plan.holdings[0]?.body).not.toBe(FRASE_VIEJA);
    expect(MENSAJES_ESPERA_ES).toContain(plan.holdings[0]?.body);

    const repetido = planWhatsAppDispatch({
      now: new Date(T0 + WHATSAPP_HOLDING_AFTER_MS + 1_000),
      events,
      outbound: [
        salida({
          createdAt: new Date(T0 + 61_000).toISOString(),
          turnKey: 'wamid.q',
          body: plan.holdings[0]?.body,
        }),
      ],
    });
    expect(repetido.holdings).toEqual([]);
  });

  it('no espera por acuses, ni si ya hubo salida, ni dentro de la cadencia, ni a ignorados o grupos', () => {
    const ahora = new Date(T0 + WHATSAPP_HOLDING_AFTER_MS + 5_000);
    const soloGracias = planWhatsAppDispatch({
      now: ahora,
      events: [
        pendiente({ wamid: 'wamid.ok', createdAt: new Date(T0).toISOString(), body: 'ok' }),
        pendiente({
          wamid: 'wamid.g',
          createdAt: new Date(T0 + 1_000).toISOString(),
          body: 'gracias',
        }),
        pendiente({ wamid: 'wamid.e', createdAt: new Date(T0 + 2_000).toISOString(), body: '👍' }),
      ],
      outbound: [],
    });
    expect(soloGracias.holdings).toEqual([]);
    expect(soloGracias.wakes).toHaveLength(1);

    const conPregunta = planWhatsAppDispatch({
      now: ahora,
      events: [
        pendiente({
          wamid: 'wamid.q',
          createdAt: new Date(T0).toISOString(),
          body: '¿Tienen monitores?',
        }),
        pendiente({
          wamid: 'wamid.ok',
          createdAt: new Date(T0 + 2_000).toISOString(),
          body: 'listo',
        }),
      ],
      outbound: [],
    });
    expect(conPregunta.holdings).toHaveLength(1);

    const yaRespondio = planWhatsAppDispatch({
      now: ahora,
      events: [pendiente({ wamid: 'wamid.q', createdAt: new Date(T0).toISOString() })],
      outbound: [
        salida({
          createdAt: new Date(T0 + 30_000).toISOString(),
          kind: 'reply',
          body: 'Tenemos la línea Biolight.',
          turnKey: null,
        }),
      ],
    });
    expect(yaRespondio.holdings).toEqual([]);

    const cadencia = planWhatsAppDispatch({
      now: new Date(T0 + WHATSAPP_HOLDING_MIN_GAP_MS - 10_000),
      events: [pendiente({ wamid: 'wamid.nuevo', createdAt: new Date(T0 + 30_000).toISOString() })],
      outbound: [salida({ createdAt: new Date(T0).toISOString(), turnKey: 'wamid.viejo' })],
    });
    expect(cadencia.holdings).toEqual([]);

    const despues = planWhatsAppDispatch({
      now: new Date(T0 + WHATSAPP_HOLDING_MIN_GAP_MS + WHATSAPP_HOLDING_AFTER_MS),
      events: [
        pendiente({
          wamid: 'wamid.nuevo',
          createdAt: new Date(T0 + WHATSAPP_HOLDING_MIN_GAP_MS).toISOString(),
        }),
      ],
      outbound: [
        salida({
          createdAt: new Date(T0).toISOString(),
          turnKey: 'wamid.viejo',
          body: MENSAJES_ESPERA_ES[0],
        }),
      ],
    });
    expect(despues.holdings).toHaveLength(1);
    expect(despues.holdings[0]?.body).not.toBe(MENSAJES_ESPERA_ES[0]);

    const ignorado = planWhatsAppDispatch({
      now: ahora,
      events: [
        pendiente({ wamid: 'wamid.q', createdAt: new Date(T0).toISOString() }),
        pendiente({
          wamid: 'wamid.i',
          createdAt: new Date(T0 + 5_000).toISOString(),
          status: 'ignored',
          body: 'no escribir',
        }),
      ],
      outbound: [],
    });
    expect(ignorado.wakes).toEqual([]);
    expect(ignorado.holdings).toEqual([]);

    const grupo = planWhatsAppDispatch({
      now: ahora,
      events: [
        pendiente({
          fromWa: '1203630123@g.us',
          wamid: 'wamid.grupo',
          createdAt: new Date(T0).toISOString(),
        }),
      ],
      outbound: [],
    });
    expect(grupo.wakes).toEqual([]);
    expect(grupo.holdings).toEqual([]);
  });

  it('no despierta dos veces mientras el reclamo del agente sigue fresco', () => {
    const events = [
      pendiente({
        wamid: 'wamid.q',
        createdAt: new Date(T0).toISOString(),
        agentClaimedAt: new Date(T0 + 30_000).toISOString(),
      }),
    ];
    const plan = planWhatsAppDispatch({
      now: new Date(T0 + WHATSAPP_HOLDING_AFTER_MS + 5_000),
      events,
      outbound: [],
    });
    expect(plan.wakes).toEqual([]);
    expect(plan.holdings).toHaveLength(1);
  });

  it('usa inglés si el pendiente está en inglés', () => {
    const plan = planWhatsAppDispatch({
      now: new Date(T0 + WHATSAPP_HOLDING_AFTER_MS + 1_000),
      events: [
        pendiente({
          wamid: 'wamid.en',
          createdAt: new Date(T0).toISOString(),
          body: 'What is the price of the patient monitor?',
        }),
      ],
      outbound: [],
    });
    expect(plan.holdings[0]?.locale).toBe('en');
    expect(MENSAJES_ESPERA_EN).toContain(plan.holdings[0]?.body);
  });
});
