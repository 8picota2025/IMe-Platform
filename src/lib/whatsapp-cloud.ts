/**
 * WhatsApp Cloud API (Meta) — verificación, parseo e idempotencia.
 * Compartido por tests (vitest) y la Edge Function `whatsapp-webhook`.
 * No inventa precios ni números de registro INVIMA.
 */

import {
  composeGroundedAsesorReply,
  esIntencionHandoffComercial,
  inferHandoffFromUserIntent,
  type CatalogGroundingProduct,
} from './asesor-guardrails';
import { buildAsesorStaticFallback, esConsultaSitioOLegal } from './asesor-knowledge';
import { IME_WHATSAPP_DISPLAY, IME_WHATSAPP_E164 } from './contacto-oficial';

export const IME_COTIZACION_URL = 'https://i-me.com.co/es/contacto/';
export const WHATSAPP_DEFAULT_API_VERSION = 'v21.0';
export const WHATSAPP_TEXT_MAX_CHARS = 4096;

const RADIOLOGY_RE =
  /\b(radiolog[ií]a|rayos?\s*x|\brx\b|tomograf[ií]a|\btac\b|mamograf|fluoroscop|cbct|sala de (imagen|rayos))\b/i;

export const RADIOLOGY_QUOTE_SCOPE_ES =
  'En radiología, la cotización cubre el equipo y la instalación del equipo. No incluye adecuación de sala, transformadores, ventilación ni obras de infraestructura.';

export const RADIOLOGY_QUOTE_SCOPE_EN =
  'For radiology, the quote covers the equipment and equipment installation only. It does not include room upgrades, transformers, ventilation or facility civil works.';

export type WhatsAppLocale = 'es' | 'en';

export interface WhatsAppChallengeParams {
  mode: string | null;
  token: string | null;
  challenge: string | null;
  expectedToken: string;
}

export interface InboundWhatsAppText {
  wamid: string;
  from: string;
  text: string;
  timestamp: string;
  phoneNumberId: string | null;
  contactName: string | null;
  isGroup: boolean;
  type: string;
}

export interface WhatsAppStatusEvent {
  wamid: string;
  status: string;
  recipientId: string | null;
}

export interface ParsedWhatsAppWebhook {
  object: string | null;
  texts: InboundWhatsAppText[];
  statuses: WhatsAppStatusEvent[];
  ignored: Array<{ reason: string; wamid?: string }>;
}

export type WamidClaimResult = 'claimed' | 'duplicate';

export interface WamidClaimStore {
  claim(wamid: string): Promise<WamidClaimResult>;
}

export class MemoryWamidStore implements WamidClaimStore {
  private readonly seen = new Set<string>();

  async claim(wamid: string): Promise<WamidClaimResult> {
    const id = wamid.trim();
    if (!id) return 'duplicate';
    if (this.seen.has(id)) return 'duplicate';
    this.seen.add(id);
    return 'claimed';
  }

  has(wamid: string): boolean {
    return this.seen.has(wamid.trim());
  }
}

export type WhatsAppInboundDecision =
  | { action: 'ignore'; reason: string; wamid?: string }
  | { action: 'reply'; message: InboundWhatsAppText };

export interface WhatsAppGraphConfig {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
}

export interface SendWhatsAppTextParams {
  to: string;
  body: string;
  token: string;
  phoneNumberId: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}

export interface SendWhatsAppTextResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  status?: number;
}

export interface ComposeWhatsAppImeiaParams {
  mensaje: string;
  locale?: WhatsAppLocale;
  products?: CatalogGroundingProduct[];
}

