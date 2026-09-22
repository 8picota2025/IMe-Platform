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

// Telefono CO (fijo/movil, con o sin +57, con o sin separadores) o
// internacional generico de 7-15 digitos con separadores opcionales.
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,17}\d)/g;

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
