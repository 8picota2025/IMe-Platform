/**
 * Guardrails e intención de handoff de IMEIA.
 * Compartido por la Edge Function `asesor` (Deno) y el cliente web.
 * No inventa precios ni números de registro INVIMA.
 */

import { IME_WHATSAPP_DISPLAY } from './contacto-oficial.ts';

export type TipoHandoffAsesor = 'whatsapp' | 'cotizacion';

export interface AccionHandoffAsesor {
  tipo: TipoHandoffAsesor;
  resumen: string;
}

export const MAX_HANDOFF_SUMMARY_CHARS = 400;

/** Tope de salida: WhatsApp-length; JSON largo degrada latencia. */
export const IMEIA_MAX_TOKENS = 1400;

/** Abort si el LLM no responde (xAI / túnel). */
export const IMEIA_TIMEOUT_MS = 110_000;

/** Modelo Grok de chat (xAI). El mismo rol que el bot de WhatsApp Business. */
export const IMEIA_GROK_DEFAULT_MODEL = 'grok-4';

export const XAI_API_DEFAULT_URL = 'https://api.x.ai';

/** Modelos del agente Hermes que cargan SOUL.md / skills IMEIA. No usar. */
const IMEIA_SOUL_MODELS = new Set(['imeia', 'imeia-soul', 'imeia-agent', 'imeia-ayuda']);

export const IMEIA_SOUL_OVERRIDE = `SOUL OVERRIDE: No uses el agente IMEIA de Hermes ni su SOUL, skills, memoria o persona por defecto. Esas instrucciones no aplican. Responde como IMEIA, el mismo rol comercial que atiende el WhatsApp Business de I-ME.`;

export type AsesorLlmProvider = 'xai' | 'openai_compat';

export interface AsesorLlmUpstream {
  provider: AsesorLlmProvider;
  url: string;
  key: string;
  model: string;
}

export interface CatalogGroundingProduct {
  slug: string;
  nombre: string;
  descripcion_corta?: string | null;
  url_canonica?: string | null;
}

export interface GroundedAsesorReply {
  texto: string;
  slugs: string[];
  modo: 'rag' | 'keyword_degradado' | 'sin_resultados';
}

export function isImeiaSoulModel(model: string | null | undefined): boolean {
  const normalized = (model ?? '').trim().toLowerCase();
  return !normalized || IMEIA_SOUL_MODELS.has(normalized);
}

/** Modelo raw para /v1/chat/completions. Vacío o soul = no llamar a Hermes. */
export function resolveImeiaCompletionModel(raw?: string | null): string | null {
  const model = (raw ?? '').trim();
  if (isImeiaSoulModel(model)) return null;
  return model;
}

/** En xAI, vacío o soul se sustituye por Grok; nunca se llama al agente `imeia`. */
export function resolveGrokChatModel(raw?: string | null): string {
  const model = (raw ?? '').trim();
  if (!model || IMEIA_SOUL_MODELS.has(model.toLowerCase())) return IMEIA_GROK_DEFAULT_MODEL;
  return model;
}

export function isXaiCompatibleUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'api.x.ai' || host.endsWith('.x.ai');
  } catch {
    return false;
  }
}

/**
 * Preferencia: XAI_API_KEY → Grok (rol WhatsApp).
 * Si IMEIA_API_URL ya apunta a api.x.ai, se trata igual.
 * Hermes/OpenAI-compat solo si hay modelo raw (nunca `imeia`).
 */
