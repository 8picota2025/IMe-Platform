/**
 * Despacho IMEIA: reclamo atómico + wake del agente + mensaje de espera.
 * Lo usan `whatsapp-webhook` (seguimiento en background) y
 * `whatsapp-imeia-dispatch` (cron cada minuto, por si el isolate murió).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { IME_WHATSAPP_E164 } from '../../../src/lib/contacto-oficial.ts';
import {
  detectarLocaleWhatsApp,
  normalizeWhatsAppIdentifier,
  sendWhatsAppText,
  whatsAppRecipient,
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
  WHATSAPP_TYPING_CAP_MS,
  type AudienciaWhatsApp,
  type HoldingPlan,
  type InboundEventRow,
  type OutboundEventRow,
} from '../../../src/lib/whatsapp-imeia-dispatch.ts';
import { esAcuseTrivial } from '../../../src/lib/whatsapp-espera.ts';
import { encolarHermes, rutaImeia } from './imeia-route.ts';

const WAKE_TIMEOUT_MS = 120_000;
const RECENT_OUTBOUND_MS = 10 * 60 * 1000;
const RECENT_OUTBOUND_LIMIT = 3;

/**
 * Mensajes de espera apagados salvo `WHATSAPP_HOLDING_ENABLED=true` o `1`.
 * Vacío, `false` y cualquier otro valor no envían espera.
 */
export function whatsappHoldingEnabled(): boolean {
  const deno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } })
    .Deno;
  let raw: string | undefined;
  try {
    raw = deno?.env?.get?.('WHATSAPP_HOLDING_ENABLED');
  } catch {
    raw = undefined;
  }
  const value = raw?.trim().toLowerCase() ?? '';
  return value === 'true' || value === '1';
}

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
  kind: 'holding' | 'reply' | 'template' | 'other';
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

