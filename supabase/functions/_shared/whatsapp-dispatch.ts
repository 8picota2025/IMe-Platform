/**
 * Despacho IMEIA: reclamo atómico + wake del agente + mensaje de espera.
 * Lo usan `whatsapp-webhook` (seguimiento en background) y
 * `whatsapp-imeia-dispatch` (cron cada minuto, por si el isolate murió).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  detectarLocaleWhatsApp,
  sendWhatsAppText,
  type WhatsAppGraphConfig,
} from '../../../src/lib/whatsapp-cloud.ts';
import {
  planWhatsAppDispatch,
  WHATSAPP_CLAIM_TTL_MS,
  WHATSAPP_HOLDING_AFTER_MS,
  WHATSAPP_HOLDING_MIN_GAP_MS,
  WHATSAPP_HOLDING_RESERVATION_MS,
  WHATSAPP_PENDING_WINDOW_MS,
  WHATSAPP_QUIET_MS,
  type HoldingPlan,
  type InboundEventRow,
  type OutboundEventRow,
} from '../../../src/lib/whatsapp-imeia-dispatch.ts';

const WAKE_TIMEOUT_MS = 120_000;

interface InboundDb {
  from_wa: string | null;
  wamid: string;
  body: string | null;
  created_at: string;
  phone_number_id: string | null;
  status: string;
  agent_claimed_at: string | null;
}

interface OutboundDb {
  to_wa: string;
  body: string;
  kind: 'holding' | 'reply' | 'other';
  created_at: string;
  send_status: 'pending' | 'sent' | 'failed';
  turn_key: string | null;
}

interface ClaimDb {
  out_wamid: string;
  out_body: string | null;
  out_created_at: string;
  out_phone_number_id: string | null;
  out_claim_token: string;
}

export interface DespachoResultado {
  wakes: number;
  holdings: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function edgeWaitUntil(): ((work: Promise<unknown>) => void) | null {
  const runtime = (
    globalThis as {
      EdgeRuntime?: { waitUntil?: (work: Promise<unknown>) => void };
    }
  ).EdgeRuntime;
  return typeof runtime?.waitUntil === 'function' ? runtime.waitUntil.bind(runtime) : null;
}

function mapInbound(row: InboundDb): InboundEventRow | null {
  if (!row.from_wa) return null;
  return {
    fromWa: row.from_wa,
    wamid: row.wamid,
    body: row.body,
    createdAt: row.created_at,
    phoneNumberId: row.phone_number_id,
    status: row.status,
    agentClaimedAt: row.agent_claimed_at,
  };
}

function mapOutbound(row: OutboundDb): OutboundEventRow {
  return {
    toWa: row.to_wa,
    body: row.body,
    kind: row.kind,
    createdAt: row.created_at,
    sendStatus: row.send_status,
    turnKey: row.turn_key,
  };
}

function pausasAusentes(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /whatsapp_contact_pauses/i.test(error.message ?? '')
  );
}

async function cargarPausados(
  supabase: SupabaseClient,
  fromWa: string | null
): Promise<string[] | null> {
  let query = supabase.from('whatsapp_contact_pauses').select('wa_id').eq('paused', true);
  if (fromWa) query = query.eq('wa_id', fromWa);
  const { data, error } = await query;
  if (!error) {
    return ((data ?? []) as Array<{ wa_id?: string }>)
      .map(fila => fila.wa_id ?? '')
      .filter(waId => waId.length > 0);
  }
  if (pausasAusentes(error)) {
    console.warn('[whatsapp-dispatch] whatsapp_contact_pauses aún no existe');
    return [];
  }
  console.error('[whatsapp-dispatch] pausas:', error.message);
  return null;
}

async function cargarSnapshot(
  supabase: SupabaseClient,
  fromWa: string | null,
  now: Date
): Promise<{
  events: InboundEventRow[];
  outbound: OutboundEventRow[];
  outboundOk: boolean;
  pausedWaIds: string[] | null;
}> {
  const since = new Date(now.getTime() - WHATSAPP_PENDING_WINDOW_MS).toISOString();
  let inboundQuery = supabase
    .from('whatsapp_inbound_events')
    .select('from_wa, wamid, body, created_at, phone_number_id, status, agent_claimed_at')
    .in('status', ['pending_agent', 'ignored'])
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (fromWa) inboundQuery = inboundQuery.eq('from_wa', fromWa);

  let outboundQuery = supabase
    .from('whatsapp_outbound_messages')
    .select('to_wa, body, kind, created_at, send_status, turn_key')
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (fromWa) outboundQuery = outboundQuery.eq('to_wa', fromWa);

  const [inboundRes, outboundRes, pausedWaIds] = await Promise.all([
    inboundQuery,
    outboundQuery,
    cargarPausados(supabase, fromWa),
  ]);
  if (inboundRes.error) {
    console.error('[whatsapp-dispatch] inbound:', inboundRes.error.message);
    return { events: [], outbound: [], outboundOk: false, pausedWaIds };
  }
  if (outboundRes.error) {
    console.error('[whatsapp-dispatch] outbound:', outboundRes.error.message);
  }

  const events = ((inboundRes.data ?? []) as InboundDb[])
    .map(mapInbound)
    .filter((row): row is InboundEventRow => row !== null);
  const outbound = outboundRes.error
    ? []
    : ((outboundRes.data ?? []) as OutboundDb[]).map(mapOutbound);
  return { events, outbound, outboundOk: !outboundRes.error, pausedWaIds };
}

async function liberarReclamo(supabase: SupabaseClient, token: string): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_inbound_events')
    .update({
      agent_claimed_at: null,
      agent_claim_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('agent_claim_token', token)
    .eq('status', 'pending_agent');
  if (error) console.warn('[whatsapp-dispatch] liberar reclamo:', error.message);
}

async function despertarLote(
  supabase: SupabaseClient,
  fromWa: string,
  graph: WhatsAppGraphConfig | null,
  wakeUrl: string,
  wakeKey: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_whatsapp_agent_batch', {
    p_from_wa: fromWa,
    p_quiet_seconds: Math.round(WHATSAPP_QUIET_MS / 1000),
    p_claim_ttl_seconds: Math.round(WHATSAPP_CLAIM_TTL_MS / 1000),
  });
  if (error) {
    console.error('[whatsapp-dispatch] claim:', error.message);
    return false;
  }
  const filas = (data ?? []) as ClaimDb[];
  if (filas.length === 0) return false;

  const latest = filas.reduce((mejor, fila) =>
    fila.out_created_at > mejor.out_created_at ? fila : mejor
  );
  const token = latest.out_claim_token;
  const texto = (latest.out_body ?? '').trim();
  const phoneNumberId = latest.out_phone_number_id ?? graph?.phoneNumberId ?? null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(wakeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wakeKey}`,
        'X-Webhook-Key': wakeKey,
      },
      body: JSON.stringify({
        source: 'whatsapp-cloud',
        channel: 'imeia',
        from: fromWa,
        text: texto,
        wamid: latest.out_wamid,
        phone_number_id: phoneNumberId,
        locale: detectarLocaleWhatsApp(filas.map(fila => fila.out_body ?? '').join('\n')),
        received_at: latest.out_created_at,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[whatsapp-dispatch] wake HTTP', res.status, cola(fromWa));
      await res.body?.cancel().catch(() => undefined);
      await liberarReclamo(supabase, token);
      return false;
    }
    await res.body?.cancel().catch(() => undefined);
    console.info('[whatsapp-dispatch] wake', cola(fromWa), 'filas', filas.length);
    return true;
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.error(
      '[whatsapp-dispatch] wake',
      aborted ? 'timeout (se conserva el reclamo)' : 'error',
      cola(fromWa),
      err instanceof Error ? err.message : err
    );
    if (!aborted) await liberarReclamo(supabase, token);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function cola(fromWa: string): string {
  const digits = fromWa.replace(/\D/g, '');
  return digits.length <= 4 ? digits : `…${digits.slice(-4)}`;
}

async function enviarEspera(
  supabase: SupabaseClient,
  plan: HoldingPlan,
  graph: WhatsAppGraphConfig | null,
  fetchImpl: typeof fetch
): Promise<boolean> {
  if (!graph) {
    console.warn('[whatsapp-dispatch] sin WHATSAPP_TOKEN: no se envía espera');
    return false;
  }

  const { data: pendiente, error: pendienteError } = await supabase
    .from('whatsapp_inbound_events')
    .select('wamid, created_at')
    .eq('from_wa', plan.fromWa)
    .eq('status', 'pending_agent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendienteError) {
    console.error('[whatsapp-dispatch] recheck pendiente:', pendienteError.message);
    return false;
  }
  const actual = pendiente as { wamid?: string; created_at?: string } | null;
  if (!actual?.wamid || actual.wamid !== plan.turnKey || !actual.created_at) return false;
  if (Date.now() - Date.parse(actual.created_at) < WHATSAPP_HOLDING_AFTER_MS) return false;

  const { data: salidas, error: salidasError } = await supabase
    .from('whatsapp_outbound_messages')
    .select('id, created_at, send_status, kind')
    .eq('to_wa', plan.fromWa)
    .gte('created_at', actual.created_at)
    .order('created_at', { ascending: false })
    .limit(20);
  if (salidasError) {
    console.error('[whatsapp-dispatch] recheck outbound:', salidasError.message);
    return false;
  }
  const recientes = (salidas ?? []) as Array<{
    id: string;
    created_at: string;
    send_status: string;
    kind: string;
  }>;
  if (recientes.some(fila => fila.send_status === 'sent')) return false;

  const { data: previas, error: previasError } = await supabase
    .from('whatsapp_outbound_messages')
    .select('id, created_at, send_status, turn_key')
    .eq('to_wa', plan.fromWa)
    .eq('kind', 'holding')
    .in('send_status', ['sent', 'pending'])
    .order('created_at', { ascending: false })
    .limit(5);
  if (previasError) {
    console.error('[whatsapp-dispatch] holdings previas:', previasError.message);
    return false;
  }
  const holdings = (previas ?? []) as Array<{
    id: string;
    created_at: string;
    send_status: string;
    turn_key: string | null;
  }>;
  const enCadencia = holdings.filter(fila => {
    const edad = Date.now() - Date.parse(fila.created_at);
    return Number.isFinite(edad) && edad >= 0 && edad < WHATSAPP_HOLDING_MIN_GAP_MS;
  });
  const reservaVieja =
    enCadencia.length === 1 &&
    enCadencia[0]?.turn_key === plan.turnKey &&
    enCadencia[0]?.send_status === 'pending' &&
    Date.now() - Date.parse(enCadencia[0].created_at) >= WHATSAPP_HOLDING_RESERVATION_MS;
  if (enCadencia.length > 0 && !reservaVieja) return false;

  const reservaPrevia = holdings.find(fila => fila.turn_key === plan.turnKey);
  if (reservaPrevia?.send_status === 'sent') return false;
  if (reservaPrevia?.send_status === 'pending') {
    const edad = Date.now() - Date.parse(reservaPrevia.created_at);
    if (edad < WHATSAPP_HOLDING_RESERVATION_MS) return false;
    await supabase.from('whatsapp_outbound_messages').delete().eq('id', reservaPrevia.id);
  }

  const { data: insertada, error: insertError } = await supabase
    .from('whatsapp_outbound_messages')
    .insert({
      to_wa: plan.fromWa,
      body: plan.body,
      kind: 'holding',
      turn_key: plan.turnKey,
      phone_number_id: plan.phoneNumberId ?? graph.phoneNumberId,
      send_status: 'pending',
    })
    .select('id')
    .maybeSingle();
  if (insertError) {
    if (insertError.code === '23505') return false;
    console.error('[whatsapp-dispatch] insert espera:', insertError.message);
    return false;
  }
  const id = (insertada as { id?: string } | null)?.id;
  if (!id) return false;

  const enviado = await sendWhatsAppText({
    to: plan.fromWa,
    body: plan.body,
    token: graph.token,
    phoneNumberId: plan.phoneNumberId ?? graph.phoneNumberId,
    apiVersion: graph.apiVersion,
    fetchImpl,
  });
  if (!enviado.ok) {
    console.error('[whatsapp-dispatch] Graph espera:', enviado.error ?? enviado.status);
    await supabase
      .from('whatsapp_outbound_messages')
      .update({ send_status: 'failed', turn_key: null, wamid: null })
      .eq('id', id);
    return false;
  }
  await supabase
    .from('whatsapp_outbound_messages')
    .update({ send_status: 'sent', wamid: enviado.messageId ?? null })
    .eq('id', id);
  console.info('[whatsapp-dispatch] espera', cola(plan.fromWa));
  return true;
}

export async function despacharWhatsAppImeia(opts: {
  supabase: SupabaseClient;
  graph: WhatsAppGraphConfig | null;
  wakeUrl: string | null;
  wakeKey: string | null;
  fromWa?: string | null;
  wakes: boolean;
  holdings: boolean;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<DespachoResultado> {
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const fromWa = opts.fromWa ?? null;
  const snapshot = await cargarSnapshot(opts.supabase, fromWa, now);
  if (snapshot.pausedWaIds === null) return { wakes: 0, holdings: 0 };
  if (snapshot.events.length === 0) return { wakes: 0, holdings: 0 };

  const plan = planWhatsAppDispatch({
    now,
    events: snapshot.events,
    outbound: snapshot.outbound,
    pausedWaIds: snapshot.pausedWaIds,
  });
  let wakes = 0;
  let holdings = 0;

  if (opts.wakes && opts.wakeUrl && opts.wakeKey) {
    const candidatos = fromWa ? plan.wakes.filter(wake => wake.fromWa === fromWa) : plan.wakes;
    for (const wake of candidatos) {
      const ok = await despertarLote(
        opts.supabase,
        wake.fromWa,
        opts.graph,
        opts.wakeUrl,
        opts.wakeKey,
        fetchImpl
      );
      if (ok) wakes += 1;
    }
  } else if (opts.wakes && plan.wakes.length > 0 && (!opts.wakeUrl || !opts.wakeKey)) {
    console.warn('[whatsapp-dispatch] IMEIA_AGENT_WEBHOOK_URL/KEY ausentes: no wake');
  }

  if (opts.holdings && snapshot.outboundOk) {
    const candidatos = fromWa
      ? plan.holdings.filter(holding => holding.fromWa === fromWa)
      : plan.holdings;
    for (const holding of candidatos) {
      const ok = await enviarEspera(opts.supabase, holding, opts.graph, fetchImpl);
      if (ok) holdings += 1;
    }
  }

  return { wakes, holdings };
}

/**
 * Tras guardar el inbound: espera el silencio, despierta una vez y, si la
 * respuesta sigue pendiente al minuto, manda la espera. El cron repite el
 * mismo despacho por si este isolate no llega al final.
 */
export async function seguirTurnoWhatsApp(opts: {
  supabase: SupabaseClient;
  graph: WhatsAppGraphConfig | null;
  wakeUrl: string | null;
  wakeKey: string | null;
  froms: string[];
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const inicio = Date.now();
  await sleep(WHATSAPP_QUIET_MS);
  for (const fromWa of opts.froms) {
    await despacharWhatsAppImeia({ ...opts, fromWa, wakes: true, holdings: false });
  }
  const falta = inicio + WHATSAPP_HOLDING_AFTER_MS + 5_000 - Date.now();
  if (falta > 0) await sleep(falta);
  for (const fromWa of opts.froms) {
    await despacharWhatsAppImeia({ ...opts, fromWa, wakes: true, holdings: true });
  }
}
