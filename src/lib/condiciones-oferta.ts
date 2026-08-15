/**
 * Condiciones / consideraciones de oferta alineadas al boceto IPS.pdf.
 * Prefill en editor + fallback en PDF cuando el campo está vacío.
 */

export const CONDICIONES_SECTION_LABELS_ES = [
  'Entrega',
  'Costo de envío',
  'Garantía',
  'Instalación',
] as const;

export const CONDICIONES_SECTION_LABELS_EN = [
  'Delivery',
  'Shipping cost',
  'Warranty',
  'Installation',
] as const;

/** Texto por defecto (ES) — estructura del boceto comercial. */
export const CONDICIONES_OFERTA_DEFAULT_ES = `Entrega:
Confirmar plazos de entrega por línea con su asesor comercial I-ME.

Costo de envío:
Envíos fuera de ciudades principales o montos menores: Para pedidos inferiores al monto mínimo establecido (2,000,000) o despachos fuera de las ciudades principales, el costo del transporte y seguro será asumido en su totalidad por el cliente bajo la modalidad de flete contra entrega.

Garantía:
Según política del fabricante y condiciones confirmadas en esta oferta para cada equipo.

Instalación:
No incluye instalación`;

/** Texto por defecto (EN). */
export const CONDICIONES_OFERTA_DEFAULT_EN = `Delivery:
Confirm lead times per line with your I-ME commercial advisor.

Shipping cost:
Shipments outside main cities or below the minimum order amount: For orders under the established minimum (2,000,000) or dispatches outside main cities, transport and insurance costs are borne entirely by the customer under cash-on-delivery freight.

Warranty:
According to manufacturer policy and terms confirmed in this offer for each device.

Installation:
Installation not included`;

export function defaultCondicionesOferta(locale: 'es' | 'en' = 'es'): string {
  return locale === 'en' ? CONDICIONES_OFERTA_DEFAULT_EN : CONDICIONES_OFERTA_DEFAULT_ES;
}

export function resolveCondicionesOferta(
  value: string | null | undefined,
  locale: 'es' | 'en' = 'es'
): string {
  const trimmed = String(value ?? '').trim();
  return trimmed || defaultCondicionesOferta(locale);
}

/** True if line is a section title like "Entrega:" / "Garantía:". */
export function isCondicionesSectionHeading(line: string, locale: 'es' | 'en' = 'es'): boolean {
  const raw = line.trim();
  if (!raw.endsWith(':')) return false;
  const label = raw.slice(0, -1).trim().toLowerCase();
  const labels = locale === 'en' ? CONDICIONES_SECTION_LABELS_EN : CONDICIONES_SECTION_LABELS_ES;
  return labels.some(l => l.toLowerCase() === label);
}