export interface ComposedWhatsAppImeiaReply {
  texto: string;
  modo: 'rag' | 'keyword_degradado' | 'sin_resultados' | 'estatico';
  slugs: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function timingSafeEqualString(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const len = Math.max(a.length, b.length, 1);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeSignatureHeader(header: string): string {
  const trimmed = header.trim();
  return trimmed.toLowerCase().startsWith('sha256=') ? trimmed.slice(7) : trimmed;
}

export async function computeWhatsAppSignatureHex(
  rawBody: string,
  appSecret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return bytesToHex(mac);
}

/**
 * Verifica `X-Hub-Signature-256`. Si `appSecret` está vacío, no hay secreto
 * configurado: el caller decide si omite la verificación (local) o rechaza.
 */
export async function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!appSecret || !signatureHeader) return false;
  const expected = normalizeSignatureHeader(signatureHeader);
  if (!/^[0-9a-f]+$/i.test(expected)) return false;
  const computed = await computeWhatsAppSignatureHex(rawBody, appSecret);
  return timingSafeEqualString(computed, expected.toLowerCase());
}

export function verifyWhatsAppChallenge(
  params: WhatsAppChallengeParams
): { ok: true; challenge: string } | { ok: false } {
  if (!params.expectedToken) return { ok: false };
  if (params.mode !== 'subscribe') return { ok: false };
  if (!params.challenge) return { ok: false };
  if (!timingSafeEqualString(params.token ?? '', params.expectedToken)) return { ok: false };
  return { ok: true, challenge: params.challenge };
}

export function esConsultaRadiologia(texto: string): boolean {
  return RADIOLOGY_RE.test(texto);
}

export function detectarLocaleWhatsApp(texto: string): WhatsAppLocale {
  const englishHits = (
    texto.match(/\b(the|what|price|quote|which|hello|please|need|equipment)\b/gi) ?? []
  ).length;
  const spanishHits = (
    texto.match(/\b(el|la|qué|precio|cotizaci[oó]n|hola|equipo|necesito|cuál)\b/gi) ?? []
  ).length;
  return englishHits > spanishHits ? 'en' : 'es';
}

function isGroupMessage(raw: Record<string, unknown>): boolean {
  if (asString(raw.group_id).trim()) return true;
  const context = asRecord(raw.context);
  if (context && asString(context.group_id).trim()) return true;
  const from = asString(raw.from);
  return /@g\.us\b/i.test(from) || from.includes('-');
}

export function parseWhatsAppWebhook(payload: unknown): ParsedWhatsAppWebhook {
  const root = asRecord(payload);
  const object = root ? asString(root.object) || null : null;
  const texts: InboundWhatsAppText[] = [];
  const statuses: WhatsAppStatusEvent[] = [];
  const ignored: Array<{ reason: string; wamid?: string }> = [];

  if (!root || object !== 'whatsapp_business_account') {
    return { object, texts, statuses, ignored: [...ignored, { reason: 'not_whatsapp' }] };
  }

  const entries = Array.isArray(root.entry) ? root.entry : [];
  for (const entry of entries) {
    const entryObj = asRecord(entry);
    if (!entryObj) continue;
    const changes = Array.isArray(entryObj.changes) ? entryObj.changes : [];
    for (const change of changes) {
      const changeObj = asRecord(change);
      const value = changeObj ? asRecord(changeObj.value) : null;
      if (!value) continue;

      const metadata = asRecord(value.metadata);
      const phoneNumberId = metadata ? asString(metadata.phone_number_id) || null : null;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const firstContact = asRecord(contacts[0]);
      const profile = firstContact ? asRecord(firstContact.profile) : null;
      const contactName = profile ? asString(profile.name) || null : null;

      const statusRows = Array.isArray(value.statuses) ? value.statuses : [];
      for (const row of statusRows) {
        const statusObj = asRecord(row);
        if (!statusObj) continue;
        const wamid = asString(statusObj.id).trim();
        if (!wamid) continue;
        statuses.push({
          wamid,
          status: asString(statusObj.status) || 'unknown',
          recipientId: asString(statusObj.recipient_id) || null,
        });
      }

      const messageRows = Array.isArray(value.messages) ? value.messages : [];
      for (const row of messageRows) {
        const message = asRecord(row);
        if (!message) continue;
        const wamid = asString(message.id).trim();
        const from = asString(message.from).replace(/\D/g, '');
        const type = asString(message.type) || 'unknown';
        if (!wamid || !from) {
          ignored.push(
            wamid ? { reason: 'malformed_message', wamid } : { reason: 'malformed_message' }
          );
          continue;
        }
        if (isGroupMessage(message)) {
          ignored.push({ reason: 'group', wamid });
          continue;
        }
        if (type !== 'text') {
          ignored.push({ reason: `unsupported_type:${type}`, wamid });
          continue;
        }
        const textObj = asRecord(message.text);
        const text = asString(textObj?.body).trim();
        if (!text) {
          ignored.push({ reason: 'empty_text', wamid });
          continue;
        }
        texts.push({
          wamid,
          from,
          text: text.slice(0, 2000),
          timestamp: asString(message.timestamp),
          phoneNumberId,
          contactName,
          isGroup: false,
          type,
        });
      }
    }
  }

  return { object, texts, statuses, ignored };
}

