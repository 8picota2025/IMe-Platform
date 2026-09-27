/**
 * Toma humana en el WhatsApp Business app (coexistencia).
 * `#pausa` / `#activa` los escribe Shoky en el chat del cliente.
 * El wake del agente sigue siendo un turno de cliente (from, text, wamid):
 * un aviso {type, action, wa_id} no cabe ahí, así que no se envía.
 */

export type AccionTomaHumana = 'pause' | 'resume';

export interface AvisoTomaHumana {
  type: 'human_takeover';
  action: AccionTomaHumana;
  wa_id: string;
}

const CAMPOS_WAKE_OBLIGATORIOS = [
  'source',
  'channel',
  'from',
  'text',
  'wamid',
  'received_at',
] as const;

/**
 * Primera palabra, sin puntuación final. `#pausa ya lo veo` pausa.
 * `#pausar` y `ok #pausa` no.
 */
export function clasificarTomaHumana(texto: string): AccionTomaHumana | null {
  const primero = texto.trim().split(/\s+/, 1)[0] ?? '';
  const token = primero.replace(/[.,;:!?…]+$/u, '');
  if (/^#pausa$/i.test(token)) return 'pause';
  if (/^#activa$/i.test(token)) return 'resume';
  return null;
}

export function avisoTomaHumana(action: AccionTomaHumana, waId: string): AvisoTomaHumana {
  return { type: 'human_takeover', action, wa_id: waId };
}

/** True solo si el aviso ya trae el contrato de wake de un mensaje de cliente. */
export function tomaHumanaCompatibleConWake(aviso: AvisoTomaHumana): boolean {
  const record = aviso as unknown as Record<string, unknown>;
  return CAMPOS_WAKE_OBLIGATORIOS.every(
    campo => typeof record[campo] === 'string' && record[campo] !== ''
  );
}

export function estadoInboundWhatsApp(pausado: boolean): 'human_paused' | 'pending_agent' {
  return pausado ? 'human_paused' : 'pending_agent';
}
