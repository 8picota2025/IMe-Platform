import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  normalizeWhatsAppIdentifier,
  whatsAppIdentifierType,
  type InboundWhatsAppText,
} from '../../../src/lib/whatsapp-cloud.ts';

export async function auditWhatsAppDrop(
  supabase: SupabaseClient,
  reason: string,
  raw: unknown,
  wamid?: string
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_drop_log')
    .insert({ drop_reason: reason, wamid: wamid ?? null, raw });
  if (error) throw new Error('whatsapp_drop_audit_failed');
}

export async function ingestWhatsAppMessage(
  supabase: SupabaseClient,
  message: InboundWhatsAppText,
  raw: unknown,
  dropReason: string | null
): Promise<{ status: string; from_wa: string }> {
  const detail = message.raw as
    | { message?: Record<string, unknown>; contact?: Record<string, unknown> }
    | undefined;
  const firstIdentifier = (...values: unknown[]): string | undefined =>
    values.find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    ) as string | undefined;
  const phoneCandidate = firstIdentifier(detail?.message?.from, detail?.contact?.wa_id);
  const phone =
    phoneCandidate && whatsAppIdentifierType(phoneCandidate) === 'phone'
      ? normalizeWhatsAppIdentifier(phoneCandidate)
      : null;
  const bsuidCandidate = firstIdentifier(
    detail?.message?.from_user_id,
    detail?.message?.user_id,
    detail?.contact?.user_id,
    message.from
  );
  const bsuid =
    bsuidCandidate && whatsAppIdentifierType(bsuidCandidate) === 'bsuid' ? bsuidCandidate : null;
  const { data, error } = await supabase.rpc('ingest_whatsapp_event', {
    p_event: {
      wamid: message.wamid,
      sender_id: message.from,
      sender_type: message.senderType ?? whatsAppIdentifierType(message.from),
      phone,
      bsuid,
      username: message.username ?? null,
      profile_name: message.contactName,
      phone_number_id: message.phoneNumberId,
      kind: message.type,
      body: message.text,
      raw,
      drop_reason: dropReason,
    },
  });
  if (error) throw new Error('whatsapp_ingest_failed');
  return data as { status: string; from_wa: string };
}