export function isStatusOnlyWebhook(parsed: ParsedWhatsAppWebhook): boolean {
  return parsed.texts.length === 0 && parsed.statuses.length > 0;
}

export function isOwnBusinessNumber(from: string, ownWaId = IME_WHATSAPP_E164): boolean {
  return from.replace(/\D/g, '') === ownWaId.replace(/\D/g, '');
}

export async function decideWhatsAppInbound(
  parsed: ParsedWhatsAppWebhook,
  store: WamidClaimStore,
  options: { ownWaId?: string } = {}
): Promise<WhatsAppInboundDecision[]> {
  const decisions: WhatsAppInboundDecision[] = [];
  if (parsed.object !== 'whatsapp_business_account') {
    return [{ action: 'ignore', reason: 'not_whatsapp' }];
  }
  if (isStatusOnlyWebhook(parsed)) {
    return [{ action: 'ignore', reason: 'status_only' }];
  }

  for (const skip of parsed.ignored) {
    decisions.push(
      skip.wamid
        ? { action: 'ignore', reason: skip.reason, wamid: skip.wamid }
        : { action: 'ignore', reason: skip.reason }
    );
  }

  for (const message of parsed.texts) {
    if (message.isGroup) {
      decisions.push({ action: 'ignore', reason: 'group', wamid: message.wamid });
      continue;
    }
    if (isOwnBusinessNumber(message.from, options.ownWaId)) {
      decisions.push({ action: 'ignore', reason: 'own_number', wamid: message.wamid });
      continue;
    }
    const claim = await store.claim(message.wamid);
    if (claim === 'duplicate') {
      decisions.push({ action: 'ignore', reason: 'duplicate_wamid', wamid: message.wamid });
      continue;
    }
    decisions.push({ action: 'reply', message });
  }

  if (decisions.length === 0) {
    decisions.push({ action: 'ignore', reason: 'empty' });
  }
  return decisions;
}

export function toWhatsAppPlainText(markdown: string): string {
  const converted = markdown
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 — $2')
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return converted.slice(0, WHATSAPP_TEXT_MAX_CHARS);
}

export function composeWhatsAppImeiaReply(
  params: ComposeWhatsAppImeiaParams
): ComposedWhatsAppImeiaReply {
  const mensaje = params.mensaje.trim();
  const locale: WhatsAppLocale = params.locale ?? detectarLocaleWhatsApp(mensaje);
  const products = params.products ?? [];

  let texto: string;
  let modo: ComposedWhatsAppImeiaReply['modo'];
  let slugs: string[] = [];

  if (esConsultaSitioOLegal(mensaje)) {
    texto =
      buildAsesorStaticFallback(locale, mensaje) ??
      (locale === 'en'
        ? `This is I-ME WhatsApp Business (${IME_WHATSAPP_DISPLAY}). How can we help your institution?`
        : `Este es el WhatsApp Business de I-ME (${IME_WHATSAPP_DISPLAY}). ¿En qué podemos orientar a su institución?`);
    modo = 'estatico';
  } else {
    const composed = composeGroundedAsesorReply({
      locale,
      mensaje,
      products,
    });
    texto = composed.texto;
    slugs = composed.slugs;
    modo = composed.modo;
  }

  if (esConsultaRadiologia(mensaje)) {
    texto = `${texto}\n\n${locale === 'en' ? RADIOLOGY_QUOTE_SCOPE_EN : RADIOLOGY_QUOTE_SCOPE_ES}`;
  }

  const wantsQuoteForm =
    inferHandoffFromUserIntent(mensaje) === 'cotizacion' ||
    esIntencionHandoffComercial(mensaje) ||
    esConsultaRadiologia(mensaje);
  if (wantsQuoteForm && !texto.includes(IME_COTIZACION_URL)) {
    const cta =
      locale === 'en'
        ? `Formal quote form: ${IME_COTIZACION_URL}`
        : `Formulario de cotización: ${IME_COTIZACION_URL}`;
    texto = `${texto}\n\n${cta}`;
  }

  return { texto: toWhatsAppPlainText(texto), modo, slugs };
}