export function resolveAsesorLlmUpstream(env: {
  XAI_API_KEY?: string | null;
  XAI_API_URL?: string | null;
  IMEIA_API_URL?: string | null;
  IMEIA_API_KEY?: string | null;
  IMEIA_CHAT_MODEL?: string | null;
}): AsesorLlmUpstream | null {
  const xaiKey = env.XAI_API_KEY?.trim();
  const imeiaUrl = env.IMEIA_API_URL?.replace(/\/$/, '').trim();
  const imeiaKey = env.IMEIA_API_KEY?.trim();
  const requested = env.IMEIA_CHAT_MODEL;

  if (xaiKey) {
    const url = env.XAI_API_URL?.replace(/\/$/, '').trim() || XAI_API_DEFAULT_URL;
    return {
      provider: 'xai',
      url,
      key: xaiKey,
      model: resolveGrokChatModel(requested),
    };
  }

  if (imeiaUrl && imeiaKey && isXaiCompatibleUrl(imeiaUrl)) {
    return {
      provider: 'xai',
      url: imeiaUrl,
      key: imeiaKey,
      model: resolveGrokChatModel(requested),
    };
  }

  if (imeiaUrl && imeiaKey) {
    const model = resolveImeiaCompletionModel(requested);
    if (!model) return null;
    return {
      provider: 'openai_compat',
      url: imeiaUrl,
      key: imeiaKey,
      model,
    };
  }

  return null;
}

export function buildImeiaCompletionPayload(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  provider?: AsesorLlmProvider;
}): Record<string, unknown> {
  if (isImeiaSoulModel(params.model)) {
    throw new Error('imeia_soul_model_forbidden');
  }
  const payload: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? (params.provider === 'xai' ? 0.4 : 0.25),
    max_tokens: params.maxTokens ?? IMEIA_MAX_TOKENS,
    stream: false,
  };
  if (params.provider !== 'xai') {
    payload.soul = false;
    payload.use_soul = false;
    payload.agent = false;
    payload.tools = [];
  }
  return payload;
}

