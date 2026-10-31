/** Fila de la cola de Emilio. No envía correo. */

export interface SolicitudCorreo {
  solicitante: string;
  origen: string;
  destinatarios: string[];
  asunto: string;
  html: string;
  referencia?: string | null;
  reply_to?: string | null;
  remitente?: string | null;
  adjuntos?: { filename: string; bytes: number }[];
}

export interface FilaColaEmilio {
  solicitante: string;
  origen: string;
  destinatarios: string[];
  asunto: string;
  html: string;
  referencia: string | null;
  reply_to: string | null;
  remitente: string | null;
  adjuntos: { filename: string; bytes: number }[];
  estado: 'pendiente';
}

export function filaColaEmilio(solicitud: SolicitudCorreo): FilaColaEmilio {
  const solicitante = solicitud.solicitante.trim();
  const destinatarios = solicitud.destinatarios.map(item => item.trim()).filter(Boolean);
  if (!solicitante) throw new Error('solicitante obligatorio');
  if (!destinatarios.length) throw new Error('destinatario obligatorio');
  if (!solicitud.asunto.trim()) throw new Error('asunto obligatorio');
  return {
    solicitante,
    origen: solicitud.origen.trim() || 'desconocido',
    destinatarios,
    asunto: solicitud.asunto,
    html: solicitud.html,
    referencia: solicitud.referencia ?? null,
    reply_to: solicitud.reply_to ?? null,
    remitente: solicitud.remitente ?? null,
    adjuntos: solicitud.adjuntos ?? [],
    estado: 'pendiente',
  };
}

export function correoEntregado(resultado: { ok: boolean; encolado?: boolean }): boolean {
  return resultado.ok === true && resultado.encolado !== true;
}
