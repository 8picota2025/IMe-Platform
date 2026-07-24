import type { AccionHandoff, MensajeAsesor, ProductoSugerido } from './asesor';
import type { Locale } from '../i18n/utils';

const MAX_HANDOFF_TEXT_CHARS = 1800;
const MAX_CONTEXT_MESSAGE_CHARS = 320;

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, max: number): string {
  const cleaned = cleanText(value);
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function uniqueTexts(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const normalized = cleanText(value).toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function buildDetailedHandoffSummary(params: {
  handoff: AccionHandoff | null;
  historial: MensajeAsesor[];
  productos?: ProductoSugerido[];
  locale: Locale;
}): string {
  const { handoff, historial, productos = [], locale } = params;
  const userMessages = uniqueTexts(
    historial.filter(message => message.rol === 'usuario').map(message => message.contenido)
  )
    .slice(-6)
    .map(message => truncate(message, MAX_CONTEXT_MESSAGE_CHARS));
  const lastAdvisorMessage = [...historial]
    .reverse()
    .find(message => message.rol === 'asesor')?.contenido;
  const productNames = uniqueTexts(productos.map(product => product.nombre)).slice(0, 6);
  const handoffSummary = handoff?.resumen ? truncate(handoff.resumen, 1000) : '';
  const normalizedHandoffSummary = handoffSummary.toLocaleLowerCase();
  const summaryDuplicatesUserMessage = userMessages.some(
    message => cleanText(message).toLocaleLowerCase() === normalizedHandoffSummary
  );
  const summaryCoversUserContext =
    userMessages.length > 0 &&
    userMessages.every(message =>
      normalizedHandoffSummary.includes(cleanText(message).toLocaleLowerCase().slice(0, 120))
    );

  const lines =
    locale === 'en'
      ? [
          'Request started from IMEIA',
          '',
          ...(handoffSummary && !summaryDuplicatesUserMessage
            ? ['IMEIA summary:', handoffSummary, '']
            : []),
          ...(userMessages.length && !summaryCoversUserContext
            ? [
                'Needs and context provided by the customer:',
                ...userMessages.map(item => `• ${item}`),
              ]
            : []),
          ...(lastAdvisorMessage
            ? ['', 'Latest IMEIA guidance:', truncate(lastAdvisorMessage, 420)]
            : []),
          ...(productNames.length ? ['', `Products reviewed: ${productNames.join(', ')}`] : []),
        ]
      : [
          'Solicitud iniciada desde IMEIA',
          '',
          ...(handoffSummary && !summaryDuplicatesUserMessage
            ? ['Resumen de IMEIA:', handoffSummary, '']
            : []),
          ...(userMessages.length && !summaryCoversUserContext
            ? [
                'Necesidad y contexto aportados por el cliente:',
                ...userMessages.map(item => `• ${item}`),
              ]
            : []),
          ...(lastAdvisorMessage
            ? ['', 'Última orientación de IMEIA:', truncate(lastAdvisorMessage, 420)]
            : []),
          ...(productNames.length ? ['', `Productos revisados: ${productNames.join(', ')}`] : []),
        ];

  return lines.join('\n').trim().slice(0, MAX_HANDOFF_TEXT_CHARS).trim();
}

export function buildConversationTranscript(
  historial: MensajeAsesor[],
  locale: Locale,
  generatedAt = new Date()
): string {
  const title =
    locale === 'en' ? 'Full conversation with IMEIA' : 'Conversación completa con IMEIA';
  const generatedLabel = locale === 'en' ? 'Generated' : 'Generado';
  const roles =
    locale === 'en'
      ? { usuario: 'Customer', asesor: 'IMEIA' }
      : { usuario: 'Cliente', asesor: 'IMEIA' };
  const messages = historial.map(message => {
    const timestamp = Number.isNaN(message.timestamp.getTime())
      ? ''
      : `[${message.timestamp.toISOString()}] `;
    return `${timestamp}${roles[message.rol]}:\n${message.contenido.trim()}`;
  });

  return [
    title,
    `${generatedLabel}: ${generatedAt.toISOString()}`,
    '='.repeat(48),
    ...messages.flatMap(message => ['', message]),
    '',
  ].join('\n');
}

export function buildConversationFilename(locale: Locale, now = new Date()): string {
  const date = now.toISOString().replace(/[:.]/g, '-');
  return `${locale === 'en' ? 'imeia-conversation' : 'conversacion-imeia'}-${date}.txt`;
}