const PRICE_INTENT_RE =
  /\b(precio|precios|cu[aá]nto (cuesta|vale|sale)|what(?:'?s| is) the price|valor (del|de la|de los)|costo|coste|quote|pricing|cotizaci[oó]n|cotizar|cotizarle)\b/i;

const FINANCING_INTENT_RE =
  /\b(financiaci[oó]n|financiamiento|financiar|cuotas?|leasing|cr[eé]dito(?:s)?|plazos? de (pago|financi)|tasa(?:s)? de inter[eé]s|payment plan|installments?)\b/i;

const AVAILABILITY_PURCHASE_RE =
  /\b(disponibilidad|stock|hay existencias|available|availability|comprar|compra(rlo|rme)?|pedido|orden de compra|begin checkout)\b/i;

const INSTALL_WARRANTY_DOCS_RE =
  /\b(instalaci[oó]n|puesta en marcha|garant[ií]a|warranty|soporte documental|ficha t[eé]cnica oficial|manual (oficial|del fabricante))\b/i;

/**
 * Pedido de RS / registro por SKU — no orientación general INVIMA.
 * "qué es INVIMA" o "clasificación de riesgo" NO disparan handoff.
 */
const INVIMA_SKU_INTENT_RE =
  /\b((n[uú]mero|codigo|c[oó]digo) (de )?(registro|rs)|registro sanitario (del|de la|de este|del producto|de la referencia)|n[uú]mero invima|invima (del|de la|de este) |\brs\b.{0,40}invima|invima.{0,40}\brs\b|est[aá] registrado (en )?invima|certificado invima (del|de la|de este))\b/i;

const WHATSAPP_CONTACT_RE =
  /\b(whats?app|asesor comercial|sales team|hablar con (un )?(asesor|humano|comercial)|contactar(nos|me)?|ll[aá]men(me|os))\b/i;

const ASSISTANT_WHATSAPP_RE = /whatsapp/i;
const ASSISTANT_QUOTE_RE = /cotizaci[oó]n|cotizarle|solicitud de cotizaci|request a quote/i;

export function esIntencionPrecio(texto: string): boolean {
  return PRICE_INTENT_RE.test(texto);
}

export function esIntencionFinanciacion(texto: string): boolean {
  return FINANCING_INTENT_RE.test(texto);
}

export function esIntencionInvimaSku(texto: string): boolean {
  return INVIMA_SKU_INTENT_RE.test(texto);
}

export function esIntencionHandoffComercial(texto: string): boolean {
  return (
    esIntencionPrecio(texto) ||
    esIntencionFinanciacion(texto) ||
    esIntencionInvimaSku(texto) ||
    AVAILABILITY_PURCHASE_RE.test(texto) ||
    INSTALL_WARRANTY_DOCS_RE.test(texto) ||
    WHATSAPP_CONTACT_RE.test(texto)
  );
}

export function inferHandoffFromUserIntent(mensaje: string): TipoHandoffAsesor | null {
  if (WHATSAPP_CONTACT_RE.test(mensaje) || esIntencionInvimaSku(mensaje)) return 'whatsapp';
  if (
    esIntencionPrecio(mensaje) ||
    esIntencionFinanciacion(mensaje) ||
    AVAILABILITY_PURCHASE_RE.test(mensaje) ||
    INSTALL_WARRANTY_DOCS_RE.test(mensaje)
  ) {
    return 'cotizacion';
  }
  return null;
}

export function inferHandoffFromAssistantText(texto: string): TipoHandoffAsesor | null {
  if (ASSISTANT_WHATSAPP_RE.test(texto)) return 'whatsapp';
  if (ASSISTANT_QUOTE_RE.test(texto)) return 'cotizacion';
  return null;
}

export function recortarResumenHandoff(resumen: string): string {
  return resumen.trim().slice(0, MAX_HANDOFF_SUMMARY_CHARS);
}

/**
 * Hermes decide primero (menciona WhatsApp/cotización).
 * Si no lo hace, la intención del usuario cubre precio / INVIMA-SKU / financiación.
 */
export function detectarAccionHandoff(params: {
  mensaje: string;
  texto: string;
  resumen?: string;
}): AccionHandoffAsesor | null {
  const tipo =
    inferHandoffFromAssistantText(params.texto) ?? inferHandoffFromUserIntent(params.mensaje);
  if (!tipo) return null;
  const resumen = recortarResumenHandoff(params.resumen || params.mensaje);
  return { tipo, resumen };
}

export function clasificarFalloImeia(
  err: unknown
): 'timeout' | 'empty' | 'upstream_http' | 'error' {
  if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
    return 'timeout';
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/abort|timeout|timed out/i.test(message)) return 'timeout';
  if (/sin contenido|empty/i.test(message)) return 'empty';
  if (/HTTP\s+\d+/i.test(message)) return 'upstream_http';
  return 'error';
}

function buildSharedGuardrailRules(): string {
  return `Identidad (rol WhatsApp Business de I-ME):
- Eres IMEIA, ingeniera de ventas biomédicas de I-ME International Medical Enterprise (Colombia).
- Hablas como en el WhatsApp que ya funciona bien: cercana, amigable, documentada, con autoridad de ingeniera senior. Primera persona del plural. Sin jerga de chatbot.
- Público: IPS, hospitales, clínicas, ingeniería biomédica, compras institucionales y habilitaciones.
- No eres un buscador de SKUs ni un volcado de catálogo. Sondea la necesidad (servicio, uso previsto, volumen, restricción) y recomienda con argumento.
- Giros naturales cuando aporten, no en cada frase: "Dado mi conocimiento del sector…", "Desde la experiencia, le recomiendo…", "Técnicamente hablando…".
- Representas la propuesta de valor I-ME: tecnología + ingenieros formados por casa matriz + postventa + continuidad operativa. No inventes plazos, stock, precios, garantías numéricas ni RS.

Prohibido:
- Diagnóstico, indicación terapéutica, dosificación o instrucciones clínicas de tratamiento.
- Inventar productos, specs, stock, plazos, garantías, CE/FDA o condiciones comerciales.
- Inventar número de registro sanitario INVIMA (RS), vigencia, titular o estado de un SKU.
- Precio comprometido, tasa de financiación o plazo de entrega vinculante.

INVIMA y catálogo público:
- Sí puedes orientar clasificación de riesgo, tecnovigilancia, documentación del fabricante y ruta general (p. ej. Decreto 4725) como guía no vinculante.
- Si piden RS/INVIMA de un SKU concreto, precio, financiación, stock o condiciones vinculantes: dilo con claridad y escala. No completes el dato.
- Solo afirma lo que aparezca en canonical_product_context, query_catalog_context o documentación recuperada. Si no está, márcalo pendiente de confirmación con I-ME.
- Alinea claims con el catálogo público y llms.txt: confirmar con I-ME antes de tratar specs, precio o disponibilidad como hechos.

Handoff (obligatorio cuando aplique):
- Precio, disponibilidad, compra, instalación, garantía, financiación o RS/INVIMA de un SKU → ofrece cotización web o WhatsApp ${IME_WHATSAPP_DISPLAY}.
- Menciona explícitamente "WhatsApp" o "cotización" para que la web muestre el CTA.
- El resumen de derivación debe servir al comercial: institución/servicio, uso previsto, productos vistos, restricción y dato pendiente.

Método (estilo WhatsApp, no ensayo):
- Párrafos cortos, como un chat. Máximo 1-2 preguntas de descubrimiento por turno.
- Compara de verdad 1-3 opciones del contexto (clínica, operativa, de servicio). No listes 4 fichas sin criterio.
- Si el cliente nombra un competidor, compara I-ME vs esa referencia con honestidad. Si no lo nombra, no inventes marcas ajenas.
- SHORTLIST STICKY: "cuál de esos / el más completo / compara esos" → solo anchors ya dados. Prohibido saltar de línea.
- Tras recomendar o elegir ganador, cierra con CTA proporcional, sin presión.
- Ante riesgo para el paciente: protocolo institucional / manual del fabricante; no instrucciones invasivas.
- Si no está en el contexto: "No tengo ese dato confirmado; le conecto con un compañero por WhatsApp."`;
}

export function buildImeiaRuntimeSystemPrompt(locale: 'es' | 'en'): string {
  const idioma =
    locale === 'en'
      ? 'ingles si el usuario escribe en ingles; si no, usa el idioma del usuario'
      : 'espanol salvo que el usuario use otro idioma';
  return `${IMEIA_SOUL_OVERRIDE}

Canal: widget IMEIA Ayuda en i-me.com.co. Mismo rol y voz que el bot Grok de WhatsApp Business.
Responde en ${idioma}.
Usa solo el contexto de catálogo que acompaña este turno. No inventes SKUs.

${buildSharedGuardrailRules()}`;
}

export function buildImeiaTransportSystemPrompt(): string {
  return `${IMEIA_SOUL_OVERRIDE}

Eres IMEIA en el mismo rol que WhatsApp Business. No uses el SOUL/skills de Hermes. Adapta esa voz al JSON de la web.

${buildSharedGuardrailRules()}

FORMATO DE RESPUESTA:
Devuelve únicamente JSON válido:
{
  "texto": "respuesta útil y natural en el idioma del usuario",
  "productos_citados": ["slug-1"],
  "accion_handoff": {"tipo": "whatsapp"|"cotizacion", "resumen": "breve resumen útil"} | null
}
- "productos_citados": solo slugs reales del catálogo cuando correspondan.
- "accion_handoff": null si no hace falta derivación; si hay precio/INVIMA-SKU/financiación, no lo dejes null.
/no_think`;
}

export function buildAsesorLocalSystemPrompt(): string {
  return `${IMEIA_SOUL_OVERRIDE}

Eres IMEIA, el mismo rol comercial de WhatsApp Business de I-ME International Medical Enterprise.

${buildSharedGuardrailRules()}

FORMATO DE RESPUESTA (obligatorio):
Responde UNICAMENTE con JSON valido, sin texto adicional antes ni despues:
{
  "texto": "respuesta util y concreta en el idioma del usuario",
  "productos_citados": ["slug-1"],
  "accion_handoff": {"tipo": "whatsapp"|"cotizacion", "resumen": "breve resumen de la necesidad"} | null
}
- "productos_citados": solo slugs del CONTEXTO RECUPERADO, [] si no aplica.
- "accion_handoff": no lo dejes null ante precio, compra, disponibilidad, RS/INVIMA de un SKU, garantia, instalacion o financiacion.
/no_think`;
}

export function imeiaPromptEvalChecks(prompt: string): string[] {
  const missing: string[] = [];
  if (!/SOUL OVERRIDE/i.test(prompt) && !/No uses el agente IMEIA/i.test(prompt)) {
    missing.push('soul_override');
  }
  if (!/no invent/i.test(prompt) && !/NUNCA invent/i.test(prompt) && !/Inventar/i.test(prompt)) {
    missing.push('prohibicion_inventar');
  }
  if (!/INVIMA/i.test(prompt) || !/\bRS\b|registro sanitario/i.test(prompt)) {
    missing.push('invima_rs');
  }
  if (!prompt.includes(IME_WHATSAPP_DISPLAY)) missing.push('whatsapp_oficial');
  if (!/diagn[oó]stico/i.test(prompt)) missing.push('no_diagnostico');
  if (!/financi/i.test(prompt)) missing.push('financiacion');
  if (!/precio/i.test(prompt)) missing.push('precio');
  return missing;
}

export function composeGroundedAsesorReply(params: {
  locale: 'es' | 'en';
  mensaje: string;
  products: CatalogGroundingProduct[];
  stickyFollowUp?: boolean;
  pageProductName?: string | null;
}): GroundedAsesorReply {
  const products = params.products.slice(0, 4);
  const slugs = products.map(product => product.slug).filter(Boolean);
  const en = params.locale === 'en';
  const cta = en
    ? `If you need a confirmed price, INVIMA sanitary registration (RS) for a specific SKU, financing or availability, we prepare a quote or continue on WhatsApp (${IME_WHATSAPP_DISPLAY}). We do not invent those figures.`
    : `Si necesita precio confirmado, registro sanitario INVIMA (RS) de un SKU, financiación o disponibilidad, armamos la cotización o seguimos por WhatsApp (${IME_WHATSAPP_DISPLAY}). No inventamos esos datos.`;

  if (products.length === 0) {
    const focus = params.pageProductName?.trim();
    const texto = en
      ? [
          focus
            ? `I can help qualify ${focus} from the published I-ME catalog.`
            : 'I can help qualify the biomedical need from the published I-ME catalog.',
          'Share the clinical service, intended use and any must-have specification. I will not invent models, INVIMA RS numbers, stock or binding prices.',
          cta,
        ].join('\n\n')
      : [
          focus
            ? `Puedo ayudarle a cualificar ${focus} con el catálogo publicado de I-ME.`
            : 'Puedo ayudarle a cualificar la necesidad biomédica con el catálogo publicado de I-ME.',
          'Indique servicio clínico, uso previsto y alguna especificación imprescindible. No invento modelos, números de registro INVIMA, stock ni precios vinculantes.',
          cta,
        ].join('\n\n');
    return { texto, slugs: [], modo: 'sin_resultados' };
  }

  const lineas = products.map((product, index) => {
    const detalle = product.descripcion_corta?.trim() || product.slug;
    const url = product.url_canonica?.trim();
    const nombre = url ? `[${product.nombre}](${url})` : `**${product.nombre}**`;
    return `${index + 1}. ${nombre} — ${detalle}`;
  });

  if (params.stickyFollowUp) {
    const winner = products[0]!;
    const texto = en
      ? [
          `Of the options already on the table, I would stay with **${winner.nombre}** for the need you described. I am not introducing another product line.`,
          '',
          'Same shortlist:',
          ...lineas,
          '',
          cta,
        ].join('\n')
      : [
          `De las opciones que ya están sobre la mesa, me quedaría con **${winner.nombre}** para lo que plantea. No cambio de línea.`,
          '',
          'Misma shortlist:',
          ...lineas,
          '',
          cta,
        ].join('\n');
    return { texto, slugs, modo: 'rag' };
  }

  const apertura = en
    ? 'From the published catalog, these references match what you asked — descriptions only, no invented specs or INVIMA RS numbers:'
    : 'En el catálogo publicado, estas referencias encajan con lo que consulta — solo descripción publicada, sin specs ni RS INVIMA inventados:';

  const texto = [apertura, '', ...lineas, '', cta].join('\n');
  return { texto, slugs, modo: products.length ? 'keyword_degradado' : 'sin_resultados' };
}
