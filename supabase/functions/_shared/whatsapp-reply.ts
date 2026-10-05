import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendWhatsAppText, type WhatsAppGraphConfig } from '../../../src/lib/whatsapp-cloud.ts';
import { canDispatch, recipientForContact } from './whatsapp-dispatch.ts';

/** Closes only the claimed batch. Newly received messages remain pending. */
export async function replyToWhatsAppBatch(
  supabase: SupabaseClient,
  graph: WhatsAppGraphConfig,
  token: string,
  body: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; status: number }> {
  const batch = await supabase
    .from('whatsapp_inbound_events')
    .select('from_wa, wamid, phone_number_id, created_at')
    .eq('agent_claim_token', token)
    .eq('status', 'pending_agent')
    .gt('created_at', new Date(Date.now() - 86400000).toISOString())
    .order('created_at', { ascending: false });
  if (batch.error) return { ok: false, status: 503 };
  const latest = batch.data?.[0];
  if (!latest) return { ok: false, status: 409 };
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
    const prior = await supabase
      .from('whatsapp_outbound_messages')
      .select('id, send_status')
      .eq('to_wa', latest.from_wa)
      .eq('turn_key', latest.wamid)
      .eq('kind', 'reply')
      .maybeSingle();
    if (prior.error) return { ok: false, status: 503 };
    if (prior.data?.send_status === 'sent') {
      const closed = await supabase
        .from('whatsapp_inbound_events')
        .update({ status: 'replied', retry_count: 0, last_error: null })
        .eq('agent_claim_token', token)
        .eq('status', 'pending_agent');
      return { ok: !closed.error, status: closed.error ? 503 : 200 };
    }
    if (prior.data?.send_status !== 'failed') return { ok: false, status: 409 };
    reservation = await supabase
      .from('whatsapp_outbound_messages')
      .update({ send_status: 'pending', body })
      .eq('id', prior.data.id)
      .eq('send_status', 'failed')
      .select('id')
      .single();
  }
  if (reservation.error || !reservation.data) return { ok: false, status: 409 };
  if (!(await canDispatch(supabase, latest.from_wa))) return { ok: false, status: 409 };
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