function digitosWa(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Clientes y proveedores antes que el número del negocio (actividad interna). */
export async function audienciasWhatsApp(
  supabase: SupabaseClient,
  senders: readonly string[]
): Promise<Map<string, AudienciaWhatsApp>> {
  const map = new Map<string, AudienciaWhatsApp>();
  const negocio = digitosWa(IME_WHATSAPP_E164);
  for (const sender of senders) {
    const digits = digitosWa(sender);
    map.set(sender, digits.length > 0 && digits === negocio ? 'internal' : 'customer');
  }
  const proveedores = await supabase.from('proveedores').select('contacto_whatsapp');
  const contactos = await supabase.from('proveedor_contactos').select('whatsapp');
  if (proveedores.error && contactos.error) return map;
  const supplierIds = new Set<string>();
  for (const row of (proveedores.data ?? []) as Array<{ contacto_whatsapp?: string | null }>) {
    const raw = row.contacto_whatsapp?.trim() ?? '';
    if (!raw) continue;
    supplierIds.add(normalizeWhatsAppIdentifier(raw));
    const digits = digitosWa(raw);
    if (digits) supplierIds.add(digits);
  }
  for (const row of (contactos.data ?? []) as Array<{ whatsapp?: string | null }>) {
    const raw = row.whatsapp?.trim() ?? '';
    if (!raw) continue;
    supplierIds.add(normalizeWhatsAppIdentifier(raw));
    const digits = digitosWa(raw);
    if (digits) supplierIds.add(digits);
  }
  for (const sender of senders) {
    if (map.get(sender) === 'internal') continue;
    const digits = digitosWa(sender);
    if (supplierIds.has(sender) || (digits.length > 0 && supplierIds.has(digits))) {
      map.set(sender, 'supplier');
    }
  }
  return map;
}

async function algunoEscribiendo(
  supabase: SupabaseClient,
  froms: readonly string[]
): Promise<boolean> {
  if (froms.length === 0) return false;
  const { data, error } = await supabase
    .from('whatsapp_typing_state')
    .select('typing_until')
    .in('sender_id', [...froms]);
  if (error) return false;
  const ahora = Date.now();
  return ((data ?? []) as Array<{ typing_until?: string | null }>).some(fila => {
    const hasta = Date.parse(fila.typing_until ?? '');
    return Number.isFinite(hasta) && hasta > ahora;
  });
}

async function fallarReclamo(
  supabase: SupabaseClient,
  token: string,
  error: string,
  release = true
): Promise<void> {
  const result = await supabase.rpc('fail_whatsapp_batch', {
    p_token: token,
    p_error: error,
    p_release: release,
  });
  if (result.error) throw new Error('whatsapp_failure_record_failed');
}

export async function recipientForContact(
  supabase: SupabaseClient,
  sender: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('whatsapp_contact_routes')
    .select('bsuid, phone')
    .eq('sender_id', sender)
    .maybeSingle();
  if (error) throw new Error('whatsapp_route_lookup_failed');
  const candidate = data?.bsuid ?? data?.phone ?? sender;
  return whatsAppRecipient(candidate) ? candidate : null;
}

export async function canDispatch(supabase: SupabaseClient, sender: string): Promise<boolean> {
  const { data: reason, error } = await supabase.rpc('whatsapp_dispatch_drop_reason', {
    p_sender: sender,
  });
  if (error) throw new Error('whatsapp_dispatch_guard_failed');
  if (!reason) return true;
  const { data, error: updateError } = await supabase
    .from('whatsapp_inbound_events')
    .update({ status: reason === 'paused' ? 'human_paused' : 'ignored', drop_reason: reason })
    .eq('from_wa', sender)
    .eq('status', 'pending_agent')
    .select('wamid');
  if (updateError) throw new Error('whatsapp_drop_update_failed');
  if (data?.length) {
    const { error: auditError } = await supabase.from('whatsapp_drop_log').insert(
      data.map((row: { wamid: string }) => ({
        wamid: row.wamid,
        sender_id: sender,
        drop_reason: reason,
      }))
    );
    if (auditError) throw new Error('whatsapp_drop_audit_failed');
  }
  return false;
}

async function despertarLote(
  supabase: SupabaseClient,
  fromWa: string,
  graph: WhatsAppGraphConfig | null,
  wakeUrl: string,
  wakeKey: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  if (!(await canDispatch(supabase, fromWa))) return false;
  const recipientId = await recipientForContact(supabase, fromWa);
  if (!recipientId) {
    const result = await supabase
      .from('whatsapp_inbound_events')
      .update({ status: 'ignored', drop_reason: 'no_sendable_recipient' })
      .eq('from_wa', fromWa)
      .eq('status', 'pending_agent')
      .select('wamid');
    if (result.error) throw new Error('whatsapp_drop_update_failed');
    if (result.data?.length) {
      const audit = await supabase.from('whatsapp_drop_log').insert(
        result.data.map((row: { wamid: string }) => ({
          wamid: row.wamid,
          sender_id: fromWa,
          drop_reason: 'no_sendable_recipient',
        }))
      );
      if (audit.error) throw new Error('whatsapp_drop_audit_failed');
    }
    return false;
  }
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
  const recentOutbound = await contextoSalidaReciente(supabase, fromWa);
  // Un lote de solo acuses se despierta igual: el agente decide. No se cierra aquí.
  const trivialAck = filas.every(fila => esAcuseTrivial(fila.out_body ?? ''));
  const payload = {
    source: 'whatsapp-cloud',
    channel: 'imeia',
    from: fromWa,
    text: texto,
    claim_token: token,
    sender_id: fromWa,
    recipient: whatsAppRecipient(recipientId),
    reply_endpoint: 'whatsapp-imeia-reply',
    messages: filas.map(row => ({ wamid: row.out_wamid, body: row.out_body })),
    recent_outbound: recentOutbound,
    trivial_ack: trivialAck,
    wamid: latest.out_wamid,
    phone_number_id: phoneNumberId,
    locale: detectarLocaleWhatsApp(filas.map(fila => fila.out_body ?? '').join('\n')),
    received_at: latest.out_created_at,
  };
  if ((await rutaImeia(supabase)) === 'hermes') {
    // Failover sin tokens: el worker Hermes (srv) recoge el mismo payload por pull.
    if (await encolarHermes(supabase, 'whatsapp', token, payload)) return true;
    await fallarReclamo(supabase, token, 'hermes_queue_failed');
    return false;
  }
  if (!wakeUrl || !wakeKey) {
    await fallarReclamo(supabase, token, 'wake_configuration_missing');
    return false;
  }
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
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[whatsapp-dispatch] wake HTTP', res.status, cola(fromWa));
      await res.body?.cancel().catch(() => undefined);
      await fallarReclamo(supabase, token, `wake_http_${res.status}`);
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
      'wake_network_failure'
    );
    await fallarReclamo(supabase, token, aborted ? 'wake_timeout' : 'wake_network_error', !aborted);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Últimas 3 salidas enviadas a ese contacto en 10 minutos, de la más antigua a la más nueva. */
async function contextoSalidaReciente(
  supabase: SupabaseClient,
  fromWa: string
): Promise<Array<{ time: string; text: string }>> {
  const since = new Date(Date.now() - RECENT_OUTBOUND_MS).toISOString();
  const { data, error } = await supabase
    .from('whatsapp_outbound_messages')
    .select('body, created_at')
    .eq('to_wa', fromWa)
    .eq('send_status', 'sent')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(RECENT_OUTBOUND_LIMIT);
  if (error) {
    console.error('[whatsapp-dispatch] contexto salida:', error.message);
    return [];
  }
  return ((data ?? []) as Array<{ body?: string | null; created_at?: string | null }>)
    .filter(fila => typeof fila.created_at === 'string' && fila.created_at.length > 0)
    .reverse()
    .map(fila => ({ time: fila.created_at as string, text: fila.body ?? '' }));
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
  if (!whatsappHoldingEnabled()) return false;
  if (!(await canDispatch(supabase, plan.fromWa))) return false;
  const recipient = await recipientForContact(supabase, plan.fromWa);
  if (!recipient) return false;
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

  if (!(await canDispatch(supabase, plan.fromWa))) return false;
  const enviado = await sendWhatsAppText({
    to: recipient,
    body: plan.body,
    token: graph.token,
    phoneNumberId: plan.phoneNumberId ?? graph.phoneNumberId,
    apiVersion: graph.apiVersion,
    fetchImpl,
  }).catch(() => ({ ok: false, error: 'holding_network_error', status: 0, messageId: undefined }));
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

/** Durable reservation: a second holding is attempted at most once per alerted turn.
 * An ambiguous network failure is left failed for human review, never resent automatically. */
async function secondHoldings(
  supabase: SupabaseClient,
  graph: WhatsAppGraphConfig | null,
  fetchImpl: typeof fetch
): Promise<number> {
  if (!whatsappHoldingEnabled()) return 0;
  if (!graph) return 0;
  const { data: alerts, error } = await supabase
    .from('whatsapp_alerts')
    .select('id, sender_id, turn_key')
    .eq('second_holding_status', 'new')
    .limit(100);
  if (error) throw new Error('whatsapp_alert_lookup_failed');
  let count = 0;
  for (const alert of alerts ?? []) {
    if (!(await canDispatch(supabase, alert.sender_id))) continue;
    const recipient = await recipientForContact(supabase, alert.sender_id);
    if (!recipient) continue;
    const pending = await supabase
      .from('whatsapp_inbound_events')
      .select('status, created_at')
      .eq('wamid', alert.turn_key)
      .maybeSingle();
    if (pending.error) throw new Error('whatsapp_pending_lookup_failed');
    if (pending.data?.status !== 'pending_agent') continue;
    const replied = await supabase
      .from('whatsapp_outbound_messages')
      .select('id')
      .eq('to_wa', alert.sender_id)
      .eq('kind', 'reply')
      .eq('send_status', 'sent')
      .gte('created_at', pending.data.created_at)
      .limit(1);
    if (replied.error) throw new Error('whatsapp_reply_lookup_failed');
    if (replied.data?.length) continue;
    const firstHolding = await supabase
      .from('whatsapp_outbound_messages')
      .select('id')
      .eq('to_wa', alert.sender_id)
      .eq('kind', 'holding')
      .eq('turn_key', alert.turn_key)
      .eq('send_status', 'sent')
      .limit(1);
    if (firstHolding.error) throw new Error('whatsapp_first_holding_lookup_failed');
    if (!firstHolding.data?.length) continue;
    const reserved = await supabase
      .from('whatsapp_alerts')
      .update({ second_holding_status: 'reserved' })
      .eq('id', alert.id)
      .eq('second_holding_status', 'new')
      .select('id');
    if (reserved.error) throw new Error('whatsapp_alert_reservation_failed');
    if (!reserved.data?.length) continue;
    const body =
      'Seguimos revisando tu consulta. La respuesta está tardando más de lo previsto; nuestro equipo te atenderá lo antes posible.';
    const sent = await sendWhatsAppText({ to: recipient, body, ...graph, fetchImpl }).catch(() => ({
      ok: false,
      messageId: undefined,
    }));
    const update = await supabase
      .from('whatsapp_alerts')
      .update({ second_holding_status: sent.ok ? 'sent' : 'failed' })
      .eq('id', alert.id);
    if (update.error) throw new Error('whatsapp_alert_status_failed');
    const outbound = await supabase.from('whatsapp_outbound_messages').insert({
      to_wa: alert.sender_id,
      body,
      kind: 'holding',
      turn_key: `${alert.turn_key}:retry`,
      send_status: sent.ok ? 'sent' : 'failed',
      wamid: sent.messageId ?? null,
      phone_number_id: graph.phoneNumberId,
    });
    if (outbound.error) throw new Error('whatsapp_second_holding_audit_failed');
    if (sent.ok) count += 1;
  }
  return count;
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
  const maintained = await opts.supabase.rpc('maintain_whatsapp_pipeline');
  if (maintained.error) throw new Error('whatsapp_maintenance_failed');
  const snapshot = await cargarSnapshot(opts.supabase, fromWa, now);
  if (snapshot.pausedWaIds === null) return { wakes: 0, holdings: 0 };
  if (snapshot.events.length === 0) return { wakes: 0, holdings: 0 };

  const allowedEvents: InboundEventRow[] = [];
  for (const sender of new Set(snapshot.events.map(event => event.fromWa))) {
    if (await canDispatch(opts.supabase, sender))
      allowedEvents.push(...snapshot.events.filter(event => event.fromWa === sender));
  }
  const audiences = await audienciasWhatsApp(opts.supabase, [
    ...new Set(allowedEvents.map(event => event.fromWa)),
  ]);
  const plan = planWhatsAppDispatch({
    now,
    events: allowedEvents,
    outbound: snapshot.outbound,
    pausedWaIds: snapshot.pausedWaIds,
    audiences,
  });
  let wakes = 0;
  let holdings = 0;
  const holdingsOn = opts.holdings && whatsappHoldingEnabled();

  if (opts.wakes) {
    const candidatos = fromWa ? plan.wakes.filter(wake => wake.fromWa === fromWa) : plan.wakes;
    for (const wake of candidatos) {
      const ok = await despertarLote(
        opts.supabase,
        wake.fromWa,
        opts.graph,
        opts.wakeUrl ?? '',
        opts.wakeKey ?? '',
        fetchImpl
      );
      if (ok) wakes += 1;
    }
  }

  if (holdingsOn && snapshot.outboundOk) {
    const candidatos = fromWa
      ? plan.holdings.filter(holding => holding.fromWa === fromWa)
      : plan.holdings;
    for (const holding of candidatos) {
      const ok = await enviarEspera(opts.supabase, holding, opts.graph, fetchImpl);
      if (ok) holdings += 1;
    }
  }

  if (holdingsOn) holdings += await secondHoldings(opts.supabase, opts.graph, fetchImpl);
  return { wakes, holdings };
}

/**
 * Tras guardar el inbound: espera el silencio y despierta una vez.
 * La segunda pasada, al minuto, solo manda espera si WHATSAPP_HOLDING_ENABLED.
 * El cron repite el mismo despacho por si este isolate no llega al final.
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
  const limite = inicio + WHATSAPP_TYPING_CAP_MS;
  await sleep(WHATSAPP_QUIET_MS);
  while (Date.now() < limite && (await algunoEscribiendo(opts.supabase, opts.froms))) {
    const faltaEscritura = limite - Date.now();
    if (faltaEscritura <= 0) break;
    await sleep(Math.min(5_000, faltaEscritura));
  }
  for (const fromWa of opts.froms) {
    await despacharWhatsAppImeia({ ...opts, fromWa, wakes: true, holdings: false });
  }
  if (!whatsappHoldingEnabled()) return;
  const falta = inicio + WHATSAPP_HOLDING_AFTER_MS + 5_000 - Date.now();
  if (falta > 0) await sleep(falta);
  for (const fromWa of opts.froms) {
    await despacharWhatsAppImeia({ ...opts, fromWa, wakes: true, holdings: true });
  }
}
