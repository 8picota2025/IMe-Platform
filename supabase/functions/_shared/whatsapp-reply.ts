import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendWhatsAppText, type WhatsAppGraphConfig } from '../../../src/lib/whatsapp-cloud.ts';
import { canDispatch, recipientForContact } from './whatsapp-dispatch.ts';

export interface WhatsAppReplyResult {
  ok: boolean;
  status: number;
  error?: 'new_messages';
}

interface ClaimedInbound {
  from_wa: string;
  wamid: string;
  phone_number_id: string | null;
  created_at: string;
}

function newestCreatedAt(rows: readonly ClaimedInbound[]): string | null {
  let newest: string | null = null;
  for (const row of rows) {
    if (!row.created_at) continue;
    if (!newest || row.created_at > newest) newest = row.created_at;
  }
  return newest;
}

/** true = hay pending más nuevo; false = no; null = la lectura falló. */
async function hayPendingMasNuevo(
  supabase: SupabaseClient,
  fromWa: string,
  newest: string
): Promise<boolean | null> {
  const newer = await supabase
    .from('whatsapp_inbound_events')
    .select('wamid')
    .eq('from_wa', fromWa)
    .eq('status', 'pending_agent')
    .gt('created_at', newest)
    .limit(1);
  if (newer.error) return null;
  return (newer.data?.length ?? 0) > 0;
}

/** Suelta el reclamo sin contar fallo: el siguiente claim junta el lote con lo nuevo. */
async function soltarReclamo(supabase: SupabaseClient, token: string): Promise<boolean> {
  const released = await supabase
    .from('whatsapp_inbound_events')
    .update({
      status: 'pending_agent',
      agent_claim_token: null,
      agent_claimed_at: null,
    })
    .eq('agent_claim_token', token)
    .eq('status', 'pending_agent');
  return !released.error;
}

/** Outbound reply row for this turn (unique to_wa+kind+turn_key). */
async function outboundReplyForTurn(
  supabase: SupabaseClient,
  fromWa: string,
  turnKey: string
): Promise<{ error: true } | { error: false; row: { id: string; send_status: string } | null }> {
  const prior = await supabase
    .from('whatsapp_outbound_messages')
    .select('id, send_status')
    .eq('to_wa', fromWa)
    .eq('turn_key', turnKey)
    .eq('kind', 'reply')
    .maybeSingle();
  if (prior.error) return { error: true };
  const row = prior.data as { id: string; send_status: string } | null;
  return { error: false, row };
}

/**
 * If Graph already accepted this turn's reply but the inbound close failed,
 * close the claimed batch as replied. Newer pending rows (other tokens) stay open.
 */
async function cerrarLoteSiReplyYaEnviado(
  supabase: SupabaseClient,
  token: string,
  fromWa: string,
  turnKey: string
): Promise<WhatsAppReplyResult | null> {
  const prior = await outboundReplyForTurn(supabase, fromWa, turnKey);
  if (prior.error) return { ok: false, status: 503 };
  if (prior.row?.send_status !== 'sent') return null;
  const closed = await supabase
    .from('whatsapp_inbound_events')
    .update({ status: 'replied', retry_count: 0, last_error: null })
    .eq('agent_claim_token', token)
    .eq('status', 'pending_agent');
  return { ok: !closed.error, status: closed.error ? 503 : 200 };
}

async function descartarReservaPendiente(
  supabase: SupabaseClient,
  reservationId: string
): Promise<void> {
  const removed = await supabase
    .from('whatsapp_outbound_messages')
    .delete()
    .eq('id', reservationId)
    .eq('send_status', 'pending');
  if (!removed.error) return;
  await supabase
    .from('whatsapp_outbound_messages')
    .update({ send_status: 'failed' })
    .eq('id', reservationId)
    .eq('send_status', 'pending');
}

