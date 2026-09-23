/**
 * Redacción de PII de alta confianza (email, teléfono) en texto libre —
 * ADR-0017. Aplicado a `asesor_agent_turns.mensaje`/`historial` antes de
 * persistir y antes de reenviar al agente externo (`despertarAgente` en
 * `asesor/index.ts`).
 *
 * Alcance deliberadamente limitado a patrones con regex confiable (email,
 * teléfono CO/internacional). NO intenta redactar nombres propios — un
 * detector de nombres por regex da falsos negativos silenciosos, que es
 * peor que no prometer redacción de nombres en absoluto. El dato de
 * contacto real para seguimiento comercial ya viaja por un canal separado
 * y consentido (`registrar-lead-comercial`), no se extrae de este chat —
 * redactar aquí no reduce capacidad de captación de leads.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Telefonos, con patrones deliberadamente estrechos: un patron generico de
// "7-15 digitos" se comia precios (1.500.000), NITs, fechas y referencias de
// producto, y el texto redactado es lo que recibe el agente IMEIA — perder
// esos datos degrada las respuestas comerciales. Se redacta solo:
// - movil CO: 3XX XXX XXXX (10 digitos), opcional +57 / 57 delante;
// - fijo CO (marcacion 2021+): 60X XXX XXXX, opcional (60X) y +57;
// - internacional explicito: "+" seguido de 8-15 digitos con separadores.
const SEP = String.raw`[\s.-]?`;
const CO_PREFIX = String.raw`(?:\+?57${SEP})?`;
const CO_MOBILE = String.raw`3\d{2}${SEP}\d{3}${SEP}\d{4}`;
const CO_LANDLINE = String.raw`\(?60\d\)?${SEP}\d{3}${SEP}\d{4}`;
const PHONE_RE = new RegExp(
  String.raw`(?<![\w.+-])(?:${CO_PREFIX}(?:${CO_MOBILE}|${CO_LANDLINE})|\+\d[\d\s().-]{6,18}\d)(?![\w.-]?\d)`,
  'g'
);

function looksLikePhone(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function redactPii(texto: string): string {
  if (!texto) return texto;
  return texto
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(PHONE_RE, match => (looksLikePhone(match) ? '[TELEFONO]' : match));
}

export interface RedactableHistorialItem {
  rol: string;
  contenido: string;
}

export function redactHistorial<T extends RedactableHistorialItem>(historial: T[]): T[] {
  return historial.map(item => ({ ...item, contenido: redactPii(item.contenido) }));
}
