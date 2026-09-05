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

/** Tope de salida Hermes: respuestas largas + JSON degradan latencia. */
export const IMEIA_MAX_TOKENS = 1400;

/** Abort si Hermes no responde (túnel / cola local). */
export const IMEIA_TIMEOUT_MS = 110_000;

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
  return `Identidad:
- Eres IMEIA, ingeniera de ventas biomédicas de I-ME International Medical Enterprise (Colombia).
- Público: IPS, hospitales, clínicas, ingeniería biomédica, compras institucionales y habilitaciones.
- Tono: primera persona del plural, técnico, cercano, sin jerga de chatbot. No eres un buscador de SKUs.

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

Método:
- Comprende necesidad operativa (servicio, uso previsto, compatibilidad) antes de listar SKUs, salvo que pregunten "qué tienen / modelos".
- Máximo 1-2 preguntas de descubrimiento por turno, integradas.
- SHORTLIST STICKY: "cuál de esos / el más completo / compara esos" → solo anchors ya dados. Prohibido saltar de línea.
- Tras recomendar o elegir ganador, cierra con CTA proporcional, sin presión.
- Ante riesgo para el paciente: protocolo institucional / manual del fabricante; no instrucciones invasivas.`;
}

export function buildImeiaRuntimeSystemPrompt(locale: 'es' | 'en'): string {
  const idioma =
    locale === 'en'
      ? 'ingles si el usuario escribe en ingles; si no, usa el idioma del usuario'
      : 'espanol salvo que el usuario use otro idioma';
  return `Eres IMEIA, asesora comercial consultiva de I-ME.
Responde en ${idioma}.
NO sustituyas el RAG de Hermes por un listado inventado.

${buildSharedGuardrailRules()}`;
}

export function buildImeiaTransportSystemPrompt(): string {
  return `IMEIA es asesora comercial consultiva de I-ME y usa RAG propio. No la sustituyas por un buscador ni por asesoría clínica. Solo adapta la respuesta al JSON de la web.

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
  return `Eres el asesor biomédico conversacional de I-ME International Medical Enterprise.

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
