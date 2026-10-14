/**
 * Envío de plantillas de Meta y bitácora en whatsapp_outbound_messages.
 * kind = 'template'. El nombre (p. ej. aviso_cotizacion_pendiente) es el body.
 * No reenvía comandos de toma humana.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendWhatsAppTemplate, type WhatsAppGraphConfig } from '../../../src/lib/whatsapp-cloud.ts';

export async function enviarPlantillaWhatsApp(
  supabase: SupabaseClient,
  graph: WhatsAppGraphConfig,
  params: {
    to: string;
    toWa: string;
    templateName: string;
    languageCode?: string;
    bodyParameters?: readonly string[];
    fetchImpl?: typeof fetch;
  }
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const templateName = params.templateName.trim();
  const sent = await sendWhatsAppTemplate({
    to: params.to,
    templateName,
    languageCode: params.languageCode,
    bodyParameters: params.bodyParameters,
    token: graph.token,
    phoneNumberId: graph.phoneNumberId,
    apiVersion: graph.apiVersion,
    fetchImpl: params.fetchImpl,
  });
  const logged = await supabase.from('whatsapp_outbound_messages').insert({
    to_wa: params.toWa,
    body: templateName.slice(0, 4096),
    kind: 'template',
    wamid: sent.messageId ?? null,
    phone_number_id: graph.phoneNumberId,
    send_status: sent.ok ? 'sent' : 'failed',
    origin: 'imeia',
  });
  if (logged.error) throw new Error('whatsapp_template_log_failed');
  return { ok: sent.ok, messageId: sent.messageId, error: sent.error };
}
