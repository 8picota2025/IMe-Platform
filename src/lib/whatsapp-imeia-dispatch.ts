/**
 * Plan de despacho IMEIA por remitente: un solo wake tras un silencio breve,
 * y un mensaje de espera solo si la respuesta sigue pendiente pasado un minuto.
 *
 * El reclamo atómico de verdad está en SQL (`claim_whatsapp_agent_batch`).
 * `reclamarLoteWhatsApp` es el mismo criterio, para tests, dentro de una
 * transacción ya serializada: el segundo intento ve el reclamo del primero.
 */

import { detectarLocaleWhatsApp } from './whatsapp-cloud.ts';
import {
  elegirMensajeEspera,
  esAcuseTrivial,
  WHATSAPP_HOLDING_AFTER_MS,
  WHATSAPP_HOLDING_MIN_GAP_MS,
} from './whatsapp-espera.ts';

export { elegirMensajeEspera, esAcuseTrivial } from './whatsapp-espera.ts';
export {
  MENSAJES_ESPERA_EN,
  MENSAJES_ESPERA_ES,
  WHATSAPP_HOLDING_AFTER_MS,
  WHATSAPP_HOLDING_MIN_GAP_MS,
} from './whatsapp-espera.ts';

/** Silencio antes de despertar al agente: una ráfaga cuenta como un solo turno. */
export const WHATSAPP_QUIET_MS = 25_000;
/** Reserva `pending` más vieja que esto se puede reintentar (el envío no terminó). */
export const WHATSAPP_HOLDING_RESERVATION_MS = 90_000;
/** Si el agente no marcó el turno, se puede volver a reclamar. Cubre una corrida de ~80 s. */
export const WHATSAPP_CLAIM_TTL_MS = 180_000;
export const WHATSAPP_PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface InboundEventRow {
  fromWa: string;
  wamid: string;
  body: string | null;
  createdAt: string;
  phoneNumberId: string | null;
  status: string;
  agentClaimedAt: string | null;
}

export interface OutboundEventRow {
  toWa: string;
  body: string;
  kind: 'holding' | 'reply' | 'other';
  createdAt: string;
  sendStatus: 'pending' | 'sent' | 'failed';
  turnKey: string | null;
}

export interface WakePlan {
  fromWa: string;
  wamid: string;
  text: string;
  phoneNumberId: string | null;
  locale: 'es' | 'en';
  receivedAt: string;
}

export interface HoldingPlan {
  fromWa: string;
  body: string;
  phoneNumberId: string | null;
  /** wamid del pendiente más reciente: una espera por ese turno. */
  turnKey: string;
  latestCreatedAt: string;
  locale: 'es' | 'en';
}

export interface DispatchPlan {
  wakes: WakePlan[];
  holdings: HoldingPlan[];
}

export interface FilaReclamo {
  wamid: string;
  fromWa: string;
  createdAtMs: number;
  status: string;
  agentClaimedAtMs: number | null;
}

export interface PlanWhatsAppDispatchInput {
  now: Date;
  events: readonly InboundEventRow[];
  outbound: readonly OutboundEventRow[];
  quietMs?: number;
  holdingAfterMs?: number;
  holdingMinGapMs?: number;
  claimTtlMs?: number;
  ventanaMs?: number;
}

function tiempo(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : Number.NaN;
}

/** Grupos de WhatsApp no se atienden (mismo criterio que el parseo del webhook). */
export function esRemitenteGrupo(fromWa: string): boolean {
  return /@g\.us\b/i.test(fromWa) || fromWa.includes('-');
}

function ultimoPorFecha<T extends { createdAt: string }>(filas: readonly T[]): T | null {
  let elegido: T | null = null;
  let mejor = Number.NEGATIVE_INFINITY;
  for (const fila of filas) {
    const marca = tiempo(fila.createdAt);
    if (!Number.isFinite(marca) || marca < mejor) continue;
    mejor = marca;
    elegido = fila;
  }
  return elegido;
}

/**
 * wamids que esta transacción reclamaría. Lista vacía = salir sin wake.
 * No muta las filas: el caller aplica `agentClaimedAtMs` antes de un segundo intento.
 */
export function reclamarLoteWhatsApp(
  filas: readonly FilaReclamo[],
  fromWa: string,
  nowMs: number,
  options: { quietMs?: number; claimTtlMs?: number; ventanaMs?: number } = {}
): string[] {
  const quietMs = options.quietMs ?? WHATSAPP_QUIET_MS;
  const claimTtlMs = options.claimTtlMs ?? WHATSAPP_CLAIM_TTL_MS;
  const ventanaMs = options.ventanaMs ?? WHATSAPP_PENDING_WINDOW_MS;
  if (!fromWa.trim() || esRemitenteGrupo(fromWa)) return [];

  const enVentana = filas.filter(fila => {
    if (fila.fromWa !== fromWa) return false;
    const edad = nowMs - fila.createdAtMs;
    return edad >= 0 && edad <= ventanaMs;
  });
  const pending = enVentana.filter(fila => fila.status === 'pending_agent');
  if (pending.length === 0) return [];

  const latest = Math.max(...pending.map(fila => fila.createdAtMs));
  if (nowMs - latest < quietMs) return [];

  const ignorado = enVentana.some(fila => fila.status === 'ignored' && fila.createdAtMs >= latest);
  if (ignorado) return [];

  const reclamoFresco = pending.some(
    fila => fila.agentClaimedAtMs !== null && nowMs - fila.agentClaimedAtMs < claimTtlMs
  );
  if (reclamoFresco) return [];

  return pending
    .filter(fila => fila.agentClaimedAtMs === null || nowMs - fila.agentClaimedAtMs >= claimTtlMs)
    .map(fila => fila.wamid);
}

