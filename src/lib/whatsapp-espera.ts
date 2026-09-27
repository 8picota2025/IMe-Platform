/**
 * Reglas del mensaje de espera de IMEIA (WhatsApp y widget web).
 * Sin I/O: lo usan vitest, la Edge Function y el widget.
 *
 * El texto solo aparece cuando la respuesta real lleva más de un minuto,
 * como mucho una vez por turno y nunca ante un acuse trivial.
 */

export const WHATSAPP_HOLDING_AFTER_MS = 60_000;
/** Cadencia entre avisos al mismo cliente: unos minutos, no uno por mensaje. */
export const WHATSAPP_HOLDING_MIN_GAP_MS = 180_000;

/** Frases en «tú», cortas. La primera es la que pidió el negocio; no repetir la última enviada. */
export const MENSAJES_ESPERA_ES = [
  'Dame un momento, estoy revisando la información para responderte bien.',
  'Ya casi, estoy confirmando los detalles.',
  'Sigo con tu consulta, en breve te escribo.',
  'Un momento, estoy ordenando los datos para responderte con claridad.',
  'Sigo aquí, te escribo en cuanto tenga la respuesta.',
] as const;

export const MENSAJES_ESPERA_EN = [
  "Give me a moment, I'm checking the information so I can answer you properly.",
  "Almost there, I'm confirming the details.",
  "Still on your question, I'll write you shortly.",
  "One moment, I'm putting the details in order so the answer is clear.",
  "Still here, I'll message you as soon as I have the answer.",
] as const;

const FRASES_ACUSE = new Set([
  'ok',
  'okay',
  'okey',
  'okk',
  'vale',
  'listo',
  'gracias',
  'muchas gracias',
  'mil gracias',
  'thank you',
  'thanks',
  'thx',
  'ty',
  'perfecto',
  'dale',
]);

const PALABRAS_ACUSE = new Set([
  'ok',
  'okay',
  'okey',
  'okk',
  'vale',
  'listo',
  'gracias',
  'muchas',
  'mil',
  'thank',
  'you',
  'thanks',
  'thx',
  'ty',
  'perfecto',
  'dale',
]);

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Acuse que no merece un «sigo revisando»: ok, gracias, listo y solo emoji.
 * Una pregunta real, aunque empiece por «ok», no es acuse.
 */
export function esAcuseTrivial(texto: string): boolean {
  const recortado = texto.trim();
  if (!recortado) return true;
  const sinEmoji = recortado
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\u200d|\ufe0f/g, '')
    .trim();
  if (!sinEmoji) return true;
  const normalizado = sinEmoji
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalizado) return true;
  if (FRASES_ACUSE.has(normalizado)) return true;
  const tokens = normalizado.split(' ');
  return (
    tokens.length > 0 && tokens.length <= 4 && tokens.every(token => PALABRAS_ACUSE.has(token))
  );
}

export function elegirMensajeEspera(
  locale: 'es' | 'en',
  ultimoEnviado: string | null,
  semilla: string
): string {
  const lista = locale === 'en' ? MENSAJES_ESPERA_EN : MENSAJES_ESPERA_ES;
  const inicio = hashString(semilla) % lista.length;
  for (let i = 0; i < lista.length; i += 1) {
    const candidato = lista[(inicio + i) % lista.length];
    if (candidato && candidato !== ultimoEnviado) return candidato;
  }
  return lista[0] ?? MENSAJES_ESPERA_ES[0];
}
