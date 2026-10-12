/**
 * Ecos del WhatsApp Business app. No envía WhatsApp.
 * El aviso de pausa/reanudar no es compatible con el wake del agente
 * (hace falta from, text y wamid de un mensaje del cliente), así que
 * solo queda en whatsapp_contact_pauses.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { clasificarTomaHumana } from '../../../src/lib/whatsapp-human-takeover.ts';
import {
  whatsAppIdentifierType,
  type WhatsAppManualEcho,
} from '../../../src/lib/whatsapp-cloud.ts';

export async function contactoEstaPausado(
  supabase: SupabaseClient,
  waId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('whatsapp_contact_pauses')
    .select('paused')
    .eq('wa_id', waId)
    .maybeSingle();
  if (error) {
    console.warn('[whatsapp-echo] no se pudo leer la pausa');
    throw new Error('whatsapp_pause_lookup_failed');
  }
  return data?.paused === true;
}

export async function registrarEcoManual(
  supabase: SupabaseClient,
  echo: WhatsAppManualEcho
): Promise<'duplicate' | 'pause' | 'resume' | 'logged'> {
  const action = clasificarTomaHumana(echo.text) ?? 'pause';
  const type = whatsAppIdentifierType(echo.waId);
  const { data, error } = await supabase.rpc('ingest_whatsapp_event', {
    p_event: {
      wamid: echo.wamid,
      sender_id: echo.waId,
      sender_type: type,
      phone: type === 'phone' ? echo.waId : null,
      bsuid: type === 'bsuid' ? echo.waId : null,
      body: echo.text,
      kind: 'echo',
      echo_action: action,
      phone_number_id: echo.phoneNumberId,
      raw: echo.raw ?? null,
    },
  });
  if (error) throw new Error('whatsapp_echo_persistence_failed');
  if (data?.status === 'duplicate' || data?.status === 'ignored') return 'duplicate';
  return action;
}
