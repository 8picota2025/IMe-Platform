import { describe, expect, it } from 'vitest';
import {
  ejecutarPanelAccion,
  type EventoInsert,
  type PanelDeps,
  type TareaPanelRow,
} from './panel-accion';
import type { CuerpoAprobacion } from './panel-reglas';

const ID = '11111111-1111-4111-8111-111111111111';
const ACTOR = { userId: 'user-1', email: 'shoky@example.com', ip: '203.0.113.8' };
const AHORA = new Date('2026-10-31T21:00:00.000Z');

function cuerpoCotizacion(): CuerpoAprobacion {
  return {
    accion: 'aprobar',
    origen: 'cotizacion',
    id: ID,
    aprobacion_tipo: 'ok_shoky',
    ref: 'chat-ok',
    margen: null,
    confirmado: true,
  };
}

describe('ejecutarPanelAccion', () => {
  it('aprueba una cotizacion una sola vez y deja auditoria', async () => {
    let fila = {
      id: ID,
      numero: 'ABIERTA',
      estado: 'en_revision',
      notas_internas: 'NO ENVIAR',
      send_error: null,
      aprobado_por: null as string | null,
      aprobado_at: null as string | null,
      aprobacion_tipo: null as string | null,
      aprobacion_hash: null as string | null,
      updated_at: 'v1',
    };
    const eventos: EventoInsert[] = [];
    let rpc = 0;
    const deps: PanelDeps = {
      leerCotizacion: async () => ({ ...fila }),
      aprobarCotizacion: async args => {
        rpc += 1;
        expect(args.por).toBe(ACTOR.email);
        expect(args.tipo).toBe('ok_shoky');
        expect(args.ref).toBe('chat-ok');
        fila = {
          ...fila,
          aprobado_por: args.por,
          aprobado_at: '2026-10-31T21:00:01.000Z',
          aprobacion_tipo: args.tipo,
          aprobacion_hash: 'huella',
        };
      },
      insertarEvento: async evento => {
        eventos.push(evento);
      },
      leerTarea: async () => null,
      marcarTareaEnCola: async () => undefined,
      encolarTablon: async () => undefined,
    };

    const primera = await ejecutarPanelAccion(deps, cuerpoCotizacion(), ACTOR, AHORA);
    const segunda = await ejecutarPanelAccion(deps, cuerpoCotizacion(), ACTOR, AHORA);

    expect(primera.idempotente).toBe(false);
    expect(segunda.idempotente).toBe(true);
    expect(rpc).toBe(1);
    expect(fila.aprobado_por).toBe(ACTOR.email);
    expect(fila.aprobado_at).toBeTruthy();
    expect(eventos.map(evento => evento.resultado)).toEqual(['solicitada', 'ok', 'idempotente']);
    expect(
      eventos.every(
        evento => evento.actor === ACTOR.email && evento.ts && evento.accion === 'aprobar'
      )
    ).toBe(true);
    expect(eventos[1]?.detalle.aprobado_por).toBe(ACTOR.email);
    expect(eventos.every(evento => evento.detalle.envia === false)).toBe(true);
  });

  it('encola una tarea que no es cotizacion y no llama al RPC', async () => {
    const tarea: TareaPanelRow = {
      id: ID,
      tipo: 'bot',
      titulo: 'Revisar RFQ',
      ref: 'rfq-1',
      bot_dueno: 'hermes',
      columna: 'por_aprobar',
      estado: 'abierta',
      payload: {},
      updated_at: 'v1',
    };
    const eventos: EventoInsert[] = [];
    let rpc = 0;
    let encolados = 0;
    let marcada = false;
    const deps: PanelDeps = {
      leerCotizacion: async () => null,
      aprobarCotizacion: async () => {
        rpc += 1;
      },
      insertarEvento: async evento => {
        eventos.push(evento);
      },
      leerTarea: async () => ({
        ...tarea,
        columna: marcada ? 'aprobado_en_cola' : tarea.columna,
        estado: marcada ? 'en_cola' : tarea.estado,
      }),
      marcarTareaEnCola: async (_id, marca) => {
        marcada = true;
        expect(marca.aprobado_por).toBe(ACTOR.email);
        expect(marca.aprobado_at).toBe(AHORA.toISOString());
      },
      encolarTablon: async payload => {
        encolados += 1;
        expect(payload.bot_dueno).toBe('hermes');
        expect(payload.accion).toBe('encolar');
      },
    };
    const cuerpo: CuerpoAprobacion = {
      accion: 'aprobar',
      origen: 'tarea',
      id: ID,
      aprobacion_tipo: null,
      ref: '',
      margen: null,
      confirmado: true,
    };
    await ejecutarPanelAccion(deps, cuerpo, ACTOR, AHORA);
    await ejecutarPanelAccion(deps, cuerpo, ACTOR, AHORA);
    expect(rpc).toBe(0);
    expect(encolados).toBe(1);
    expect(eventos.map(evento => evento.resultado)).toEqual(['solicitada', 'ok', 'idempotente']);
  });

  it('si el tablon falla no marca la tarea en cola', async () => {
    let marcada = 0;
    const deps: PanelDeps = {
      leerCotizacion: async () => null,
      aprobarCotizacion: async () => undefined,
      insertarEvento: async () => undefined,
      leerTarea: async () => ({
        id: ID,
        tipo: 'bot',
        titulo: 'Revisar',
        ref: null,
        bot_dueno: 'hermes',
        columna: 'por_aprobar',
        estado: 'abierta',
        payload: {},
        updated_at: null,
      }),
      marcarTareaEnCola: async () => {
        marcada += 1;
      },
      encolarTablon: async () => {
        throw new Error('tablon HTTP 500');
      },
    };
    await expect(
      ejecutarPanelAccion(
        deps,
        {
          accion: 'aprobar',
          origen: 'tarea',
          id: ID,
          aprobacion_tipo: null,
          ref: '',
          margen: null,
          confirmado: true,
        },
        ACTOR,
        AHORA
      )
    ).rejects.toMatchObject({ status: 502 });
    expect(marcada).toBe(0);
  });
});