export function planWhatsAppDispatch(input: PlanWhatsAppDispatchInput): DispatchPlan {
  const nowMs = input.now.getTime();
  const quietMs = input.quietMs ?? WHATSAPP_QUIET_MS;
  const holdingAfterMs = input.holdingAfterMs ?? WHATSAPP_HOLDING_AFTER_MS;
  const holdingMinGapMs = input.holdingMinGapMs ?? WHATSAPP_HOLDING_MIN_GAP_MS;
  const claimTtlMs = input.claimTtlMs ?? WHATSAPP_CLAIM_TTL_MS;
  const ventanaMs = input.ventanaMs ?? WHATSAPP_PENDING_WINDOW_MS;

  const porRemitente = new Map<string, InboundEventRow[]>();
  for (const evento of input.events) {
    if (!evento.fromWa) continue;
    const lista = porRemitente.get(evento.fromWa) ?? [];
    lista.push(evento);
    porRemitente.set(evento.fromWa, lista);
  }

  const wakes: WakePlan[] = [];
  const holdings: HoldingPlan[] = [];
  const remitentes = [...porRemitente.keys()].sort();

  for (const fromWa of remitentes) {
    if (esRemitenteGrupo(fromWa)) continue;
    const eventos = porRemitente.get(fromWa) ?? [];
    const pending = eventos.filter(evento => {
      if (evento.status !== 'pending_agent') return false;
      const edad = nowMs - tiempo(evento.createdAt);
      return Number.isFinite(edad) && edad >= 0 && edad <= ventanaMs;
    });
    if (pending.length === 0) continue;

    const latest = ultimoPorFecha(pending);
    if (!latest) continue;
    const latestAt = tiempo(latest.createdAt);
    const ignorados = eventos.filter(evento => {
      if (evento.status !== 'ignored') return false;
      const edad = nowMs - tiempo(evento.createdAt);
      return Number.isFinite(edad) && edad >= 0 && edad <= ventanaMs;
    });
    const ultimoIgnorado = ultimoPorFecha(ignorados);
    if (ultimoIgnorado && tiempo(ultimoIgnorado.createdAt) >= latestAt) continue;

    const reclamoFresco = pending.some(evento => {
      if (!evento.agentClaimedAt) return false;
      const marca = tiempo(evento.agentClaimedAt);
      return Number.isFinite(marca) && nowMs - marca < claimTtlMs;
    });
    const locale = detectarLocaleWhatsApp(pending.map(evento => evento.body ?? '').join('\n'));

    if (!reclamoFresco && nowMs - latestAt >= quietMs) {
      wakes.push({
        fromWa,
        wamid: latest.wamid,
        text: (latest.body ?? '').trim(),
        phoneNumberId: latest.phoneNumberId,
        locale,
        receivedAt: new Date(latestAt).toISOString(),
      });
    }

    if (pending.every(evento => esAcuseTrivial(evento.body ?? ''))) continue;
    if (nowMs - latestAt < holdingAfterMs) continue;

    const salidas = input.outbound.filter(salida => salida.toWa === fromWa);
    const yaEnviado = salidas.some(salida => {
      if (salida.sendStatus !== 'sent') return false;
      const marca = tiempo(salida.createdAt);
      return Number.isFinite(marca) && marca >= latestAt;
    });
    if (yaEnviado) continue;

    const reservaVigente = (salida: OutboundEventRow): boolean => {
      if (salida.kind !== 'holding') return false;
      if (salida.sendStatus === 'sent') return true;
      if (salida.sendStatus !== 'pending') return false;
      const marca = tiempo(salida.createdAt);
      return Number.isFinite(marca) && nowMs - marca < WHATSAPP_HOLDING_RESERVATION_MS;
    };
    const reservaDeEsteTurno = salidas.some(
      salida => reservaVigente(salida) && salida.turnKey === latest.wamid
    );
    if (reservaDeEsteTurno) continue;

    const holdingsPrevios = salidas.filter(reservaVigente);
    const ultimoHolding = ultimoPorFecha(holdingsPrevios);
    if (ultimoHolding) {
      const marca = tiempo(ultimoHolding.createdAt);
      if (Number.isFinite(marca) && nowMs - marca < holdingMinGapMs) continue;
    }

    const ultimoTexto = ultimoPorFecha(
      salidas.filter(salida => salida.kind === 'holding' && salida.sendStatus === 'sent')
    );
    holdings.push({
      fromWa,
      body: elegirMensajeEspera(locale, ultimoTexto?.body ?? null, `${fromWa}:${latest.wamid}`),
      phoneNumberId: latest.phoneNumberId,
      turnKey: latest.wamid,
      latestCreatedAt: new Date(latestAt).toISOString(),
      locale,
    });
  }

  return { wakes, holdings };
}