export function resolveWhatsAppGraphConfig(
  env: Record<string, string | undefined>
): WhatsAppGraphConfig | null {
  const token = env.WHATSAPP_TOKEN?.trim() ?? '';
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? '';
  const apiVersion = env.WHATSAPP_API_VERSION?.trim() || WHATSAPP_DEFAULT_API_VERSION;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, apiVersion };
}

export function buildWhatsAppMessagesUrl(phoneNumberId: string, apiVersion?: string): string {
  const version = (apiVersion ?? WHATSAPP_DEFAULT_API_VERSION).replace(/^\/+|\/+$/g, '');
  const id = phoneNumberId.replace(/^\/+|\/+$/g, '');
  return `https://graph.facebook.com/${version}/${id}/messages`;
}

export async function sendWhatsAppText(
  params: SendWhatsAppTextParams
): Promise<SendWhatsAppTextResult> {
  const body = params.body.trim().slice(0, WHATSAPP_TEXT_MAX_CHARS);
  const to = params.to.replace(/\D/g, '');
  if (!body || !to) return { ok: false, error: 'missing_to_or_body' };

  const url = buildWhatsAppMessagesUrl(params.phoneNumberId, params.apiVersion);
  const fetchImpl = params.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  });

  const payload: unknown = await res.json().catch(() => null);
  const record = asRecord(payload);
  const messages = record && Array.isArray(record.messages) ? record.messages : [];
  const first = asRecord(messages[0]);
  const messageId = first ? asString(first.id) : '';
  if (!res.ok) {
    const errorObj = record ? asRecord(record.error) : null;
    return {
      ok: false,
      status: res.status,
      error: errorObj ? asString(errorObj.message) || `HTTP ${res.status}` : `HTTP ${res.status}`,
    };
  }
  return messageId ? { ok: true, status: res.status, messageId } : { ok: true, status: res.status };
}

export async function markWhatsAppMessageRead(params: {
  wamid: string;
  token: string;
  phoneNumberId: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const wamid = params.wamid.trim();
  if (!wamid) return false;
  const url = buildWhatsAppMessagesUrl(params.phoneNumberId, params.apiVersion);
  const fetchImpl = params.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: wamid,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function sampleInboundTextPayload(params: {
  wamid: string;
  from: string;
  text: string;
  phoneNumberId?: string;
}): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '573137247353',
                phone_number_id: params.phoneNumberId ?? 'PHONE_NUMBER_ID',
              },
              contacts: [{ profile: { name: 'IPS Demo' }, wa_id: params.from }],
              messages: [
                {
                  from: params.from,
                  id: params.wamid,
                  timestamp: '1710000000',
                  type: 'text',
                  text: { body: params.text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function sampleStatusOnlyPayload(wamid = 'wamid.status.1'): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '573137247353',
                phone_number_id: 'PHONE_NUMBER_ID',
              },
              statuses: [
                {
                  id: wamid,
                  status: 'delivered',
                  timestamp: '1710000001',
                  recipient_id: '573001112233',
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
