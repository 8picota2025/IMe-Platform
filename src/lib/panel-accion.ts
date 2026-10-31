/**
 * Orquesta aprobar una tarjeta. La marca de cotización la pone el RPC
 * aprobar_cotizacion_envio (solo service_role, desde la Edge Function).
 * Una tarea no-cotización se encola en el tablón. No hay envío a clientes.
 */

import {
  PanelAccionError,
  alertasDeTarjeta,
  esIdempotenteCotizacion,
  esIdempotenteTarea,
  hashAccion,
  type CuerpoAprobacion,
  type TipoAprobacion,
} from './panel-reglas';

export interface ActorPanel {
  userId: string;
  email: string;
  ip: string;
}

export interface CotizacionPanelRow {
  id: string;
  numero: string | null;
  estado: string | null;
  notas_internas: string | null;
  send_error: string | null;
  aprobado_por: string | null;
  aprobado_at: string | null;
  aprobacion_tipo: string | null;
  aprobacion_hash: string | null;
  updated_at: string | null;
}

export interface TareaPanelRow {
  id: string;
  tipo: string;
  titulo: string;
  ref: string | null;
  bot_dueno: string | null;
  columna: string;
  estado: string;
  payload: Record<string, unknown>;
  updated_at: string | null;
}

export interface AprobarArgs {
  id: string;
  por: string;
  tipo: TipoAprobacion;
  ref: string;
  margen: number | null;
}

export interface EventoInsert {
  tarjetaId: string;
  tarjetaTipo: string;
  accion: string;
  actor: string;
  actorId: string;
  ts: string;
  resultado: string;
  hash: string;
  ip: string;
  version: string;
  detalle: Record<string, unknown>;
}

export interface TablonPayload {
  accion: 'encolar';
  tarea_id: string;
  bot_dueno: string;
  titulo: string;
  ref: string | null;
  aprobado_por: string;
  aprobado_at: string;
  origen: 'panel-accion';
}

export interface PanelDeps {
  leerCotizacion(id: string): Promise<CotizacionPanelRow | null>;
  aprobarCotizacion(args: AprobarArgs): Promise<void>;
  insertarEvento(evento: EventoInsert): Promise<void>;
  leerTarea(id: string): Promise<TareaPanelRow | null>;
  marcarTareaEnCola(
    id: string,
    marca: { aprobado_por: string; aprobado_at: string; payload: Record<string, unknown> }
  ): Promise<void>;
  encolarTablon(payload: TablonPayload): Promise<void>;
}

function tareaTwenty(tarea: TareaPanelRow): boolean {
  return tarea.payload.origen === 'twenty' || tarea.payload.escribe_twenty === true;
}

async function eventoDe(
  base: Omit<EventoInsert, 'hash' | 'ts' | 'resultado' | 'detalle'> & {
    resultado: string;
    detalle: Record<string, unknown>;
    semilla: string[];
  },
  ahora: Date
): Promise<EventoInsert> {
  return {
    tarjetaId: base.tarjetaId,
    tarjetaTipo: base.tarjetaTipo,
    accion: base.accion,
    actor: base.actor,
    actorId: base.actorId,
    ts: ahora.toISOString(),
    resultado: base.resultado,
    hash: await hashAccion(base.semilla),
    ip: base.ip,
    version: base.version,
    detalle: { envia: false, ...base.detalle },
  };
}

export async function ejecutarPanelAccion(
  deps: PanelDeps,
  cuerpo: CuerpoAprobacion,
  actor: ActorPanel,
  ahora: Date = new Date()
): Promise<{ ok: true; idempotente: boolean }> {
  if (cuerpo.origen === 'cotizacion') {
    return aprobarCotizacion(deps, cuerpo, actor, ahora);
  }
  return aprobarTarea(deps, cuerpo, actor, ahora);
}

