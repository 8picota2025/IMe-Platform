/**
 * Ecos del WhatsApp Business app. No envía WhatsApp.
 * El aviso de pausa/reanudar no es compatible con el wake del agente
 * (hace falta from, text y wamid de un mensaje del cliente), así que
 * solo queda en whatsapp_contact_pauses.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  avisoTomaHumana,
  clasificarTomaHumana,
  tomaHumanaCompatibleConWake,
} from '../../../src/lib/whatsapp-human-takeover.ts';
import type { WhatsAppManualEcho } from '../../../src/lib/whatsapp-cloud.ts';

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
    return false;
  }
  return data?.paused === true;
}

export async function registrarEcoManual(
  supabase: SupabaseClient,
  echo: WhatsAppManualEcho
): Promise<'duplicate' | 'pause' | 'resume' | 'logged'> {
  const { data: ya, error: lectura } = await supabase
    .from('whatsapp_outbound_messages')
    .select('id')
    .eq('wamid', echo.wamid)
    .maybeSingle();
  if (lectura) {
    console.warn('[whatsapp-echo] no se pudo mirar el eco');
  }
  if (ya) return 'duplicate';

  const accion = clasificarTomaHumana(echo.text);
  if (accion) {
    const ahora = new Date().toISOString();
    const fila =
      accion === 'pause'
        ? { wa_id: echo.waId, paused: true, paused_at: ahora, updated_by: echo.wamid }
        : { wa_id: echo.waId, paused: false, resumed_at: ahora, updated_by: echo.wamid };
    const { error } = await supabase.from('whatsapp_contact_pauses').upsert(fila, {
      onConflict: 'wa_id',
    });
    if (error) console.error('[whatsapp-echo] pausa:', error.message);
    const aviso = avisoTomaHumana(accion, echo.waId);
    if (tomaHumanaCompatibleConWake(aviso)) {
      console.warn('[whatsapp-echo] aviso compatible con wake; no hay envío implementado');
    }
  }

  const { error: salida } = await supabase.from('whatsapp_outbound_messages').insert({
    to_wa: echo.waId,
    body: echo.text.slice(0, 4096),
    kind: 'other',
    wamid: echo.wamid,
    phone_number_id: echo.phoneNumberId,
    send_status: 'sent',
  });
  if (salida && salida.code !== '23505') {
    console.warn('[whatsapp-echo] bitácora:', salida.message);
  }

  const { error: audit } = await supabase.from('whatsapp_inbound_events').insert({
    wamid: echo.wamid,
    from_wa: echo.waId,
    phone_number_id: echo.phoneNumberId,
    kind: 'echo',
    status: 'echo',
    body: echo.text.slice(0, 2000),
  });
  if (audit && audit.code !== '23505') {
    console.warn('[whatsapp-echo] auditoria:', audit.message);
  }

  if (accion === 'pause') return 'pause';
  if (accion === 'resume') return 'resume';
  return 'logged';
}