/** Closes only the claimed batch. Newly received messages remain pending. */
export async function replyToWhatsAppBatch(
  supabase: SupabaseClient,
  graph: WhatsAppGraphConfig,
  token: string,
  body: string,
  fetchImpl: typeof fetch = fetch
): Promise<WhatsAppReplyResult> {
  const batch = await supabase
    .from('whatsapp_inbound_events')
    .select('from_wa, wamid, phone_number_id, created_at')
    .eq('agent_claim_token', token)
    .eq('status', 'pending_agent')
    .gt('created_at', new Date(Date.now() - 86400000).toISOString())
    .order('created_at', { ascending: false });
  if (batch.error) return { ok: false, status: 503 };
  const claimed = (batch.data ?? []) as ClaimedInbound[];
  const latest = claimed[0];
  if (!latest) return { ok: false, status: 409 };
  const newest = newestCreatedAt(claimed);
  if (!newest) return { ok: false, status: 503 };

  const antes = await hayPendingMasNuevo(supabase, latest.from_wa, newest);
  if (antes === null) return { ok: false, status: 503 };
  if (antes) {
    // Send may have already succeeded while close failed; do not release that
    // batch back to pending or a later claim will Graph-send again under a new turn_key.
    const recovered = await cerrarLoteSiReplyYaEnviado(
      supabase,
      token,
      latest.from_wa,
      latest.wamid
    );
    if (recovered) return recovered;
    const released = await soltarReclamo(supabase, token);
    if (!released) return { ok: false, status: 503 };
    return { ok: false, status: 409, error: 'new_messages' };
  }

  if (!(await canDispatch(supabase, latest.from_wa))) return { ok: false, status: 409 };
  const to = await recipientForContact(supabase, latest.from_wa);
  if (!to) return { ok: false, status: 422 };
  let reservation = await supabase
    .from('whatsapp_outbound_messages')
    .insert({
      to_wa: latest.from_wa,
      body,
      kind: 'reply',
      turn_key: latest.wamid,
      phone_number_id: latest.phone_number_id ?? graph.phoneNumberId,
      send_status: 'pending',
    })
    .select('id')
    .single();
  if (reservation.error?.code === '23505') {
    const recovered = await cerrarLoteSiReplyYaEnviado(
      supabase,
      token,
      latest.from_wa,
      latest.wamid
    );
    if (recovered) return recovered;
    const prior = await outboundReplyForTurn(supabase, latest.from_wa, latest.wamid);
    if (prior.error) return { ok: false, status: 503 };
    if (prior.row?.send_status !== 'failed') return { ok: false, status: 409 };
    reservation = await supabase
      .from('whatsapp_outbound_messages')
      .update({ send_status: 'pending', body })
      .eq('id', prior.row.id)
      .eq('send_status', 'failed')
      .select('id')
      .single();
  }
  if (reservation.error || !reservation.data) return { ok: false, status: 409 };
  if (!(await canDispatch(supabase, latest.from_wa))) return { ok: false, status: 409 };

  const justoAntes = await hayPendingMasNuevo(supabase, latest.from_wa, newest);
  if (justoAntes === null) {
    await descartarReservaPendiente(supabase, reservation.data.id);
    return { ok: false, status: 503 };
  }
  if (justoAntes) {
    await descartarReservaPendiente(supabase, reservation.data.id);
    const released = await soltarReclamo(supabase, token);
    if (!released) return { ok: false, status: 503 };
    return { ok: false, status: 409, error: 'new_messages' };
  }

  let uncertain = false;
  const sent = await sendWhatsAppText({
    to,
    body,
    ...graph,
    phoneNumberId: latest.phone_number_id ?? graph.phoneNumberId,
    fetchImpl,
  }).catch(() => {
    uncertain = true;
    return { ok: false, messageId: undefined };
  });
  const logged = await supabase
    .from('whatsapp_outbound_messages')
    .update({
      send_status: sent.ok ? 'sent' : uncertain ? 'pending' : 'failed',
      wamid: sent.messageId ?? null,
    })
    .eq('id', reservation.data.id);
  if (logged.error) return { ok: false, status: 503 };
  if (!sent.ok) {
    await supabase.rpc('fail_whatsapp_batch', {
      p_token: token,
      p_error: uncertain ? 'reply_send_uncertain' : 'reply_send_failed',
      p_release: false,
    });
    return { ok: false, status: 502 };
  }
  const closed = await supabase
    .from('whatsapp_inbound_events')
    .update({ status: 'replied', retry_count: 0, last_error: null })
    .eq('agent_claim_token', token)
    .eq('status', 'pending_agent');
  return { ok: !closed.error, status: closed.error ? 503 : 200 };
}