async function aprobarCotizacion(
  deps: PanelDeps,
  cuerpo: CuerpoAprobacion,
  actor: ActorPanel,
  ahora: Date
): Promise<{ ok: true; idempotente: boolean }> {
  const tipo = cuerpo.aprobacion_tipo;
  if (!tipo) throw new PanelAccionError(400, 'BAD_REQUEST', 'Tipo de aprobacion invalido');
  const fila = await deps.leerCotizacion(cuerpo.id);
  if (!fila) throw new PanelAccionError(404, 'NOT_FOUND', 'Cotizacion no existe');
  const actorNombre = actor.email.trim() || actor.userId;
  const base = {
    tarjetaId: fila.id,
    tarjetaTipo: 'cotizacion',
    accion: 'aprobar',
    actor: actorNombre,
    actorId: actor.userId,
    ip: actor.ip,
    version: fila.updated_at ?? '',
  };
  const alertas = alertasDeTarjeta(fila);
  if (esIdempotenteCotizacion(fila, tipo)) {
    await deps.insertarEvento(
      await eventoDe(
        {
          ...base,
          resultado: 'idempotente',
          detalle: { alertas, aprobacion_tipo: tipo },
          semilla: [fila.id, 'aprobar', tipo, 'idempotente', fila.aprobacion_hash ?? ''],
        },
        ahora
      )
    );
    return { ok: true, idempotente: true };
  }
  await deps.insertarEvento(
    await eventoDe(
      {
        ...base,
        resultado: 'solicitada',
        detalle: { alertas, aprobacion_tipo: tipo },
        semilla: [fila.id, 'aprobar', tipo, 'solicitada', base.version],
      },
      ahora
    )
  );
  try {
    await deps.aprobarCotizacion({
      id: fila.id,
      por: actorNombre,
      tipo,
      ref: cuerpo.ref,
      margen: cuerpo.margen,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fallo la marca';
    await deps.insertarEvento(
      await eventoDe(
        {
          ...base,
          resultado: 'error',
          detalle: { alertas, message },
          semilla: [fila.id, 'aprobar', tipo, 'error', message],
        },
        ahora
      )
    );
    throw new PanelAccionError(409, 'APROBACION', message);
  }
  const despues = await deps.leerCotizacion(fila.id);
  if (!despues?.aprobado_por || !despues.aprobado_at) {
    await deps.insertarEvento(
      await eventoDe(
        {
          ...base,
          resultado: 'error',
          detalle: { alertas, message: 'la marca no quedo escrita' },
          semilla: [fila.id, 'aprobar', tipo, 'error', 'sin-marca'],
        },
        ahora
      )
    );
    throw new PanelAccionError(409, 'APROBACION', 'La marca de aprobacion no quedo escrita');
  }
  await deps.insertarEvento(
    await eventoDe(
      {
        ...base,
        resultado: 'ok',
        detalle: {
          alertas,
          aprobacion_tipo: tipo,
          aprobado_por: despues.aprobado_por,
          aprobado_at: despues.aprobado_at,
        },
        semilla: [fila.id, 'aprobar', tipo, 'ok', despues.aprobado_at],
      },
      ahora
    )
  );
  return { ok: true, idempotente: false };
}

async function aprobarTarea(
  deps: PanelDeps,
  cuerpo: CuerpoAprobacion,
  actor: ActorPanel,
  ahora: Date
): Promise<{ ok: true; idempotente: boolean }> {
  const tarea = await deps.leerTarea(cuerpo.id);
  if (!tarea) throw new PanelAccionError(404, 'NOT_FOUND', 'Tarea no existe');
  if (tareaTwenty(tarea)) {
    throw new PanelAccionError(
      400,
      'SOLO_LECTURA',
      'Twenty es solo lectura. Lo escribe el bot CRM.'
    );
  }
  const bot = String(tarea.bot_dueno ?? '').trim();
  if (!bot) throw new PanelAccionError(400, 'BAD_REQUEST', 'La tarea no tiene bot dueno');
  const actorNombre = actor.email.trim() || actor.userId;
  const marcaTiempo = ahora.toISOString();
  const base = {
    tarjetaId: tarea.id,
    tarjetaTipo: 'tarea',
    accion: 'aprobar',
    actor: actorNombre,
    actorId: actor.userId,
    ip: actor.ip,
    version: tarea.updated_at ?? '',
  };
  if (esIdempotenteTarea(tarea)) {
    await deps.insertarEvento(
      await eventoDe(
        {
          ...base,
          resultado: 'idempotente',
          detalle: { columna: tarea.columna, estado: tarea.estado },
          semilla: [tarea.id, 'aprobar', 'idempotente', tarea.columna, tarea.estado],
        },
        ahora
      )
    );
    return { ok: true, idempotente: true };
  }
  await deps.insertarEvento(
    await eventoDe(
      {
        ...base,
        resultado: 'solicitada',
        detalle: { bot_dueno: bot },
        semilla: [tarea.id, 'aprobar', 'solicitada', base.version],
      },
      ahora
    )
  );
  const payload: TablonPayload = {
    accion: 'encolar',
    tarea_id: tarea.id,
    bot_dueno: bot,
    titulo: tarea.titulo,
    ref: tarea.ref,
    aprobado_por: actorNombre,
    aprobado_at: marcaTiempo,
    origen: 'panel-accion',
  };
  try {
    await deps.encolarTablon(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fallo el tablon';
    await deps.insertarEvento(
      await eventoDe(
        {
          ...base,
          resultado: 'error',
          detalle: { message },
          semilla: [tarea.id, 'aprobar', 'error', message],
        },
        ahora
      )
    );
    throw new PanelAccionError(502, 'TABLON', message);
  }
  await deps.marcarTareaEnCola(tarea.id, {
    aprobado_por: actorNombre,
    aprobado_at: marcaTiempo,
    payload: {
      ...tarea.payload,
      aprobado_por: actorNombre,
      aprobado_at: marcaTiempo,
    },
  });
  await deps.insertarEvento(
    await eventoDe(
      {
        ...base,
        resultado: 'ok',
        detalle: { bot_dueno: bot, aprobado_por: actorNombre, aprobado_at: marcaTiempo },
        semilla: [tarea.id, 'aprobar', 'ok', marcaTiempo],
      },
      ahora
    )
  );
  return { ok: true, idempotente: false };
}
