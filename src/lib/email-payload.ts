/**
 * Payload JSON para la API de Resend (POST /emails). Extraído de
 * `_shared/email.ts` para poder probarlo sin runtime Deno.
 */
import { esEmailValido } from './cotizacion-asesor.ts';

export interface AdjuntoResend {
  filename: string;
  content: string;
}

export interface EntradaPayloadResend {
  from: string;
  to: string;
  subject: string;
  html: string;
  adjuntos?: AdjuntoResend[];
  /** Reply-To; se omite si no es un email válido. */
  replyTo?: string | null;
}

export function construirPayloadResend(entrada: EntradaPayloadResend): Record<string, unknown> {
  const replyTo = esEmailValido(entrada.replyTo) ? entrada.replyTo.trim() : '';
  return {
    from: entrada.from,
    to: entrada.to,
    subject: entrada.subject,
    html: entrada.html,
    ...(entrada.adjuntos && entrada.adjuntos.length > 0 ? { attachments: entrada.adjuntos } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
  };
}
